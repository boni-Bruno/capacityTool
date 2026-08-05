import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formataUnidade, horasEMinutos } from './formato.js';

// O caso que originou a mudança: 29.430 min de planejada com OEE de 75% dá
// 22.072,5 de disponível. O motor guarda a fração, e a tela mostra ela.
test('minuto mostra a fração quando ela existe', () => {
  assert.equal(formataUnidade(29430, 'min'), '29.430');
  assert.equal(formataUnidade(22072.5, 'min'), '22.072,5');
  // Veio do banco como texto (numeric do Postgres chega assim).
  assert.equal(formataUnidade('22072.500000', 'min'), '22.072,5');
});

test('planejada x OEE fecha no total, não linha a linha', () => {
  // Três linhas cujo arredondamento individual somava 1 minuto a mais.
  const linhas = [490, 490, 490];
  const oee = 0.75;
  const exato = linhas.reduce((s, x) => s + x * oee, 0);
  const arredondado = linhas.reduce((s, x) => s + Math.round(x * oee), 0);
  assert.equal(exato, 1102.5);
  assert.equal(arredondado, 1104);
  assert.equal(formataUnidade(exato, 'min'), '1.102,5');
});

test('hora continua com uma casa', () => {
  assert.equal(formataUnidade(1032, 'h'), '17,2');
  assert.equal(formataUnidade(22072.5, 'h'), '367,9');
});

test('horas e minutos arredonda para o minuto cheio', () => {
  assert.equal(horasEMinutos(1032), '17 h 12 min');
  assert.equal(horasEMinutos(22072.5), '367 h 53 min');
  assert.equal(horasEMinutos(0), '0 min');
});
