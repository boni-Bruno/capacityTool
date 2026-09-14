# Turnos do recurso

**Menu:** Planejamento da capacidade › Turnos do recurso.

## Para que serve

Dizer, para cada recurso e cada mês do ano, **quais turnos ele roda e com
quantas máquinas (ou pessoas)** — e qual **calendário (regime)** ele segue.
É a tela que transforma instalada em planejada.

## Seletores

**Planta › Área › Tipo (máquina/pessoa) › CC › CT › Patrimônio › Código ›
Recurso › Ano.** O Tipo nasce em **máquina**; se a área também tem pessoas, a
tela avisa que elas não aparecem — troque o Tipo para cadastrá-las. Máquina e
pessoa **nunca dividem a mesma matriz**.

## A matriz

Linhas = meses, colunas = turnos.

- **Máquina com Qtd 1**: a célula é uma marca — roda / não roda.
- **Máquina com Qtd > 1**: a célula pede um **número** — quantas rodam naquele
  turno. Vazio = não roda. Número igual à Qtd é guardado como "todas": se a
  Qtd crescer, esse turno acompanha.
- **Pessoa**: a célula é **quantas pessoas** trabalham naquele turno naquele
  mês, sem teto. 12 no 1º e 20 no 3º é cadastro legítimo.
- **→ ano todo**: a caixa no alto de cada turno preenche os doze meses com o
  número digitado nela.
- **Todos os filtrados** no seletor de recurso cadastra o mesmo desenho em
  todos os recursos do recorte — útil para montar uma área inteira. Vale só
  para máquina; pessoa se cadastra uma a uma.
- **Quem entra no lote** aparece como lista de chips acima da matriz: clique
  num para tirar, **nenhum** e **todos** para começar do zero. É assim que se
  faz "2 turnos em 4 máquinas e 3 turnos nas outras 5" do mesmo CT: *nenhum*,
  marque as 4, aplique; *nenhum*, marque as 5, aplique.
- **Limpar turnos do ano** (ou **Limpar turnos em N recurso(s)**, no lote)
  apaga os turnos do ano escolhido nos recursos da lista, com confirmação. Os
  outros anos não mudam. É o caminho para desfazer um lote aplicado errado.

## Regime

Escolha do calendário que o recurso segue. Sem regime, o motor não gera
capacidade para ele.

## Como conferir

Marcar o turno é necessário, mas não basta. Para o recurso produzir num dia:
**o turno tem horário naquele dia da semana** (tela de Turnos) **e o regime
trabalha naquele dia** (Calendários). Descendo até o dia no Painel da
Capacidade dá para ver qual dos dois fechou.

## Cuidados

- **Turnos sobrepostos**: a tela avisa quando, num mês e dia da semana, os
  turnos marcados somam mais de 24 h (costuma ser o turno de 24 h marcado junto
  com os que ele já cobre). O motor soma, e a planejada passa da instalada.
- O ano é sempre um só; para o ano seguinte, troque o Ano e cadastre de novo
  (a vigência é por mês).
- **Recalcular** depois.
