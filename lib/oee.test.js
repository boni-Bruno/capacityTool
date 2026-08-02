import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recomporFaixasComValor, juntarFaixasComValor } from './faixas.js';

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
