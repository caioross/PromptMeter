// PromptMeter — content script (MV3)
// Medidor de CUSTO de prompts: conta tokens de forma determinística (sem IA),
// detecta o modelo em uso, calcula o custo de entrada em tempo real e, quando possível,
// o custo da resposta e o total da sessão. Depende de tokenizer.js, pricing.js, models.js.

(() => {
  "use strict";

  // ---------- Config ----------
  const PAUSE_MS = 350;          // debounce de digitação
  const MAX_TEXT = 200000;       // teto de caracteres analisados
  const STREAM_IDLE_MS = 1400;   // resposta considerada "pronta" após este tempo sem mudar
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
  let wrap = null, card = null, menu = null;
  let debTimer = null;
  let lastTextByTarget = new WeakMap();
  let settings = null;
  let currentModelId = null;
  let modelSource = "default";
  let lastDraft = null;          // { text, tokens } do rascunho atual
  let pendingPrompt = null;      // { tokens, at } capturado ao enviar
  const processedResponses = new WeakSet();
  const respLen = new WeakMap(); // node -> último comprimento conhecido (para detectar fim do stream)

  // ---------- Settings ----------
  const DEFAULTS = {
    currency: "both",   // "usd" | "both"
    brlRate: 5.40,
    trackResponses: true,
    modelOverrides: {}  // { host: modelId }
  };

  async function loadSettings() {
    const s = await chrome.storage.sync.get(Object.keys(DEFAULTS));
    settings = {
      currency: s.currency || DEFAULTS.currency,
      brlRate: Number.isFinite(s.brlRate) ? s.brlRate : DEFAULTS.brlRate,
      trackResponses: typeof s.trackResponses === "boolean" ? s.trackResponses : DEFAULTS.trackResponses,
      modelOverrides: s.modelOverrides || {}
    };
    return settings;
  }

  // ---------- Sessão (custo acumulado por dia) ----------
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  async function getSession() {
    const { pmSession } = await chrome.storage.local.get(["pmSession"]);
    if (!pmSession || pmSession.date !== todayKey()) {
      return { date: todayKey(), inUSD: 0, outUSD: 0, msgs: 0 };
    }
    return pmSession;
  }
  async function addToSession(inUSD, outUSD) {
    const s = await getSession();
    s.inUSD += (Number(inUSD) || 0);
    s.outUSD += (Number(outUSD) || 0);
    s.msgs += 1;
    await chrome.storage.local.set({ pmSession: s });
    return s;
  }

  // ---------- Detecção de campo prompt-like ----------
  const BAD_INPUT_TYPES = /^(password|email|tel|number|date|datetime-local|month|week|time|color|file|range|hidden|checkbox|radio|submit|button|image|reset)$/i;
  const SENSITIVE_AC = /(^|\s)(cc-|new-password|current-password|one-time-code|otp)/i;
  const SENSITIVE_NAME = /(senha|password|cvv|cart[aã]o|card[-_ ]?number|otp|two[-_ ]?factor|2fa)/i;

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.isContentEditable) return true;
    if (el.tagName === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      if (BAD_INPUT_TYPES.test(t)) return false;
      return t === "text" || t === "search";
    }
    return false;
  }
  function sensitive(el) {
    try {
      const ac = (el.getAttribute && el.getAttribute("autocomplete")) || "";
      if (SENSITIVE_AC.test(ac)) return true;
      const meta = [el.getAttribute && el.getAttribute("name"), el.id,
        el.getAttribute && el.getAttribute("aria-label"),
        el.getAttribute && el.getAttribute("placeholder")].filter(Boolean).join(" ");
      if (SENSITIVE_NAME.test(meta)) return true;
      const form = el.closest && el.closest("form");
      if (form && form.querySelector && form.querySelector('input[type="password"]')) return true;
    } catch {}
    return false;
  }
  function isPromptLike(el) {
    if (!isEditable(el) || sensitive(el)) return false;
    if (el.tagName === "TEXTAREA" || el.isContentEditable) return true;
    const w = el.offsetWidth || 0, h = el.offsetHeight || 0;
    return w >= 280 && h >= 24;
  }
  function getText(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
    if (el.isContentEditable) return el.innerText || el.textContent || "";
    return "";
  }
  function realTarget(e) {
    if (e && typeof e.composedPath === "function") {
      for (const node of e.composedPath()) {
        if (node && node.nodeType === 1 && isEditable(node)) return node;
      }
    }
    return (e && e.target) || null;
  }

  // ---------- Modelo ----------
  function resolveModel() {
    const r = window.PM_MODELS.resolveModel(location.hostname, settings.modelOverrides);
    currentModelId = r.modelId;
    modelSource = r.source;
    return r;
  }

  // ---------- Overlay ----------
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function providerColor(p) {
    return p === "OpenAI" ? "#10a37f" : p === "Anthropic" ? "#d97757" : p === "Google" ? "#4285f4" : "#6366f1";
  }

  function ensureOverlay() {
    if (wrap) return;
    wrap = el("div", "pm-wrap");
    card = el("div", "pm-card");
    card.innerHTML = `
      <div class="pm-head">
        <button type="button" class="pm-model" aria-haspopup="menu" aria-expanded="false" title="${escapeHtml(i18n("change_model", "Trocar modelo"))}">
          <span class="pm-dot"></span><span class="pm-model-name">—</span><span class="pm-caret">▾</span>
        </button>
        <span class="pm-src"></span>
        <button type="button" class="pm-x" title="${escapeHtml(i18n("hide", "Esconder (Esc)"))}">✕</button>
      </div>
      <div class="pm-body">
        <div class="pm-metric pm-tokens"><b class="pm-tok-val">0</b><span class="pm-metric-label">tokens</span></div>
        <div class="pm-sep"></div>
        <div class="pm-metric pm-costin"><b class="pm-cost-val">$0</b><span class="pm-metric-label">${escapeHtml(i18n("input_cost", "custo de entrada"))}</span></div>
      </div>
      <div class="pm-foot" role="status" aria-live="polite">
        <span class="pm-resp" title="${escapeHtml(i18n("response_cost", "Custo da última resposta"))}">${escapeHtml(i18n("resp_idle", "resposta: —"))}</span>
        <span class="pm-session" title="${escapeHtml(i18n("session_total", "Total estimado hoje"))}">${escapeHtml(i18n("session", "sessão"))}: $0</span>
      </div>`;
    wrap.appendChild(card);
    menu = el("div", "pm-menu pm-hidden");
    menu.setAttribute("role", "menu");
    wrap.appendChild(menu);
    document.documentElement.appendChild(wrap);

    card.querySelector(".pm-model").addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); }, true);
    card.querySelector(".pm-x").addEventListener("click", (e) => { e.stopPropagation(); hideOverlay(); }, true);
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      // Esc fecha primeiro o menu de modelo (se aberto); só depois dispensa o card.
      if (menu && !menu.classList.contains("pm-hidden")) { closeMenu(); return; }
      if (wrap && !wrap.classList.contains("pm-hidden")) hideOverlay();
    });
    document.addEventListener("click", () => { closeMenu(); }, true);
  }

  function hideOverlay() { if (wrap) wrap.classList.add("pm-hidden"); }

  function buildMenu() {
    if (!menu) return;
    const models = window.PM_PRICING.listModels();
    const groups = {};
    for (const m of models) (groups[m.provider] = groups[m.provider] || []).push(m);
    let html = `<div class="pm-menu-title">${escapeHtml(i18n("pick_model", "Escolha o modelo cobrado"))}</div>`;
    for (const prov of Object.keys(groups)) {
      html += `<div class="pm-menu-group"><span class="pm-mdot" style="background:${providerColor(prov)}"></span>${escapeHtml(prov)}</div>`;
      for (const m of groups[prov]) {
        const sel = m.id === currentModelId ? " pm-sel" : "";
        const est = m.est ? ' <span class="pm-est">~</span>' : "";
        html += `<button type="button" role="menuitem" class="pm-mitem${sel}" data-id="${m.id}">
          <span class="pm-mname">${escapeHtml(m.label)}${est}</span>
          <span class="pm-mprice">$${m.in} / $${m.out}</span></button>`;
      }
    }
    html += `<div class="pm-menu-foot">${escapeHtml(i18n("prices_per_m", "USD por 1M tokens (entrada / saída)"))} · ${window.PM_PRICING.UPDATED}</div>`;
    menu.innerHTML = html;
    menu.querySelectorAll(".pm-mitem").forEach((b) => {
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = b.getAttribute("data-id");
        const host = location.hostname.toLowerCase();
        const overrides = { ...(settings.modelOverrides || {}) };
        overrides[host] = id;
        settings.modelOverrides = overrides;
        await chrome.storage.sync.set({ modelOverrides: overrides });
        currentModelId = id; modelSource = "user";
        closeMenu();
        if (activeTarget) evaluate(activeTarget, true);
      }, true);
    });
  }
  // Abrir/fechar do menu centralizados para manter aria-expanded sincronizado.
  function setMenuExpanded(open) {
    const btn = card && card.querySelector(".pm-model");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function openMenu() {
    if (!menu) return;
    buildMenu();
    menu.classList.remove("pm-hidden");
    setMenuExpanded(true);
    position();
  }
  function closeMenu() {
    if (menu && !menu.classList.contains("pm-hidden")) {
      menu.classList.add("pm-hidden");
      setMenuExpanded(false);
    }
  }
  function toggleMenu() {
    if (!menu) return;
    if (menu.classList.contains("pm-hidden")) openMenu();
    else closeMenu();
  }

  function position() {
    if (!wrap || !activeTarget || !document.contains(activeTarget)) return;
    let r; try { r = activeTarget.getBoundingClientRect(); } catch { return; }
    if (!r || (r.width === 0 && r.height === 0)) { hideOverlay(); return; }
    const vw = window.innerWidth, vh = window.innerHeight, margin = 8;
    let top = r.top - (wrap.offsetHeight || 96) - margin;            // acima do campo por padrão
    if (top < 6) top = Math.min(vh - (wrap.offsetHeight || 96) - 6, r.bottom + margin);
    let left = Math.max(6, Math.min(r.left, vw - (wrap.offsetWidth || 300) - 6));
    wrap.style.position = "fixed";
    wrap.style.top = `${Math.round(top)}px`;
    wrap.style.left = `${Math.round(left)}px`;
  }

  // ---------- Pipeline de avaliação (entrada) ----------
  async function evaluate(target, force) {
    if (!target || !document.contains(target) || !settings) return;
    const text = getText(target).slice(0, MAX_TEXT);
    if (!force) {
      const prev = lastTextByTarget.get(target);
      if (text === prev) return;
    }
    lastTextByTarget.set(target, text);

    resolveModel();
    const model = window.PM_PRICING.getModel(currentModelId);
    const trimmed = text.trim();

    // captura de envio: tinha rascunho e agora esvaziou => provavelmente enviou
    if (!trimmed && lastDraft && lastDraft.tokens > 0) {
      pendingPrompt = { tokens: lastDraft.tokens, at: Date.now() };
      lastDraft = null;
    }

    const { tokens, exact } = window.PM_PRICING.countTokens(trimmed, currentModelId);
    if (trimmed) lastDraft = { text: trimmed, tokens };

    const c = window.PM_PRICING.cost(currentModelId, tokens, 0);
    renderInput({ model, tokens, exact, inUSD: c.inUSD });
  }

  function renderInput({ model, tokens, exact, inUSD }) {
    if (!wrap) return;
    wrap.classList.remove("pm-hidden");
    const dot = card.querySelector(".pm-dot");
    const name = card.querySelector(".pm-model-name");
    const src = card.querySelector(".pm-src");
    const tokVal = card.querySelector(".pm-tok-val");
    const costVal = card.querySelector(".pm-cost-val");

    dot.style.background = providerColor(model ? model.provider : "");
    name.textContent = model ? model.label : "—";
    src.textContent = modelSource === "user" ? i18n("src_user", "você")
      : modelSource === "detected" ? i18n("src_detected", "detectado")
      : i18n("src_default", "padrão");
    src.className = "pm-src pm-src-" + modelSource;

    const pre = exact ? "" : "~";
    tokVal.textContent = pre + window.PM_PRICING.fmtTokens(tokens);
    tokVal.title = exact ? i18n("exact", "contagem exata") : i18n("approx", "estimativa");
    costVal.innerHTML = pre + escapeHtml(window.PM_PRICING.fmtUSD(inUSD)) + brlSuffix(inUSD);
    position();
  }

  function brlSuffix(usd) {
    if (!settings || settings.currency !== "both" || !settings.brlRate) return "";
    return ` <span class="pm-brl">${escapeHtml(window.PM_PRICING.fmtBRL(usd, settings.brlRate))}</span>`;
  }

  // ---------- Captura da resposta (best-effort) ----------
  function responseNodes() {
    const site = window.PM_MODELS.siteForHost(location.hostname);
    const sels = (site && site.responseSelectors) || [
      '[data-message-author-role="assistant"]',
      '[data-testid="assistant-message"]',
      '.model-response-text', 'message-content', '.font-claude-message', '.font-claude-response'
    ];
    const out = [];
    for (const s of sels) { try { document.querySelectorAll(s).forEach(n => out.push(n)); } catch {} }
    return out;
  }

  async function scanResponses() {
    if (!settings || !settings.trackResponses) return;
    const nodes = responseNodes();
    if (!nodes.length) return;
    const last = nodes[nodes.length - 1];
    if (processedResponses.has(last)) return;
    const text = (last.innerText || last.textContent || "").trim();
    const prevLen = respLen.get(last) || 0;
    respLen.set(last, text.length);
    if (text.length === 0) return;
    // se ainda está crescendo, reagenda uma reverificação até estabilizar
    if (text.length !== prevLen) { setTimeout(scanResponses, STREAM_IDLE_MS); return; }
    // estabilizou => processa uma vez
    processedResponses.add(last);
    const { tokens } = window.PM_PRICING.countTokens(text, currentModelId);
    const c = window.PM_PRICING.cost(currentModelId, 0, tokens);
    // associa custo de entrada do prompt enviado, se recente (< 5 min)
    let inUSD = 0, inTok = 0;
    if (pendingPrompt && (Date.now() - pendingPrompt.at) < 300000) {
      inTok = pendingPrompt.tokens;
      inUSD = window.PM_PRICING.cost(currentModelId, inTok, 0).inUSD;
      pendingPrompt = null;
    }
    const s = await addToSession(inUSD, c.outUSD);
    renderResponse({ outTokens: tokens, outUSD: c.outUSD, session: s });
  }

  function renderResponse({ outTokens, outUSD, session }) {
    if (!wrap) return;
    const resp = card.querySelector(".pm-resp");
    const sess = card.querySelector(".pm-session");
    const total = (session.inUSD + session.outUSD);
    resp.innerHTML = i18n("resp", "resposta") + ": <b>" + window.PM_PRICING.fmtTokens(outTokens) + "</b> tok · " +
      escapeHtml(window.PM_PRICING.fmtUSD(outUSD));
    sess.innerHTML = i18n("session", "sessão") + ": <b>" + escapeHtml(window.PM_PRICING.fmtUSD(total)) + "</b>" + brlSuffix(total);
    wrap.classList.remove("pm-hidden");
    position();
  }

  let respObserver = null;
  function startResponseObserver() {
    if (respObserver) return;
    let t = null;
    respObserver = new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(scanResponses, STREAM_IDLE_MS);
    });
    try { respObserver.observe(document.body, { childList: true, subtree: true, characterData: true }); } catch {}
  }

  // ---------- Listeners ----------
  async function onFocusIn(e) {
    const t = realTarget(e);
    if (!t || !isPromptLike(t)) return;
    if (!settings) await loadSettings();
    const { mutedSites = {} } = await chrome.storage.local.get(["mutedSites"]);
    if (mutedSites[location.hostname]) { hideOverlay(); return; }
    activeTarget = t;
    ensureOverlay();
    lastTextByTarget.delete(t);
    evaluate(t, true);
  }
  function onInput(e) {
    if (!activeTarget) return;
    const real = realTarget(e);
    if (real !== activeTarget && !(activeTarget.contains && activeTarget.contains(real))) return;
    clearTimeout(debTimer);
    debTimer = setTimeout(() => { if (activeTarget && document.contains(activeTarget)) evaluate(activeTarget); }, PAUSE_MS);
  }
  function onScrollResize() { position(); }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.currency || changes.brlRate || changes.trackResponses || changes.modelOverrides)) {
      loadSettings().then(() => { if (activeTarget) evaluate(activeTarget, true); });
    }
    if (area === "local" && changes.mutedSites) {
      const muted = (changes.mutedSites.newValue || {})[location.hostname];
      if (muted) hideOverlay(); else if (activeTarget) { wrap && wrap.classList.remove("pm-hidden"); position(); }
    }
  });

  // ---------- Boot ----------
  (async function boot() {
    await loadSettings();
    resolveModel();
    document.addEventListener("focusin", onFocusIn, true);
    ["input", "keyup", "paste"].forEach(ev => document.addEventListener(ev, onInput, true));
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize, true);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", onScrollResize, true);
    startResponseObserver();
    log("cost meter ready");
  })();
})();
