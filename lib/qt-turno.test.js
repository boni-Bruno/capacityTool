import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faixasIguaisComValor, recomporFaixasComValor } from './faixas.js';

// A matriz de turnos passou a guardar QUANTAS máquinas rodam em cada mês, e
// não só se rodam. O valor 'todas' é o que vira null no banco: ele precisa
// atravessar a recomposição sem virar número, senão editar 2027 congelaria o
// "todas" de 2026 na quantidade de hoje.

const TODAS = 'todas';
const f = (inicio, fim, valor) => ({ inicio, fim, valor });

test('meses vizinhos com a mesma quantidade viram uma faixa', () => {
  const r = recomporFaixasComValor([], 2026, { 1: 4, 2: 4, 3: 4 });
  assert.deepEqual(r, [f('2026-01-01', '2026-04-01', 4)]);
});

test('quantidades diferentes não colam', () => {
  const r = recomporFaixasComValor([], 2026, { 1: 5, 2: 4 });
  assert.deepEqual(r, [
    f('2026-01-01', '2026-02-01', 5),
    f('2026-02-01', '2026-03-01', 4),
  ]);
});

test('"todas" e um número igual à quantidade não são a mesma faixa', () => {
  // Não colam porque significam coisas diferentes no banco: null acompanha o
  // recurso, 5 é um recorte explícito.
  const r = recomporFaixasComValor([], 2026, { 1: TODAS, 2: 5 });
  assert.equal(r.length, 2);
  assert.equal(r[0].valor, TODAS);
  assert.equal(r[1].valor, 5);
});

test('"todas" atravessa a edição de outro ano sem virar número', () => {
  const r = recomporFaixasComValor(
    [f('2026-01-01', '2027-01-01', TODAS)], 2027, { 1: 4 });
  assert.deepEqual(r, [
    f('2026-01-01', '2027-01-01', TODAS),
    f('2027-01-01', '2027-02-01', 4),
  ]);
});

test('editar 2026 não mexe na quantidade cadastrada em 2025', () => {
  const r = recomporFaixasComValor(
    [f('2025-01-01', '2025-07-01', 3)], 2026, { 5: 4 });
  assert.deepEqual(r, [
    f('2025-01-01', '2025-07-01', 3),
    f('2026-05-01', '2026-06-01', 4),
  ]);
});

test('mês sem valor é mês que não trabalha', () => {
  const r = recomporFaixasComValor(
    [f('2026-03-01', '2026-06-01', 4)], 2026, {});
  assert.deepEqual(r, []);
});

// --- faixasIguaisComValor -------------------------------------------------

test('mesmas datas com quantidade diferente NÃO são iguais', () => {
  // Era o que faltava: sem olhar o valor, trocar 5 por 4 passava por
  // "nada mudou" e o Salvar não gravava.
  const a = [f('2026-01-01', '2027-01-01', 5)];
  const b = [f('2026-01-01', '2027-01-01', 4)];
  assert.equal(faixasIguaisComValor(a, b), false);
});

test('"todas" difere do número correspondente', () => {
  const a = [f('2026-01-01', '2027-01-01', TODAS)];
  const b = [f('2026-01-01', '2027-01-01', 5)];
  assert.equal(faixasIguaisComValor(a, b), false);
});

test('idênticas são iguais, inclusive com fim aberto', () => {
  const a = [f('2026-01-01', null, TODAS)];
  const b = [f('2026-01-01', null, TODAS)];
  assert.equal(faixasIguaisComValor(a, b), true);
});

test('quantidade de faixas diferente basta para diferir', () => {
  assert.equal(
    faixasIguaisComValor([f('2026-01-01', '2027-01-01', 4)], []), false);
});
