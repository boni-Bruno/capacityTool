import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  conferirColunas, dataDeDias, montarCarga,
} from './demanda-formato.js';

// A fronteira entre o arquivo e o banco. Errar aqui não dá erro em lugar
// nenhum — dá número torto três telas adiante.

const base = (over = {}) => {
  const c = {
    cenario: ['Orçamento_2026_v3'],
    grupo_estoque: ['PRODUTOS ACABADOS'],
    nivel_estoque: ['PRODUTOS CONFECCIONADOS'],
    linha_produto_agrupada: ['BANHO'],
    familia_produto: ['TOALHA ROSTO FELPUDO'],
    familia_tecelagem: ['225'],
    tecido_base: ['N/E'],
    um: ['PC'],
    ct: ['455-001'],
    periodo: ['2026.03'],
    periodo_data: [20513],           // 2026-03-01
    producao_quantidade: [2640],
    producao_metros_kg: [462],
    duracao_minutos: [196.68],
    data_extracao: [1786787128000000],
    ...over,
  };
  return { colunas: c, nomes: Object.keys(c) };
};

// --- data ------------------------------------------------------------------

test('dia desde a época vira a data certa, sem fuso no meio', () => {
  assert.equal(dataDeDias(0), '1970-01-01');
  assert.equal(dataDeDias(20513), '2026-03-01');
  assert.equal(dataDeDias(20850), '2027-02-01');
});

// --- colunas ---------------------------------------------------------------

test('coluna essencial faltando é recusa, com o nome do que falta', () => {
  const { colunas } = base();
  delete colunas.duracao_minutos;
  const r = montarCarga({ colunas, nomes: Object.keys(colunas) });
  assert.equal(r.linhas.length, 0);
  assert.match(r.problemas[0], /duracao_minutos/);
});

test('coluna a mais é anotada, não recusada', () => {
  const b = base({ coluna_nova: ['x'] });
  const { inesperadas } = conferirColunas(b.nomes);
  assert.deepEqual(inesperadas, ['coluna_nova']);
  assert.equal(montarCarga(b).problemas.length, 0);
});

// --- período ---------------------------------------------------------------

test('período fora do formato é recusado, não adivinhado', () => {
  const r = montarCarga(base({ periodo: ['2026.1'] }));
  assert.match(r.problemas.join(' '), /AAAA\.MM/);
  assert.equal(r.linhas.length, 0);
});

test('texto e data que discordam param a carga', () => {
  // 2026.10 escrito, mas a data diz janeiro: é exatamente o estrago que o
  // "2026.1" faria se a origem deixasse de ser tipada.
  const r = montarCarga(base({ periodo: ['2026.10'], periodo_data: [20454] }));
  assert.match(r.problemas.join(' '), /não contam a mesma história/);
});

test('período e data coerentes passam', () => {
  const r = montarCarga(base({ periodo: ['2026.10'], periodo_data: [20727] }));
  assert.deepEqual(r.problemas, []);
  assert.equal(r.linhas[0].periodo_data, '2026-10-01');
});

// --- cenário ---------------------------------------------------------------

test('dois cenários no mesmo arquivo param a carga', () => {
  const b = base();
  for (const k of Object.keys(b.colunas)) b.colunas[k] = [b.colunas[k][0], b.colunas[k][0]];
  b.colunas.cenario = ['Orçamento_A', 'Orçamento_B'];
  assert.match(montarCarga(b).problemas.join(' '), /mistura 2 cenários/);
});

// --- vazios ----------------------------------------------------------------

test('nulo e traço viram o mesmo vazio', () => {
  const r = montarCarga(base({ ct: [null], familia_tecelagem: ['-'] }));
  assert.equal(r.linhas[0].ct, null);
  assert.equal(r.linhas[0].familia_tecelagem, null);
  assert.equal(r.resumo.semCt, 1);
});

test('linha sem CT não some — entra na carga e é contada', () => {
  const r = montarCarga(base({ ct: [null], duracao_minutos: [0] }));
  assert.equal(r.linhas.length, 1);
  assert.equal(r.resumo.semCt, 1);
});

test('linha zerada não some — é ela que diz que o período existe no plano', () => {
  const r = montarCarga(base({
    producao_quantidade: [0], producao_metros_kg: [0], duracao_minutos: [0],
  }));
  assert.equal(r.linhas.length, 1);
  assert.equal(r.resumo.zeradas, 1);
});

test('quantidade sem tempo é contada à parte', () => {
  const r = montarCarga(base({ duracao_minutos: [0] }));
  assert.equal(r.resumo.semTempoComQtd, 1);
  assert.equal(r.resumo.zeradas, 0);
});

// --- resumo ----------------------------------------------------------------

test('resumo acumula minutos por CT e por período', () => {
  const b = base();
  for (const k of Object.keys(b.colunas)) b.colunas[k] = [b.colunas[k][0], b.colunas[k][0]];
  b.colunas.ct = ['455-001', '460-001'];
  b.colunas.duracao_minutos = [100, 60];
  const r = montarCarga(b);
  assert.equal(r.resumo.minutos, 160);
  assert.equal(r.resumo.cts.get('455-001'), 100);
  assert.equal(r.resumo.cts.get('460-001'), 60);
  assert.equal(r.resumo.periodos.get('2026.03'), 160);
});

test('CT sem duração não entra na lista de CTs com demanda', () => {
  const r = montarCarga(base({ duracao_minutos: [0] }));
  assert.equal(r.resumo.cts.size, 0);
});

test('a linha traz os dois números da produção, separados', () => {
  const l = montarCarga(base()).linhas[0];
  assert.equal(l.qtd, 2640);            // peças, a UM do material
  assert.equal(l.qtd_metros_kg, 462);   // metros de tecelagem
  assert.equal(l.duracao_min, 196.68);
});
