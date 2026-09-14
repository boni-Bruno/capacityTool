# Painel da Capacidade

**Menu:** Consultar › Painel da Capacidade. Responde **"quanto cabe"**.

## Para que serve

Mostra instalada, planejada e disponível de uma área (ou planta, ou fábrica)
num ano, mês a mês, com a instalada como área de fundo e planejada e
disponível como barras. Abaixo, a tabela por recurso. Clicando num mês desce
ao **dia**; no dia, ao **turno**.

## Controles

- **Planta / Área / Ano / OEE (meta ou simulado)** — o recorte. Tudo fica na
  URL: o endereço descreve a tela, e um link colado abre no mesmo lugar.
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
  não viu o cadastro.

## Cuidados

- Sem rodada para a área/ano/origem escolhidos a tela avisa e fica vazia. Não é
  falta de cadastro — é falta de **Recalcular**.
- Planejada acima da instalada em algum mês = **turnos sobrepostos** (a tela de
  Turnos do recurso avisa quais).
