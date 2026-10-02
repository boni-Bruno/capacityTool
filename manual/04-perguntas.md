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

## Não vejo a tela X no menu (ou abre "Sem acesso a esta tela")

**Causa.** O seu cargo não tem `ver` naquela tela. O menu esconde e a página
nega — mesmo pelo endereço.

**O que fazer.** Peça ao gestor de planejamento que marque a tela no cargo
(Acesso › Cargos) ou que troque o seu cargo. Vale na próxima tela que abrir.

---

## Salvei e veio "Esta área está fora do seu escopo" / "pede a planta inteira"

**Causa.** O seu escopo (Onde atua, no cadastro de usuário) não cobre a área
da coisa que você tentou gravar; ou você tentou mexer em turno, calendário ou
feriado — que são da planta — tendo só uma área solta.

**O que fazer.** O gestor edita o seu usuário e marca a área ou a planta
inteira.

---

## Entrei pelo Hub S&OP e caí em "Sem acesso"

**Causa.** O e-mail que o Hub mandou não está em nenhum usuário ativo aqui.

**O que fazer.** O gestor cadastra (ou corrige o e-mail de) o seu usuário. A
página mostra o e-mail que chegou, para não haver dúvida de qual é.

---

## Fechei o navegador e pediu login de novo

**Causa.** É de propósito: a sessão é do navegador aberto, e o token vence em
12 h de qualquer jeito. Navegador configurado para "continuar de onde parou"
pode restaurar a sessão — é comportamento dele.

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

## O ano sumiu do seletor em Turnos do recurso, OEE ou Paradas

**Causa.** Aquele ano não tem **versão aberta** naquele cenário. O cadastro
acontece dentro de uma versão: ou nenhuma foi aberta ainda, ou a última foi
fechada — e versão fechada é "ninguém mexe mais".

**O que fazer.** Peça ao gestor de planejamento para abrir uma versão em
**Habilitação de cenário/ano**. Se a anterior foi fechada de propósito e algo
precisa mudar, ele abre a próxima (a v2, a v3) marcando quais etapas ela exige.

Repare que **consultar continua funcionando**: o painel, a ocupação e as
extrações mostram qualquer ano que tenha rodada, fechado ou não.

---

## O painel do Orçamento está zerado (ou muito menor que o da Simulação)

**Causa.** Os dois cenários são **isolados** e cada um tem a sua jornada. O
Orçamento nasceu com as **máquinas** e o **regime de dias**, mas **sem turnos** —
eles são o que vem das fábricas. Sem turno não há planejada, e a instalada
aparece sozinha.

**O que fazer.** Turnos do recurso, com **Cenário = Orçamento**, e cadastre a
jornada. Depois **Recalcular**. Enquanto isso, o número que vale é o da
Simulação.

---

## Cadastrei os turnos e não mudou nada no painel

**Causa.** Antes de suspeitar de recálculo: confira em **qual cenário** você
cadastrou. Turnos do recurso abre em **Simulação**; se o painel está em
**Orçamento**, ele mostra outro plano — e o contrário também. Nenhum dos dois dá
erro, porque os dois cadastros são legítimos.

**O que fazer.** O cenário está no seletor e num selo ao lado do título da
matriz. Confira que ele é o mesmo dos dois lados, e recalcule.

---

## O recurso aparece em alguns meses e some em outros

**Sintoma.** No painel, a linha do recurso tem número de janeiro a junho e de
julho em diante ele não está lá — nem com zero.

**Causa.** Aqueles meses estão **sem regime de dias**. Zero é resposta; sumir é
o que acontece quando não há regime nenhum, porque o motor casa cada dia com o
calendário e, sem calendário, o dia não existe para aquele recurso.

**O que fazer.** Turnos do recurso, o ano em questão: os meses sem regime estão
com a borda amarela na primeira coluna, e há um aviso embaixo da tabela.
Escolha o regime, salve e **Recalcular parcial** para o recurso.

---

## Troquei o recurso para rodízio em julho e a capacidade de janeiro mudou também

**Causa.** Não deveria — o cadastro é por mês. Se o ano inteiro mudou, o
seletor usado foi o do **cabeçalho** da coluna, que aplica aos doze meses de
uma vez.

**O que fazer.** Cadastre mês a mês nas linhas, ou aplique no cabeçalho e
depois corrija os meses que continuam no regime antigo. O ano seguinte nunca é
afetado: o cadastro vale só para o ano escolhido.

---

## Não consigo importar: "já há 4 cenários, que é o máximo"

**Causa.** A ferramenta guarda no máximo **4 cargas de demanda**. Cada uma
ocupa uns 30 MB permanentes do banco e nenhuma sai sozinha — importar nunca
apagou nada.

**O que fazer.** Demanda › lista de Cargas: apague a que não serve mais (a que
está **no ar** não se apaga — ponha outra no ar antes, se for ela que deve
sair). Aí o botão de importar volta.

O que você perde ao apagar: a possibilidade de comparar com aquele ciclo no
Painel da Ocupação, na Extração das configurações e no Simulador. O `.parquet`
original é que seria a volta — guarde-o.

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

## O OEE da grade "Cadastros" não bate com o que está na tela de OEE

**Sintoma.** A grade embaixo do gráfico mostra 74% em junho; a tela de OEE
mostra 80% naquele mês, no mesmo cenário.

**Causa.** São dois momentos diferentes, e os dois estão certos. A grade mostra
o OEE que a **rodada** aplicou — disponível ÷ planejada do cálculo que está no
ar. A tela de OEE mostra o que está **cadastrado hoje**. Entre uma coisa e
outra alguém mudou o cadastro e ainda não recalculou.

Pode ser também **média ponderada**: o número da grade é a soma do disponível
sobre a soma da planejada de todos os recursos do recorte. Uma máquina com 60%
que roda três turnos pesa mais que uma de 95% que roda um.

**O que fazer.** **Recalcular** (tudo, ou parcial para a área) e olhar de novo.
Se continuar diferente, é a ponderação — e aí o número da grade é o certo para
o conjunto.

---

## A linha de um turno está em branco na grade "Cadastros"

**Causa.** Branco quer dizer **não roda neste recorte**, e não "não consegui
contar". Todos os turnos da planta aparecem na grade justamente para isso: a
linha vazia é a resposta "o 3º turno não roda nesta área".

**O que fazer.** Nada, se for o esperado. Se deveria rodar, é Turnos do recurso
— confira o **cenário** e o **mês**, porque a marcação é por mês, e recalcule.

---

## Paradas (minutos) está zerado e eu cadastrei paradas

**Causa.** A linha mostra o que o **motor descontou** naquela rodada, não o que
está na tela de Paradas. Ela sai zerada quando a parada caiu num dia que o
calendário do recurso já não trabalhava (feriado, domingo), quando foi
cadastrada num turno que aquele recurso não roda, ou quando a rodada é anterior
ao cadastro.

**O que fazer.** Recalcular primeiro. Se continuar zero, confira a data e o
turno da parada contra o regime do recurso naquele mês.

---

## A ocupação ficou sem cor nenhuma no painel

**Causa.** A cor vem das **faixas cadastradas** (botão *Cores da ocupação*, no
alto do bloco mês a mês), e não de uma régua fixa. Sem faixa nenhuma, ou com uma
porcentagem que não cai em faixa alguma, o número sai sem cor — de propósito:
inventar uma cor para o que ninguém classificou seria dar significado a um
vazio.

**O que fazer.** Abrir *Cores da ocupação* e cadastrar as faixas, ou conferir se
há buraco entre elas (85 a 95 e 100 a ∞ deixam 95 a 100 sem cor). Lembre que o
fim é **aberto**: uma faixa que termina em 100 não pinta exatamente 100%.

---

## O painel e o slide mostram cores diferentes para o mesmo mês

**Causa.** A régua é a mesma desde 02/10/2026 — então o que difere é o
**número**, não a cor. As porcentagens podem ser outras porque o slide foi
gerado com outra **medida** (disponível, planejada ou instalada), outro **OEE**
(meta ou simulado), outra **base de demanda** ou outro **recorte**.

**O que fazer.** Compare as escolhas das duas telas antes da cor. Se as duas
mostram a mesma porcentagem com cores diferentes, aí sim é defeito — relate.

---

## Mudei as cores e o documento antigo continua com as cores velhas

**Causa.** O `.pptx` já gerado é um arquivo: ele guarda as cores do momento em
que saiu. A régua vale para o **próximo** documento.

**O que fazer.** Gerar o documento de novo.

---

## Metro e UM sumiram do painel

**Causa.** Sem cenário no ar, ou o CT não tem índice de conversão (linhas com
quantidade e sem tempo de roteiro na base).

**O que fazer.** Pôr uma carga no ar; conferir em Demanda › Índice a origem do
índice daquele CT.
