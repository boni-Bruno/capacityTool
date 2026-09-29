import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mesesDescobertos, mesesDoAno, recomporFaixas, recomporFaixasComValor,
} from './faixas.js';

// FAIXA QUE COMEÇA NO INFINITO.
//
// daterange(null, null) é o que está gravado hoje em recurso_calendario (as 393
// linhas), em recurso_parametro e no OEE que nasce com o recurso. Em texto,
// `null < '2027-01-01'` é FALSO em JavaScript — os dois viram número e a data
// vira NaN —, então antes destes testes:
//
//   - mesesDoAno devolvia o ano INTEIRO em branco para essas faixas: a tela de
//     OEE mostrava vazio um recurso que o motor lia como 100%;
//   - recomporFaixas perdia o pedaço anterior ao ano editado: salvar 2027
//     deixava 2026 para trás DESCOBERTO, e para o calendário isso é capacidade
//     zero sem uma linha de erro em lugar nenhum.

const f = (inicio, fim, valor) => ({ inicio, fim, valor });

test('mesesDoAno enxerga faixa que começa no infinito', () => {
  const m = mesesDoAno([f(null, null, 7)], 2027);
  assert.equal(Object.keys(m).length, 12);
  assert.equal(m[1], 7);
  assert.equal(m[12], 7);
});

test('faixa aberta dos dois lados cobre qualquer ano', () => {
  assert.deepEqual(mesesDescobertos([f(null, null, 7)], 2031), []);
});

test('mesesDescobertos aponta o buraco no meio do ano', () => {
  const faixas = [f(null, '2027-04-01', 7), f('2027-09-01', null, 7)];
  assert.deepEqual(mesesDescobertos(faixas, 2027), [4, 5, 6, 7, 8]);
});

test('editar um ano preserva o passado infinito', () => {
  const r = recomporFaixasComValor([f(null, null, 7)], 2027,
    { 1: 7, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 9, 8: 9, 9: 9, 10: 9, 11: 9, 12: 9 });

  assert.deepEqual(r, [
    f(null, '2027-07-01', 7),
    f('2027-07-01', '2028-01-01', 9),
    f('2028-01-01', null, 7),
  ]);
  // O ano seguinte volta ao que era: o cadastro por mês vale para o ano
  // escolhido, e não emenda no futuro.
  assert.deepEqual(mesesDescobertos(r, 2026), []);
  assert.deepEqual(mesesDescobertos(r, 2028), []);
});

test('ano inteiro igual ao que já valia volta a ser uma faixa só', () => {
  const porMes = {};
  for (let mes = 1; mes <= 12; mes += 1) porMes[mes] = 7;

  assert.deepEqual(recomporFaixasComValor([f(null, null, 7)], 2027, porMes),
    [f(null, null, 7)]);
});

test('sem valor, a faixa infinita também é recortada e não apagada', () => {
  // recomporFaixas (sem valor) é a matriz de turnos. Mesma armadilha.
  const r = recomporFaixas([{ inicio: null, fim: null }], 2027, [1, 2, 3]);
  assert.deepEqual(r, [
    { inicio: null, fim: '2027-04-01' },
    { inicio: '2028-01-01', fim: null },
  ]);
});
