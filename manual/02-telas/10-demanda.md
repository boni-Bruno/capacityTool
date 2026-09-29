# Demanda

**Menu:** Conversão da capacidade › Demanda.

## Para que serve

Importar a **base de demanda** da controladoria (arquivo `.parquet`), guardar
cada importação como uma **carga** com nome de cenário, escolher qual está
**no ar**, e explorar o cruzamento demanda × capacidade.

## Importar

O arquivo é lido **no navegador** e enviado em lotes. Cada importação vira uma
carga nova; a anterior fica guardada. A carga tem **observação** — grave o que
a distingue ("sem o pedido X", "reprocesso do ciclo anterior") porque daqui a
um mês duas cargas com o mesmo nome não se distinguem de outro jeito.

## Quantos cenários cabem: 4

A ferramenta guarda **no máximo 4 cargas ao mesmo tempo**. Com 4 importadas, o
botão de escolher arquivo fica desligado até você apagar uma.

Não é preciosismo: cada cenário são ~140 mil linhas e uns **30 MB permanentes**
do banco, e **nenhum sai sozinho** — importar nunca apagou nada. Foi assim que
quatro ciclos de S&OP viraram um terço do banco sem ninguém decidir isso. O
limite força a escolha de qual não serve mais a ser feita **agora**, e não meses
depois, quando faltar espaço para o ano de orçamento e ninguém relacionar uma
coisa com a outra.

Quatro cobre o uso real: os dois últimos ciclos, o orçamento em construção e um
de comparação.

## No ar

**A carga no ar é a que o Painel da Ocupação usa.** Importar **não** troca
sozinho; marcar *no ar* é que troca — de propósito, para o número que alguém
está olhando não mudar porque outra pessoa importou um arquivo. A carga no ar
não pode ser apagada.

## Explorar

- **Demanda sem capacidade** — CTs que o plano pede e que não têm recurso
  cadastrado com aquele CC-CT (ou têm e não foram recalculados). Ordenada por
  peso: é a fila do que falta cadastrar. Nada precisa ser reimportado: cada
  recurso cadastrado faz a linha passar a valer sozinha (depois de Recalcular).
- **Capacidade sem demanda** — máquina cadastrada que o plano não usa. Pode ser
  numeração a acertar ou recurso que não entra neste cenário; nenhum é defeito.
- **Índice** — o índice de conversão por CT e mês (quantidade ÷ minutos), com
  a origem dele: próprio, herdado do CT irmão, média do CC, ou nenhum.
- Linhas **com quantidade e sem tempo de roteiro** não convertem — a conversão
  é quantidade ÷ minutos.

## Cuidados

- Base nova → conferir *demanda sem capacidade* → cadastrar o que falta →
  **Recalcular** → pôr no ar → só então avaliar ocupação e simulador.
- Trocar a carga no ar muda o índice, e com ele metro e UM nos painéis.
