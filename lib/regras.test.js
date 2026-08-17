import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  camposUsados, classificar, condicaoCasa, fatiasDoRotulo, podeSerCondicao,
  previa, primeiraQueCasa, regraCasa, rotulosDe,
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

// --- o rateio -------------------------------------------------------------
//
// A capacidade é do recurso e o atributo é da linha. Errar o rateio faz a soma
// dos rótulos não fechar com o total, que é a única propriedade que torna o
// número confiável.

const MES = '2026-03-01';
const DOIS_PRODUTOS = [
  { ...LINHA, ct: '515-004', mes: MES, minutos: 600, metros: 1200, qtd: 2400 },
  { ...LINHA, ct: '515-004', mes: MES, familia_tecelagem: '228',
    minutos: 400, metros: 400, qtd: 400 },
  { ...LINHA, ct: '401-003', mes: MES, familia_tecelagem: '228',
    minutos: 900, metros: 900, qtd: 900 },
];
const ATTR = [{ codigo: 'linha', nivel: 1 }];
const REGRAS = [
  { id: 1, atributo: 'linha', rotulo: 'Banho', ordem: 1,
    condicoes: [c('familia_tecelagem', '=', '225')] },
  { id: 2, atributo: 'linha', rotulo: 'Cama', ordem: 2,
    condicoes: [c('familia_tecelagem', '=', '228')] },
];

test('a fatia é a parte do tempo daquele CT naquele mês', () => {
  const f = fatiasDoRotulo(DOIS_PRODUTOS, ATTR, REGRAS, 'linha', 'Banho');
  assert.equal(f.length, 1);
  assert.equal(f[0].ct, '515-004');
  assert.equal(f[0].fatia, 0.6);
});

test('as fatias de um CT somam 1 — é o que faz o total fechar', () => {
  const soma = ['Banho', 'Cama']
    .flatMap((r) => fatiasDoRotulo(DOIS_PRODUTOS, ATTR, REGRAS, 'linha', r))
    .filter((f) => f.ct === '515-004')
    .reduce((s, f) => s + f.fatia, 0);
  assert.equal(soma, 1);
});

test('CT sem nada do rótulo não aparece, e por isso sai do painel', () => {
  const f = fatiasDoRotulo(DOIS_PRODUTOS, ATTR, REGRAS, 'linha', 'Banho');
  assert.equal(f.some((x) => x.ct === '401-003'), false);
});

test('o índice é o do rótulo, não a média do CT', () => {
  // O CT inteiro faz 1.600 m em 1.000 min = 1,6 m/min. O Banho sozinho faz
  // 1.200 m em 600 min = 2,0. Usar a média do CT daria 20% a menos de metro.
  const f = fatiasDoRotulo(DOIS_PRODUTOS, ATTR, REGRAS, 'linha', 'Banho');
  assert.equal(f[0].metros_por_min, 2);
  assert.equal(f[0].qtd_por_min, 4);
});

test('o mês separa: o mesmo CT muda de mistura', () => {
  const abril = DOIS_PRODUTOS.map((x) => ({ ...x, mes: '2026-04-01' }))
    .filter((x) => x.familia_tecelagem === '228');
  const f = fatiasDoRotulo([...DOIS_PRODUTOS, ...abril], ATTR, REGRAS, 'linha', 'Banho');
  assert.equal(f.length, 1);
  assert.equal(f[0].mes, MES);
});

test('rótulo sem metro na base sai com índice nulo, para cair no do CT', () => {
  const sem = [{ ...LINHA, ct: '515-004', mes: MES, minutos: 600, metros: 0, qtd: 0 }];
  const f = fatiasDoRotulo(sem, ATTR, REGRAS, 'linha', 'Banho');
  assert.equal(f[0].metros_por_min, null);
});

test('campos usados: só o que as regras leem vai para o group by', () => {
  assert.deepEqual(camposUsados(REGRAS), ['familia_tecelagem']);
});

test('os rótulos de um atributo não repetem e pulam os desativados', () => {
  const regras = [...REGRAS,
    { id: 3, atributo: 'linha', rotulo: 'Banho', ordem: 3, condicoes: [] },
    { id: 4, atributo: 'linha', rotulo: 'Oculto', ordem: 4, ativa: false, condicoes: [] }];
  assert.deepEqual(rotulosDe(regras, 'linha'), ['Banho', 'Cama']);
});
