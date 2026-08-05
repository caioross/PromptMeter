// PromptMeter — models.js
// Detecção determinística do modelo em uso por site, com mapeamento para PM_PRICING.
// Estratégia: por host, sabemos o provedor e um modelo padrão; tentamos ler o seletor
// de modelo da página (texto do botão) e casar com a tabela de modelos. Se não
// conseguirmos, usamos o padrão do site. O usuário sempre pode sobrescrever no overlay.

(() => {
  "use strict";

  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();

  // Casa um texto livre (ex.: "Claude Opus 4.8") com um modelo da tabela, dentro do provedor.
  function matchModelFromText(text, provider) {
    if (!text || !window.PM_PRICING) return null;
    const n = norm(text);
    const inProvider = window.PM_PRICING.listModels()
      .filter((m) => !provider || m.provider === provider);
    // 1) rótulo completo: testa os mais específicos primeiro (rótulos mais longos)
    const candidates = inProvider.slice().sort((a, b) => b.label.length - a.label.length);
    for (const m of candidates) {
      const ln = norm(m.label);
      const idx = n.indexOf(ln);
      if (idx === -1) continue;
      // não casa versão que continua: "gpt 5" NÃO deve casar dentro de "gpt 5.6"
      // (o caractere seguinte é dígito ou ponto). Sem isso, "GPT-5.6" cairia em gpt-5.
      const after = n[idx + ln.length];
      if (after && /[0-9.]/.test(after)) continue;
      return m.id;
    }
    // 2) fallback por número de versão isolado (ex.: "4.8", "5.5", "3.5 flash").
    //    Ordem de DECLARAÇÃO (flagship primeiro): um rótulo genérico como "GPT-5.6"
    //    resolve para o flagship da família (gpt-5.6-sol), não para uma variante barata.
    //    O conjunto de tiers do texto deve ser IGUAL ao do rótulo: "2.5 flash lite"
    //    não casa em "Gemini 2.5 Flash" ({flash} vs {flash,lite}) nem o inverso.
    //    A versão precisa aparecer como TOKEN INTEIRO do texto, não como pedaço de outro
    //    número: com `includes`, o "5" de "GPT-5 Pro" casava dentro do "1.5" de
    //    "Gemini 1.5 Pro" e, no Perplexity (provider aberto), um Gemini era precificado
    //    como gpt-5-pro — $15/$120 em vez de $1/$1, com source "detected" (issue #51).
    const tiersOf = (s) => (s.match(/\b(opus|sonnet|haiku|fable|pro|flash|mini|nano|lite)\b/g) || []).sort().join(" ");
    const nTiers = tiersOf(n);
    const nTokens = n.split(" ");
    for (const m of inProvider) {
      const ver = (m.label.match(/[0-9]+(\.[0-9]+)?/g) || []).join(" ");
      if (!ver) continue;
      if (!norm(ver).split(" ").every((v) => nTokens.includes(v))) continue;
      if (tiersOf(norm(m.label)) !== nTiers) continue;
      // Com provider ABERTO (Perplexity), versão + tier não bastam: o texto precisa
      // trazer a MARCA do rótulo ("gpt", "claude", "gemini", "sonar"…), senão
      // "Mistral Large 5 Pro" — modelo que não está na tabela — casaria gpt-5-pro.
      // Com provider conhecido o filtro de provedor já impede isso, e a versão nua
      // continua valendo ("5.4 mini" no ChatGPT → gpt-5.4-mini).
      if (!provider) {
        const brand = norm(m.label).split(" ").filter((t) => !/^[0-9]/.test(t) && !tiersOf(t));
        if (brand.length && !brand.some((b) => nTokens.includes(b))) continue;
      }
      return m.id;
    }
    return null;
  }

  // Lê o texto de um seletor de modelo a partir de uma lista de seletores CSS.
  function readSelectorText(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        const txt = el && (el.textContent || el.getAttribute("aria-label") || el.getAttribute("title"));
        if (txt && txt.trim()) return txt.trim();
      } catch {}
    }
    return "";
  }

  // Configuração por host. detectSelectors são pistas comuns do botão de troca de modelo.
  const SITES = [
    {
      match: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/i,
      name: "ChatGPT",
      provider: "OpenAI",
      defaultModel: "gpt-5.6-sol",
      detectSelectors: [
        '[data-testid="model-switcher-dropdown-button"]',
        '[data-testid^="model-switcher"]',
        'button[aria-label*="model" i]',
        'button[aria-haspopup="menu"] div'
      ],
      responseSelectors: ['[data-message-author-role="assistant"] .markdown', '[data-message-author-role="assistant"]']
    },
    {
      match: /(^|\.)claude\.ai$/i,
      name: "Claude",
      provider: "Anthropic",
      // Linha atual do site é a Claude 5; Sonnet é o tier padrão. Preço idêntico ao do
      // antigo padrão (Sonnet 4.6, $3/$15) — troca só corrige o RÓTULO exibido, sem
      // mexer no número. Detecção pelo DOM continua vencendo este fallback.
      defaultModel: "claude-sonnet-5",
      detectSelectors: [
        '[data-testid="model-selector-dropdown"]',
        'button[aria-label*="model" i]',
        'button[data-testid*="model" i]'
      ],
      responseSelectors: ['.font-claude-response', '.font-claude-message', '[data-testid="assistant-message"]']
    },
    {
      match: /(^|\.)gemini\.google\.com$/i,
      name: "Gemini",
      provider: "Google",
      // Fica no 3.5 Flash de propósito. O 3.6 Flash (2026-07-21) existe na tabela e é
      // detectado quando o seletor é legível, mas a release note oficial diz que ele
      // precisa ser ESCOLHIDO no menu de modelos — nenhuma fonte confirma que virou o
      // padrão do app. Este valor só vale quando a detecção falha, e aí errar para cima
      // ($9.00 vs $7.50) é o lado honesto num medidor de custo: nunca subestimar.
      defaultModel: "gemini-3.5-flash",
      detectSelectors: [
        'button[aria-label*="model" i]',
        '[data-test-id="bard-mode-menu-button"]',
        '.gds-mode-switch-button',
        '.logo-pill-label-container'
      ],
      responseSelectors: ['.model-response-text', 'message-content .markdown', 'message-content']
    },
    {
      match: /(^|\.)perplexity\.ai$/i,
      name: "Perplexity",
      // Perplexity Pro deixa o usuário escolher o provedor da resposta (Sonar, GPT,
      // Claude, Gemini, Grok). provider aberto (null) => matchModelFromText considera
      // TODOS os providers (models.js:17), evitando precificar Claude/Gemini/Grok como GPT.
      provider: null,
      // Free/Best (o caso mais comum) é servido pela família Sonar e a Perplexity NÃO
      // expõe o modelo na UI Free → sem texto para detectar. O padrão precisa ser `sonar`,
      // não um modelo OpenAI: precificar como GPT-4.1 fabrica o custo (issue #34, HANDBOOK §10).
      defaultModel: "sonar",
      detectSelectors: [
        'button[aria-label*="model" i]',
        'button[data-testid*="model" i]'
      ],
      responseSelectors: ['.prose', '[class*="answer"] .prose']
    }
  ];

  function siteForHost(host) {
    host = String(host || location.hostname || "").toLowerCase();
    return SITES.find((s) => s.match.test(host)) || null;
  }

  // Resolve o modelo ativo: override do usuário > detecção do DOM > padrão do site.
  // overrides = { [host]: modelId }
  function resolveModel(host, overrides) {
    const site = siteForHost(host);
    host = String(host || location.hostname).toLowerCase();
    if (overrides && overrides[host] && window.PM_PRICING && window.PM_PRICING.getModel(overrides[host])) {
      return { modelId: overrides[host], source: "user", site };
    }
    if (site) {
      const txt = readSelectorText(site.detectSelectors);
      const detected = matchModelFromText(txt, site.provider);
      if (detected) return { modelId: detected, source: "detected", site, detectedText: txt };
      return { modelId: site.defaultModel, source: "default", site };
    }
    // host não suportado: cai num padrão genérico OpenAI
    return { modelId: "gpt-5.5", source: "default", site: null };
  }

  window.PM_MODELS = { SITES, siteForHost, resolveModel, matchModelFromText, readSelectorText, norm };
})();
