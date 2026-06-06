// PromptMeter — background service worker (MV3)
// Responsabilidades:
//  - Semear defaults no onInstalled.
//  - Tratar clique no ícone da toolbar abrindo a página de Opções.
//  - Mensageria simples (reset de cota, ping de saúde).

const DEFAULTS_SYNC = {
  backendURL: "",        // vazio = somente análise local; preencher para usar backend opcional
  dailyLimit: 30,
  premiumEnabled: false,
  language: "auto"       // auto = navigator.language
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const s = await chrome.storage.sync.get(Object.keys(DEFAULTS_SYNC));
    const patch = {};
    for (const k of Object.keys(DEFAULTS_SYNC)) {
      if (k === "dailyLimit") {
        if (!Number.isFinite(s[k])) patch[k] = DEFAULTS_SYNC[k];
      } else if (k === "premiumEnabled") {
        if (typeof s[k] !== "boolean") patch[k] = DEFAULTS_SYNC[k];
      } else if (typeof s[k] === "undefined" || s[k] === null) {
        patch[k] = DEFAULTS_SYNC[k];
      }
    }
    if (Object.keys(patch).length) await chrome.storage.sync.set(patch);

    const l = await chrome.storage.local.get(["dailyDate"]);
    if (!l.dailyDate) {
      await chrome.storage.local.set({ dailyDate: todayKey(), dailyUsed: 0, lastHashes: [], mutedSites: {} });
    }
  } catch (e) {
    // service workers podem perder console em alguns casos; mantemos silencioso
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || typeof msg.type !== "string") {
        sendResponse({ ok: false, error: "bad_message" });
        return;
      }
      if (msg.type === "ping") {
        sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
        return;
      }
      if (msg.type === "reset_today") {
        await chrome.storage.local.set({ dailyDate: todayKey(), dailyUsed: 0, lastHashes: [] });
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "test_backend") {
        const url = String(msg.url || "").replace(/\/+$/, "");
        if (!/^https?:\/\//i.test(url)) { sendResponse({ ok: false, error: "invalid_url" }); return; }
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        try {
          const res = await fetch(`${url}/health`, { method: "GET", signal: ctrl.signal, cache: "no-store" });
          clearTimeout(t);
          sendResponse({ ok: res.ok, status: res.status });
        } catch (err) {
          clearTimeout(t);
          sendResponse({ ok: false, error: String(err && err.message || err) });
        }
        return;
      }
      sendResponse({ ok: false, error: "unknown_type" });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true; // resposta assíncrona
});
