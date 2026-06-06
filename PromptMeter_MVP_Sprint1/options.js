// PromptMeter — Options page logic.
// Script externo é obrigatório no MV3 (CSP padrão proíbe inline).

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function setStatus(el, text, ok) {
    el.textContent = text || "";
    el.classList.remove("ok", "err");
    if (typeof ok === "boolean") el.classList.add(ok ? "ok" : "err");
  }

  async function load() {
    const manifest = chrome.runtime.getManifest();
    $("version").textContent = "v" + manifest.version;

    const sync = await chrome.storage.sync.get(["backendURL", "dailyLimit", "premiumEnabled", "language"]);
    const local = await chrome.storage.local.get(["dailyUsed", "dailyDate"]);

    $("backendURL").value = sync.backendURL || "";
    $("limit").value = Number.isFinite(sync.dailyLimit) ? sync.dailyLimit : 30;
    $("premium").checked = !!sync.premiumEnabled;
    $("language").value = sync.language || "auto";

    $("usage").textContent =
      `Uso de hoje (${local.dailyDate || todayKey()}): ${local.dailyUsed || 0} avaliações.`;
  }

  function validateURL(u) {
    if (!u) return true; // vazio = só local
    return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(u);
  }

  async function save() {
    const backendURL = $("backendURL").value.trim().replace(/\/+$/, "");
    if (!validateURL(backendURL)) {
      setStatus($("status"), "URL inválida — use http(s)://… ou deixe vazio.", false);
      return;
    }
    const dailyLimit = Math.max(1, parseInt($("limit").value, 10) || 30);
    const premiumEnabled = $("premium").checked;
    const language = $("language").value || "auto";
    await chrome.storage.sync.set({ backendURL, dailyLimit, premiumEnabled, language });
    setStatus($("status"), "Preferências salvas.", true);
  }

  async function resetToday() {
    await new Promise((resolve) => chrome.runtime.sendMessage({ type: "reset_today" }, () => resolve()));
    await load();
    setStatus($("status"), "Uso de hoje zerado.", true);
  }

  async function purgeAll() {
    if (!confirm("Limpar TODAS as preferências e histórico local da PromptMeter?")) return;
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
    await load();
    setStatus($("status"), "Tudo limpo. Recarregue as abas para aplicar.", true);
  }

  async function testBackend() {
    const url = $("backendURL").value.trim().replace(/\/+$/, "");
    if (!validateURL(url)) { setStatus($("testStatus"), "URL inválida.", false); return; }
    if (!url) { setStatus($("testStatus"), "Vazio = modo só local (OK).", true); return; }
    setStatus($("testStatus"), "Testando…");
    chrome.runtime.sendMessage({ type: "test_backend", url }, (resp) => {
      if (!resp) { setStatus($("testStatus"), "Sem resposta do service worker.", false); return; }
      if (resp.ok) setStatus($("testStatus"), `OK (HTTP ${resp.status}).`, true);
      else setStatus($("testStatus"), `Falhou: ${resp.error || resp.status || "?"}.`, false);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("save").addEventListener("click", save);
    $("reset").addEventListener("click", resetToday);
    $("purge").addEventListener("click", purgeAll);
    $("test").addEventListener("click", testBackend);
    load().catch((e) => setStatus($("status"), "Erro ao carregar: " + e, false));
  });
})();
