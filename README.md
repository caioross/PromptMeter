<div align="center">

# 💸 PromptMeter

**Saiba quanto custa cada prompt — antes de enviar.**
*Know what every prompt costs — before you send it.*

[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](#)
[![No AI](https://img.shields.io/badge/Determin%C3%ADstico-sem%20IA-10a37f?style=for-the-badge)](#)
[![Privacy](https://img.shields.io/badge/100%25-Local-2ea44f?style=for-the-badge&logo=ghostery&logoColor=white)](#)
[![Version](https://img.shields.io/badge/version-0.4.0-blue?style=for-the-badge)](#)

</div>

---

## O que é

**PromptMeter** é uma extensão **Chrome (Manifest V3)** que **conta os tokens** do que você digita e **calcula o custo** do prompt — e da resposta — em tempo real, direto no **ChatGPT, Claude, Gemini e Perplexity**. Um card discreto aparece sobre o campo mostrando: modelo detectado, tokens, custo de entrada (USD e R$) e o total gasto na sessão.

> **v0.4 — 100% determinístico, sem IA.** Nada de chamar um modelo para "estimar". É pura conta: tokenização local × tabela de preços. Nenhum texto sai do seu navegador.

## Como funciona (sem IA)

1. **Detecta o campo** de prompt (e ignora senhas/campos sensíveis).
2. **Conta os tokens localmente.** Modelos **OpenAI** têm contagem **exata** (tokenizer `o200k_base` embarcado). **Claude, Gemini** e outros usam **estimativa calibrada** — sempre marcada com `~`.
3. **Calcula o custo:** `tokens × preço[modelo]` (entrada/saída por 1M), em **USD e R$**.
4. **Detecta o modelo** em uso por site; não acertou? Troque em 1 clique (a escolha fica salva por site).
5. **Custo da resposta + sessão:** quando a resposta termina, estima seus tokens e soma o gasto do dia.

Tudo offline. **Zero requisições de rede, zero telemetria.**

## Instalar (modo desenvolvedor)

```
1. Abra chrome://extensions/
2. Ative "Modo do desenvolvedor"
3. "Carregar sem compactação" → selecione a pasta PromptMeter_MVP_Sprint1/
4. Abra o ChatGPT/Claude/Gemini e comece a digitar — o card aparece sobre o campo.
```

## Estrutura

```
Prompt Meter/
├── PromptMeter_MVP_Sprint1/      ← carregue ESTA pasta no Chrome
│   ├── manifest.json             MV3 (apenas sites de IA, storage)
│   ├── tokenizer.js              tokenizer o200k_base embarcado (contagem exata OpenAI)
│   ├── pricing.js                tabela de preços por modelo + cálculo de custo
│   ├── models.js                 detecção de modelo por site + override
│   ├── content.js                overlay de custo, captura de resposta, sessão
│   ├── background.js             service worker (defaults; sem rede)
│   ├── options.html · options.js Opções (moeda, cotação R$, custo da resposta)
│   ├── overlay.css               estilos do card
│   └── _locales/                 i18n (pt_BR, en)
└── site/                         landing page (Next.js + Tailwind)
```

## Preços

A tabela em `pricing.js` traz os preços oficiais por 1M de tokens, atualizados em **2026-06-06** (OpenAI, Anthropic, Google). São editáveis e visíveis na extensão; a cotação do dólar é ajustável nas Opções.

## Privacidade

Sem backend, sem IA, sem conta. Tokenização e preço acontecem no seu navegador. Senhas, e-mails, telefones, cartões e códigos OTP são ignorados.

---

<div align="center">

*Parte do ecossistema de IA do **Caio** — PromptMeter mede o custo dos prompts.*

</div>
