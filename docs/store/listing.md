# Listing da Chrome Web Store — PromptMeter

**Versão da extensão:** 0.4.0 · **Última revisão deste texto:** 2026-07-22

Pacote de textos prontos para copiar/colar no **Chrome Web Store Developer Console**
(aba *Store listing* / *Privacy*). Fonte de verdade única: este arquivo é versionado
e revisável em PR — a publicação em si é do dono (HANDBOOK §7.1, issue #6).

> ⚠️ **Regras ao editar este arquivo**
> - O **nome** tem de bater **exatamente** com `PromptMeter_MVP_Sprint1/manifest.json → name`.
> - A **descrição curta** tem limite **rígido de 132 caracteres** (contagem anotada abaixo — reconferir ao mudar).
> - A descrição **nunca** pode sugerir que a contagem é exata para todos os provedores:
>   só OpenAI é exata; as demais famílias são **estimativa** (`tokFactor`). Descrição
>   enganosa é motivo de rejeição na review da Store ("Misleading description") e viola
>   a exatidão honesta (HANDBOOK §2/§10).
> - Nada de preço ou número de modelos inventado: puxar de `PromptMeter_MVP_Sprint1/pricing.js`.

**Índice:** [PT-BR](#-português-pt-br) · [EN](#-english-en) · [Campos do formulário](#-campos-do-formulário-comuns)

---

## 🇧🇷 Português (pt-BR)

### Nome (campo *Name* — idioma padrão pt-BR)

```
PromptMeter — Medidor de Custo
```

> 30 caracteres (limite da Store: 75). Bate com `manifest.json → name`.

### Descrição curta (campo *Short description* — limite 132)

```
Conte tokens e veja o custo de cada prompt em USD e R$, em tempo real. 100% local, sem IA. ChatGPT, Claude, Gemini, Perplexity.
```

> **127 caracteres** (limite 132). Conferido em 2026-07-22.

### Descrição longa (campo *Description*)

```
Saiba quanto custa cada prompt — antes de enviar.

O PromptMeter mostra, em tempo real, um card discreto sobre o campo de prompt com a contagem de tokens e o custo em USD e R$ do que você está digitando — e, quando a resposta termina, o custo estimado dela e o total gasto no dia.

O QUE ELE MOSTRA
• Tokens do prompt, ao vivo, a cada tecla.
• Custo de entrada em dólar e em real (cotação do R$ configurável nas Opções).
• Custo estimado da resposta e total da sessão do dia.
• O modelo cobrado, detectado automaticamente — e trocável em 1 clique, com a escolha salva por site.

ONDE FUNCIONA
• ChatGPT (chatgpt.com, chat.openai.com)
• Claude (claude.ai)
• Gemini (gemini.google.com)
• Perplexity (perplexity.ai)

100% LOCAL — NADA SAI DO SEU NAVEGADOR
Não há backend, conta, cadastro, analytics nem telemetria. A extensão não faz nenhuma requisição de rede: ela funciona offline. O texto do seu prompt é lido, tokenizado e multiplicado pela tabela de preços inteiramente na memória do navegador, e nunca é transmitido, armazenado ou registrado.
Campos sensíveis são ignorados por construção: senhas, e-mails, telefones, cartões e códigos OTP não são lidos.

DETERMINÍSTICO — SEM IA
O cálculo é pura conta, não um palpite de modelo:
tokens × preço do modelo (entrada/saída por 1 milhão de tokens).
Nenhuma IA é chamada para "estimar" nada. Mesmo texto, mesmo modelo, mesmo resultado — sempre.

PRECISÃO: O QUE É EXATO E O QUE É ESTIMATIVA
Seja bem-vindo à parte honesta. A extensão embarca o tokenizer o200k_base:
• Modelos OpenAI (GPT-4o, GPT-4.1, GPT-5, GPT-5.4, GPT-5.5, o3): contagem EXATA.
• Anthropic (Claude), Google (Gemini), xAI (Grok) e DeepSeek: ESTIMATIVA calibrada — a contagem o200k_base é ajustada por um fator por família, porque esses provedores usam tokenizadores próprios. O número é próximo, não exato, e a interface sempre marca isso com "~".
Os preços vêm de uma tabela local com 26 modelos, conferida nas páginas oficiais de preços de cada provedor; a data da última conferência fica no próprio código. Preços mudam — trate o valor como uma referência muito boa, não como sua fatura.

PERMISSÃO
Uma só: "storage", para salvar as suas preferências (moeda, cotação do R$, modelo escolhido por site, total do dia) no seu próprio navegador. Nada é enviado para lugar nenhum.

GRÁTIS, SEM CADASTRO, SEM COTA. Código aberto: github.com/caioross/PromptMeter
```

---

## 🇺🇸 English (en)

### Name (*Name* field — en locale)

```
PromptMeter — Cost Meter
```

> 24 characters. Tradução do nome do `manifest.json` para o listing em inglês
> (o `name` do manifest permanece o de pt-BR — a Store aceita nome por idioma).

### Short description (limit 132)

```
Count tokens and see what each prompt costs in USD and BRL, live. 100% local, no AI. ChatGPT, Claude, Gemini, Perplexity.
```

> **121 characters** (limit 132). Verified on 2026-07-22.

### Description

```
Know what every prompt costs — before you send it.

PromptMeter shows a small live card above your prompt box with the token count and the cost, in USD and BRL, of what you are typing — and, once the answer is done, its estimated cost plus your running total for the day.

WHAT IT SHOWS
• Live prompt token count, on every keystroke.
• Input cost in US dollars and Brazilian reais (exchange rate configurable in Options).
• Estimated response cost and daily session total.
• The billed model, auto-detected — switchable in one click, remembered per site.

WHERE IT WORKS
• ChatGPT (chatgpt.com, chat.openai.com)
• Claude (claude.ai)
• Gemini (gemini.google.com)
• Perplexity (perplexity.ai)

100% LOCAL — NOTHING LEAVES YOUR BROWSER
No backend, no account, no sign-up, no analytics, no telemetry. The extension makes no network requests at all: it works offline. Your prompt text is read, tokenized and multiplied by the local price table entirely in browser memory, and is never transmitted, stored or logged.
Sensitive fields are ignored by design: passwords, e-mails, phone numbers, credit cards and OTP codes are never read.

DETERMINISTIC — NO AI
The math is just math, not a model's guess:
tokens × model price (input/output per 1 million tokens).
No AI is ever called to "estimate" anything. Same text, same model, same result — every time.

ACCURACY: WHAT IS EXACT AND WHAT IS AN ESTIMATE
Here is the honest part. The extension embeds the o200k_base tokenizer:
• OpenAI models (GPT-4o, GPT-4.1, GPT-5, GPT-5.4, GPT-5.5, o3): EXACT count.
• Anthropic (Claude), Google (Gemini), xAI (Grok) and DeepSeek: calibrated ESTIMATE — the o200k_base count is adjusted by a per-family factor, because those providers use their own tokenizers. The number is close, not exact, and the UI always flags it with "~".
Prices come from a local table of 26 models, checked against each provider's official pricing page; the date of the last check lives in the code itself. Prices change — treat the figure as a very good reference, not as your invoice.

PERMISSION
Exactly one: "storage", to keep your preferences (currency, BRL rate, per-site model choice, daily total) inside your own browser. Nothing is ever sent anywhere.

FREE, NO SIGN-UP, NO QUOTA. Open source: github.com/caioross/PromptMeter
```

---

## 🧾 Campos do formulário (comuns)

| Campo do Developer Console | Valor |
|---|---|
| **Category** | `Productivity` |
| **Language** (idioma padrão) | Português (Brasil) — `pt-BR`; listing adicional em `en` |
| **Screenshots** | **Obrigatório: 1 a 5 imagens de 1280×800** — sem ao menos uma, o envio não é aceito. Roteiro de captura: [`screenshots.md`](screenshots.md) |
| **Store icon** (128×128) | `PromptMeter_MVP_Sprint1/icons/icon128.png` (o mesmo do `manifest.json → icons`) |
| **Website / Homepage URL** | https://promptmeter-pi.vercel.app |
| **Support URL** | https://github.com/caioross/PromptMeter/issues |
| **Privacy policy URL** | https://github.com/caioross/PromptMeter/blob/main/docs/store/PRIVACY.md |

### Justificativa da permissão `storage`

> Campo *Permission justification → storage* (obrigatório; a extensão não pede nenhuma outra permissão, nem `host_permissions`).

**PT**

```
A extensão usa chrome.storage apenas para guardar, no navegador do próprio usuário, as preferências que fazem o cálculo funcionar entre sessões: moeda exibida (USD/BRL), cotação do real configurada pelo usuário, o modelo cobrado escolhido para cada site e o total gasto no dia. Nenhum desses dados é transmitido: a extensão não faz nenhuma requisição de rede e não possui servidor. Sem storage, o usuário teria de reconfigurar moeda, cotação e modelo a cada recarregamento de página.
```

**EN**

```
The extension uses chrome.storage solely to keep, inside the user's own browser, the preferences that make the calculation work across sessions: displayed currency (USD/BRL), the user-configured BRL exchange rate, the billed model chosen for each site, and the daily spending total. None of this data is ever transmitted: the extension makes no network requests and has no server. Without storage, the user would have to reconfigure currency, rate and model on every page reload.
```

### Justificativa de uso de código remoto

```
Não se aplica. A extensão não executa código remoto: todo o JavaScript (incluindo o tokenizer o200k_base) é empacotado no pacote enviado. Não há eval, nem scripts externos, nem CSP customizada.
```

### Declaração de práticas de privacidade (*Data usage*)

Marcar **nenhuma** categoria de dados coletados e confirmar as três declarações:

- ✅ Não vendemos nem transferimos dados de usuário a terceiros (fora dos casos de uso aprovados).
- ✅ Não usamos nem transferimos dados de usuário para propósitos alheios à funcionalidade única do item.
- ✅ Não usamos nem transferimos dados de usuário para determinar solvência ou conceder crédito.

Base: [`docs/store/PRIVACY.md`](PRIVACY.md).

---

## ✔️ Checklist antes de enviar

- [ ] Nome idêntico a `manifest.json → name` (`PromptMeter — Medidor de Custo`).
- [ ] Descrição curta ≤132 caracteres — recontar após qualquer edição.
- [ ] Número de modelos (26) e famílias conferem com `pricing.js`.
- [ ] Sites listados = os 4 do `manifest.json → content_scripts.matches`.
- [ ] A distinção exato (OpenAI) × estimativa (demais) está explícita nas duas línguas.
- [ ] **Screenshots capturados conforme [`screenshots.md`](screenshots.md)** — ao menos 1 (idealmente 5)
      em 1280×800, uma delas evidenciando o marcador `~` de estimativa, e **nenhum dado pessoal
      visível** (nome, e-mail, avatar, título de conversa). Sem imagem o formulário não é submetido.
- [ ] `docs/store/PRIVACY.md` publicado na URL declarada.
