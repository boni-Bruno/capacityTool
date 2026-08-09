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

A empresa já produz uma base de demanda orçada (`Demanda Orçamento 2026`),
96.774 linhas, com estas colunas:

```
Cenário · Grupo Estoque · Nível Estoque · Linha Produto Agrupada ·
Família Produto · Família Tecelagem · Tecido Base · UM · CT · Período ·
Depósito Localidade SKUs · Total Produção (M\Kg) · Total Produção (Un) ·
Duração (Min)
```

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

O `CT` da base é o `CC-CT` do nosso cadastro — 100% das 70.956 linhas seguem o
formato `\d+-\d+`. Como `recurso.codigo` é `CC-CT-Patrimônio`, a máquina
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

### Em aberto

- Formato de entrada: hoje só existe `.xlsx` pré-pronto; está sendo avaliada
  extração em `.csv` ou `.qvd`
- O `.xlsx` tem 6,4 MB e função serverless da Vercel aceita ~4,5 MB de corpo.
  O caminho é ler o arquivo no navegador e enviar já processado — `.xlsx` é um
  zip de XML e o navegador tem `DecompressionStream` nativo, então dá para ler
  sem dependência nova

### Regra de leitura do período

O formato `AAAA.MM` vem da base e não pode ser alterado na origem. A tradução
mora na importação: guarda-se o texto original como veio, para rastreabilidade
e extração, e o par `(ano, mês)` normalizado, que é por onde o join com a
capacidade acontece. Nenhuma das duas pontas precisa saber do formato da outra.

**Cuidado com `2026.10`.** O valor parece um número, e no `.xlsx` ele vem como
texto — conferido, o zero está lá. No caminho do CSV isso é um clássico: se
qualquer ferramenta no meio tratar a coluna como numérica, `2026.10` vira
`2026.1` e passa a colidir com janeiro. Duas linhas somadas no mês errado, sem
erro nenhum na tela. A importação tem que recusar período que não case com
`\d{4}\.\d{2}` em vez de tentar adivinhar.

---

## 2. Tabela de validação demanda × capacidade

Sai da importação e responde as duas pontas soltas:

- **Demanda sem capacidade** — CT na base que não casa com recurso nenhum
- **Capacidade sem demanda** — recurso cujo CT não aparece na base

Nenhum dos dois é erro: o primeiro costuma ser cadastro faltando ou zero à
esquerda, o segundo é máquina fora do plano. Mas os dois calados viram número
errado que ninguém percebe.

Como demanda e capacidade já estão na mesma moeda — a base traz 121.179.675
minutos no ano —, a comparação "cabe?" sai de graça junto, sem depender da
conversão para unidade.

Da primeira leitura da base, o que a validação vai encontrar:

- 24.342 linhas (25%) sem CT — itens comprados ou de revenda, coerentemente
  sem duração; devem ser ignoradas
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
