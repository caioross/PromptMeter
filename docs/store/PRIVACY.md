# Política de Privacidade — PromptMeter

**Vigente desde:** 19 de julho de 2026 · **Versão da extensão:** 0.4.0

> 🇧🇷 Português abaixo · 🇺🇸 [English version below](#privacy-policy--promptmeter)

O PromptMeter é uma extensão do Chrome que conta tokens e calcula o custo dos seus
prompts em ChatGPT, Claude, Gemini e Perplexity. **Todo o processamento é 100% local
e determinístico — não há backend, não há IA, não há telemetria.**

## O que a extensão faz com os seus dados

**Nada sai do seu navegador.** Para calcular o custo, a extensão lê o texto que você
digita no campo de prompt e o processa **inteiramente na memória local** do navegador:
o texto é tokenizado (tokenizer `o200k_base` embarcado) e multiplicado por uma tabela
de preços local. Esse texto **nunca é transmitido, armazenado nem registrado** — some
da memória assim que a contagem é atualizada.

- **Nenhuma requisição de rede.** A extensão não faz `fetch`, WebSocket, beacon ou
  qualquer chamada externa. Ela funciona offline. (É um invariante verificado a cada
  build; ver o repositório.)
- **Nenhum dado coletado ou enviado.** Não há servidor, conta, cadastro, analytics
  nem telemetria.
- **Campos sensíveis são ignorados.** Senhas, e-mails, telefones, cartões e códigos OTP
  não são lidos (heurística por `type`, `autocomplete`, `name`/`id`/`aria-label`).
- **Contagem e custo são determinísticos.** Pura conta — nenhum modelo de IA é chamado
  para medir. A contagem OpenAI é exata (`o200k_base`); as demais famílias são
  estimativas calibradas por família, sempre sinalizadas na interface.

## Permissões

A extensão pede **uma única permissão: `storage`**. Ela é usada só para salvar suas
**preferências localmente** no seu navegador (moeda de exibição, cotação do R$, modelo
selecionado por site e o total da sessão do dia). Esses dados ficam apenas no seu
dispositivo e não são sincronizados por nós com nenhum servidor.

Não são pedidas permissões de rede, `host_permissions` amplos nem acesso ao histórico.

## Alterações nesta política

Mudanças serão publicadas neste arquivo versionado no repositório, com nova data de
vigência.

## Contato

Dúvidas ou pedidos sobre privacidade: abra uma issue em
<https://github.com/caioross/PromptMeter/issues>.

---

# Privacy Policy — PromptMeter

**Effective:** July 19, 2026 · **Extension version:** 0.4.0

PromptMeter is a Chrome extension that counts tokens and computes the cost of your
prompts on ChatGPT, Claude, Gemini and Perplexity. **All processing is 100% local and
deterministic — no backend, no AI, no telemetry.**

## What the extension does with your data

**Nothing leaves your browser.** To compute cost, the extension reads the text you type
into the prompt field and processes it **entirely in local browser memory**: the text is
tokenized (embedded `o200k_base` tokenizer) and multiplied by a local price table. That
text is **never transmitted, stored, or logged** — it is gone from memory as soon as the
count updates.

- **No network requests.** The extension makes no `fetch`, WebSocket, beacon, or any
  external call. It works offline. (This is an invariant verified on every build; see the
  repository.)
- **No data collected or sent.** There is no server, account, sign-up, analytics, or
  telemetry.
- **Sensitive fields are ignored.** Passwords, emails, phone numbers, cards, and OTP
  codes are not read (heuristics over `type`, `autocomplete`, `name`/`id`/`aria-label`).
- **Counting and cost are deterministic.** Pure arithmetic — no AI model is called to
  measure. OpenAI counting is exact (`o200k_base`); other families are per-family
  calibrated estimates, always flagged in the UI.

## Permissions

The extension requests **a single permission: `storage`**. It is used only to save your
**preferences locally** in your browser (display currency, BRL exchange rate, selected
model per site, and today's session total). This data stays on your device and is not
synced by us to any server.

No network permissions, broad `host_permissions`, or history access are requested.

## Changes to this policy

Any changes will be published in this versioned file in the repository, with a new
effective date.

## Contact

Privacy questions or requests: open an issue at
<https://github.com/caioross/PromptMeter/issues>.
