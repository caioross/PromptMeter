// Testes de comportamento de pricing.js — o produto é uma calculadora de dinheiro,
// então a matemática do custo e a contagem (exata vs tokFactor) precisam ser exatas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadExtension } from './_load.mjs';

const W = loadExtension();
const P = W.PM_PRICING;

test('PM_PRICING está exposto com a API esperada', () => {
  assert.ok(P, 'window.PM_PRICING ausente');
  for (const fn of ['getModel', 'listModels', 'countTokens', 'cost']) {
    assert.equal(typeof P[fn], 'function', `PM_PRICING.${fn} não é função`);
  }
});

test('cost: matemática exata para 1M in + 1M out (gpt-4o)', () => {
  const m = P.getModel('gpt-4o');
  const c = P.cost('gpt-4o', 1e6, 1e6);
  assert.equal(c.inUSD, m.in);   // 2.50
  assert.equal(c.outUSD, m.out); // 10.00
  assert.equal(c.totalUSD, m.in + m.out); // 12.50
});

test('cost: proporcional a tokens parciais (claude-opus-4.8)', () => {
  // 500k in × $5/1M = $2.50 ; 250k out × $25/1M = $6.25 ; total $8.75
  const c = P.cost('claude-opus-4.8', 500_000, 250_000);
  assert.ok(Math.abs(c.inUSD - 2.5) < 1e-9, `inUSD=${c.inUSD}`);
  assert.ok(Math.abs(c.outUSD - 6.25) < 1e-9, `outUSD=${c.outUSD}`);
  assert.ok(Math.abs(c.totalUSD - 8.75) < 1e-9, `totalUSD=${c.totalUSD}`);
});

test('cost: valores pequenos não perdem precisão (gpt-5-nano)', () => {
  // 1000 in × $0.05/1M = $0.00005 ; 2000 out × $0.40/1M = $0.0008
  const c = P.cost('gpt-5-nano', 1000, 2000);
  assert.ok(Math.abs(c.inUSD - 0.00005) < 1e-12, `inUSD=${c.inUSD}`);
  assert.ok(Math.abs(c.outUSD - 0.0008) < 1e-12, `outUSD=${c.outUSD}`);
  assert.ok(Math.abs(c.totalUSD - 0.00085) < 1e-12, `totalUSD=${c.totalUSD}`);
});

test('cost: zero tokens → custo zero', () => {
  // Objeto nasce dentro do sandbox vm (outro realm): comparar campo a campo, não deepEqual.
  const c = P.cost('gpt-4o', 0, 0);
  assert.equal(c.inUSD, 0);
  assert.equal(c.outUSD, 0);
  assert.equal(c.totalUSD, 0);
});

test('cost: modelo desconhecido → tudo zero (nunca cobra por engano)', () => {
  const c = P.cost('modelo-que-nao-existe', 1e6, 1e6);
  assert.equal(c.inUSD, 0);
  assert.equal(c.outUSD, 0);
  assert.equal(c.totalUSD, 0);
});

test('countTokens: família OpenAI é EXATA (== contagem o200k)', () => {
  const text = 'Quanto custa este prompt? Vamos contar com precisão os tokens.';
  const base = W.PMTokenizer.count(text);
  const r = P.countTokens(text, 'gpt-4o');
  assert.equal(r.exact, true);
  assert.equal(r.tokens, base, 'família openai deveria contar sem fator');
});

test('countTokens: famílias não-OpenAI aplicam tokFactor e se declaram inexatas', () => {
  const text = 'Um texto qualquer para comparar a estimativa por família de modelo.';
  const base = W.PMTokenizer.count(text);
  const casos = [
    ['claude-sonnet-4.6', 1.15], // anthropic
    ['gemini-2.5-pro', 1.05],    // google
    ['grok-4', 1.10],            // xai
    ['deepseek-v3', 1.10],       // deepseek
  ];
  for (const [id, factor] of casos) {
    const r = P.countTokens(text, id);
    assert.equal(r.exact, false, `${id} deveria ser inexato`);
    assert.equal(r.tokens, Math.round(base * factor), `${id}: tokFactor ${factor} incorreto`);
  }
});

test('countTokens: tokFactor da família Anthropic > OpenAI (mais tokens)', () => {
  const text = 'Comparando o número de tokens entre famílias diferentes de modelos.';
  const openai = P.countTokens(text, 'gpt-4o').tokens;
  const anthropic = P.countTokens(text, 'claude-sonnet-4.6').tokens;
  assert.ok(anthropic >= openai, `anthropic=${anthropic} deveria ser >= openai=${openai}`);
});
