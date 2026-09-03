import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  colunaTotal, colunas, escalaY, faixasDaGrade, geometriaDoGrafico,
} from './visual.js';

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

test('a capacidade é a linha, a demanda é a barra', () => {
  // Invertido, o desenho diz que a demanda é o contínuo e a capacidade o
  // discreto — o contrário do que a fábrica é. E o número sairia trocado sem
  // nada denunciar: as duas séries são minutos.
  const g = geometriaDoGrafico({ x: 0, y: 0, largura: 300, altura: 100, serie });
  assert.deepEqual(g.barras.map((b) => b.valor), [50, 250, 0]);
  assert.deepEqual(g.pontos.map((p) => p.valor), [100, 200, 0]);
});

test('a escala é comum às duas séries', () => {
  // Escalas separadas fariam uma barra menor parecer maior que a linha — e a
  // distância entre as duas é a razão de ser do desenho.
  const g = geometriaDoGrafico({
    x: 0, y: 0, largura: 300, altura: 100, serie,
  });
  assert.equal(g.max, 250);
  // A demanda de 250 é o máximo: encosta no topo da área útil.
  assert.equal(g.barras[1].altura, 100 * (1 - 0.10));
  assert.equal(g.base - g.pontos[1].y, (200 / 250) * 100 * (1 - 0.10));
});

test('a área fecha pela base, e não pelo topo', () => {
  // Fechada pelo topo ela pintaria o vazio acima da linha — o contrário do que
  // "capacidade" quer dizer num gráfico.
  const g = geometriaDoGrafico({ x: 0, y: 0, largura: 300, altura: 100, serie });
  assert.equal(g.poligono.length, g.pontos.length + 2);
  assert.equal(g.poligono[0].y, g.base);
  assert.equal(g.poligono.at(-1).y, g.base);
  assert.equal(g.poligono[0].x, g.pontos[0].x);
});

test('a folga do topo impede o pico de encostar no teto', () => {
  const g = geometriaDoGrafico({
    x: 0, y: 10, largura: 300, altura: 100, serie: [{ capacidade: 5 }],
  });
  assert.ok(g.pontos[0].y > 10, 'o ponto mais alto não pode tocar o teto');
});

test('a coluna do total fica fora das colunas de mês', () => {
  // Deixá-la entrar na divisão faria as doze barras encolherem para caber um
  // treze que não existe no gráfico.
  const cols = colunas(0, 1000, 12, 140, 120);
  const t = colunaTotal(0, 1000, 120);
  assert.equal(cols[0].x, 140);
  // Com folga de ponto flutuante: doze divisoes de 1/12 nao fecham exatas, e um
  // teste que exige igualdade binaria aqui reprova por aritmetica, nao por erro.
  assert.ok(Math.abs((cols[11].x + cols[11].largura) - 880) < 1e-6);
  assert.equal(t.x, 880);
  assert.equal(t.largura, 120);
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
  assert.deepEqual(g.poligono, []);
});

// --- a escala do eixo ------------------------------------------------------

test('o eixo termina num número redondo, e não no máximo cru', () => {
  // Terminar em 43.441 daria marcas em 8.688,2 — o olho para para decifrar em
  // vez de comparar.
  const e = escalaY(43441);
  assert.deepEqual(e.marcas, [0, 10000, 20000, 30000, 40000, 50000]);
  assert.equal(e.teto, 50000);
});

test('o teto nunca fica abaixo do maior valor', () => {
  // Se ficasse, a barra maior sairia por fora da área de desenho.
  for (const v of [1, 7, 99, 1234, 43441, 1e6, 3.3]) {
    assert.ok(escalaY(v).teto >= v, `${v} não coube em ${escalaY(v).teto}`);
  }
});

test('escala de zero não vira divisão por zero nem marca infinita', () => {
  assert.deepEqual(escalaY(0), { teto: 0, passo: 0, marcas: [0] });
  assert.deepEqual(escalaY(-5).marcas, [0]);
});

test('com teto, a barra bate com a linha de grade', () => {
  // É o ponto de existir teto: a marca de 30.000 do eixo tem que passar pelo
  // topo de uma barra de 30.000.
  const g = geometriaDoGrafico({
    x: 0, y: 0, largura: 300, altura: 100, teto: 50000,
    serie: [{ capacidade: 50000, demanda: 25000 }],
  });
  assert.equal(g.barras[0].altura, 50);
  assert.equal(g.pontos[0].y, g.topo);
  assert.equal(g.yDe(25000), g.base - 50);
});

test('as faixas da grade têm todas a mesma altura', () => {
  // A linha do mês não é mais importante que a do terceiro turno; alturas
  // diferentes fariam parecer que é.
  const f = faixasDaGrade({ x: 0, y: 100, largura: 500, altura: 90, quantas: 3 });
  assert.deepEqual(f.map((r) => r.y), [100, 130, 160]);
  assert.deepEqual([...new Set(f.map((r) => r.altura))], [30]);
});

test('o respiro entre blocos sai do total, e não estica a grade', () => {
  // Se a folga fosse somada depois de dividir, a última linha cairia fora da
  // altura pedida — no slide isso quer dizer por cima do rodapé com o logotipo.
  const f = faixasDaGrade({
    x: 0, y: 100, largura: 500, altura: 90, quantas: 3,
    quebras: [2], folga: 6,
  });

  assert.deepEqual([...new Set(f.map((r) => r.altura))], [28]);
  assert.deepEqual(f.map((r) => r.y), [100, 128, 162]);

  const fim = f[2].y + f[2].altura;
  assert.equal(fim, 190, 'a grade termina onde terminaria sem folga');
});

test('quebra na primeira linha ou fora da faixa é ignorada', () => {
  // Antes da primeira linha não há bloco anterior de quem se separar, e um
  // índice além do fim abriria um buraco que empurraria tudo para cima.
  const f = faixasDaGrade({
    x: 0, y: 0, largura: 10, altura: 90, quantas: 3,
    quebras: [0, 3, 99], folga: 6,
  });
  assert.deepEqual(f.map((r) => r.y), [0, 30, 60]);
});
