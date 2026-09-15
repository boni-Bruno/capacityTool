# Painel da Ocupação

**Menu:** Consultar › Painel da Ocupação. Responde **"cabe?"**.

## Para que serve

A capacidade disponível (barras) contra a demanda do cenário **no ar**
(linha), em minuto, por mês. Ocupação = demanda ÷ disponível. Desce por
planta › área › CC › CT.

## Controles

Os mesmos do Painel da Capacidade — fábrica (uma área, ou **todas as
fábricas**; abre com "selecionar fábrica…"), ano, OEE —, mais o cenário, que
nasce no que está **no ar** na tela de Demanda e pode ser trocado aqui.

## Como ler

- Ocupação **acima de 100%** = o plano pede mais do que cabe. Abaixo = folga.
- A ocupação de um período é sempre **Σ demanda ÷ Σ disponível** — a do ano
  não é a média dos meses.
- CT com demanda e **sem capacidade** aparece com barra zero e ocupação
  infinita/vazia: ou o CT não tem recurso cadastrado com aquele CC-CT, ou tem e
  não foi recalculado. A tela de Demanda lista esses CTs em *demanda sem
  capacidade*.

## A aba "Ocupação por centro de trabalho (Tab. Din.)"

A mesma ocupação, no grão **CT × mês**, como tabela dinâmica: agrupar por
Planta, Área, CC, CT e Mês na ordem que quiser, abrir e fechar grupos, e
escolher a agregação (soma, média, mediana, máximo, mínimo, contagem) da
capacidade e da demanda. A agregação vale para as linhas CT × mês do grupo.
**A ocupação é sempre Σ demanda ÷ Σ capacidade do grupo**, seja qual for a
função escolhida — média de ocupações não é ocupação. Recurso não é nível
aqui: a demanda é do CT e não se reparte entre os recursos dele.

## Cuidados

- Depende de **duas** coisas estarem atualizadas: a rodada (Recalcular) e a
  carga no ar (Demanda). Importar uma base nova **não** a põe no ar.
- O rodapé mostra a rodada e o recálculo parcial, como no outro painel.
