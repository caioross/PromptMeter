/**
 * Testes da função pura sessionFooterState — derivação do rodapé "sessão" do card (issue #63).
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
const { sessionFooterState } = require(
  path.join(HERE, "..", "PromptMeter_MVP_Sprint1", "content.js")
);

const HOJE = "2026-08-01";
const sess = (date, inUSD, outUSD, msgs) => ({ date, inUSD, outUSD, msgs });

test("sessão de hoje: total é inUSD + outUSD e o rodapé exibe", () => {
  const s = sessionFooterState(sess(HOJE, 2.5, 0.9, 7), HOJE, true);
  assert.equal(s.total, 3.4);
  assert.equal(s.show, true);
  assert.equal(s.off, false);
});

test("sessão de ONTEM não vaza para hoje: total 0 (dia novo começa zerado)", () => {
  const s = sessionFooterState(sess("2026-07-31", 2.5, 0.9, 7), HOJE, true);
  assert.equal(s.total, 0);
  assert.equal(s.show, true); // com rastreamento ligado, $0 é verdade num dia sem gasto
});

test("sem sessão gravada: total 0 e exibe (rastreamento ligado)", () => {
  assert.deepEqual(sessionFooterState(null, HOJE, true), { total: 0, off: false, show: true });
  assert.deepEqual(sessionFooterState(undefined, HOJE, true), { total: 0, off: false, show: true });
});

test("trackResponses OFF com nada acumulado hoje: NÃO afirma $0 (show=false)", () => {
  const s = sessionFooterState(sess(HOJE, 0, 0, 0), HOJE, false);
  assert.equal(s.total, 0);
  assert.equal(s.off, true);
  assert.equal(s.show, false);
});

test("trackResponses OFF com total acumulado hoje: exibe o valor real, marcado como parado", () => {
  const s = sessionFooterState(sess(HOJE, 2.5, 0.9, 7), HOJE, false);
  assert.equal(s.total, 3.4);
  assert.equal(s.off, true);
  assert.equal(s.show, true);
});

test("trackResponses OFF e sessão de ontem: total 0 e não afirma $0", () => {
  const s = sessionFooterState(sess("2026-07-31", 9, 9, 9), HOJE, false);
  assert.equal(s.total, 0);
  assert.equal(s.show, false);
});

test("campos ausentes/estranhos são coagidos a 0 (nunca NaN no card)", () => {
  assert.equal(sessionFooterState({ date: HOJE, msgs: 2 }, HOJE, true).total, 0);
  assert.equal(sessionFooterState({ date: HOJE, inUSD: "1.5", outUSD: null }, HOJE, true).total, 1.5);
  assert.equal(sessionFooterState({ date: HOJE, inUSD: "abc", outUSD: 0.5 }, HOJE, true).total, 0.5);
});

test("dayKey ausente não inventa total", () => {
  const s = sessionFooterState(sess(HOJE, 2.5, 0.9, 7), null, true);
  assert.equal(s.total, 0);
});

test("trackResponses indefinido (settings ainda carregando) trata como ligado", () => {
  const s = sessionFooterState(sess(HOJE, 1, 1, 2), HOJE, undefined);
  assert.equal(s.off, false);
  assert.equal(s.show, true);
  assert.equal(s.total, 2);
});

test("é pura: não muta a sessão recebida", () => {
  const s = sess(HOJE, 2.5, 0.9, 7);
  sessionFooterState(s, HOJE, true);
  assert.deepEqual(s, { date: HOJE, inUSD: 2.5, outUSD: 0.9, msgs: 7 });
});
