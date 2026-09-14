# Simulador de recursos

**Menu:** Extração › Simulador de recursos.

## Para que serve

Responder **"com quantas pessoas (ou máquinas) por dia este CT atende a
demanda do cenário?"** — num `.xlsx` **com fórmulas**, para simular no Excel.
A ferramenta não simula na tela de propósito: o que você decidir se cadastra
pelo caminho normal (Qtd em Recursos para máquina, pessoas por turno em Turnos
do recurso) e se recalcula.

## Como usar

1. Marque o recorte na árvore planta › área › CC.
2. Ano, OEE (meta/simulado) e **cenário** (obrigatório — sem demanda não há o
   que dimensionar).
3. **Gerar prévia** — tabela por CT × ano com os valores da rodada.
4. **Baixar .xlsx**.

## A planilha — aba Por CT

Uma linha por CT e mês, mais uma linha **Ano** por CT. O disponível da rodada
aberto em fatores:

| coluna | o que é | editável? |
|---|---|---|
| Demanda (min) | do cenário | não |
| Dias úteis | os do motor (sem os "só apresentação") | não |
| Min planejados por unidade por dia | o turno líquido **médio** por dia útil, sem OEE | não |
| **OEE** | o da rodada | **sim** |
| Min disponíveis por unidade por dia | = planejados × OEE | fórmula |
| **Unidades por dia** | soma dos turnos: 10 no 1º + 8 no 2º = **18** | **sim** |
| Disponível (min) | = unidades × min disponíveis × dias úteis | fórmula |
| Ocupação calculada | = demanda ÷ disponível | fórmula |
| **Ocupação alvo** | nasce em 100% | **sim** |
| Unidades por dia necessárias | = (demanda ÷ dias úteis) ÷ min disponíveis ÷ alvo | fórmula |
| Planejado (min) · Unidades × dias úteis | auxiliares para a linha Ano e a aba Por CC | fórmula |

Com os valores da rodada, o disponível da fórmula é **exatamente** o do
painel. Mude OEE ou unidades e tudo à direita responde. **O alvo divide**:
a 85% precisa de mais gente que a 100%.

## Aba Por CC

As mesmas colunas, somando os CTs de cada CC por referência direta às linhas
da aba Por CT. Dias úteis do CC é o maior entre os CTs.

## Como ler

- **Unidades por dia** é a **soma dos turnos** — para máquina também: 3 de dia
  e 1 de noite aparecem como 4. Como dividir entre turnos é decisão sua na
  hora de cadastrar.
- **Min planejados por unidade por dia** é média: sábado tem 240 min e segunda
  480, e em janeiro dá 436. Isso **não é OEE**, é sábado. Varia de mês para
  mês porque a proporção de sábados varia.
- Aviso *"sem capacidade calculada para este CT"*: o CT não tem linha na
  rodada — ou não tem turno/calendário cadastrado, ou não foi recalculado.

## Cuidados

- **Recalcule antes de gerar.** O simulador lê a rodada; calendário, turno e
  OEE cadastrados agora só entram depois de Recalcular.
- A demanda tem que existir no ano escolhido — cenário com demanda só em 2026
  sai zerado em 2027.
