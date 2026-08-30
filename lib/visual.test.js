import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colunas, faixasDaGrade, geometriaDoGrafico } from './visual.js';

// O defeito que este módulo existe para não ter é o desalinhamento: o OEE de
// março debaixo da barra de fevereiro. Ele não dá erro nenhum — sai um slide
// bonito, com a conta certa embaixo do mês errado, e só se enxerga projetado.

const serie = [
  { capacidade: 100, demanda: 50 },
  { capacidade: 200, demanda: 250 },
  { capacidade: 0,   demanda: 0 },
];

test('a coluna do gráfico e a da grade são a mesma coluna', () => {
  const g = geometriaDoGrafico({
    x: 0, y: 0, largura: 1000, altura: 200, serie, rotulo: 100,
  });
  const grade = colunas(0, 1000, serie.length, 100);
  assert.deepEqual(g.colunas.map((c) => c.centro), grade.map((c) => c.centro));
  // E a barra fica centrada na coluna dela, não encostada na borda.
  for (const b of g.barras) {
    assert.equal(b.x + b.largura / 2, g.colunas[b.i].centro);
  }
});

test('a calha da esquerda desloca o gráfico, e não só a grade', () => {
  // Se o gráfico ocupasse a largura toda, cada coluna ficaria deslocada da de
  // baixo pela largura da calha — o desalinhamento inteiro.
  const [primeira] = colunas(0, 1000, 10, 200);
  assert.equal(primeira.x, 200);
  assert.equal(primeira.largura, 80);
});

test('a escala é comum às duas séries', () => {
  // Escalas separadas fariam uma barra menor parecer maior que a linha — e a
  // distância entre as duas é a razão de ser do desenho.
  const g = geometriaDoGrafico({
    x: 0, y: 0, largura: 300, altura: 100, serie,
  });
  assert.equal(g.max, 250);
  // A demanda de 250 é o máximo: encosta no topo da área útil.
  assert.equal(g.pontos[1].y, g.base - 100 * (1 - 0.16));
  assert.equal(g.barras[1].altura, (200 / 250) * 100 * (1 - 0.16));
});

test('a folga do topo deixa o rótulo do valor caber', () => {
  const g = geometriaDoGrafico({
    x: 0, y: 10, largura: 300, altura: 100, serie: [{ capacidade: 5 }],
  });
  assert.ok(g.barras[0].y > 10, 'a barra mais alta não pode encostar no teto');
});

test('tudo zerado não vira divisão por zero', () => {
  // "Não há nada" tem que sair como barra de altura nenhuma, e não como NaN
  // — que no XML viraria uma forma que o PowerPoint recusa.
  const g = geometriaDoGrafico({
    x: 0, y: 0, largura: 300, altura: 100,
    serie: [{ capacidade: 0, demanda: 0 }, { capacidade: 0, demanda: 0 }],
  });
  assert.equal(g.max, 0);
  for (const b of g.barras) assert.equal(b.altura, 0);
  for (const p of g.pontos) assert.equal(p.y, g.base);
});

test('série vazia não gera coluna nenhuma', () => {
  const g = geometriaDoGrafico({ x: 0, y: 0, largura: 300, altura: 100, serie: [] });
  assert.deepEqual(g.colunas, []);
  assert.deepEqual(g.barras, []);
});

test('as faixas da grade têm todas a mesma altura', () => {
  // A linha do mês não é mais importante que a do terceiro turno; alturas
  // diferentes fariam parecer que é.
  const f = faixasDaGrade({ x: 0, y: 100, largura: 500, altura: 90, quantas: 3 });
  assert.deepEqual(f.map((r) => r.y), [100, 130, 160]);
  assert.deepEqual([...new Set(f.map((r) => r.altura))], [30]);
});
