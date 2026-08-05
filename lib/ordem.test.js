import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escreveOrdem, leOrdem, ordenar } from './ordem.js';

const lista = [
  { id: 3, nome: 'Área B', qt: '10' },
  { id: 1, nome: 'area a', qt: '9'  },
  { id: 2, nome: 'Area A', qt: '2'  },
];

test('leOrdem e escreveOrdem são inversos', () => {
  assert.deepEqual(leOrdem('nome:desc'), { campo: 'nome', desc: true });
  assert.deepEqual(leOrdem('nome:asc'),  { campo: 'nome', desc: false });
  assert.equal(escreveOrdem({ campo: 'nome', desc: true }), 'nome:desc');
  // Cookie vazio significa "sem ordenação", não "ordena por vazio".
  assert.equal(leOrdem(''), null);
  assert.equal(leOrdem(null), null);
  assert.equal(escreveOrdem(null), '');
});

test('sem ordem, devolve a lista como veio do banco', () => {
  assert.deepEqual(ordenar(lista, null).map((x) => x.id), [3, 1, 2]);
});

test('texto compara sem acento e sem caixa, e desempata pelo id', () => {
  assert.deepEqual(ordenar(lista, { campo: 'nome' }).map((x) => x.id), [1, 2, 3]);
  assert.deepEqual(
    ordenar(lista, { campo: 'nome', desc: true }).map((x) => x.id), [3, 2, 1]);
});

test('número compara como número, não como texto', () => {
  // Como texto, "10" viria antes de "2".
  assert.deepEqual(ordenar(lista, { campo: 'qt' }).map((x) => x.id), [2, 1, 3]);
});

test('não mexe na lista recebida', () => {
  const antes = lista.map((x) => x.id);
  ordenar(lista, { campo: 'nome' });
  assert.deepEqual(lista.map((x) => x.id), antes);
});

test('campo ausente não quebra: cai no desempate por id', () => {
  assert.deepEqual(ordenar(lista, { campo: 'nada' }).map((x) => x.id), [1, 2, 3]);
});
