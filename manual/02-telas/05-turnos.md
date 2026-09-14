# Turnos

**Menu:** Estrutura da empresa › Turnos. Por planta.

## Para que serve

Criar e excluir turnos e definir **início e fim por dia da semana**, com o
intervalo de refeição. Turno novo nasce com a **semana zerada**: sem horário,
não roda em dia nenhum.

## Como ler

- Turno de 24 h (rodízio) cobre o dia inteiro; não marque junto com 1º, 2º e
  3º no mesmo recurso — soma mais de 1.440 min e a planejada estoura o teto.
- O horário que atravessa a meia-noite (22:30 → 05:00) conta os minutos no
  **dia em que começa**. Por isso a segunda-feira de um recurso de três turnos
  pode ter planejada diferente da terça: o 3º turno de domingo não existe, e o
  de segunda é que "paga" a madrugada de terça.
- O intervalo de refeição desconta para **pessoa**; máquina não para.

## Cuidados

- Turno usado em Turnos do recurso não se exclui.
- Mudar horário de um turno muda todos os recursos que o usam — e só aparece
  depois de Recalcular.
