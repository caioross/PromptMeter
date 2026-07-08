# CLAUDE.md — PromptMeter

Extensão Chrome (MV3) que conta tokens e mostra o **custo real** de cada prompt e resposta, em tempo real, em ChatGPT, Claude, Gemini e Perplexity. **100% local e determinística — sem IA, sem backend, sem telemetria.** Repo PÚBLICO.

## Mapa do código (tudo em `PromptMeter_MVP_Sprint1/`)

- `manifest.json` — MV3; permissão ÚNICA: `storage`; content script nos 4 sites; `options_page`
- `tokenizer.js` — tokenizer o200k_base embarcado (GERADO/minificado — **nunca editar à mão**); expõe `window.PMTokenizer`
- `pricing.js` — tabela de preços (USD/1M tokens) + `tokFactor` por família + cálculo de custo; expõe `window.PM_PRICING`; `PRICING_UPDATED` marca a data da última conferência
- `models.js` — detecção de modelo por site (seletores CSS + match de texto) e `defaultModel` por host; expõe `window.PM_MODELS`
- `content.js` — overlay/card, captura de resposta, sessão diária
- `background.js` — service worker: defaults + abrir Opções (SEM rede)
- `options.html/js` — moeda, cotação R$, sessão
- `_locales/{pt_BR,en}/` — i18n

## Regras sagradas

1. **100% local é a promessa do produto** (está na descrição da Store): NENHUMA chamada de rede na extensão — sem `fetch`, WebSocket, beacon ou telemetria. Adicionar rede = `decisao-dono`. (Tooling de dev em `scripts/` pode usar rede; a EXTENSÃO não.)
2. **Permissão única `storage`**: qualquer permissão nova, `host_permissions` ou CSP custom = `decisao-dono`.
3. **Exatidão honesta**: contagem OpenAI é exata (o200k); as demais são estimativas via `tokFactor` — a UI sempre deixa isso claro. Mudança de preço exige a URL da fonte oficial no PR e atualiza `PRICING_UPDATED`.
4. **Zero-build**: sem bundler, framework ou dependência nova sem `decisao-dono`. `tokenizer.js` é vendored/gerado.
5. Repo público: NUNCA commitar segredos; `.env*` é intocável.
6. Código, issues e PRs em **português do Brasil** (produto é bilíngue PT/EN via `_locales`).

## Gate (obrigatório verde antes de qualquer PR)

```bash
node scripts/gate.mjs
```

## Frota autônoma

3 rodadas por dia: **Curador** ~09h30 · **Resolvedor** ~15h30 · **PR Doctor** ~20h50.
Lei da frota: `docs/fleet/HANDBOOK.md` · Receitas (locais, não versionadas): `.claude/skills/pm-fleet-ops/` · Diário: issue #1 (fixada).
