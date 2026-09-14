# POP-05 — Simular quantidade de recursos para uma demanda

## Quando usar

Base nova, cenário novo, ou a ocupação de um CC passou de 100% e a pergunta é
"quantas pessoas (ou máquinas) por dia eu precisaria?".

## Antes de começar

- Os recursos do recorte têm turno, calendário e OEE cadastrados **e a rodada
  está recalculada** (POP-04). O simulador lê a rodada, não o cadastro.
- O cenário de demanda está importado (não precisa estar no ar) e tem
  demanda no ano que você vai simular.

## Passos

1. **Extração › Simulador de recursos**: marque o recorte na árvore.
2. Ano, OEE, cenário. **Gerar prévia**.
3. Leia a prévia: CTs com aviso *sem capacidade calculada* ainda não têm
   rodada (turno/calendário faltando ou não recalculado) — resolva antes, ou
   siga sabendo que eles sairão zerados.
4. **Baixar .xlsx** e abrir no Excel. As fórmulas calculam ao abrir.
5. Na aba **Por CT**, mexa só nas células destacadas: **OEE**, **Unidades por
   dia** e **Ocupação alvo**. Disponível, ocupação calculada e unidades
   necessárias respondem. A aba **Por CC** soma os CTs.
6. Decidido o número, cadastre na ferramenta: máquina → **Qtd** em Recursos;
   pessoa → **pessoas por turno** em Turnos do recurso, dividindo as unidades
   por dia entre os turnos como quiser. **Recalcular** e conferir no Painel da
   Ocupação.

## Como conferir que deu certo

- Sem mexer em nada, a coluna *Disponível (min)* da planilha é igual ao
  disponível do Painel da Capacidade para aquele CT e mês.
- *Unidades por dia* é a soma das quantidades por turno que você cadastrou
  (10 + 8 = 18).

## O que costuma dar errado

- **Baixou e veio tudo zerado / "sem capacidade calculada"** → cadastrou
  calendário, turno e OEE mas **não recalculou**. É a pegadinha número um.
- **"Min planejados por unidade por dia" parece ter OEE** (436 em vez de
  480) → é a média com os sábados de 240 min; o OEE está na coluna ao lado.
- **Alvo de 85% deu menos unidades que 100%** → não deveria: o alvo divide.
  Confira se a célula está em percentual (0,85) e não em 85.
- **Demanda zero** → o cenário não tem minutos naquele ano.
