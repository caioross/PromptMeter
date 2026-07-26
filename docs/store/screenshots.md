# Screenshots da Chrome Web Store — roteiro de captura

**Versão da extensão:** 0.4.0 · **Última revisão deste roteiro:** 2026-07-24

A Chrome Web Store **exige pelo menos 1 screenshot** para aceitar o envio: sem imagem, o
formulário do Developer Console não é submetido (issue #6). Este arquivo é o **roteiro
determinístico** de quais imagens capturar, com que estado do card e com que legenda.

> 🎬 **Quem faz o quê**
> A frota entrega **este roteiro**; a **captura é do dono**. As imagens exigem sessão logada
> real em chatgpt.com, claude.ai, gemini.google.com e perplexity.ai — a frota não tem conta
> (HANDBOOK §7.1). **Nenhuma imagem é gerada por mock ou montagem:** screenshot que não
> corresponde ao produto real é motivo de rejeição na review (*"Misleading imagery"*) e viola
> a exatidão honesta (HANDBOOK §2.4).

**Índice:** [Requisitos](#-requisitos-da-store) · [O que não pode aparecer](#-o-que-não-pode-aparecer-nas-imagens) · [As 5 tomadas](#-as-5-tomadas) · [Como capturar](#-como-capturar-reprodutível) · [Onde salvar](#-onde-salvar-os-arquivos) · [Checklist](#-checklist-por-imagem)

---

## 📐 Requisitos da Store

| Item | Valor | Fonte |
|---|---|---|
| Dimensão | **1280×800** px (a Store também aceita 640×400; 1280×800 é a preferida em telas de alta densidade) | [Supplying images](https://developer.chrome.com/docs/webstore/images) |
| Quantidade | **mínimo 1, máximo 5** — use as 5 | [Supplying images](https://developer.chrome.com/docs/webstore/images) · [Store listing tab](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) |
| Enquadramento | cantos quadrados, **sem padding** (*full bleed*) — a imagem preenche o quadro inteiro | [Supplying images](https://developer.chrome.com/docs/webstore/images) |
| Formato | **PNG 24-bit sem canal alfa** (JPEG também é aceito) | convenção deste projeto — a doc oficial fixa dimensão e enquadramento, não o formato; PNG-24 opaco evita que a transparência vire artefato cinza no quadro da Store |
| Peso | manter cada arquivo **< 1 MB** | convenção deste projeto (repo público) |

As demais imagens do formulário (ícone da Store e blocos promocionais) não são cobertas aqui:
o ícone 128×128 vem do próprio pacote (`PromptMeter_MVP_Sprint1/icons/icon128.png`) e os blocos
promocionais são opcionais — consulte a doc oficial no momento do envio.

> **Legendas:** o formulário de screenshots da CWS é só imagem — **não há campo de legenda por
> imagem**. Por isso a recomendação é capturar **sem texto embutido**, para que o mesmo conjunto
> sirva aos listings pt-BR e en. As legendas abaixo existem para (1) definir o que cada imagem
> precisa provar e (2) servir de texto pronto caso o dono opte por compor uma faixa de título
> sobre a imagem — nesse caso, um conjunto por idioma.

---

## 🚫 O que NÃO pode aparecer nas imagens

Vale para **todas** as tomadas. O repo é público e a imagem vai para a Store — o que entrar aqui
não sai mais.

- **Nenhum texto de prompt real ou sensível.** Use exatamente os prompts-modelo da tabela.
- **Nenhum dado de conta:** nome do usuário, e-mail, avatar, foto, plano contratado, iniciais no
  canto da barra lateral.
- **Nenhum título de conversa do histórico.** Recolha a barra lateral do ChatGPT/Claude antes de
  capturar (ou capture numa conversa nova, com a lateral fechada).
- **Nada do navegador que exponha o dono:** barra de favoritos, outras abas abertas, extensões
  na toolbar, notificações do sistema, relógio com fuso identificável.
- **Nenhuma sugestão de afiliação.** As imagens mostram o PromptMeter *sobre* ChatGPT, Claude,
  Gemini e Perplexity — legítimo —, mas nada pode sugerir endosso ou parceria com OpenAI,
  Anthropic, Google ou Perplexity.
- **Nenhum número inventado.** O que aparece na imagem é o que o produto calculou naquele
  momento; não edite valores de tokens, custo ou sessão na imagem.

---

## 🎞️ As 5 tomadas

| # | Site alvo | Estado do card a reproduzir | Legenda PT | Legenda EN |
|---|---|---|---|---|
| 1 | ChatGPT (`chatgpt.com`) | Card ao vivo durante a digitação, chip de origem = **`detectado`**, contagem **sem `~`** | Tokens e custo do seu prompt, ao vivo — antes de enviar. | Live token count and cost — before you hit send. |
| 2 | ChatGPT (`chatgpt.com`) | Card após a resposta terminar: rodapé com **`resposta: N tok · $X`** e **`sessão: $Y`** | Quando a resposta chega: o custo dela e o total do dia. | When the answer lands: its cost and your daily total. |
| 3 | ChatGPT (`chatgpt.com`) | **Menu de modelos aberto**, agrupado por provedor, preços `$entrada / $saída` e rodapé com a data da tabela | Troque o modelo cobrado em 1 clique — preços por 1M tokens. | Switch the billed model in one click — prices per 1M tokens. |
| 4 | Claude (`claude.ai`) | Card com o marcador **`~`** antes dos tokens **e** do custo (família não-OpenAI = estimativa) | Honesto por padrão: `~` marca o que é estimativa, não conta exata. | Honest by default: `~` marks an estimate, not an exact count. |
| 5 | Página de **Opções** | Moeda, cotação do R$, chave de resposta/sessão e o rodapé "Como funciona" visíveis | Moeda, cotação do R$ e sessão — tudo local, nas Opções. | Currency, BRL rate and session — all local, in Options. |

### Como reproduzir cada estado

**1 · ChatGPT, card ao vivo (modelo detectado).**
Abra uma conversa nova, clique no campo de prompt e digite o prompt-modelo abaixo. O card aparece
acima do campo (`content.js:278`) com `tokens` e `custo de entrada` em USD + R$.
Prompt-modelo: `Explique em três parágrafos por que o custo de um prompt cresce com o contexto.`
O chip ao lado do nome do modelo precisa dizer **`detectado`** — é o que a legenda promete. Se
disser `padrão`, o seletor de modelo do site não foi lido (`models.js:63`): troque o modelo pelo
seletor do próprio ChatGPT, recarregue a página e repita. Por ser família OpenAI, os números
aparecem **sem** `~` — isso é parte da mensagem da imagem.

**2 · ChatGPT, resposta e sessão preenchidos.**
Envie o prompt da tomada 1 e **espere a resposta terminar**. Cerca de 1,4 s após o texto parar de
crescer (`STREAM_IDLE_MS`, `content.js:12`), o rodapé troca `resposta: —` por `resposta: N tok · $X`
e atualiza `sessão: $Y`. Requer a chave *Custo da resposta + total da sessão* ligada nas Opções
(é o padrão). Capture com os dois valores preenchidos.

**3 · Menu de modelos aberto.**
Clique no nome do modelo no card. O menu lista os modelos agrupados por provedor, cada linha com
`$entrada / $saída` por 1M tokens, e o rodapé traz `USD por 1M tokens (entrada / saída) · <data da
tabela>`. Enquadre de modo que o rodapé com a data apareça: é ele que prova que os preços têm
procedência datada. Os itens marcados com `~` no menu são os de preço aproximado (`est: true` em
`pricing.js`). Ao abrir o menu o card se reposiciona uma vez (issue #36 em aberto) — espere
estabilizar antes de disparar a captura.

**4 · Claude, marcador de estimativa.**
Em `claude.ai`, com o campo de prompt focado, digite:
`Resuma as diferenças entre tokenizadores BPE e SentencePiece.`
O card mostra `~` antes da contagem **e** antes do custo (`content.js:329`), porque a família
Anthropic é estimada por `tokFactor` (`pricing.js:19`). Esta é a tomada que sustenta a promessa
de exatidão honesta do listing: **OpenAI é exato, o resto é estimativa declarada**. Se possível,
enquadre com o card inteiro legível — o `~` é pequeno e é o assunto da imagem.

**5 · Página de Opções.**
Abra `chrome://extensions` → PromptMeter → *Detalhes* → *Opções* (ou clique no ícone da extensão).
Capture a página inteira em 1280×800: os dois cartões (moeda / cotação / sessão e os botões de
limpeza) e o rodapé "Como funciona", que repete a distinção exato × estimativa e mostra a data
dos preços. Preencha a cotação com um valor plausível e redondo (ex.: `5,40`).

---

## 🛠️ Como capturar (reprodutível)

1. **Carregue a extensão desempacotada:** `chrome://extensions` → ligue *Modo do desenvolvedor* →
   *Carregar sem compactação* → selecione a pasta `PromptMeter_MVP_Sprint1/`. Confirme que a
   versão exibida é a mesma do `manifest.json`.
2. **Limpe a cena:** feche as demais abas, esconda a barra de favoritos (`Ctrl+Shift+B`), recolha a
   barra lateral do site, silencie notificações do sistema.
3. **Zoom em 100%** (`Ctrl+0`). Zoom diferente muda o tamanho do card e desalinha o conjunto.
4. **Fixe o viewport em 1280×800 pelo DevTools** — é o caminho determinístico, independente do
   tamanho da janela e da escala do Windows:
   - `F12` → *Toggle device toolbar* (`Ctrl+Shift+M`)
   - modo **Responsive**, largura `1280`, altura `800`, **DPR = 1**
     (com DPR 2 a captura sai 2560×1600, fora das dimensões aceitas)
   - menu `⋮` do device toolbar → **Capture screenshot** → gera um PNG de exatamente 1280×800
5. **Tema:** capture o conjunto inteiro no **mesmo tema**. Prefira o **escuro** enquanto a issue #9
   (contraste do rodapé do menu de modelos no tema claro) estiver aberta — no claro, a tomada 3
   sai com texto de baixo contraste.
6. **Confira a dimensão real** de cada arquivo antes de subir (zero dependências, lê o header IHDR
   do PNG):

   ```bash
   node -e "const b=require('fs').readFileSync(process.argv[1]);console.log(process.argv[1],b.readUInt32BE(16)+'x'+b.readUInt32BE(20))" docs/store/assets/screenshot-1-chatgpt-ao-vivo.png
   ```

7. **Reveja cada imagem** contra a seção [O que NÃO pode aparecer](#-o-que-não-pode-aparecer-nas-imagens)
   **antes** de salvar no repositório — depois de publicado, o histórico do git guarda a imagem.

---

## 📁 Onde salvar os arquivos

Diretório: **`docs/store/assets/`**. Nomes fixos, na ordem em que sobem no formulário:

```
docs/store/assets/screenshot-1-chatgpt-ao-vivo.png
docs/store/assets/screenshot-2-chatgpt-resposta-sessao.png
docs/store/assets/screenshot-3-menu-modelos.png
docs/store/assets/screenshot-4-claude-estimativa.png
docs/store/assets/screenshot-5-opcoes.png
```

- **Nenhum ajuste de `.gitignore` é necessário:** o `.gitignore` só ignora `*.zip` em artefatos de
  build — arquivos `.png` em `docs/` são versionados normalmente.
- **Nunca coloque as imagens dentro de `PromptMeter_MVP_Sprint1/`.** Essa pasta é o pacote enviado
  à Store: screenshots ali viram peso morto no ZIP publicado (o gate vigia artefatos não
  entregáveis nessa pasta — `scripts/gate.mjs` §7).

---

## ✔️ Checklist por imagem

- [ ] Exatamente **1280×800**, PNG sem canal alfa, < 1 MB, sem borda ou padding.
- [ ] O estado do card corresponde ao descrito na tomada (chip de origem, `~`, rodapé).
- [ ] Nenhum dado pessoal: sem nome, e-mail, avatar, título de conversa ou aba extra visível.
- [ ] Nenhum valor editado depois da captura.
- [ ] O conjunto inteiro está no mesmo tema e no mesmo zoom.
- [ ] Pelo menos uma imagem torna visível a distinção **exato (OpenAI) × estimativa (`~`)** — a
      tomada 4 cumpre isso.
