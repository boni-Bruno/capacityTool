import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classificar, condicaoCasa, podeSerCondicao, previa, primeiraQueCasa, regraCasa,
} from './regras.js';

// O motor que decide como a demanda é rotulada. Errar aqui não dá erro em lugar
// nenhum: reclassifica um pedaço da base e o painel passa a mostrar outro
// número, com a mesma cara de certo.

const c = (atributo, operador, valor, bloco = 1) =>
  ({ atributo, operador, valor, bloco });

const regra = (id, rotulo, condicoes, extra = {}) =>
  ({ id, atributo: 'linha', rotulo, ordem: id, condicoes, ...extra });

const LINHA = {
  grupo_estoque: 'PRODUTOS EM ELABORACAO',
  nivel_estoque: 'TECIDO CRU',
  linha_produto_agrupada: 'TECIDO CRU FELPUDO',
  familia_tecelagem: '225',
  um: 'M',
  ct: '515-004',
};

// --- condições -------------------------------------------------------------

test('igualdade ignora acento e caixa', () => {
  assert.equal(condicaoCasa(c('um', '=', 'm'), LINHA), true);
  assert.equal(condicaoCasa(c('linha_produto_agrupada', '=', 'tecido cru felpudo'),
    LINHA), true);
  assert.equal(condicaoCasa(c('nivel_estoque', '=', 'Tecido Cru'), LINHA), true);
});

test('contém e começa com fazem o que dizem', () => {
  assert.equal(condicaoCasa(c('linha_produto_agrupada', 'CONTEM', 'FELPUDO'), LINHA), true);
  assert.equal(condicaoCasa(c('linha_produto_agrupada', 'COMECA', 'TECIDO'), LINHA), true);
  assert.equal(condicaoCasa(c('linha_produto_agrupada', 'COMECA', 'FELPUDO'), LINHA), false);
});

test('vazio é vazio, e nulo não é igual a nada', () => {
  const sem = { ...LINHA, familia_tecelagem: null };
  assert.equal(condicaoCasa(c('familia_tecelagem', 'VAZIO', null), sem), true);
  assert.equal(condicaoCasa(c('familia_tecelagem', '=', '225'), sem), false);
  // Mas "não é" continua verdadeiro para o vazio: ele de fato não é 225.
  assert.equal(condicaoCasa(c('familia_tecelagem', '<>', '225'), sem), true);
});

test('string vazia conta como vazio, igual ao nulo', () => {
  const sem = { ...LINHA, familia_tecelagem: '   ' };
  assert.equal(condicaoCasa(c('familia_tecelagem', 'VAZIO', null), sem), true);
});

// --- blocos: E dentro, OU entre -------------------------------------------

test('duas condições no mesmo bloco são E', () => {
  const r = regra(1, 'Banho Jacquard', [
    c('linha_produto_agrupada', '=', 'TECIDO CRU FELPUDO'),
    c('familia_tecelagem', '=', '225'),
  ]);
  assert.equal(regraCasa(r, LINHA), true);
  assert.equal(regraCasa(r, { ...LINHA, familia_tecelagem: '228' }), false);
});

test('blocos diferentes são OU', () => {
  const r = regra(1, 'Banho Jacquard', [
    c('linha_produto_agrupada', '=', 'TECIDO CRU FELPUDO', 1),
    c('familia_tecelagem', '=', '225', 1),
    c('ct', '=', '515-016', 2),
  ]);
  assert.equal(regraCasa(r, { ...LINHA, familia_tecelagem: '228' }), false);
  assert.equal(regraCasa(r, { ...LINHA, familia_tecelagem: '228', ct: '515-016' }), true);
});

test('regra sem condição não casa com nada', () => {
  // Ler isso como "pega tudo" reclassificaria a base inteira sem ninguém notar.
  assert.equal(regraCasa(regra(1, 'Tudo', []), LINHA), false);
});

// --- ordem ----------------------------------------------------------------

test('a primeira que casa ganha, pela ordem cadastrada', () => {
  const regras = [
    { ...regra(2, 'Genérica', [c('linha_produto_agrupada', 'CONTEM', 'FELPUDO')]), ordem: 2 },
    { ...regra(1, 'Específica', [c('familia_tecelagem', '=', '225')]), ordem: 1 },
  ];
  assert.equal(primeiraQueCasa(regras, LINHA).rotulo, 'Específica');
});

test('empate de ordem desempata pelo id, não pelo acaso', () => {
  const regras = [
    { ...regra(9, 'B', [c('um', '=', 'M')]), ordem: 1 },
    { ...regra(3, 'A', [c('um', '=', 'M')]), ordem: 1 },
  ];
  assert.equal(primeiraQueCasa(regras, LINHA).rotulo, 'A');
});

test('regra desativada não entra', () => {
  const regras = [regra(1, 'Desligada', [c('um', '=', 'M')], { ativa: false })];
  assert.equal(primeiraQueCasa(regras, LINHA), null);
});

// --- níveis ---------------------------------------------------------------

test('nível 2 enxerga o rótulo produzido no nível 1', () => {
  const atributos = [
    { codigo: 'linha', nome: 'Linha', nivel: 1 },
    { codigo: 'familia', nome: 'Família', nivel: 2 },
  ];
  const regras = [
    { id: 1, atributo: 'linha', rotulo: 'Banho', ordem: 1,
      condicoes: [c('familia_tecelagem', '=', '225')] },
    { id: 2, atributo: 'familia', rotulo: 'Cama e Banho', ordem: 1,
      condicoes: [c('linha', '=', 'Banho')] },
  ];
  const r = classificar(LINHA, atributos, regras);
  assert.equal(r.linha, 'Banho');
  assert.equal(r.familia, 'Cama e Banho');
});

test('atributo sem regra que case fica nulo, e a linha não some', () => {
  const atributos = [{ codigo: 'linha', nome: 'Linha', nivel: 1 }];
  const regras = [{ id: 1, atributo: 'linha', rotulo: 'X', ordem: 1,
                    condicoes: [c('um', '=', 'KG')] }];
  const r = classificar(LINHA, atributos, regras);
  assert.equal(r.linha, null);
  assert.equal(r.linha_produto_agrupada, 'TECIDO CRU FELPUDO');
});

test('ciclo é impossível: derivado só enxerga nível menor', () => {
  const atributos = [
    { codigo: 'linha', nivel: 1 },
    { codigo: 'familia', nivel: 2 },
  ];
  assert.equal(podeSerCondicao('linha', 'familia', atributos), true);
  assert.equal(podeSerCondicao('familia', 'linha', atributos), false);
  assert.equal(podeSerCondicao('linha', 'linha', atributos), false);
  assert.equal(podeSerCondicao('ct', 'linha', atributos), true);
});

// --- prévia ---------------------------------------------------------------

const COMBINACOES = [
  { ...LINHA, linhas: 2278, minutos: 7713900 },                       // cru + 225
  { ...LINHA, familia_tecelagem: '228', linhas: 2982, minutos: 23296500 },
  { ...LINHA, linha_produto_agrupada: 'BANHO', linhas: 900, minutos: 2352060 },
];

test('a prévia mede a regra com as duas condições', () => {
  const atributos = [{ codigo: 'linha', nivel: 1 }];
  const regras = [{ id: 1, atributo: 'linha', rotulo: 'Banho Jacquard', ordem: 1,
    condicoes: [
      c('linha_produto_agrupada', '=', 'TECIDO CRU FELPUDO'),
      c('familia_tecelagem', '=', '225'),
    ] }];
  const p = previa(COMBINACOES, atributos, regras, 'linha');
  assert.equal(p.porRegra[0].linhas, 2278);
  assert.equal(p.porRegra[0].minutos, 7713900);
  assert.equal(p.semRegra.linhas, 3882);
});

test('sem o E, a mesma regra pega cinco vezes mais', () => {
  // É a diferença que a prévia existe para mostrar: 651.218 h contra 128.565 no
  // caso real. Aqui, em escala: 2.278 linhas contra 5.260.
  const atributos = [{ codigo: 'linha', nivel: 1 }];
  const regras = [{ id: 1, atributo: 'linha', rotulo: 'Banho Jacquard', ordem: 1,
    condicoes: [c('linha_produto_agrupada', '=', 'TECIDO CRU FELPUDO')] }];
  const p = previa(COMBINACOES, atributos, regras, 'linha');
  assert.equal(p.porRegra[0].linhas, 2278 + 2982);
});

test('só a família 225 leva BANHO junto, que é o outro jeito de errar', () => {
  const atributos = [{ codigo: 'linha', nivel: 1 }];
  const regras = [{ id: 1, atributo: 'linha', rotulo: 'Banho Jacquard', ordem: 1,
    condicoes: [c('familia_tecelagem', '=', '225')] }];
  const p = previa(COMBINACOES, atributos, regras, 'linha');
  assert.equal(p.porRegra[0].linhas, 2278 + 900);
});

test('regra que não pega nada aparece com zero, não some', () => {
  const atributos = [{ codigo: 'linha', nivel: 1 }];
  const regras = [{ id: 1, atributo: 'linha', rotulo: 'Nunca', ordem: 1,
    condicoes: [c('um', '=', 'PAR')] }];
  const p = previa(COMBINACOES, atributos, regras, 'linha');
  assert.equal(p.porRegra.length, 1);
  assert.equal(p.porRegra[0].linhas, 0);
});

test('agrupar soma os rótulos iguais de regras diferentes', () => {
  const atributos = [{ codigo: 'linha', nivel: 1 }];
  const regras = [
    { id: 1, atributo: 'linha', rotulo: 'Preparação', ordem: 1,
      condicoes: [c('familia_tecelagem', '=', '225')] },
    { id: 2, atributo: 'linha', rotulo: 'Preparação', ordem: 2,
      condicoes: [c('familia_tecelagem', '=', '228')] },
  ];
  const p = previa(COMBINACOES, atributos, regras, 'linha');
  assert.equal(p.porRotulo.length, 1);
  assert.equal(p.porRotulo[0].rotulo, 'Preparação');
  assert.equal(p.porRotulo[0].linhas, 2278 + 2982 + 900);
});
