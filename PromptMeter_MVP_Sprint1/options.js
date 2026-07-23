// PromptMeter — Options page logic (MV3, sem inline).

const DEFAULTS = { currency: "both", brlRate: 5.40, trackResponses: true, modelOverrides: {} };
const $ = (id) => document.getElementById(id);

async function load() {
  const s = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  $("currency").value = s.currency || DEFAULTS.currency;
  $("brlRate").value = Number.isFinite(s.brlRate) ? s.brlRate : DEFAULTS.brlRate;
  $("trackResponses").checked = typeof s.trackResponses === "boolean" ? s.trackResponses : DEFAULTS.trackResponses;
  try { $("version").textContent = "v" + chrome.runtime.getManifest().version; } catch {}
  try { if (window.PM_PRICING) $("priceDate").textContent = window.PM_PRICING.UPDATED; } catch {}
}

async function save() {
  const patch = {
    currency: $("currency").value,
    brlRate: Math.max(0, Number($("brlRate").value) || DEFAULTS.brlRate),
    trackResponses: $("trackResponses").checked
  };
  await chrome.storage.sync.set(patch);
  flash("Salvo ✓");
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
  flash("Sessão zerada ✓");
});
$("clearHistory").addEventListener("click", async () => {
  // Ação destrutiva (apaga até 90 dias): exige confirmação explícita.
  if (!confirm("Apagar todo o histórico de gastos guardado neste navegador? Esta ação não pode ser desfeita.")) return;
  await chrome.storage.local.remove("pmHistory");
  flash("Histórico apagado ✓");
});
$("clearOverrides").addEventListener("click", async () => {
  await chrome.storage.sync.set({ modelOverrides: {} });
  flash("Preferências de modelo limpas ✓");
});

load();
