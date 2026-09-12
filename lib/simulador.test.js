import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FATOR, LINHA_CABECALHO, montarSimulador, resumoDoSimulador,
} from './simulador.js';
import { ESTILO, escreveXlsx, leXlsx } from './xlsx.js';

// Um CT de 12 máquinas a 80% de OEE, 20 dias de 480 min por mês: cada máquina
// entrega 20 × 480 × 0,8 = 7.680 min/mês; as doze, 92.160. Demanda de 100.000
// pede 14 máquinas (100.000 ÷ 7.680 = 13,02 → 14).
function ctDeDozeMaquinas(demandaMes = 100000) {
  return Array.from({ length: 12 }, (_, i) => ({
    planta: 'Matriz', area: 'Tecelagem', cc: '104', ct: '104-01',
    recursos: 'Tear 1, Tear 2', unidade: 'MAQUINA', mes: i + 1,
    demanda: demandaMes, disponivel: 92160, por_unidade: 7680,
  }));
}

test('prévia: 12 máquinas, demanda acima da capacidade, precisa de 14', () => {
  const [r] = resumoDoSimulador(ctDeDozeMaquinas());
  assert.equal(r.ct, '104-01');
  assert.equal(r.demanda, 1200000);
  assert.equal(r.disponivel, 92160 * 12);
  assert.equal(r.porUnidade, 7680 * 12);
  assert.equal(r.atuais, 12);
  assert.equal(r.necessarias, 14);
  assert.equal(r.pico, 14);
  assert.ok(Math.abs(r.ocupacao - 1200000 / (92160 * 12)) < 1e-12);
  assert.equal(r.aviso, null);
});

test('prévia: o pico é o mês que mais pede, e o ano é divisão de somas', () => {
  const linhas = ctDeDozeMaquinas(50000);
  linhas[5].demanda = 200000;   // junho pede 27 máquinas
  const [r] = resumoDoSimulador(linhas);
  // Σdemanda = 11 × 50.000 + 200.000 = 750.000; ÷ (12 × 7.680) = 8,14 → 9
  assert.equal(r.necessarias, 9);
  assert.equal(r.pico, 27);
});

test('prévia: CT sem capacidade não divide por zero e avisa; sem demanda também avisa', () => {
  const semCap = ctDeDozeMaquinas().map((l) => ({ ...l, disponivel: 0, por_unidade: 0 }));
  const [a] = resumoDoSimulador(semCap);
  assert.equal(a.necessarias, null);
  assert.equal(a.atuais, null);
  assert.equal(a.ocupacao, null);
  assert.match(a.aviso, /sem capacidade/);

  const [b] = resumoDoSimulador(ctDeDozeMaquinas(0));
  assert.equal(b.necessarias, 0);
  assert.match(b.aviso, /sem demanda/);

  const parcial = ctDeDozeMaquinas();
  parcial[2].disponivel = 0;
  parcial[2].por_unidade = 0;
  const [c] = resumoDoSimulador(parcial);
  assert.match(c.aviso, /mês com demanda e sem capacidade/);
});

test('prévia: mês que a consulta não trouxe vale zero, e o CT continua tendo doze meses', () => {
  const soJaneiro = [ctDeDozeMaquinas()[0]];
  const [r] = resumoDoSimulador(soJaneiro);
  assert.equal(r.demanda, 100000);
  assert.equal(r.necessarias, 14);
  const { abas } = montarSimulador(soJaneiro);
  assert.equal(abas[0].linhas.length, 13);   // 12 meses + Ano
  assert.equal(abas[0].linhas[1][7].v, 0);   // fev sem demanda
});

test('planilha: fator em B1, cabeçalho na linha 3, doze linhas + Ano por CT, fórmulas na linha certa', () => {
  const linhas = [...ctDeDozeMaquinas(), ...ctDeDozeMaquinas().map((l) =>
    ({ ...l, ct: '104-02', unidade: 'PESSOA' }))];
  const { abas, inicioDe } = montarSimulador(linhas, { fator: 1 });
  const ct = abas[0];
  assert.equal(ct.nome, 'Por CT');
  assert.equal(FATOR, '$B$1');
  assert.equal(ct.antes[0][1].estilo, ESTILO.ENTRADA);
  assert.equal(ct.antes[0][1].v, 1);
  assert.equal(ct.antes.length, LINHA_CABECALHO - 1);
  assert.equal(ct.linhas.length, 26);

  // O primeiro CT começa na linha 4 e o segundo na 17 (4 + 13).
  assert.equal([...inicioDe.values()][0], 4);
  assert.equal([...inicioDe.values()][1], 17);

  const jan = ct.linhas[0];
  assert.equal(jan[6], 1);
  assert.equal(jan[10].f, 'IF(J4=0,"",I4/J4)');
  assert.equal(jan[11].f, 'IF(I4=0,"",H4/(I4*$B$1))');
  assert.equal(jan[12].f, 'IF(J4=0,"",ROUNDUP(H4/(J4*$B$1),0))');
  assert.equal(jan[13].f, 'IF(M4="","",M4-K4)');
  assert.equal(jan[14], null);

  const ano = ct.linhas[12];
  assert.equal(ano[6].v, 'Ano');
  assert.equal(ano[7].f, 'SUM(H4:H15)');
  assert.equal(ano[9].f, 'SUM(J4:J15)');
  assert.equal(ano[12].f, 'IF(J16=0,"",ROUNDUP(H16/(J16*$B$1),0))');
  assert.equal(ano[14].f, 'MAX(M4:M15)');

  // O segundo CT: as faixas andam junto com a linha.
  const ano2 = ct.linhas[25];
  assert.equal(ano2[3], '104-02');
  assert.equal(ano2[5], 'PESSOA');
  assert.equal(ano2[7].f, 'SUM(H17:H28)');
  assert.equal(ano2[14].f, 'MAX(M17:M28)');
});

test('planilha: a aba Por CC soma a Por CT com SUMIFS por planta, área, CC e mês', () => {
  const linhas = [...ctDeDozeMaquinas(), ...ctDeDozeMaquinas().map((l) =>
    ({ ...l, ct: '104-02' }))];
  const { abas } = montarSimulador(linhas);
  const cc = abas[1];
  assert.equal(cc.nome, 'Por CC');
  assert.equal(cc.linhas.length, 13);
  assert.equal(cc.linhas[0][3], 2);     // dois CTs no CC
  // A faixa vai da linha 4 até a última linha da Por CT (26 linhas: 4..29).
  assert.equal(cc.linhas[0][5].f,
    "SUMIFS('Por CT'!$H$4:$H$29,'Por CT'!$A$4:$A$29,A4,'Por CT'!$B$4:$B$29,B4,"
    + "'Por CT'!$C$4:$C$29,C4,'Por CT'!$G$4:$G$29,E4)");
  assert.equal(cc.linhas[0][8].f, 'IF(G4=0,"",F4/(G4*$B$1))');
  assert.equal(cc.linhas[0][10].f, 'J4-H4');
  const ano = cc.linhas[12];
  assert.equal(ano[4].v, 'Ano');
  assert.match(ano[9].f, /\$M\$4:\$M\$29.*"Ano"\)$/);
  assert.equal(ano[11].f, 'MAX(J4:J15)');
  // O fator da Por CC aponta para o da Por CT: uma célula de entrada só.
  assert.equal(cc.antes[0][1].f, "'Por CT'!B1");
});

test('planilha: o .xlsx sai com as duas abas e a primeira lê de volta com o fator e os valores', async () => {
  const { abas } = montarSimulador(ctDeDozeMaquinas(), { fator: 1.1 });
  const bytes = await escreveXlsx({ abas });
  const { linhas } = await leXlsx(bytes);
  assert.equal(linhas[0][0], 'Fator de OEE');
  assert.equal(linhas[0][1], 1.1);
  assert.equal(linhas[2][3], 'CT');
  assert.equal(linhas[3][3], '104-01');
  assert.equal(linhas[3][7], 100000);
  // Fórmula não tem valor gravado: a célula lê como nula até o Excel calcular.
  assert.equal(linhas[3][12], null);
});
