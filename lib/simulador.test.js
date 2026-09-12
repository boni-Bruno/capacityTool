import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALVO_INICIAL, LINHA_CABECALHO, montarSimulador, resumoDoSimulador,
} from './simulador.js';
import { ESTILO, escreveXlsx, leXlsx } from './xlsx.js';

// O CT 465-002 de janeiro/2027, como a rodada gravou: 10 pessoas no 1º turno
// e 8 no 2º, 22 dias úteis, OEE 65%. Planejada 172.800 = 396 pessoas-dia ×
// 436,36 min; disponível 112.320.
function ctDeDezMaisOito(demandaMes = 100000) {
  return Array.from({ length: 12 }, (_, i) => ({
    planta: 'Matriz', area: 'Confecção Cama', cc: '465', ct: '465-002',
    recursos: 'CONFECCAO JOGOS CAMA TRUSSARDI', unidade: 'PESSOA', mes: i + 1,
    demanda: demandaMes, planejada: 172800, disponivel: 112320,
    dias_uteis: 22, unidade_dias: 396,
  }));
}

test('prévia: 10 + 8 pessoas são 18 unidades por dia, e os fatores reconstroem o disponível', () => {
  const [r] = resumoDoSimulador(ctDeDezMaisOito());
  assert.equal(r.ct, '465-002');
  assert.equal(r.unidades, 18);
  assert.equal(r.diasUteis, 22 * 12);
  assert.ok(Math.abs(r.minPorUnidadeDia - 172800 / 396) < 1e-9);
  assert.ok(Math.abs(r.oee - 0.65) < 1e-12);
  // Os minutos disponíveis por unidade já levam o OEE: 436,36 × 0,65.
  assert.ok(Math.abs(r.minDisponiveisPorUnidadeDia - r.minPorUnidadeDia * r.oee) < 1e-9);
  assert.equal(r.disponivel, 112320 * 12);
  // unidades × min disponíveis/dia × dias úteis = disponível, ao minuto.
  assert.ok(Math.abs(r.unidades * r.minDisponiveisPorUnidadeDia * r.diasUteis - r.disponivel) < 1e-6);
  assert.ok(Math.abs(r.ocupacao - (100000 * 12) / (112320 * 12)) < 1e-12);
  // Necessárias a 100%: demanda/dia ÷ min disponíveis por unidade — 18 pessoas
  // dão 89% de ocupação, então cabem com 16,03.
  assert.equal(ALVO_INICIAL, 1);
  assert.ok(Math.abs(r.necessarias - 18 * r.ocupacao) < 1e-9);
  assert.equal(r.aviso, null);
});

test('prévia: o ano é média ponderada pelos dias, não média das doze linhas', () => {
  const linhas = ctDeDezMaisOito();
  // De julho em diante a equipe vai a 22 (12 + 10): 22 × 22 dias = 484.
  for (let i = 6; i < 12; i += 1) {
    linhas[i].unidade_dias = 484;
    linhas[i].planejada = 172800 * (484 / 396);
    linhas[i].disponivel = 112320 * (484 / 396);
  }
  const [r] = resumoDoSimulador(linhas);
  assert.equal(r.unidades, 20);   // (6×396 + 6×484) ÷ (12×22)
  assert.ok(Math.abs(r.oee - 0.65) < 1e-12);
});

test('prévia: CT sem capacidade ou sem demanda avisa em vez de mostrar número', () => {
  const semCap = ctDeDezMaisOito().map((l) =>
    ({ ...l, planejada: 0, disponivel: 0, dias_uteis: 0, unidade_dias: 0 }));
  const [a] = resumoDoSimulador(semCap);
  assert.equal(a.unidades, null);
  assert.equal(a.oee, null);
  assert.equal(a.ocupacao, null);
  assert.equal(a.necessarias, null);
  assert.match(a.aviso, /sem capacidade/);

  const [b] = resumoDoSimulador(ctDeDezMaisOito(0));
  assert.equal(b.ocupacao, 0);
  assert.equal(b.necessarias, 0);
  assert.match(b.aviso, /sem demanda/);

  const parcial = ctDeDezMaisOito();
  parcial[2].disponivel = 0;
  parcial[2].planejada = 0;
  const [c] = resumoDoSimulador(parcial);
  assert.match(c.aviso, /mês com demanda e sem capacidade/);
});

test('prévia: mês que a consulta não trouxe vale zero, e o CT continua tendo doze meses', () => {
  const soJaneiro = [ctDeDezMaisOito()[0]];
  const [r] = resumoDoSimulador(soJaneiro);
  assert.equal(r.demanda, 100000);
  assert.equal(r.diasUteis, 22);
  assert.equal(r.unidades, 18);
  const { abas } = montarSimulador(soJaneiro);
  assert.equal(abas[0].linhas.length, 13);   // 12 meses + Ano
  assert.equal(abas[0].linhas[1][7].v, 0);   // fev sem demanda
  assert.equal(abas[0].linhas[1][12].v, 0);  // fev sem unidades
});

test('planilha Por CT: o OEE entra uma vez, o alvo divide, e as auxiliares alimentam a linha do ano', () => {
  const linhas = [...ctDeDezMaisOito(), ...ctDeDezMaisOito().map((l) =>
    ({ ...l, ct: '465-003', unidade: 'MAQUINA' }))];
  const { abas, inicioDe } = montarSimulador(linhas);
  const ct = abas[0];
  assert.equal(ct.nome, 'Por CT');
  assert.equal(LINHA_CABECALHO, 1);
  assert.equal(ct.colunas.length, 19);
  assert.equal(ct.linhas.length, 26);

  // O primeiro CT começa na linha 2 e o segundo na 15 (2 + 13).
  assert.equal([...inicioDe.values()][0], 2);
  assert.equal([...inicioDe.values()][1], 15);

  const jan = ct.linhas[0];
  assert.equal(jan.length, 19);
  assert.equal(jan[6], 1);
  assert.equal(jan[8].v, 22);
  assert.ok(Math.abs(jan[9].v - 172800 / 396) < 1e-9);     // J planejados, sem OEE
  assert.ok(Math.abs(jan[10].v - 0.65) < 1e-12);          // K OEE
  assert.equal(jan[10].estilo, ESTILO.ENTRADA_PCT);
  assert.equal(jan[11].f, 'J2*K2');                       // L disponíveis = J × OEE
  assert.equal(jan[12].v, 18);                            // M unidades
  assert.equal(jan[12].estilo, ESTILO.ENTRADA);
  assert.equal(jan[13].f, 'M2*L2*I2');                    // N sem OEE de novo
  assert.equal(jan[14].f, 'IF(N2=0,"",H2/N2)');           // O calculada
  assert.equal(jan[15].v, 1);                             // P alvo
  assert.equal(jan[15].estilo, ESTILO.ENTRADA_PCT);
  assert.equal(jan[16].f, 'IF(OR(I2=0,L2=0,P2=0),"",(H2/I2)/L2/P2)');   // Q necessárias
  assert.equal(jan[17].f, 'J2*M2*I2');                    // R planejado
  assert.equal(jan[18].f, 'M2*I2');                       // S unidades × dias

  const ano = ct.linhas[12];
  assert.equal(ano[6].v, 'Ano');
  assert.equal(ano[7].f, 'SUM(H2:H13)');
  assert.equal(ano[8].f, 'SUM(I2:I13)');
  assert.equal(ano[9].f, 'IF(S14=0,"",R14/S14)');
  assert.equal(ano[10].f, 'IF(R14=0,"",N14/R14)');
  assert.equal(ano[11].f, 'IF(S14=0,"",N14/S14)');
  assert.equal(ano[12].f, 'IF(I14=0,"",S14/I14)');
  assert.equal(ano[13].f, 'SUM(N2:N13)');
  assert.equal(ano[14].f, 'IF(N14=0,"",H14/N14)');
  assert.equal(ano[15].v, 1);
  assert.equal(ano[16].f, 'IF(OR(I14=0,L14=0,P14=0),"",(H14/I14)/L14/P14)');
  assert.equal(ano[17].f, 'SUM(R2:R13)');
  assert.equal(ano[18].f, 'SUM(S2:S13)');

  // O segundo CT: as faixas andam junto com a linha.
  const ano2 = ct.linhas[25];
  assert.equal(ano2[3], '465-003');
  assert.equal(ano2[5], 'MAQUINA');
  assert.equal(ano2[7].f, 'SUM(H15:H26)');
  assert.equal(ano2[13].f, 'SUM(N15:N26)');
});

test('planilha Por CC: soma os CTs por referência direta, com as mesmas colunas', () => {
  const linhas = [...ctDeDezMaisOito(), ...ctDeDezMaisOito().map((l) =>
    ({ ...l, ct: '465-003' }))];
  const { abas } = montarSimulador(linhas);
  const cc = abas[1];
  assert.equal(cc.nome, 'Por CC');
  assert.equal(cc.colunas.length, 17);
  assert.equal(cc.linhas.length, 13);
  const jan = cc.linhas[0];
  assert.equal(jan.length, 17);
  assert.equal(jan[3], 2);                                  // dois CTs no CC
  assert.equal(jan[4], 1);
  // Janeiro dos dois CTs: linhas 2 e 15 da Por CT. Nada de SUMIFS.
  assert.equal(jan[5].f, "'Por CT'!H2+'Por CT'!H15");
  assert.equal(jan[6].f, "MAX('Por CT'!I2,'Por CT'!I15)");
  assert.equal(jan[7].f, 'IF(Q2=0,"",P2/Q2)');
  assert.equal(jan[8].f, 'IF(P2=0,"",L2/P2)');
  assert.equal(jan[9].f, 'IF(Q2=0,"",L2/Q2)');
  assert.equal(jan[10].f, "'Por CT'!M2+'Por CT'!M15");
  assert.equal(jan[11].f, "'Por CT'!N2+'Por CT'!N15");
  assert.equal(jan[12].f, 'IF(L2=0,"",F2/L2)');
  assert.equal(jan[13].v, 1);
  assert.equal(jan[13].estilo, ESTILO.ENTRADA_PCT);
  assert.equal(jan[14].f, 'IF(OR(G2=0,J2=0,N2=0),"",(F2/G2)/J2/N2)');
  assert.equal(jan[15].f, "'Por CT'!R2+'Por CT'!R15");
  assert.equal(jan[16].f, "'Por CT'!S2+'Por CT'!S15");

  // Fevereiro anda uma linha em cada CT; o Ano aponta para as linhas de ano.
  assert.equal(cc.linhas[1][5].f, "'Por CT'!H3+'Por CT'!H16");
  const ano = cc.linhas[12];
  assert.equal(ano[4].v, 'Ano');
  assert.equal(ano[5].f, "'Por CT'!H14+'Por CT'!H27");
  assert.equal(ano[11].f, "'Por CT'!N14+'Por CT'!N27");

  // CC de um CT só: referência única, sem "+".
  const um = montarSimulador(ctDeDezMaisOito()).abas[1];
  assert.equal(um.linhas[0][5].f, "'Por CT'!H2");
  assert.equal(um.linhas[0][6].f, "MAX('Por CT'!I2)");
});

test('planilha: o .xlsx sai com as duas abas e a primeira lê de volta com os valores', async () => {
  const { abas } = montarSimulador(ctDeDezMaisOito());
  const bytes = await escreveXlsx({ abas });
  const { linhas } = await leXlsx(bytes);
  assert.equal(linhas[0][3], 'CT');
  assert.equal(linhas[0][12], 'Unidades por dia');
  assert.equal(linhas[0][15], 'Ocupação alvo');
  assert.equal(linhas[1][3], '465-002');
  assert.equal(linhas[1][7], 100000);
  assert.equal(linhas[1][12], 18);
  assert.equal(linhas[1][15], 1);
  // Fórmula não tem valor gravado: a célula lê como nula até o Excel calcular.
  assert.equal(linhas[1][11], null);
  assert.equal(linhas[1][13], null);
  assert.equal(linhas[1][16], null);
});
