import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  juntarFaixasComValor, mesesDoAno, recomporFaixasComValor,
} from './faixas.js';

// O OEE guarda um valor por mês em daterange. Colar faixa vizinha só vale se o
// valor for igual — errar aqui espalharia o OEE de um mês pelos vizinhos sem
// ninguém perceber.

const f = (inicio, fim, valor) => ({ inicio, fim, valor });

test('meses vizinhos com o mesmo valor viram uma faixa', () => {
  assert.deepEqual(
    recomporFaixasComValor([], 2026, { 1: '0.85', 2: '0.85', 3: '0.85' }),
    [f('2026-01-01', '2026-04-01', '0.85')]);
});

test('meses vizinhos com valores diferentes ficam separados', () => {
  const r = recomporFaixasComValor([], 2026, { 1: '0.85', 2: '0.90' });
  assert.deepEqual(r, [
    f('2026-01-01', '2026-02-01', '0.85'),
    f('2026-02-01', '2026-03-01', '0.90'),
  ]);
});

test('mês sem valor fica descoberto e separa as faixas', () => {
  const r = recomporFaixasComValor([], 2026, { 1: '0.85', 3: '0.85' });
  assert.deepEqual(r, [
    f('2026-01-01', '2026-02-01', '0.85'),
    f('2026-03-01', '2026-04-01', '0.85'),
  ]);
});

test('dezembro fecha no ano seguinte', () => {
  assert.deepEqual(
    recomporFaixasComValor([], 2026, { 12: '0.7' }),
    [f('2026-12-01', '2027-01-01', '0.7')]);
});

test('ano inteiro com o mesmo valor é uma faixa só', () => {
  const porMes = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [i + 1, '0.8']));
  assert.deepEqual(recomporFaixasComValor([], 2026, porMes),
    [f('2026-01-01', '2027-01-01', '0.8')]);
});

test('limpar o ano remove só o ano', () => {
  assert.deepEqual(
    recomporFaixasComValor([f('2026-03-01', '2026-06-01', '0.8')], 2026, {}),
    []);
});

test('faixa de outro ano é preservada com o valor dela', () => {
  const r = recomporFaixasComValor(
    [f('2025-01-01', '2025-07-01', '0.7')], 2026, { 5: '0.9' });
  assert.deepEqual(r, [
    f('2025-01-01', '2025-07-01', '0.7'),
    f('2026-05-01', '2026-06-01', '0.9'),
  ]);
});

test('faixa aberta atravessando o ano é cortada e mantém o valor dos dois lados', () => {
  const r = recomporFaixasComValor([f('2025-06-01', null, '0.7')], 2026, {});
  assert.deepEqual(r, [
    f('2025-06-01', '2026-01-01', '0.7'),
    f('2027-01-01', null, '0.7'),
  ]);
});

test('faixa aberta com o mesmo valor do ano editado volta a ser contínua', () => {
  const porMes = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [i + 1, '0.7']));
  const r = recomporFaixasComValor([f('2025-06-01', null, '0.7')], 2026, porMes);
  assert.deepEqual(r, [f('2025-06-01', null, '0.7')]);
});

test('faixa aberta com valor diferente do ano editado NÃO cola', () => {
  // Este é o caso que o juntarFaixas sem valor erraria: as datas se encostam,
  // mas o OEE mudou, então são registros distintos.
  const porMes = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [i + 1, '0.9']));
  const r = recomporFaixasComValor([f('2025-06-01', null, '0.7')], 2026, porMes);
  assert.deepEqual(r, [
    f('2025-06-01', '2026-01-01', '0.7'),
    f('2026-01-01', '2027-01-01', '0.9'),
    f('2027-01-01', null, '0.7'),
  ]);
});

test('juntarFaixasComValor não cola quando há buraco', () => {
  const r = juntarFaixasComValor([
    f('2026-01-01', '2026-02-01', '0.8'),
    f('2026-03-01', '2026-04-01', '0.8'),
  ]);
  assert.equal(r.length, 2);
});

// --- os meses de um ano, lidos das faixas ---------------------------------
//
// A tela de um recurso precisa desta leitura para mostrar o ano preenchido. O
// LOTE não usa mais: ele reescreve o ano, como o editor de um recurso e como o
// lote de Turnos — três telas com duas leituras do mesmo campo em branco era
// uma a mais do que dá para lembrar na hora de clicar.

test('mesesDoAno lê o valor que cobre o primeiro dia de cada mês', () => {
  const faixas = [
    { inicio: '2026-01-01', fim: '2026-04-01', valor: '0.85000' },
    { inicio: '2026-07-01', fim: null, valor: '0.90000' },
  ];
  const m = mesesDoAno(faixas, 2026);
  assert.equal(m[1], '0.85000');
  assert.equal(m[3], '0.85000');
  assert.equal(m[7], '0.90000');
  assert.equal(m[12], '0.90000');
});

test('mês sem faixa fica de fora — ausência não é zero', () => {
  const m = mesesDoAno(
    [{ inicio: '2026-01-01', fim: '2026-03-01', valor: '0.8' }], 2026);
  assert.equal(Object.hasOwn(m, 2), true);
  assert.equal(Object.hasOwn(m, 3), false);
  assert.equal(Object.keys(m).length, 2);
});

test('faixa que termina antes do ano não vaza para ele', () => {
  const m = mesesDoAno(
    [{ inicio: '2025-01-01', fim: '2026-01-01', valor: '0.7' }], 2026);
  assert.deepEqual(m, {});
});

test('o lote reescreve o ano: mês em branco fica SEM oee', () => {
  // A regra nova, e a que a tela avisa antes de abrir. Aplicar 78% só em
  // janeiro deixa fevereiro a dezembro sem cadastro — e sem cadastro o motor
  // usa 100%, que é diferente de "ficou como estava".
  const novas = recomporFaixasComValor(
    [{ inicio: '2026-01-01', fim: null, valor: '0.85000' }],
    2026,
    { 1: '0.78000' },
  );

  const noAno = novas.filter(
    (f) => f.inicio < '2027-01-01' && (f.fim === null || f.fim > '2026-01-01'));
  assert.equal(noAno.length, 1);
  assert.equal(noAno[0].valor, '0.78000');
  assert.equal(noAno[0].inicio, '2026-01-01');
  assert.equal(noAno[0].fim, '2026-02-01');
});
