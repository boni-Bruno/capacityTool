# Roadmap

O que ainda não existe, e o que já foi decidido sobre cada coisa.

Ele existe para a decisão não se perder entre uma conversa e a próxima. Item
construído sai daqui e vira comentário no código ou no arquivo de migração — o
que fica é o desenho ainda por fazer, mais o registro do porquê de cada escolha,
que continua valendo depois de pronta.

**O que ainda falta está reunido em [O QUE FALTA](#o-que-falta)**, perto do fim.
O resto é registro do que já foi decidido e construído — útil para não
redecidir, e para entender por que uma coisa é como é.

Para **como trabalhar neste projeto** — o que nunca se roda na máquina local,
quem executa as migrações, as convenções de código e os conceitos do domínio —
ver o [CLAUDE.md](CLAUDE.md). Este arquivo conta o QUE; aquele conta o COMO.

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

As pendências do casamento estão em **O QUE FALTA**, no fim deste arquivo.

### O cadastro grava o CT como foi digitado — decidido

O formato canônico existe e é objetivo: na base de demanda, **os 123 CTs são
`CCC-CCC` sem exceção**. No arquivo de recursos do AP, 189 de 193 também; as
quatro fora do padrão — `383-11`, `513-14`, `513-17`, `513-45` — são facção com
quantidade zero, que o AP não usa para calcular capacidade, e não existem na
demanda em nenhuma das duas grafias.

Chegou a ser proposto normalizar na gravação: CC e CT numéricos com
`padStart(3, '0')`, sem truncar. **Recusado pelo Bruno em 30/08/2026**: o
cadastro grava o que a pessoa digitou, e digitar certo é responsabilidade de
quem cadastra.

Fica registrado para não ser reproposto. O efeito conhecido de um CT mal
digitado continua valendo e está documentado acima: ele não casa com a demanda,
o recurso converte para zero, e isso não dá erro em lugar nenhum — a tela de
Demanda mostra o CT na lista de "capacidade sem demanda", que é onde se
percebe.

---

## 3. DE/PARA e regras de classificação da demanda — PRONTO

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

**Voltar ao mix da base** é sempre possível, de dois jeitos: o botão *usar o da
base*, no editor de um CT, apaga o ajuste daquele CT/ano/atributo; e um mês com
todas as células zeradas não é gravado, então aquele mês volta ao cálculo da
base sozinho. O ajuste é uma camada por cima — o mix da base nunca é
sobrescrito, e continua sendo recalculado a cada carga.

**O mix ajustado muda o índice de conversão do painel**, com ou sem filtro. O
índice de um CT é a média das taxas dos produtos dele ponderada pelo tempo —
metade a 15 m/min e metade a 5 dá 10; 100% do primeiro dá 15 — então mexer no
mix tem que mexer no metro e na peça. Antes o ajuste só valia quando havia um
rótulo escolhido no filtro, e ficava mudo justamente na leitura mais comum.

Rótulo sem taxa conhecida sai da média inteira, numerador e denominador, e a
fatia perdida é reportada: dizer que ele rende zero derrubaria a capacidade em
silêncio. Dois atributos ajustados para o mesmo CT são duas respostas para a
mesma pergunta — vale o primeiro na ordem do cadastro, e o painel diz qual.

A leitura cara das combinações só acontece se existir ajuste, e limitada aos
CTs que têm. O painel usa o ajuste no rateio por atributo automaticamente, e o
rodapé diz em quantos CT×mês o mix manual está valendo.

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

Em **OEE**, os mesmos filtros de CC e CT — e eles também definem o alcance do
**Aplicar em vários**: filtrar o CC 278 é dizer "os nove CTs dele", e o painel
de lote lista quais são, um por um, desmarcáveis. Ali **mês em branco não apaga
nada** (mescla com o que o recurso já tem), ao contrário do editor de um
recurso, que reescreve o ano.

**Calendários: a grade é sempre de uma área.** A opção "todas as áreas" saiu —
ela pintava a união dos feriados de todas, um calendário que nenhuma área tem
de verdade, e a contagem de dias úteis saía de um mix que não é de ninguém. O
padrão é Confecção quando existe; sem ela, a primeira área da planta.

**Gráfico e tabela mês a mês são a mesma grade**, nos dois painéis: janeiro do
gráfico cai exatamente sobre janeiro da tabela. As larguras da coluna de rótulo
e da de total moram em `app/painel/grade.js` — o gráfico as usa como margem, a
tabela como largura de coluna — e os dois compartilham uma única caixa de
rolagem, senão rolar um desalinharia do outro.

**Modo claro e escuro**, com o claro por padrão (`lib/tema.js`). A escolha vai
para um cookie e o servidor já pinta o HTML certo — com localStorage haveria uma
piscada branca a cada carregamento, que é justamente o que incomoda quem
escolheu o escuro. Só a paleta muda: nenhuma regra de layout se repete no tema
escuro. O gráfico recebe as cores por prop (`app/painel/cores.js`), porque o
recharts pinta por atributo do SVG e variável de CSS não resolve ali.

**O painel da ocupação ganhou o mesmo container de duas abas**: *por centro de
trabalho* (a de sempre) e *por atributo* — a mesma ocupação por produto em vez
de por máquina. Um rótulo pode estourar em junho sem que nenhum centro estoure,
porque ele divide o mês com os outros. A capacidade vem rateada pela fatia de
tempo; a demanda vem inteira, porque ela já é da linha e a linha já é
classificada.

**Os filtros dos dois painéis ganharam operador e vários valores**
(`lib/filtro.js`, 14 verificações): é um de, não é nenhum de, contém, não
contém, começa com, termina com, está vazio, não está vazio. Um campo, um
operador e uma lista de valores, na URL como `f_<campo>=in:278,401`.

O mesmo controle aparece na barra de cima e num **▼** ao lado do título de cada
coluna de texto — os dois escrevem o mesmo parâmetro, então nunca discordam. As
opções de cada campo saem da lista já recortada pelos **demais** filtros, o que
generaliza a cascata CC→CT para todos eles, em qualquer ordem. Campo filtrado
pinta a caixa inteira, e a coluna filtrada tinge o cabeçalho. E entre campos, OU
dentro do campo. Um resumo acima da tabela diz o que está recortando, porque
filtro que mostra menos sem se anunciar faz o total menor parecer capacidade
menor.

**A tabela de baixo do painel virou um container de duas abas**, com a URL
decidindo qual está aberta: *Capacidade por recurso* (padrão, a de sempre) e
*Capacidade por atributo* — a mesma capacidade disponível repartida entre os
rótulos de um atributo escolhido, mês a mês, em qualquer unidade.

Em minuto a soma dos rótulos fecha com o total (as fatias de um CT somam 1); em
metro e peça ela não fecha, porque cada rótulo converte pela taxa DELE — e é
essa diferença que a tabela existe para mostrar. Ela acompanha a leitura **por
dia útil** como o resto do painel: cada mês pelos dias úteis dele, e o total
pela soma dos dias do período. O mix ajustado à mão vale ali
como no resto do painel. As duas consultas caras só acontecem com a aba aberta.

**No painel, a tabela por recurso** mostra Planta, Área, CC, CT e Recurso, e
ordena por qualquer coluna — a ordem vive na URL, como o resto do painel.
Filtros de CC e CT entraram ao lado de sub-área e tipo, e valem também para os
indicadores e o gráfico.

**No painel, o ano subiu** para a caixa de leitura ao lado dos indicadores,
acima dos botões de unidade — e vem como botões, não lista suspensa: são quatro
ou cinco anos, e escondê-los atrás de um clique custa mais que a largura. Ele é o recorte mais graúdo que existe — tudo ali
em cima fala dele — e estava entre os filtros da tabela de recursos, no fim da
página.

## Painel da Ocupação — PRONTO

Segundo painel, em `/ocupacao`. O da capacidade responde "quanto cabe"; este
responde "cabe?" — a capacidade escolhida (disponível, planejada ou instalada)
desenhada como **área**, e a demanda em **colunas dentro dela**, no mesmo eixo.
A área é o espaço que existe, a coluna é o quanto dele foi pedido, e coluna que
passa do teto é o que não cabe: a pergunta vira geométrica.

Abaixo do gráfico, a tabela mês a mês com capacidade, demanda, ocupação e
sobra. A ocupação do total não é a soma nem a média das mensais — é a demanda
do período sobre a capacidade do período.

**Em minuto e hora, só.** A demanda da base é tempo de roteiro já explodido
para a quantidade do plano; comparar minuto com minuto dispensa índice de
conversão. Metro e peça ficam no painel da capacidade.

**No grão do CT**, e não do recurso: a capacidade é do recurso e a demanda é do
centro de trabalho: dois recursos no mesmo CT dividem uma demanda que não sabe
deles, e o dado não tem por onde repartir.

A base de demanda é escolhida no próprio painel e **pode não ser a corrente** —
a que está no ar serve à conversão em metro, e a ocupação pode comparar contra
outro cenário sem trocar o que todo mundo vê. Importar é na tela de Demanda: é
lá que a carga se confere antes de existir.

Os filtros são os mesmos do painel da capacidade — período, sub-área, tipo, CC
e CT — e valem para os indicadores, o gráfico e a tabela. Clicar num CT
estreita nele, como clicar num recurso do outro painel.

## 6. Recalcular tudo — PRONTO

O botão do painel refaz **todas** as rodadas numa pressão: cada área ativa com
recurso, cada ano da lista, META e SIMULADO. Antes ele recalculava só o que
estava na tela, e manter a fábrica atualizada exigia passear por área e ano —
o que garante que alguém esqueça uma combinação e a extração leve número velho
misturado com novo, sem nada denunciar.

O laço mora no navegador, uma requisição por rodada, pela mesma razão da
importação de demanda: função serverless tem minuto contado, e trinta rodadas
numa requisição só estouram no meio deixando metade calculada. Em troca dá para
mostrar em que passo está e parar no meio. **A aba precisa ficar aberta até o
fim.**

Área sem recurso não entra. Rodada sem linha é contada à parte das que
falharam — misturá-las mandaria caçar erro onde não há.

**O banco guarda só a rodada corrente** (migração `26_so_a_rodada_corrente.sql`).
Vale uma rodada por (área, ano, origem): a nova substitui a anterior, e o banco
para de crescer. O sistema mostra a capacidade atual — rodada velha não era
consultada por ninguém e só ocupava espaço, sobretudo o memorial, que é ~75%
do volume.

Para isso `calculo_execucao` ganhou `area_id`: sem ela não havia como saber o
que substituir, e descobrir a área de uma rodada exigia varrer a maior tabela
do banco. De quebra, duas consultas caras sumiram — `ultimaExecucao`, que o
painel faz em toda abertura, e o CTE da extração, que agrupava a tabela de
fatos inteira.

## 7. Extração para o AP — PRONTO

Grupo novo no menu (Extração), tela `/cadastros/extracao-ap`. Sai um .csv com
`CT;Periodo;Minutos`, condensado por mês, período em AAAA.MM — o formato da
base de demanda, que é onde os dois sistemas se encontram. Cada área×ano entra
com a última rodada OK do OEE META, a mesma regra do painel aplicada em lote.

**Capacidade por recurso do AP** (migração `27_recurso_ap.sql`). O arquivo ganha
duas colunas: `Qtd. Recurso AP` e `Capacidade por recurso do AP` — os minutos
divididos pela quantidade que o AP conta naquele centro, que é como o outro
sistema raciocina.

A quantidade é importada do `RecursosAP_CapacityTool.parquet`, no painel do
topo da própria tela de extração. O arquivo traz **dois** campos para a mesma
ideia (`QTMAQUINA` e `QTPESSOAS`), e `INDICADORCALCULOCAPACIDADE` diz qual vale
('M', 'P' ou branco); a escolha acontece na leitura, em `lib/ap.js`, e chega ao
banco como um campo só. No arquivo real: 228 linhas → 193 centros, 137 por
máquina, 34 por pessoas, 22 sem quantidade (facção e serviço externo).

Centro sem quantidade sai com as duas colunas **vazias**, não zeradas — zero
seria lido como "capacidade nenhuma" em vez de "esta conta não se aplica" — e a
prévia conta quantas linhas ficaram sem divisor. CT repetido no arquivo (um por
sequência de roteiro) condensa; se as repetições discordarem da quantidade, a
carga para.

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

## Extração das configurações — PRONTO

Segunda tela do grupo Extração, em `/cadastros/extracao-config`. A do AP entrega
minutos por CT e mês para importar de volta; esta entrega um **documento para
alguém ler**: como a fábrica está configurada num recorte, e quanta capacidade
essa configuração produz.

O recorte é uma árvore **planta › área › CC**, com um botão por nível que marca
tudo abaixo e vira "desmarcar" quando já está tudo marcado. A marcação mora na
folha — no CC — e os níveis de cima só refletem o que ela diz: guardar marcação
em três níveis daria três verdades sobre a mesma escolha.

Sai em **.pptx dentro do modelo da empresa** ou em **PDF pela impressão do
navegador**. As duas saídas montam o texto da mesma função — slide e papel
dizendo números diferentes da mesma seleção seria o defeito mais difícil de ver.

**O modelo é importado e guardado** (migração `28_modelo_slide.sql`, uma linha
só: importar substitui). Ele sobe **em pedaços de meio megabyte**, como a base
de demanda: em base64 dentro de um JSON, um modelo com logotipo e fundo passa
do teto de corpo de uma requisição serverless com facilidade. Um slide dele leva `{{CAPACITY_TOOL}}` numa caixa de
texto, e é ali que o conteúdo entra — herdando fonte, tamanho e cor da caixa,
porque o parágrafo é clonado em vez de recriado. Marca em texto sobrevive a
mover, renomear e reordenar slides; posição e título não.

Nada disso usa biblioteca: `lib/zip.js` lê e escreve ZIP (8 verificações, e
validado contra um .xlsx real do Bruno, reescrito byte a byte), e `lib/pptx.js`
acha a marca, clona e preenche (20 verificações).

**Os outros slides do modelo passam intactos** — trabalhar neles ficou para
depois, por decisão.

### As cinco escolhas da extração

Antes saía um slide só, do ano inteiro, com as três capacidades e sem demanda.
Agora a tela pergunta cinco coisas, e todas com a mesma forma — é sempre "qual
destes?", e responder do mesmo jeito dispensa aprender cada uma:

| escolha | opções |
|---|---|
| **Slides** | um slide só (resumo) · um por CC · um por CT |
| **Ano** | os anos com rodada, mais a janela em volta do corrente |
| **Período** | de mês a mês, dentro do ano |
| **Capacidade** | disponível · planejada · instalada, e OEE meta ou simulado |
| **Demanda** | um cenário de carga, ou nenhum |

**Um slide por grupo exige CLONAR o slide da marca**, e clonar um slide do .pptx
é mais do que copiar o `.xml`: ele é citado em quatro lugares — o tipo da parte,
os relacionamentos da apresentação, a ordem dos slides e o `_rels` do próprio
slide. Faltar em qualquer um dá o mesmo estrago: o PowerPoint diz que o arquivo
está corrompido e oferece reparar. O original vira o primeiro do lote, e as
cópias nascem logo depois dele — assim o conteúdo não vai parar depois do slide
de encerramento. As anotações do orador ficam para trás de propósito: uma
notesSlide aponta de volta para UM slide.

**Turnos e calendários vêm em lista de ids, não em contagem.** Dois CTs costumam
dividir o mesmo turno; somar "1 turno" com "1 turno" diria que a fábrica tem o
dobro dos turnos que tem. Com a lista, juntar é união de conjunto e a conta
fecha nos três níveis.

**A ocupação é soma sobre soma**, como no resto do projeto: a de um CC é a
demanda somada dividida pela capacidade somada, e não a média das ocupações dos
CTs — isso daria o mesmo peso a um CT que roda o mês inteiro e a um que quase
não roda.

**Uma consulta só para os três níveis** (`detalheDoRecorte`, aberta por CT): o
CC é a soma dela, e o resumo é a soma de tudo, em `lib/documento.js` (15
verificações). Antes eram três consultas, e três lugares capazes de discordar em
silêncio — os números pareceriam certos cada um sozinho, e ninguém confere um
slide contra o outro.

### O slide é visual

**O título e o subtítulo são os do próprio modelo**: a caixa que aparece escrito
"Título" recebe `Planta - Área`, e a do "Subtítulo" recebe `CC - CTs`. Eles ficam
no alto, com a posição, a fonte e o tamanho que o modelo já decidiu, e a caixa
da marca fica INTEIRA para o desenho — escrever o título dentro dela gastaria a
altura de que o gráfico precisa e ignoraria o campo que existe justamente para
isso. A busca é por TIPO de espaço reservado (`title`, `ctrTitle`, `subTitle`) e,
como alternativa, pela caixa comum em que alguém escreveu literalmente "Título"
— que é como um modelo montado à mão costuma ficar. Espaço reservado vazio
também é preenchido: o "Título" que aparece na tela é sugestão do leiaute, não
conteúdo do arquivo, e sem esse caso o título sumiria justo no modelo bem
montado. Modelo sem título nenhum faz o texto voltar para dentro da caixa da
marca, e o desenho cede a faixa de cima.

A legenda diz a medida e o cenário por extenso — **"Capacidade disponível"** e
**"Demanda cenário X"**. "Disponível" e "Demanda" sozinhos deixam quem lê sem
saber qual das três capacidades está na barra e contra qual plano a linha
compara, e essas duas escolhas são exatamente o que muda de um documento para o
outro. O período e a origem do OEE ficam no canto oposto: são o "quando", e o
título é o "de quem".

Cada slide leva um **gráfico mês a mês** — **a capacidade é a linha com área,
a demanda é a barra**, como no Painel da Ocupação. A capacidade é um teto: vale
o mês inteiro, e uma superfície contínua é o que se parece com isso. A demanda é
o que foi pedido, e cai bem em coluna. Invertido, o desenho diz que a demanda é
o contínuo e a capacidade o discreto — o contrário do que a fábrica é.

**Alinhada coluna a coluna** com ele vem a grade, nesta ordem: mês,
**capacidade**, **demanda**, **ocupação**, **OEE** e a quantidade de recursos de
**cada turno**. Primeiro o que o gráfico desenhou, depois o que explica o
desenho — quem olha quer primeiro o número da barra que está vendo. É a leitura
que tudo isso existe para permitir: a barra de março caiu porque o OEE caiu, ou
porque perdeu um turno?

**O totalizador do período fica numa coluna à direita**, fora das colunas de mês
— deixá-la entrar na divisão faria as doze barras encolherem para caber um treze
que não existe no gráfico. Cada medida totaliza do jeito dela, e é aí que se
erra: capacidade e demanda **somam**; ocupação e OEE são **divisão de somas**,
nunca a média das colunas. Somar doze porcentagens e dividir por doze daria o
mesmo peso a dezembro, que tem recesso, e a março, que roda cheio — e o total
deixaria de bater com a conta que a própria linha de cima mostra. **Turno não
totaliza**: somar "6 recursos em janeiro" com "6 em fevereiro" daria doze numa
fábrica que tem seis, porque turno é estado, não fluxo. A coluna se chama "Ano"
só quando são doze meses; num recorte menor, "Total".

O alinhamento é a exigência do desenho, e por isso a geometria é UMA função
(`lib/visual.js`, 7 verificações) usada pelas duas saídas: DrawingML no .pptx,
SVG na página de impressão. Duas contas de coluna batem hoje e param de bater na
primeira mudança de margem, num defeito que só se enxerga projetado.

**Formas à mão, e não um gráfico do PowerPoint.** Um gráfico de verdade é uma
parte `charts/chart1.xml` mais uma planilha .xlsx embutida no .pptx, com o
relacionamento entre as duas — e o que se ganha é poder editar os números no
PowerPoint, coisa que ninguém faz num documento que sai pronto do sistema e é
regerado a cada mudança. Formas simples abrem em qualquer versão e não têm o que
corromper. `lib/slide-visual.js`, 10 verificações.

**As cores e a fonte vêm do TEMA do modelo** — `accent1`, `accent2`, `tx1`,
`+mn-lt`. Nenhum hexadecimal nosso: um azul do sistema no meio da paleta da
empresa denuncia de longe que aquele slide foi colado.

**O retângulo da caixa marcada é a área pintada.** A marca já diz "o conteúdo
entra aqui"; usar a geometria dela faz o desenho seguir quem a moveu no modelo.
Uma posição fixa em código estaria errada no dia em que o modelo ganhasse uma
faixa lateral — e errada em silêncio, por cima do logotipo. Caixa baixa demais
faz o desenho descer até a margem de baixo em vez de sair achatado.

**Com gráfico, o texto sai da caixa do conteúdo.** Capacidade, demanda, OEE e
turnos estão todos no desenho, mês a mês; repeti-los em texto roubaria a altura
de que ele precisa e daria ao leitor duas versões da mesma informação para
conferir. Recorte sem rodada volta ao documento todo em texto, em vez de sair
vazio.

**O OEE do slide é `disponível ÷ planejada`**, e não a faixa cadastrada lida de
novo: divisão de somas, como o resto do projeto. A segunda fonte poderia mostrar
78% embaixo de uma barra calculada com 75% — a rodada é de ontem, o cadastro é
de hoje, e o slide não teria como avisar.

**Os turnos são mês a mês porque a vigência muda.** Um turno que entra em maio
apareceria o ano inteiro numa contagem única, e a linha embaixo do gráfico diria
que a fábrica tinha três turnos em janeiro.

### As cores da ocupação

Um botão **Cores da ocupação** abre um pop-up onde se cadastra faixa por faixa:
de quanto a quanto, e qual cor. A célula da ocupação sai pintada com a cor da
faixa em que o mês caiu — no slide e no papel. Migração `29_faixa_ocupacao.sql`.

**Por que existe:** ler doze porcentagens e achar as que estouram é o que
ninguém faz numa reunião. A cor faz o mês problemático saltar antes de alguém
terminar de ler a linha.

**Por que é cadastrada e não fixa:** numa fábrica 95% já é aperto; noutra, 105%
é normal porque o plano é agressivo de propósito. Chutar essa régua em código
seria pintar de vermelho um mês que o Bruno considera bom, e ele não teria como
discordar.

**É a única cor do documento que não vem do tema do modelo.** As do gráfico vêm
(`accent1`, `accent2`, `tx1`) porque decoram, e um azul nosso no meio da paleta
da empresa denuncia que o slide foi colado. Esta informa, e quem escolheu foi
quem conhece a régua. Um teste guarda a fronteira: sem faixa cadastrada, nenhum
hexadecimal sai no XML.

**O intervalo é `[de, ate)`** — fechado embaixo, aberto em cima. "85 a 100" e
"100 a 115" se encostam sem se sobrepor, e 100% cai na segunda, que é como se lê
"de 100 em diante". Ponta em branco é infinito daquele lado.

**Sobreposição é recusada; buraco é permitido.** Duas faixas cobrindo 90% dariam
duas cores para o mesmo número, e a que ganhasse dependeria da ordem em que o
banco devolvesse — ou seja, mudaria sozinha; o `exclude using gist` do banco e a
validação de `lib/faixa-cor.js` recusam as duas. Já faixa nenhuma cobrindo 40%
quer dizer "40% não merece cor", que é resposta legítima: obrigar a cobrir de
zero a infinito forçaria a inventar cor para o que não interessa.

**A cor pinta o número, não o fundo da célula.** Faixa colorida atrás dele vira
tarja, e tarja no meio de uma grade de porcentagens compete com o gráfico em vez
de ajudá-lo a ser lido. O número sai em negrito, porque cor sozinha em corpo 7
quase não muda o peso da linha.

Isso deixa a legibilidade nas mãos de quem escolhe — tom claro demais some na
folha branca —, então o pop-up avisa: abaixo de 3:1 contra o branco, que é o
piso das regras de acessibilidade, a cor aparece marcada como *clara demais*. A
amostra ao lado do botão mostra o texto colorido, e não sobre fundo colorido:
amostra que não se parece com o resultado é amostra que engana.

**As escolhas moram em estado do React, e não na URL** — é a única tela do
projeto assim. A marcação da árvore é estado, e trocar `searchParams` remontaria
o componente e apagaria o recorte que a pessoa acabou de montar clicando em
vinte centros de custo. Ano e origem continuam sendo lidos da URL para um link
antigo continuar valendo.

---

## O QUE FALTA

Tudo abaixo está aberto. O resto deste arquivo é registro do que foi decidido e
por quê — útil para não redecidir, mas já construído.

### Do cadastro, para quando ele sair do estágio de teste

- **Oito CTs cadastrados sem par na base**: `226-2`, `313-1`, `313-2`, `313-7`,
  `313-9`, `401-3`, `401-4`, `401-5`. O CC existe, aquele CT não. São máquinas
  que o plano não usa, ou numeração que ainda vai mudar.

### Limpeza de schema

- **Apagar `produto`, `recurso_taxa` e `recurso_taxa.min_setup`.** A base de
  demanda tornou o cadastro de taxa desnecessário, e as três estão no banco
  prometendo uma coisa que não acontece. Vale uma migração.

### Dívidas conhecidas do motor

Levantadas, aceitas na época e ainda abertas.

- **`tipo_parada.abate_disponivel` nunca é lido.** A coluna existe, a tela de
  paradas mostra o selo "não abate", e o motor ignora — só `abate_planejada`
  entra na conta.
- **`min_parada_outras` é calculado e gravado, mas nunca subtraído.** Vai para
  `capacidade_fato` como informação e não afeta número nenhum.

Ambos são decisões pendentes, não defeitos: falta definir o que "abate
disponível" deve significar na cadeia.

### Da origem, fora do nosso alcance

- **2027 vem com 17.196 linhas e zero minutos.** O período existe no plano mas a
  demanda dele ainda não foi calculada lá.

---

## Fora de escopo até alguém precisar

- Usuários com perfil e escopo por área (hoje é senha única via `APP_SENHA`)
- Multi-empresa com Row Level Security
- As tabelas `escala` e `escala_dia` seguem sem uso de propósito: na empresa
  quem faz rodízio é a pessoa, e isso é calendário, não escala
