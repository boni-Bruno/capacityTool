# Painel da Ocupação

**Menu:** Consultar › Painel da Ocupação. Responde **"cabe?"**.

## Para que serve

A capacidade disponível (barras) contra a demanda do cenário **no ar**
(linha), em minuto, por mês. Ocupação = demanda ÷ disponível. Desce por
planta › área › CC › CT.

## Controles

Os mesmos do Painel da Capacidade (planta, área, ano, OEE), mais o cenário —
sempre o que está **no ar** na tela de Demanda.

## Como ler

- Ocupação **acima de 100%** = o plano pede mais do que cabe. Abaixo = folga.
- A ocupação de um período é sempre **Σ demanda ÷ Σ disponível** — a do ano
  não é a média dos meses.
- CT com demanda e **sem capacidade** aparece com barra zero e ocupação
  infinita/vazia: ou o CT não tem recurso cadastrado com aquele CC-CT, ou tem e
  não foi recalculado. A tela de Demanda lista esses CTs em *demanda sem
  capacidade*.

## Cuidados

- Depende de **duas** coisas estarem atualizadas: a rodada (Recalcular) e a
  carga no ar (Demanda). Importar uma base nova **não** a põe no ar.
- O rodapé mostra a rodada e o recálculo parcial, como no outro painel.
