# Roadmap

O que ainda não existe, e o que já foi decidido sobre cada coisa.

**Nada neste arquivo está implementado.** Ele existe para a decisão não se
perder entre uma conversa e a próxima — quando um item for construído, sai
daqui e vira comentário no código ou no arquivo de migração.

---

## 1. Conversão de minutos para unidade (peça, metro, kg)

A capacidade é calculada em minutos. A pergunta que falta responder é "quanto
eu faço", e ela só fecha com uma premissa de mix — que produto vai rodar.

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

## 2. Tabela de validação demanda × capacidade

Sai da importação e responde as duas pontas soltas:

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

---

## 3. Dívidas conhecidas do motor

Levantadas, aceitas na época e ainda abertas.

- **`tipo_parada.abate_disponivel` nunca é lido.** A coluna existe, a tela de
  paradas mostra o selo "não abate", e o motor ignora — só `abate_planejada`
  entra na conta.
- **`min_parada_outras` é calculado e gravado, mas nunca subtraído.** Vai para
  `capacidade_fato` como informação e não afeta número nenhum.

Ambos são decisões pendentes, não defeitos: falta definir o que "abate
disponível" deve significar na cadeia.

---

## 4. Fora de escopo até alguém precisar

- Usuários com perfil e escopo por área (hoje é senha única via `APP_SENHA`)
- Multi-empresa com Row Level Security
- As tabelas `escala` e `escala_dia` seguem sem uso de propósito: na empresa
  quem faz rodízio é a pessoa, e isso é calendário, não escala
