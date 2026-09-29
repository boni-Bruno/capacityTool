import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sugestoesDoAno } from './regime-sugerido.js';

// PADRAO = 1, RODIZIO = 2 (os ids da Matriz, para o teste ler como a fábrica).
const TURNOS = [
  { turno_id: 1, nome: '1º Turno', calendario_sugerido_id: null },
  { turno_id: 3, nome: '3º Turno', calendario_sugerido_id: 1 },
  { turno_id: 7, nome: 'Rodízio (24/7)', calendario_sugerido_id: 2 },
];

// O ano inteiro em PADRAO, que é como quase todo recurso está.
const anoEmPadrao = () => {
  const c = {};
  for (let mes = 1; mes <= 12; mes += 1) c[mes] = 1;
  return c;
};

test('turno sem sugestão não sugere nada', () => {
  const r = sugestoesDoAno(TURNOS, { 1: [1], 2: [1] }, anoEmPadrao());
  assert.deepEqual(r.aplicar, {});
  assert.deepEqual(r.conflitos, []);
});

test('marcar o turno de rodízio em julho sugere RODIZIO só em julho', () => {
  const ligados = { 1: [1], 7: [7], 8: [7] };
  const r = sugestoesDoAno(TURNOS, ligados, anoEmPadrao());
  assert.deepEqual(r.aplicar, { 7: 2, 8: 2 });
  assert.deepEqual(r.conflitos, []);
});

test('sugestão igual ao que já vale não vira proposta', () => {
  const cal = anoEmPadrao();
  cal[7] = 2;
  const r = sugestoesDoAno(TURNOS, { 7: [7] }, cal);
  assert.deepEqual(r.aplicar, {});
});

test('dois turnos discordando no mesmo mês viram conflito, não escolha', () => {
  const r = sugestoesDoAno(TURNOS, { 7: [3, 7] }, anoEmPadrao());
  assert.deepEqual(r.aplicar, {});
  assert.equal(r.conflitos.length, 1);
  assert.equal(r.conflitos[0].mes, 7);
  assert.deepEqual(r.conflitos[0].turnos, ['3º Turno', 'Rodízio (24/7)']);
});

test('mês sem regime nenhum recebe a sugestão', () => {
  // O caso do recurso com buraco: cal vazio, e o turno marcado diz qual é.
  const r = sugestoesDoAno(TURNOS, { 3: [7] }, {});
  assert.deepEqual(r.aplicar, { 3: 2 });
});

test('turnos marcados mas sem sugestão não geram conflito com quem tem', () => {
  const r = sugestoesDoAno(TURNOS, { 5: [1, 7] }, anoEmPadrao());
  assert.deepEqual(r.aplicar, { 5: 2 });
  assert.deepEqual(r.conflitos, []);
});
