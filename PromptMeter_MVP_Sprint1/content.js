// PromptMeter — content script (MV3)
// Detecta foco em campos prompt-like, avalia o texto (heurística local; backend opcional),
// renderiza overlay flutuante com nota 0–10 e dica curta, controla cota diária e mute por host.

(() => {
  "use strict";

  // ---------- Config ----------
  const PAUSE_MS = 600;
  const MAX_TEXT_BACKEND = 4096;   // limite enviado ao backend (privacidade + custo)
  const MAX_TEXT_LOCAL = 8192;     // limite para heurística local
  const BACKEND_TIMEOUT_MS = 2500;
  const LAST_HASHES_KEEP = 200;
  const DEBUG = (() => { try { return localStorage.getItem("PM_DEBUG") === "1"; } catch { return false; } })();

  const log = (...a) => { if (DEBUG) try { console.log("[PromptMeter]", ...a); } catch {} };

  const i18n = (key, fallback) => {
    try {
      const m = chrome.i18n && chrome.i18n.getMessage && chrome.i18n.getMessage(key);
      return (m && String(m).length) ? m : fallback;
    } catch { return fallback; }
  };

  // ---------- Estado ----------
  let activeTarget = null;
  let wrap = null;
  let card = null;
  let toggleBtn = null;
  let debTimer = null;
  let lastTextByTarget = new WeakMap();
  let storageQueue = Promise.resolve(); // serializa escritas
  let routePollTimer = null;
  let lastHref = location.href;

  // ---------- Utils ----------
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // FNV-1a 32-bit em hex — bem menos colisões que djb2 simples.
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  function strongHash(text) {
    const s = String(text || "").replace(/\s+/g, " ").trim();
    // 2 passes em janelas diferentes pra reduzir colisões em prefixos iguais
    const head = s.slice(0, 2048);
    const tail = s.slice(-2048);
    return fnv1a(head) + "-" + fnv1a(tail) + "-" + s.length.toString(16);
  }

  // ---------- Storage helpers serializados ----------
  function withStorage(fn) {
    const next = storageQueue.then(fn, fn);
    storageQueue = next.catch(() => {});
    return next;
  }

  async function getState() {
    const [local, sync] = await Promise.all([
      chrome.storage.local.get(["dailyUsed", "dailyDate", "mutedSites", "lastHashes"]),
      chrome.storage.sync.get(["premiumEnabled", "dailyLimit", "backendURL", "language"])
    ]);
    return {
      dailyUsed: Number.isFinite(local.dailyUsed) ? local.dailyUsed : 0,
      dailyDate: local.dailyDate || todayKey(),
      mutedSites: local.mutedSites || {},
      lastHashes: Array.isArray(local.lastHashes) ? local.lastHashes : [],
      premiumEnabled: !!sync.premiumEnabled,
      dailyLimit: Number.isFinite(sync.dailyLimit) ? Math.max(1, sync.dailyLimit) : 30,
      backendURL: (sync.backendURL || "").replace(/\/+$/, ""),
      language: sync.language || "auto"
    };
  }

  // Verifica se uma avaliação pode prosseguir (sem incrementar). Retorna { allowed, reason, dailyUsed, dailyLimit, premium }.
  async function checkQuota(hash) {
    return withStorage(async () => {
      const local = await chrome.storage.local.get(["dailyUsed", "dailyDate", "lastHashes"]);
      const sync = await chrome.storage.sync.get(["dailyLimit", "premiumEnabled"]);
      const dkey = todayKey();
      let dailyUsed = local.dailyUsed || 0;
      let lastHashes = Array.isArray(local.lastHashes) ? local.lastHashes : [];
      if (local.dailyDate !== dkey) {
        dailyUsed = 0; lastHashes = [];
        await chrome.storage.local.set({ dailyDate: dkey, dailyUsed: 0, lastHashes: [] });
      }
      const limit = Number.isFinite(sync.dailyLimit) ? Math.max(1, sync.dailyLimit) : 30;
      const premium = !!sync.premiumEnabled;
      const duplicate = lastHashes.includes(hash);
      if (premium || duplicate) {
        return { allowed: true, reason: duplicate ? "dup" : "premium", dailyUsed, dailyLimit: limit, premium };
      }
      if (dailyUsed >= limit) {
        return { allowed: false, reason: "limit", dailyUsed, dailyLimit: limit, premium };
      }
      return { allowed: true, reason: "fresh", dailyUsed, dailyLimit: limit, premium };
    });
  }

  // Confirma o consumo após sucesso. Idempotente por hash dentro do dia.
  async function consumeQuota(hash) {
    return withStorage(async () => {
      const local = await chrome.storage.local.get(["dailyUsed", "dailyDate", "lastHashes"]);
      const dkey = todayKey();
      let dailyUsed = local.dailyUsed || 0;
      let lastHashes = Array.isArray(local.lastHashes) ? local.lastHashes : [];
      if (local.dailyDate !== dkey) { dailyUsed = 0; lastHashes = []; }
      if (lastHashes.includes(hash)) {
        return { dailyUsed };
      }
      const next = dailyUsed + 1;
      const newHashes = [hash, ...lastHashes].slice(0, LAST_HASHES_KEEP);
      await chrome.storage.local.set({ dailyDate: dkey, dailyUsed: next, lastHashes: newHashes });
      return { dailyUsed: next };
    });
  }

  // ---------- Detecção de elemento prompt-like ----------
  const BAD_INPUT_TYPES = /^(password|email|tel|number|date|datetime-local|month|week|time|color|file|range|hidden|checkbox|radio|submit|button|image|reset)$/i;
  const SENSITIVE_AUTOCOMPLETE = /(^|\s)(cc-|new-password|current-password|one-time-code|otp)/i;
  const SENSITIVE_NAME = /(senha|password|cvv|cartao|cart[aã]o|card[-_ ]?number|otp|two[-_ ]?factor|2fa)/i;

  function isEditableElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.isContentEditable) return true;
    if (el.tagName === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      if (BAD_INPUT_TYPES.test(t)) return false;
      // só consideramos input "text" ou "search" como possível prompt
      return t === "text" || t === "search";
    }
    return false;
  }

  function looksSensitive(el) {
    try {
      const ac = (el.getAttribute && el.getAttribute("autocomplete")) || "";
      if (SENSITIVE_AUTOCOMPLETE.test(ac)) return true;
      const meta = [
        el.getAttribute && el.getAttribute("name"),
        el.id,
        el.getAttribute && el.getAttribute("aria-label"),
        el.getAttribute && el.getAttribute("placeholder")
      ].filter(Boolean).join(" ");
      if (SENSITIVE_NAME.test(meta)) return true;
      if (el.getAttribute && el.getAttribute("role") === "search") return false; // permitido, mas avaliado abaixo
      // campos dentro de form de login
      const form = el.closest && el.closest("form");
      if (form) {
        const hasPwd = form.querySelector && form.querySelector('input[type="password"]');
        if (hasPwd) return true;
      }
    } catch {}
    return false;
  }

  function isPromptLike(el) {
    if (!isEditableElement(el)) return false;
    if (looksSensitive(el)) return false;
    if (el.tagName === "TEXTAREA" || el.isContentEditable) return true;
    // INPUT text/search só se for "grande"
    const w = el.offsetWidth || 0, h = el.offsetHeight || 0;
    return w >= 320 && h >= 28;
  }

  function getText(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
    if (el.isContentEditable) return el.innerText || el.textContent || "";
    return "";
  }

  function getRealTarget(e) {
    // suporta Shadow DOM
    if (e && typeof e.composedPath === "function") {
      const path = e.composedPath();
      for (const node of path) {
        if (node && node.nodeType === 1 && isEditableElement(node)) return node;
      }
    }
    return e && e.target || null;
  }

  // ---------- Heurística local ----------
  // Retorna { score: 0..10, tip: string<=142 chars, reasons: string[] }
  function localAnalyze(rawText, lang) {
    const text = String(rawText || "").slice(0, MAX_TEXT_LOCAL);
    const trimmed = text.trim();
    const len = trimmed.length;
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const lines = trimmed ? trimmed.split(/\n+/).length : 0;
    const isPT = (lang || "").toLowerCase().startsWith("pt");

    if (len === 0) {
      return { score: 0, tip: isPT ? "Comece descrevendo o objetivo e o contexto." : "Start by stating the goal and context.", reasons: ["empty"] };
    }

    let score = 0;
    const reasons = [];

    // 1) Comprimento útil — curva: 0..30=ruim, 30..80=ok, 80..600=ótimo, >1200=começa a penalizar se sem estrutura
    if (len < 15) { score += 0.5; reasons.push("muito-curto"); }
    else if (len < 30) { score += 1.5; reasons.push("curto"); }
    else if (len < 80) { score += 3; }
    else if (len < 600) { score += 4; }
    else if (len < 1500) { score += 3.5; }
    else { score += 2.5; reasons.push("muito-longo"); }

    // 2) Estrutura (parágrafos, listas, blocos de exemplo)
    const hasList = /(^|\n)\s*([-*•]|\d+\.)\s+/.test(trimmed);
    const hasHeaders = /(^|\n)\s*#{1,6}\s+/.test(trimmed) || /(^|\n)[A-ZÀ-Ý][^\n]{2,40}:\s*\n/.test(trimmed);
    const hasCode = /```|`[^`]+`/.test(trimmed);
    if (hasList) { score += 0.6; reasons.push("lista"); }
    if (hasHeaders) { score += 0.5; reasons.push("secoes"); }
    if (hasCode) { score += 0.4; reasons.push("code-block"); }
    if (lines >= 3 && len >= 200) { score += 0.5; reasons.push("multi-paragrafo"); }

    // 3) Sinais de instrução clara — verbos imperativos
    const imperPT = /\b(escreva|crie|gere|liste|resuma|explique|traduza|reescreva|analise|compare|sugira|desenhe|implemente|corrija|otimize|melhore|extraia|classifique|avalie|recomende)\b/i;
    const imperEN = /\b(write|create|generate|list|summarize|explain|translate|rewrite|analyze|analyse|compare|suggest|draw|implement|fix|optimi[sz]e|improve|extract|classify|evaluate|recommend)\b/i;
    if (imperPT.test(trimmed) || imperEN.test(trimmed)) { score += 1.0; reasons.push("instrucao"); }
    else { reasons.push("sem-verbo-imperativo"); }

    // 4) Contexto / papel
    const role = /\b(voc[eê] é|aja como|act as|you are|imagine que|considere|contexto:|context:)\b/i;
    if (role.test(trimmed)) { score += 0.6; reasons.push("papel/contexto"); }

    // 5) Exemplos
    const ex = /\b(exemplo|exemplos|por exemplo|ex\.|p\.\s*ex\.|for example|e\.g\.|example:)\b/i;
    if (ex.test(trimmed)) { score += 0.5; reasons.push("exemplo"); }

    // 6) Restrições / formato de saída
    const fmt = /\b(formato|em json|markdown|tabela|lista numerada|máx(imo)?|min(imo)?|no máximo|no mínimo|até \d+|in json|as a table|bullet points|max(imum)?|min(imum)?|under \d+)\b/i;
    if (fmt.test(trimmed)) { score += 0.7; reasons.push("formato"); }

    // 7) Especificidade — números, unidades, datas
    if (/\b\d+([.,]\d+)?(\s*(%|px|kb|mb|gb|s|min|h|dias?|meses?|anos?))?\b/i.test(trimmed)) { score += 0.4; reasons.push("numeros"); }

    // 8) Audiência / nível
    if (/\b(para iniciantes|nível (básico|intermediário|avançado)|audiência|público alvo|for beginners|expert level|target audience)\b/i.test(trimmed)) { score += 0.3; reasons.push("audiencia"); }

    // 9) Penalidades — ambiguidade
    const vague = /\b(isso|aquilo|coisa|algo|tal|whatever|stuff|things?)\b/gi;
    const vagueCount = (trimmed.match(vague) || []).length;
    if (vagueCount >= 3) { score -= 0.8; reasons.push("ambiguo"); }
    else if (vagueCount >= 1 && len < 120) { score -= 0.3; reasons.push("ambiguo-leve"); }

    // 10) Penalidades — só pergunta vaga
    if (/^(o que|como|por que|quando|onde|what|how|why|when|where)\b[^?]*\?$/i.test(trimmed) && len < 50) {
      score -= 0.6; reasons.push("pergunta-curta");
    }

    // 11) Penalidade — caps lock / spam
    const letters = trimmed.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if (letters.length > 20) {
      const upper = letters.replace(/[^A-ZÀ-Ý]/g, "").length;
      if (upper / letters.length > 0.6) { score -= 0.5; reasons.push("caps-excessivo"); }
    }

    // 12) Repetição
    if (words >= 12) {
      const w = trimmed.toLowerCase().split(/\s+/);
      const uniq = new Set(w).size;
      if (uniq / w.length < 0.45) { score -= 0.4; reasons.push("repetitivo"); }
    }

    // Clamp
    score = Math.max(0, Math.min(10, score));
    score = Math.round(score * 10) / 10;

    // Dica baseada no maior gap detectado
    const tip = buildTip(score, reasons, { isPT, len, hasList, hasHeaders });
    return { score, tip, reasons };
  }

  function buildTip(score, reasons, ctx) {
    const isPT = !!ctx.isPT;
    const has = (r) => reasons.includes(r);
    const t = isPT
      ? {
          empty: "Comece descrevendo o objetivo e o contexto.",
          short: "Acrescente contexto: o que, para quem e em que formato.",
          long: "Reduza para o essencial e separe em seções claras.",
          needVerb: "Use um verbo claro: explique, liste, gere, compare…",
          needRole: "Defina um papel/contexto (ex.: 'aja como…').",
          needFmt: "Especifique o formato de saída (JSON, lista, tabela, tamanho).",
          needEx: "Inclua 1 exemplo de entrada/saída para guiar o modelo.",
          vague: "Troque 'isso/coisa' por nomes concretos do que você quer.",
          caps: "Evite CAPS — não melhora a resposta e parece spam.",
          rep: "Você está repetindo palavras; reformule para ficar mais nítido.",
          ok: "Bom prompt — pode refinar com restrições e exemplos.",
          great: "Excelente — clareza, formato e contexto presentes."
        }
      : {
          empty: "Start by stating the goal and context.",
          short: "Add context: what you want, for whom, and in what format.",
          long: "Trim to the essentials and break into clear sections.",
          needVerb: "Use a clear verb: explain, list, generate, compare…",
          needRole: "Define a role/context (e.g., 'act as…').",
          needFmt: "Specify output format (JSON, list, table, length).",
          needEx: "Include 1 input/output example to guide the model.",
          vague: "Replace 'this/thing' with concrete names of what you want.",
          caps: "Avoid CAPS — it doesn't help and feels spammy.",
          rep: "You're repeating words; rephrase for sharper meaning.",
          ok: "Good prompt — refine with constraints and examples.",
          great: "Excellent — clear intent, format and context present."
        };

    if (has("empty")) return t.empty;
    if (has("muito-curto") || has("curto")) return t.short;
    if (has("ambiguo")) return t.vague;
    if (has("caps-excessivo")) return t.caps;
    if (has("repetitivo")) return t.rep;
    if (!reasons.includes("instrucao")) return t.needVerb;
    if (!reasons.includes("papel/contexto") && score < 8) return t.needRole;
    if (!reasons.includes("formato") && score < 9) return t.needFmt;
    if (!reasons.includes("exemplo") && score < 9.5) return t.needEx;
    if (has("muito-longo")) return t.long;
    if (score >= 9) return t.great;
    return t.ok;
  }

  // ---------- Backend opcional ----------
  async function analyzeWithBackend(text, backendURL, lang) {
    if (!backendURL || !/^https?:\/\//i.test(backendURL)) return { ok: false, error: "no_backend" };
    const truncated = String(text || "").slice(0, MAX_TEXT_BACKEND);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), BACKEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${backendURL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PM-Version": (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || "0",
          "X-PM-Lang": lang || "auto"
        },
        body: JSON.stringify({ text: truncated, site: location.hostname, lang: lang || navigator.language }),
        cache: "no-store",
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!res.ok) return { ok: false, error: "http_" + res.status };
      const data = await res.json();
      const score = Number(data && data.score);
      const tip = String((data && data.tip) || "").slice(0, 142);
      if (!Number.isFinite(score)) return { ok: false, error: "bad_payload" };
      return { ok: true, data: { score: Math.max(0, Math.min(10, score)), tip } };
    } catch (err) {
      clearTimeout(t);
      const name = (err && err.name) || "";
      if (name === "AbortError") return { ok: false, error: "timeout" };
      return { ok: false, error: "network" };
    }
  }

  // ---------- Overlay ----------
  function ensureOverlay(target, compact) {
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "pm-wrap";
      wrap.setAttribute("role", "status");
      wrap.setAttribute("aria-live", "polite");
      card = document.createElement("div");
      card.className = "pm-card";
      card.innerHTML = `
        <div class="pm-main">
          <div class="pm-meter" aria-hidden="true"><div class="pm-fill"></div></div>
          <div class="pm-note"></div>
        </div>
        <div class="pm-ctr">
          <span class="pm-score" aria-label="${escapeHtml(i18n("score_label", "Nota"))}">—</span>
          <span class="pm-chip pm-quota" title="${escapeHtml(i18n("quota_title", "Uso de hoje"))}">0/0</span>
          <button type="button" class="pm-link pm-toggle" tabindex="0">${escapeHtml(i18n("mute", "silenciar"))}</button>
        </div>`;
      wrap.appendChild(card);
      document.documentElement.appendChild(wrap);
      toggleBtn = card.querySelector(".pm-toggle");
      toggleBtn.addEventListener("click", onToggleMute, true);
      toggleBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleMute(e); }
      });
      // Esc esconde
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && wrap && !wrap.classList.contains("pm-hidden")) {
          wrap.classList.add("pm-hidden");
        }
      });
    }
    wrap.classList.toggle("pm-compact", !!compact);
    wrap.classList.remove("pm-hidden");
    positionOverlay(target);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function onToggleMute(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const { mutedSites = {} } = await chrome.storage.local.get(["mutedSites"]);
    const host = location.hostname || "unknown";
    const next = { ...mutedSites };
    if (next[host]) delete next[host]; else next[host] = true;
    await chrome.storage.local.set({ mutedSites: next });
    if (toggleBtn) toggleBtn.textContent = next[host] ? i18n("unmute", "reativar") : i18n("mute", "silenciar");
    if (wrap) {
      if (next[host]) wrap.classList.add("pm-hidden");
      else { wrap.classList.remove("pm-hidden"); positionOverlay(activeTarget); }
    }
  }

  function positionOverlay(target) {
    if (!wrap || !target || !document.contains(target)) return;
    let r;
    try { r = target.getBoundingClientRect(); } catch { return; }
    if (!r || (r.width === 0 && r.height === 0)) { wrap.classList.add("pm-hidden"); return; }
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const margin = 8;
    // posiciona abaixo; se não couber, posiciona acima
    let top = r.bottom + margin;
    const cardH = wrap.offsetHeight || 64;
    if (top + cardH > vh - 4) top = Math.max(4, r.top - cardH - margin);
    let left = Math.max(4, Math.min(r.left, vw - (wrap.offsetWidth || 280) - 4));
    wrap.style.position = "fixed";
    wrap.style.top = `${Math.round(top)}px`;
    wrap.style.left = `${Math.round(left)}px`;
  }

  // ---------- Pipeline de avaliação ----------
  async function evaluate(target) {
    if (!target || !document.contains(target)) return;
    const text = getText(target);
    const prev = lastTextByTarget.get(target);
    if (text === prev) return;
    lastTextByTarget.set(target, text);

    const st = await getState();
    const lang = st.language === "auto" ? (navigator.language || "pt-BR") : st.language;

    if (!text.trim()) {
      const local = localAnalyze("", lang);
      await updateUI({ score: local.score, tip: local.tip, state: "empty" }, { used: st.dailyUsed, limit: st.dailyLimit, premium: st.premiumEnabled });
      return;
    }

    // estado loading enquanto decide
    await updateUI({ score: null, tip: i18n("loading", "Analisando…"), state: "loading" }, { used: st.dailyUsed, limit: st.dailyLimit, premium: st.premiumEnabled });

    const hash = strongHash(text);
    const q = await checkQuota(hash);

    if (!q.allowed && q.reason === "limit") {
      await updateUI({
        score: null,
        tip: i18n("limit_reached", "Limite diário atingido. Volte amanhã ou ative o Premium."),
        state: "limit"
      }, { used: q.dailyUsed, limit: q.dailyLimit, premium: q.premium });
      return;
    }

    // Avalia: primeiro localmente (sempre); se houver backend, tenta substituir.
    const local = localAnalyze(text, lang);
    let final = { score: local.score, tip: local.tip, source: "local" };

    if (st.backendURL) {
      const remote = await analyzeWithBackend(text, st.backendURL, lang);
      if (remote.ok) {
        final = { score: remote.data.score, tip: remote.data.tip || local.tip, source: "backend" };
      } else {
        log("backend falhou:", remote.error);
      }
    }

    // Consome cota só agora (sucesso). Duplicados não consomem (idempotente por hash).
    let usedAfter = q.dailyUsed;
    if (q.reason === "fresh") {
      const c = await consumeQuota(hash);
      usedAfter = c.dailyUsed;
    }

    await updateUI({
      score: final.score,
      tip: final.tip,
      state: "ok",
      source: final.source
    }, { used: usedAfter, limit: q.dailyLimit, premium: q.premium });
  }

  async function updateUI({ score, tip, state, source }, usage) {
    if (!wrap) return;
    const fill = wrap.querySelector(".pm-fill");
    const note = wrap.querySelector(".pm-note");
    const scoreEl = wrap.querySelector(".pm-score");
    const quota = wrap.querySelector(".pm-quota");

    // limpa estados anteriores
    wrap.classList.remove("pm-state-loading", "pm-state-ok", "pm-state-limit", "pm-state-error", "pm-state-empty");
    wrap.classList.add(`pm-state-${state || "ok"}`);

    const numeric = Number(score);
    const valid = Number.isFinite(numeric);
    const pct = valid ? Math.max(0, Math.min(100, Math.round(numeric / 10 * 100))) : 0;
    fill.style.width = pct + "%";
    scoreEl.textContent = valid ? numeric.toFixed(1) : "—";
    note.textContent = tip || "";
    if (source === "local") note.title = i18n("source_local", "Análise local");
    else if (source === "backend") note.title = i18n("source_backend", "Análise via backend");
    else note.title = "";

    if (usage.premium) {
      quota.textContent = "∞";
      quota.classList.add("pm-muted");
    } else {
      quota.textContent = `${usage.used}/${usage.limit}`;
      quota.classList.remove("pm-muted");
    }

    const { mutedSites = {} } = await chrome.storage.local.get(["mutedSites"]);
    const host = location.hostname || "unknown";
    if (toggleBtn) toggleBtn.textContent = mutedSites[host] ? i18n("unmute", "reativar") : i18n("mute", "silenciar");

    positionOverlay(activeTarget);
  }

  // ---------- Listeners ----------
  async function onFocusIn(e) {
    const el = getRealTarget(e);
    if (!el || !isPromptLike(el)) return;
    const { mutedSites = {} } = await chrome.storage.local.get(["mutedSites"]);
    if (mutedSites[location.hostname]) {
      if (wrap) wrap.classList.add("pm-hidden");
      return;
    }
    activeTarget = el;
    ensureOverlay(el, el.offsetHeight < 80 || el.offsetWidth < 320);
    lastTextByTarget.delete(el); // garante reavaliação ao focar
    evaluate(el);
  }

  function onFocusOut(e) {
    // se foco saiu do activeTarget e não voltou para dentro do nosso overlay
    clearTimeout(debTimer);
    // pequena espera para permitir clique no botão de mute
    setTimeout(() => {
      const ae = document.activeElement;
      if (!ae || !isPromptLike(ae)) {
        if (wrap) wrap.classList.add("pm-hidden");
        activeTarget = null;
      }
    }, 120);
  }

  function onInputEvt(e) {
    if (!activeTarget) return;
    const real = getRealTarget(e);
    if (real !== activeTarget && !(activeTarget.contains && activeTarget.contains(real))) return;
    clearTimeout(debTimer);
    debTimer = setTimeout(() => {
      if (activeTarget && document.contains(activeTarget)) evaluate(activeTarget);
    }, PAUSE_MS);
  }

  function onScrollOrResize() { positionOverlay(activeTarget); }

  // Detecta troca de rota em SPAs (history pushState/replaceState não emitem evento nativo de "navegação")
  function startRoutePolling() {
    if (routePollTimer) return;
    routePollTimer = setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        activeTarget = null;
        if (wrap) wrap.classList.add("pm-hidden");
      }
    }, 800);
  }

  // Reaplica configurações ao vivo quando o usuário muda nas Opções
  chrome.storage.onChanged.addListener((changes, area) => {
    if (!wrap || !activeTarget) return;
    if (area === "sync" && (changes.dailyLimit || changes.premiumEnabled || changes.backendURL)) {
      evaluate(activeTarget);
    }
    if (area === "local" && changes.mutedSites) {
      const muted = (changes.mutedSites.newValue || {})[location.hostname];
      if (muted) wrap.classList.add("pm-hidden");
      else { wrap.classList.remove("pm-hidden"); positionOverlay(activeTarget); }
    }
  });

  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  ["input", "keyup", "paste"].forEach(evt => document.addEventListener(evt, onInputEvt, true));
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize, true);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", onScrollOrResize, true);
  startRoutePolling();

  log("ready v" + ((chrome.runtime.getManifest && chrome.runtime.getManifest().version) || "?"));
})();
