// PromptMeter — background service worker (MV3)
// Sem rede, sem IA. Apenas semeia defaults e abre as Opções ao clicar no ícone.

const DEFAULTS_SYNC = {
  currency: "both",       // "usd" | "both"  (both = USD + BRL aproximado)
  brlRate: 5.40,          // cotação USD->BRL usada na conversão aproximada
  trackResponses: true,   // estimar custo da resposta e total da sessão
  modelOverrides: {}      // { host: modelId } escolhido pelo usuário
};

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const s = await chrome.storage.sync.get(Object.keys(DEFAULTS_SYNC));
    const patch = {};
    for (const k of Object.keys(DEFAULTS_SYNC)) {
      if (typeof s[k] === "undefined" || s[k] === null) patch[k] = DEFAULTS_SYNC[k];
    }
    if (Object.keys(patch).length) await chrome.storage.sync.set(patch);
  } catch (e) {}
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg && msg.type === "ping") {
        sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
        return;
      }
      if (msg && msg.type === "reset_session") {
        await chrome.storage.local.remove("pmSession");
        sendResponse({ ok: true });
        return;
      }
      sendResponse({ ok: false, error: "unknown_type" });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true;
});
