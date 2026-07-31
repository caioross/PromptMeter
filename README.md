<div align="center">

<img src="icon.png" alt="PromptMeter" width="120" height="120" />

# 💸 PromptMeter

### Saiba quanto custa cada prompt — **antes** de enviar.

*Know what every prompt costs — before you send it.*

Uma extensão Chrome que conta os **tokens** e calcula o **custo** do seu prompt em tempo real, direto no ChatGPT, Claude, Gemini e Perplexity. Pura conta — **sem IA, nada sai do seu navegador.**

<br/>

[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](#-instalação-modo-desenvolvedor)
[![Determinístico](https://img.shields.io/badge/Determin%C3%ADstico-sem%20IA-10a37f?style=for-the-badge)](#-como-funciona-sem-ia)
[![100% Local](https://img.shields.io/badge/100%25-Local%20%26%20Privado-2ea44f?style=for-the-badge&logo=ghostery&logoColor=white)](#-privacidade)
[![Version](https://img.shields.io/badge/version-0.4.0-0a0a0b?style=for-the-badge)](#)

<br/>

**[🌐 Site](https://promptmeter-pi.vercel.app)** &nbsp;·&nbsp; **[🧮 Testar o cálculo](https://promptmeter-pi.vercel.app/#demo)** &nbsp;·&nbsp; **[⬇️ Baixar a extensão](https://github.com/caioross/PromptMeter/releases)**

</div>

---

```
┌─────────────────────────────────────────────┐
│  ● GPT-5.5   detectado            ▾      ✕   │
│                                              │
│   312            $0.00156  R$ 0,0084         │
│   tokens         custo de entrada            │
│ ─────────────────────────────────────────── │
│  resposta: 1.204 tok · $0.0301   sessão: $0.18│
└─────────────────────────────────────────────┘
   ↑ o card que aparece sobre o campo de IA, ao vivo
```

## 📖 Índice

- [O que é](#-o-que-é)
- [Por que usar](#-por-que-usar)
- [Como funciona (sem IA)](#-como-funciona-sem-ia)
- [Onde funciona](#-onde-funciona)
- [Preços & precisão](#-preços--precisão)
- [Instalação](#-instalação-modo-desenvolvedor)
- [Privacidade](#-privacidade)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [O site](#-o-site)
- [FAQ](#-faq)
- [Roadmap](#-roadmap)

## 🎯 O que é

**PromptMeter** é uma extensão **Chrome (Manifest V3)** que mostra, em tempo real, **quanto custa o que você está digitando** num campo de IA. Um card discreto aparece sobre o campo e exibe:

- 🏷️ o **modelo** detectado (e você troca em 1 clique);
- 🔢 a **contagem de tokens** do prompt;
- 💵 o **custo de entrada** em **USD e R$**;
- 📈 o **custo estimado da resposta** e o **total gasto na sessão** do dia.

> **v0.4 — 100% determinístico, sem IA.** Nada de chamar um modelo para "estimar". É pura conta: **tokenização local × tabela de preços**. Nenhum texto, token ou custo sai do seu navegador.

## 💡 Por que usar

| | |
|---|---|
| 🔢 **Contagem real de tokens** | Tokenizer `o200k_base` embarcado conta **exatamente** os tokens dos modelos OpenAI. Claude, Gemini e outros usam **estimativa calibrada**, sempre marcada com `~`. |
| 💵 **Custo em USD e R$** | Preço calculado na hora, em dólar e real (cotação ajustável). Atualizado com os preços oficiais de cada modelo. |
| 🎯 **Detecta o modelo sozinho** | Identifica o modelo ativo no ChatGPT, Claude, Gemini e Perplexity. Errou? Troque com um clique — a escolha fica salva **por site**. |
| 📈 **Resposta + sessão** | Estima também os tokens da resposta e soma o gasto do dia — você enxerga quanto a conversa **realmente** custou. |
| 🔒 **Privado por construção** | Sem backend, sem conta, sem telemetria. Funciona até offline. |
| ⚡ **Instantâneo** | Cálculo em milissegundos a cada tecla, com debounce. Zero requisições de rede. |

## 🧮 Como funciona (sem IA)

```js
tokens = tokenize(prompt)              // local, no seu navegador
custo  = tokens / 1e6 * preço[modelo]  // tabela de preços determinística
// 0 requisições de rede · 0 IA · 0 dados enviados
```

1. **Detecta o campo** de prompt (e **ignora** senhas, e-mails, telefones, cartões e OTP).
2. **Conta os tokens localmente.** OpenAI → contagem **exata** (`o200k_base`). Claude/Gemini/outros → **estimativa calibrada** por família (marcada com `~`).
3. **Calcula o custo:** `tokens × preço[modelo]` (entrada/saída por 1M), em **USD e R$**.
4. **Detecta o modelo** por site; não acertou? Troque no card (fica salvo por host).
5. **Custo da resposta + sessão:** quando a resposta estabiliza, estima seus tokens e soma ao gasto do dia.

Tudo offline. **Zero telemetria, zero servidor, zero IA.**

## 🖥️ Onde funciona

| Plataforma | Detecção de modelo | Contagem |
|---|:---:|:---:|
| **ChatGPT** (`chatgpt.com`, `chat.openai.com`) | ✅ automática | exata |
| **Claude** (`claude.ai`) | ✅ automática | `~` calibrada |
| **Gemini** (`gemini.google.com`) | ✅ automática | `~` calibrada |
| **Perplexity** (`perplexity.ai`) | ✅ automática | exata/`~` |

O modelo cobrado é sempre **trocável em 1 clique** no próprio card, com a escolha salva por site.

## 💵 Preços & precisão

A tabela em [`pricing.js`](PromptMeter_MVP_Sprint1/pricing.js) traz os preços oficiais por **1M de tokens**. A **data da última conferência** não é repetida aqui (para não envelhecer): ela vive no próprio arquivo, na constante `PRICING_UPDATED`, e a extensão a exibe. Alguns flagships:

| Modelo | Provedor | Entrada / 1M | Saída / 1M | Tokens |
|---|---|---:|---:|:---:|
| GPT-5.6 Sol | OpenAI | $5.00 | $30.00 | exata |
| GPT-5.6 Luna | OpenAI | $1.00 | $6.00 | exata |
| GPT-5 | OpenAI | $1.25 | $10.00 | exata |
| GPT-4o mini | OpenAI | $0.15 | $0.60 | exata |
| Claude Opus 5 | Anthropic | $5.00 | $25.00 | `~` |
| Claude Sonnet 5 | Anthropic | $2.00 | $10.00 | `~` |
| Claude Haiku 4.5 | Anthropic | $1.00 | $5.00 | `~` |
| Gemini 3.6 Flash | Google | $1.50 | $7.50 | `~` |
| Gemini 2.5 Flash-Lite | Google | $0.10 | $0.40 | `~` |

> A lista completa — **dezenas de modelos** de **OpenAI, Anthropic, Google, Perplexity (Sonar), xAI (Grok) e DeepSeek** — está em [`pricing.js`](PromptMeter_MVP_Sprint1/pricing.js), é visível na extensão e editável. Preços ainda não confirmados numa página oficial ficam marcados com `est: true` no arquivo. A cotação do dólar é ajustável nas Opções.

**Precisão da contagem:** OpenAI é **exata** (tokenizer embarcado). Para os demais provedores, aplicamos um fator de calibração por família (`tokFactor`) sobre o `o200k_base` — uma estimativa próxima, **sempre sinalizada com `~`**.

## ⬇️ Instalação (modo desenvolvedor)

> A extensão ainda **não está na Chrome Web Store** — a instalação é manual (leva ~30 segundos).

> Builds oficiais (ZIP) são publicados em [Releases](https://github.com/caioross/PromptMeter/releases); o empacotamento segue o processo da skill interna `pmeter-extension-quality`.

1. **Baixe e descompacte** o ZIP mais recente em [Releases](https://github.com/caioross/PromptMeter/releases) (ou use a pasta `PromptMeter_MVP_Sprint1/` deste repositório).
2. Abra **`chrome://extensions/`** (funciona em Chrome, Edge e Brave).
3. Ative o **"Modo do desenvolvedor"** (canto superior direito).
4. Clique em **"Carregar sem compactação"** e selecione a pasta **`PromptMeter_MVP_Sprint1/`**.
5. Abra o **ChatGPT/Claude/Gemini/Perplexity** e comece a digitar — o card aparece sobre o campo. ✨

**Opções:** clique no ícone da extensão para ajustar moeda, cotação do R$, e o rastreio de resposta/sessão.
**Debug:** rode `localStorage.setItem('PM_DEBUG','1')` no console e recarregue para ver os logs `[PromptMeter]`.

## 🔒 Privacidade

Sem backend, sem IA, sem conta. **Tokenização e preço acontecem no seu navegador.**

- ✅ **Zero requisições de rede** — não enviamos texto, tokens ou custo para lugar nenhum.
- ✅ **Campos sensíveis ignorados** — senhas, e-mails, telefones, cartões e códigos OTP nunca são lidos (heurística por `type`, `autocomplete`, `name`/`id`/`aria-label` e forms com `<input type=password>`).
- ✅ **Sem cadastro, sem telemetria, sem analytics** na extensão.

A única permissão pedida é `storage` (para salvar suas preferências localmente).

📄 Política de privacidade completa (PT/EN): [`docs/store/PRIVACY.md`](docs/store/PRIVACY.md).

## 🗂️ Estrutura do projeto

```
Prompt Meter/
├── PromptMeter_MVP_Sprint1/      ← carregue ESTA pasta no Chrome
│   ├── manifest.json             MV3 — só sites de IA, permissão storage
│   ├── tokenizer.js              tokenizer o200k_base embarcado (contagem exata OpenAI)
│   ├── pricing.js                tabela de preços por modelo + cálculo de custo
│   ├── models.js                 detecção de modelo por site + override por host
│   ├── content.js                overlay de custo, captura de resposta, sessão
│   ├── background.js             service worker (defaults; sem rede)
│   ├── options.html · options.js página de Opções (moeda, cotação R$, sessão)
│   ├── overlay.css               estilos do card injetado
│   └── _locales/                 i18n (pt_BR, en)
├── site/                         landing page (Next.js 14 + Tailwind) → repositório separado
└── README.md                     você está aqui
```

## 🌐 O site

A landing page vive em **[promptmeter-pi.vercel.app](https://promptmeter-pi.vercel.app)** — construída em **Next.js 14 + TypeScript + Tailwind**, com:

- 🧮 **calculadora de custo interativa** (digite e veja tokens, preço em USD/R$, comparação entre modelos e **projeção de gasto mensal**);
- 🌗 **tema claro/escuro** com a personalidade da marca;
- 🚀 **SEO completo**: Open Graph dinâmico, dados estruturados (`SoftwareApplication` + `FAQPage`), `sitemap.xml`, `robots.txt`, `hreflang` PT/EN e manifest PWA;
- 🌍 **bilíngue** (PT-BR / EN).

O código do site vive num **repositório separado** — não está neste repo (a pasta `site/` é ignorada pelo `.gitignore`).

## ❓ FAQ

<details>
<summary><b>Como o custo é calculado sem usar IA?</b></summary>

Puramente por conta: o texto é tokenizado localmente e multiplicado pelo preço do modelo (entrada/saída por 1M de tokens). Nenhum modelo de IA é chamado para medir.
</details>

<details>
<summary><b>A contagem de tokens é exata?</b></summary>

Para modelos **OpenAI** sim — a extensão embarca o tokenizer `o200k_base`. Para Claude, Gemini e outros, usamos uma **estimativa calibrada**, sempre marcada com `~`.
</details>

<details>
<summary><b>Tem custo? Tem cota?</b></summary>

É **grátis e sem cota**. Como tudo roda local, não há limite de uso.
</details>

<details>
<summary><b>Meus prompts são enviados para algum servidor?</b></summary>

**Nunca.** Não há backend nem IA. Todo o processamento é local; nada sai do navegador.
</details>

## 🗺️ Roadmap

- [ ] Publicação na **Chrome Web Store**.
- [ ] **Atalho de envio** (Enter/botão) com transição suave do card.
- [ ] **Histórico de sessão** e exportação (CSV) do gasto.
- [x] Mais provedores e **modelos** na tabela — xAI (Grok), DeepSeek e Perplexity (Sonar) já entraram.
- [x] Suíte de **testes** para tokenização e cálculo de custo — em [`tests/`](tests/), com `node:test` (zero dependências), executada pelo gate.

---

<div align="center">

*Parte do ecossistema de IA do **Caio** — **PromptMeter** mede o custo dos prompts, **SkillDepot** distribui skills, **Claude MasterClass** ensina o Claude.*

**Feito com conta, não com chute.** · © Caio

</div>
