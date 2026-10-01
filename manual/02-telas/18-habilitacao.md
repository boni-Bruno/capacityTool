# Habilitação de cenário/ano

**Menu:** Planejamento da capacidade › Habilitação de cenário/ano.
Só o Gestor de Planejamento (ou quem ele autorizar) abre e fecha.

## Para que serve

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

## Prontidão: o checklist antes de abrir

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

## Abrir uma versão

**A v1 exige todas as etapas** — não há nada revisado antes dela para aproveitar.

**Da v2 em diante você escolhe quais etapas a versão exige.** "A v4 só mexeu em
jornada e OEE" é uma decisão sua: o que não for marcado já nasce concluído em
todas as áreas. A ferramenta não adivinha o que mudou, e é melhor assim — ela
não tem como saber, e fingir que sabe seria pior que perguntar.

Dê um **rótulo** ("v2 — depois do corte da Renner"). O número sozinho não lembra
nada a ninguém daqui a dois meses.

## Fechar uma versão

Fechar faz duas coisas ao mesmo tempo:

1. **Tranca o cadastro** daquele cenário e ano — ninguém mexe mais.
2. **Guarda a fotografia**: o resultado por recurso e mês da rodada que está no
   ar. É ela que faz a comparação entre versões existir.

**Recalcule antes se mexeu em algo há pouco.** A foto sai da **rodada**, não do
cadastro — rodada velha vira foto velha, e depois de fechada ela não muda mais.

Fechar com áreas pendentes é possível e fica registrado: o martelo bate quando
bate.

## Comparar duas versões

Escolha **De** e **Para** entre as versões que têm fotografia, e a tabela mostra
planejada e disponível mês a mês, com a diferença.

Os números saem da **fotografia** de cada versão, não da rodada atual — por isso
eles não mudam quando alguém recalcula. O endereço da tela carrega as duas
versões escolhidas: mandar a comparação para alguém é mandar o link.

Só aparecem versões **com foto**. Uma versão fechada sem rodada nenhuma não tem
o que comparar, e mostrá-la daria zero — que se leria como queda de capacidade.

## O que a versão aberta libera (e a fechada tranca)

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

## Cuidados

- **Uma versão aberta por cenário e ano**, e é o banco que garante. Duas abertas
  seriam duas pessoas cadastrando coisas diferentes achando que é a mesma.
- Versão não se apaga. Apagar levaria junto a fotografia, que é o registro de um
  número que alguém já aprovou numa reunião.
- A fotografia é **mensal**, não diária. Ela responde "o que mudou da v3 para a
  v4"; não responde "o que mudou no dia 12 de março" — para isso é o painel, com
  a rodada atual.
