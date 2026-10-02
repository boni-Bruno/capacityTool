# O rótulo da permissão mentia, e deu a fila a um convidado

**A regra que nasceu disto está no CLAUDE.md**, nas convenções: `<tela>.editar`
tem que querer dizer "editar o que esta tela mostra", e nada além — papel
diferente pede tela própria.

## O dia

02/10/2026. Um usuário convidado estava usando a ferramenta de verdade pela
primeira vez, com um cargo criado para ele. O Bruno relatou:

> *"abriu Meus tickets com o cargo que tem permissão para editar e agora ele
> visualiza o ticket de todo mundo e ainda consegue responder, ao invés de só
> editar o seu próprio ticket — está com permissão de quem está desenvolvendo a
> ferramenta. E se o cargo dele não poder editar as abas do roadmap, ele não
> consegue abrir ticket."*

## O que estava errado

Nada no código, e ninguém marcou errado. O cargo tinha as duas linhas do grupo
Roadmap marcadas na grade — que é o gesto natural de quem quer que a pessoa
consiga abrir um chamado.

O problema era o **significado**. As telas eram *Criar ticket* e *Meus tickets*,
e as permissões diziam outra coisa:

| caixa na grade | o que a pessoa lia | o que ela fazia |
|---|---|---|
| Criar ticket · editar | — | abrir e corrigir o próprio chamado |
| Meus tickets · editar | "editar os meus chamados" | **ver e responder os de todo mundo** |

Duas caixas visualmente idênticas às outras vinte da grade, uma delas com um
significado que nenhuma tela explicava. E a que de fato abria chamado chamava-se
`ticket_novo.editar`, num nome que ninguém relacionaria com o botão — daí a
segunda metade do relato: sem marcar a linha toda, ele não conseguia abrir
ticket nenhum.

O corte entre as telas era **CRIAR × ACOMPANHAR**, e esse eixo não cabia na
grade: ela só sabe dizer "ver" e "editar" de cada tela.

## O que custou

Pouco, por sorte: um usuário convidado viu a fila de chamados da ferramenta por
alguns dias, numa instalação onde ninguém tinha aberto nada confidencial. Numa
ferramenta com mais gente, teria sido acesso de curador entregue sem ninguém
decidir — e descoberto por acaso, como foi.

## O conserto

Migração 46: o corte virou **O MEU × O DE TODOS**, que é um eixo que a grade
consegue explicar sozinha.

| caixa | o que dá |
|---|---|
| Meus tickets · ver | ver os seus |
| Meus tickets · editar | abrir e corrigir os seus |
| Gerenciar tickets · ver | ver a fila de toda a ferramenta |
| Gerenciar tickets · editar | responder, mudar o estado, apagar |

De quebra apareceu um papel que antes não tinha como existir: **acompanhar a
fila sem responder** — ver todos *era* poder responder, porque eram a mesma
permissão.

A migração rodou **depois** do deploy, ao contrário da ordem habitual: rodada
antes, o código antigo leria `tickets.editar` em quem só abre chamado e
entregaria a fila a essa pessoa por alguns minutos — exatamente o defeito que
ela fecha.

## O que generaliza

Uma grade de permissões é uma lista de **promessas de rótulo**. No instante em
que uma caixa significa algo que o rótulo não diz, ela deixa de ser uma escolha
e vira uma armadilha — e quem cai nela é justamente quem está sendo cuidadoso,
marcando a linha inteira para não deixar faltar nada.

Quando um papel não cabe em "ver" e "editar" de uma tela, o que falta é uma
**tela**, não um significado especial. Ver [[documentacao-nos-dois-arquivos]]
para onde cada tipo de regra mora.
