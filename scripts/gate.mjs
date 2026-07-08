#!/usr/bin/env node
/**
 * Gate da frota PromptMeter — validação obrigatória antes de PR e de merge.
 * Zero dependências. Uso: node scripts/gate.mjs
 * Sai com código 0 (verde) ou 1 (vermelho). Ver docs/fleet/HANDBOOK.md §6.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'PromptMeter_MVP_Sprint1');
const results = [];
const ok = (msg) => results.push({ pass: true, msg });
const fail = (msg) => results.push({ pass: false, msg });

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean);

/* ── 1. Manifest MV3 ── */
let manifest = null;
try {
  manifest = JSON.parse(readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  ok('manifest.json: JSON válido');
  manifest.manifest_version === 3 ? ok('manifest_version = 3') : fail(`manifest_version = ${manifest.manifest_version} (esperado 3)`);
  const perms = manifest.permissions || [];
  (perms.length === 1 && perms[0] === 'storage')
    ? ok("permissões = ['storage'] (área sagrada intacta)")
    : fail(`permissões = ${JSON.stringify(perms)} — qualquer permissão além de 'storage' é núcleo §7.1 (decisao-dono)`);
  !manifest.host_permissions ? ok('sem host_permissions') : fail('host_permissions presente — núcleo §7.1 (decisao-dono)');
  !manifest.content_security_policy ? ok('sem CSP custom') : fail('CSP custom no manifest — núcleo §7.1 (decisao-dono)');
  /^\d+\.\d+(\.\d+)?$/.test(manifest.version || '') ? ok(`versão ${manifest.version}`) : fail(`versão inválida: '${manifest.version}'`);
  manifest.default_locale ? ok(`default_locale = ${manifest.default_locale}`) : fail('default_locale ausente');

  const refs = [];
  for (const v of Object.values(manifest.icons || {})) refs.push(v);
  for (const v of Object.values(manifest.action?.default_icon || {})) refs.push(v);
  if (manifest.background?.service_worker) refs.push(manifest.background.service_worker);
  if (manifest.options_page) refs.push(manifest.options_page);
  for (const cs of manifest.content_scripts || []) {
    refs.push(...(cs.js || []), ...(cs.css || []));
    for (const m of cs.matches || []) {
      /^https:\/\//.test(m) ? null : fail(`content_scripts.matches não-https: ${m}`);
    }
  }
  let missing = 0;
  for (const r of refs) if (!existsSync(path.join(EXT, r))) { fail(`manifest referencia arquivo inexistente: ${r}`); missing++; }
  if (!missing) ok(`todos os ${refs.length} arquivos referenciados no manifest existem`);
} catch (e) {
  fail(`manifest.json ilegível/inválido: ${e.message}`);
}

/* ── 2. Sintaxe de todos os .js rastreados ── */
for (const f of tracked.filter((f) => f.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' });
    ok(`sintaxe válida: ${f}`);
  } catch (e) {
    fail(`ERRO DE SINTAXE em ${f}:\n${String(e.stderr).slice(0, 400)}`);
  }
}

/* ── 3. Invariante 100% LOCAL — nenhuma API de rede na extensão ── */
// tokenizer.js é blob gerado (dados de vocabulário) — checado à parte só por rede explícita.
const NET_PATTERNS = [
  [/\bfetch\s*\(/, 'fetch('],
  [/\bnew\s+XMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bnew\s+WebSocket\b/, 'WebSocket'],
  [/\bnew\s+EventSource\b/, 'EventSource'],
  [/\bsendBeacon\s*\(/, 'navigator.sendBeacon'],
  [/\bimportScripts\s*\(/, 'importScripts'],
];
for (const f of tracked.filter((f) => f.startsWith('PromptMeter_MVP_Sprint1/') && /\.(js|html)$/.test(f))) {
  const txt = readFileSync(path.join(ROOT, f), 'utf8');
  let hit = false;
  for (const [re, what] of NET_PATTERNS) {
    if (re.test(txt)) { fail(`REDE na extensão (${what}) em ${f} — o produto é 100% local; rede é núcleo §7.1`); hit = true; }
  }
  if (!hit) ok(`sem rede: ${f}`);
}

/* ── 4. Segredos em arquivos rastreados (repo é PÚBLICO) ── */
const SECRET_PATTERNS = [
  [/\bsk-proj-[A-Za-z0-9_-]{30,}\b/, 'chave OpenAI (sk-proj-...)'],
  [/\bsk-ant-[A-Za-z0-9_-]{30,}\b/, 'chave Anthropic (sk-ant-...)'],
  [/\bsk_live_[A-Za-z0-9]{20,}\b/, 'chave Stripe live'],
  [/\bGOCSPX-[A-Za-z0-9_-]{10,}\b/, 'Google OAuth client secret'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'token GitHub'],
];
const SKIP_SECRET = new Set(['PromptMeter_MVP_Sprint1/tokenizer.js']); // vocabulário gerado: strings arbitrárias
const BIN = /\.(png|jpe?g|gif|ico|zip|woff2?)$/i;
{
  let leaks = 0;
  for (const f of tracked.filter((f) => !BIN.test(f) && !SKIP_SECRET.has(f))) {
    let txt; try { txt = readFileSync(path.join(ROOT, f), 'utf8'); } catch { continue; }
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(txt)) { fail(`SEGREDO em '${f}': ${label} — NUNCA commitar`); leaks++; }
    }
  }
  if (!leaks) ok('nenhum segredo em arquivos rastreados');
}

/* ── 5. i18n: pt_BR e en com o mesmo conjunto de chaves ── */
try {
  const pt = JSON.parse(readFileSync(path.join(EXT, '_locales/pt_BR/messages.json'), 'utf8'));
  const en = JSON.parse(readFileSync(path.join(EXT, '_locales/en/messages.json'), 'utf8'));
  const kp = Object.keys(pt).sort(), ke = Object.keys(en).sort();
  const onlyPt = kp.filter((k) => !ke.includes(k)), onlyEn = ke.filter((k) => !kp.includes(k));
  (!onlyPt.length && !onlyEn.length)
    ? ok(`i18n: ${kp.length} chaves idênticas em pt_BR e en`)
    : fail(`i18n divergente — só em pt_BR: [${onlyPt}] · só em en: [${onlyEn}]`);
  for (const [loc, obj] of [['pt_BR', pt], ['en', en]]) {
    for (const [k, v] of Object.entries(obj)) if (!v || typeof v.message !== 'string') fail(`i18n ${loc}: chave '${k}' sem 'message'`);
  }
} catch (e) {
  fail(`_locales ilegível/inválido: ${e.message}`);
}

/* ── 6. Produto carregado de verdade (sandbox): tokenizer + pricing + models ── */
try {
  const sandbox = {
    window: {},
    location: { hostname: '' },
    console,
    TextEncoder, TextDecoder,
    atob: globalThis.atob, btoa: globalThis.btoa,
  };
  sandbox.window.location = sandbox.location;
  vm.createContext(sandbox);
  for (const f of ['tokenizer.js', 'pricing.js', 'models.js']) {
    vm.runInContext(readFileSync(path.join(EXT, f), 'utf8'), sandbox, { filename: f });
  }
  const W = sandbox.window;

  // tokenizer
  if (!W.PMTokenizer || typeof W.PMTokenizer.count !== 'function') {
    fail('PMTokenizer não exposto por tokenizer.js');
  } else {
    const n = W.PMTokenizer.count('Olá! Quanto custa este prompt em tokens?');
    (Number.isInteger(n) && n >= 5 && n <= 40) ? ok(`tokenizer conta de verdade (${n} tokens na frase de teste)`) : fail(`tokenizer retornou valor implausível: ${n}`);
  }

  // pricing
  const P = W.PM_PRICING;
  if (!P || typeof P.listModels !== 'function' || typeof P.cost !== 'function') {
    fail('PM_PRICING não exposto por pricing.js');
  } else {
    const models = P.listModels();
    models.length >= 20 ? ok(`tabela com ${models.length} modelos`) : fail(`tabela com só ${models.length} modelos (esperado >=20) — remoção em massa é quórum/núcleo`);
    const ids = new Set();
    const fams = Object.keys(P.FAMILY || {});
    for (const m of models) {
      if (ids.has(m.id)) fail(`id duplicado na tabela: '${m.id}'`);
      ids.add(m.id);
      if (!m.label || !m.provider) fail(`modelo '${m.id}' sem label/provider`);
      if (!fams.includes(m.family)) fail(`modelo '${m.id}' com família desconhecida '${m.family}'`);
      if (!(Number.isFinite(m.in) && m.in > 0 && Number.isFinite(m.out) && m.out > 0)) fail(`modelo '${m.id}' com preço inválido (in=${m.in}, out=${m.out})`);
      if (m.out < m.in) fail(`modelo '${m.id}': out (${m.out}) < in (${m.in}) — quase certamente troca de colunas`);
    }
    if (models.every((m) => ids.has(m.id))) ok('ids únicos, preços positivos, famílias válidas');
    const gpt4o = P.getModel('gpt-4o');
    if (gpt4o) {
      const c = P.cost('gpt-4o', 1e6, 1e6);
      Math.abs(c.totalUSD - (gpt4o.in + gpt4o.out)) < 1e-9
        ? ok(`matemática do custo exata (1M in + 1M out de gpt-4o = $${c.totalUSD})`)
        : fail(`custo errado: 1M+1M de gpt-4o deu ${c.totalUSD}, esperado ${gpt4o.in + gpt4o.out}`);
    }
    const est = P.countTokens('um texto qualquer para estimar', 'claude-sonnet-4.6');
    if (est && est.exact === false && est.tokens >= 1) ok('estimativa por tokFactor funciona e se declara inexata');
    else fail(`countTokens para família não-OpenAI inconsistente: ${JSON.stringify(est)}`);
  }

  // models
  const M = W.PM_MODELS;
  if (!M || !Array.isArray(M.SITES)) {
    fail('PM_MODELS não exposto por models.js');
  } else {
    M.SITES.length >= 4 ? ok(`${M.SITES.length} sites suportados`) : fail(`só ${M.SITES.length} sites (esperado >=4) — remover site é núcleo §7.1`);
    for (const s of M.SITES) {
      // instanceof RegExp falharia cross-realm (a regex nasce dentro do sandbox VM)
      if (typeof s.match?.test !== 'function') fail(`site '${s.name}': match não é RegExp`);
      if (!Array.isArray(s.detectSelectors) || !s.detectSelectors.length) fail(`site '${s.name}': detectSelectors vazio`);
      if (!Array.isArray(s.responseSelectors) || !s.responseSelectors.length) fail(`site '${s.name}': responseSelectors vazio`);
      if (!W.PM_PRICING?.getModel(s.defaultModel)) fail(`site '${s.name}': defaultModel '${s.defaultModel}' NÃO existe na tabela de preços`);
    }
    if (M.siteForHost('claude.ai')?.name === 'Claude' && M.siteForHost('chatgpt.com')?.name === 'ChatGPT') ok('siteForHost resolve claude.ai e chatgpt.com');
    else fail('siteForHost não resolveu hosts básicos');
  }
} catch (e) {
  fail(`sandbox tokenizer/pricing/models falhou: ${e.message}`);
}

/* ── Relatório ── */
const failed = results.filter((r) => !r.pass);
console.log('\n=== GATE PromptMeter ===');
for (const r of results) console.log(`  [${r.pass ? 'OK' : 'FALHOU'}] ${r.msg}`);
console.log(`\n${failed.length === 0 ? 'GATE VERDE' : 'GATE VERMELHO'} — ${results.length - failed.length}/${results.length} checagens passaram.`);
if (failed.length > 0) {
  console.log('Corrija as falhas DENTRO do escopo da issue, ou abra a PR como DRAFT explicando (HANDBOOK §6).');
  process.exit(1);
}
