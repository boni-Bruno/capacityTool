import { test } from 'node:test';
import assert from 'node:assert/strict';
import { semOsDoFluxo } from './filtro-fluxo.js';

const campos = [
  { nome: 'area' }, { nome: 'cenario' }, { nome: 'tipo' },
  { nome: 'cc' }, { nome: 'ct' }, { nome: 'recurso' }, { nome: 'ano' },
];

test('fora do fluxo, a tela mostra todos os seletores', () => {
  assert.equal(semOsDoFluxo(campos, {}).length, 7);
  assert.equal(semOsDoFluxo(campos, undefined).length, 7);
  assert.equal(semOsDoFluxo(campos, { fluxo: '0' }).length, 7);
});

test('dentro do fluxo, somem fábrica, ano e cenário — e só eles', () => {
  const r = semOsDoFluxo(campos, { fluxo: '1' }).map((c) => c.nome);
  assert.deepEqual(r, ['tipo', 'cc', 'ct', 'recurso']);
});

test('o recorte de dentro da etapa continua inteiro', () => {
  // CC, CT, patrimônio e recurso são a escolha DA ETAPA, e tirá-los faria o
  // passo de uma área de cinquenta máquinas virar uma rolagem só.
  const r = semOsDoFluxo(campos, { fluxo: '1' });
  for (const n of ['cc', 'ct', 'recurso', 'tipo']) {
    assert.ok(r.some((c) => c.nome === n), `${n} sumiu`);
  }
});
