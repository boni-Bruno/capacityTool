import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINHA_CABECALHO, montarSimulador, resumoDoSimulador } from './simulador.js';
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
  assert.equal(r.disponivel, 112320 * 12);
  // unidades × min/dia × dias úteis × OEE = disponível, ao minuto.
  assert.ok(Math.abs(r.unidades * r.minPorUnidadeDia * r.diasUteis * r.oee - r.disponivel) < 1e-6);
  assert.ok(Math.abs(r.ocupacao - (100000 * 12) / (112320 * 12)) < 1e-12);
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
  assert.match(a.aviso, /sem capacidade/);

  const [b] = resumoDoSimulador(ctDeDezMaisOito(0));
  assert.equal(b.ocupacao, 0);
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
  assert.equal(abas[0].linhas[1][10].v, 0);  // fev sem unidades
});

test('planilha: cabeçalho na linha 1, doze linhas + Ano por CT, entradas destacadas e fórmulas na linha certa', () => {
  const linhas = [...ctDeDezMaisOito(), ...ctDeDezMaisOito().map((l) =>
    ({ ...l, ct: '465-003', unidade: 'MAQUINA' }))];
  const { abas, inicioDe } = montarSimulador(linhas);
  const ct = abas[0];
  assert.equal(ct.nome, 'Por CT');
  assert.equal(LINHA_CABECALHO, 1);
  assert.equal(ct.antes, undefined);
  assert.equal(ct.linhas.length, 26);

  // O primeiro CT começa na linha 2 e o segundo na 15 (2 + 13).
  assert.equal([...inicioDe.values()][0], 2);
  assert.equal([...inicioDe.values()][1], 15);

  const jan = ct.linhas[0];
  assert.equal(jan[6], 1);
  assert.equal(jan[8].v, 22);
  assert.ok(Math.abs(jan[9].v - 172800 / 396) < 1e-9);
  assert.equal(jan[10].v, 18);
  assert.equal(jan[10].estilo, ESTILO.ENTRADA);
  assert.ok(Math.abs(jan[11].v - 0.65) < 1e-12);
  assert.equal(jan[11].estilo, ESTILO.ENTRADA_PCT);
  assert.equal(jan[12].f, 'K2*J2*I2*L2');
  assert.equal(jan[13].f, 'IF(M2=0,"",H2/M2)');

  const ano = ct.linhas[12];
  assert.equal(ano[6].v, 'Ano');
  assert.equal(ano[7].f, 'SUM(H2:H13)');
  assert.equal(ano[8].f, 'SUM(I2:I13)');
  assert.equal(ano[9].f,
    'IF(SUMPRODUCT(K2:K13,I2:I13)=0,"",SUMPRODUCT(J2:J13,K2:K13,I2:I13)/SUMPRODUCT(K2:K13,I2:I13))');
  assert.equal(ano[10].f, 'IF(I14=0,"",SUMPRODUCT(K2:K13,I2:I13)/I14)');
  assert.equal(ano[11].f,
    'IF(SUMPRODUCT(J2:J13,K2:K13,I2:I13)=0,"",M14/SUMPRODUCT(J2:J13,K2:K13,I2:I13))');
  assert.equal(ano[12].f, 'SUM(M2:M13)');
  assert.equal(ano[13].f, 'IF(M14=0,"",H14/M14)');

  // O segundo CT: as faixas andam junto com a linha.
  const ano2 = ct.linhas[25];
  assert.equal(ano2[3], '465-003');
  assert.equal(ano2[5], 'MAQUINA');
  assert.equal(ano2[7].f, 'SUM(H15:H26)');
  assert.equal(ano2[12].f, 'SUM(M15:M26)');
});

test('planilha: a aba Por CC soma a Por CT com SUMIFS por planta, área, CC e mês', () => {
  const linhas = [...ctDeDezMaisOito(), ...ctDeDezMaisOito().map((l) =>
    ({ ...l, ct: '465-003' }))];
  const { abas } = montarSimulador(linhas);
  const cc = abas[1];
  assert.equal(cc.nome, 'Por CC');
  assert.equal(cc.linhas.length, 13);
  assert.equal(cc.linhas[0][3], 2);     // dois CTs no CC
  // A faixa vai da linha 2 até a última linha da Por CT (26 linhas: 2..27).
  assert.equal(cc.linhas[0][5].f,
    "SUMIFS('Por CT'!$H$2:$H$27,'Por CT'!$A$2:$A$27,A2,'Por CT'!$B$2:$B$27,B2,"
    + "'Por CT'!$C$2:$C$27,C2,'Por CT'!$G$2:$G$27,E2)");
  assert.match(cc.linhas[0][6].f, /^SUMIFS\('Por CT'!\$K\$2:\$K\$27,/);
  assert.match(cc.linhas[0][7].f, /^SUMIFS\('Por CT'!\$M\$2:\$M\$27,/);
  assert.equal(cc.linhas[0][8].f, 'IF(H2=0,"",F2/H2)');
  const ano = cc.linhas[12];
  assert.equal(ano[4].v, 'Ano');
  assert.match(ano[7].f, /\$M\$2:\$M\$27.*"Ano"\)$/);
});

test('planilha: o .xlsx sai com as duas abas e a primeira lê de volta com os valores', async () => {
  const { abas } = montarSimulador(ctDeDezMaisOito());
  const bytes = await escreveXlsx({ abas });
  const { linhas } = await leXlsx(bytes);
  assert.equal(linhas[0][3], 'CT');
  assert.equal(linhas[0][10], 'Unidades por dia');
  assert.equal(linhas[1][3], '465-002');
  assert.equal(linhas[1][7], 100000);
  assert.equal(linhas[1][10], 18);
  // Fórmula não tem valor gravado: a célula lê como nula até o Excel calcular.
  assert.equal(linhas[1][12], null);
});
