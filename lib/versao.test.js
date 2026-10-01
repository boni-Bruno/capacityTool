import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODIGOS, PASSOS, anosAbertos, limpaPassos, pendenciasParaFechar, pendentes,
  progresso, proximoNumero, proximoPasso, versaoAberta,
} from './versao.js';

const v = (o) => ({
  origem: 'META', ano: 2027, numero: 1, fechada_em: null,
  passos_exigidos: CODIGOS, ...o,
});

// --- as etapas --------------------------------------------------------------

test('a ordem das etapas é a cadeia do motor', () => {
  assert.deepEqual(CODIGOS, [
    'recursos', 'jornada', 'oee', 'paradas', 'recalcular', 'conferir',
  ]);
  assert.equal(PASSOS.length, 6);
});

test('limpaPassos descarta o que não existe e devolve na ordem', () => {
  assert.deepEqual(limpaPassos(['oee', 'inventado', 'recursos']),
    ['recursos', 'oee']);
  assert.deepEqual(limpaPassos(['oee', 'oee']), ['oee']);
  assert.deepEqual(limpaPassos(null), []);
});

// --- o ciclo ----------------------------------------------------------------

test('só a versão aberta é encontrada', () => {
  const lista = [
    v({ numero: 1, fechada_em: '2026-10-01T12:00:00Z' }),
    v({ numero: 2 }),
  ];
  assert.equal(versaoAberta(lista, 'META', 2027).numero, 2);
  assert.equal(versaoAberta(lista, 'SIMULADO', 2027), null);
  assert.equal(versaoAberta(lista, 'META', 2028), null);
});

test('ano só é cadastrável enquanto a versão está aberta', () => {
  const lista = [
    v({ ano: 2026 }),
    v({ ano: 2027, fechada_em: '2026-12-20T12:00:00Z' }),
    v({ ano: 2028, origem: 'SIMULADO' }),
  ];
  // 2027 fechado sai da lista do META; 2028 é de outro cenário.
  assert.deepEqual(anosAbertos(lista, 'META'), [2026]);
  assert.deepEqual(anosAbertos(lista, 'SIMULADO'), [2028]);
});

test('o ano vem como texto da URL e continua casando', () => {
  const lista = [v({ ano: 2027 })];
  assert.ok(versaoAberta(lista, 'META', '2027'));
});

test('a próxima versão continua a numeração, inclusive com fechadas', () => {
  const lista = [
    v({ numero: 1, fechada_em: '2026-10-01T12:00:00Z' }),
    v({ numero: 2, fechada_em: '2026-11-01T12:00:00Z' }),
  ];
  assert.equal(proximoNumero(lista, 'META', 2027), 3);
  assert.equal(proximoNumero(lista, 'META', 2028), 1);
  assert.equal(proximoNumero([], 'META', 2027), 1);
});

// --- o progresso ------------------------------------------------------------

test('pendente é o exigido que não foi confirmado', () => {
  assert.deepEqual(pendentes(['jornada', 'oee'], ['oee']), ['jornada']);
  // Confirmar um passo que a versão NÃO exige não conta para nada.
  assert.deepEqual(pendentes(['jornada'], ['oee', 'paradas']), ['jornada']);
});

test('o fluxo abre no primeiro pendente, na ordem das etapas', () => {
  assert.equal(proximoPasso(CODIGOS, ['recursos']), 'jornada');
  assert.equal(proximoPasso(CODIGOS, CODIGOS), null);
});

test('a versão que exige menos fecha mais rápido', () => {
  // É o caso da v4 que "só mexeu em jornada e OEE": 2 de 2, não 2 de 6.
  assert.deepEqual(progresso(['jornada', 'oee'], ['jornada', 'oee']),
    { feitos: 2, total: 2, pct: 100, completo: true });
  assert.deepEqual(progresso(CODIGOS, ['recursos', 'jornada']),
    { feitos: 2, total: 6, pct: 33, completo: false });
});

test('versão que não exige nada já nasce completa', () => {
  assert.deepEqual(progresso([], []),
    { feitos: 0, total: 0, pct: 100, completo: true });
});

// --- o fechamento -----------------------------------------------------------

test('fechar lista as áreas pendentes, mas não impede', () => {
  const areas = [
    { area_id: 1, nome: 'Confecção', exigidos: ['jornada', 'oee'], feitos: ['jornada', 'oee'] },
    { area_id: 2, nome: 'Tecelagem', exigidos: ['jornada', 'oee'], feitos: ['jornada'] },
  ];
  const p = pendenciasParaFechar(areas);
  assert.equal(p.length, 1);
  assert.equal(p[0].nome, 'Tecelagem');
  assert.deepEqual(p[0].falta, ['oee']);
});
