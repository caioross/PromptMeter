# PromptMeter

Extensão Chrome (Manifest V3) que avalia, em tempo real, o prompt que você está digitando em campos de IA — ChatGPT, Claude, Gemini, Perplexity, Mistral Chat e qualquer textarea/contentEditable em geral. Mostra uma nota 0–10 e uma dica curta (≤142 chars) abaixo do campo.

> **v0.3.0 — análise local por padrão, backend opcional.**

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions/` no Chrome/Edge/Brave.
2. Ative "Modo do desenvolvedor".
3. Clique em "Carregar sem compactação" e selecione a pasta `PromptMeter_MVP_Sprint1`.
4. Pronto. O ícone aparece na barra; clique para abrir as Opções.

## O que faz

- Detecta foco em `<textarea>`, `contenteditable`, e `<input type="text|search">` "grandes".
- **Ignora** campos sensíveis: `password`, `email`, `tel`, `cc-…`, `otp`, `one-time-code`, `new-password`, e qualquer campo dentro de um formulário com `<input type=password>`.
- **Análise local heurística** (offline, gratuita, privada): comprimento útil, estrutura, verbos imperativos, papel/contexto, exemplos, formato de saída, especificidade, audiência, ambiguidade, CAPS, repetição.
- **Backend opcional**: defina a URL nas Opções e a extensão tenta `POST {url}/analyze` (timeout 2,5 s). Se falhar, cai automaticamente na análise local.
- Cota diária (free: 30/dia, configurável). Idempotência por hash forte do texto. **Falhas não consomem cota.**
- Silenciar por site (`silenciar`/`reativar` no card). `Esc` esconde temporariamente.
- Suporte a Shadow DOM (via `composedPath`), iframes (`all_frames: true`) e SPAs (polling de rota).
- i18n: PT-BR (default) e EN.

## Contrato do backend (opcional)

`POST {backendURL}/analyze` com `Content-Type: application/json` e headers `X-PM-Version`, `X-PM-Lang`.

```json
{ "text": "string (até 4096 chars)", "site": "host", "lang": "pt-BR" }
```

Resposta:

```json
{ "score": 7.5, "tip": "Dica curta até 142 chars" }
```

`GET {backendURL}/health` deve responder 200 para o botão "Testar conexão".

## Privacidade

- Vazio em "Endpoint do backend" = **nenhuma requisição de rede é feita**. Tudo é local.
- Quando configurado, apenas os primeiros 4 KB do texto, o host atual e o idioma são enviados.
- Nenhuma telemetria por padrão.

## Limitações conhecidas

- "Premium" no MVP é só uma flag local; em Sprint 2 isso vira Stripe real.
- Sites com `iframe sandbox` agressivo podem não receber o overlay.
- A heurística local não é IA — ela mede sinais; um prompt "ótimo" pelo escore ainda pode estar errado.

## Estrutura

```
manifest.json        # MV3
background.js        # service worker (defaults, action click, mensageria)
content.js           # injetado em todas as páginas
options.html         # página de Opções (UI)
options.js           # lógica das Opções (sem inline — CSP MV3)
overlay.css          # estilos do card
_locales/            # i18n (pt_BR, en)
icons/               # 16/32/128 PNG
RELATORIO.md         # diagnóstico e plano (manter para histórico)
```

## Debug

No DevTools de qualquer página, rode `localStorage.setItem('PM_DEBUG','1')` e recarregue — logs com prefixo `[PromptMeter]` aparecerão no console.

## Roadmap

- Sprint 2: Stripe + JWT + leaderboard.
- Sprint 3: tipos de prompt (código, copywriting, jurídico) e dicas específicas.
- Sprint 4: detecção de envio (Enter/botão) + comparação antes/depois.
