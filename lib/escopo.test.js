import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alcancaArea, alcancaPlanta, areasPermitidas, descreveEscopo, escopoDaTela,
  filtraPeloEscopo, marcacaoDoEscopo, plantasPermitidas,
} from './escopo.js';

const PLANTAS = [{ id: 1, nome: 'Matriz' }, { id: 2, nome: 'Ibirama' }];
const AREAS = [
  { id: 10, nome: 'Tecelagem', planta_id: 1 },
  { id: 11, nome: 'Beneficiamento', planta_id: 1 },
  { id: 20, nome: 'Confecção Cama', planta_id: 2 },
];

test('empresa é tudo (null); vazio é nada; planta expande; área é só ela', () => {
  assert.equal(areasPermitidas([{ nivel: 'EMPRESA', referencia_id: null }], AREAS), null);
  assert.deepEqual([...areasPermitidas([], AREAS)], []);
  assert.deepEqual([...areasPermitidas(null, AREAS)], []);
  assert.deepEqual([...areasPermitidas([{ nivel: 'PLANTA', referencia_id: 1 }], AREAS)], [10, 11]);
  assert.deepEqual([...areasPermitidas([{ nivel: 'AREA', referencia_id: '20' }], AREAS)], [20]);
  assert.deepEqual([...areasPermitidas([
    { nivel: 'PLANTA', referencia_id: 2 }, { nivel: 'AREA', referencia_id: 11 },
  ], AREAS)], [11, 20]);
});

test('área criada depois numa planta permitida entra sozinha', () => {
  const escopo = [{ nivel: 'PLANTA', referencia_id: 1 }];
  const depois = [...AREAS, { id: 12, nome: 'Fiação', planta_id: 1 }];
  assert.deepEqual([...areasPermitidas(escopo, depois)], [10, 11, 12]);
});

test('o que é da planta só quem tem a planta (ou a empresa) mexe', () => {
  assert.equal(plantasPermitidas([{ nivel: 'EMPRESA' }]), null);
  assert.deepEqual([...plantasPermitidas([{ nivel: 'PLANTA', referencia_id: 2 }])], [2]);
  assert.deepEqual([...plantasPermitidas([{ nivel: 'AREA', referencia_id: 20 }])], []);
  assert.ok(alcancaArea(null, 999));
  assert.ok(alcancaArea(new Set([10]), '10'));
  assert.ok(!alcancaArea(new Set([10]), 11));
  assert.ok(alcancaPlanta(new Set([2]), 2));
  assert.ok(!alcancaPlanta(new Set(), 2));
});

test('filtrar pelo escopo: null é TUDO, Set vazio é nada', () => {
  // O defeito de 22/09/2026: quem escreveu `permitidas ?? new Set()` no
  // seletor de fábrica transformou "tudo" em "nada", e o painel disse
  // "Nenhuma área cadastrada" para a senha mestre. Aqui isso não passa.
  assert.deepEqual(filtraPeloEscopo(null, AREAS), AREAS);
  assert.deepEqual(filtraPeloEscopo(new Set(), AREAS), []);
  assert.deepEqual(filtraPeloEscopo(new Set([10, 20]), AREAS).map((a) => a.id), [10, 20]);
  // Aceita id em texto e outro campo que não seja `id`.
  assert.deepEqual(filtraPeloEscopo(new Set([1]), AREAS, 'planta_id').map((a) => a.id), [10, 11]);
  assert.deepEqual(filtraPeloEscopo(new Set([10]), [{ id: '10' }]), [{ id: '10' }]);
  assert.deepEqual(filtraPeloEscopo(new Set([10]), null), []);
  assert.deepEqual(filtraPeloEscopo(null, null), []);
  // E o caminho inteiro: escopo de EMPRESA resolve para null e vê tudo.
  const doMestre = areasPermitidas([{ nivel: 'EMPRESA' }], AREAS);
  assert.deepEqual(filtraPeloEscopo(doMestre, AREAS), AREAS);
});

test('descreve o escopo numa frase', () => {
  assert.equal(descreveEscopo([], PLANTAS, AREAS), 'nenhuma fábrica');
  assert.equal(descreveEscopo([{ nivel: 'EMPRESA' }], PLANTAS, AREAS), 'empresa inteira');
  assert.equal(descreveEscopo([
    { nivel: 'PLANTA', referencia_id: 1 }, { nivel: 'AREA', referencia_id: 20 },
  ], PLANTAS, AREAS), 'Matriz inteira · Ibirama › Confecção Cama');
});

test('da tela para o banco: planta engole as áreas dela, empresa engole tudo', () => {
  assert.deepEqual(escopoDaTela({ empresa: true, plantas: [1], areas: [20] }, AREAS),
    [{ nivel: 'EMPRESA', referencia_id: null }]);
  assert.deepEqual(escopoDaTela({ plantas: ['1'], areas: [10, 11, 20] }, AREAS), [
    { nivel: 'PLANTA', referencia_id: 1 },
    { nivel: 'AREA', referencia_id: 20 },
  ]);
  assert.deepEqual(escopoDaTela({}, AREAS), []);
  assert.deepEqual(escopoDaTela({ areas: ['x', 20] }, AREAS), [{ nivel: 'AREA', referencia_id: 20 }]);
});

test('e de volta: as linhas viram a marcação da tela', () => {
  assert.deepEqual(marcacaoDoEscopo([
    { nivel: 'PLANTA', referencia_id: '1' }, { nivel: 'AREA', referencia_id: 20 },
  ]), { empresa: false, plantas: [1], areas: [20] });
  assert.deepEqual(marcacaoDoEscopo([{ nivel: 'EMPRESA' }]).empresa, true);
});
