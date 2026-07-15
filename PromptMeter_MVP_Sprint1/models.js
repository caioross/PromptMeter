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
    const candidates = window.PM_PRICING.listModels()
      .filter((m) => !provider || m.provider === provider)
      // testa os rótulos mais específicos primeiro (mais longos)
      .sort((a, b) => b.label.length - a.label.length);
    for (const m of candidates) {
      const ln = norm(m.label);
      if (n.includes(ln)) return m.id;
    }
    // tentativa por número de versão isolado (ex.: "4.8", "5.5", "3.5 flash")
    for (const m of candidates) {
      const ver = (m.label.match(/[0-9]+(\.[0-9]+)?/g) || []).join(" ");
      const tier = (norm(m.label).match(/\b(opus|sonnet|haiku|pro|flash|mini|nano|lite)\b/g) || []).join(" ");
      if (ver && n.includes(norm(ver)) && (!tier || n.includes(tier.split(" ")[0]))) return m.id;
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
      defaultModel: "gpt-5.5",
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
      defaultModel: "claude-sonnet-4.6",
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
      defaultModel: "gpt-4.1",     // padrão quando nada é detectado (Perplexity é OpenAI-backed por padrão)
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
