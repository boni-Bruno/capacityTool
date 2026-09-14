# 4. Perguntas e pegadinhas

Cada entrada tem a mesma forma: **sintoma** (o que se vê) · **causa** · **o
que fazer**. É a parte do manual que mais cresce com o uso — relate o tropeço
numa frase e ele entra aqui.

---

## Cadastrei calendário, turno e OEE, baixei o simulador e continuou "sem capacidade"

**Sintoma.** Subi uma base de demanda nova; o Painel da Ocupação mostrou
demanda sem capacidade (esperado — não havia nada cadastrado). Cadastrei
calendário, um modelo padrão de turnos e OEE, baixei o Simulador de recursos
e veio de novo sem capacidade calculada.

**Causa.** Cadastro não é cálculo. Painel, ocupação, extrações e simulador
leem a **rodada** — o resultado do último **Recalcular**. O que foi cadastrado
depois da última rodada ainda não existe para nenhuma dessas telas.

**O que fazer.** **Recalcular** (tudo, ou parcial para a área/recursos que
mudaram) **antes de avaliar qualquer coisa** na ferramenta. Depois disso o
simulador saiu certo. Regra geral: *mudou cadastro → recalcular → só então
olhar número*.

---

## Cadastrei turnos em lote para vários recursos e não consigo desfazer

**Sintoma.** Apliquei 3 turnos em 12 máquinas com *todos os filtrados*; para
tirar, a matriz do lote nasce vazia e o botão Aplicar fica desabilitado.

**Causa.** A matriz em lote é um molde e nasce em branco; vazia, não há
"alteração" para salvar.

**O que fazer.** Botão **Limpar turnos em N recurso(s)**, ao lado do Aplicar:
apaga os turnos do ano nos recursos da lista, com confirmação. Depois,
Recalcular.

---

## Quero 2 turnos em 4 máquinas e 3 turnos nas outras 5 do mesmo CT

**O que fazer.** Filtre o CT, escolha *todos os filtrados*; na lista de chips
acima da matriz clique em **nenhum** e marque as 4; monte a matriz e aplique.
Depois **nenhum**, marque as 5, monte a outra matriz e aplique. O mesmo vale
em OEE e Paradas.

---

## A planejada de segunda-feira é diferente da de terça, com os mesmos turnos

**Sintoma.** Recurso com três turnos: segunda dá 1.410 min, terça dá 1.440.

**Causa.** O 3º turno começa às 22:30 e termina às 05:00 do dia seguinte. Os
minutos contam no **dia em que o turno começa**. Domingo não tem 3º turno, e
por isso a madrugada de segunda não tem quem a "pague"; a de terça é paga pelo
3º turno de segunda.

**O que fazer.** Nada — está correto. É o horário cadastrado em Turnos.

---

## "Min planejados por unidade por dia" no simulador dá 436, e o turno é de 480

**Sintoma.** Parece que o OEE já está dentro do número.

**Causa.** É **média por dia útil**: 18 dias de 480 min e 4 sábados de 240 no
mês dão 436. O OEE está na coluna ao lado e entra só em *Min disponíveis por
unidade por dia*.

**O que fazer.** Nada. O número varia de mês para mês porque a proporção de
sábados varia.

---

## O CT não aparece no simulador (ou aparece sem minutos por unidade)

**Sintoma.** CT com demanda, recurso cadastrado, e a linha sai sem *min por
unidade* e com disponível zero.

**Causa.** O recurso tem OEE mas **não tem turno nem calendário** — o motor
não gera nenhuma linha para ele. Ou tem, e não foi recalculado.

**O que fazer.** Turnos do recurso (com o Tipo certo — pessoa ou máquina),
regime, e Recalcular parcial para ele.

---

## Importei a demanda e a ocupação não mudou

**Causa.** Importar cria uma carga nova, mas **não a põe no ar**. O Painel da
Ocupação usa a carga marcada como *no ar*.

**O que fazer.** Demanda › marcar a carga nova como no ar. E recalcular, se
cadastrou recursos para os CTs novos.

---

## Recalcular parcial de um recurso disse "8 rodadas"

**Causa.** Rodada é por área × ano × origem. Um recurso em 4 anos × 2 OEEs =
8 rodadas, e em cada uma o motor regrava só aquele recurso.

**O que fazer.** Nada; ou estreitar ano e OEE no pop-up para rodar 1.

---

## Não consigo excluir um recurso

**Causa.** Recurso que já entrou em alguma rodada não se apaga: ele é
**desativado** com a vigência fechada em hoje, para a história continuar
fechando.

**O que fazer.** Aceitar a desativação. Apagar de vez é pelo painel de
recursos desativados, e só faz sentido para cadastro errado que nunca deveria
ter existido.

---

## Planejada maior que a instalada num mês

**Causa.** Turnos sobrepostos — normalmente o turno de 24 h marcado junto com
o 1º, 2º e 3º no mesmo recurso. A tela de Turnos do recurso avisa quais meses
e dias.

**O que fazer.** Desmarcar os turnos que sobram e recalcular.

---

## A disponível de um mês zerou e a planejada não

**Causa.** OEE em branco naquele mês vale **0%**.

**O que fazer.** Cadastrar o OEE do mês (a caixa *→ ano todo* ajuda) e
recalcular.

---

## Metro e UM sumiram do painel

**Causa.** Sem cenário no ar, ou o CT não tem índice de conversão (linhas com
quantidade e sem tempo de roteiro na base).

**O que fazer.** Pôr uma carga no ar; conferir em Demanda › Índice a origem do
índice daquele CT.
