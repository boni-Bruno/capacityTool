import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inicioDoMes, mesesParaFaixas, juntarFaixas, recomporFaixas,
} from './faixas.js';

// A matriz mês x turno grava daterange por baixo. Estas funções são a
// tradução entre os dois mundos — se errarem, o cadastro fica diferente do
// que a tela mostra e ninguém percebe. Por isso testa sem banco.

const f = (inicio, fim) => ({ inicio, fim });

test('inicioDoMes monta a data com zero à esquerda', () => {
  assert.equal(inicioDoMes(2026, 1), '2026-01-01');
  assert.equal(inicioDoMes(2026, 9), '2026-09-01');
});

test('inicioDoMes com mês 13 vira janeiro do ano seguinte', () => {
  // É assim que dezembro fecha, já que o fim do daterange é exclusivo.
  assert.equal(inicioDoMes(2026, 13), '2027-01-01');
});

test('meses vizinhos viram uma faixa só', () => {
  assert.deepEqual(mesesParaFaixas([1, 2, 3], 2026),
    [f('2026-01-01', '2026-04-01')]);
});

test('meses separados viram faixas separadas', () => {
  assert.deepEqual(mesesParaFaixas([1, 2, 7, 8], 2026),
    [f('2026-01-01', '2026-03-01'), f('2026-07-01', '2026-09-01')]);
});

test('dezembro fecha no ano seguinte', () => {
  assert.deepEqual(mesesParaFaixas([12], 2026),
    [f('2026-12-01', '2027-01-01')]);
});

test('ano inteiro marcado é uma faixa só', () => {
  assert.deepEqual(mesesParaFaixas([1,2,3,4,5,6,7,8,9,10,11,12], 2026),
    [f('2026-01-01', '2027-01-01')]);
});

test('nenhum mês marcado não gera faixa', () => {
  assert.deepEqual(mesesParaFaixas([], 2026), []);
});

test('meses fora de ordem ou repetidos são normalizados', () => {
  assert.deepEqual(mesesParaFaixas([3, 1, 2, 2], 2026),
    [f('2026-01-01', '2026-04-01')]);
});

test('juntarFaixas cola o que se encosta', () => {
  assert.deepEqual(
    juntarFaixas([f('2026-01-01', '2026-04-01'), f('2026-04-01', '2026-07-01')]),
    [f('2026-01-01', '2026-07-01')]);
});

test('juntarFaixas não cola o que tem buraco', () => {
  const r = juntarFaixas([f('2026-01-01', '2026-04-01'), f('2026-05-01', '2026-07-01')]);
  assert.equal(r.length, 2);
});

test('juntarFaixas cola numa faixa aberta no fim', () => {
  assert.deepEqual(
    juntarFaixas([f('2026-01-01', '2026-04-01'), f('2026-04-01', null)]),
    [f('2026-01-01', null)]);
});

// --- recomporFaixas: o ano editado é substituído, o resto fica -------------

test('sem nada antes, marcar meses só cria as faixas do ano', () => {
  assert.deepEqual(recomporFaixas([], 2026, [1, 2, 3]),
    [f('2026-01-01', '2026-04-01')]);
});

test('desmarcar tudo no ano remove só o ano', () => {
  assert.deepEqual(recomporFaixas([f('2026-03-01', '2026-06-01')], 2026, []), []);
});

test('faixa aberta atravessando o ano é preservada dos dois lados', () => {
  // Vinha de 2025 sem fim; editar 2026 marcando o ano todo tem que devolver
  // exatamente a mesma faixa contínua, não três pedaços.
  assert.deepEqual(
    recomporFaixas([f('2025-06-01', null)], 2026, [1,2,3,4,5,6,7,8,9,10,11,12]),
    [f('2025-06-01', null)]);
});

test('desmarcar o ano inteiro abre um buraco e mantém as pontas', () => {
  assert.deepEqual(
    recomporFaixas([f('2025-06-01', null)], 2026, []),
    [f('2025-06-01', '2026-01-01'), f('2027-01-01', null)]);
});

test('editar 2026 não encosta no que foi configurado em 2025', () => {
  const r = recomporFaixas([f('2025-01-01', '2025-07-01')], 2026, [5]);
  assert.deepEqual(r, [f('2025-01-01', '2025-07-01'), f('2026-05-01', '2026-06-01')]);
});

test('faixa que começa no meio do ano anterior é cortada na virada', () => {
  const r = recomporFaixas([f('2025-11-01', '2026-04-01')], 2026, [7]);
  assert.deepEqual(r, [f('2025-11-01', '2026-01-01'), f('2026-07-01', '2026-08-01')]);
});

test('faixa inteiramente posterior ao ano editado não é tocada', () => {
  const r = recomporFaixas([f('2027-03-01', '2027-06-01')], 2026, [1]);
  assert.deepEqual(r, [f('2026-01-01', '2026-02-01'), f('2027-03-01', '2027-06-01')]);
});

test('marcar o ano todo colado numa faixa de 2027 vira faixa única', () => {
  const r = recomporFaixas([f('2027-01-01', '2027-06-01')], 2026,
                           [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.deepEqual(r, [f('2026-01-01', '2027-06-01')]);
});

test('várias faixas soltas no ano são substituídas pelo que está marcado', () => {
  const r = recomporFaixas(
    [f('2026-01-01', '2026-03-01'), f('2026-08-01', '2026-10-01')],
    2026, [6]);
  assert.deepEqual(r, [f('2026-06-01', '2026-07-01')]);
});
