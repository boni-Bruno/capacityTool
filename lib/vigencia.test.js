import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planejar } from './vigencia-plano.js';

// planejar() é o miolo da camada de vigência: decide se abre, fecha ou
// substitui. Errar aqui reescreve histórico em silêncio — que é exatamente o
// tipo de falha que este projeto não aceita. Por isso testa sem banco.
//
// Datas vêm do Postgres como texto 'YYYY-MM-DD' (o ::text nas consultas),
// então comparar com < e > já é comparar cronologicamente.

const linha = (id, inicio, fim = null) => ({ id, inicio, fim });

test('sem linha nenhuma, só insere', () => {
  const p = planejar([], '2026-03-01');
  assert.equal(p.acao, 'inserir');
  assert.equal(p.alvo, null);
});

test('linha aberta valendo: fecha na data nova e abre outra', () => {
  const p = planejar([linha(7, '2026-01-01')], '2026-03-01');
  assert.equal(p.acao, 'fechar');
  assert.equal(p.alvo.id, 7);
});

test('linha começando na MESMA data é substituída, não fechada', () => {
  // Fechar geraria daterange('2026-03-01','2026-03-01') = vazio.
  // Como o início é o mesmo, nenhum período passado muda de valor.
  const p = planejar([linha(7, '2026-03-01')], '2026-03-01');
  assert.equal(p.acao, 'substituir');
  assert.equal(p.alvo.id, 7);
});

test('linha futura no caminho: recusa em vez de deixar o banco estourar', () => {
  const p = planejar([linha(7, '2026-01-01', '2026-06-01'), linha(8, '2026-06-01')],
                     '2026-03-01', 'horário');
  assert.ok(p.erro);
  assert.match(p.erro, /2026-06-01/);
  assert.equal(p.acao, undefined);
});

test('linha já encerrada antes da data não é tocada', () => {
  const p = planejar([linha(7, '2026-01-01', '2026-02-01')], '2026-03-01');
  assert.equal(p.acao, 'inserir');
});

test('fim é exclusivo: linha que termina exatamente na data não vale mais', () => {
  // daterange [) — '2026-03-01' já está fora de [2026-01-01, 2026-03-01)
  const p = planejar([linha(7, '2026-01-01', '2026-03-01')], '2026-03-01');
  assert.equal(p.acao, 'inserir');
});

test('histórico com várias faixas pega a que vale, não a primeira', () => {
  const p = planejar(
    [linha(1, '2025-01-01', '2025-07-01'),
     linha(2, '2025-07-01', '2026-01-01'),
     linha(3, '2026-01-01')],
    '2026-03-01'
  );
  assert.equal(p.acao, 'fechar');
  assert.equal(p.alvo.id, 3);
});

test('data anterior a todo o histórico é recusada como futura', () => {
  // Abrir vigência antes da primeira linha existente reescreveria o passado
  // por baixo. Tem que barrar.
  const p = planejar([linha(1, '2026-01-01')], '2025-06-01', 'horário');
  assert.ok(p.erro);
  assert.match(p.erro, /2026-01-01/);
});
