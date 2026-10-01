# POP 09 — Planejar uma fábrica num cenário

**Quando usar:** sempre que um cenário e ano novo for aberto (o orçamento de
2028, uma simulação), e a cada versão nova dentro dele.

## Antes de começar

- O gestor abriu uma **versão** em Habilitação de cenário/ano. Sem versão
  aberta não há o que planejar, e o fluxo diz isso.
- Você tem as fábricas que atende no seu cadastro de usuário — o fluxo só
  mostra as do seu escopo.

## Passos

1. **Planejamento da capacidade › Planejar uma fábrica.** Escolha o cenário e,
   se houver mais de um ano aberto, o ano.
2. **Escolha a fábrica.** A lista mostra, por área, quantas etapas já foram
   concluídas e qual falta. *Planejar* começa; *Continuar* retoma de onde parou.
3. **Percorra as etapas**, na ordem em que aparecem:

| etapa | o que revisar |
|---|---|
| **Recursos** | Qtd, equivalência, janela de operação. Máquina nova entra aqui. É estrutura: vale nos dois cenários. |
| **Jornada e regime** | a matriz mês × turno, e o regime de dias na primeira coluna |
| **OEE** | o rendimento, mês a mês |
| **Paradas** | preventivas, férias coletivas, obra. **Não tem cenário**: vale nos dois |
| **Recalcular** | a rodada desta área, ano e cenário. Sem isto nada aparece no painel |
| **Conferir** | as anomalias que o cadastro deixou |

4. Em cada etapa, **Confirmei esta etapa →**. Confirmar é um ato: passar pela
   tela não conta. É isso que garante que nada ficou sem revisão.
5. Repita para cada fábrica.

## Como conferir que deu certo

A etapa **Conferir** lista o que o motor aceita e que produz número errado em
silêncio:

- **Sem jornada no ano** — não rodam em mês nenhum; a planejada é zero e eles
  somem do painel.
- **Sem regime em algum mês** — mês sem calendário não sai zerado: o recurso
  **some** daquele mês.
- **OEE em 100% o ano todo** — não é erro, é "ainda não medi"; mas uma área
  inteira assim quase sempre é cadastro que ficou para trás.

E a comparação com o ano anterior: variação acima de 20% merece um olhar antes
de alguém levar o número para uma reunião.

## O que costuma dar errado

- **A trilha some e aparece "não há versão aberta"** → o gestor fechou a versão,
  ou você trocou para um cenário que não tem nenhuma aberta.
- **Recalcular diz "a rodada saiu vazia"** → nenhum recurso da área tem jornada
  neste cenário e ano. Volte à etapa Jornada e regime.
- **Confirmei por engano** → o botão **desmarcar** tira a confirmação. Melhor
  desmarcar que deixar um visto que ninguém deu.
- **Caiu a internet no meio** → o que foi salvo está salvo; o que estava
  digitado e não salvo se perde. A trilha fica no servidor, então ao voltar o
  fluxo diz em que área e etapa você estava.
