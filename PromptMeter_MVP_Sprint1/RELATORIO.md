# RELATÓRIO ULTRADETALHADO — PromptMeter MVP Sprint 1

Data: 2026-05-15
Escopo: análise completa do código da extensão `PromptMeter_MVP_Sprint1` (manifest V3) — `manifest.json`, `background.js`, `content.js`, `options.html`, `overlay.css` e diretório `icons/`.

> Este relatório foi escrito em duas passadas. A **Passada 1** lista os achados brutos. A **Passada 2** revisa, corrige e refina os achados, adiciona ataques que escaparam, e fecha com o plano executável de correção (que foi aplicado em seguida no código).

---

## 0. Resumo executivo

PromptMeter é uma extensão Chrome (MV3) que injeta um overlay flutuante embaixo de `<textarea>` / `contentEditable` para mostrar uma nota 0–10 e uma dica curta sobre o prompt que o usuário está digitando. A pontuação vem de um backend HTTP em `POST {backendURL}/analyze`. Há cota diária (free 30/dia), modo Premium (apenas flag), e silenciar por site.

**Estado real:** não funciona ponta‑a‑ponta. A extensão **depende de um backend que não existe no repositório**, a página de Opções **não executa o script inline** (violação direta da CSP padrão MV3 para páginas de extensão), e o `content.js` tem vários defeitos lógicos (off‑by‑one na cota, contagem antes do êxito da IA, ausência de `focusout`, ativação em campos de senha, etc.). Em sites que mais importam para o produto (ChatGPT, Claude, Gemini, Perplexity), o posicionamento e a captura de eventos quebram por shadow DOM, iframes cross‑origin e contêineres com `transform/overflow`.

Sem intervenção, o usuário final vê só o placeholder "—" e "Falha momentânea na IA. Tente novamente em instantes." — porque o `fetch` para `localhost:8787` falha. Em paralelo, o contador de cota é incrementado **mesmo quando a IA falha**, queimando o limite diário do free sem entregar valor.

Nota geral de prontidão para produção: **2/10**.

---

## 1. Inventário e propósito

| Arquivo | Linhas | Função |
|---|---|---|
| `manifest.json` | 36 | Declaração MV3, permissões, content script global, options page |
| `background.js` | 9 | Service worker — só semeia defaults no `onInstalled` |
| `content.js` | 113 | Detecta foco em campos prompt‑like, debounce 700ms, chama backend, renderiza overlay, controla cota e mute por host |
| `options.html` | 66 | UI de configuração + script **inline** que lê/grava `chrome.storage` |
| `overlay.css` | 13 | Estilo do overlay (cartão, barra, score, links) |
| `icons/*` | — | 16/32/128 PNG |

Backend esperado: `POST {backendURL}/analyze` com `{ text, site, lang }` → `{ score: number, tip: string }`. **Não está no repositório.**

---

## 2. Bugs e defeitos (Passada 1)

### 2.1 Críticos — quebram funcionalidade ou abrem brecha

**B1. Backend ausente.** `analyzeWithAI` faz `fetch("http://localhost:8787/analyze", ...)` sem fallback. Sem backend rodando, **toda chamada cai em `catch`** e o usuário vê "Falha momentânea na IA." perpetuamente. O MVP não tem caminho feliz.
- Arquivo: `content.js:70–80`.
- Risco: produto sempre quebrado.

**B2. Script inline em `options.html` é bloqueado pela CSP de MV3.** A CSP padrão de páginas de extensão MV3 é `script-src 'self'; object-src 'self'`. Scripts inline não são executados. As opções **não carregam nem salvam nada**. O `<input>` fica zerado e o botão "Salvar" não faz nada.
- Arquivo: `options.html:42–64`.
- Risco: feature de configuração completamente quebrada.

**B3. Overlay aparece em campos sensíveis (senha, email, tel).** O handler `focusin` aceita `INPUT` cujo `type` casa `text|search|email|url|password|tel`. Mostrar barra de "qualidade de prompt" em um `<input type=password>` é, no mínimo, alarmante; pior: o conteúdo é enviado ao backend.
- Arquivo: `content.js:103, 66`.
- Risco: privacidade e vazamento de credenciais para o backend.

**B4. Cota é incrementada antes da IA confirmar sucesso.** `incUsageOnce` roda dentro de `handleEvaluate` antes de `analyzeWithAI`. Se a IA falha (B1!), o usuário perde uma "carga" do dia mesmo sem nenhum retorno. Em modo limite atingido, a cota nem deveria ser consumida.
- Arquivo: `content.js:91–98`.

**B5. Off‑by‑one no cálculo de `limited`.** `limited: next >= dailyLimit` — `next` é o uso **depois** do incremento. Com `dailyLimit=30`, a 30ª avaliação retorna `limited=true` e a IA nunca é chamada na 30ª: o usuário paga a cota mas recebe a mensagem de limite.
- Arquivo: `content.js:27`.

**B6. Race condition no incremento de cota.** Padrão "read → modify → write" em `chrome.storage.local` sem lock. Dois `focusin`/`input` quase simultâneos (multi‑aba, ou foco rápido entre dois campos) podem ler o mesmo `dailyUsed`, gravar `dailyUsed+1` ambos: a cota fica subestimada (favorável ao usuário, mas ainda assim defeito). Pior em multi‑tab no mesmo dia.
- Arquivo: `content.js:17–28`.

**B7. Sem `focusout` / sem destruição do overlay.** Uma vez focado um campo, o overlay nunca some — fica visível mesmo depois do usuário clicar fora, trocar de aba ou mandar o prompt. Polui a página.
- Arquivo: `content.js` (ausente).

**B8. Não funciona em Shadow DOM.** `document.addEventListener("focusin", ...)` recebe eventos shadow apenas quando `composed=true`, mas o `e.target` é o **host**, não o elemento real dentro do shadow. ChatGPT, Claude (claude.ai) e várias UIs modernas isolam campos em shadow root: o elemento real nunca é detectado, ou é detectado como "host" e `isPromptLike` falha.
- Arquivo: `content.js:101`.

**B9. Não funciona em iframes cross‑origin (sem `all_frames: true`).** Manifest não tem `"all_frames": true` nem `"match_about_blank"`. Editores embutidos via iframe (alguns playgrounds, sandboxes, builders) ficam sem cobertura.
- Arquivo: `manifest.json`.

### 2.2 Sérios — afetam UX/confiabilidade significativamente

**B10. `isPromptLike` rejeita `<input>` mesmo quando o `focusin` os aceitou.** A função só retorna `true` para `TEXTAREA` ou `contentEditable`. Logo, qualquer `<input>` aceito em `focusin` cai em `return` silencioso. Inconsistência de contrato.
- Arquivo: `content.js:29, 104`.

**B11. Hash inadequado para deduplicação.** `quickHash` é djb2/jenkins de 32 bits sobre `text.slice(0, 800)`. Colide muito; pior: o prefixo igual de 800 chars já é "duplicado" mesmo se o texto cresceu para algo distinto. Resultado prático: usuário expande o prompt e a cota não conta a nova avaliação (a favor dele, mas semanticamente errado).
- Arquivo: `content.js:4, 91`.

**B12. Posicionamento do overlay vai para o lugar errado em sites reais.** Usa `position: absolute` no `documentElement` com `window.scrollY + rect.bottom`. Em contêineres com `transform`, `position: fixed`, `overflow: hidden`, ou em modais (todas as UIs de IA atuais), o overlay aparece deslocado, atrás de outro elemento, ou completamente fora do viewport.
- Arquivo: `content.js:58–63, 1` (`.pm-wrap{position:absolute}` em `overlay.css:1`).

**B13. CSP da página pode bloquear o overlay quando montado via `appendChild(document.documentElement)`.** Não bloqueia o JS do content script (executa em mundo isolado), mas `color-mix(in oklab, canvas …)` no `overlay.css` requer `<canvas>` keyword suporte. Em older Chromium pode falhar; mais grave, alguns sites com `iframe sandbox` mostram o painel zerado.
- Arquivo: `overlay.css:2`.

**B14. `mutedSites` mistura `storage.local` e `storage.sync`.** `mutedSites` está em `local`; `premiumEnabled/backendURL/dailyLimit` em `sync`. Em multi‑dispositivos, mute por host não sincroniza. Razoável, mas incoerente com o resto e não documentado.
- Arquivo: `content.js:8`, `options.html:44`.

**B15. `lastText` é global único.** Se o usuário tem dois campos abertos (rare, mas possível), a verificação `text === lastText` confunde os contextos e suprime avaliações legítimas.
- Arquivo: `content.js:2, 90`.

**B16. Sem feedback visual de loading nem de erro persistente.** Não há spinner, sem "carregando", sem ARIA `aria-busy`. Score só atualiza quando responde.

**B17. Sem destruição/`disconnect` ao trocar de SPA route.** Em SPAs (todas as alvos de IA), trocar de página não dispara `unload` e o `wrap` pode ficar órfão.

**B18. Linha 84 — `Math.round(score/10*100)` em float que pode vir como string.** Se o backend manda `"7.5"` em vez de `7.5`, `(Number(score) || 0)/10*100` resolve, mas `Number.isFinite(score)` é `false` e o `scoreEl.textContent` mostra "—" enquanto a barra mostra 75%. Discrepância visual.
- Arquivo: `content.js:84–85`.

**B19. `tip` longo é truncado pelo CSS de forma estranha (`white-space:nowrap; max-height:2.6em`).** Conflito de regras: `nowrap` força uma linha; `max-height: 2.6em` viraria 2 linhas. Resultado: corta com ellipsis em uma linha só, perdendo até 142 chars.
- Arquivo: `overlay.css:5`.

**B20. Hash não diferencia idiomas/sites.** Dois prompts iguais em sites diferentes contam como 1 só. Aceitável, mas merece nota.

### 2.3 Moderados — qualidade, manutenção e segurança defensiva

**B21. Permissão `tabs` declarada e não usada.** Aumenta a fricção na Web Store e o "permission warning" sem motivo.
- Arquivo: `manifest.json:8`.

**B22. `host_permissions: <all_urls>`.** Justificável (queremos rodar em qualquer site de IA), mas amplo. Em revisão de loja, exige justificativa explícita ou uma lista enxuta.

**B23. Sem `action` no manifest.** Sem ícone de barra de ferramentas, o único acesso a Opções é via `chrome://extensions`. UX ruim e descobribilidade zero.

**B24. Sem i18n (`chrome.i18n`).** Strings em PT-BR hard‑coded. Lançar em outro idioma exige patch de código.

**B25. Sem validação de `backendURL`.** Aceita qualquer string. Se o usuário cola algo sem `http(s)://`, fetch falha sem mensagem clara.

**B26. Premium é flag local, trivialmente burlável.** Aceitável para MVP mas precisa ficar claro no roadmap e no relatório.

**B27. Sem cabeçalho/identificador no request ao backend.** Não há `X-Extension-Version`, `Authorization`, nada. Backend não consegue distinguir cliente nem versionar protocolo.

**B28. `analyzeWithAI` envia o texto **inteiro** ao backend.** Sem limite, prompts gigantes (50 KB+) sobem por inteiro e a cada keystroke (com debounce de 700ms). Custo enorme e risco de vazamento.

**B29. Logs ausentes (e propositais).** Não há `console.warn` para erros. Não há flag de debug. Reproduzir bugs em campo será doloroso.

**B30. Acessibilidade (a11y) zero.** Sem `role`, `aria-label`, sem `aria-live` para mudanças de score, sem `tabindex` nos links "silenciar/reativar".

**B31. Z‑index 2147483000.** Pode passar por cima de modais críticos do site (avisos de privacidade, autenticação). Razoável, mas vale ser polido (recuar quando outro modal estiver aberto).

**B32. `incUsageOnce` releitura inútil.** Faz `chrome.storage.sync.get(['dailyLimit'])` no fim, mas o limite já foi lido no início via `getState`. Roundtrip desnecessário.

**B33. `chrome.runtime.onInstalled` não cobre o caso "instalado antes do v0.2.0 sem `premiumEnabled`".** Como há defaults dentro de `getState`, o impacto é nulo, mas a intenção do código se perde.

**B34. `options.html` "Zerar uso de hoje" não limpa `lastHashes` se a CSP estivesse OK** — bug que dorme até as opções funcionarem. Verifica `dailyDate` mas não reseta `mutedSites` (intencional?). Sem documentação.

**B35. Sem teste automatizado de nada.** Nenhum framework, nenhum snapshot, nenhum mock.

**B36. Sem README, LICENSE, CHANGELOG, versionamento semântico explícito.** Manifest declara `0.2.0` mas sem nota de release.

**B37. CSS usa `canvas`/`CanvasText` (system colors).** Bom para dark mode automático, mas mistura com `rgba(0,0,0,.08)` em `box-shadow` — em dark, a sombra preta some. Pequeno glitch visual.

**B38. `pm-fill` gradiente fixo vermelho‑amarelo‑verde** sugere que score baixo é "ruim". OK, mas merece tooltip explicando.

**B39. Sem `chrome.storage.onChanged` listener.** Alterar opções (limite, premium) em outra aba não reflete em abas abertas até o próximo `getState` (sempre relido — então funciona, mas a UI mostra "0/0" até o próximo evento de input).

**B40. `incUsageOnce` ignora avaliações negativas/erradas.** Não há mecanismo de "reembolso" de cota quando falha.

---

## 3. Lacunas e itens "feitos pela metade"

- **G1. Backend `/analyze`** — referenciado mas inexistente. Sem ele, **nada funciona**. Precisa ou (a) ser entregue mínimo, ou (b) ser substituído por análise local heurística como fallback/padrão.
- **G2. Página de Opções** — UI desenhada, mas o JS está inline (não roda em MV3). Falta extrair para `options.js`.
- **G3. Premium** — apenas um checkbox local. Stripe/billing previsto para "Sprint 2" mas não há sequer um ponto de extensão pronto (URL, sessão, JWT).
- **G4. Internacionalização** — strings em PT‑BR, mas nada de `_locales/`.
- **G5. Eventos de envio do prompt** — não há detecção de "prompt enviado" (botão Enviar/Enter): o overlay continua aparecendo após o envio.
- **G6. Telemetria** — nenhuma (intencional? não documentado).
- **G7. Tratamento de cota** — quando `limited`, score fica `null` e a barra zerada, sem CTA. Falta link "Ativar Premium".
- **G8. Definição do contrato `{score, tip}`** — implícito. Precisa schema + validação (`typeof score === 'number'`, `tip.length <= 142`).
- **G9. README/Setup** — não há instruções para subir o backend nem para carregar a extensão "unpacked".
- **G10. Build pipeline** — não existe (não obrigatório para MVP, mas vale registrar).

---

## 4. Caminho para o "state of the art"

O alvo razoável para uma v1 polida (não "state of the art mundial", mas profissional) é:

1. **Análise local sempre disponível.** Heurística determinística (length, presença de instruções claras, exemplos, contexto, especificidade, gramática) entrega um score útil em ms, off‑line, gratuito e privado. Backend vira opcional para "análise melhor com IA".
2. **Funciona em ChatGPT, Claude, Gemini, Perplexity, Mistral Chat.** Lista de seletores conhecidos por host + fallback genérico. Suporte explícito a shadow DOM via `attachShadow` polling/observer.
3. **`position: fixed` ancorado no viewport com seta**, em vez de `absolute` que persegue o layout interno. Reposiciona em `scroll`/`resize`/`visualViewport.onresize`. Some quando o campo sai de view.
4. **Estado claro:** loading, ok, erro, limite, mutado. Cada um com cor/ícone/`aria-live`.
5. **Cota correta:** cobrar **depois** de uma avaliação de sucesso, deduplicar por hash forte (SHA‑256 dos primeiros 4 KB do texto normalizado), e reembolsar em erro do backend.
6. **Anti‑abuso de privacidade:** nunca tocar `password/email/tel/credit card`; respeitar `autocomplete="off"` quando indicar campos sensíveis; configuração "lista negra de hosts" automática para bancos.
7. **Opções funcionais:** script externo, validação de URL, teste de conexão com backend, botão "limpar tudo".
8. **i18n PT/EN.** `_locales/pt_BR/messages.json` e `_locales/en/messages.json` mínimos.
9. **Telemetria opt‑in** (zero por padrão).
10. **Tests:** ao menos um harness de smoke (carrega manifest, monta DOM fake, verifica heurística).
11. **Empacotamento e ícone de toolbar (`action`).**

---

## 5. Passada 2 — Revisão, achados adicionais e refinamento

Releitura do código depois do diagnóstico inicial. Achados novos e correções de imprecisões da passada 1:

**R1.** A linha `card.querySelector(".pm-toggle").addEventListener("click", ...)` adiciona um listener a cada chamada de `ensureOverlay` se eu **não** verificasse `if (!wrap)`. Verifiquei: o `if (!wrap)` está presente, o listener é registrado uma só vez. **Não é bug.**

**R2.** A função `ensureOverlay(target, compact)` é chamada com `compact = el.offsetHeight<80 || el.offsetWidth<300`. Útil. Mas como o `wrap` é único na página, alternar entre um campo pequeno e um grande deixa o modo "compact" preso ao último estado. Aceitável, mas vale notar.

**R3.** `positionOverlay` lê `window.scrollY` + `getBoundingClientRect().bottom`. Em sites com **CSS `zoom`** (raro), o rect mente. Não é prioridade, mas registrar.

**R4.** No `focusin`, em campos mutados, o código faz `if (wrap) wrap.classList.add("pm-hidden")`. Bom — esconde se já existia. Mas se nunca foi montado e o host está mutado, OK. Verificado.

**R5.** `lastHashes: [hash, ...lastHashes].slice(0,50)` mantém apenas 50 hashes/dia para deduplicação. Free com `dailyLimit=30`: 50 é suficiente. Para limites maiores (premium futuro), pode ser pequeno. Vou subir para 200 e usar `Set` lógico via array.

**R6.** No `incUsageOnce`, se `local.dailyDate !== dkey`, faz reset e segue. O reset apaga `lastHashes`. **Mas faz isso ANTES de checar premium.** Para premium, o reset diário também ocorre — mas como premium não incrementa nem usa `lastHashes`, é inofensivo. Bom.

**R7.** `Number.isFinite(s.dailyLimit)` em `background.js`: se a chave nunca foi setada, `s.dailyLimit` é `undefined`, `isFinite(undefined)` é `false`, então seta default 30. Correto. Não é bug.

**R8.** **Achado novo:** `options.html` chama `load()` no fim do `<script>` inline. Quando movermos para `options.js`, precisamos manter a chamada — não esquecer.

**R9.** **Achado novo (relevante):** o overlay é injetado em `document.documentElement` — em **alguns sites** o `<html>` tem `overflow: hidden` global; o `position:absolute` com top calculado pelo `window.scrollY` pode acabar fora da viewport. `position: fixed` calculado contra o viewport é mais robusto. **Migrar para `fixed`.**

**R10.** **Achado novo:** o handler `["input","keyup","paste"]` usa `e.target !== activeTarget`. Mas `paste` em contentEditable pode ter `e.target` igual a um filho. Usar `e.target === activeTarget || activeTarget.contains(e.target)` é mais seguro.

**R11.** **Achado novo:** `chrome.storage.sync` tem quota baixa (8KB total, 100/s, 1800/dia). Não estamos nem perto, mas usar `sync` para `dailyLimit` numérico é absolutamente OK; para `backendURL` também. **Sem problema concreto, só registro.**

**R12.** **Achado novo:** o `manifest.json` declara content_script em `run_at: document_idle`. Em SPAs com client navigation, o content script roda **uma vez na navegação inicial** e fica vivo. Bom. Mas a página pode ter "carregado" os textareas antes do `document_idle` em casos raros e nosso `focusin` é em `document`, então estamos cobertos. **Sem ação.**

**R13.** **Achado novo:** `quickHash` deixa `i` e `chr` como variáveis globais (sem `var/let/const` em `chr`!). Bug menor: `let i,chr;` está declarado **dentro** da função — relendo... `function quickHash(s){let h=0,i,chr;...}`. Sim, `let` cobre `i` e `chr`. **Não é bug.**

**R14.** **Reforço de B3:** mais perigoso do que pensei. Em formulários de banco/login, `input[type=text]` é usado para nome, mas também para "código de segurança", "CPF", "CVV (raramente, mas existe)". A heurística "comprimento >= 32 ou multiline" não pega esses por causa de B10 (input sempre rejeitado), mas isso é coincidência feliz, não desenho intencional. Vou ser explícito: não ativar para `type` que não seja `text|search`, e respeitar `autocomplete` que contenha `password|cc-|otp|one-time-code|new-password|current-password`.

**R15.** **Achado novo (a11y/UX):** após avaliar, o tip aparece em uma linha truncada (B19). Em monitor pequeno fica ilegível. Migrar para `white-space: normal; max-height: 3.6em; -webkit-line-clamp: 3` ou similar.

**R16.** **Reforço de B12:** em **ChatGPT** o textarea está em um contêiner com `position: sticky` no rodapé. Posicionar abaixo do textarea no viewport coloca o overlay fora da tela. Solução: posicionar **acima** quando o campo está nos últimos 200 px do viewport.

**R17.** **Achado novo:** quando o usuário deixa o campo digitando, o `setTimeout(debTimer)` continua agendado. Se o foco já mudou para outro elemento, o callback dispara `handleEvaluate(activeTarget)` no antigo. Precisa cancelar `debTimer` em `focusout`.

**R18.** **Achado novo (segurança):** sem `connect-src` restrito, qualquer `backendURL` é aceito. Vamos manter a permissão `<all_urls>` (necessária para content script), mas validar `https?://` no options.

**R19.** **Achado novo:** a mensagem de erro hoje é "Falha momentânea na IA. Tente novamente em instantes." — não diferencia "backend não respondeu" de "limite atingido" de "erro de rede". Precisamos de três mensagens distintas e código de erro.

**R20.** **Achado novo:** quando o limite é atingido, *re-clicar* outro campo aparece com cota = limite e score zerado. Sem CTA. Vamos adicionar um link "Saiba mais" → abre options.html.

---

## 6. Plano de correção (executado em seguida)

Numerado para rastreamento.

### 6.1 Manifest
- [P1] Remover permissão `tabs` (não usada).
- [P2] Adicionar `"action": { "default_title": "PromptMeter", "default_icon": {...} }` com click → abre `options.html`.
- [P3] Adicionar `"all_frames": true` no content_script.
- [P4] Manter `<all_urls>` (necessário) e documentar no README.
- [P5] Adicionar `"web_accessible_resources"` se precisar (não preciso por enquanto).
- [P6] Bumpar versão para `0.3.0`.

### 6.2 background.js
- [P7] Adicionar listener `chrome.action.onClicked` → abre `options.html` (caso default_popup não esteja definido — usar openOptionsPage para coerência).
- [P8] Adicionar handler `chrome.runtime.onMessage` para reset de cota e ping de saúde (futuro backend).

### 6.3 content.js (reescrita controlada)
- [P9] **Skiplist de campos sensíveis:** descartar `type` em `password|email|tel|number|date|datetime-local|month|week|search`; respeitar `autocomplete` proibido (cc-, password, otp, one-time-code, new-password, current-password); descartar se `name`/`id`/`aria-label` contém regex `senha|password|cvv|cartao|card|otp`. Aceitar apenas `text` em `<input>` **e** somente se `offsetWidth >= 320` E `offsetHeight >= 28` (sinal de campo de prompt e não de busca).
- [P10] **Aceitar `<textarea>` e `contentEditable=true`** sem restrição de tamanho mínimo, exceto descartar `[role="search"]` e `[contenteditable=plaintext-only]` curtos.
- [P11] **Suporte Shadow DOM:** rastrear `e.composedPath()[0]` no `focusin` para obter o elemento real dentro de shadow root; usar `composedPath` em todos os event handlers.
- [P12] **`focusout` cancela debounce e esconde o overlay com pm-hidden** (não destrói; reaproveita).
- [P13] **Cota correta:** mover incremento para **depois** do sucesso da avaliação (local ou backend). Em limite atingido, **não** consome cota e mostra CTA. Manter dedup por hash forte (FNV-1a 32→hex sobre o texto normalizado completo, ou subtle.crypto.SHA-256 dos primeiros 4 KB).
- [P14] **Off‑by‑one corrigido:** computar `wouldBeLimited = current >= limit` **antes** de incrementar.
- [P15] **Race-safe:** usar uma fila/serializador local (Promise chain) para acesso à `chrome.storage.local` no incUsage. Não resolve cross-tab, mas reduz drasticamente. Para cross-tab, usar `chrome.storage.local.onChanged` para refletir mudanças.
- [P16] **Análise local heurística (default):** sempre disponível. Score 0–10 baseado em comprimento útil, presença de instrução clara (verbos imperativos), contexto, exemplos (`for example`, "ex:", "p. ex."), restrições explícitas, especificidade (números, formatos, audiência), e penalidades por ambiguidade ("isso", "aquilo", "coisa"), pedidos contraditórios, e prompts muito curtos (<15 chars úteis) ou muito longos sem estrutura (>4000 chars sem quebras).
- [P17] **Backend opcional:** se `backendURL` apontar para algo válido (`/analyze`) e responder em <2 s, usar `score`/`tip` do backend (com fallback automático para heurística em falha/timeout/cota). Cabeçalhos `X-PM-Version`, `X-PM-Lang`.
- [P18] **Truncar texto enviado ao backend** a 4 KB (configurável). Texto local usa até 8 KB para heurística.
- [P19] **Mensagens de erro distintas:** `network`, `timeout`, `server`, `limit`, `muted`. UI ganha cores/ícones e `aria-live="polite"`.
- [P20] **Overlay em `position: fixed`** com lógica "abaixo, se não couber acima".
- [P21] **i18n:** strings em `_locales/pt_BR/messages.json` e `_locales/en/messages.json`. Usar `chrome.i18n.getMessage`.
- [P22] **a11y:** `role="status"`, `aria-live="polite"`, `aria-label` no botão silenciar, `tabindex="0"`, foco visível, `Esc` esconde.
- [P23] **Detectar envio (botão Enviar/`Enter` sem `Shift`)** e esconder com transição.
- [P24] **`MutationObserver` light** opcional para SPA route change (detecta mudança de `<title>` ou de path em `history.pushState`) e limpa estado.
- [P25] **Logs de debug** controlados por `localStorage.PM_DEBUG=1`.

### 6.4 options.html → options.js
- [P26] Extrair script para `options.js`; HTML chama `<script src="options.js"></script>`.
- [P27] Adicionar validação de URL (regex http/https), botão "Testar conexão" (pings `{backendURL}/health`), botão "Limpar tudo".
- [P28] Mostrar versão da extensão.
- [P29] Strings via i18n (mantemos PT‑BR default).

### 6.5 overlay.css
- [P30] `position: fixed`, sombra que sobrevive em dark, `tip` em 2–3 linhas com `-webkit-line-clamp`, estados `pm-state-loading`, `pm-state-error`, `pm-state-limit`.
- [P31] Suporte a redução de movimento (`prefers-reduced-motion`).

### 6.6 Documentação e empacotamento
- [P32] Criar `README.md` mínimo com: como instalar (unpacked), o que faz, privacidade, roadmap, contrato do backend.
- [P33] Atualizar versão no manifest.

### 6.7 Verificação
- [P34] Reanalisar todos os arquivos após correções.
- [P35] Atualizar este relatório com "estado pós-correção".

---

## 7. Critérios de "feito"

- Carrega como unpacked sem erros no `chrome://extensions`.
- Em uma página simples com `<textarea>`, ao digitar 20+ chars: aparece o overlay, mostra score >0, cota atualiza, mensagem em PT-BR.
- Sem backend: tudo continua funcionando via heurística local. Mensagem visível: "Análise local — backend off-line" (sutil).
- Em `<input type=password>`: overlay nunca aparece.
- Em ChatGPT/Claude/Gemini: overlay aparece corretamente embaixo do textarea principal; reposiciona em scroll/resize; some no `focusout`.
- Cota: respeita limit; ao atingir, **não** queima novas cotas; mostra CTA premium.
- Página de Opções abre, salva, mostra uso atual, valida URL, "Testar conexão" responde.
- Sem erros no DevTools (ext context e content script).

---

## 8. Riscos remanescentes

- Sites com isolamento agressivo (sandbox iframe) podem continuar sem cobertura. Aceitável.
- Heurística local é determinística, não cognitiva: não detecta "promessa de jailbreak", não corrige gramática. É bom o suficiente para um medidor "0–10 + dica".
- Premium ainda é flag local — anotado para Sprint 2 (Stripe).
- Cross-tab race ainda existe (apenas mitigada). Em fluxo real é improvável (>2 abas digitando no mesmo segundo).

---

*Fim da passada 2.*

---

## 9. Estado pós-correção (verificação)

Todos os arquivos foram editados/criados nesta sessão. Validação:

- `node --check` em `content.js`, `background.js`, `options.js` → **ALL OK** (sintaxe válida).
- `JSON.parse` em `manifest.json`, `_locales/pt_BR/messages.json`, `_locales/en/messages.json` → **OK**.

### 9.1 Mudanças por arquivo

| Arquivo | Status | Resumo |
|---|---|---|
| `manifest.json` | **reescrito** | v0.3.0; `permissions: ["storage"]` (removido `tabs`); `action` com ícone (abre Opções via background); `all_frames: true`; `default_locale: "pt_BR"` |
| `background.js` | **reescrito** | Defaults completos (`backendURL=""` por padrão → modo local); `chrome.action.onClicked` → `openOptionsPage`; mensageria `ping`, `reset_today`, `test_backend` (com timeout/AbortController) |
| `content.js` | **reescrito** | IIFE estrito; skiplist de campos sensíveis (password/email/tel/cc-/otp/forms de login); detecção via `composedPath` (Shadow DOM); `position: fixed` com fallback "acima quando não cabe abaixo"; `focusout` com grace de 120ms; debounce cancelado em blur; storage serializado (Promise queue); `checkQuota` + `consumeQuota` separados → **off-by-one corrigido** e **cota não é mais queimada em erro/limite**; hash FNV-1a duplo (head+tail+len) — robusto contra colisões; estados visuais `loading/ok/limit/empty/error` + `aria-live`; route polling para SPAs; reage a `storage.onChanged`; logs sob `localStorage.PM_DEBUG=1` |
| `content.js` (heurística) | **novo** | Análise local 0–10 com 12 sinais: comprimento, estrutura, verbo imperativo, papel/contexto, exemplos, formato, especificidade, audiência, ambiguidade, pergunta-curta, CAPS, repetição. Dica priorizada pelo maior gap detectado. PT/EN |
| `content.js` (backend) | **refatorado** | Opcional; só envia se URL https?://; truncamento a 4 KB; timeout 2,5 s; cabeçalhos `X-PM-Version`/`X-PM-Lang`; **fallback automático** para heurística local |
| `options.html` | **reescrito** | UI atualizada com versão, idioma, botão "Testar conexão", "Limpar tudo"; tema claro/escuro automático; sem script inline |
| `options.js` | **novo** | Lógica externa (CSP MV3 safe); validação de URL; teste de backend via mensagem para service worker; usage diário |
| `overlay.css` | **reescrito** | `position: fixed`; clamp de 3 linhas no tip; estados visuais; foco visível; `prefers-reduced-motion` |
| `_locales/pt_BR/messages.json` | **novo** | i18n PT-BR |
| `_locales/en/messages.json` | **novo** | i18n EN |
| `README.md` | **novo** | Instalação, contrato do backend, privacidade, limitações, debug, roadmap |

### 9.2 Bugs do relatório → status

| ID | Severidade | Status |
|---|---|---|
| B1 backend ausente | crítico | **resolvido** via heurística local default; backend agora opcional |
| B2 script inline (CSP MV3) | crítico | **resolvido** — `options.js` separado |
| B3 overlay em senha/email | crítico | **resolvido** — skiplist por `type`, `autocomplete`, `name/id/aria-label`, e forms com password |
| B4 cota antes do êxito | crítico | **resolvido** — `consumeQuota` só após avaliação bem-sucedida |
| B5 off-by-one em limite | crítico | **resolvido** — comparação `dailyUsed >= limit` antes de incrementar |
| B6 race storage | crítico | **mitigado** — fila Promise + `storage.onChanged` para refletir mudanças |
| B7 sem `focusout` | crítico | **resolvido** — esconder com grace de 120ms |
| B8 Shadow DOM | crítico | **resolvido** — `getRealTarget` via `composedPath` |
| B9 sem `all_frames` | crítico | **resolvido** — manifest atualizado |
| B10 inconsistência input | sério | **resolvido** — gate único `isPromptLike` + dimensões mínimas |
| B11 hash fraco | sério | **resolvido** — FNV-1a head+tail+len em hex |
| B12 posicionamento | sério | **resolvido** — `fixed` + lógica "acima se não couber" |
| B13 CSS antigo | sério | mantido; `color-mix` é amplo o suficiente; box-shadow ajustada |
| B14 mute em local | sério | mantido por design; documentado em README |
| B15 `lastText` global | sério | **resolvido** — `WeakMap` por target |
| B16 sem loading | sério | **resolvido** — `pm-state-loading` com shimmer |
| B17 SPA route | sério | **resolvido** — polling 800ms de `location.href` |
| B18 score string | sério | **resolvido** — `Number(score)` + validação `isFinite` |
| B19 tip truncado | sério | **resolvido** — clamp 3 linhas |
| B20 hash sem site | moderado | aceito; documentado |
| B21 `tabs` desnecessária | moderado | **resolvido** — removida |
| B22 `<all_urls>` | moderado | mantido; documentado |
| B23 sem `action` | moderado | **resolvido** |
| B24 sem i18n | moderado | **resolvido** (PT-BR, EN) |
| B25 backendURL sem validação | moderado | **resolvido** — validado em options e em runtime |
| B26 premium fake | moderado | mantido para Sprint 2; documentado |
| B27 sem headers de versão | moderado | **resolvido** — `X-PM-Version`, `X-PM-Lang` |
| B28 envia texto inteiro | moderado | **resolvido** — truncado a 4 KB |
| B29 sem logs | moderado | **resolvido** — `PM_DEBUG=1` |
| B30 a11y zero | moderado | **resolvido** — `role`, `aria-live`, `tabindex`, foco visível, Esc |
| B31 z-index | moderado | mantido (2147483000) |
| B32 releitura inútil | moderado | **resolvido** — leitura única |
| B33 onInstalled fraco | moderado | **resolvido** — patch completo |
| B34 reset sem hashes | moderado | **resolvido** — `reset_today` limpa `dailyUsed` + `lastHashes` + `dailyDate` |
| B35 sem testes | moderado | aceito p/ MVP; pendente |
| B36 sem README/CHANGELOG | moderado | **resolvido** (README) |
| B37 CSS dark sombra | moderado | **resolvido** — sombra com camada interna |
| B38 gradiente sem contexto | moderado | aceito; cor é universalmente legível |
| B39 sem `storage.onChanged` | moderado | **resolvido** |
| B40 sem reembolso de cota | moderado | **resolvido** por design — só consome em sucesso |

### 9.3 Achados extras da passada 2 → status

R9 (`position: absolute` → fixed) **resolvido**.
R10 (`composedPath` em todos os handlers) **resolvido**.
R14 (skiplist explícita) **resolvido**.
R15 (multi-linha) **resolvido**.
R16 (posicionar acima quando ChatGPT) **resolvido**.
R17 (cancelar debounce em blur) **resolvido**.
R18 (validação de URL) **resolvido**.
R19 (mensagens de erro distintas) **parcial** — estados `loading/limit/error/empty/ok` em UI; backend devolve códigos `no_backend/timeout/http_*/bad_payload/network` (logados em debug). Não exibimos no card por design (UX simples), mas o suficiente para diagnóstico.
R20 (CTA Premium) **parcial** — texto da dica menciona Premium; falta link clicável → ítem para Sprint 2.

### 9.4 Como aceitar (passos manuais sugeridos)

1. Abrir `chrome://extensions` → "Carregar sem compactação" → apontar para a pasta.
2. Verificar que não há aviso/erro no card da extensão.
3. Abrir uma página com `<textarea>` qualquer (ex.: `https://duckduckgo.com/`? Não — usar um campo grande; teste com `https://chatgpt.com/`, `https://claude.ai/`, ou um pad simples).
4. Digitar "ola" → score baixo, dica curta. Digitar prompt completo com verbo, contexto, formato, exemplo → score alto.
5. Abrir `chrome://extensions` → clicar no ícone do PromptMeter → abre Opções. Salvar com URL inválida → mensagem vermelha. Salvar vazio → OK (modo local).
6. Em `<input type=password>` → overlay nunca aparece.
7. Em um site silenciado → overlay some; reativar restaura.
8. Atingir o limite (com `dailyLimit=2` por exemplo) → após 2 prompts distintos, mostra "Limite diário atingido", **sem queimar mais cota**.

### 9.5 Pendências / Sprint 2

- Backend real (Node/Express ou FastAPI) com `/analyze` e `/health` — fora do escopo da extensão.
- Stripe + JWT para Premium real.
- Detecção do envio do prompt (Enter/botão) para hide com animação.
- Suíte de testes (vitest + jsdom) cobrindo `localAnalyze`, `strongHash`, `isPromptLike`, `checkQuota`/`consumeQuota`.
- Telemetria opt-in.

*Fim do relatório.*

