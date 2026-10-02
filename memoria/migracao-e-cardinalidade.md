---
name: migracao-e-cardinalidade
description: "Migração vai antes do deploy — exceto a que o código antigo leria errado: cardinalidade nova, ou significado novo"
metadata:
  type: feedback
---

A regra "migração sempre antes do deploy" vale, e ganhou uma emenda: **migração
que muda a cardinalidade de uma tabela só pode ir antes do deploy que a
acompanha**. Enquanto o número de linhas por entidade não muda, o código antigo
continua correto sem saber de nada; no instante em que ele dobra, cada consulta
que lê e cada comando que apaga "por id da entidade" passa a estar errado.

**Why:** Em 30/09/2026, a migração 41 deu `origem` a `recurso_turno`,
`recurso_calendario` e `recurso_parametro` para criar os dois cenários — e, no
mesmo arquivo, já semeava o Orçamento copiando as linhas da Simulação. Aplicada
e conferida: 393 recursos passaram a ter **duas** linhas de parâmetro e duas de
calendário.

O código que estava no ar não sabia de cenário. Com duas linhas por recurso:

- `recursos()` e a lista de Recursos passavam a **duplicar cada máquina** — dois
  "TEXPA-01" sem nada que os distinga, e quem clica não sabe qual escolheu;
- `definirTurnosDoAno` e `definirCalendarioDoAno`, que apagam por `recurso_id`
  sem olhar origem, **apagariam o cadastro dos dois cenários** no primeiro
  salvamento — calados, porque a tela nem mostra que o outro existe.

Desfiz a cópia no mesmo dia, antes de qualquer gravação. A migração ficou só com
as colunas e as restrições (inertes para o código antigo), e a semente virou a
migração 43, aplicada **junto** com o deploy que sabe de cenário. Custou uma
hora e nenhum dado — e teria custado o cadastro de uma fábrica inteira se um
"Salvar" tivesse acontecido no meio.

**How to apply:** Antes de aplicar uma migração, perguntar: *isto muda quantas
linhas existem por recurso, por área, por turno?* Se sim, separar em duas:

1. a estrutura — colunas, restrições, índices —, que o código antigo ignora;
2. o preenchimento que multiplica as linhas, aplicado **depois** do deploy ficar
   verde, nunca antes.

E conferir os pontos que leem ou apagam por id da entidade sem o discriminador
novo: são eles que quebram, e quebram em silêncio. `delete ... where
recurso_id = X` é o padrão a procurar.

## A emenda de 02/10/2026: não é só cardinalidade

A migração 46 não mexeu em quantas linhas existem — mexeu no que elas
**querem dizer**. `tickets.editar` deixou de significar "cuido da fila" e passou
a significar "abro o meu chamado". Uma linha, um significado novo: rodada antes
do deploy, ela daria a fila da ferramenta a todo mundo que abre chamado, pelos
minutos do build. Rodou depois, e o pior caso virou um cargo ficar sem a tela
nova por instantes.

A pergunta que generaliza as duas é mais simples que a da cardinalidade:
**se isto rodar e o deploy demorar dez minutos, o que o código que está no ar
faz com estas linhas?** Se a resposta for "algo que ninguém quis", a migração
espera o deploy. Ver [[rotulo-de-permissao]], que é a outra metade desse dia.
