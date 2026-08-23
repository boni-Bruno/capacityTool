import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conferirColunasAp, montarRecursosAp, quantidadeDo } from './ap.js';

// A quantidade de recurso do AP é DIVISOR da capacidade exportada. Errar aqui
// não estoura em lugar nenhum: entrega um número plausível e errado, que é o
// pior tipo — o outro sistema importa sem reclamar.

const l = (ct, ind, maq, pes, desc = null) => ({
  CENTROTRABALHO: ct, INDICADORCALCULOCAPACIDADE: ind,
  QTMAQUINA: maq, QTPESSOAS: pes, DESCRCENTROTRABALHO: desc,
});

test('o indicador decide qual dos dois campos vale', () => {
  assert.equal(quantidadeDo(l('100-001', 'M', 1, 0)), 1);
  assert.equal(quantidadeDo(l('401-001', 'P', 0, 3)), 3);
});

test('centro de pessoas com QTMAQUINA preenchido lê o campo certo', () => {
  // Existe no arquivo real. Ler QTMAQUINA aqui daria um divisor plausível.
  assert.equal(quantidadeDo(l('401-009', 'P', 7, 2)), 2);
});

test('indicador em branco é o terceiro caso: facção, sem quantidade', () => {
  assert.equal(quantidadeDo(l('151-200', ' ', 0, 0)), 0);
  assert.equal(quantidadeDo(l('151-200', null, 5, 5)), 0);
});

test('quantidade negativa ou não numérica vira zero, não divisor torto', () => {
  assert.equal(quantidadeDo(l('x', 'M', -3, 0)), 0);
  assert.equal(quantidadeDo(l('x', 'M', 'abc', 0)), 0);
});

test('CT repetido condensa quando as linhas concordam', () => {
  // 513-197 vem vinte vezes no arquivo real, uma por sequência de roteiro.
  const r = montarRecursosAp([
    l('513-197', ' ', 0, 0), l('513-197', ' ', 0, 0), l('513-197', ' ', 0, 0),
  ]);
  assert.equal(r.problemas.length, 0);
  assert.equal(r.itens.length, 1);
  assert.equal(r.resumo.linhas, 3);
});

test('CT repetido com quantidades diferentes vira problema, não escolha muda', () => {
  const r = montarRecursosAp([l('313-001', 'M', 2, 0), l('313-001', 'M', 5, 0)]);
  assert.equal(r.problemas.length, 1);
  assert.match(r.problemas[0], /313-001/);
});

test('centro de trabalho vazio é recusado com o número da linha', () => {
  const r = montarRecursosAp([l('100-001', 'M', 1, 0), l('', 'M', 1, 0)]);
  assert.equal(r.problemas.length, 1);
  assert.match(r.problemas[0], /Linha 2/);
});

test('o resumo separa máquina, pessoa e o que não tem quantidade', () => {
  const r = montarRecursosAp([
    l('100-001', 'M', 1, 0), l('104-001', 'M', 2, 0),
    l('401-001', 'P', 0, 3),
    l('151-200', ' ', 0, 0),
  ]);
  assert.deepEqual(r.resumo, {
    linhas: 4, centros: 4, com_quantidade: 3, sem_quantidade: 1,
    maquina: 2, pessoa: 1, total_recursos: 6,
  });
});

test('as colunas que faltam saem pelo nome', () => {
  assert.deepEqual(conferirColunasAp(['CENTROTRABALHO', 'QTMAQUINA']),
    ['INDICADORCALCULOCAPACIDADE', 'QTPESSOAS']);
  assert.deepEqual(conferirColunasAp(
    ['CENTROTRABALHO', 'INDICADORCALCULOCAPACIDADE', 'QTMAQUINA', 'QTPESSOAS', 'X']), []);
});
