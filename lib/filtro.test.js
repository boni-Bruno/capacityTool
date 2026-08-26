import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  descreveFiltro, escreveFiltro, leFiltro, leFiltros, passaFiltro, passaTodos,
} from './filtro.js';

// Filtro que recorta errado não dá erro em lugar nenhum: mostra menos, e o
// total menor parece capacidade menor. Todo caminho daqui precisa de teste.

const r = { cc: '278', ct: '001', nome: 'COTTON FLOW 150KG', sub_area: '' };

// --- os operadores ---------------------------------------------------------

test('é um de: casa com qualquer um dos valores', () => {
  assert.equal(passaFiltro('278', { op: 'in', valores: ['278', '401'] }), true);
  assert.equal(passaFiltro('515', { op: 'in', valores: ['278', '401'] }), false);
});

test('não é nenhum de é o complemento exato', () => {
  assert.equal(passaFiltro('278', { op: 'nin', valores: ['278'] }), false);
  assert.equal(passaFiltro('515', { op: 'nin', valores: ['278'] }), true);
});

test('contém e não contém, sem acento e sem caixa', () => {
  assert.equal(passaFiltro('COTTON FLOW', { op: 'contem', valores: ['cotton'] }), true);
  assert.equal(passaFiltro('Tingimento', { op: 'contem', valores: ['TINGIMENTO'] }), true);
  assert.equal(passaFiltro('Confecção', { op: 'contem', valores: ['confeccao'] }), true);
  assert.equal(passaFiltro('COTTON', { op: 'ncontem', valores: ['flow'] }), true);
});

test('começa com e termina com', () => {
  assert.equal(passaFiltro('COTTON FLOW 150KG', { op: 'comeca', valores: ['cotton'] }), true);
  assert.equal(passaFiltro('COTTON FLOW 150KG', { op: 'comeca', valores: ['flow'] }), false);
  assert.equal(passaFiltro('COTTON FLOW 150KG', { op: 'termina', valores: ['150kg'] }), true);
});

test('vazio e não vazio olham o dado, não o texto', () => {
  assert.equal(passaFiltro('', { op: 'vazio' }), true);
  assert.equal(passaFiltro('   ', { op: 'vazio' }), true);
  assert.equal(passaFiltro(null, { op: 'vazio' }), true);
  assert.equal(passaFiltro('x', { op: 'nvazio' }), true);
});

test('o vazio some no "é um de" e sobrevive no "não é nenhum de"', () => {
  // É o que faz os dois recortes somarem o todo: tratar o vazio como "não sei"
  // o deixaria de fora dos dois, e a conta não fecharia.
  assert.equal(passaFiltro('', { op: 'in', valores: ['278'] }), false);
  assert.equal(passaFiltro('', { op: 'nin', valores: ['278'] }), true);
  assert.equal(passaFiltro('', { op: 'ncontem', valores: ['x'] }), true);
});

// --- E entre campos, OU dentro do campo ------------------------------------

test('dois campos estreitam; dois valores no mesmo campo alargam', () => {
  assert.equal(passaTodos(r, {
    cc: { op: 'in', valores: ['278', '401'] },
    ct: { op: 'in', valores: ['001'] },
  }), true);
  assert.equal(passaTodos(r, {
    cc: { op: 'in', valores: ['278'] },
    ct: { op: 'in', valores: ['002'] },
  }), false);
});

test('sem filtro nenhum, tudo passa', () => {
  assert.equal(passaTodos(r, {}), true);
  assert.equal(passaTodos(r, null), true);
});

// --- a ida e volta pela URL ------------------------------------------------

test('escreve e lê de volta o mesmo filtro', () => {
  const f = { op: 'in', valores: ['278', '401'] };
  assert.deepEqual(leFiltro(escreveFiltro(f)), f);
});

test('vírgula dentro do valor sobrevive à ida e volta', () => {
  // "TEAR 12, LINHA 3" existe no cadastro; sem escapar viraria dois filtros.
  const f = { op: 'in', valores: ['TEAR 12, LINHA 3', 'OUTRO'] };
  assert.deepEqual(leFiltro(escreveFiltro(f)), f);
});

test('operador desconhecido não vira filtro', () => {
  assert.equal(leFiltro('drop:tabela'), null);
  assert.equal(leFiltro(''), null);
  assert.equal(leFiltro(null), null);
});

test('operador que precisa de valor e não tem é descartado', () => {
  // Um filtro ligado na tela e que não filtra nada é pior que nenhum.
  assert.equal(leFiltro('in:'), null);
  assert.equal(leFiltro('contem:'), null);
  assert.deepEqual(leFiltro('vazio'), { op: 'vazio', valores: [] });
});

test('leFiltros pega só os campos que a tela conhece', () => {
  const f = leFiltros({ f_cc: 'in:278', f_x: 'in:1', ordem: 'nome:asc' },
    ['cc', 'ct']);
  assert.deepEqual(Object.keys(f), ['cc']);
  assert.deepEqual(f.cc, { op: 'in', valores: ['278'] });
});

test('a descrição diz o que está recortando, e resume lista longa', () => {
  assert.equal(descreveFiltro('CC', { op: 'in', valores: ['278'] }),
    'CC é um de 278');
  assert.equal(
    descreveFiltro('CC', { op: 'in', valores: ['1', '2', '3', '4', '5'] }),
    'CC é um de 1, 2, 3 e mais 2');
});
