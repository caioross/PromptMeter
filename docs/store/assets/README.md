# `docs/store/assets/` — imagens do listing da Chrome Web Store

Destino dos **screenshots** enviados no formulário da Store. Ainda **vazio**: a captura depende de
sessão logada real nos quatro sites e é do dono (issue #6) — a frota entrega o roteiro.

O que capturar, com que estado do card, em que dimensão e o que não pode aparecer na imagem está
em [`../screenshots.md`](../screenshots.md). Nomes de arquivo esperados:

```
screenshot-1-chatgpt-ao-vivo.png
screenshot-2-chatgpt-resposta-sessao.png
screenshot-3-menu-modelos.png
screenshot-4-claude-estimativa.png
screenshot-5-opcoes.png
```

Regras curtas: **1280×800**, PNG sem canal alfa, < 1 MB, sem padding, sem nenhum dado pessoal
visível. Imagens de listing **nunca** vão para `PromptMeter_MVP_Sprint1/` — aquela pasta é o
pacote enviado à Store.
