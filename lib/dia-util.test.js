import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PESO_PADRAO, diasUteisPorMes, formataDiasUteis } from './dia-util.js';

// A contagem vem do banco por (mês, dia da semana, impacto). `impacto` é
// quanto do dia uma parada de apresentação consome — 0 no dia normal.
const l = (mes, ds, dias, impacto = 0) => ({ mes, dia_semana: ds, dias, impacto });

test('sem parada, é a contagem vezes o peso do dia da semana', () => {
  // 4 segundas (peso 1) + 4 sábados (peso 0,5)
  const r = diasUteisPorMes([l(3, 1, 4), l(3, 6, 4)]);
  assert.equal(r[3], 6);
});

test('impacto ausente é tratado como zero', () => {
  const r = diasUteisPorMes([{ mes: 3, dia_semana: 1, dias: 4 }]);
  assert.equal(r[3], 4);
});

test('parada de meio dia tira meio dia útil', () => {
  // 3 segundas normais + 1 segunda com parada de 0,5
  const r = diasUteisPorMes([l(3, 1, 3), l(3, 1, 1, 0.5)]);
  assert.equal(r[3], 3.5);
});

test('parada de dia inteiro zera aquele dia', () => {
  const r = diasUteisPorMes([l(3, 1, 3), l(3, 1, 1, 1)]);
  assert.equal(r[3], 3);
});

test('parada maior que o peso do dia não fica negativa', () => {
  // Sábado vale 0,5; parada de dia inteiro não pode devolver -0,5 e comer
  // outro dia do mês.
  const r = diasUteisPorMes([l(3, 6, 1, 1)]);
  assert.equal(r[3], 0);
});

test('o desconto é por dia, não sobre o total do mês', () => {
  // Dois sábados, um deles com parada de dia inteiro. Se o desconto fosse no
  // total, daria 1 - 1 = 0. Por dia dá 0,5 + max(0, 0,5-1) = 0,5.
  const r = diasUteisPorMes([l(3, 6, 1), l(3, 6, 1, 1)]);
  assert.equal(r[3], 0.5);
});

test('peso editado na tela vale para o desconto também', () => {
  // Sábado configurado como dia cheio; parada de meio dia deixa 0,5.
  const pesos = [0, 1, 1, 1, 1, 1, 1];
  const r = diasUteisPorMes([l(3, 6, 1, 0.5)], pesos);
  assert.equal(r[3], 0.5);
});

test('cada mês soma no seu índice, e o zero não é usado', () => {
  const r = diasUteisPorMes([l(1, 1, 2), l(12, 1, 3)]);
  assert.equal(r[0], 0);
  assert.equal(r[1], 2);
  assert.equal(r[12], 3);
  assert.equal(r.length, 13);
});

test('formataDiasUteis sempre mostra uma casa, com vírgula', () => {
  assert.equal(formataDiasUteis(21), '21,0');
  assert.equal(formataDiasUteis(21.5), '21,5');
  assert.equal(formataDiasUteis(0), '0,0');
});

test('PESO_PADRAO é domingo 0, semana 1, sábado 0,5', () => {
  assert.deepEqual(PESO_PADRAO, [0, 1, 1, 1, 1, 1, 0.5]);
});
