// PromptMeter — Options page logic (MV3, sem inline).

const DEFAULTS = { currency: "both", brlRate: 5.40, trackResponses: true, modelOverrides: {} };
const $ = (id) => document.getElementById(id);

// Mesmo contrato do helper de content.js: falhou ou veio vazio → fallback cravado.
const i18n = (key, fallback, subs) => {
  try {
    const m = chrome.i18n && chrome.i18n.getMessage && chrome.i18n.getMessage(key, subs);
    return (m && String(m).length) ? m : fallback;
  } catch { return fallback; }
};

// Data de atualização da tabela de preços (pricing.js carrega antes desta página).
const PRICE_DATE = (() => { try { return (window.PM_PRICING && window.PM_PRICING.UPDATED) || "—"; } catch { return "—"; } })();

// Mensagens com ênfase inline: só <strong>, <em> e <b> são reconhecidos e o texto
// é montado em nós — nenhuma mensagem de _locales chega a innerHTML.
function setRichText(el, msg) {
  const re = /<(strong|em|b)>([\s\S]*?)<\/\1>/gi;
  const frag = document.createDocumentFragment();
  let last = 0, m;
  while ((m = re.exec(msg))) {
    if (m.index > last) frag.append(msg.slice(last, m.index));
    const tag = document.createElement(m[1].toLowerCase());
    tag.textContent = m[2];
    frag.append(tag);
    last = re.lastIndex;
  }
  if (last < msg.length) frag.append(msg.slice(last));
  el.replaceChildren(frag);
}

function applyI18n() {
  const subs = { opt_how_it_works: [PRICE_DATE] };
  document.title = i18n("opt_title", document.title);
  document.documentElement.lang = i18n("opt_html_lang", document.documentElement.lang);
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const msg = i18n(el.dataset.i18n, null);
    if (msg) el.textContent = msg;
  }
  for (const el of document.querySelectorAll("[data-i18n-html]")) {
    const key = el.dataset.i18nHtml;
    const msg = i18n(key, null, subs[key]);
    if (msg) setRichText(el, msg);
  }
}

async function load() {
  const s = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  $("currency").value = s.currency || DEFAULTS.currency;
  $("brlRate").value = Number.isFinite(s.brlRate) ? s.brlRate : DEFAULTS.brlRate;
  $("trackResponses").checked = typeof s.trackResponses === "boolean" ? s.trackResponses : DEFAULTS.trackResponses;
  try { $("version").textContent = "v" + chrome.runtime.getManifest().version; } catch {}
  // Só existe quando a mensagem traduzida não foi aplicada (fallback do parágrafo cravado).
  if ($("priceDate")) $("priceDate").textContent = PRICE_DATE;
}

async function save() {
  const patch = {
    currency: $("currency").value,
    brlRate: Math.max(0, Number($("brlRate").value) || DEFAULTS.brlRate),
    trackResponses: $("trackResponses").checked
  };
  await chrome.storage.sync.set(patch);
  flash(i18n("opt_saved", "Salvo ✓"));
}

function flash(msg) {
  const st = $("status");
  st.textContent = msg;
  st.className = "ok";
  setTimeout(() => { st.textContent = ""; st.className = "muted"; }, 1800);
}

$("save").addEventListener("click", save);
$("resetSession").addEventListener("click", async () => {
  await chrome.storage.local.remove("pmSession");
  flash(i18n("opt_session_reset", "Sessão zerada ✓"));
});
$("clearHistory").addEventListener("click", async () => {
  // Ação destrutiva (apaga até 90 dias): exige confirmação explícita.
  const ask = i18n("opt_confirm_clear_history", "Apagar todo o histórico de gastos guardado neste navegador? Esta ação não pode ser desfeita.");
  if (!confirm(ask)) return;
  await chrome.storage.local.remove("pmHistory");
  flash(i18n("opt_history_cleared", "Histórico apagado ✓"));
});
$("clearOverrides").addEventListener("click", async () => {
  await chrome.storage.sync.set({ modelOverrides: {} });
  flash(i18n("opt_overrides_cleared", "Preferências de modelo limpas ✓"));
});

applyI18n();
load();
