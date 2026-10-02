# Painel da Capacidade

**Menu:** Consultar › Painel da Capacidade. Responde **"quanto cabe"**.

## Para que serve

Mostra instalada, planejada e disponível de uma área (ou planta, ou fábrica)
num ano, mês a mês, com a instalada como área de fundo e planejada e
disponível como barras. Abaixo, a tabela por recurso. Clicando num mês desce
ao **dia**; no dia, ao **turno**.

## Controles

- **Fábrica** — o painel abre com "selecionar fábrica…" e sem número nenhum;
  escolha uma área (`Planta · Área`) ou **todas as fábricas**, que soma a
  rodada de cada área e demora mais para abrir. **Ano / OEE (meta ou
  simulado)** completam o recorte. Tudo fica na URL: o endereço descreve a
  tela, e um link colado abre no mesmo lugar.
- **Unidade** — minuto, hora, metro, UM. Metro e UM só aparecem com cenário no
  ar, e a instalada não converte.
- **Filtro por atributo** (quando há DE/PARA) — soma a *fatia* de cada CT que
  aquele rótulo ocupa na demanda.
- **Capacidade por dia útil** — o total do mês dividido pelos dias úteis do
  calendário, com os pesos da tela de Calendários.
- **Recalcular tudo** e **Recalcular parcial…** — ver `03-procedimentos/POP-04`.

## Como ler

- **% do teto** = planejada ÷ instalada. Máquina com um turno só mostra ~33%;
  isso é a ociosidade planejada, não erro.
- O rodapé diz **quando** a rodada foi calculada e se houve **recálculo
  parcial** depois. Se a data é anterior ao seu último cadastro, o painel ainda
  não viu o cadastro. Em *todas as fábricas* ele diz quantas rodadas somou, a
  data da **mais antiga**, e quantas áreas ficaram de fora por não terem rodada
  naquele ano.
- **Capacidade por dia útil** só existe com uma área escolhida: o divisor é do
  calendário e dos feriados daquela área.

## A grade "Cadastros", embaixo do gráfico

Logo abaixo da tabela de capacidade, nas **mesmas colunas**, vem o cadastro que
produziu aquelas barras:

| linha | o que é |
|---|---|
| **OEE (meta/simulado)** | o OEE que a rodada aplicou — disponível ÷ planejada |
| **uma linha por turno** | quantos recursos rodam naquele turno naquele mês |
| **Paradas (minutos)** | os minutos que o motor descontou no mês |

É a mesma grade que sai nos slides da **Extração das configurações**, e serve à
mesma pergunta: *a barra de março caiu porque o OEE caiu ou porque perdeu um
turno?*

- O **OEE** é o da rodada, não o da tela de OEE. Mudou o cadastro e ainda não
  recalculou? A grade mostra o que foi usado, não o que está cadastrado.
- **Turno não totaliza** — a coluna do ano traz "–". Somar seis máquinas de
  janeiro com as mesmas seis de fevereiro daria doze.
- **Célula de turno em branco** quer dizer que ele não roda neste recorte. Os
  turnos da planta aparecem todos, mesmo os que não rodam: é assim que a grade
  consegue dizer "o 3º turno não roda aqui".
- As **paradas** são sempre em minuto, mesmo com o painel em hora ou metro, e
  são o que o motor descontou — não a soma da tela de Paradas, que vale por
  turno e pode cair fora do calendário do recurso.
- Ela aparece no **mês a mês**. No dia a dia e no turno a turno, não: OEE,
  regime e vigência de turno são mensais, e a grade repetiria 31 vezes o mesmo
  cadastro.
- Com **filtro por atributo** ligado, a grade **não** acompanha o rateio: ele
  reparte tempo entre rótulos, e máquina não se reparte.

## A aba "Capacidade por recurso (Tab. Din.)"

A mesma capacidade, no grão **recurso × mês**, como tabela dinâmica:

- **Agrupar por**: clique nos campos na ordem em que devem empilhar (Planta,
  Área, Sub-área, CC, CT, Recurso, Tipo, Calendário, Mês). O número no chip é
  a posição; as setas ao lado do caminho reordenam. Clicar de novo tira o
  campo.
- **▸ / ▾** abre e fecha cada grupo; *abrir tudo* e *fechar tudo* no alto.
- **Agregação** por medida: soma (padrão), média, mediana, máximo, mínimo,
  contagem. Vale para as **linhas do grão** dentro do grupo: média num CC é a
  média dos recurso × mês daquele CC.
- **% do teto e OEE** não seguem a função escolhida: são sempre soma sobre
  soma do grupo.
- O número pequeno ao lado do nome do grupo é quantas linhas recurso × mês ele
  tem.
- Os filtros da barra e da árvore valem aqui também. Agrupamento e agregação
  ficam na URL; o que está aberto, não.
- Em metro e UM a instalada fica de fora, como no resto do painel.

## Cuidados

- Sem rodada para a área/ano/origem escolhidos a tela avisa e fica vazia. Não é
  falta de cadastro — é falta de **Recalcular**.
- Planejada acima da instalada em algum mês = **turnos sobrepostos** (a tela de
  Turnos do recurso avisa quais).
