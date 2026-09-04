# capacityTool — como trabalhar neste projeto

Ferramenta de planejamento de capacidade fabril, substituindo uma solução em
Excel + Qlik Sense. **PostgreSQL (Neon) + Next.js 14 App Router em JavaScript
puro, sem TypeScript, com deploy no Vercel.**

Este arquivo é o acordo de trabalho. Ele existe porque o histórico de conversa
não viaja entre máquinas, e as regras abaixo já foram aprendidas do jeito caro
pelo menos uma vez.

---

## As duas regras que não se negociam

### 1. Nada é instalado nem executado na máquina local

Não rodar `npm install` (nem com `--package-lock-only`), `next dev`, `next
build`, Docker, ou qualquer comando que crie ou altere `node_modules/`,
`.next/`, ou instale pacote. **Isso vale mesmo para "só validar antes de
subir".**

O fluxo é: eu commito e faço push, e o **Vercel é o validador**. A máquina local
é editor e git, mais nada.

**Como verificar sem executar:** leitura e raciocínio, `node --check` num
arquivo `.js` isolado, e `node --test lib/*.test.js` — que roda sem instalar
nada porque os testes usam só o `node:test` embutido e os módulos de `lib/` são
puros. Arquivo `.jsx` não passa no `node --check`; para eles, conferir por
leitura e pela contagem de parênteses e chaves.

Quando algo só puder ser confirmado rodando, **dizer explicitamente que não está
verificado** e deixar o Vercel dizer. Não propor rodar local como alternativa.
Se um passo exigir mesmo a máquina dele — regerar `package-lock.json`, por
exemplo — entregar o comando pronto para ele executar.

### 2. A documentação é atualizada sempre, no mesmo commit

**Sem pedir autorização a cada vez** — essa autorização é permanente e vale só
para documentação. Mexer em código, schema ou comportamento continua exigindo
pedido explícito.

Os dois arquivos têm papéis diferentes, e confundi-los estraga os dois:

**ROADMAP.md — o QUE.** Toda mudança passa por ele. Decisão nova de desenho
entra; item construído sai da lista de pendências e vira comentário no código ou
no cabeçalho da migração. A seção **O QUE FALTA** é a única que descreve o
futuro; o resto é registro do que já foi decidido, para não se redecidir.

Ele é a memória entre conversas, e já ficou desatualizado duas vezes: seções
descrevendo como "não implementado" ou "em construção" coisas que já estavam no
ar. Roadmap que mente é pior que roadmap nenhum, porque alguém decide em cima
dele. Ao fechar qualquer construção, conferir se alguma seção ficou mentindo.

**CLAUDE.md — o COMO.** Só muda quando muda uma REGRA, uma CONVENÇÃO, um
CONCEITO do domínio ou a estrutura de pastas. Não é changelog: se cada tela nova
acrescentasse um parágrafo aqui, o arquivo deixaria de ser lido de uma sentada —
e um acordo de trabalho que ninguém lê não governa nada.

Na prática: tela nova vai só para o ROADMAP; convenção nova, motor puro novo ou
regra de trabalho nova vem para os dois.

---

## O fluxo de trabalho

1. **Migrações de banco**: numeradas (`28_...sql`), com um cabeçalho longo
   explicando o modelo e o porquê, e sempre aplicadas **antes** do deploy do
   código que depende delas.

   **O arquivo nasce sempre**, mesmo quando eu mesmo aplico. Ele é o rastro: o
   Bruno lê antes, o commit registra depois, e o próximo a chegar entende o
   porquê. Migração aplicada direto no banco sem arquivo é mudança que ninguém
   consegue reconstruir.

   **Quem aplica**: eu, pela conexão com o Neon, quando a permissão permitir
   (`mcp__…__run_sql` está liberado em `.claude/settings.local.json`). Isso
   existe porque a ORDEM importa e ela não pode ficar partida entre nós dois:
   preencher dado e depois trocar o motor é uma sequência só, e o meio dela não
   é lugar para uma ida ao SQL Editor. Se a permissão recusar, entregar o nome
   do arquivo em bloco de código para ele rodar — e dizer que foi recusa de
   permissão, não escolha minha.

   **Depois de aplicar, conferir no banco** que o efeito é o esperado, e dizer o
   que ficou faltando do lado dele: **Recalcular tudo**, reimportar, o que for.
2. **Commit e push imediatos**, sem esperar confirmação. Mensagem em português,
   explicando o *porquê* e não o *o quê* — o diff já diz o quê.
3. Se o erro que ele reportar for uma **migração esquecida**, apenas dizer qual
   arquivo rodar. Não investigar como se fosse defeito de código.

---

## Convenções que o projeto seguiu sem exceção

**Comentário explica o porquê, nunca o quê.** O padrão é: a decisão, e o que
daria errado se fosse o contrário. Comentário que descreve a linha abaixo é
ruído; comentário que conta a armadilha é o que salva a próxima pessoa.

**Motor puro antes de tela.** Toda regra que decide número mora num módulo de
`lib/` sem `import` de banco, com testes em `node:test`. Depois a tela consome.
Os motores puros são `regras.js` (DE/PARA, rateio, mix), `filtro.js`,
`faixas.js`, `periodo.js`, `formato.js`, `ap.js`, `parquet.js`, `zip.js`,
`pptx.js`, `documento.js`, `visual.js`, `slide-visual.js`, `faixa-cor.js`,
`dia-util.js`, `ordem.js`, `anos.js`, `tema.js`, `origens.js`, `dias.js`,
`grade.js`, `cores.js`. Nenhum deles importa `./db`.

**Nunca uma crase dentro de `` sql`...` ``, nem em comentário SQL.** Isso já
quebrou o build do Vercel duas vezes, e **`node --check` NÃO pega**: um número
par de crases rebalanceia o arquivo em algo que o parser do Node aceita e o SWC
recusa. Existe um teste guardando isso (`lib/crase-em-sql.test.js`) — ele
precisa continuar passando.

**Driver Neon HTTP**: só tagged template, uma requisição por instrução.
Para lote, `unnest` de arrays paralelos; para atomicidade, `sql.transaction([])`.
Binário vai e volta em base64, com `decode(…, 'base64')` e `encode(…)`.

**Formato de arquivo é lido e escrito à mão**, sem dependência: parquet em
`lib/parquet.js`, ZIP em `lib/zip.js`. A compressão o runtime resolve —
`DecompressionStream` e `CompressionStream` existem no navegador e no Node 18+.
Arquivo pesado é manipulado no NAVEGADOR, não em função serverless: o limite de
tempo de lá existe para consulta, não para descompactar e recompactar megabytes.

**Fronteira cliente/servidor**: nenhum `lib/*.js` que importe `./db` pode ser
importado por um componente `'use client'`.

**Estado na URL.** Filtros, recortes, unidade, aba, ordenação — tudo vive em
`searchParams`. O endereço descreve por inteiro o que está na tela, e recarregar
cai no mesmo lugar. Cookie só para o que o servidor precisa saber antes de
pintar: tema e ordenação de cadastro.

**Arredondar é decisão da camada de exibição, uma vez só.** O minuto admite
fração no banco de propósito, porque `planejada × OEE` quase nunca é inteiro e a
soma do mês tem que bater com a multiplicação.

**Divisão de somas, nunca média de divisões.** Vale para dia útil, ocupação,
índice de conversão. Somar médias não dá média, e o total tem que bater com o
indicador.

---

## Onde as coisas moram

```
lib/db.js          consultas do painel, ocupação e extração
lib/demanda.js     carga de demanda, índice, DE/PARA e mix (tudo que toca demanda)
lib/regras.js      o motor: classificação, rateio, mix, capacidade por atributo
lib/cadastro.js    turnos, turnos do recurso
lib/estrutura.js   plantas, áreas, recursos, máquinas
app/painel/        Painel da Capacidade — "quanto cabe"
app/ocupacao/      Painel da Ocupação — "cabe?"
app/cadastros/     todas as telas de cadastro
NN_*.sql           migrações, na ordem em que devem rodar
```

## Conceitos do domínio

- **instalada** = teto físico, 24 h por dia, todo dia. Para recurso do tipo
  PESSOA ela é a própria planejada: não existe teto de 24 h para gente. **Não
  converte para metro nem UM**, no painel nem na extração: teto de 24 h vezes o
  índice do mix daria "quantos metros caberiam se a máquina rodasse o ano no
  ritmo deste mês", que ninguém pediu e parece capacidade.
- **planejada** = turnos, menos intervalos e paradas.
- **disponível** = planejada × OEE. Setup já está embutido no OEE. **OEE não
  cadastrado vale 0%**, e por isso **recurso novo nasce com OEE 100%** nas duas
  origens: a ausência tem que ser anomalia, não o estado normal.
- **CC-CT** é a identidade do centro na controladoria, e o vínculo com a demanda
  é **derivado** de `maquina_fisica.cc || '-' || ct`. Nunca houve tabela de-para,
  e é isso que faz um CT passar a valer no instante em que o recurso é
  cadastrado, sem reimportar nada.
- **índice de conversão** = `Σ quantidade ÷ Σ minutos`, por CT e mês. Isso é
  identicamente a média das taxas ponderada pelo tempo — e é por isso que mexer
  no mix muda o índice.
- **fatia / rateio**: a capacidade é do RECURSO e o atributo é da LINHA de
  demanda. Filtrar por um rótulo soma a *fatia* de cada CT que aquele rótulo
  ocupa. As fatias de um CT somam 1, e é essa propriedade que faz a soma dos
  rótulos fechar com o total.
- **uma rodada por (área, ano, origem)**: a nova substitui a anterior. O sistema
  mostra a capacidade atual; rodada velha não é consultada por ninguém.

## O que a ferramenta não faz de propósito

- Não recalcula sozinho ao mudar cadastro. **Recalcular tudo** é um botão, e o
  laço roda no navegador — uma requisição por rodada, porque função serverless
  tem minuto contado.
- Não guarda histórico de rodada.
- **Não guarda o memorial do cálculo** (migração 33). O motor grava só a
  `capacidade_fato` — o resultado. A explicação passo a passo custava 44% do
  limite do banco para responder por um recurso num dia, e saiu quando a
  Tecelagem entrou no cálculo e a fábrica inteira deixou de caber. Calcular no
  MOTOR continua necessário, e nunca foi o memorial que justificava isso:
  são o volume (800 mil linhas de recurso × dia × turno), o lugar único
  decidindo (painel, ocupação e extração leem a mesma tabela) e a estabilidade
  (recalcular é um botão, para o número não mudar debaixo de quem lê).
- Não espalha demanda mensal por dia: a base é mensal, e reparti-la inventaria
  uma distribuição que o plano não deu.

---

Para o estado atual do produto e o que ficou pendente, ler o **ROADMAP.md**. Para
o porquê de uma linha específica, ler o comentário ao lado dela e o commit que a
criou — as mensagens de commit deste repositório carregam o raciocínio.
