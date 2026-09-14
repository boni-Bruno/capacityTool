# POP-07 — Máquina que chega, sai, ou muda de quantidade no meio do ano

## Quando usar

Compra, venda, transferência, ou a Qtd de máquinas iguais mudou.

## Passos

- **Chega em julho**: cadastre já, com *Em operação de* = `01/07`. Configure
  turnos e OEE normalmente. Ela some dos seis primeiros meses — nem instalada
  — e entra inteira em julho. Recalcular.
- **Sai em setembro**: *até* = último dia de operação. Recalcular. O recurso
  continua na tabela e na história.
- **Qtd muda** (de 3 para 4 máquinas): edite a Qtd em Recursos. Nos turnos em
  que estava "todas" (número igual à Qtd antiga), a quarta acompanha sozinha;
  onde havia um número menor, ele fica. Confira em Turnos do recurso.
  Recalcular.
- **Trocou de área**: a área não muda; crie o recurso na área nova com a janela
  a partir da transferência e feche a janela do antigo.

## Como conferir que deu certo

- Painel da Capacidade: a instalada do recurso muda exatamente no mês da
  janela.

## O que costuma dar errado

- Fechar a janela e esquecer de recalcular → a máquina vendida continua
  produzindo no painel.
- Máquina que chega sem turno → instalada aparece, planejada zero. Falta
  Turnos do recurso.
