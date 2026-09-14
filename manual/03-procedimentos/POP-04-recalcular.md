# POP-04 — Recalcular (tudo ou parcial)

## Quando usar

**Sempre que mudou cadastro** — recurso, turno, calendário, feriado, turnos do
recurso, OEE, parada — e antes de avaliar qualquer número: painel, ocupação,
extração, simulador. A ferramenta **não recalcula sozinha**.

## Antes de começar

- Saber o que mudou: um recurso, uma área, ou muita coisa.
- Deixar a aba do navegador aberta até o fim: o laço roda no navegador, uma
  requisição por rodada.

## Passos — Recalcular tudo

1. Painel da Capacidade › **Recalcular tudo**.
2. Aguarde: são todas as áreas × anos × origens (dezenas de rodadas, alguns
   minutos). A tela mostra o progresso e, no fim, quantas rodadas deram certo
   e quais ficaram vazias.

## Passos — Recalcular parcial

1. Painel da Capacidade › **Recalcular parcial…**.
2. No pop-up, estreite: planta › área › CC › CT › patrimônio › código ›
   recurso; **ano** e **OEE** (ou *todos*). O rodapé diz quantas rodadas serão
   tocadas e explica a conta: áreas × anos × origens — em cada uma o motor
   regrava só os recursos do recorte.
3. Rodar.

## Como conferir que deu certo

- O rodapé do painel mostra a data/hora da rodada e, no parcial, a data do
  **recálculo parcial**.
- O número que você esperava mudar mudou.

## O que costuma dar errado

- **Fechou a aba no meio** → as rodadas que não rodaram ficam com o número
  antigo. Rode de novo.
- **"Rodada vazia"** → a área não tem recurso com turno e calendário naquele
  ano; não é erro do motor.
- **Parcial de 1 recurso mostrou "8 rodadas"** → 4 anos × 2 origens; é
  esperado. Estreite ano e OEE se quiser 1.
- **Mudei turno/calendário da planta inteira e rodei parcial de um recurso** →
  os outros recursos da planta continuam com o número velho. Turno e
  calendário são compartilhados: rode tudo (ou a área inteira).
- Rodada com **idades misturadas** (parte parcial, parte antiga) é legítima e
  declarada no rodapé — mas se você não lembra o que ficou de fora, rode tudo.
