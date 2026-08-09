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

### A conta

O CT produz em mais de uma UM (o 460-001 faz PC, JG2, JG3, JG4, PT6 e DZ), e
somar peça com jogo de 4 não significa nada. Então a conversão é uma cesta:
reparte o tempo disponível na proporção em que a demanda o reparte, e converte
cada fatia pela taxa dela.

```
fatia_u   = Σ min(CT, mês, UM=u)  ÷  Σ min(CT, mês)
índice_u  = Σ Un(CT, mês, UM=u)   ÷  Σ min(CT, mês, UM=u)

capacidade_u = disponível_min(CT, mês) × fatia_u × índice_u
```

Com uma UM só no CT, `fatia = 1` e a conta desaba na forma simples.

`índice` é a média harmônica ponderada, e é o único jeito certo: ponderar as
taxas pela participação em QUANTIDADE infla a capacidade, porque o produto
lento ocupa mais tempo do que a participação em quantidade sugere. Com 1.000 kg
de A a 100 kg/h e 1.000 kg de B a 50 kg/h, a média por quantidade dá 75 kg/h e
a realidade é 66,7.

### O vínculo com o recurso é derivado, não cadastrado

O `CT` da base é o `CC-CT` do nosso cadastro — 100% das 70.956 linhas seguem o
formato `\d+-\d+`. Como `recurso.codigo` é `CC-CT-Patrimônio`, a máquina
pertence ao CT formado pelos próprios `maquina_fisica.cc` e `.ct`. Nenhuma
tabela de-para para manter desatualizada.

Atenção aos zeros à esquerda: `100-001` não casa com um cadastro que tenha
`cc = 100` e `ct = 1`.

### `Total Produção (M\Kg)` está fora do escopo inicial

A coluna traz o peso ou o comprimento da ficha técnica, e **não dá para saber
pelo arquivo qual dos dois é**:

| UM | M\Kg = Un | M\Kg ≠ Un | quando difere |
|---|---|---|---|
| M | 35.196 | 652 | 0,2674 → 267 g por metro |
| PC | 24 | 32.375 | 0,1750 → 175 g por peça |
| KG | 366 | 36 | 1,0330 → ? |

Para `UM = M` a coluna é metro em 98% das linhas (cópia de `Un`) e quilo nas
outras. A regra "se UM=M então M\Kg é kg" quebra.

`Total Produção (Un)` é a UM do material e não tem ambiguidade — é por onde
começa. Destravar metro e quilo depende de a extração trazer uma coluna
dizendo o que `M\Kg` é.

### Decidido

- Guardar a base **crua**, não só o agregado — ela vai responder perguntas que
  ainda não foram feitas
- `Cenário` é o nome da versão da carga (`Orçamento_2026_v3_Plano_Compras`);
  cada carga é uma versão, nunca uma sobrescrita
- O painel mostra a **cesta inteira**; o usuário não escolhe várias UMs
- A meta é padronizar numa UM que faça sentido para leitura — possivelmente
  converter tudo para metro
- Período da base é mensal (`2026.01`), o mesmo grão da capacidade

### Em aberto

- Formato de entrada: hoje só existe `.xlsx` pré-pronto; está sendo avaliada
  extração em `.csv` ou `.qvd`
- O `.xlsx` tem 6,4 MB e função serverless da Vercel aceita ~4,5 MB de corpo.
  O caminho é ler o arquivo no navegador e enviar já processado — `.xlsx` é um
  zip de XML e o navegador tem `DecompressionStream` nativo, então dá para ler
  sem dependência nova
- Qual UM única faz sentido como padrão de apresentação

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
- 11 dos 123 CTs misturam unidades físicas de verdade: `401-001` faz contável,
  quilo e metro; `654-004` faz contável e quilo

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
