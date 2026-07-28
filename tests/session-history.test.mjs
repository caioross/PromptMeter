/**
 * Testes da função pura rollSessionIntoHistory (base do histórico diário — issue #31).
 * Zero dependências. Uso: node --test tests/*.test.mjs (ou via node scripts/gate.mjs)
 *
 * Importa content.js como CommonJS. O arquivo é um content script (IIFE) com guardas
 * inertes (`typeof chrome`/`document`) que impedem seus efeitos colaterais de rodar em Node,
 * expondo a função pura via `module.exports`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { rollSessionIntoHistory } = require(
  path.join(HERE, "..", "PromptMeter_MVP_Sprint1", "content.js")
);

const sess = (date, inUSD, outUSD, msgs) => ({ date, inUSD, outUSD, msgs });

test("consolida sessão não-vazia do dia anterior no histórico", () => {
  const h = rollSessionIntoHistory(sess("2026-07-17", 0.12, 0.34, 3), {}, 90);
  assert.deepEqual(h["2026-07-17"], { inUSD: 0.12, outUSD: 0.34, msgs: 3 });
});

test("sessão vazia (msgs === 0) NÃO cria entrada", () => {
  const h = rollSessionIntoHistory(sess("2026-07-17", 0, 0, 0), {}, 90);
  assert.deepEqual(h, {});
});

test("não muta o histórico recebido (função pura)", () => {
  const prev = { "2026-07-15": { inUSD: 1, outUSD: 2, msgs: 1 } };
  const h = rollSessionIntoHistory(sess("2026-07-17", 0.5, 0.5, 2), prev, 90);
  assert.deepEqual(prev, { "2026-07-15": { inUSD: 1, outUSD: 2, msgs: 1 } }); // intacto
  assert.equal(Object.keys(h).length, 2);
  assert.ok(h["2026-07-17"]);
});

test("preserva entradas anteriores ao adicionar a nova", () => {
  const prev = {
    "2026-07-15": { inUSD: 1, outUSD: 1, msgs: 1 },
    "2026-07-16": { inUSD: 2, outUSD: 2, msgs: 2 }
  };
  const h = rollSessionIntoHistory(sess("2026-07-17", 3, 3, 3), prev, 90);
  assert.deepEqual(Object.keys(h).sort(), ["2026-07-15", "2026-07-16", "2026-07-17"]);
});

test("poda mantém no máximo N datas, descartando as mais antigas", () => {
  const prev = {};
  for (let d = 1; d <= 5; d++) prev[`2026-07-0${d}`] = { inUSD: d, outUSD: d, msgs: 1 };
  // 5 antigas + 1 nova = 6; cap = 3 → sobram as 3 mais recentes
  const h = rollSessionIntoHistory(sess("2026-07-06", 9, 9, 1), prev, 3);
  assert.deepEqual(Object.keys(h).sort(), ["2026-07-04", "2026-07-05", "2026-07-06"]);
});

test("N inválido cai no padrão HISTORY_MAX_DAYS (90) — sem poda para poucos dias", () => {
  const prev = {};
  for (let d = 1; d <= 10; d++) prev[`2026-06-${String(d).padStart(2, "0")}`] = { inUSD: 1, outUSD: 1, msgs: 1 };
  const h = rollSessionIntoHistory(sess("2026-07-01", 1, 1, 1), prev, 0); // 0 → padrão 90
  assert.equal(Object.keys(h).length, 11); // 10 + 1, nada podado
});

test("é idempotente: reconsolidar a mesma sessão sobrescreve (sem dobrar)", () => {
  const s = sess("2026-07-17", 0.2, 0.3, 4);
  const h1 = rollSessionIntoHistory(s, {}, 90);
  const h2 = rollSessionIntoHistory(s, h1, 90);
  assert.deepEqual(h2, { "2026-07-17": { inUSD: 0.2, outUSD: 0.3, msgs: 4 } });
});

test("coage campos numéricos ausentes/estranhos a 0", () => {
  const h = rollSessionIntoHistory({ date: "2026-07-17", msgs: 2 }, {}, 90); // sem inUSD/outUSD
  assert.deepEqual(h["2026-07-17"], { inUSD: 0, outUSD: 0, msgs: 2 });
});

test("history nulo/ausente é tratado como vazio", () => {
  const h = rollSessionIntoHistory(sess("2026-07-17", 1, 1, 1), null, 90);
  assert.deepEqual(h, { "2026-07-17": { inUSD: 1, outUSD: 1, msgs: 1 } });
});
