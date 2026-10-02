# capacityTool - Manual completo

Gerado em 2026-10-02 a partir de manual/. Nao edite este arquivo; edite as partes e rode manual/juntar.ps1.

---

## Manual do capacityTool

Este manual é para **quem opera** a ferramenta de planejamento de capacidade:
cadastra a fábrica, importa a demanda, lê os painéis e tira as extrações. Ele
serve também para ser colado numa IA (Claude, ChatGPT…) junto com a sua
pergunta — por isso o arquivo `MANUAL.md`, na raiz do projeto, é a junção de
todas as partes num texto só.

O manual **não** explica como o sistema é construído; para isso existem o
`CLAUDE.md`, o `ROADMAP.md` e a pasta `memoria/`, que falam com quem desenvolve.

### Como ler

- **Está começando?** Leia `01-conceitos.md` inteiro — é curto — e depois o
  procedimento `POP-01`, que leva um recurso do cadastro até aparecer no painel.
- **Está numa tela e não entendeu um campo?** Abra o arquivo daquela tela em
  `02-telas/`.
- **Quer fazer algo do começo ao fim?** Os procedimentos (POPs) em
  `03-procedimentos/` têm sempre a mesma forma: quando usar · antes de começar
  · passos · como conferir que deu certo · o que costuma dar errado.
- **Deu um número estranho ou uma tela vazia?** `04-perguntas.md` lista os
  sintomas conhecidos, com a causa e o que fazer. É a parte que mais cresce.

### A regra que resume tudo

**A ferramenta não recalcula sozinha.** Cadastro muda o que *será* calculado;
o número que os painéis, as extrações e o simulador mostram é o da **última
rodada** do botão **Recalcular** (tudo ou parcial), no Painel da Capacidade.
Mudou cadastro, importou demanda, criou recurso: **recalcule antes de avaliar
qualquer coisa**. Se um número parece não ter reagido ao que você fez, é quase
sempre isso.

### Conteúdo

| parte | o que tem |
|---|---|
| `01-conceitos.md` | instalada, planejada, disponível, OEE, CC-CT, rodada, cenário, versão, unidade, cargo e escopo |
| `02-telas/` | uma página por tela, na ordem do menu |
| `03-procedimentos/` | os POPs numerados |
| `04-perguntas.md` | pegadinhas: sintoma → causa → o que fazer |

### Como este manual cresce

Quem usa a ferramenta relata o tropeço ou o aprendizado numa frase; a entrada
é escrita no lugar certo — em geral em `04-perguntas.md` — e `MANUAL.md` é
regerado. Toda mudança de tela atualiza o manual **no mesmo commit** da
mudança, para ele nunca descrever uma tela que não existe mais.

---

## 1. Conceitos

Tudo na ferramenta é **minuto por recurso, por dia, por turno**. Os painéis
somam isso por mês, área, planta; as conversões traduzem para hora, metro ou
peça. Mas a conta nasce no minuto.

### As três capacidades

| capacidade | o que é | de onde vem |
|---|---|---|
| **Instalada** | o teto físico: 24 h por dia, todo dia, vezes a quantidade de máquinas | Recursos (Qtd × Equivalência) |
| **Planejada** | o que os turnos escalados entregam, já sem intervalos, paradas e dias não úteis | Turnos do recurso + Turnos + Calendários + Paradas |
| **Disponível** | planejada × OEE — o que efetivamente dá para produzir | OEE |

A leitura é sempre de cima para baixo: a planejada cabe dentro da instalada
(o "% do teto" do painel), e a disponível cabe dentro da planejada (o OEE).

**Para recurso do tipo PESSOA a instalada é a própria planejada.** Não existe
teto de 24 h para gente. A pessoa não tem Qtd no cadastro: quantas pessoas
trabalham é um número **por turno**, na tela Turnos do recurso.

### OEE

Percentual, por recurso e por mês, em duas origens: **META** (o OEE que a
fábrica persegue) e **SIMULADO** (o que se quer testar). A instalada e a
planejada são iguais nas duas; só a disponível muda. **Setup já está dentro do
OEE** — não se cadastra setup como parada.

Mês sem OEE cadastrado vale **0%**, e a disponível daquele mês zera. Por isso
todo recurso novo nasce com 100% nas duas origens: o buraco tem que ser
anomalia, não o normal.

### CC, CT, Patrimônio e Código

**CC** (centro de custo), **CT** (centro de trabalho) e **Patrimônio** são a
identidade da máquina na controladoria. O **Código** do recurso é a trinca
concatenada e não se digita. A trinca não se repete entre recursos.

O vínculo entre a capacidade e a demanda é `CC-CT`: a base de demanda fala em
CT, e cada recurso com aquele CC e CT entra na conta daquele CT. Não existe
tabela de-para para isso — no instante em que um recurso é cadastrado com o
CC-CT certo, a demanda daquele CT passa a ter capacidade.

### Cenário: Orçamento e Simulação

A ferramenta guarda **dois planos ao mesmo tempo**, isolados um do outro:

- **Orçamento** — o que vem das fábricas e é digitado aqui.
- **Simulação** — o que se constrói na ferramenta para testar hipóteses.

**Isolados quer dizer isolados**: não há herança, e mexer num nunca mexe no
outro. Cada um tem a sua jornada (turnos), o seu regime de dias e o seu OEE, e
cada um tem a sua própria rodada de cálculo — o seletor de **Cenário** no painel
troca de rodada, não recalcula.

**O que NÃO muda entre os dois** é a *estrutura da empresa*: plantas, áreas e a
identidade de cada recurso (código, CC-CT, patrimônio, quantidade de máquinas,
janela de operação). A fábrica é a mesma nos dois planos — o que muda é o que se
planeja fazer com ela. Por isso a tela de **Recursos** não pergunta o cenário, e
as de **Turnos do recurso** e **OEE** perguntam.

Se um cenário precisar de **feriados diferentes**, o caminho é criar um
calendário a mais na planta e apontar nele só os recursos daquele cenário — o
vínculo recurso → calendário já é por cenário.

### Versão do cenário

O orçamento **não é um evento, é um ciclo**: começa em setembro, bate o martelo
em novembro ou dezembro, e no meio são três a seis versões, cada uma com mudança
de cadastro. Por isso a unidade de trabalho não é o ano — é a **versão do ano**.

- **Só uma versão aberta** por cenário e ano. Enquanto ela está aberta, aquele
  ano aparece para cadastro em Turnos do recurso, OEE e Paradas.
- **Fechar** tranca o cadastro e guarda uma **fotografia**: o resultado por
  recurso e mês. É ela que permite responder *"o que mudou da v3 para a v4?"* —
  pergunta que antes não tinha resposta, porque a rodada nova apagava a velha.
- **Abrir a próxima** (v2, v3…) libera o cadastro de novo. Quem abre escolhe
  **quais etapas a versão exige** revisar: *"a v4 só mexeu em jornada e OEE"*.

**Consultar nunca trava.** Painel, ocupação e extração mostram qualquer ano que
tenha rodada, de versão aberta ou fechada.

Quem abre e fecha é o **Gestor de Planejamento**, na tela de Habilitação de
cenário/ano. Quem percorre o cadastro usa **Planejar uma fábrica** — o fluxo
guiado, que leva uma fábrica por vez da revisão dos recursos até a conferência.

### Turno, calendário, dia útil

- **Turno** é da planta: nome e horário de início e fim **por dia da semana**.
  Turno sem horário na terça não roda na terça.
- **Calendário** (regime) é o conjunto de dias que uma linha trabalha —
  *padrão* (segunda a sábado, por exemplo) ou *rodízio* (24/7) — mais os
  feriados e exceções da área.
- Cada recurso segue **um calendário por mês** e roda **os turnos marcados**
  para aquele mês. Para o recurso produzir num dia, os dois portões precisam
  estar abertos: o turno tem horário naquele dia da semana **e** o calendário
  daquele mês trabalha naquele dia.
- O calendário é **por mês** porque a mesma máquina pode rodar em turnos até
  junho e em rodízio de julho em diante — e o rodízio tem outros feriados.
- **Dia útil** do motor: dia em que o calendário trabalha e não há exceção que
  o zere. Os *pesos* de dia útil da tela de Calendários (sábado = 0,5, por
  exemplo) são indicador de leitura; a capacidade continua em minutos.

### Parada e exceção

- **Parada** é de um recurso, em **minutos por turno**, numa data ou período:
  preventiva, preditiva, obra, inventário, férias coletivas.
- **Exceção** é do calendário/área: feriado, ponte, dia trabalhado fora do
  padrão. Com efeito *para os recursos* ela zera (ou habilita) o **dia inteiro**;
  com efeito *só apresentação* a capacidade fica intacta e o dia aparece
  marcado na grade e na contagem de dias úteis.

### Demanda, carga e cenário

A **base de demanda** vem da controladoria (arquivo `.parquet`) e diz quanto
de cada CT o plano pede, por mês, em minutos de roteiro e em quantidade. Cada
importação é uma **carga**, com nome de **cenário**. A carga **no ar** é a que
o Painel da Ocupação usa; importar uma nova **não** troca sozinho — marcar no
ar é uma ação separada, de propósito.

O **índice de conversão** (metros por minuto, peças por minuto) sai da própria
demanda: Σ quantidade ÷ Σ minutos, por CT e mês. É ele que traduz capacidade
em metro ou peça. CT sem demanda não tem índice — e por isso não converte.

### Rodada e Recalcular

O motor grava o resultado numa **rodada por área, ano e origem de OEE**. A
rodada nova substitui a anterior; ninguém consulta rodada velha. **Recalcular
tudo** roda todas as áreas × anos × origens (uma requisição por rodada, com a
aba do navegador aberta); **Recalcular parcial** regrava só os recursos
escolhidos dentro da rodada que já existe, e carimba a data disso no rodapé
dos painéis.

**Nada é recalculado automaticamente.** Cadastro mudado sem Recalcular é
cadastro que o painel ainda não viu.

### Unidade de leitura

Os painéis mostram minuto, hora, **metro** e **UM** (unidade de medida do
material). Metro e UM só existem com um cenário no ar, porque dependem do
índice. A **instalada não converte** para metro nem UM em lugar nenhum: teto de
24 h vezes o índice do mix daria um número que parece capacidade e não é.

### Usuário, cargo, escopo e mestre

Cada pessoa entra com **usuário e senha** (ou pelo Hub S&OP, reconhecida pelo
e-mail). O **cargo** diz *o que* ela pode: por tela, **ver** ou **editar**,
mais **Recalcular**. O **escopo** diz *onde*: a empresa inteira, plantas
inteiras ou áreas soltas — sem nada marcado, a pessoa não vê fábrica nenhuma.
O que é da planta (turno, calendário, feriado) só edita quem tem a planta
inteira.

A **senha mestre** (sem usuário) é a rede: entra com tudo, em toda parte,
identificada como "mestre". Fechar o navegador encerra a sessão; o botão
**Sair** também. Trocar o cargo ou desativar alguém vale na próxima tela que a
pessoa abrir.

### Ticket

O chamado que quem usa a ferramenta abre de dentro dela: dúvida, sugestão ou
defeito, sobre uma tela ou sobre a ferramenta toda (grupo **Roadmap** no menu).
Cada um tem um número, um estado — **Aberto**, **Em análise**, **Feito**, **Não
vamos fazer** — e a resposta de quem cuida do roadmap. Você vê os seus; o
Gestor de Planejamento vê os de todos.

### Ocupação

`ocupação = demanda ÷ disponível`, em minuto, por CT e mês — e, agregando, por
CC, área, planta. Sempre **divisão de somas**: a ocupação do ano é Σ demanda ÷
Σ disponível, nunca a média das doze ocupações.

---

## Painel da Capacidade

**Menu:** Consultar › Painel da Capacidade. Responde **"quanto cabe"**.

### Para que serve

Mostra instalada, planejada e disponível de uma área (ou planta, ou fábrica)
num ano, mês a mês, com a instalada como área de fundo e planejada e
disponível como barras. Abaixo, a tabela por recurso. Clicando num mês desce
ao **dia**; no dia, ao **turno**.

### Controles

- **Fábrica** — o painel abre com "selecionar fábrica…" e sem número nenhum;
  escolha uma área (`Planta · Área`) ou **todas as fábricas**, que soma a
  rodada de cada área e demora mais para abrir. **Ano / OEE (meta ou
  simulado)** completam o recorte. Tudo fica na URL: o endereço descreve a
  tela, e um link colado abre no mesmo lugar.
- **Unidade** — minuto, hora, metro, UM. Metro e UM só aparecem com cenário no
  ar, e a instalada não converte.
- **Filtro por atributo** (quando há DE/PARA) — soma a *fatia* de cada CT que
  aquele rótulo ocupa na demanda.
- **Capacidade por dia útil** — o total do mês dividido pelos dias úteis do
  calendário, com os pesos da tela de Calendários.
- **Recalcular tudo** e **Recalcular parcial…** — ver `03-procedimentos/POP-04`.

### Como ler

- **% do teto** = planejada ÷ instalada. Máquina com um turno só mostra ~33%;
  isso é a ociosidade planejada, não erro.
- O rodapé diz **quando** a rodada foi calculada e se houve **recálculo
  parcial** depois. Se a data é anterior ao seu último cadastro, o painel ainda
  não viu o cadastro. Em *todas as fábricas* ele diz quantas rodadas somou, a
  data da **mais antiga**, e quantas áreas ficaram de fora por não terem rodada
  naquele ano.
- **Capacidade por dia útil** só existe com uma área escolhida: o divisor é do
  calendário e dos feriados daquela área.

### A aba "Capacidade por recurso (Tab. Din.)"

A mesma capacidade, no grão **recurso × mês**, como tabela dinâmica:

- **Agrupar por**: clique nos campos na ordem em que devem empilhar (Planta,
  Área, Sub-área, CC, CT, Recurso, Tipo, Calendário, Mês). O número no chip é
  a posição; as setas ao lado do caminho reordenam. Clicar de novo tira o
  campo.
- **▸ / ▾** abre e fecha cada grupo; *abrir tudo* e *fechar tudo* no alto.
- **Agregação** por medida: soma (padrão), média, mediana, máximo, mínimo,
  contagem. Vale para as **linhas do grão** dentro do grupo: média num CC é a
  média dos recurso × mês daquele CC.
- **% do teto e OEE** não seguem a função escolhida: são sempre soma sobre
  soma do grupo.
- O número pequeno ao lado do nome do grupo é quantas linhas recurso × mês ele
  tem.
- Os filtros da barra e da árvore valem aqui também. Agrupamento e agregação
  ficam na URL; o que está aberto, não.
- Em metro e UM a instalada fica de fora, como no resto do painel.

### Cuidados

- Sem rodada para a área/ano/origem escolhidos a tela avisa e fica vazia. Não é
  falta de cadastro — é falta de **Recalcular**.
- Planejada acima da instalada em algum mês = **turnos sobrepostos** (a tela de
  Turnos do recurso avisa quais).

---

## Painel da Ocupação

**Menu:** Consultar › Painel da Ocupação. Responde **"cabe?"**.

### Para que serve

A capacidade disponível (barras) contra a demanda do cenário **no ar**
(linha), em minuto, por mês. Ocupação = demanda ÷ disponível. Desce por
planta › área › CC › CT.

### Controles

Os mesmos do Painel da Capacidade — fábrica (uma área, ou **todas as
fábricas**; abre com "selecionar fábrica…"), ano, OEE —, mais o cenário, que
nasce no que está **no ar** na tela de Demanda e pode ser trocado aqui.

### Como ler

- Ocupação **acima de 100%** = o plano pede mais do que cabe. Abaixo = folga.
- A ocupação de um período é sempre **Σ demanda ÷ Σ disponível** — a do ano
  não é a média dos meses.
- CT com demanda e **sem capacidade** aparece com barra zero e ocupação
  infinita/vazia: ou o CT não tem recurso cadastrado com aquele CC-CT, ou tem e
  não foi recalculado. A tela de Demanda lista esses CTs em *demanda sem
  capacidade*.

### A aba "Ocupação por centro de trabalho (Tab. Din.)"

A mesma ocupação, no grão **CT × mês**, como tabela dinâmica: agrupar por
Planta, Área, CC, CT e Mês na ordem que quiser, abrir e fechar grupos, e
escolher a agregação (soma, média, mediana, máximo, mínimo, contagem) da
capacidade e da demanda. A agregação vale para as linhas CT × mês do grupo.
**A ocupação é sempre Σ demanda ÷ Σ capacidade do grupo**, seja qual for a
função escolhida — média de ocupações não é ocupação. Recurso não é nível
aqui: a demanda é do CT e não se reparte entre os recursos dele.

### Cuidados

- Depende de **duas** coisas estarem atualizadas: a rodada (Recalcular) e a
  carga no ar (Demanda). Importar uma base nova **não** a põe no ar.
- O rodapé mostra a rodada e o recálculo parcial, como no outro painel.

---

## Plantas e Áreas

**Menu:** Estrutura da empresa › Plantas · Áreas.

### Plantas

As unidades fabris. Toda área pertence a uma planta, e turno é por planta.
Cadastro simples: nome. Planta com área não se apaga.

### Áreas

Os setores de cada planta. **A planta é escolhida na criação e não muda
depois** — área na planta errada se resolve criando a certa e movendo o que
for preciso, não editando.

A área é a unidade da **rodada** de cálculo (uma rodada por área, ano e
origem) e do recorte dos painéis. É também o alcance das **exceções de
calendário**: feriado marcado para uma área não vale para outra.

### Cuidados

- Área com recurso não se apaga.
- Duas áreas com o mesmo nome em plantas diferentes é permitido; por isso os
  seletores mostram `Planta · Área`.

---

## Recursos

**Menu:** Estrutura da empresa › Recursos. As máquinas e os postos de pessoas.

### Campos

| campo | o que é |
|---|---|
| **Área** | escolhida na criação, não muda depois |
| **Código** | só leitura: `CC-CT-Patrimônio` concatenado |
| **Nome** | livre, ex.: "Texturizadeira 01" |
| **Sub-área** | texto livre, opcional; só agrupa na leitura |
| **Tipo** | **MÁQUINA** ou **PESSOA** — ver abaixo |
| **CC / CT / Patrimônio** | a identidade na controladoria; a trinca não se repete |
| **Qtd** | quantas máquinas iguais este recurso representa (só máquina) |
| **Equivalência** | fator que multiplica a capacidade (1 = normal) |
| **Em operação de … até** | a janela em que a máquina existe |
| **Ativo** | recurso desativado sai das telas, mas fica na história |

### O que o Tipo decide

- **Intervalo de refeição**: máquina não para para almoçar; pessoa para.
- **Teto**: máquina tem instalada de 24 h × Qtd, todo dia. Pessoa não tem
  teto — a instalada é a planejada — e **não tem Qtd**: quantas pessoas
  trabalham é um número **por turno**, em Turnos do recurso.
- Trocar o tipo muda o "% do teto" no próximo Recalcular.

### Em operação de … até

Fora da janela o motor **não gera linha nenhuma, nem instalada**. Máquina que
chega em julho: `01/07` no primeiro campo, e ela some dos seis primeiros
meses. Máquina vendida: último dia no segundo campo. Os dois em branco =
sempre (o caso comum). Cadastre a máquina **antes** de ela chegar: com a
janela preenchida, turno e OEE podem ser configurados na frente sem sujar o
número de hoje.

### Exportar / Importar .xlsx

A tabela inteira vai para o Excel e volta, com a mesma estrutura. Regras da
volta:

- A chave é a trinca CC-CT-Patrimônio: trinca nova **cria**, existente
  **altera**, linha ausente do arquivo **fica intocada** (importar nunca apaga).
- Planta ou área que não existe → a linha é **ignorada e avisada**.
- Recurso existente **não muda de área** por aqui.
- Ativo aceita sim/não em qualquer grafia (maiúscula, acento).
- Pessoa vai com Qtd vazia e volta com Qtd 1.
- A prévia mostra o que vai criar, alterar, ignorar — confira antes de aplicar.

### Cuidados

- Excluir um recurso que já entrou em alguma rodada não apaga: **desativa**
  com a vigência fechada em hoje. Apagar de vez é pelo painel de desativados.
- O aviso *"recurso sem parâmetro de capacidade"* significa que a linha de
  Qtd/Equivalência não existe: **Editar › Salvar** no recurso cria a linha;
  depois recalcule.
- **Recurso novo não aparece em nada até Recalcular.**

---

## Turnos

**Menu:** Estrutura da empresa › Turnos. Por planta.

### Para que serve

Criar e excluir turnos e definir **início e fim por dia da semana**, com o
intervalo de refeição. Turno novo nasce com a **semana zerada**: sem horário,
não roda em dia nenhum.

### Regime sugerido (opcional)

Cada turno pode **apontar um calendário** — por exemplo, o turno de rodízio
apontando o regime *Rodízio*. É só uma opinião: quem vale no cálculo é o regime
do **recurso**, mês a mês, na tela de Turnos do recurso.

O que ele faz: quando alguém marcar esse turno num mês que está em outro
regime, aquela tela mostra os meses e um botão para trocar em um clique. É a
segunda metade de "essa máquina passa a rodar em rodízio em julho" — a que
costuma ficar para trás.

- Só calendários **da planta do turno** aparecem no seletor.
- **Em branco é o normal**: turno sem sugestão não propõe nada.
- Dois turnos marcados no mesmo mês apontando calendários diferentes viram um
  aviso de conflito, e a escolha continua sendo sua.

### Como ler

- Turno de 24 h (rodízio) cobre o dia inteiro; não marque junto com 1º, 2º e
  3º no mesmo recurso — soma mais de 1.440 min e a planejada estoura o teto.
- O horário que atravessa a meia-noite (22:30 → 05:00) conta os minutos no
  **dia em que começa**. Por isso a segunda-feira de um recurso de três turnos
  pode ter planejada diferente da terça: o 3º turno de domingo não existe, e o
  de segunda é que "paga" a madrugada de terça.
- O intervalo de refeição desconta para **pessoa**; máquina não para.

### Cuidados

- Turno usado em Turnos do recurso não se exclui.
- Mudar horário de um turno muda todos os recursos que o usam — e só aparece
  depois de Recalcular.

---

## Calendários

**Menu:** Estrutura da empresa › Calendários. Por planta; a grade do ano é por
área.

### Para que serve

O **regime** de cada linha: os dias da semana em que trabalha (padrão ×
rodízio), os **feriados e exceções** da área, e a contagem de **dias úteis**
com peso por dia da semana.

### Partes da tela

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

### Cuidados

- Calendário seguido por algum recurso **não pode ser apagado**: o recurso
  ficaria sem regime e sumiria do cálculo em silêncio.
- Exceção que "não alcança ninguém" é a que nenhum recurso da área segue
  naquele calendário — a tela avisa.
- Mudou feriado ou regime? **Recalcular.**

---

## Turnos do recurso

**Menu:** Planejamento da capacidade › Turnos do recurso.

### Para que serve

Dizer, para cada recurso e cada mês do ano, **quais turnos ele roda e com
quantas máquinas (ou pessoas)** — e qual **calendário (regime)** ele segue.
É a tela que transforma instalada em planejada.

### Seletores

**Planta › Área › Cenário › Tipo (máquina/pessoa) › CC › CT › Patrimônio ›
Código › Recurso › Ano.** O Tipo nasce em **máquina**; se a área também tem
pessoas, a tela avisa que elas não aparecem — troque o Tipo para cadastrá-las.
Máquina e pessoa **nunca dividem a mesma matriz**.

**O Cenário é o corte mais importante desta tela.** Orçamento e Simulação são
planos isolados, e o que você marcar aqui vale **só para o cenário selecionado**.
Ele aparece como selo ao lado do título da matriz, não só no seletor — cadastrar
a jornada inteira de um recurso no cenário errado não dá erro nenhum: dá um
painel certo e outro vazio, e a descoberta vem semanas depois. A tela abre em
**Simulação**.

### A matriz

Linhas = meses; a **primeira coluna é o regime de dias** e as seguintes são os
turnos.

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

### Regime de dias (a primeira coluna)

Em que **dias** o recurso pode rodar: **Padrão** (segunda a sábado) ou
**Rodízio** (todos os dias) — a legenda embaixo da tabela diz o que cada nome
cobre naquela planta. Os turnos marcados só produzem capacidade nos dias que o
regime permite.

**Ele é por mês**, como os turnos. É assim que se cadastra a máquina que roda em
três turnos até junho e passa para rodízio full time em julho: o rodízio tem
outros feriados, e o ano inteiro num regime só erraria metade do ano.

- O seletor no **cabeçalho da coluna** aplica o mesmo regime aos doze meses —
  é o caso comum; o mês a mês existe para a exceção.
- O regime é salvo pelo **mesmo botão Salvar** da matriz.
- **Vale só para o ano escolhido.** Trocar julho de 2027 para rodízio não mexe
  em 2028: lá continua o que já estava.
- **Limpar turnos do ano não mexe no regime** — turno se apaga, regime não.

No **lote** a coluna começa em branco, e mês em branco **não mexe** no que cada
recurso já tem: dá para trocar só julho a dezembro dos 40 recursos sem tocar no
primeiro semestre de nenhum.

#### Quando o turno sugere um regime

Se o turno marcado tem um **regime sugerido** (cadastrado na tela de Turnos) e
o mês está em outro regime, aparece um aviso com os meses e o botão **Aplicar o
regime sugerido em N mês(es)**. É uma proposta: nada muda até você clicar, e
ignorá-la também é resposta — quem vale no cálculo é a coluna, não o turno.

Se dois turnos marcados no mesmo mês sugerem regimes diferentes, a ferramenta
não escolhe: diz quais são e deixa a decisão na coluna.

### Como conferir

Marcar o turno é necessário, mas não basta. Para o recurso produzir num dia:
**o turno tem horário naquele dia da semana** (tela de Turnos) **e o regime
daquele mês trabalha naquele dia** (Calendários). Descendo até o dia no Painel
da Capacidade dá para ver qual dos dois fechou.

### Cuidados

- **Turnos sobrepostos**: a tela avisa quando, num mês e dia da semana, os
  turnos marcados somam mais de 24 h (costuma ser o turno de 24 h marcado junto
  com os que ele já cobre). O motor soma, e a planejada passa da instalada.
- O ano é sempre um só; para o ano seguinte, troque o Ano e cadastre de novo
  (a vigência é por mês). Vale para os turnos **e** para o regime.
- **Mês sem regime** aparece com a borda amarela e um aviso embaixo da tabela.
  Não é capacidade zero: é o recurso **sumindo** do cálculo naquele mês, sem
  zerar nada e sem erro em lugar nenhum. Escolha o regime e salve.
- **Recalcular** depois.

---

## OEE

**Menu:** Planejamento da capacidade › OEE.

### Para que serve

O percentual, por recurso e mês, que transforma **planejada em disponível**.
Duas origens, **META** e **SIMULADO**, cadastradas lado a lado; instalada e
planejada são iguais nas duas, só a disponível muda.

### Como usar

Mesmos seletores das outras telas de planejamento (planta, área, CC, CT…, ano).
Digite o percentual por mês; *repetir no ano* copia o valor nos doze meses.
Recurso novo já nasce com **100%** nas duas origens. Com *todos os
filtrados*, a lista de chips acima da tabela diz quem entra no lote — clique
para tirar, **nenhum**/**todos** para escolher só alguns.

### Cuidados

- **Mês em branco vale 0%** e a disponível daquele mês **zera**. É de
  propósito: o buraco aparece em vez de virar um número crível e falso.
- **Setup não é parada.** Já está embutido aqui; não cadastre em Paradas.
- O painel lê o OEE da **rodada**, não do cadastro. OEE alterado hoje com
  rodada de ontem mostra o de ontem até Recalcular.

---

## Paradas

**Menu:** Planejamento da capacidade › Paradas.

### Para que serve

Paradas **planejadas de um recurso**: preventiva, preditiva, férias coletivas,
obra, inventário. Muda toda semana — é a tela mais viva do planejamento.

### Como usar

Escolha área e ano; estreite por CC, CT, código ou recurso; escolha o tipo, o
período (data ou intervalo), os turnos atingidos e os **minutos por turno**.
Escolhendo *todos os filtrados* no Código ou no Recurso, a mesma parada entra
em cada um deles — estreite antes, porque o alcance é o filtro de cima, e
tire da lista de chips os que não entram (**nenhum**/**todos** para escolher
só alguns).

### Cuidados

- **Minutos é sempre por turno.** Parada de dia inteiro vai em minutos iguais
  ao turno, ou — se atinge a área inteira — como **exceção** em Calendários.
- **Setup não entra** (está no OEE).
- **Apagar remove de verdade**: parada não tem vigência. O número já calculado
  fica na rodada anterior até o próximo Recalcular, então dá para comparar.
- Parada num dia que o calendário não trabalha não desconta nada — o dia já
  era zero.
- **Recalcular** depois.

---

## Demanda

**Menu:** Conversão da capacidade › Demanda.

### Para que serve

Importar a **base de demanda** da controladoria (arquivo `.parquet`), guardar
cada importação como uma **carga** com nome de cenário, escolher qual está
**no ar**, e explorar o cruzamento demanda × capacidade.

### Importar

O arquivo é lido **no navegador** e enviado em lotes. Cada importação vira uma
carga nova; a anterior fica guardada. A carga tem **observação** — grave o que
a distingue ("sem o pedido X", "reprocesso do ciclo anterior") porque daqui a
um mês duas cargas com o mesmo nome não se distinguem de outro jeito.

### Quantos cenários cabem: 4

A ferramenta guarda **no máximo 4 cargas ao mesmo tempo**. Com 4 importadas, o
botão de escolher arquivo fica desligado até você apagar uma.

Não é preciosismo: cada cenário são ~140 mil linhas e uns **30 MB permanentes**
do banco, e **nenhum sai sozinho** — importar nunca apagou nada. Foi assim que
quatro ciclos de S&OP viraram um terço do banco sem ninguém decidir isso. O
limite força a escolha de qual não serve mais a ser feita **agora**, e não meses
depois, quando faltar espaço para o ano de orçamento e ninguém relacionar uma
coisa com a outra.

Quatro cobre o uso real: os dois últimos ciclos, o orçamento em construção e um
de comparação.

### No ar

**A carga no ar é a que o Painel da Ocupação usa.** Importar **não** troca
sozinho; marcar *no ar* é que troca — de propósito, para o número que alguém
está olhando não mudar porque outra pessoa importou um arquivo. A carga no ar
não pode ser apagada.

### Explorar

- **Demanda sem capacidade** — CTs que o plano pede e que não têm recurso
  cadastrado com aquele CC-CT (ou têm e não foram recalculados). Ordenada por
  peso: é a fila do que falta cadastrar. Nada precisa ser reimportado: cada
  recurso cadastrado faz a linha passar a valer sozinha (depois de Recalcular).
- **Capacidade sem demanda** — máquina cadastrada que o plano não usa. Pode ser
  numeração a acertar ou recurso que não entra neste cenário; nenhum é defeito.
- **Índice** — o índice de conversão por CT e mês (quantidade ÷ minutos), com
  a origem dele: próprio, herdado do CT irmão, média do CC, ou nenhum.
- Linhas **com quantidade e sem tempo de roteiro** não convertem — a conversão
  é quantidade ÷ minutos.

### Cuidados

- Base nova → conferir *demanda sem capacidade* → cadastrar o que falta →
  **Recalcular** → pôr no ar → só então avaliar ocupação e simulador.
- Trocar a carga no ar muda o índice, e com ele metro e UM nos painéis.

---

## DE/PARA e Ajuste de mix

**Menu:** Conversão da capacidade › DE/PARA · Ajuste de mix.

### DE/PARA

Traduz a língua da base (códigos, descrições) para a da empresa: **rótulos e
agrupamentos por regra**, com a prévia de quantas linhas cada regra pega. É o
que alimenta o **filtro por atributo** dos painéis.

A capacidade é do **recurso** e o atributo é da **linha de demanda**: filtrar
por um rótulo soma a *fatia* de cada CT que aquele rótulo ocupa. As fatias de
um CT somam 1, e é isso que faz a soma dos rótulos fechar com o total.

### Ajuste de mix

O **mix** calculado da carga (a proporção de cada material/produto em cada CT
e mês), ajustável à mão. Onde existe ajuste, **ele ganha da base** — e
reimportar a demanda **não mexe** nele. Mexer no mix muda o índice de
conversão, e com ele metro e UM.

### Cuidados

- Ajuste esquecido de um ciclo anterior continua valendo no seguinte. Revise a
  tela quando importar base nova.
- Nenhuma das duas telas muda a capacidade em **minutos** — só como ela é
  lida.

---

## Extração para o AP

**Menu:** Extração › Extração para o AP.

### Para que serve

A capacidade calculada no formato que o sistema de planejamento (AP) importa:
`.csv` com **CT; Período (AAAA.MM); CT_Periodo; Minutos; Qtd. Recurso AP;
Capacidade por recurso do AP**, condensado por mês. A chave `CT|Periodo` já
vai concatenada, pronta para PROCV do outro lado.

### Como usar

Filtre planta › área › CC › CT (sem filtro sai tudo), escolha ano e origem de
OEE, **Gerar extração**, confira a prévia (30 linhas; o arquivo leva todas) e
baixe. Cada área e ano entram com a **última rodada** do OEE escolhido — a
mesma que o painel mostra.

### Qtd. Recurso AP

A quantidade de recursos que o AP conta em cada CT, importada da tela ao lado
(**Importar AP**). A *capacidade por recurso* é os minutos divididos por ela.
Linha sem quantidade sai com essa coluna vazia.

### Cuidados

- É a rodada: cadastro não recalculado não sai.
- Minutos, sempre — o AP não recebe metro nem UM.

---

## Extração das configurações

**Menu:** Extração › Extração das configurações.

### Para que serve

Um documento `.pptx`, **dentro do modelo de slides da empresa**, contando como
a fábrica está configurada num recorte e quanta capacidade isso produz: por
recorte inteiro, por CC, por CT, ou a apresentação completa (planta, áreas, e
cada CC seguido dos seus CTs).

### Modelo

Importe o `.pptx` da empresa **uma vez**, com uma caixa de texto contendo a
marca indicada na tela, do tamanho do corpo do slide — é o retângulo dela que
o gráfico ocupa. Os outros slides passam intactos; o slide da marca é
repetido, um por grupo.

### O que entra

Árvore **planta › área › CC**: marcar um nível marca tudo abaixo; o mesmo
botão desmarca. **As marcações não ficam na URL** — recarregar a página perde
o recorte.

### Como sai

Slides (resumo / por CC / por CT / apresentação), ano, período de mês a mês,
capacidade (disponível, planejada, instalada) com OEE meta ou simulado, unidade
(minuto, metro, UM — metro e UM só com cenário), demanda (um cenário ou
nenhum), e as **faixas de cor** da ocupação.

Cada slide leva o gráfico mês a mês (barras de capacidade, linha de demanda)
e, alinhada coluna a coluna, uma grade com o OEE e a quantidade de recursos
por turno — para ver se a barra de março caiu pelo OEE ou por um turno a menos.
**Todos os turnos cadastrados** aparecem como linha; onde o recurso não roda
naquele turno a célula fica em branco. Com cenário, a grade traz demanda,
ocupação e **sobra / falta** (capacidade − demanda: `+` sobra, `−` falta), o
mesmo número do Painel da Ocupação.

### Cuidados

- O `.pptx` é montado no navegador; o servidor só entrega os números.
- Mais de 60 slides sai, mas demora e dá arquivo grande.
- É a rodada: cadastro não recalculado não aparece.

---

## Simulador de recursos

**Menu:** Extração › Simulador de recursos.

### Para que serve

Responder **"com quantas pessoas (ou máquinas) por dia este CT atende a
demanda do cenário?"** — num `.xlsx` **com fórmulas**, para simular no Excel.
A ferramenta não simula na tela de propósito: o que você decidir se cadastra
pelo caminho normal (Qtd em Recursos para máquina, pessoas por turno em Turnos
do recurso) e se recalcula.

### Como usar

1. Marque o recorte na árvore planta › área › CC.
2. Ano, OEE (meta/simulado) e **cenário** (obrigatório — sem demanda não há o
   que dimensionar).
3. **Gerar prévia** — tabela por CT × ano com os valores da rodada.
4. **Baixar .xlsx**.

### A planilha — aba Por CT

Uma linha por CT e mês, mais uma linha **Ano** por CT. O disponível da rodada
aberto em fatores:

| coluna | o que é | editável? |
|---|---|---|
| Demanda (min) | do cenário | não |
| Dias úteis | os do motor (sem os "só apresentação") | não |
| Min planejados por unidade por dia | o turno líquido **médio** por dia útil, sem OEE | não |
| **OEE** | o da rodada | **sim** |
| Min disponíveis por unidade por dia | = planejados × OEE | fórmula |
| **Unidades por dia** | soma dos turnos: 10 no 1º + 8 no 2º = **18** | **sim** |
| Disponível (min) | = unidades × min disponíveis × dias úteis | fórmula |
| Ocupação calculada | = demanda ÷ disponível | fórmula |
| **Ocupação alvo** | nasce em 100% | **sim** |
| Unidades por dia necessárias | = (demanda ÷ dias úteis) ÷ min disponíveis ÷ alvo | fórmula |
| Planejado (min) · Unidades × dias úteis | auxiliares para a linha Ano e a aba Por CC | fórmula |

Com os valores da rodada, o disponível da fórmula é **exatamente** o do
painel. Mude OEE ou unidades e tudo à direita responde. **O alvo divide**:
a 85% precisa de mais gente que a 100%.

### Aba Por CC

As mesmas colunas, somando os CTs de cada CC por referência direta às linhas
da aba Por CT. Dias úteis do CC é o maior entre os CTs.

### Como ler

- **Unidades por dia** é a **soma dos turnos** — para máquina também: 3 de dia
  e 1 de noite aparecem como 4. Como dividir entre turnos é decisão sua na
  hora de cadastrar.
- **Min planejados por unidade por dia** é média: sábado tem 240 min e segunda
  480, e em janeiro dá 436. Isso **não é OEE**, é sábado. Varia de mês para
  mês porque a proporção de sábados varia.
- Aviso *"sem capacidade calculada para este CT"*: o CT não tem linha na
  rodada — ou não tem turno/calendário cadastrado, ou não foi recalculado.

### Cuidados

- **Recalcule antes de gerar.** O simulador lê a rodada; calendário, turno e
  OEE cadastrados agora só entram depois de Recalcular.
- A demanda tem que existir no ano escolhido — cenário com demanda só em 2026
  sai zerado em 2027.

---

## Usuários

**Menu:** Acesso › Usuários. Quem pode ver esta tela é quem tem o cargo com
`Usuários` marcado — normalmente só o Gestor de Planejamento.

### Para que serve

Convidar pessoas, dizer o **cargo** de cada uma (o que pode fazer) e o
**escopo** (onde: quais plantas e áreas), redefinir senha e desativar.

### Convidar

Botão **Convidar**: usuário (login, minúsculo, ex.: `maria.silva`), nome,
e-mail, cargo, **senha inicial** e o escopo. A senha segue a regra (mínimo 8,
maiúscula, minúscula, caractere especial) e a lista risca conforme cumpre.
Passe a senha inicial para a pessoa — **no primeiro acesso ela é obrigada a
trocar**.

O **e-mail** é o que reconhece quem entra pelo Hub S&OP: sem e-mail
cadastrado, a pessoa só entra pela senha.

### Onde atua (escopo)

- **Empresa inteira** — tudo, inclusive plantas e áreas criadas depois.
- **Planta inteira** — todas as áreas daquela planta, inclusive as futuras.
- **Áreas soltas** — só aquelas.

Sem nada marcado a pessoa não vê fábrica nenhuma. Turno e calendário são da
planta: quem tem só áreas soltas não os edita.

### Editar, redefinir, desativar

**Editar** troca nome, e-mail, cargo e escopo; a senha é opcional (em branco
mantém; preenchida redefine, e a pessoa troca no próximo acesso). O login não
muda. A caixa **Ativo** desativa: a pessoa não entra mais, mas a história
(quem convidou, último acesso) fica. Você não desativa a si mesmo, não tira o
próprio cargo, e o **último Gestor de Planejamento ativo** não sai do cargo.

### Cuidados

- Desativar ou trocar de cargo vale **na próxima tela** que a pessoa abrir —
  não é preciso esperar a sessão vencer.
- A senha mestre (`APP_SENHA`) continua entrando, sem usuário, com tudo. É a
  rede se o único gestor esquecer a senha.

---

## Cargos

**Menu:** Acesso › Cargos.

### Para que serve

Dizer **o que** cada cargo pode: uma grade com todas as telas e duas caixas
por tela — **ver** (abre e lê) e **editar** (grava) — mais a ação
**Recalcular**, à parte. A caixa no título de cada grupo marca o grupo inteiro.

- Marcar *editar* marca *ver* junto; desmarcar *ver* desmarca *editar*.
- O que o cargo não marca **some do menu** e é **recusado pelo servidor** —
  mesmo por quem souber o endereço da tela.
- **Recalcular** é separado de propósito: ver o painel não é o mesmo que
  refazer a capacidade da fábrica.

### Gestor de Planejamento

É o cargo **protegido**: tem todas as permissões, inclusive das telas que
ainda vão existir, e não pode ser apagado nem editado na grade. É a garantia
de que sempre existe alguém que pode tudo.

### Cuidados

- Cargo com usuários não se apaga; troque o cargo deles antes.
- Mudou a grade? Vale para todos os usuários do cargo na próxima tela que
  abrirem.
- **Onde** a pessoa atua (planta, área) não é do cargo — é do usuário, na
  tela de Usuários.

---

## Roadmap: Criar ticket e Meus tickets

**Menu:** Roadmap › Criar ticket · Meus tickets.

### Para que serve

O canal de quem usa a ferramenta. Dúvida sobre como algo funciona, sugestão de
melhoria, ou algo que não funcionou: abre-se um chamado de dentro da própria
ferramenta, e a resposta volta pelo mesmo lugar — em vez de conversa de
corredor, mensagem solta e e-mail, cada um num canto.

### Criar ticket

| campo | o que é |
|---|---|
| **Produto** | de qual parte da ferramenta o chamado fala: a **Ferramenta toda** (o padrão), um grupo do menu inteiro ("Extração — em geral") ou uma tela. Na dúvida, deixe a ferramenta toda — chutar a tela errada atrapalha mais. |
| **Tipo** | Dúvida · Sugestão · Bug/erro |
| **Resumo em uma linha** | o título do chamado; é o que aparece na lista |
| **A pergunta de baixo** | muda com o tipo: *Qual é a sua dúvida?* · *Qual é a sua sugestão?* · *O que aconteceu?* |

Em **Bug/erro** o campo pergunta *o que aconteceu* de propósito: o que conserta
um defeito é o passo a passo — a tela, a área, o mês, o que você clicou e o que
apareceu —, não a ideia de como resolver.

Depois de enviar, o chamado recebe um número e aparece em **Meus tickets**.

### Meus tickets

A fila, do mais recente para o mais antigo. **Você vê os seus chamados**; quem
cuida do roadmap (o **Gestor de Planejamento**) vê os de todo mundo, com uma
coluna a mais dizendo quem abriu.

- Os **chips** filtram por estado; *Em aberto* é o padrão, para o que já foi
  fechado não enterrar o que ainda espera.
- **Clicar numa linha** abre o texto inteiro do chamado e a resposta.
- Estados: **Aberto** → **Em análise** → **Feito** ou **Não vamos fazer**.
- Quem responde muda o estado e escreve a resposta ali mesmo; ela aparece na
  hora para quem abriu.

### Corrigir o que você escreveu

Abra o seu chamado e clique em **Editar o chamado**: dá para trocar produto,
tipo, resumo e descrição. Isso vale **enquanto ninguém respondeu** — depois da
resposta o botão some, porque editar a pergunta deixaria a resposta sem sentido
para quem ler depois. Se precisar acrescentar algo a um chamado já respondido,
abra outro ou fale com quem respondeu.

### Apagar (só quem cuida da fila)

O Gestor de Planejamento pode **apagar** um chamado, com confirmação. É para o
**chamado repetido** e para o **aberto por engano**.

O que não vai ser feito **se responde**, com "Não vamos fazer" e o porquê —
apagar a reclamação em vez de respondê-la é o jeito mais rápido de a fila ficar
vazia e ninguém mais abrir chamado nenhum.

### Cuidados

- Apagado é apagado: não há lixeira.
- Quem abriu continua vendo o chamado mesmo depois de fechado — é o registro de
  que foi respondido.
- Quem entra pela senha mestre abre chamados como "mestre"; todos os chamados
  da mestre ficam juntos, porque ali não há usuário para distinguir.

---

## Habilitação de cenário/ano

**Menu:** Planejamento da capacidade › Habilitação de cenário/ano.
Só o Gestor de Planejamento (ou quem ele autorizar) abre e fecha.

### Para que serve

O orçamento não é um evento, é um **ciclo**: começa em setembro, bate o martelo
em novembro ou dezembro, e no meio são três a seis versões, cada uma com mudança
de cadastro. Esta tela é onde esse ciclo acontece.

```
sem versão  --[Habilitar]-->  v1 aberta  --[Fechar]-->  v1 fechada
                                   ^                         |
                                   +------[Abrir a v2]-------+
```

**Sem versão aberta, o ano não é cadastrável** naquele cenário. Continua
**consultável**: painel, ocupação e extração mostram qualquer ano que tenha
rodada, inclusive de versões fechadas.

### Prontidão: o checklist antes de abrir

Antes de abrir uma versão, a tela confere o que é da **planta** — e isso vale
para os dois cenários, porque turno, calendário e feriado não têm cenário:

| item | o que ele pega |
|---|---|
| **Calendário** | a planta tem calendário, e ele tem dias da semana marcados |
| **Feriados do ano** | quantas exceções o ano tem, **comparado com o ano anterior** |
| **Turnos** | os turnos ativos têm horário em algum dia da semana |

**A regra do feriado é comparação, não um número fixo**: não existe "quantos
feriados são o certo" — depende da cidade, do ano, das emendas. Mas um ano com
muito menos que o anterior quase sempre é calendário que ainda não foi lançado.
Queda pequena não acusa de propósito: avisar por ruído treina a pessoa a ignorar
o aviso na vez que importa.

- **falta** desliga o botão de abrir. É cadastro ausente, e abrir assim produz
  número errado em silêncio.
- **alerta** deixa abrir, pedindo confirmação. O checklist informa, não tutela.

Por que isso existe: quem abrisse 2028 sem conferir teria dezenas de feriados
tratados como dia útil, e a capacidade sairia **inflada sem erro, sem aviso e
sem nada na tela denunciando**.

### Abrir uma versão

**A v1 exige todas as etapas** — não há nada revisado antes dela para aproveitar.

**Da v2 em diante você escolhe quais etapas a versão exige.** "A v4 só mexeu em
jornada e OEE" é uma decisão sua: o que não for marcado já nasce concluído em
todas as áreas. A ferramenta não adivinha o que mudou, e é melhor assim — ela
não tem como saber, e fingir que sabe seria pior que perguntar.

Dê um **rótulo** ("v2 — depois do corte da Renner"). O número sozinho não lembra
nada a ninguém daqui a dois meses.

### Fechar uma versão

Fechar faz duas coisas ao mesmo tempo:

1. **Tranca o cadastro** daquele cenário e ano — ninguém mexe mais.
2. **Guarda a fotografia**: o resultado por recurso e mês da rodada que está no
   ar. É ela que faz a comparação entre versões existir.

**Recalcule antes se mexeu em algo há pouco.** A foto sai da **rodada**, não do
cadastro — rodada velha vira foto velha, e depois de fechada ela não muda mais.

Fechar com áreas pendentes é possível e fica registrado: o martelo bate quando
bate.

### Comparar duas versões

Escolha **De** e **Para** entre as versões que têm fotografia, e a tabela mostra
planejada e disponível mês a mês, com a diferença.

Os números saem da **fotografia** de cada versão, não da rodada atual — por isso
eles não mudam quando alguém recalcula. O endereço da tela carrega as duas
versões escolhidas: mandar a comparação para alguém é mandar o link.

Só aparecem versões **com foto**. Uma versão fechada sem rodada nenhuma não tem
o que comparar, e mostrá-la daria zero — que se leria como queda de capacidade.

### O que a versão aberta libera (e a fechada tranca)

Com uma versão aberta, aquele ano aparece nos seletores de **Turnos do recurso**,
**OEE** e **Paradas** naquele cenário. Sem versão aberta ele não aparece, e a
tela diz o porquê em vez de mostrar um seletor vazio.

**Consultar nunca trava**: painel, ocupação e extração mostram qualquer ano com
rodada, inclusive de versões fechadas. Travar a leitura esconderia o número de
quem só quer olhar.

A trava também vale no servidor, e não só na tela — gravar num ano fechado
mudaria o cadastro sem mudar a fotografia, e o número aprovado na reunião
deixaria de bater com o que está no banco.

**Paradas é o caso especial**: ela não tem cenário (é a mesma nos dois), então o
ano fica liberado se **qualquer** um dos cenários o tiver aberto.

### Cuidados

- **Uma versão aberta por cenário e ano**, e é o banco que garante. Duas abertas
  seriam duas pessoas cadastrando coisas diferentes achando que é a mesma.
- Versão não se apaga. Apagar levaria junto a fotografia, que é o registro de um
  número que alguém já aprovou numa reunião.
- A fotografia é **mensal**, não diária. Ela responde "o que mudou da v3 para a
  v4"; não responde "o que mudou no dia 12 de março" — para isso é o painel, com
  a rodada atual.

---

## POP-01 — Cadastrar um recurso novo até ele aparecer no painel

### Quando usar

Chegou uma máquina, abriu um posto, ou a tela de Demanda mostra um CT em
*demanda sem capacidade*.

### Antes de começar

- Planta e área existem (Estrutura da empresa › Plantas · Áreas).
- Os turnos da planta existem **com horário por dia da semana** (Turnos).
- Existe um calendário (regime) na planta com os dias da semana marcados
  (Calendários).
- Você sabe CC, CT e Patrimônio da máquina — é assim que a demanda vai achar
  o recurso.

### Passos

1. **Recursos › novo**: área, nome, tipo (máquina/pessoa), CC, CT, Patrimônio;
   Qtd e Equivalência se máquina; janela *Em operação de … até* se a máquina
   não existe o ano inteiro. Salvar.
2. **Turnos do recurso**: selecione a área, o **Tipo** certo, o recurso e o
   ano. Marque os turnos (ou digite quantas máquinas/pessoas por turno) mês a
   mês — a caixa *→ ano todo* ajuda. Confira o **regime de dias** na primeira
   coluna: o recurso nasce em *Padrão*, e quem é rodízio troca ali (o seletor
   do cabeçalho aplica aos doze meses). Salvar.
3. **OEE**: o recurso já nasce com 100% nas duas origens. Ajuste se souber o
   OEE real; a caixa *→ ano todo* repete.
4. **Paradas**: só se já houver parada planejada conhecida.
5. **Painel da Capacidade › Recalcular parcial…**: planta, área, e o recurso;
   ano e origem *todos*. Rodar.

### Como conferir que deu certo

- Painel da Capacidade, área e ano do recurso: ele aparece na tabela por
  recurso, com instalada (máquina) e planejada > 0 nos meses em que tem turno.
- Desça a um mês e a um dia: a planejada do dia bate com o turno líquido ×
  quantidade.
- Se o CT tem demanda: Painel da Ocupação mostra a barra do CT; a tela de
  Demanda não o lista mais em *demanda sem capacidade*.

### O que costuma dar errado

- **Não recalculou** → o recurso não aparece em lugar nenhum. Passo 5.
- **Planejada zero** com turno marcado → o turno não tem horário naquele dia
  da semana (Turnos) **ou** o regime daquele mês não trabalha naquele dia
  (Calendários).
- **O recurso some de alguns meses** (nem aparece na tabela) → aqueles meses
  estão **sem regime de dias**. A tela de Turnos do recurso marca em amarelo.
- **Pessoa não aparece em Turnos do recurso** → o seletor Tipo está em
  máquina; troque para pessoa.
- **Demanda continua sem capacidade** → CC ou CT digitado diferente da base
  (zero à esquerda, espaço). Confira o Código do recurso contra o CT da base.
- **Aviso "sem parâmetro de capacidade"** → Editar › Salvar no recurso e
  recalcular.

---

## POP-02 — Cadastrar pessoas por turno

### Quando usar

Recurso do tipo **PESSOA** (posto de confecção, revisão, embalagem…): a
capacidade é gente escalada, não máquina existente.

### Antes de começar

- O recurso está cadastrado com Tipo = PESSOA (Recursos). Ele **não tem Qtd**.
- Os turnos têm horário e intervalo de refeição (Turnos): pessoa para para
  almoçar; o intervalo desconta.

### Passos

1. **Turnos do recurso**: área, **Tipo = pessoa** (o seletor nasce em máquina
   e avisa quando há pessoas na área), recurso, ano.
2. Em cada turno, digite **quantas pessoas** trabalham em cada mês. Sem teto:
   12 no 1º e 20 no 3º é legítimo. A caixa *→ ano todo* preenche os doze
   meses. Vazio = ninguém naquele turno.
3. Regime de dias, na primeira coluna — por mês, ou os doze de uma vez pelo
   seletor do cabeçalho. Salvar (ele vai junto com os turnos).
4. OEE, se diferente de 100%.
5. **Recalcular parcial** para o recurso.

### Como conferir que deu certo

- No painel, a **instalada é igual à planejada** para pessoa — é assim que se
  reconhece um recurso de gente.
- No Simulador de recursos, a coluna *Unidades por dia* mostra a soma dos
  turnos (10 + 8 = 18).

### O que costuma dar errado

- Cadastrar pessoas em lote com *todos os filtrados* → o lote é só de
  máquina; pessoa é uma a uma.
- Mudar a equipe no meio do ano → digite o número novo a partir do mês da
  mudança; os meses anteriores ficam com o número antigo (a vigência é por
  mês).
- Posto com OEE cadastrado e **sem turno** → não gera capacidade nenhuma e
  não aparece no simulador. Falta o passo 2.

---

## POP-03 — Importar uma base de demanda nova

### Quando usar

A controladoria mandou uma base nova (novo ciclo, novo cenário, correção).

### Antes de começar

- O arquivo `.parquet` com as colunas de sempre.
- Um nome de cenário e uma **observação** que a distinga daqui a um mês.

### Passos

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

### Como conferir que deu certo

- Painel da Ocupação com a barra de capacidade e a linha de demanda nos meses
  esperados, na área que você conhece.
- Simulador de recursos: os CTs com demanda aparecem com disponível > 0 e
  ocupação calculada.

### O que costuma dar errado

- **Importou e a ocupação não mudou** → a carga não está *no ar* (passo 6).
- **Tudo com capacidade zero** → não recalculou (passo 5), ou os recursos
  ainda não têm turno/calendário (POP-01).
- **Metro e UM sumiram dos painéis** → a carga no ar não tem índice para
  aqueles CTs (linhas com quantidade e sem tempo de roteiro).
- **Demanda de um ano só** → o cenário pode ter minutos só em um ano; em outro
  ano tudo sai "sem demanda no cenário". Não é defeito.

---

## POP-04 — Recalcular (tudo ou parcial)

### Quando usar

**Sempre que mudou cadastro** — recurso, turno, calendário, feriado, turnos do
recurso, OEE, parada — e antes de avaliar qualquer número: painel, ocupação,
extração, simulador. A ferramenta **não recalcula sozinha**.

### Antes de começar

- Saber o que mudou: um recurso, uma área, ou muita coisa.
- Deixar a aba do navegador aberta até o fim: o laço roda no navegador, uma
  requisição por rodada.

### Passos — Recalcular tudo

1. Painel da Capacidade › **Recalcular tudo**.
2. Aguarde: são todas as áreas × anos × origens (dezenas de rodadas, alguns
   minutos). A tela mostra o progresso e, no fim, quantas rodadas deram certo
   e quais ficaram vazias.

### Passos — Recalcular parcial

1. Painel da Capacidade › **Recalcular parcial…**.
2. No pop-up, estreite: planta › área › CC › CT › patrimônio › código ›
   recurso; **ano** e **OEE** (ou *todos*). O rodapé diz quantas rodadas serão
   tocadas e explica a conta: áreas × anos × origens — em cada uma o motor
   regrava só os recursos do recorte.
3. Rodar.

### Como conferir que deu certo

- O rodapé do painel mostra a data/hora da rodada e, no parcial, a data do
  **recálculo parcial**.
- O número que você esperava mudar mudou.

### O que costuma dar errado

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

---

## POP-05 — Simular quantidade de recursos para uma demanda

### Quando usar

Base nova, cenário novo, ou a ocupação de um CC passou de 100% e a pergunta é
"quantas pessoas (ou máquinas) por dia eu precisaria?".

### Antes de começar

- Os recursos do recorte têm turno, calendário e OEE cadastrados **e a rodada
  está recalculada** (POP-04). O simulador lê a rodada, não o cadastro.
- O cenário de demanda está importado (não precisa estar no ar) e tem
  demanda no ano que você vai simular.

### Passos

1. **Extração › Simulador de recursos**: marque o recorte na árvore.
2. Ano, OEE, cenário. **Gerar prévia**.
3. Leia a prévia: CTs com aviso *sem capacidade calculada* ainda não têm
   rodada (turno/calendário faltando ou não recalculado) — resolva antes, ou
   siga sabendo que eles sairão zerados.
4. **Baixar .xlsx** e abrir no Excel. As fórmulas calculam ao abrir.
5. Na aba **Por CT**, mexa só nas células destacadas: **OEE**, **Unidades por
   dia** e **Ocupação alvo**. Disponível, ocupação calculada e unidades
   necessárias respondem. A aba **Por CC** soma os CTs.
6. Decidido o número, cadastre na ferramenta: máquina → **Qtd** em Recursos;
   pessoa → **pessoas por turno** em Turnos do recurso, dividindo as unidades
   por dia entre os turnos como quiser. **Recalcular** e conferir no Painel da
   Ocupação.

### Como conferir que deu certo

- Sem mexer em nada, a coluna *Disponível (min)* da planilha é igual ao
  disponível do Painel da Capacidade para aquele CT e mês.
- *Unidades por dia* é a soma das quantidades por turno que você cadastrou
  (10 + 8 = 18).

### O que costuma dar errado

- **Baixou e veio tudo zerado / "sem capacidade calculada"** → cadastrou
  calendário, turno e OEE mas **não recalculou**. É a pegadinha número um.
- **"Min planejados por unidade por dia" parece ter OEE** (436 em vez de
  480) → é a média com os sábados de 240 min; o OEE está na coluna ao lado.
- **Alvo de 85% deu menos unidades que 100%** → não deveria: o alvo divide.
  Confira se a célula está em percentual (0,85) e não em 85.
- **Demanda zero** → o cenário não tem minutos naquele ano.

---

## POP-06 — Cadastrar ou alterar recursos em massa pelo Excel

### Quando usar

Uma leva de recursos novos vinda de uma planilha da controladoria, ou uma
correção em muitos ao mesmo tempo (CC, nome, sub-área, ativo).

### Antes de começar

- Plantas e áreas de destino existem com o nome **exato** (a importação casa
  pelo nome).

### Passos

1. **Recursos › Exportar .xlsx**: baixa a tabela atual, com cabeçalho e
   estrutura fixos. CC, CT e Patrimônio saem como **texto** — o zero à
   esquerda sobrevive.
2. Edite no Excel: acrescente linhas (recursos novos) ou altere as existentes.
   Não mude o cabeçalho. Ativo aceita sim/não em qualquer grafia. Pessoa vai
   com Qtd vazia.
3. **Importar .xlsx**: a prévia diz quantas linhas vão **criar**, **alterar**,
   quantas estão **iguais** e quais foram **ignoradas** (e por quê). Confira.
4. Aplicar.
5. Turnos do recurso, OEE e **Recalcular** para os recursos novos (POP-01, a
   partir do passo 2).

### Como conferir que deu certo

- A tabela de Recursos tem as linhas novas com o Código montado.
- Nenhuma linha "ignorada" na prévia que você não esperava.

### O que costuma dar errado

- **Linha ignorada por planta/área desconhecida** → nome diferente do
  cadastro (espaço a mais, acento). Corrija no Excel e importe de novo.
- **"Trinca já existe"** → dois recursos com o mesmo CC-CT-Patrimônio; mude o
  patrimônio de um deles.
- **Recurso apareceu na área errada** → a área de um recurso existente **não
  muda** pela importação; só na criação.
- **Linha apagada no Excel não apagou o recurso** → importar nunca apaga;
  desative pela tela.

---

## POP-07 — Máquina que chega, sai, ou muda de quantidade no meio do ano

### Quando usar

Compra, venda, transferência, ou a Qtd de máquinas iguais mudou.

### Passos

- **Chega em julho**: cadastre já, com *Em operação de* = `01/07`. Configure
  turnos e OEE normalmente. Ela some dos seis primeiros meses — nem instalada
  — e entra inteira em julho. Recalcular.
- **Sai em setembro**: *até* = último dia de operação. Recalcular. O recurso
  continua na tabela e na história.
- **Qtd muda** (de 3 para 4 máquinas): edite a Qtd em Recursos. Nos turnos em
  que estava "todas" (número igual à Qtd antiga), a quarta acompanha sozinha;
  onde havia um número menor, ele fica. Confira em Turnos do recurso.
  Recalcular.
- **Trocou de área**: a área não muda; crie o recurso na área nova com a janela
  a partir da transferência e feche a janela do antigo.

### Como conferir que deu certo

- Painel da Capacidade: a instalada do recurso muda exatamente no mês da
  janela.

### O que costuma dar errado

- Fechar a janela e esquecer de recalcular → a máquina vendida continua
  produzindo no painel.
- Máquina que chega sem turno → instalada aparece, planejada zero. Falta
  Turnos do recurso.

---

## POP-08 — Convidar uma pessoa para a ferramenta

### Quando usar

Alguém novo vai usar o app, ou alguém vai passar a fazer mais (ou menos).

### Antes de começar

- Você está com um usuário do cargo **Gestor de Planejamento** (ou com a
  senha mestre).
- Existe um **cargo** com o que a pessoa vai fazer. Se não existe: Acesso ›
  Cargos › *+ novo cargo*, nome, marque as telas (ver/editar) e Recalcular
  se for o caso. Cargos típicos: *Leitor* (só ver nos painéis), *Planejador
  da área* (editar planejamento, ver o resto), *Controladoria* (editar
  demanda e extrações).

### Passos

1. **Acesso › Usuários › Convidar**.
2. Usuário (login, minúsculo — `nome.sobrenome`), nome, **e-mail** (o do Hub,
   para entrar pelo portal), cargo.
3. **Senha inicial**: a lista de regras risca conforme cumpre.
4. **Onde atua**: empresa inteira, planta(s) inteira(s) ou áreas soltas.
5. **Convidar**. Passe a senha inicial para a pessoa por um canal seguro.

### Como conferir que deu certo

- A pessoa aparece na tabela com o cargo e o escopo descritos ("Matriz
  inteira · Ibirama › Confecção Cama") e *senha inicial* ao lado do último
  acesso.
- Ela entra, é levada a **trocar a senha**, e depois vê só o menu do cargo e
  só as fábricas do escopo. O *senha inicial* some da tabela.

### O que costuma dar errado

- **"Sem acesso a esta tela"** → o cargo não tem `ver` naquela tela.
- **"Esta área está fora do seu escopo"** ao salvar → o escopo não cobre a
  área; edite o usuário e marque a área ou a planta.
- **"O que é da planta pede a planta inteira"** → turno/calendário só quem
  tem a planta inteira, não uma área solta.
- **Entrou pelo Hub e caiu em "Sem acesso"** → o e-mail cadastrado é
  diferente do e-mail do Hub (ou está vazio). Edite o usuário.
- **Não consigo desativar o gestor** → é o último gestor ativo; dê o cargo a
  outra pessoa antes.

---

## POP 09 — Planejar uma fábrica num cenário

**Quando usar:** sempre que um cenário e ano novo for aberto (o orçamento de
2028, uma simulação), e a cada versão nova dentro dele.

### Antes de começar

- O gestor abriu uma **versão** em Habilitação de cenário/ano. Sem versão
  aberta não há o que planejar, e o fluxo diz isso.
- Você tem as fábricas que atende no seu cadastro de usuário — o fluxo só
  mostra as do seu escopo.

### Passos

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

### Como conferir que deu certo

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

### O que costuma dar errado

- **A trilha some e aparece "não há versão aberta"** → o gestor fechou a versão,
  ou você trocou para um cenário que não tem nenhuma aberta.
- **Recalcular diz "a rodada saiu vazia"** → nenhum recurso da área tem jornada
  neste cenário e ano. Volte à etapa Jornada e regime.
- **Confirmei por engano** → o botão **desmarcar** tira a confirmação. Melhor
  desmarcar que deixar um visto que ninguém deu.
- **Caiu a internet no meio** → o que foi salvo está salvo; o que estava
  digitado e não salvo se perde. A trilha fica no servidor, então ao voltar o
  fluxo diz em que área e etapa você estava.

---

## 4. Perguntas e pegadinhas

Cada entrada tem a mesma forma: **sintoma** (o que se vê) · **causa** · **o
que fazer**. É a parte do manual que mais cresce com o uso — relate o tropeço
numa frase e ele entra aqui.

---

### Cadastrei calendário, turno e OEE, baixei o simulador e continuou "sem capacidade"

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

### Não vejo a tela X no menu (ou abre "Sem acesso a esta tela")

**Causa.** O seu cargo não tem `ver` naquela tela. O menu esconde e a página
nega — mesmo pelo endereço.

**O que fazer.** Peça ao gestor de planejamento que marque a tela no cargo
(Acesso › Cargos) ou que troque o seu cargo. Vale na próxima tela que abrir.

---

### Salvei e veio "Esta área está fora do seu escopo" / "pede a planta inteira"

**Causa.** O seu escopo (Onde atua, no cadastro de usuário) não cobre a área
da coisa que você tentou gravar; ou você tentou mexer em turno, calendário ou
feriado — que são da planta — tendo só uma área solta.

**O que fazer.** O gestor edita o seu usuário e marca a área ou a planta
inteira.

---

### Entrei pelo Hub S&OP e caí em "Sem acesso"

**Causa.** O e-mail que o Hub mandou não está em nenhum usuário ativo aqui.

**O que fazer.** O gestor cadastra (ou corrige o e-mail de) o seu usuário. A
página mostra o e-mail que chegou, para não haver dúvida de qual é.

---

### Fechei o navegador e pediu login de novo

**Causa.** É de propósito: a sessão é do navegador aberto, e o token vence em
12 h de qualquer jeito. Navegador configurado para "continuar de onde parou"
pode restaurar a sessão — é comportamento dele.

---

### Cadastrei turnos em lote para vários recursos e não consigo desfazer

**Sintoma.** Apliquei 3 turnos em 12 máquinas com *todos os filtrados*; para
tirar, a matriz do lote nasce vazia e o botão Aplicar fica desabilitado.

**Causa.** A matriz em lote é um molde e nasce em branco; vazia, não há
"alteração" para salvar.

**O que fazer.** Botão **Limpar turnos em N recurso(s)**, ao lado do Aplicar:
apaga os turnos do ano nos recursos da lista, com confirmação. Depois,
Recalcular.

---

### Quero 2 turnos em 4 máquinas e 3 turnos nas outras 5 do mesmo CT

**O que fazer.** Filtre o CT, escolha *todos os filtrados*; na lista de chips
acima da matriz clique em **nenhum** e marque as 4; monte a matriz e aplique.
Depois **nenhum**, marque as 5, monte a outra matriz e aplique. O mesmo vale
em OEE e Paradas.

---

### A planejada de segunda-feira é diferente da de terça, com os mesmos turnos

**Sintoma.** Recurso com três turnos: segunda dá 1.410 min, terça dá 1.440.

**Causa.** O 3º turno começa às 22:30 e termina às 05:00 do dia seguinte. Os
minutos contam no **dia em que o turno começa**. Domingo não tem 3º turno, e
por isso a madrugada de segunda não tem quem a "pague"; a de terça é paga pelo
3º turno de segunda.

**O que fazer.** Nada — está correto. É o horário cadastrado em Turnos.

---

### "Min planejados por unidade por dia" no simulador dá 436, e o turno é de 480

**Sintoma.** Parece que o OEE já está dentro do número.

**Causa.** É **média por dia útil**: 18 dias de 480 min e 4 sábados de 240 no
mês dão 436. O OEE está na coluna ao lado e entra só em *Min disponíveis por
unidade por dia*.

**O que fazer.** Nada. O número varia de mês para mês porque a proporção de
sábados varia.

---

### O CT não aparece no simulador (ou aparece sem minutos por unidade)

**Sintoma.** CT com demanda, recurso cadastrado, e a linha sai sem *min por
unidade* e com disponível zero.

**Causa.** O recurso tem OEE mas **não tem turno nem calendário** — o motor
não gera nenhuma linha para ele. Ou tem, e não foi recalculado.

**O que fazer.** Turnos do recurso (com o Tipo certo — pessoa ou máquina),
regime, e Recalcular parcial para ele.

---

### O ano sumiu do seletor em Turnos do recurso, OEE ou Paradas

**Causa.** Aquele ano não tem **versão aberta** naquele cenário. O cadastro
acontece dentro de uma versão: ou nenhuma foi aberta ainda, ou a última foi
fechada — e versão fechada é "ninguém mexe mais".

**O que fazer.** Peça ao gestor de planejamento para abrir uma versão em
**Habilitação de cenário/ano**. Se a anterior foi fechada de propósito e algo
precisa mudar, ele abre a próxima (a v2, a v3) marcando quais etapas ela exige.

Repare que **consultar continua funcionando**: o painel, a ocupação e as
extrações mostram qualquer ano que tenha rodada, fechado ou não.

---

### O painel do Orçamento está zerado (ou muito menor que o da Simulação)

**Causa.** Os dois cenários são **isolados** e cada um tem a sua jornada. O
Orçamento nasceu com as **máquinas** e o **regime de dias**, mas **sem turnos** —
eles são o que vem das fábricas. Sem turno não há planejada, e a instalada
aparece sozinha.

**O que fazer.** Turnos do recurso, com **Cenário = Orçamento**, e cadastre a
jornada. Depois **Recalcular**. Enquanto isso, o número que vale é o da
Simulação.

---

### Cadastrei os turnos e não mudou nada no painel

**Causa.** Antes de suspeitar de recálculo: confira em **qual cenário** você
cadastrou. Turnos do recurso abre em **Simulação**; se o painel está em
**Orçamento**, ele mostra outro plano — e o contrário também. Nenhum dos dois dá
erro, porque os dois cadastros são legítimos.

**O que fazer.** O cenário está no seletor e num selo ao lado do título da
matriz. Confira que ele é o mesmo dos dois lados, e recalcule.

---

### O recurso aparece em alguns meses e some em outros

**Sintoma.** No painel, a linha do recurso tem número de janeiro a junho e de
julho em diante ele não está lá — nem com zero.

**Causa.** Aqueles meses estão **sem regime de dias**. Zero é resposta; sumir é
o que acontece quando não há regime nenhum, porque o motor casa cada dia com o
calendário e, sem calendário, o dia não existe para aquele recurso.

**O que fazer.** Turnos do recurso, o ano em questão: os meses sem regime estão
com a borda amarela na primeira coluna, e há um aviso embaixo da tabela.
Escolha o regime, salve e **Recalcular parcial** para o recurso.

---

### Troquei o recurso para rodízio em julho e a capacidade de janeiro mudou também

**Causa.** Não deveria — o cadastro é por mês. Se o ano inteiro mudou, o
seletor usado foi o do **cabeçalho** da coluna, que aplica aos doze meses de
uma vez.

**O que fazer.** Cadastre mês a mês nas linhas, ou aplique no cabeçalho e
depois corrija os meses que continuam no regime antigo. O ano seguinte nunca é
afetado: o cadastro vale só para o ano escolhido.

---

### Não consigo importar: "já há 4 cenários, que é o máximo"

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

### Importei a demanda e a ocupação não mudou

**Causa.** Importar cria uma carga nova, mas **não a põe no ar**. O Painel da
Ocupação usa a carga marcada como *no ar*.

**O que fazer.** Demanda › marcar a carga nova como no ar. E recalcular, se
cadastrou recursos para os CTs novos.

---

### Recalcular parcial de um recurso disse "8 rodadas"

**Causa.** Rodada é por área × ano × origem. Um recurso em 4 anos × 2 OEEs =
8 rodadas, e em cada uma o motor regrava só aquele recurso.

**O que fazer.** Nada; ou estreitar ano e OEE no pop-up para rodar 1.

---

### Não consigo excluir um recurso

**Causa.** Recurso que já entrou em alguma rodada não se apaga: ele é
**desativado** com a vigência fechada em hoje, para a história continuar
fechando.

**O que fazer.** Aceitar a desativação. Apagar de vez é pelo painel de
recursos desativados, e só faz sentido para cadastro errado que nunca deveria
ter existido.

---

### Planejada maior que a instalada num mês

**Causa.** Turnos sobrepostos — normalmente o turno de 24 h marcado junto com
o 1º, 2º e 3º no mesmo recurso. A tela de Turnos do recurso avisa quais meses
e dias.

**O que fazer.** Desmarcar os turnos que sobram e recalcular.

---

### A disponível de um mês zerou e a planejada não

**Causa.** OEE em branco naquele mês vale **0%**.

**O que fazer.** Cadastrar o OEE do mês (a caixa *→ ano todo* ajuda) e
recalcular.

---

### Metro e UM sumiram do painel

**Causa.** Sem cenário no ar, ou o CT não tem índice de conversão (linhas com
quantidade e sem tempo de roteiro na base).

**O que fazer.** Pôr uma carga no ar; conferir em Demanda › Índice a origem do
índice daquele CT.

