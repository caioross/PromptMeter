// PromptMeter — pricing.js
// Tabela determinística de preços por modelo + cálculo de custo. Sem IA: tudo é conta.
// Preços em USD por 1.000.000 de tokens (input/output). Atualizado em 2026-06-06,
// a partir das páginas oficiais de preços (OpenAI, Anthropic, Google).
//
// family controla a contagem de tokens:
//   "openai"  -> contagem EXATA (tokenizer o200k_base embarcado)
//   demais    -> estimativa calibrada sobre o200k_base (fator por provedor)
// O fator (tokFactor) aproxima a tokenização de cada família em relação à da OpenAI.

(() => {
  "use strict";

  const PRICING_UPDATED = "2026-06-06";

  // tokFactor: multiplica a contagem o200k para aproximar a tokenização da família.
  const FAMILY = {
    openai:    { exact: true,  tokFactor: 1.00 },
    anthropic: { exact: false, tokFactor: 1.15 }, // Opus 4.7+ usa tokenizer novo (mais tokens)
    google:    { exact: false, tokFactor: 1.05 },
    xai:       { exact: false, tokFactor: 1.10 },
    deepseek:  { exact: false, tokFactor: 1.10 },
    generic:   { exact: false, tokFactor: 1.10 }
  };

  // in/out = USD por 1M tokens. est:true marca preço aproximado (não confirmado em fonte oficial).
  const MODELS = [
    // ---------- OpenAI (ChatGPT) ----------
    { id: "gpt-5.5",        label: "GPT-5.5",        provider: "OpenAI", family: "openai", in: 5.00,  out: 30.00 },
    { id: "gpt-5.4",        label: "GPT-5.4",        provider: "OpenAI", family: "openai", in: 2.50,  out: 15.00 },
    { id: "gpt-5.4-mini",   label: "GPT-5.4 mini",   provider: "OpenAI", family: "openai", in: 0.75,  out: 4.50 },
    { id: "gpt-5.4-nano",   label: "GPT-5.4 nano",   provider: "OpenAI", family: "openai", in: 0.20,  out: 1.25 },
    { id: "gpt-5",          label: "GPT-5",          provider: "OpenAI", family: "openai", in: 1.25,  out: 10.00 },
    { id: "gpt-5-mini",     label: "GPT-5 mini",     provider: "OpenAI", family: "openai", in: 0.25,  out: 2.00 },
    { id: "gpt-5-nano",     label: "GPT-5 nano",     provider: "OpenAI", family: "openai", in: 0.05,  out: 0.40 },
    { id: "gpt-4.1",        label: "GPT-4.1",        provider: "OpenAI", family: "openai", in: 2.00,  out: 8.00 },
    { id: "gpt-4.1-mini",   label: "GPT-4.1 mini",   provider: "OpenAI", family: "openai", in: 0.40,  out: 1.60 },
    { id: "gpt-4o",         label: "GPT-4o",         provider: "OpenAI", family: "openai", in: 2.50,  out: 10.00 },
    { id: "gpt-4o-mini",    label: "GPT-4o mini",    provider: "OpenAI", family: "openai", in: 0.15,  out: 0.60 },
    { id: "o3",             label: "o3",             provider: "OpenAI", family: "openai", in: 2.00,  out: 8.00 },

    // ---------- Anthropic (Claude) ----------
    { id: "claude-opus-4.8",   label: "Claude Opus 4.8",   provider: "Anthropic", family: "anthropic", in: 5.00, out: 25.00 },
    { id: "claude-opus-4.7",   label: "Claude Opus 4.7",   provider: "Anthropic", family: "anthropic", in: 5.00, out: 25.00 },
    { id: "claude-opus-4.6",   label: "Claude Opus 4.6",   provider: "Anthropic", family: "anthropic", in: 5.00, out: 25.00 },
    { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6", provider: "Anthropic", family: "anthropic", in: 3.00, out: 15.00 },
    { id: "claude-sonnet-4.5", label: "Claude Sonnet 4.5", provider: "Anthropic", family: "anthropic", in: 3.00, out: 15.00 },
    { id: "claude-haiku-4.5",  label: "Claude Haiku 4.5",  provider: "Anthropic", family: "anthropic", in: 1.00, out: 5.00 },

    // ---------- Google (Gemini) ----------
    { id: "gemini-3.5-flash",      label: "Gemini 3.5 Flash",      provider: "Google", family: "google", in: 1.50, out: 9.00 },
    { id: "gemini-3.1-pro",        label: "Gemini 3.1 Pro",        provider: "Google", family: "google", in: 2.00, out: 12.00 },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", provider: "Google", family: "google", in: 0.25, out: 1.50 },
    { id: "gemini-2.5-pro",        label: "Gemini 2.5 Pro",        provider: "Google", family: "google", in: 1.25, out: 10.00 },
    { id: "gemini-2.5-flash",      label: "Gemini 2.5 Flash",      provider: "Google", family: "google", in: 0.30, out: 2.50 },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", provider: "Google", family: "google", in: 0.10, out: 0.40 },

    // ---------- Outros (aproximados — confira na fonte) ----------
    { id: "grok-4",        label: "Grok 4",         provider: "xAI",      family: "xai",      in: 3.00, out: 15.00, est: true },
    { id: "deepseek-v3",   label: "DeepSeek V3",    provider: "DeepSeek", family: "deepseek", in: 0.27, out: 1.10,  est: true }
  ];

  const byId = {};
  for (const m of MODELS) byId[m.id] = m;

  function getModel(id) { return byId[id] || null; }
  function listModels() { return MODELS.slice(); }

  // Conta tokens para um modelo. Retorna { tokens, exact }.
  function countTokens(text, modelId) {
    const m = byId[modelId];
    const fam = (m && FAMILY[m.family]) || FAMILY.generic;
    const base = (window.PMTokenizer && window.PMTokenizer.ready)
      ? window.PMTokenizer.count(text)
      : Math.ceil(String(text || "").length / 4); // fallback grosseiro
    const tokens = fam.exact ? base : Math.round(base * fam.tokFactor);
    return { tokens, exact: !!fam.exact };
  }

  // Custo em USD. inputTokens/outputTokens em unidades de token.
  function cost(modelId, inputTokens, outputTokens) {
    const m = byId[modelId];
    if (!m) return { inUSD: 0, outUSD: 0, totalUSD: 0 };
    const inUSD = (Number(inputTokens) || 0) / 1e6 * m.in;
    const outUSD = (Number(outputTokens) || 0) / 1e6 * m.out;
    return { inUSD, outUSD, totalUSD: inUSD + outUSD };
  }

  // Formata um valor em USD de forma legível (centavos pequenos ganham mais casas).
  function fmtUSD(v) {
    v = Number(v) || 0;
    if (v === 0) return "$0";
    if (v < 0.01) return "$" + v.toFixed(5).replace(/0+$/, "").replace(/\.$/, ".0");
    if (v < 1)    return "$" + v.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".0");
    return "$" + v.toFixed(2);
  }

  function fmtBRL(v, rate) {
    v = (Number(v) || 0) * (Number(rate) || 0);
    if (v === 0) return "R$ 0";
    if (v < 0.01) return "R$ " + v.toFixed(5).replace(".", ",").replace(/0+$/, "").replace(/,$/, ",0");
    if (v < 1)    return "R$ " + v.toFixed(4).replace(".", ",").replace(/0+$/, "").replace(/,$/, ",0");
    return "R$ " + v.toFixed(2).replace(".", ",");
  }

  function fmtTokens(n) {
    n = Math.round(Number(n) || 0);
    return n.toLocaleString("pt-BR");
  }

  window.PM_PRICING = {
    UPDATED: PRICING_UPDATED,
    MODELS, FAMILY,
    getModel, listModels, countTokens, cost,
    fmtUSD, fmtBRL, fmtTokens
  };
})();
