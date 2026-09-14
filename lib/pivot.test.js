import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGREGACOES, achatar, agrega, chavesAteNivel, chavesComFilhos, leAgregacao,
  leNiveis, montarPivot,
} from './pivot.js';

// Dois CCs, três CTs, dois meses — CT × mês como a ocupação entrega.
const LINHAS = [
  { planta: 'Matriz', cc: '163', ct: '163-001', mes: '2027-01-01', disponivel: 100, demanda: 120 },
  { planta: 'Matriz', cc: '163', ct: '163-001', mes: '2027-02-01', disponivel: 100, demanda: 80 },
  { planta: 'Matriz', cc: '163', ct: '163-006', mes: '2027-01-01', disponivel: 300, demanda: 30 },
  { planta: 'Matriz', cc: '163', ct: '163-006', mes: '2027-02-01', disponivel: 300, demanda: 60 },
  { planta: 'Matriz', cc: '515', ct: '515-004', mes: '2027-01-01', disponivel: 50,  demanda: 100 },
  { planta: 'Matriz', cc: '515', ct: '515-004', mes: '2027-02-01', disponivel: 0,   demanda: 100 },
];

const OPCOES = {
  niveis: ['cc', 'ct', 'mes'],
  medidas: [{ campo: 'disponivel', fn: 'soma' }, { campo: 'demanda', fn: 'soma' }],
  razoes: [{ nome: 'ocupacao', num: 'demanda', den: 'disponivel' }],
};

test('agrega: soma, média, mediana par e ímpar, máximo, mínimo, contagem, vazio', () => {
  assert.equal(agrega([1, 2, 3, 10]), 16);
  assert.equal(agrega([1, 2, 3, 10], 'media'), 4);
  assert.equal(agrega([1, 2, 3, 10], 'mediana'), 2.5);
  assert.equal(agrega([1, 2, 3], 'mediana'), 2);
  assert.equal(agrega([1, 2, 3, 10], 'maximo'), 10);
  assert.equal(agrega([1, 2, 3, 10], 'minimo'), 1);
  assert.equal(agrega([1, 2, 3, 10], 'contagem'), 4);
  assert.equal(agrega([], 'media'), null);
  assert.equal(agrega([], 'contagem'), 0);
  assert.equal(agrega(['5', null, 'x'], 'soma'), 5);   // texto vira número; lixo vira zero
  assert.equal(AGREGACOES.length, 6);
});

test('a raiz é o total, os níveis empilham na ordem pedida e os filhos saem ordenados', () => {
  const raiz = montarPivot(LINHAS, OPCOES);
  assert.equal(raiz.n, 6);
  assert.equal(raiz.somas.disponivel, 850);
  assert.equal(raiz.somas.demanda, 490);
  assert.deepEqual(raiz.filhos.map((f) => f.valor), ['163', '515']);
  assert.deepEqual(raiz.filhos[0].filhos.map((f) => f.valor), ['163-001', '163-006']);
  assert.deepEqual(raiz.filhos[0].filhos[0].filhos.map((f) => f.valor),
                   ['2027-01-01', '2027-02-01']);
  assert.equal(raiz.filhos[0].filhos[0].campo, 'ct');
  assert.equal(raiz.filhos[0].filhos[0].nivel, 1);
  // Chave é o caminho: única na árvore mesmo com valores repetidos em ramos.
  assert.notEqual(raiz.filhos[0].filhos[0].filhos[0].chave,
                  raiz.filhos[1].filhos[0].filhos[0].chave);
  // Os campos de trabalho não vazam para a tela.
  assert.equal(raiz.linhas, undefined);
  assert.equal(raiz.indice, undefined);
});

test('a agregação é sobre as linhas do grão do grupo, não sobre os subtotais', () => {
  const raiz = montarPivot(LINHAS, {
    ...OPCOES,
    medidas: [{ campo: 'disponivel', fn: 'media' }, { campo: 'demanda', fn: 'maximo' }],
  });
  const cc163 = raiz.filhos[0];
  // Quatro linhas CT×mês: (100+100+300+300)/4 = 200 — e não a média dos dois
  // CTs (100 e 300) ponderada de outro jeito.
  assert.equal(cc163.medidas.disponivel, 200);
  assert.equal(cc163.medidas.demanda, 120);
  assert.equal(cc163.n, 4);
  // A soma continua disponível ao lado, seja qual for a função.
  assert.equal(cc163.somas.disponivel, 800);
});

test('a razão é sempre soma sobre soma, e nula quando o denominador é zero', () => {
  const raiz = montarPivot(LINHAS, {
    ...OPCOES,
    medidas: [{ campo: 'disponivel', fn: 'mediana' }, { campo: 'demanda', fn: 'minimo' }],
  });
  const cc163 = raiz.filhos[0];
  assert.ok(Math.abs(cc163.razoes.ocupacao - 290 / 800) < 1e-12);
  const fev515 = raiz.filhos[1].filhos[0].filhos[1];
  assert.equal(fev515.razoes.ocupacao, null);
  assert.ok(Math.abs(raiz.razoes.ocupacao - 490 / 850) < 1e-12);
});

test('ordem dos níveis muda a árvore: mês primeiro agrupa os CTs dentro do mês', () => {
  const raiz = montarPivot(LINHAS, { ...OPCOES, niveis: ['mes', 'cc'] });
  assert.deepEqual(raiz.filhos.map((f) => f.valor), ['2027-01-01', '2027-02-01']);
  assert.deepEqual(raiz.filhos[0].filhos.map((f) => f.valor), ['163', '515']);
  assert.equal(raiz.filhos[0].somas.disponivel, 450);
});

test('sem nível nenhum sobra só o total', () => {
  const raiz = montarPivot(LINHAS, { ...OPCOES, niveis: [] });
  assert.equal(raiz.filhos.length, 0);
  assert.equal(raiz.somas.demanda, 490);
});

test('achatar respeita o que está aberto; a raiz sai sempre', () => {
  const raiz = montarPivot(LINHAS, OPCOES);
  const fechado = achatar(raiz, new Set());
  assert.deepEqual(fechado.map((l) => [l.no.valor, l.profundidade, l.temFilhos, l.aberto]), [
    [null, 0, true, true], ['163', 1, true, false], ['515', 1, true, false],
  ]);
  const aberto = achatar(raiz, new Set([raiz.filhos[0].chave]));
  assert.deepEqual(aberto.map((l) => l.no.valor),
                   [null, '163', '163-001', '163-006', '515']);
  // Folha não tem filhos e não oferece botão.
  const tudo = achatar(raiz, chavesComFilhos(raiz));
  assert.equal(tudo.length, 1 + 2 + 3 + 6);
  assert.equal(tudo.filter((l) => !l.temFilhos).length, 6);
});

test('expandir até um nível abre só o que está acima dele', () => {
  const raiz = montarPivot(LINHAS, OPCOES);
  assert.equal(chavesAteNivel(raiz, 1).size, 0);          // só os CCs à vista
  assert.equal(chavesAteNivel(raiz, 2).size, 2);          // CCs abertos: CTs à vista
  assert.equal(chavesAteNivel(raiz, 3).size, 2 + 3);      // CTs abertos: meses à vista
  assert.equal(chavesComFilhos(raiz).size, 5);
});

test('lê níveis e agregação da URL, ignorando o que não existe', () => {
  const campos = ['planta', 'cc', 'ct', 'mes'];
  assert.deepEqual(leNiveis('cc,ct', campos, ['planta']), ['cc', 'ct']);
  assert.deepEqual(leNiveis('cc, xx ,cc,mes', campos, ['planta']), ['cc', 'mes']);
  assert.deepEqual(leNiveis('', campos, ['planta', 'cc']), ['planta', 'cc']);
  assert.deepEqual(leNiveis(undefined, campos, ['cc']), ['cc']);
  assert.equal(leAgregacao('media'), 'media');
  assert.equal(leAgregacao('raiz quadrada'), 'soma');
  assert.equal(leAgregacao(undefined), 'soma');
});
