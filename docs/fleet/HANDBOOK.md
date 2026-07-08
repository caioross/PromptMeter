# 📖 HANDBOOK da Frota — PromptMeter

> Versão 1.0 · 2026-07-07 · **A lei das rotinas autônomas deste repositório.**
> Toda rotina agendada (Curador, Resolvedor, PR Doctor) obedece a este documento.
> Receitas operacionais: skill `.claude/skills/pm-fleet-ops/` (local, não versionada — `.claude/` está no `.gitignore` por decisão do dono).

---

## §1 — Missão e ritmo

O PromptMeter é um **projeto satélite**: divide tempo e tokens com o SkillDepot (principal), o CodeRacer, o NostalgiaGPT e outros. A frota é **calma e objetiva**:

| Rotina | Horário | Função em uma linha |
|---|---|---|
| **Curador** | diário ~09h30 | Higiene do backlog, ≤2 issues excelentes/dia com chapéu temático; domingo publica o [Plano] no Diário |
| **Resolvedor** | diário ~15h30 | Resolve **1 issue** ponta a ponta em worktree, passa o gate, abre PR |
| **PR Doctor** | diário ~20h50 | Revisa, repara, faz quórum quando preciso e mergeia ≤2 PRs; limpa worktrees |

Regra de ouro: **rodada curta, entrega pequena e bem-feita.** Se não der para fazer BEM na rodada, não faça — registre e encerre. Silêncio = saúde.

**GitHub é o centro**: issues (trabalho), PRs (mudança), Diário de Bordo (memória). Este repo NÃO tem Discussions — toda comunicação vive em issues e PRs.

## §2 — O produto (contexto mínimo)

Extensão Chrome **MV3, zero-build, 100% local**: conta tokens (o200k_base embarcado) e calcula o custo em USD/BRL de prompts e respostas em ChatGPT, Claude, Gemini e Perplexity. Sem backend, sem IA, sem rede. v0.4.0, ainda NÃO publicada na Chrome Web Store.

- `PromptMeter_MVP_Sprint1/` — a extensão inteira (manifest, tokenizer, pricing, models, content, background, options, `_locales`)
- `window.PMTokenizer` (tokenizer.js) · `window.PM_PRICING` (pricing.js) · `window.PM_MODELS` (models.js) — nesta ordem de carga
- `scripts/gate.mjs` — gate zero-dependências · `.github/workflows/gate.yml` — CI

### 🔒 Áreas sagradas (mudar = núcleo §7.1)

1. **100% local** — NENHUMA chamada de rede na extensão (fetch/WebSocket/beacon/telemetria). É a promessa pública do produto. O gate falha se detectar.
2. **Permissão única `storage`** — o manifest não ganha permissão, `host_permissions` nem CSP custom sem o dono.
3. **Zero-build** — sem bundler, npm ou dependência externa. `tokenizer.js` é gerado/minificado: nunca editar à mão.
4. **Exatidão honesta** — OpenAI é contagem exata; demais famílias são estimativa via `tokFactor` e a UI deixa isso visível. Preço só muda com fonte oficial citada (§10).

## §3 — Labels (taxonomia oficial)

- **Prioridade (exatamente 1 por issue):** `P0` (crítico) · `P1` (alta) · `P2` (média) · `P3` (baixa)
- **Área (≥1 por issue):** `area:tokenizer` (contagem, tokFactor) · `area:pricing` (tabela e custo) · `area:overlay` (card, posicionamento, estados) · `area:sites` (seletores/detecção por site — DOM dos sites muda!) · `area:options` (página de opções) · `area:store` (empacotamento/CWS) · `area:docs` · `area:infra` (git, gate, CI, frota)
- **Estado/controle:** `em-resolucao` (claim de agente) · `blocked` · `epic` (fatiar) · `decisao-dono` (núcleo §7.1) · + defaults do GitHub (`bug`, `wontfix`…)
- Exceção: a issue **#1 (📓 Diário)** mantém apenas `P3` + `area:infra` e NUNCA é elegível para resolução.

## §4 — Claim (reivindicação de issue)

Antes de trabalhar uma issue, confira as **3 fontes** (nenhuma pode existir): label `em-resolucao`, branch remota `auto/issue-<N>-*`, PR aberta ligada à issue. Claim = adicionar `em-resolucao` + criar branch `auto/issue-<N>-<slug>` em worktree. Claim órfão (label sem branch e sem PR) é removido pelo Curador no dia seguinte.

## §5 — Branches e worktrees

- Clone do dono: `E:\Projetos\Extencao\Prompt Meter` (CAMINHO COM ESPAÇO — sempre entre aspas). Use-o SÓ para `git fetch`, worktrees e limpeza; **nunca edite nele**.
- Worktrees em `E:\Projetos\Extencao\PromptMeter-wt\i<N>` (sem espaço, fora do clone).
- Branch sempre `auto/issue-<N>-<slug-curto>`, criada de `origin/main`. Nunca commit/push na main; nunca `--force`.

## §6 — Gate (obrigatório antes de todo PR e todo merge)

```
node scripts/gate.mjs
```

Zero dependências. Valida: manifest MV3 (permissão única `storage`, arquivos referenciados existem), sintaxe de todos os `.js`, **invariante 100% local** (nenhuma API de rede na extensão), i18n (pt_BR e en com as mesmas chaves), e o produto carregado de verdade em sandbox: tokenizer conta, tabela de preços íntegra (ids únicos, valores positivos, famílias válidas), matemática do custo exata, e `defaultModel` de cada site existente na tabela.

- Gate vermelho sem correção honesta dentro do escopo → PR em **DRAFT** explicando.
- **NUNCA enfraquecer, pular ou editar o gate para passar.** Mudança no gate = quórum §7.2.

## §7 — Doutrina de autonomia

### §7.1 Núcleo — NUNCA mergear; DRAFT + `decisao-dono` + avisar o dono
- Qualquer chamada de rede/telemetria na extensão · qualquer permissão nova, `host_permissions` ou CSP no manifest
- Publicar/atualizar na Chrome Web Store · dinheiro, contas, credenciais
- Dependência externa nova, bundler, build step · regenerar/substituir `tokenizer.js`
- Remover um site suportado · reescrever histórico / `--force` · workflows com `permissions` de escrita ou secrets

### §7.2 Quórum — 3 lentes adversariais; só mergeia com 3× APROVA
Aplica-se a: `pricing.js`, `tokenizer.js`, `models.js` (o coração de exatidão do produto), `manifest.json` (dentro do permitido), `.github/*`, gate/HANDBOOK/skills da frota, corpo com "Solicito quórum (HANDBOOK §7)", ou qualquer PR que o PR Doctor julgue arriscada. As 3 lentes (subagentes independentes, default = VETAR com vetor `arquivo:linha`):
1. **Exatidão** — matemática do custo, tokFactor, ids/labels, preços conferem com a fonte oficial citada no PR (§10)
2. **Compatibilidade** — os 4 sites continuam detectados, MV3/CSP ok, overlay sem regressão, zero-build preservado
3. **Privacidade** — NENHUMA rede nova, permissões intactas, nenhum dado do usuário sai da máquina

### §7.3 Normal — mergeável pelo PR Doctor após ler o diff inteiro
Overlay CSS/UX, página de opções, docs, testes, a11y, i18n, correções pequenas e bem testadas.

## §8 — Regras rígidas (todas as rotinas)

1. Máximo por rodada: Curador ≤2 issues novas · Resolvedor 1 issue · PR Doctor ≤2 merges (≤3 PRs processadas).
2. NUNCA commit/push direto na main; NUNCA `--force`; NUNCA reescrever histórico; nunca deletar branch não mergeada de outro.
3. NUNCA ler/commitar `.env*` nem imprimir segredo — o repo é PÚBLICO.
4. NUNCA desabilitar/enfraquecer gate ou validação. Diff mínimo, sem refactor oportunista.
5. Opere APENAS em `caioross/PromptMeter`. NUNCA tocar em SkillDepot, CodeRacer, NostalgiaGPT ou outros repos.
6. Não recriar tema já recusado (`decisao-dono`/`wontfix` — pesquise antes).
7. Dúvida real de segurança/correção/escopo → DRAFT + `decisao-dono`. Prefira NÃO entregar a entregar errado.

## §9 — Comunicação

- **Diário de Bordo** (issue fixada **#1**): toda rodada termina com 1 comentário de ≤6 linhas + assinatura `<!-- agente:promptmeter/<rotina> -->`.
- **Sem Discussions neste repo**: o [Plano] semanal do Curador (domingo) é um comentário no Diário; conversas acontecem em issues.
- Issues excelentes: título específico, contexto `arquivo:linha`, acceptance criteria verificáveis, 1 prioridade + ≥1 área.
- PR: Conventional Commits; corpo com o quê/por quê, resultado REAL do gate, riscos; `Closes #N` só se resolve a issue INTEIRA (fatia parcial = `Refs #N`).

## §10 — Verdade de preços

`pricing.js` declara `PRICING_UPDATED`. Toda mudança de preço/modelo: (1) cita a **URL da página oficial** de preços no corpo do PR; (2) atualiza `PRICING_UPDATED`; (3) marca `est: true` em valores não confirmados em fonte oficial; (4) passa por quórum §7.2 com a lente Exatidão conferindo a fonte. Preço desatualizado é bug — usuário toma decisão de dinheiro com esses números.
