# Roadmap

O que ainda não existe, e o que já foi decidido sobre cada coisa.

Ele existe para a decisão não se perder entre uma conversa e a próxima. Item
construído sai daqui e vira comentário no código ou no arquivo de migração — o
que fica é o desenho ainda por fazer, mais o registro do porquê de cada escolha,
que continua valendo depois de pronta.

---

## 0. O que já está no ar

| | migração | onde |
|---|---|---|
| Leitor de parquet, sem dependência | — | `lib/parquet.js` |
| Importação da base de demanda, em lotes | `19` | Cadastros › Demanda |
| Conferência: demanda sem capacidade, e o contrário | `19` | Cadastros › Demanda |
| Índice de conversão por CT e mês | `20` | `vw_demanda_indice` |
| Herança de índice: CT irmão, média do CC, ou nenhum | `21` | Cadastros › Demanda |
| Índice guardado, refeito nos gatilhos conhecidos | `22` | `mv_demanda_indice` |
| Capacidade por dia útil, mês a mês | — | Painel, ao lado dos indicadores |
| Painel em metro de tecelagem e em UM do material | — | Painel |

O que sobrou da conversão está na seção 3 — as regras de classificação e o
filtro por atributo derivado.

Sobre a capacidade por dia útil: o divisor sai da mesma contagem que a tela de
Calendários mostra, com o peso de cada dia da semana e o desconto das paradas de
apresentação. Ele é por **calendário**, não por área — e uma área pode ter
recurso em rodízio e em padrão ao mesmo tempo. Quando isso acontece a tela
oferece a escolha em vez de dividir por um número que ninguém pediu. O total não
é a soma das colunas: é a capacidade cheia do período sobre os dias úteis do
período, porque somar médias não dá média.

Sobre a `22`: o índice era uma view, e view recalcula a cada leitura. Toda
abertura do painel refazia o agrupamento sobre as 116 mil linhas da demanda —
dentro de um lateral por recurso, no `porRecurso` — e pagava isso mesmo em
minutos, quando ninguém pediu conversão. Materializada, a definição continua num
lugar só e a leitura vira busca por índice. Os gatilhos do refresh são três e
todos passam por `atualizarIndice()`: concluir carga, apagar carga e mexer nas
regras de herança.

---

## 1. Conversão de minutos para unidade — CONSTRUÍDA

Fica registrado o desenho, porque ele explica os números que a ferramenta
mostra hoje. O que ainda não existe está na seção 3.

### A base de demanda resolve isso sozinha

A empresa já produz uma base de demanda orçada. A extração definitiva é um
**parquet** (`DemandaAP_CapacityTool.parquet`): 116.407 linhas, 15 colunas,
1,2 MB, GZIP com dicionário, escrito por `parquet-cpp-arrow 18.1.0`.

```
cenario · grupo_estoque · nivel_estoque · linha_produto_agrupada ·
familia_produto · familia_tecelagem · tecido_base · um · ct · periodo ·
periodo_data · producao_quantidade · producao_metros_kg · duracao_minutos ·
data_extracao
```

A primeira análise foi feita sobre um `.xlsx` de 6,4 MB e 96.774 linhas, com os
mesmos dados em outra roupa. O parquet é melhor em tudo que importa: nomes já
em snake_case, `NULL` em vez de `'-'`, números como DOUBLE em vez de texto,
`periodo_data` como DATE de verdade e `data_extracao` carimbando a carga. E
`Depósito Localidade SKUs` saiu — o que reduziu a chave repetida de 718 para
524 combinações.

A validação de que é a mesma base: a fatia de 2026 reproduz a cobertura do
xlsx na casa decimal (58,2% / 22,0% / 19,7% / 0,0%). As diferenças que
sobraram são de refresh, não de estrutura — a extração é seis dias mais nova,
o que dá 429 linhas e 8.323 minutos a menos, 0,007% do total.

**`Duração (Min)` é o tempo do roteiro já explodido**, não uma taxa. O mesmo
item na mesma quantidade tem durações diferentes em CTs diferentes (pano copa
felpudo, 2.640 pç: 196,68 min no CT 455-001 e 22,18 min no 460-001).

Isso derruba a necessidade de cadastrar taxa e mix. As tabelas `produto` e
`recurso_taxa`, criadas na fase 2 e nunca usadas, **saem** — junto com
`recurso_taxa.min_setup`, que sempre foi contraditório com a decisão de manter
setup embutido no OEE.

### As duas colunas de quantidade

| coluna | é sempre |
|---|---|
| `Total Produção (M\Kg)` | **metro de tecelagem** — kg apenas na fiação |
| `Total Produção (Un)` | a produção na **UM do material** |

São duas leituras da mesma produção. O que liga uma à outra é a **pista**: o
tear produz 2, 3 ou mais toalhas lado a lado no mesmo metro linear, e a
confecção corta e separa as pistas.

```
pano de copa:  M\Kg = 462 m de tecelagem   Un = 2.640 peças
               2.640 ÷ 462 = 5,71 panos por metro de tecelagem
               4 pistas ÷ 0,70 m de pano   = 5,71   ✓

toalha rosto:  índice 0,241 m por peça
               3 pistas ÷ 0,72 m de toalha = 4,17 por metro   ✓
```

`TECIDO MEDICAO FELPUDO` é o único produto vendido a metro para o cliente, e
por isso o único em que as duas colunas aparecem visíveis ao mesmo tempo:
`M\Kg` traz o metro de tecelagem com as pistas juntas e `Un` traz o metro de
cada pista já separada — ~3,74 pistas em média. Nos confeccionados a mesma
coisa acontece, só que `Un` já sai contado em peça.

### A conta

```
índice(CT, mês)  =  Σ quantidade(CT, mês)  ÷  Σ minutos(CT, mês)
capacidade       =  disponível_min(CT, mês) × índice(CT, mês)
```

Trocando a coluna de quantidade sai a unidade desejada:

```
índice em UM do material   =  Σ Un    ÷ Σ min
índice em metro de tecelagem = Σ M\Kg ÷ Σ min
```

Os dois saem da mesma soma e são **paralelos, não encadeados** — embora
encadear dê o mesmo número, porque
`(Σ Un ÷ Σ min) × (Σ M\Kg ÷ Σ Un) = Σ M\Kg ÷ Σ min`. A igualdade só vale
enquanto as três somas forem sobre exatamente o mesmo conjunto de linhas;
calcular a pista por família e o índice por CT quebraria isso.

Somar na cabeça do CT resolve o mix sozinho: cada material entra ponderado pela
quantidade que a demanda pede. É a média harmônica ponderada, que é o único
jeito certo — ponderar taxa por participação em QUANTIDADE infla a capacidade,
porque o produto lento ocupa mais tempo do que a quantidade sugere. Com 1.000
unidades de A a 100/h e 1.000 de B a 50/h, a média por quantidade dá 75/h e a
realidade é 66,7.

### O vínculo com o recurso é derivado, não cadastrado

O `CT` da base é o `CC-CT` do nosso cadastro — 100% das 72.934 linhas com CT
seguem o formato `\d+-\d+`, em 123 CTs distintos. Como `recurso.codigo` é `CC-CT-Patrimônio`, a máquina
pertence ao CT formado pelos próprios `maquina_fisica.cc` e `.ct`. Nenhuma
tabela de-para para manter desatualizada.

Atenção aos zeros à esquerda: `100-001` não casa com um cadastro que tenha
`cc = 100` e `ct = 1`.

### Cobertura: 80,3% do tempo vira metro de tecelagem

| a linha rende | % do tempo |
|---|---|
| metro direto — a UM do material já é M | 58,2% |
| metro pelo índice de pista — UM contável | 22,0% |
| **kg — fiação, não tem metro de tecelagem** | 19,7% |
| sem conversão (61 linhas, 2.792 min no ano) | 0,0% |

A separação é por CT e é limpa: 30 CTs de fiação ficam em kg, o resto vira
metro. Fio não ter metro de tecelagem é o certo, não uma lacuna.

Taxas que saem, para conferência de sanidade em tear de felpudo:
`515-004` a 11,0 m/h, `278-002` a 51,5 m/h, `800-001` a 34,2 m/h.

### Decidido

- Guardar a base **crua**, não só o agregado — ela vai responder perguntas que
  ainda não foram feitas
- **Importar todos os períodos**, sem filtrar por ano. O horizonte da carga é
  decisão de quem monta a demanda, não da ferramenta: se a capacidade de um
  ano não interessar, ele é simplesmente ignorado na leitura
- **Guardar também as linhas zeradas.** São 20.062 (17%) — 2025 e 2027 inteiros
  vêm sem valor nenhum. Elas dizem quais períodos o plano contempla, e essa é
  informação que some se a importação as descartar
- `Cenário` é o nome da versão da carga (`Orçamento_2026_v3_Plano_Compras`);
  cada carga é uma versão, nunca uma sobrescrita
- O painel mostra a **cesta inteira**; o usuário não escolhe várias UMs
- Unidade padrão de apresentação: **metro de tecelagem**, com a fiação em kg
- A primeira entrega já sai em **metro de tecelagem**, sem passar por uma etapa
  em `Un`. As duas conversões partem da mesma soma, então não há nada a ganhar
  escalonando — `Un` fica como leitura secundária, para olhar um CT ou um
  produto de cada vez
- `Período` é o mês da **produção**. A demanda de um mês é consumida pela
  capacidade daquele mesmo mês, sem deslocamento de lead time entre as duas
- Período da base é mensal (`2026.01` a `2026.12`), e isso **dita o grão do
  índice**: converter um dia ou um turno usa o índice do mês daquele dia, o
  que assume mix uniforme dentro do mês. É premissa, não defeito — mas tem que
  estar escrita na tela quando o painel estiver no nível de dia.

### Formato de entrada: parquet, lido sem dependência

1,2 MB cabe folgado no limite de ~4,5 MB de corpo da Vercel, então o arquivo
sobe inteiro — some a etapa de processar no navegador antes de enviar, que era
obrigatória com o xlsx de 6,4 MB.

O leitor é escrito à mão, sem biblioteca: Node tem `zlib` nativo e o navegador
tem `DecompressionStream('gzip')`; Thrift compact, RLE e dicionário são lógica
comum. Já existe uma prova de conceito em Python, com biblioteca padrão só, que
lê este arquivo inteiro — cerca de 200 linhas.

Isso só se sustenta porque **a configuração da exportação é estável**: GZIP,
`RLE_DICTIONARY` e `PLAIN`. Se um dia sair em SNAPPY ou ZSTD — que são padrões
comuns do Arrow e não estão na biblioteca padrão de lugar nenhum — o leitor não
tenta adivinhar: recusa a carga dizendo qual compressão veio e qual é a
esperada. Errar em silêncio aqui seria importar número errado.

### Em aberto

- 2027 vem com 17.196 linhas e **zero minutos**: o período existe no plano mas
  a demanda dele ainda não foi calculada na origem
- `produto`, `recurso_taxa` e `recurso_taxa.min_setup` ficaram **sem uso** — a
  base de demanda tornou o cadastro de taxa desnecessário. Estão no banco
  prometendo uma coisa que não acontece, e vale uma migração que as apague

### Regra de leitura do período

O parquet traz as duas formas: `periodo` como texto `AAAA.MM` e `periodo_data`
como DATE no primeiro dia do mês. **Conferido: batem em 100% das 116.407
linhas, zero divergência.**

O join com a capacidade usa `periodo_data`, que é uma data tipada e não depende
de formatação. O texto fica guardado como veio, para rastreabilidade e para a
extração de volta.

Isso mata uma armadilha que existia no caminho do CSV: `2026.10` parece um
número, e qualquer ferramenta que tratasse a coluna como numérica o
transformaria em `2026.1`, colidindo com janeiro — duas linhas somadas no mês
errado, sem erro na tela. Com a data tipada não há o que adivinhar. Se um dia a
origem voltar a ser texto, a importação recusa período que não case com
`\d{4}\.\d{2}` em vez de tentar consertar.

---

## 2. Validação demanda × capacidade — CONSTRUÍDA

Está em Cadastros › Demanda. Responde as duas pontas soltas:

- **Demanda sem capacidade** — CT na base que não casa com recurso nenhum
- **Capacidade sem demanda** — recurso cujo CT não aparece na base

Nenhum dos dois é erro: o primeiro costuma ser cadastro faltando ou zero à
esquerda, o segundo é máquina fora do plano. Mas os dois calados viram número
errado que ninguém percebe.

Como demanda e capacidade já estão na mesma moeda — a base traz 121.171.353
minutos em 2026 —, a comparação "cabe?" sai de graça junto, sem depender da
conversão para unidade.

Da leitura do parquet, o que a validação vai encontrar:

- 43.473 linhas (37%) sem CT — itens comprados ou de revenda, coerentemente sem
  duração; entram na carga mas ficam fora da conta
- 20.062 linhas (17%) de 2025 e 2027 sem valor nenhum
- 2 linhas com quantidade e sem tempo
- 718 combinações de `(CT, período, família, tecido, UM)` repetidas em 69.543 —
  ou falta uma coluna na chave, ou basta somar
- `PT4`, `PT6` e `DZ` com taxas absurdas sobre volume ínfimo (DZ tem 2 minutos
  no ano inteiro)
- 11 dos 123 CTs misturam UMs de material diferentes. Em metro de tecelagem
  isso deixa de ser problema — todas viram a mesma régua —, mas na leitura por
  UM do material continua valendo o cuidado de não somar peça com jogo

### Estado do casamento em 15/08/2026

O `CONFERE_CT.sql` foi rodado no Neon. O cadastro tinha 20 CTs, todos de teste.

**Zero casaram, e a causa era o zero à esquerda.** A base é uniformemente
`3-3`: o CC vai de 100 a 800 e nunca precisa de preenchimento, o CT sempre tem
(`001`, `016`). O cadastro estava com `313-3` onde a base traz `313-003`.

Acertado o zero, **12 dos 20 casam** — 47.323 h de 2.019.523 h, 2,3%. Baixo e
esperado: são 20 CTs de teste num universo de 123.

A correção é no **cadastro**, não na comparação. Dois motivos:

- O CC-CT vem da controladoria, e a base é a extração dela. O CT verdadeiro
  daquela máquina **é** `003`. O cadastro não estava noutro formato, estava
  errado — e `recurso.codigo`, que é a trinca concatenada, estava errado junto.
- Comparação por `=` puro não se esquece. Função de normalização precisa ser
  lembrada em toda consulta, e esquecer uma vez dá divergência silenciosa.

### Pendências do casamento, para o fim

**Oito CTs cadastrados sem par na base:** `226-2`, `313-1`, `313-2`, `313-7`,
`313-9`, `401-3`, `401-4`, `401-5`. O CC existe, aquele CT não. São máquinas
cadastradas que o plano não usa, ou numeração que ainda vai mudar — resolver
quando o cadastro sair do estágio de teste.

**Validar o CT na entrada do cadastro.** Os zeros de agora foram acertados à
mão; nada impede alguém de digitar `5` de novo amanhã. Ao salvar um recurso, CT
numérico deveria ser gravado com 3 dígitos — sem truncar, para um CT de 4
dígitos futuro entrar como veio.

---

## 3. DE/PARA e regras de classificação da demanda — EM CONSTRUÇÃO

O motor está em `lib/regras.js`, as três tabelas na migração `23`, e a tela em
`/cadastros/de-para`.

**Uma regra é uma coisa só.** O atributo em que ela escreve nasce junto dela, no
mesmo formulário — não existe "cadastrar a coluna primeiro". Quem está
escrevendo pensa em "isso aqui vira Banho Jacquard", e a tela segue esse
pensamento: SE campo é valor, e/ou outro campo é valor, PARA isto.

O nível do atributo também não é pergunta: ele sai de quem a regra lê. Regra que
usa um DE/PARA de nível 2 só pode produzir nível 3, e a tela calcula isso
sozinha. Perguntar seria pedir que alguém resolvesse à mão uma conta que a
própria regra já respondeu.

**A prévia anda a cada tecla e é exata**, não amostra. O modo de errar aqui é a
regra pegar mais ou menos do que se imaginava, e isso não dá erro em lugar
nenhum — vira um número torto no painel semanas depois. Por isso o contador está
colado no editor e os valores vêm em lista em vez de campo livre: valor digitado
errado é regra que fica quieta.

## 4. Capacidade por atributo — PRONTO

O painel recorta por atributo do DE/PARA, ao lado de sub-área e tipo.

**Não é um filtro; é um rateio.** A capacidade é do RECURSO e o atributo é da
LINHA de demanda. Um CT faz várias linhas de produto no mesmo mês, então somar
"os recursos que fazem Banho Jacquard" contaria o CT inteiro, inclusive o que
ele faz de outra coisa, e a soma dos rótulos daria mais que o total.

O que entra é a fatia: `minutos do rótulo ÷ minutos do CT`, mês a mês. **As
fatias de um CT somam 1**, e é isso que faz a soma dos rótulos fechar com o
total — a propriedade que torna o número confiável.

Três decisões, todas do Bruno:

- **CT sem nada do rótulo sai da conta e da tabela.** Linha zerada pareceria
  recurso parado, e é recurso que não faz aquilo.
- **A fatia é mensal**, como o índice. Um CT que em março só faz felpudo tem
  fatia diferente da de abril.
- **Instalada também rateia.** O teto de 24 h entra pela mesma fatia, então o
  "% do teto" não muda ao filtrar.

**Herança de mix vale para qualquer CT**, não só para os órfãos. O motor
sempre foi assim (a regra ganha da demanda própria, migração 21); agora a tela
acompanha: todo CT com demanda própria aparece na segunda lista com a taxa de
casa na primeira opção e os doadores ao lado, para a troca ser uma comparação.
Voltar é escolher "a própria" — que apaga a regra em vez de gravar o default.

E uma consequência que caiu de graça: com filtro, a conversão para metro usa a
taxa DO RÓTULO, não a média do CT. Um CT que faz felpudo e liso converte a
taxas diferentes, e a média daria metro a mais ou a menos sem nada denunciar.

A consulta cara — as combinações por mês — só acontece quando há rótulo
escolhido. Sem filtro o painel abre exatamente como antes.

## 5. Ajuste manual de mix — PRONTO

Nova aba em Conversão da capacidade (`/cadastros/mix`). O mix de um CT — quanto
do tempo dele pertence a cada rótulo do DE/PARA — é calculado da carga; esta
tela é a camada manual por cima: **onde existe ajuste, ele ganha da base, e
importar uma carga nova nunca mexe nele** (migração `24_mix_ajuste.sql`).

A lista mostra todos os CTs × 12 meses com o mix vigente (célula destacada =
ajustado); clicar no CT abre a matriz rótulos × meses, pré-preenchida com o que
vale hoje. Decisões do Bruno: soma ≠ 100 **normaliza proporcionalmente** ao
gravar; coluna "Ano" replica um valor nos 12 meses; a parte **sem rótulo** é
uma linha ajustável como as outras; rótulo que o CT não produz na base pede
**taxa apontada** (CT doador ou média de CC — o doador empresta a taxa dele
para o rótulo em questão, não a média geral).

O painel usa o ajuste no rateio por atributo automaticamente, e o rodapé diz em
quantos CT×mês o mix manual está valendo.

**Mix e recorte também por campo da base** (migração `25_mix_campo_base.sql`):
o seletor de atributo do mix e o filtro do painel ganharam o grupo "Campos da
base" — grupo de estoque, nível de estoque, linha de produto, família de
produto, família de tecelagem, tecido base e UM — sem precisar de regra DE/PARA
antes: o valor da coluna já é o rótulo. No editor de um campo da base entram só
os valores que o CT tem (mais os ajustados), com um seletor para adicionar
valor novo; listar os centenas de valores globais afogaria a tela. A lista do
mix mostra o nome do recurso ao lado do CT.

Em **Turnos do recurso**, a máquina agora se acha por CC, CT e Patrimônio em
seletores separados, que estreitam a lista de Código/Recurso em cascata.

## 6. Extração para o AP — PRONTO

Grupo novo no menu (Extração), tela `/cadastros/extracao-ap`. Sai um .csv com
`CT;Periodo;Minutos`, condensado por mês, período em AAAA.MM — o formato da
base de demanda, que é onde os dois sistemas se encontram. Cada área×ano entra
com a última rodada OK do OEE META, a mesma regra do painel aplicada em lote.

Filtros em cascata antes de extrair: planta, área, sub-área, CC, CT,
patrimônio, nome do recurso, e período De/Até em meses cruzando anos. A medida
é escolhível (disponível como padrão, planejada e instalada) e a origem do OEE
também (Meta ou Simulado). O arquivo leva a quarta coluna `CT_Periodo` — a
chave `CT|Periodo` já concatenada, pronta para o PROCV. O fluxo é gerar →
conferir a prévia (totais + primeiras linhas) → baixar; minuto sai inteiro no
arquivo, com BOM para o Excel abrir como UTF-8.

**A tela de Demanda virou um quadrante de dados só.** A ordem da página é a
ordem do trabalho: importar → cargas → conferência → explorar. As quatro
tabelas (demanda sem capacidade, capacidade sem demanda, origem do índice,
índice de conversão) são modos de um quadrante único, escolhidos por botão, com
filtros que valem para todos: planta, área, CC, CT, os atributos DE da base e
os atributos PARA do DE/PARA. O recorte por atributo olha a demanda do CT, então
CT sem demanda não responde a ele — a tela avisa quando isso esconde linhas.

**O motor não roda sobre as 116 mil linhas.** Os seis atributos que as regras
enxergam formam **1.279 combinações distintas** na base inteira — 91 vezes
menos. Classificar a combinação e multiplicar pelas linhas dá o mesmo resultado,
e é isso que permite a prévia ser exata e instantânea em vez de uma amostra.

Por isso ele é JavaScript puro e não SQL: é o mesmo código na tela, para a
prévia, e no servidor, para valer. Duas implementações da mesma regra
divergiriam, e a divergência apareceria como um número diferente do que a prévia
prometeu.

A base fala a língua do sistema de origem; cada área da empresa fala a sua. E um
mesmo CT produz mais de uma linha de produto — 52 dos 123 —, com índices que
diferem de verdade: no CT 455-001, BANHO rende 4,417 m/min e PRAIA 8,378, quase
o dobro.

Então o DE/PARA não é enfeite de nomenclatura: é o que permite filtrar por linha
de produto e ler um número que faça sentido para quem está olhando.

### Renomear e agrupar, os dois

Renomear é 1:1 — `BANHO` vira `Banho`. Agrupar é N:1 — `TECIDO PREPARADO
FELPUDO`, `LISO` e `VELUDO` viram `Preparação`. A mesma tabela faz os dois; o
que muda é o efeito, e agrupar **muda a agregação**.

Consequência a não esquecer: agrupando os três acima, o índice do grupo vira a
média ponderada, e o LISO — que é 27% mais rápido — some dentro da média. Está
certo, é o que agrupar significa. Mas a tela deve permitir **abrir o grupo**,
senão a diferença fica invisível.

### SE...E / SE...OU sem parênteses: blocos

```
regra "Banho Jacquard"  →  linha_produto = "Banho Jacquard"

  bloco 1   linha_produto_agrupada = TECIDO CRU FELPUDO
        E   familia_tecelagem      = 225
     OU
  bloco 2   ct = 515-004
```

Dentro do bloco, tudo é **E**. Entre blocos, é **OU**. Cobre qualquer combinação
sem parser, sem precedência de operador e sem regra ambígua. Na tela são dois
botões: *adicionar condição* e *adicionar bloco OU*.

### Atributos que podem ser condição

Os cinco de baixa cardinalidade, mais os dois de contexto — todos opcionais em
cada regra:

```
grupo_estoque (4) · um (12) · nivel_estoque (17) ·
linha_produto_agrupada (24) · familia_tecelagem (27) · ct · area
```

`familia_produto` (167) e `tecido_base` (508) ficam de fora: cadastro que
ninguém mantém é pior que cadastro nenhum, porque parece certo. É a mesma razão
que descartou o grão de SKU.

`area` entra pelo caminho que já existe — o CT vira recurso, o recurso tem área.
Era a motivação original: é por área que a linguagem muda.

### Nível impede regra circular

Cada atributo derivado declara um **nível**. Uma regra só enxerga atributos de
origem ou derivados de nível MENOR. Assim ciclo é impossível por construção, em
vez de precisar ser detectado — e detectar ciclo em tempo de execução daria erro
no meio de uma importação.

### Primeira regra que casa ganha, e a prévia é obrigatória

Ordem explícita, primeira que casa vence. É previsível, mas o modo clássico de
errar é regra fora de ordem ou valor digitado errado, e os dois são invisíveis.

Por isso duas coisas não são opcionais:

- **Prévia antes de gravar**: quantas linhas a regra pega, quais valores de
  origem caem nela, e uma amostra
- **Contador de acertos por regra** na listagem: regra que pega 0 linhas é typo

O exemplo real de por que isso importa:

```
linha_produto = TECIDO CRU FELPUDO  E  familia_tecelagem = 225
    →  2.278 linhas ·  128.565 h  ·  6,4% do tempo

só linha_produto = TECIDO CRU FELPUDO
    →  5.260 linhas ·  651.218 h   (5x mais)

só familia_tecelagem = 225
    →  espalhada em CRU FELPUDO, PREPARADO FELPUDO, BANHO (39.201 h),
       VELUDO, PRAIA
```

Sem a prévia, a diferença entre 128.565 h e 651.218 h é invisível até alguém
conferir na mão. E quem escrevesse só `familia = 225` classificaria 39.201 h de
BANHO como jacquard sem perceber.

### Linha sem regra nunca some

Fica com o valor de origem e aparece assim no painel, e entra no relatório da
carga como "sem regra". Esconder linha por falta de cadastro apagaria demanda do
painel, que é o pior desfecho possível.

### Reclassificação é retroativa, por decisão

Alterar uma regra reclassifica **todas as cargas**, inclusive as antigas. A
alternativa — carimbar a carga com a versão das regras e só reaplicar sob
comando — foi considerada e descartada.

A consequência, que é real e foi aceita: um número visto mês passado pode mudar
sem ninguém tocar na carga. Para rótulo isso é inofensivo e até desejável, já
que a história inteira passa a falar a língua atual. Para **agrupamento** é
diferente — juntar ou separar valores muda a soma de um recorte.

Como não há versionamento para explicar a mudança, o rastro tem que estar em
outro lugar: a tela de regras registra quem criou e alterou cada regra e quando,
e a prévia impede que a alteração seja feita às cegas.

Implicação de mecânica: o valor derivado é materializado na linha, e salvar uma
regra dispara a reaplicação sobre todas as cargas. Não é calculado a cada
leitura — isso custaria em toda consulta do painel.

### Filtrar por linha de produto é rateio, não capacidade dedicada

Não existe "a capacidade de BANHO no CT 455-001" — a máquina não é exclusiva. O
que existe é rateio, pela mesma lógica de cesta já decidida para a UM:

```
capacidade_linha = disponível_min(CT, mês) × fatia_do_tempo × índice_da_linha
```

O índice tem que ser **o da linha**, não o do CT: com BANHO a 4,417 e PRAIA a
8,378 m/min, ratear pelo índice do CT erraria por um fator de 2. E a tela precisa
dizer que é rateio, senão alguém lê o número como capacidade dedicada.

### As tabelas

```
demanda_atributo    atributos derivados e o nível de cada um
demanda_regra       atributo_destino · rótulo · ordem · ativa
demanda_regra_cond  regra_id · bloco · atributo · operador · valor
                    mesmo bloco = E · blocos diferentes = OU
```

---

## 4. Capacidade contra demanda — o "cabe?"

As duas pontas já estão na mesma moeda: a base traz 2.019.523 h de demanda e o
motor calcula a capacidade em minuto. O vínculo por CT está resolvido e a
herança de índice também. Falta pôr as duas séries lado a lado.

É a pergunta que a fábrica realmente faz, e a que exige menos código novo de
tudo que sobrou.

Um cuidado que já está registrado na seção 3 e vale repetir aqui: CT que herda
índice **não herda demanda**. Somar a carga do irmão dobraria o total da
fábrica.

---

## 5. Dívidas conhecidas do motor

Levantadas, aceitas na época e ainda abertas.

- **`tipo_parada.abate_disponivel` nunca é lido.** A coluna existe, a tela de
  paradas mostra o selo "não abate", e o motor ignora — só `abate_planejada`
  entra na conta.
- **`min_parada_outras` é calculado e gravado, mas nunca subtraído.** Vai para
  `capacidade_fato` como informação e não afeta número nenhum.

Ambos são decisões pendentes, não defeitos: falta definir o que "abate
disponível" deve significar na cadeia.

---

## 6. Fora de escopo até alguém precisar

- Usuários com perfil e escopo por área (hoje é senha única via `APP_SENHA`)
- Multi-empresa com Row Level Security
- As tabelas `escala` e `escala_dia` seguem sem uso de propósito: na empresa
  quem faz rodízio é a pessoa, e isso é calendário, não escala
