# Calendários

**Menu:** Estrutura da empresa › Calendários. Por planta; a grade do ano é por
área.

## Para que serve

O **regime** de cada linha: os dias da semana em que trabalha (padrão ×
rodízio), os **feriados e exceções** da área, e a contagem de **dias úteis**
com peso por dia da semana.

## Partes da tela

- **Dias da semana** — dia desmarcado não produz capacidade nenhuma nesta
  linha, em nenhum turno.
- **Grade do ano** — pintado é dia em que a linha **não produz**. A mesma data
  aparece diferente em outro calendário: o rodízio trabalha domingo e pode
  trabalhar num feriado que o padrão observa. A grade é sempre de **uma área**.
- **Exceções** — cada uma tem **Efeito**:
  - *para os recursos*: zera o dia inteiro nos calendários marcados (ou
    habilita um dia normalmente parado — assim se cadastra trabalho em
    feriado). Não existe meio dia aqui; meia parada de verdade vai em
    **Paradas**, por recurso e em minutos.
  - *só apresentação*: a capacidade fica intacta; o dia aparece na grade e
    entra na contagem de dias úteis. **Quanto do dia** (1 ou 0,5) só vale
    aqui.
- **Dias úteis** — pesos deste calendário (sábado 0,5, por exemplo). Só contam
  nos dias que o calendário trabalha e já descontam feriado. É **indicador de
  leitura**: a capacidade continua em minutos e não usa os pesos.
- **Importar de outra planta** — copia dias da semana, pesos e turnos (pelo
  código). **Feriados não vêm** — são justamente o que muda de cidade para
  cidade.

## Cuidados

- Calendário seguido por algum recurso **não pode ser apagado**: o recurso
  ficaria sem regime e sumiria do cálculo em silêncio.
- Exceção que "não alcança ninguém" é a que nenhum recurso da área segue
  naquele calendário — a tela avisa.
- Mudou feriado ou regime? **Recalcular.**
