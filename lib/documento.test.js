import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agrupa, ocupacao, rotuloIntervalo, secoesDoGrupo, tituloDoGrupo,
} from './documento.js';

// O documento é apresentado. Um número errado aqui não dá erro nenhum: sai um
// slide bonito com a conta trocada, e a conferência acontece na reunião.

const ct = (o) => ({
  ct: '278-001', planta: 'Matriz', area: 'Confecção', cc: '278',
  recursos: 'TEXPA 1', qtd_recursos: 1, postos: 2, maquinas: 1, pessoas: 0,
  turno_ids: [1, 2], calendario_ids: [7], faixas_oee: 12, paradas: 3,
  instalada: 1000, planejada: 800, disponivel: 600, demanda: 300,
  ...o,
});

const BASE = [
  ct({}),
  ct({ ct: '278-002', recursos: 'TEXPA 2', turno_ids: [2, 3], disponivel: 400,
       demanda: 500 }),
  ct({ ct: '401-009', cc: '401', recursos: 'CORTE', turno_ids: [1],
       calendario_ids: [7, 8], disponivel: 1000, demanda: 100 }),
];

// --- agrupar ---------------------------------------------------------------

test('um slide por CT devolve uma linha por CT, na ordem que veio', () => {
  const g = agrupa(BASE, 'CT');
  assert.deepEqual(g.map((x) => x.ct), ['278-001', '278-002', '401-009']);
});

test('um slide por CC junta os CTs do centro de custo', () => {
  const g = agrupa(BASE, 'CC');
  assert.equal(g.length, 2);
  assert.equal(g[0].cc, '278');
  assert.equal(g[0].cts, 2);
  assert.equal(g[0].disponivel, 1000);
  assert.equal(g[0].demanda, 800);
});

test('o resumo é um grupo só, com o recorte inteiro', () => {
  const g = agrupa(BASE, 'RESUMO');
  assert.equal(g.length, 1);
  assert.equal(g[0].cts, 3);
  assert.equal(g[0].ccs, 2);
  assert.equal(g[0].disponivel, 2000);
});

test('turnos são união de conjunto, e nunca soma de contagens', () => {
  // Dois CTs no mesmo turno somariam 2+2 e 1 = cinco turnos numa fábrica que
  // tem três. Quem lê o slide acha que a fábrica roda o dobro do que roda.
  const g = agrupa(BASE, 'RESUMO');
  assert.equal(g[0].turnos, 3);
  assert.equal(g[0].calendarios, 2);
  // No CC de dois CTs, o turno 2 é compartilhado: 1, 2 e 3.
  assert.equal(agrupa(BASE, 'CC')[0].turnos, 3);
});

test('faixas de OEE e paradas somam, porque são de cada recurso', () => {
  const g = agrupa(BASE, 'RESUMO');
  assert.equal(g[0].faixas_oee, 36);
  assert.equal(g[0].paradas, 9);
});

test('grupo que atravessa duas plantas mostra as duas', () => {
  // Legenda com só a primeira seria uma frase errada num slide apresentado.
  const g = agrupa([ct({}), ct({ ct: '900-001', planta: 'Filial' })], 'RESUMO');
  assert.equal(g[0].planta, 'Matriz · Filial');
});

test('recorte vazio não vira um slide em branco', () => {
  assert.deepEqual(agrupa([], 'CT'), []);
  assert.deepEqual(agrupa(null, 'RESUMO'), []);
});

// --- a ocupação ------------------------------------------------------------

test('a ocupação do grupo é soma sobre soma, e não média de ocupações', () => {
  // Média das ocupações daria (50 + 125) / 2 = 87,5%, que trata um CT que roda
  // muito e um que quase não roda como se pesassem o mesmo.
  const g = agrupa(BASE, 'CC')[0];
  assert.equal(ocupacao(g.demanda, g.disponivel), 80);
});

test('capacidade zero dá ocupação nula, e não zero por cento', () => {
  // 0% diria "sobra tudo" para um CT que não tem nada onde caber.
  assert.equal(ocupacao(500, 0), null);
});

// --- o texto ---------------------------------------------------------------

test('o título do CT leva o nome do recurso, que é como as pessoas o chamam', () => {
  assert.equal(tituloDoGrupo(agrupa(BASE, 'CT')[0]), 'CT 278-001 · TEXPA 1');
  assert.equal(tituloDoGrupo(agrupa(BASE, 'CC')[0]), 'CC 278 · Confecção');
  assert.equal(tituloDoGrupo(agrupa(BASE, 'RESUMO')[0]), 'Recorte completo');
});

test('a capacidade sai só na medida escolhida', () => {
  const s = secoesDoGrupo(agrupa(BASE, 'CT')[0],
    { de: '2026-01-01', ate: '2026-12-31', medida: 'planejada' });
  const texto = s.map((x) => x.linhas.join(' ')).join(' ');
  assert.ok(texto.includes('Planejada: 800 min'));
  assert.ok(!texto.includes('Disponível'));
  assert.ok(!texto.includes('Instalada'));
});

test('sem cenário escolhido, demanda e ocupação não aparecem', () => {
  // Uma linha "0 min" onde ninguém pediu demanda pareceria fábrica sem pedido.
  const s = secoesDoGrupo(agrupa(BASE, 'CT')[0],
    { de: '2026-01-01', ate: '2026-12-31' });
  const texto = JSON.stringify(s);
  assert.ok(!texto.includes('Demanda'));
  assert.ok(!texto.includes('Ocupação'));
});

test('com cenário, a ocupação vem ao lado da demanda', () => {
  const s = secoesDoGrupo(agrupa(BASE, 'CT')[0],
    { de: '2026-01-01', ate: '2026-12-31', cenario: 'S&OP maio' });
  const texto = s.map((x) => x.linhas.join(' ')).join(' ');
  assert.ok(texto.includes('Demanda S&OP maio: 300 min'));
  assert.ok(texto.includes('Ocupação: 50.0%'));
});

test('sem rodada, o slide diz isso em vez de mostrar zero', () => {
  // "0 min" faria alguém apresentar uma fábrica parada que na verdade só não
  // foi calculada.
  const g = agrupa([ct({ disponivel: 0 })], 'CT')[0];
  const texto = JSON.stringify(secoesDoGrupo(g, {
    de: '2026-01-01', ate: '2026-12-31',
  }));
  assert.ok(texto.includes('Recalcular tudo'));
  assert.ok(!texto.includes('0 min'));
});

test('o período por extenso diz "ano" quando é o ano inteiro', () => {
  assert.equal(rotuloIntervalo('2026-01-01', '2026-12-31'), 'ano de 2026');
  assert.equal(rotuloIntervalo('2026-03-01', '2026-06-30'),
               '01/03 a 30/06 de 2026');
  assert.equal(rotuloIntervalo('2026-03-05', '2026-03-05'), '05/03 de 2026');
});
