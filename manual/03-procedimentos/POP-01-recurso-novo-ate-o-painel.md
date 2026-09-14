# POP-01 — Cadastrar um recurso novo até ele aparecer no painel

## Quando usar

Chegou uma máquina, abriu um posto, ou a tela de Demanda mostra um CT em
*demanda sem capacidade*.

## Antes de começar

- Planta e área existem (Estrutura da empresa › Plantas · Áreas).
- Os turnos da planta existem **com horário por dia da semana** (Turnos).
- Existe um calendário (regime) na planta com os dias da semana marcados
  (Calendários).
- Você sabe CC, CT e Patrimônio da máquina — é assim que a demanda vai achar
  o recurso.

## Passos

1. **Recursos › novo**: área, nome, tipo (máquina/pessoa), CC, CT, Patrimônio;
   Qtd e Equivalência se máquina; janela *Em operação de … até* se a máquina
   não existe o ano inteiro. Salvar.
2. **Turnos do recurso**: selecione a área, o **Tipo** certo, o recurso e o
   ano. Marque os turnos (ou digite quantas máquinas/pessoas por turno) mês a
   mês — a caixa *→ ano todo* ajuda. Escolha o **regime**. Salvar.
3. **OEE**: o recurso já nasce com 100% nas duas origens. Ajuste se souber o
   OEE real; a caixa *→ ano todo* repete.
4. **Paradas**: só se já houver parada planejada conhecida.
5. **Painel da Capacidade › Recalcular parcial…**: planta, área, e o recurso;
   ano e origem *todos*. Rodar.

## Como conferir que deu certo

- Painel da Capacidade, área e ano do recurso: ele aparece na tabela por
  recurso, com instalada (máquina) e planejada > 0 nos meses em que tem turno.
- Desça a um mês e a um dia: a planejada do dia bate com o turno líquido ×
  quantidade.
- Se o CT tem demanda: Painel da Ocupação mostra a barra do CT; a tela de
  Demanda não o lista mais em *demanda sem capacidade*.

## O que costuma dar errado

- **Não recalculou** → o recurso não aparece em lugar nenhum. Passo 5.
- **Planejada zero** com turno marcado → o turno não tem horário naquele dia
  da semana (Turnos) **ou** o regime não trabalha naquele dia (Calendários).
- **Pessoa não aparece em Turnos do recurso** → o seletor Tipo está em
  máquina; troque para pessoa.
- **Demanda continua sem capacidade** → CC ou CT digitado diferente da base
  (zero à esquerda, espaço). Confira o Código do recurso contra o CT da base.
- **Aviso "sem parâmetro de capacidade"** → Editar › Salvar no recurso e
  recalcular.
