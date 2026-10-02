# Painel da Ocupação

**Menu:** Consultar › Painel da Ocupação. Responde **"cabe?"**.

## Para que serve

A capacidade disponível (barras) contra a demanda do cenário **no ar**
(linha), em minuto, por mês. Ocupação = demanda ÷ disponível. Desce por
planta › área › CC › CT.

## Controles

Os mesmos do Painel da Capacidade — fábrica (uma área, ou **todas as
fábricas**; abre com "selecionar fábrica…"), ano, OEE —, mais o cenário, que
nasce no que está **no ar** na tela de Demanda e pode ser trocado aqui.

## As cores da ocupação (e o botão que as define)

No alto do bloco *Mês a mês*, ao lado da base de demanda, ficam a **legenda das
cores** e o botão **Cores da ocupação**. A régua é **uma só** e vale em quatro
lugares: o indicador, o mês a mês, a tabela por CT (e a por atributo e a
dinâmica) e o **número que sai no .pptx** da Extração das configurações. Mudar
aqui muda o documento.

- Cada faixa é um intervalo de porcentagem, uma cor e um nome (*ideal*,
  *apertado*, *estourado*…). O nome aparece junto do indicador de Ocupação.
- O intervalo é **fechado no início e aberto no fim**: 85 a 100 e 100 a 115 se
  encostam sem se sobrepor, e 100% cai na segunda. Fim em branco = "daí em
  diante"; início em branco = "até aqui".
- **Porcentagem fora de toda faixa sai sem cor** — e isso é resposta, não falha.
  Sem faixa nenhuma cadastrada, a ocupação aparece sem cor em toda a tela.
- A cor pinta **o número**, não o fundo. Como ela cai em dois fundos (a folha
  branca do slide e o painel, que pode estar em tema escuro), o editor avisa
  quando um tom some num dos dois.
- **Quem muda a régua é quem tem *editar* neste painel** (`ocupacao.editar` no
  cargo). Os demais veem a legenda, mas não o botão — inclusive na tela de
  Extração das configurações, onde o mesmo botão aparece.

## Como ler

- Ocupação **acima de 100%** = o plano pede mais do que cabe. Abaixo = folga.
- **∞** = há demanda e **nenhuma** capacidade calculada ali: o plano pede de um
  centro que não tem onde caber. Não é erro de conta — é divisão por zero, e o
  número que importa (quanto falta) é a própria demanda, na linha de cima. Passe
  o mouse para ver a explicação. Causa quase sempre: CT sem recurso cadastrado
  com aquele CC-CT, ou recurso cadastrado e ainda **não recalculado**.
- **—** = não há nem capacidade nem demanda. Aí não existe ocupação para
  mostrar.
- A ocupação de um período é sempre **Σ demanda ÷ Σ disponível** — a do ano
  não é a média dos meses.
- CT com demanda e **sem capacidade** aparece com barra zero e ocupação
  infinita/vazia: ou o CT não tem recurso cadastrado com aquele CC-CT, ou tem e
  não foi recalculado. A tela de Demanda lista esses CTs em *demanda sem
  capacidade*.

## A grade "Cadastros", embaixo do gráfico

A mesma do Painel da Capacidade, nas mesmas colunas: **OEE** da rodada, **uma
linha por turno** com quantos recursos rodam nele naquele mês, e **Paradas
(minutos)**. Ver `01-painel-da-capacidade.md` para as regras de leitura.

Aqui ela responde a pergunta seguinte à ocupação: *o mês estourou — e o que dá
para mexer?* As três linhas são as três alavancas: o rendimento, a jornada e o
tempo que já está comprometido com parada.

## A aba "Ocupação por centro de trabalho (Tab. Din.)"

A mesma ocupação, no grão **CT × mês**, como tabela dinâmica: agrupar por
Planta, Área, CC, CT e Mês na ordem que quiser, abrir e fechar grupos, e
escolher a agregação (soma, média, mediana, máximo, mínimo, contagem) da
capacidade e da demanda. A agregação vale para as linhas CT × mês do grupo.
**A ocupação é sempre Σ demanda ÷ Σ capacidade do grupo**, seja qual for a
função escolhida — média de ocupações não é ocupação. Recurso não é nível
aqui: a demanda é do CT e não se reparte entre os recursos dele.

## Cuidados

- Depende de **duas** coisas estarem atualizadas: a rodada (Recalcular) e a
  carga no ar (Demanda). Importar uma base nova **não** a põe no ar.
- O rodapé mostra a rodada e o recálculo parcial, como no outro painel.
