# 1. Conceitos

Tudo na ferramenta é **minuto por recurso, por dia, por turno**. Os painéis
somam isso por mês, área, planta; as conversões traduzem para hora, metro ou
peça. Mas a conta nasce no minuto.

## As três capacidades

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

## OEE

Percentual, por recurso e por mês, em duas origens: **META** (o OEE que a
fábrica persegue) e **SIMULADO** (o que se quer testar). A instalada e a
planejada são iguais nas duas; só a disponível muda. **Setup já está dentro do
OEE** — não se cadastra setup como parada.

Mês sem OEE cadastrado vale **0%**, e a disponível daquele mês zera. Por isso
todo recurso novo nasce com 100% nas duas origens: o buraco tem que ser
anomalia, não o normal.

## CC, CT, Patrimônio e Código

**CC** (centro de custo), **CT** (centro de trabalho) e **Patrimônio** são a
identidade da máquina na controladoria. O **Código** do recurso é a trinca
concatenada e não se digita. A trinca não se repete entre recursos.

O vínculo entre a capacidade e a demanda é `CC-CT`: a base de demanda fala em
CT, e cada recurso com aquele CC e CT entra na conta daquele CT. Não existe
tabela de-para para isso — no instante em que um recurso é cadastrado com o
CC-CT certo, a demanda daquele CT passa a ter capacidade.

## Cenário: Orçamento e Simulação

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

## Versão do cenário

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

## Turno, calendário, dia útil

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

## Parada e exceção

- **Parada** é de um recurso, em **minutos por turno**, numa data ou período:
  preventiva, preditiva, obra, inventário, férias coletivas.
- **Exceção** é do calendário/área: feriado, ponte, dia trabalhado fora do
  padrão. Com efeito *para os recursos* ela zera (ou habilita) o **dia inteiro**;
  com efeito *só apresentação* a capacidade fica intacta e o dia aparece
  marcado na grade e na contagem de dias úteis.

## Demanda, carga e cenário

A **base de demanda** vem da controladoria (arquivo `.parquet`) e diz quanto
de cada CT o plano pede, por mês, em minutos de roteiro e em quantidade. Cada
importação é uma **carga**, com nome de **cenário**. A carga **no ar** é a que
o Painel da Ocupação usa; importar uma nova **não** troca sozinho — marcar no
ar é uma ação separada, de propósito.

O **índice de conversão** (metros por minuto, peças por minuto) sai da própria
demanda: Σ quantidade ÷ Σ minutos, por CT e mês. É ele que traduz capacidade
em metro ou peça. CT sem demanda não tem índice — e por isso não converte.

## Rodada e Recalcular

O motor grava o resultado numa **rodada por área, ano e origem de OEE**. A
rodada nova substitui a anterior; ninguém consulta rodada velha. **Recalcular
tudo** roda todas as áreas × anos × origens (uma requisição por rodada, com a
aba do navegador aberta); **Recalcular parcial** regrava só os recursos
escolhidos dentro da rodada que já existe, e carimba a data disso no rodapé
dos painéis.

**Nada é recalculado automaticamente.** Cadastro mudado sem Recalcular é
cadastro que o painel ainda não viu.

## Unidade de leitura

Os painéis mostram minuto, hora, **metro** e **UM** (unidade de medida do
material). Metro e UM só existem com um cenário no ar, porque dependem do
índice. A **instalada não converte** para metro nem UM em lugar nenhum: teto de
24 h vezes o índice do mix daria um número que parece capacidade e não é.

## Usuário, cargo, escopo e mestre

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

**Sair daqui não sai do Hub.** A senha mora no portal, e a sessão dele continua
aberta depois que você sai da Capacity Tool — por isso entrar de novo não pede
senha. A tela que aparece ao sair tem **Voltar ao Hub S&OP** (vai para o portal,
sem reentrar aqui) e, quando o endereço de saída do portal está configurado,
**Sair também do Hub S&OP**, que encerra os dois.

## Ticket

O chamado que quem usa a ferramenta abre de dentro dela: dúvida, sugestão ou
defeito, sobre uma tela ou sobre a ferramenta toda (grupo **Roadmap** no menu).
Cada um tem um número, um estado — **Aberto**, **Em análise**, **Feito**, **Não
procedente** — e a resposta de quem cuida do roadmap. **Só quem gerencia muda o
estado**, e sair de *Aberto* trava o texto do chamado para todos: dali em
diante o que se acrescenta é **comentário**, que só cresce e nunca se apaga.

São **duas telas**: em **Meus tickets** você vê os seus, abre um novo (numa
janela sobre a lista) e corrige o que escreveu; em **Gerenciar tickets** quem
cuida do roadmap vê a fila de todos e responde. A separação é proposital — a
fila da ferramenta inteira é acesso que se dá de propósito, não por tabela.

## Ocupação

`ocupação = demanda ÷ disponível`, em minuto, por CT e mês — e, agregando, por
CC, área, planta. Sempre **divisão de somas**: a ocupação do ano é Σ demanda ÷
Σ disponível, nunca a média das doze ocupações.
