import { test } from 'node:test';
import assert from 'node:assert/strict';
import { piorEstado, podeAbrir, prontidaoDaPlanta } from './prontidao.js';

// A planta pronta, para variar um campo por teste.
const ok = {
  planta: 'Matriz',
  calendarios: 2, calendariosSemDia: 0,
  excecoesDoAno: 69, excecoesDoAnoAnterior: 32,
  turnosAtivos: 6, turnosSemHorario: 0,
};

const acha = (itens, chave) => itens.find((i) => i.chave === chave);

test('planta pronta passa nos três itens', () => {
  const itens = prontidaoDaPlanta(ok, 2027);
  assert.equal(itens.length, 3);
  assert.equal(piorEstado(itens), 'ok');
  assert.deepEqual(podeAbrir(itens), { permitido: true, pedeConfirmacao: false });
});

// O CASO QUE CRIOU ESTE MOTOR: 2028 com 8 exceções contra as 69 de 2027.
test('o ano com poucos feriados contra o anterior vira alerta', () => {
  const itens = prontidaoDaPlanta(
    { ...ok, excecoesDoAno: 8, excecoesDoAnoAnterior: 69 }, 2028);
  const f = acha(itens, 'feriados');
  assert.equal(f.estado, 'alerta');
  assert.match(f.titulo, /8 exceção/);
  assert.match(f.titulo, /69 de 2027/);
  // Alerta não tranca: deixa abrir, pedindo confirmação.
  assert.deepEqual(podeAbrir(itens), { permitido: true, pedeConfirmacao: true });
});

test('ano sem feriado nenhum é falta, e tranca', () => {
  const itens = prontidaoDaPlanta(
    { ...ok, excecoesDoAno: 0, excecoesDoAnoAnterior: 69 }, 2028);
  assert.equal(acha(itens, 'feriados').estado, 'falta');
  assert.equal(podeAbrir(itens).permitido, false);
});

test('queda pequena no número de feriados não acusa', () => {
  // 60 contra 69 é ruído de calendário: feriado que caiu no domingo, emenda a
  // menos. Acusar isso treinaria a pessoa a ignorar o aviso.
  const itens = prontidaoDaPlanta(
    { ...ok, excecoesDoAno: 60, excecoesDoAnoAnterior: 69 }, 2028);
  assert.equal(acha(itens, 'feriados').estado, 'ok');
});

test('sem ano anterior para comparar, qualquer número passa', () => {
  // Primeiro ano da ferramenta: não há com o que comparar, e inventar um
  // mínimo absoluto seria chutar.
  const itens = prontidaoDaPlanta(
    { ...ok, excecoesDoAno: 3, excecoesDoAnoAnterior: 0 }, 2026);
  assert.equal(acha(itens, 'feriados').estado, 'ok');
});

test('planta sem calendário tranca e explica que o recurso SOME', () => {
  const itens = prontidaoDaPlanta({ ...ok, calendarios: 0 }, 2027);
  const c = acha(itens, 'calendario');
  assert.equal(c.estado, 'falta');
  assert.match(c.detalhe, /some/);
  assert.equal(podeAbrir(itens).permitido, false);
});

test('calendário sem dia da semana tranca', () => {
  const itens = prontidaoDaPlanta({ ...ok, calendariosSemDia: 1 }, 2027);
  assert.equal(acha(itens, 'calendario').estado, 'falta');
});

test('turno ativo sem horário tranca', () => {
  const itens = prontidaoDaPlanta({ ...ok, turnosSemHorario: 2 }, 2027);
  const t = acha(itens, 'turnos');
  assert.equal(t.estado, 'falta');
  assert.match(t.titulo, /2 turno/);
  assert.equal(t.ondeResolver, '/cadastros/turnos');
});

test('planta sem turno ativo tranca', () => {
  const itens = prontidaoDaPlanta({ ...ok, turnosAtivos: 0 }, 2027);
  assert.equal(acha(itens, 'turnos').estado, 'falta');
});

test('falta ganha de alerta no pior estado', () => {
  const itens = prontidaoDaPlanta(
    { ...ok, excecoesDoAno: 8, turnosSemHorario: 1 }, 2028);
  assert.equal(piorEstado(itens), 'falta');
});

test('dados vazios não quebram — tudo vira falta', () => {
  const itens = prontidaoDaPlanta(undefined, 2028);
  assert.equal(itens.length, 3);
  assert.equal(piorEstado(itens), 'falta');
});
