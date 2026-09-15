# Extração das configurações

**Menu:** Extração › Extração das configurações.

## Para que serve

Um documento `.pptx`, **dentro do modelo de slides da empresa**, contando como
a fábrica está configurada num recorte e quanta capacidade isso produz: por
recorte inteiro, por CC, por CT, ou a apresentação completa (planta, áreas, e
cada CC seguido dos seus CTs).

## Modelo

Importe o `.pptx` da empresa **uma vez**, com uma caixa de texto contendo a
marca indicada na tela, do tamanho do corpo do slide — é o retângulo dela que
o gráfico ocupa. Os outros slides passam intactos; o slide da marca é
repetido, um por grupo.

## O que entra

Árvore **planta › área › CC**: marcar um nível marca tudo abaixo; o mesmo
botão desmarca. **As marcações não ficam na URL** — recarregar a página perde
o recorte.

## Como sai

Slides (resumo / por CC / por CT / apresentação), ano, período de mês a mês,
capacidade (disponível, planejada, instalada) com OEE meta ou simulado, unidade
(minuto, metro, UM — metro e UM só com cenário), demanda (um cenário ou
nenhum), e as **faixas de cor** da ocupação.

Cada slide leva o gráfico mês a mês (barras de capacidade, linha de demanda)
e, alinhada coluna a coluna, uma grade com o OEE e a quantidade de recursos
por turno — para ver se a barra de março caiu pelo OEE ou por um turno a menos.
**Todos os turnos cadastrados** aparecem como linha; onde o recurso não roda
naquele turno a célula fica em branco.

## Cuidados

- O `.pptx` é montado no navegador; o servidor só entrega os números.
- Mais de 60 slides sai, mas demora e dá arquivo grande.
- É a rodada: cadastro não recalculado não aparece.
