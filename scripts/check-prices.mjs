#!/usr/bin/env node
/**
 * scripts/check-prices.mjs — Vigilância de preços do PromptMeter.
 *
 * Ferramenta de DESENVOLVIMENTO. NÃO faz parte da extensão: a extensão é 100% local
 * (HANDBOOK §2/§7.1); tooling em scripts/ pode usar rede. Este script baixa as páginas
 * OFICIAIS de preços, tenta extrair valores e imprime uma tabela de DIVERGÊNCIAS vs.
 * PromptMeter_MVP_Sprint1/pricing.js.
 *
 * Best-effort e HONESTO: falha de rede ou de parse NUNCA é fatal. As páginas de preços
 * são SPAs pesadas em JS — um fetch simples muitas vezes não traz os números. O objetivo
 * é dar ao Curador uma PISTA de "algo mudou, vá conferir na fonte", não um número
 * autoritativo. A decisão de mudar preço continua sendo humana, com URL da fonte no PR
 * e PRICING_UPDATED atualizado (HANDBOOK §10).
 *
 * Uso:
 *   node scripts/check-prices.mjs                 # tabela legível
 *   node scripts/check-prices.mjs --json          # saída JSON (máquina)
 *   node scripts/check-prices.mjs --timeout=20000 # timeout por requisição (ms)
 *
 * Código de saída: SEMPRE 0. Divergência não é erro de processo — é sinal para humano.
 * Ver docs/fleet/HANDBOOK.md §10.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRICING = path.join(ROOT, 'PromptMeter_MVP_Sprint1', 'pricing.js');

/* ── Argumentos ── */
const argv = process.argv.slice(2);
const asJSON = argv.includes('--json');
const timeoutArg = argv.find((a) => a.startsWith('--timeout='));
const TIMEOUT_MS = Math.max(1000, Number(timeoutArg?.split('=')[1]) || 15000);

/* ── Fontes oficiais de preços (uma por provedor) ──
 * Provedor SEM fonte aqui (xAI, DeepSeek) fica marcado como não-verificável: os modelos
 * desses provedores já carregam est:true na tabela — conferência é manual na rodada. */
const SOURCES = {
  OpenAI:    'https://openai.com/api/pricing/',
  Anthropic: 'https://www.anthropic.com/pricing',
  Google:    'https://ai.google.dev/gemini-api/docs/pricing',
};

/* ── 1. Carrega a tabela de pricing.js num sandbox (mesmo padrão do gate) ── */
function loadPricingTable() {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(PRICING, 'utf8'), sandbox, { filename: 'pricing.js' });
  const P = sandbox.window.PM_PRICING;
  if (!P || typeof P.listModels !== 'function') {
    throw new Error('PM_PRICING não exposto por pricing.js — abortando.');
  }
  return { updated: P.UPDATED, models: P.listModels() };
}

/* ── 2. Baixa uma URL (best-effort) ── */
async function fetchText(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        // UA de navegador: várias páginas de preço recusam clientes "vazios".
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/126.0 Safari/537.36 PromptMeter-price-watch',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, text: await res.text() };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/* ── 3. HTML → texto pesquisável ── */
function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0*36;|&dollar;/gi, '$')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── 4. Extrai valores em dólar numa janela ao redor do rótulo do modelo ── */
const NUM_RE = /\$\s?(\d+(?:\.\d+)?)/g;

/* Fronteira de token: "gpt-5" NÃO pode casar dentro de "gpt-5.5"/"gpt-5-mini".
 * O caractere que segue o rótulo não pode continuar o identificador do modelo. */
function isTokenBoundary(ch) {
  return ch === undefined || !/[\w.\-]/.test(ch);
}

/* Para cada ocorrência do rótulo (respeitando fronteira), devolve os números $
 * da janela SEGUINTE — SEPARADOS por ocorrência. Manter as janelas separadas é o
 * que permite exigir in E out no MESMO local da página (ver evaluate), sem misturar
 * preços de modelos vizinhos. */
function windowsNear(text, needle, radius = 160) {
  const hay = text.toLowerCase();
  const key = needle.toLowerCase();
  const wins = [];
  let from = 0;
  let idx;
  while ((idx = hay.indexOf(key, from)) !== -1) {
    from = idx + key.length;
    if (!isTokenBoundary(hay[idx + key.length])) continue; // prefixo de token maior → ignora
    const window = text.slice(idx, idx + key.length + radius);
    const nums = [...window.matchAll(NUM_RE)].map((m) => Number(m[1]));
    if (nums.length) wins.push(nums);
    if (wins.length >= 8) break; // não vale a pena varrer a página inteira
  }
  return wins;
}

/* Termos de busca por modelo: o rótulo e algumas variantes comuns de escrita. */
function searchTerms(model) {
  const t = new Set([model.label]);
  t.add(model.label.replace(/\s+/g, ' '));
  t.add(model.label.replace(/-/g, ' '));
  t.add(model.label.replace(/\s+/g, '-'));
  return [...t].filter((s) => s.length >= 3);
}

/* ── 5. Avalia um modelo contra o texto da fonte ──
 * Distingue "sem fonte configurada" (xAI/DeepSeek, est:true) de "fonte configurada mas
 * falhou" (ex.: OpenAI HTTP 403) — conflar os dois seria desonesto num produto de exatidão. */
function evaluate(model, src) {
  if (!src || !src.url) return { status: 'sem-fonte', found: [] };
  if (!src.text) return { status: 'fonte-falhou', found: [] };

  let wins = [];
  for (const term of searchTerms(model)) {
    const w = windowsNear(src.text, term);
    if (w.length) { wins = w; break; }
  }
  if (!wins.length) return { status: 'nao-encontrado', found: [] };

  const eq = (a, b) => Math.abs(a - b) < 1e-9;
  const flat = [...new Set(wins.flat())]; // só para exibição da pista
  // 'confere' EXIGE in E out na MESMA janela (mesmo ponto da página). Dois some()
  // independentes sobre o saco inteiro casariam números de modelos vizinhos e
  // esconderiam uma divergência real — inadmissível num produto de dinheiro.
  const paired = wins.some(
    (nums) => nums.some((v) => eq(v, model.in)) && nums.some((v) => eq(v, model.out))
  );
  if (paired) return { status: 'confere', found: flat };
  return { status: 'diverge', found: flat };
}

/* ── 6. Orquestra ── */
async function main() {
  let table;
  try {
    table = loadPricingTable();
  } catch (e) {
    console.error(`ERRO ao ler pricing.js: ${e.message}`);
    process.exit(0);
  }

  const providers = [...new Set(table.models.map((m) => m.provider))];

  // Baixa as fontes configuradas em paralelo.
  const fetched = {};
  await Promise.all(
    providers.map(async (prov) => {
      const url = SOURCES[prov];
      if (!url) { fetched[prov] = { url: null, text: null, error: 'sem fonte configurada' }; return; }
      const r = await fetchText(url);
      fetched[prov] = r.ok
        ? { url, text: htmlToText(r.text), error: null }
        : { url, text: null, error: r.error };
    })
  );

  const rows = [];
  for (const m of table.models) {
    const src = fetched[m.provider] || { url: null, text: null };
    const ev = evaluate(m, src);
    rows.push({
      id: m.id,
      label: m.label,
      provider: m.provider,
      table: { in: m.in, out: m.out },
      est: !!m.est,
      source: src.url,
      sourceError: src.error || null,
      status: ev.status,
      valoresEncontrados: ev.found,
    });
  }

  if (asJSON) {
    console.log(JSON.stringify({ pricingUpdated: table.updated, rows }, null, 2));
    return;
  }

  /* Saída legível */
  const ICON = {
    confere: '~= ',
    diverge: '!! ',
    'nao-encontrado': '?  ',
    'fonte-falhou': 'x  ',
    'sem-fonte': '-  ',
  };
  const LEGENDA = {
    confere: 'in E out achados JUNTOS na mesma parte da fonte — pista, não veredito: confira mesmo assim',
    diverge: 'rótulo achado na fonte mas in/out NÃO batem no mesmo local — CONFERIR',
    'nao-encontrado': 'rótulo não localizado no texto (SPA/JS?) — conferir manual',
    'fonte-falhou': 'fonte configurada mas o download/parse falhou — conferir manual',
    'sem-fonte': 'provedor sem fonte automática (modelo est:true)',
  };

  console.log('\n=== Vigilância de Preços — PromptMeter ===');
  console.log(`pricing.js PRICING_UPDATED = ${table.updated}`);
  console.log('Fontes oficiais:');
  for (const prov of providers) {
    const f = fetched[prov];
    const state = f?.error ? `FALHOU (${f.error})` : f?.text ? 'ok' : 'sem texto';
    console.log(`  · ${prov.padEnd(10)} ${f?.url || '(sem fonte)'}  [${state}]`);
  }
  console.log('');

  const counts = { confere: 0, diverge: 0, 'nao-encontrado': 0, 'fonte-falhou': 0, 'sem-fonte': 0 };
  for (const r of rows) {
    counts[r.status] = (counts[r.status] || 0) + 1;
    const tabStr = `in $${r.table.in} / out $${r.table.out}`.padEnd(24);
    const foundStr = r.valoresEncontrados.length
      ? `fonte≈ [${[...new Set(r.valoresEncontrados)].map((v) => '$' + v).join(' ')}]`
      : '';
    console.log(`  ${ICON[r.status] || '?  '}${r.label.padEnd(22)} ${tabStr} ${foundStr}`);
  }

  console.log('\nResumo:');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${ICON[k]}${String(v).padStart(2)}  ${k.padEnd(15)} — ${LEGENDA[k]}`);
  }
  const acao = counts.diverge > 0
    ? `\n>> ${counts.diverge} possível(is) divergência(s): confira na fonte oficial e, se mudou, atualize pricing.js + PRICING_UPDATED (HANDBOOK §10).`
    : '\n>> Nenhuma divergência automática. Lembre: SPAs muitas vezes não expõem os preços a um fetch simples — a checagem visual na fonte continua valendo.';
  console.log(acao);
}

main();
