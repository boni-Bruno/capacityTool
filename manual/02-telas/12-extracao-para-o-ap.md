# Extração para o AP

**Menu:** Extração › Extração para o AP.

## Para que serve

A capacidade calculada no formato que o sistema de planejamento (AP) importa:
`.csv` com **CT; Período (AAAA.MM); CT_Periodo; Minutos; Qtd. Recurso AP;
Capacidade por recurso do AP**, condensado por mês. A chave `CT|Periodo` já
vai concatenada, pronta para PROCV do outro lado.

## Como usar

Filtre planta › área › CC › CT (sem filtro sai tudo), escolha ano e origem de
OEE, **Gerar extração**, confira a prévia (30 linhas; o arquivo leva todas) e
baixe. Cada área e ano entram com a **última rodada** do OEE escolhido — a
mesma que o painel mostra.

## Qtd. Recurso AP

A quantidade de recursos que o AP conta em cada CT, importada da tela ao lado
(**Importar AP**). A *capacidade por recurso* é os minutos divididos por ela.
Linha sem quantidade sai com essa coluna vazia.

## Cuidados

- É a rodada: cadastro não recalculado não sai.
- Minutos, sempre — o AP não recebe metro nem UM.
