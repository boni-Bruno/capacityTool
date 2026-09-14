# POP-03 — Importar uma base de demanda nova

## Quando usar

A controladoria mandou uma base nova (novo ciclo, novo cenário, correção).

## Antes de começar

- O arquivo `.parquet` com as colunas de sempre.
- Um nome de cenário e uma **observação** que a distinga daqui a um mês.

## Passos

1. **Demanda › Importar**: escolha o arquivo, dê o nome do cenário. A leitura
   é no navegador e o envio em lotes; espere terminar.
2. Preencha a **observação** da carga.
3. **Explorar › Demanda sem capacidade**: a fila de CTs que o plano pede e a
   fábrica não tem. Para cada um, POP-01 (ou confira o CC-CT do recurso que
   já existe).
4. **Ajuste de mix** e **DE/PARA**: ajustes de ciclos anteriores continuam
   valendo — revise.
5. **Recalcular tudo** (ou parcial, para as áreas que mudaram).
6. **Demanda › marcar a carga como "no ar"**. Só agora o Painel da Ocupação
   passa a usá-la.

## Como conferir que deu certo

- Painel da Ocupação com a barra de capacidade e a linha de demanda nos meses
  esperados, na área que você conhece.
- Simulador de recursos: os CTs com demanda aparecem com disponível > 0 e
  ocupação calculada.

## O que costuma dar errado

- **Importou e a ocupação não mudou** → a carga não está *no ar* (passo 6).
- **Tudo com capacidade zero** → não recalculou (passo 5), ou os recursos
  ainda não têm turno/calendário (POP-01).
- **Metro e UM sumiram dos painéis** → a carga no ar não tem índice para
  aqueles CTs (linhas com quantidade e sem tempo de roteiro).
- **Demanda de um ano só** → o cenário pode ter minutos só em um ano; em outro
  ano tudo sai "sem demanda no cenário". Não é defeito.
