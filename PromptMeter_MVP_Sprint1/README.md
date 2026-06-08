# PromptMeter — extensão (Manifest V3)

Esta pasta é a **extensão carregável**. É um **medidor de custo de prompts**: conta tokens de forma determinística (sem IA), detecta o modelo em uso, calcula o custo de entrada em tempo real e, quando possível, o custo da resposta e o total da sessão — direto no **ChatGPT, Claude, Gemini e Perplexity**.

> **v0.4.0 — 100% local e determinístico.** Sem backend, sem IA, sem rede. A única permissão é `storage`.

Para a visão geral do produto, instalação e preços, veja o [README principal](../README.md).

## Como carregar (dev)

1. `chrome://extensions/` → ative **Modo do desenvolvedor**.
2. **Carregar sem compactação** → selecione **esta pasta** (`PromptMeter_MVP_Sprint1/`).
3. Abra um site de IA suportado e comece a digitar — o card aparece sobre o campo.

## Arquitetura

A pipeline é dividida em quatro scripts de conteúdo, carregados nesta ordem (ver `manifest.json`):

| Arquivo | Papel |
|---|---|
| `tokenizer.js` | Tokenizer **`o200k_base`** embarcado. Expõe `window.PMTokenizer.count(text)` para contagem **exata** dos modelos OpenAI. |
| `pricing.js` | Tabela de preços (`MODELS`) por 1M de tokens + cálculo de custo. Expõe `window.PM_PRICING`. Contagem por **família**: `openai` exata, demais com `tokFactor` calibrado. |
| `models.js` | Detecção do modelo por host (lê o seletor de modelo do DOM) + resolução de override. Expõe `window.PM_MODELS`. |
| `content.js` | Orquestra tudo: detecta o campo, conta tokens, renderiza o overlay, captura a resposta e acumula a sessão. |
| `background.js` | Service worker: semeia defaults, abre as Opções no clique do ícone, responde `ping`/`reset_session`. **Nunca acessa a rede.** |
| `options.html` / `options.js` | Página de Opções (moeda, cotação R$, rastreio de resposta/sessão, reset). Sem script inline (CSP MV3-safe). |
| `overlay.css` | Estilos do card injetado, com modo escuro automático (`prefers-color-scheme`). |
| `_locales/` | i18n — `pt_BR` (default) e `en`, via `chrome.i18n.getMessage`. |

### Fluxo de dados

```
focusin → isPromptLike?  ──não──▶ ignora (inclui campos sensíveis)
   │ sim
   ▼
resolveModel(host)  →  override do usuário > detecção no DOM > padrão do site
   │
   ▼
countTokens(texto, modelo)  →  o200k exato  |  o200k × tokFactor (estimativa)
   │
   ▼
cost(modelo, tokens)  →  tokens/1e6 × preço[in]   →  render USD + R$
   │
   ▼ (MutationObserver na resposta, ao estabilizar)
countTokens(resposta) → cost(out) → soma na sessão do dia (chrome.storage.local)
```

### Detecção de campo (privacidade primeiro)

`content.js` só ativa em `<textarea>`, `contentEditable` e `<input type=text|search>` "grandes". **Descarta** explicitamente:

- `type` em `password | email | tel | number | date | …`;
- `autocomplete` com `cc- | new-password | current-password | one-time-code | otp`;
- `name`/`id`/`aria-label`/`placeholder` que casem `senha|password|cvv|cartão|otp|2fa`;
- qualquer campo dentro de um `<form>` que contenha `<input type=password>`.

Suporta **Shadow DOM** via `composedPath()` e reposiciona o card em `scroll`/`resize`/`visualViewport`.

## Configurações (`chrome.storage.sync`)

| Chave | Default | Descrição |
|---|---|---|
| `currency` | `"both"` | `"usd"` ou `"both"` (USD + R$ aproximado). |
| `brlRate` | `5.40` | Cotação USD→BRL para a conversão. |
| `trackResponses` | `true` | Estimar custo da resposta e somar à sessão. |
| `modelOverrides` | `{}` | `{ [host]: modelId }` — modelo fixado por site. |

A sessão do dia (`pmSession`) fica em `chrome.storage.local` e zera à meia-noite (por data).

## i18n

Strings em `_locales/<lang>/messages.json`, lidas por `chrome.i18n.getMessage(key)` com fallback embutido no código. Adicionar um idioma = adicionar um `messages.json` (o `default_locale` é `pt_BR`).

## Debug

```js
localStorage.setItem('PM_DEBUG','1')  // e recarregue a página
```

Logs com prefixo `[PromptMeter]` aparecem no console do site.

## Privacidade & permissões

- **Permissões:** apenas `storage`.
- **`host_permissions`/matches:** restritos aos 6 hosts de IA suportados.
- **Rede:** nenhuma. Não há `fetch`, telemetria ou analytics.

## Limitações conhecidas

- Contagem **exata só para OpenAI**; demais provedores usam estimativa calibrada (`~`).
- A detecção de modelo depende do DOM do site — se a UI mudar muito, recai no modelo padrão do host (sempre trocável no card).
- A captura de resposta é *best-effort* (via seletores + `MutationObserver`); sites com isolamento agressivo podem não ser cobertos.
- Preços são um *snapshot* (`PRICING_UPDATED`) — confira a fonte oficial antes de decisões de orçamento.

## Atualizando preços / modelos

Edite `MODELS` em `pricing.js` (campos `in`/`out` em USD por 1M, `family`, `est`) e o `PRICING_UPDATED`. Se for um modelo novo de um host já suportado, a detecção em `models.js` tende a casá-lo pelo rótulo automaticamente.
