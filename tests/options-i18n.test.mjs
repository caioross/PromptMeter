/**
 * Testes da localização da página de Opções (issue #57).
 * Zero dependências. Uso: node --test tests/*.test.mjs (ou via node scripts/gate.mjs)
 *
 * `options.js` não roda em Node (mexe em DOM e chrome.*), então ele é executado num
 * sandbox `vm` com um mini-DOM e um stub de chrome.i18n alimentado pelos arquivos
 * REAIS de `_locales/` — assim o teste falha se uma chave sumir de um dos idiomas.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT = path.join(ROOT, "PromptMeter_MVP_Sprint1");
const HTML = readFileSync(path.join(EXT, "options.html"), "utf8");
const JS = readFileSync(path.join(EXT, "options.js"), "utf8");
const locale = (l) => JSON.parse(readFileSync(path.join(EXT, `_locales/${l}/messages.json`), "utf8"));
const PT = locale("pt_BR"), EN = locale("en");

// Chaves marcadas no HTML, com o texto cravado que serve de fallback (do elemento
// que carrega o atributo até o fechamento da MESMA tag — os nós marcados não aninham).
const marks = (attr) => [...HTML.matchAll(new RegExp(`<([a-z]+)[^>]*\\b${attr}="([^"]+)"[^>]*>([\\s\\S]*?)<\\/\\1>`, "g"))]
  .map(([, , key, raw]) => ({ key, raw: raw.trim() }));
const PLAIN = marks("data-i18n"), RICH = marks("data-i18n-html");
const JS_KEYS = [...JS.matchAll(/i18n\("([^"]+)"/g)].map((m) => m[1]);

/* ── mini-DOM ── */
const serialize = (n) => n.kids.map((k) => (typeof k === "string" ? k : `<${k.tag}>${k.textContent}</${k.tag}>`)).join("");
const node = (tag, textContent = "") => ({
  tag, textContent, dataset: {}, kids: [], listeners: {},
  addEventListener(ev, fn) { this.listeners[ev] = fn; },
  append(...ns) { this.kids.push(...ns); },
  replaceChildren(frag) { this.kids = frag.kids.slice(); this.textContent = serialize(frag); },
});

// Roda options.js com o locale pedido; `i18nOff` simula chrome.i18n indisponível.
function render({ messages = null, i18nOff = false } = {}) {
  const byId = new Map();
  const el = (id) => { if (!byId.has(id)) byId.set(id, node("div")); return byId.get(id); };
  const plain = PLAIN.map(({ key, raw }) => Object.assign(node("div", raw), { dataset: { i18n: key } }));
  const rich = RICH.map(({ key, raw }) => Object.assign(node("p", raw), { dataset: { i18nHtml: key } }));

  const getMessage = (key, subs) => {
    const entry = messages && messages[key];
    if (!entry) return "";
    let msg = entry.message;
    for (const name of Object.keys(entry.placeholders || {})) {
      const idx = Number(String(entry.placeholders[name].content).replace("$", "")) - 1;
      msg = msg.replace(new RegExp(`\\$${name}\\$`, "gi"), (subs && subs[idx]) || "");
    }
    return msg;
  };

  let confirmText = null;
  const sandbox = {
    window: {}, console,
    document: {
      title: "PromptMeter — Opções",
      documentElement: { lang: "pt-br" },
      getElementById: el,
      createElement: (t) => node(t),
      createDocumentFragment: () => node("#fragment"),
      querySelectorAll: (sel) => (sel === "[data-i18n]" ? plain : sel === "[data-i18n-html]" ? rich : []),
    },
    confirm: (t) => { confirmText = t; return false; },
    setTimeout,
    chrome: {
      i18n: i18nOff ? undefined : { getMessage },
      runtime: { getManifest: () => ({ version: "0.4.0" }) },
      storage: { sync: { get: async () => ({}), set: async () => {} }, local: { remove: async () => {} } },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(EXT, "pricing.js"), "utf8"), sandbox, { filename: "pricing.js" });
  vm.runInContext(JS, sandbox, { filename: "options.js" });

  return {
    doc: sandbox.document,
    priceDate: sandbox.window.PM_PRICING.UPDATED,
    text: (key) => plain.find((n) => n.dataset.i18n === key).textContent,
    html: (key) => rich.find((n) => n.dataset.i18nHtml === key).textContent,
    askClearHistory: async () => { await byId.get("clearHistory").listeners.click(); return confirmText; },
    // load() é async (lê chrome.storage): cede a fila de microtasks antes de checar o DOM.
    settled: () => new Promise((r) => setTimeout(r, 0)),
  };
}

/* ── cobertura: nenhuma string visível fica cravada, nenhuma chave órfã ── */
test("todas as chaves usadas na página existem em pt_BR e en", () => {
  const used = [...PLAIN.map((m) => m.key), ...RICH.map((m) => m.key), ...JS_KEYS];
  assert.ok(used.length >= 28, `esperava ~28 chaves marcadas, achei ${used.length}`);
  for (const k of used) {
    assert.ok(PT[k], `chave '${k}' ausente em pt_BR`);
    assert.ok(EN[k], `chave '${k}' ausente em en`);
  }
});

test("nenhuma chave opt_* sobra sem uso na página", () => {
  const used = new Set([...PLAIN.map((m) => m.key), ...RICH.map((m) => m.key), ...JS_KEYS]);
  for (const k of Object.keys(PT)) {
    if (k.startsWith("opt_")) assert.ok(used.has(k), `chave órfã em _locales: '${k}'`);
  }
});

test("mensagens só usam as tags de ênfase que o renderizador entende", () => {
  for (const msgs of [PT, EN]) {
    for (const [k, v] of Object.entries(msgs)) {
      for (const [, tag] of v.message.matchAll(/<\/?([a-z]+)[^>]*>/gi)) {
        assert.ok(["strong", "em", "b"].includes(tag.toLowerCase()), `tag <${tag}> não suportada em '${k}'`);
      }
    }
  }
});

/* ── inglês: a página inteira vira EN ── */
test("com o locale en, título, lang, rótulos e o confirm destrutivo falam inglês", async () => {
  const r = render({ messages: EN });
  assert.equal(r.doc.title, "PromptMeter — Options");
  assert.equal(r.doc.documentElement.lang, "en");
  assert.equal(r.text("opt_save"), "Save");
  assert.equal(r.text("opt_clear_history_btn"), "Delete history");
  assert.equal(await r.askClearHistory(), EN.opt_confirm_clear_history.message);
});

test("parágrafos com ênfase são remontados em nós, com a data real de pricing.js", () => {
  const r = render({ messages: EN });
  const p = r.html("opt_how_it_works");
  assert.match(p, /^<strong>How it works:<\/strong>/);
  assert.ok(p.includes(`updated on ${r.priceDate}.`), `data não substituída: ${p}`);
  assert.ok(!p.includes("$DATE$") && !p.includes("<span"), "placeholder ou markup cru vazou");
  assert.match(r.html("opt_privacy"), /^<strong>Privacy:<\/strong>/);
});

/* ── português: copy idêntica à de antes da extração ── */
test("com o locale pt_BR, os textos renderizados são os de sempre", () => {
  const r = render({ messages: PT });
  assert.equal(r.doc.title, "PromptMeter — Opções");
  assert.equal(r.doc.documentElement.lang, "pt-br");
  assert.equal(r.text("opt_save"), "Salvar");
  assert.equal(r.text("opt_currency_both"), "USD + R$ (aprox.)");
  assert.ok(r.html("opt_reset_session_desc").includes("<strong>apenas de hoje</strong>"));
});

/* ── fallback: sem chrome.i18n a página continua em pt-BR, não em branco ── */
test("sem chrome.i18n, os textos cravados do HTML permanecem e a data ainda é preenchida", async () => {
  const r = render({ i18nOff: true });
  await r.settled();
  assert.equal(r.doc.title, "PromptMeter — Opções");
  assert.equal(r.text("opt_save"), "Salvar");
  assert.equal(r.doc.getElementById("priceDate").textContent, r.priceDate);
});

test("locale sem as chaves opt_* também cai no fallback em vez de esvaziar a tela", () => {
  const r = render({ messages: {} });
  assert.equal(r.text("opt_clear_overrides_btn"), "Limpar");
  assert.ok(r.html("opt_privacy").includes("<strong>Privacidade:</strong>"));
});
