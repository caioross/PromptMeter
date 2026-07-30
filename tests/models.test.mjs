// Testes de comportamento de models.js — detecção de modelo por site e resolução
// da precedência override > detectado > padrão. Sem DOM real: o texto "lido" do
// seletor é injetado via stub de document (ver _load.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadExtension } from './_load.mjs';

const W = loadExtension();
const M = W.PM_MODELS;

test('PM_MODELS está exposto com a API esperada', () => {
  assert.ok(M, 'window.PM_MODELS ausente');
  assert.ok(Array.isArray(M.SITES) && M.SITES.length >= 4, 'esperado >=4 sites');
  for (const fn of ['siteForHost', 'resolveModel', 'matchModelFromText']) {
    assert.equal(typeof M[fn], 'function', `PM_MODELS.${fn} não é função`);
  }
});

test('matchModelFromText: textos reais dos 4 sites casam com o id correto', () => {
  // Textos como aparecem no botão de troca de modelo de cada site.
  const casos = [
    ['GPT-4o', 'OpenAI', 'gpt-4o'],                       // ChatGPT
    ['GPT-5.5', 'OpenAI', 'gpt-5.5'],                     // ChatGPT
    ['Claude Opus 4.8', 'Anthropic', 'claude-opus-4.8'],  // Claude
    ['Claude Sonnet 4.6', 'Anthropic', 'claude-sonnet-4.6'], // Claude
    ['Claude Opus 5', 'Anthropic', 'claude-opus-5'],      // Claude (linha 5)
    ['Claude Sonnet 5', 'Anthropic', 'claude-sonnet-5'],  // Claude (linha 5)
    ['Claude Fable 5', 'Anthropic', 'claude-fable-5'],    // Claude (linha 5)
    ['Gemini 2.5 Pro', 'Google', 'gemini-2.5-pro'],       // Gemini
    ['3.5 Flash', 'Google', 'gemini-3.5-flash'],          // Gemini (só número + tier)
    ['GPT-4.1', 'OpenAI', 'gpt-4.1'],                     // GPT no Perplexity (provider explícito OpenAI)
  ];
  for (const [text, provider, id] of casos) {
    assert.equal(M.matchModelFromText(text, provider), id, `"${text}" (${provider})`);
  }
});

// ── Família Claude 5 (issue #47) ──
// O rótulo do seletor da claude.ai nem sempre traz a palavra "Claude"; nesse caso o
// casamento cai no fallback por versão + tier (models.js §2), que compara por substring.
test('matchModelFromText: rótulo curto da linha 5 casa pelo fallback de versão', () => {
  for (const [text, id] of [
    ['Opus 5', 'claude-opus-5'],
    ['Sonnet 5', 'claude-sonnet-5'],
    ['Fable 5', 'claude-fable-5'],
  ]) {
    assert.equal(M.matchModelFromText(text, 'Anthropic'), id, `"${text}"`);
  }
});

// Regressão que protege a ORDEM de declaração em pricing.js: "5" é substring de "4.5",
// então declarar Sonnet 5 antes de Sonnet 4.5 faria "Sonnet 4.5" resolver para Sonnet 5
// (mesmo tier) — trocar $3/$15 do 4.5 pelo preço de outro modelo é bug de dinheiro.
test('matchModelFromText: "Sonnet 4.5"/"Opus 4.8" não são engolidos pela linha 5', () => {
  assert.equal(M.matchModelFromText('Sonnet 4.5', 'Anthropic'), 'claude-sonnet-4.5');
  assert.equal(M.matchModelFromText('Opus 4.8', 'Anthropic'), 'claude-opus-4.8');
  assert.equal(M.matchModelFromText('Claude Sonnet 4.5', 'Anthropic'), 'claude-sonnet-4.5');
});

// ── Gemini 3.6 Flash / 3.5 Flash-Lite (issue #50) ──
// "Gemini 3.5 Flash-Lite" casava por prefixo em "Gemini 3.5 Flash" (5x o input, 3,6x o
// output). Ter o rótulo longo na tabela resolve pelo passo 1, que ordena por comprimento.
test('matchModelFromText: Gemini 3.6 Flash e 3.5 Flash-Lite casam no id próprio', () => {
  assert.equal(M.matchModelFromText('Gemini 3.6 Flash', 'Google'), 'gemini-3.6-flash');
  assert.equal(M.matchModelFromText('Gemini 3.5 Flash-Lite', 'Google'), 'gemini-3.5-flash-lite');
});

test('matchModelFromText: Gemini sem regressão nos rótulos já suportados', () => {
  for (const [text, id] of [
    ['Gemini 3.5 Flash', 'gemini-3.5-flash'],
    ['Gemini 3.1 Flash-Lite', 'gemini-3.1-flash-lite'],
    ['Gemini 2.5 Pro', 'gemini-2.5-pro'],
  ]) {
    assert.equal(M.matchModelFromText(text, 'Google'), id, `"${text}"`);
  }
});

// O padrão do site NÃO muda para 3.6: a release note oficial manda escolher o 3.6 Flash
// no menu de modelos, e nada confirma que ele virou o padrão do app. Sem detecção, errar
// para cima ($9.00) é preferível a subestimar ($7.50) num medidor de custo.
test('resolveModel Gemini: sem detecção → padrão segue gemini-3.5-flash', () => {
  const win = loadExtension({ documentText: null, hostname: 'gemini.google.com' });
  const r = win.PM_MODELS.resolveModel('gemini.google.com', {});
  assert.equal(r.source, 'default');
  assert.equal(r.modelId, 'gemini-3.5-flash');
});

test('matchModelFromText: qualquer casamento pertence ao provider pedido', () => {
  // O filtro de provider garante que nunca se casa um modelo de outro provedor.
  // (O fallback por número é frouxo — ex.: "4" em "Opus 4.8" pode casar GPT-4o —,
  //  mas o resultado, se houver, fica SEMPRE dentro do provider solicitado.)
  for (const [text, provider] of [
    ['Claude Opus 4.8', 'OpenAI'],
    ['GPT-4o', 'Anthropic'],
    ['Gemini 2.5 Pro', 'OpenAI'],
  ]) {
    const id = M.matchModelFromText(text, provider);
    if (id !== null) {
      assert.equal(W.PM_PRICING.getModel(id).provider, provider, `"${text}" casou fora do provider ${provider}`);
    }
  }
});

test('matchModelFromText: texto sem modelo conhecido → null', () => {
  assert.equal(M.matchModelFromText('algum texto sem nome de modelo', 'OpenAI'), null);
  assert.equal(M.matchModelFromText('', 'OpenAI'), null);
});

test('siteForHost: resolve os hosts dos 4 sites suportados', () => {
  assert.equal(M.siteForHost('chatgpt.com')?.name, 'ChatGPT');
  assert.equal(M.siteForHost('claude.ai')?.name, 'Claude');
  assert.equal(M.siteForHost('gemini.google.com')?.name, 'Gemini');
  assert.equal(M.siteForHost('www.perplexity.ai')?.name, 'Perplexity');
  assert.equal(M.siteForHost('exemplo-desconhecido.com'), null);
});

test('resolveModel: override do usuário vence detecção e padrão', () => {
  // Sandbox com detecção ATIVA ("Claude Sonnet 4.6"), mas override manda outro modelo.
  const win = loadExtension({ documentText: 'Claude Sonnet 4.6', hostname: 'claude.ai' });
  const r = win.PM_MODELS.resolveModel('claude.ai', { 'claude.ai': 'claude-opus-4.8' });
  assert.equal(r.source, 'user');
  assert.equal(r.modelId, 'claude-opus-4.8');
});

test('resolveModel: override inválido é ignorado (cai para detectado/padrão)', () => {
  const win = loadExtension({ documentText: null, hostname: 'claude.ai' });
  const r = win.PM_MODELS.resolveModel('claude.ai', { 'claude.ai': 'modelo-inexistente' });
  assert.equal(r.source, 'default');
  assert.equal(r.modelId, 'claude-sonnet-5'); // defaultModel do site Claude
});

test('resolveModel: detecção pelo DOM vence o padrão do site', () => {
  const win = loadExtension({ documentText: 'Claude Opus 4.7', hostname: 'claude.ai' });
  const r = win.PM_MODELS.resolveModel('claude.ai', {});
  assert.equal(r.source, 'detected');
  assert.equal(r.modelId, 'claude-opus-4.7');
});

test('resolveModel: sem override nem detecção → padrão do site', () => {
  const win = loadExtension({ documentText: null, hostname: 'claude.ai' });
  const r = win.PM_MODELS.resolveModel('claude.ai', {});
  assert.equal(r.source, 'default');
  assert.equal(r.modelId, 'claude-sonnet-5');
});

test('resolveModel: "Claude Opus 5" no seletor da claude.ai → detected', () => {
  const win = loadExtension({ documentText: 'Claude Opus 5', hostname: 'claude.ai' });
  const r = win.PM_MODELS.resolveModel('claude.ai', {});
  assert.equal(r.source, 'detected');
  assert.equal(r.modelId, 'claude-opus-5');
});

test('resolveModel: host não suportado → padrão genérico OpenAI, site null', () => {
  const win = loadExtension({ documentText: null, hostname: 'exemplo.com' });
  const r = win.PM_MODELS.resolveModel('exemplo.com', {});
  assert.equal(r.source, 'default');
  assert.equal(r.modelId, 'gpt-5.5');
  assert.equal(r.site, null);
});

// ── Perplexity: detecção cross-provider (issue #17) ──
// No Perplexity Pro o usuário escolhe o provedor da resposta (Sonar, GPT, Claude,
// Gemini, Grok). O site tem provider ABERTO (null) para não travar em OpenAI e
// precificar Claude/Gemini/Grok como GPT (fere a "Exatidão honesta", HANDBOOK §10).

test('Perplexity: provider é aberto (detecção considera todos os provedores)', () => {
  const site = M.siteForHost('perplexity.ai');
  assert.ok(site, 'site Perplexity deve ser resolvido');
  assert.ok(!site.provider, 'Perplexity precisa de provider falsy p/ casar modelos de qualquer família');
});

test('resolveModel Perplexity: "Claude Sonnet 4.6" → claude-sonnet-4.6 (detected)', () => {
  const win = loadExtension({ documentText: 'Claude Sonnet 4.6', hostname: 'www.perplexity.ai' });
  const r = win.PM_MODELS.resolveModel('www.perplexity.ai', {});
  assert.equal(r.source, 'detected');
  assert.equal(r.modelId, 'claude-sonnet-4.6');
});

test('resolveModel Perplexity: "Gemini 3.1 Pro" → gemini-3.1-pro', () => {
  const win = loadExtension({ documentText: 'Gemini 3.1 Pro', hostname: 'www.perplexity.ai' });
  const r = win.PM_MODELS.resolveModel('www.perplexity.ai', {});
  assert.equal(r.source, 'detected');
  assert.equal(r.modelId, 'gemini-3.1-pro');
});

test('resolveModel Perplexity: "Grok 4" → grok-4', () => {
  const win = loadExtension({ documentText: 'Grok 4', hostname: 'www.perplexity.ai' });
  const r = win.PM_MODELS.resolveModel('www.perplexity.ai', {});
  assert.equal(r.source, 'detected');
  assert.equal(r.modelId, 'grok-4');
});

test('resolveModel Perplexity: "GPT-4.1" continua gpt-4.1', () => {
  const win = loadExtension({ documentText: 'GPT-4.1', hostname: 'www.perplexity.ai' });
  const r = win.PM_MODELS.resolveModel('www.perplexity.ai', {});
  assert.equal(r.source, 'detected');
  assert.equal(r.modelId, 'gpt-4.1');
});

// #34: o caso mais comum (Free/Best) NÃO expõe o modelo na UI → readSelectorText volta
// vazio (aqui, documentText null). O padrão precisa ser Sonar (o que a Perplexity de fato
// serve), nunca GPT-4.1 — senão o overlay fabrica o preço de um modelo OpenAI que não
// respondeu (fere a "Exatidão honesta", HANDBOOK §10).
test('resolveModel Perplexity: sem detecção → padrão Sonar (não gpt-4.1)', () => {
  const win = loadExtension({ documentText: null, hostname: 'www.perplexity.ai' });
  const r = win.PM_MODELS.resolveModel('www.perplexity.ai', {});
  assert.equal(r.source, 'default');
  assert.equal(r.modelId, 'sonar');
  assert.notEqual(r.modelId, 'gpt-4.1');
});

// Perplexity Pro, quando expõe a variante Sonar escolhida, deve casá-la (não cair no default).
test('resolveModel Perplexity: "Sonar" → sonar · "Sonar Pro" → sonar-pro (detected)', () => {
  const w1 = loadExtension({ documentText: 'Sonar', hostname: 'www.perplexity.ai' });
  const r1 = w1.PM_MODELS.resolveModel('www.perplexity.ai', {});
  assert.equal(r1.source, 'detected');
  assert.equal(r1.modelId, 'sonar');

  const w2 = loadExtension({ documentText: 'Sonar Pro', hostname: 'www.perplexity.ai' });
  const r2 = w2.PM_MODELS.resolveModel('www.perplexity.ai', {});
  assert.equal(r2.source, 'detected');
  assert.equal(r2.modelId, 'sonar-pro');
});

test('resolveModel ChatGPT: filtro OpenAI intacto — texto Claude nunca resolve fora do provider', () => {
  // Regressão do provider fixo: mudar só o Perplexity não pode fazer um site de provider
  // fixo (ChatGPT) casar modelo de outra família. O que ele resolver é SEMPRE OpenAI.
  // (O fallback por número em models.js é frouxo e pode "detectar" um GPT genérico aqui —
  //  o essencial é que jamais vire claude-sonnet-4.6.)
  const win = loadExtension({ documentText: 'Claude Sonnet 4.6', hostname: 'chatgpt.com' });
  const r = win.PM_MODELS.resolveModel('chatgpt.com', {});
  assert.equal(win.PM_PRICING.getModel(r.modelId).provider, 'OpenAI');
  assert.notEqual(r.modelId, 'claude-sonnet-4.6');
});
