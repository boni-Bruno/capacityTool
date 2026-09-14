# POP-02 — Cadastrar pessoas por turno

## Quando usar

Recurso do tipo **PESSOA** (posto de confecção, revisão, embalagem…): a
capacidade é gente escalada, não máquina existente.

## Antes de começar

- O recurso está cadastrado com Tipo = PESSOA (Recursos). Ele **não tem Qtd**.
- Os turnos têm horário e intervalo de refeição (Turnos): pessoa para para
  almoçar; o intervalo desconta.

## Passos

1. **Turnos do recurso**: área, **Tipo = pessoa** (o seletor nasce em máquina
   e avisa quando há pessoas na área), recurso, ano.
2. Em cada turno, digite **quantas pessoas** trabalham em cada mês. Sem teto:
   12 no 1º e 20 no 3º é legítimo. A caixa *→ ano todo* preenche os doze
   meses. Vazio = ninguém naquele turno.
3. Regime (calendário). Salvar.
4. OEE, se diferente de 100%.
5. **Recalcular parcial** para o recurso.

## Como conferir que deu certo

- No painel, a **instalada é igual à planejada** para pessoa — é assim que se
  reconhece um recurso de gente.
- No Simulador de recursos, a coluna *Unidades por dia* mostra a soma dos
  turnos (10 + 8 = 18).

## O que costuma dar errado

- Cadastrar pessoas em lote com *todos os filtrados* → o lote é só de
  máquina; pessoa é uma a uma.
- Mudar a equipe no meio do ano → digite o número novo a partir do mês da
  mudança; os meses anteriores ficam com o número antigo (a vigência é por
  mês).
- Posto com OEE cadastrado e **sem turno** → não gera capacidade nenhuma e
  não aparece no simulador. Falta o passo 2.
