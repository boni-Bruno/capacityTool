import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diasNoIntervalo, mesesNoIntervalo, resolvePeriodo, rotuloPeriodo,
} from './periodo.js';

// O nível de detalhe sai do tamanho do intervalo, não de um parâmetro à parte.
// É o que permite filtrar março a junho sem passar pelo drill-down.

test('sem recorte, é o ano inteiro mês a mês', () => {
  const p = resolvePeriodo({}, 2026);
  assert.deepEqual(p, {
    de: '2026-01-01', ate: '2026-12-31', nivel: 'MES', anoInteiro: true,
  });
});

test('intervalo de vários meses fica no nível de mês', () => {
  const p = resolvePeriodo({ de: '2026-03-01', ate: '2026-06-30' }, 2026);
  assert.equal(p.nivel, 'MES');
  assert.equal(p.anoInteiro, false);
});

test('intervalo dentro de um mês cai no nível de dia', () => {
  const p = resolvePeriodo({ de: '2026-03-05', ate: '2026-03-20' }, 2026);
  assert.equal(p.nivel, 'DIA');
});

test('mês inteiro também é nível de dia — é o degrau do drill-down', () => {
  const p = resolvePeriodo({ de: '2026-03-01', ate: '2026-03-31' }, 2026);
  assert.equal(p.nivel, 'DIA');
});

test('um dia só vai para turno a turno', () => {
  const p = resolvePeriodo({ de: '2026-03-05', ate: '2026-03-05' }, 2026);
  assert.equal(p.nivel, 'TURNO');
});

test('datas invertidas são endireitadas', () => {
  const p = resolvePeriodo({ de: '2026-06-30', ate: '2026-03-01' }, 2026);
  assert.equal(p.de, '2026-03-01');
  assert.equal(p.ate, '2026-06-30');
});

test('um lado só vale como "daqui em diante" e "até aqui"', () => {
  assert.deepEqual(
    [resolvePeriodo({ de: '2026-07-01' }, 2026).de,
     resolvePeriodo({ de: '2026-07-01' }, 2026).ate],
    ['2026-07-01', '2026-12-31']);
  assert.deepEqual(
    [resolvePeriodo({ ate: '2026-07-01' }, 2026).de,
     resolvePeriodo({ ate: '2026-07-01' }, 2026).ate],
    ['2026-01-01', '2026-07-01']);
});

test('intervalo fora do ano é fechado dentro dele', () => {
  // O seletor de ano é quem manda: soma atravessando a virada discordaria do
  // ano mostrado logo ao lado.
  const p = resolvePeriodo({ de: '2025-11-01', ate: '2027-02-01' }, 2026);
  assert.equal(p.de, '2026-01-01');
  assert.equal(p.ate, '2026-12-31');
});

test('lixo na URL é ignorado e volta ao ano inteiro', () => {
  const p = resolvePeriodo({ de: 'ontem', ate: '31/12/2026' }, 2026);
  assert.equal(p.anoInteiro, true);
});

// --- compatibilidade com os links antigos ---------------------------------

test('mes antigo vira o intervalo daquele mês', () => {
  const p = resolvePeriodo({ mes: '3' }, 2026);
  assert.deepEqual([p.de, p.ate, p.nivel], ['2026-03-01', '2026-03-31', 'DIA']);
});

test('mes e dia antigos viram um dia só', () => {
  const p = resolvePeriodo({ mes: '3', dia: '5' }, 2026);
  assert.deepEqual([p.de, p.ate, p.nivel], ['2026-03-05', '2026-03-05', 'TURNO']);
});

test('fevereiro de ano bissexto fecha no dia 29', () => {
  const p = resolvePeriodo({ mes: '2' }, 2028);
  assert.equal(p.ate, '2028-02-29');
});

test('dia impossível para o mês cai no mês inteiro', () => {
  const p = resolvePeriodo({ mes: '2', dia: '30' }, 2026);
  assert.deepEqual([p.de, p.ate], ['2026-02-01', '2026-02-28']);
});

// --- fatiamento -----------------------------------------------------------

test('mesesNoIntervalo marca as pontas cortadas', () => {
  const m = mesesNoIntervalo('2026-03-15', '2026-05-10');
  assert.deepEqual(m.map((x) => x.mes), [3, 4, 5]);
  assert.deepEqual(m.map((x) => x.parcial), [true, false, true]);
  assert.deepEqual([m[0].de, m[0].ate], ['2026-03-15', '2026-03-31']);
  assert.deepEqual([m[2].de, m[2].ate], ['2026-05-01', '2026-05-10']);
});

test('ano inteiro dá doze meses, nenhum cortado', () => {
  const m = mesesNoIntervalo('2026-01-01', '2026-12-31');
  assert.equal(m.length, 12);
  assert.equal(m.some((x) => x.parcial), false);
});

test('diasNoIntervalo lista os dias na ordem', () => {
  assert.deepEqual(diasNoIntervalo('2026-03-05', '2026-03-08'),
    ['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08']);
});

test('rotuloPeriodo encurta quando é um dia só', () => {
  assert.equal(rotuloPeriodo('2026-03-05', '2026-03-05'), '05/03');
  assert.equal(rotuloPeriodo('2026-03-05', '2026-04-10'), '05/03 a 10/04');
});
