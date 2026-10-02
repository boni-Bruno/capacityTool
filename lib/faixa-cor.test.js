import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contrasteComBranco, contrasteEntre, corDaOcupacao, corFraca,
  corFracaNoEscuro, estiloDaOcupacao, faixaDe, normalizaCor, rotuloFaixa,
  validaFaixas,
} from './faixa-cor.js';

// A cor existe para o mês problemático saltar antes de alguém terminar de ler a
// linha. Cor no mês errado é pior que cor nenhuma: ela dirige o olho para o
// lugar errado com a autoridade de quem sabe.

const FAIXAS = [
  { pct_de: null, pct_ate: 85, cor: '#2E7D32' },
  { pct_de: 85, pct_ate: 100, cor: '#F9A825' },
  { pct_de: 100, pct_ate: null, cor: '#C62828' },
];

// --- em que faixa cai ------------------------------------------------------

test('a borda pertence à faixa de cima, e não à de baixo', () => {
  // "85 a 100" e "100 a 115" se encostam sem se sobrepor, e 100% cai na
  // segunda — que é como se lê "de 100 em diante".
  assert.equal(corDaOcupacao(FAIXAS, 84.9), '#2E7D32');
  assert.equal(corDaOcupacao(FAIXAS, 85), '#F9A825');
  assert.equal(corDaOcupacao(FAIXAS, 99.99), '#F9A825');
  assert.equal(corDaOcupacao(FAIXAS, 100), '#C62828');
});

test('ponta nula é infinito daquele lado', () => {
  assert.equal(corDaOcupacao(FAIXAS, 0), '#2E7D32');
  assert.equal(corDaOcupacao(FAIXAS, 999), '#C62828');
});

test('valor fora de toda faixa sai sem cor, e isso é resposta', () => {
  // Obrigar a cobrir de zero a infinito forçaria a inventar uma cor para o que
  // não interessa.
  const so = [{ pct_de: 100, pct_ate: null, cor: '#C62828' }];
  assert.equal(corDaOcupacao(so, 40), null);
  assert.equal(faixaDe(so, 40), null);
});

test('ocupação nula não pinta nada', () => {
  // Sem capacidade a ocupação é nula, e não zero. Pintar de verde diria "sobra
  // tudo" para um CT que não tem nada onde caber.
  assert.equal(corDaOcupacao(FAIXAS, null), null);
  assert.equal(corDaOcupacao(FAIXAS, undefined), null);
});

test('sem faixa cadastrada nada é pintado', () => {
  assert.equal(corDaOcupacao([], 90), null);
  assert.equal(corDaOcupacao(null, 90), null);
});

// --- a cor -----------------------------------------------------------------

test('a forma curta do HTML é aceita, como em qualquer outro lugar', () => {
  assert.equal(normalizaCor('#c00'), '#CC0000');
  assert.equal(normalizaCor('2e7d32'), '#2E7D32');
  assert.equal(normalizaCor('  #2e7d32 '), '#2E7D32');
});

test('o que não é cor vira nulo, e não uma cor errada', () => {
  for (const v of ['vermelho', '#12345', '', null, '#gggggg']) {
    assert.equal(normalizaCor(v), null, `${v} deveria ser nulo`);
  }
});

test('cor clara demais é apontada antes de virar número ilegível', () => {
  // A cor pinta o número, não o fundo: amarelo claro sobre branco some, e some
  // num slide projetado, onde ninguém vai conferir.
  assert.equal(corFraca('#FFFF00'), true, 'amarelo puro some no branco');
  assert.equal(corFraca('#F9A825'), true, 'âmbar também');
  assert.equal(corFraca('#C62828'), false);
  assert.equal(corFraca('#2E7D32'), false);
  assert.equal(corFraca('#000000'), false);
  // Sem cor não há aviso a dar.
  assert.equal(corFraca('nada'), false);
  assert.equal(contrasteComBranco('nada'), null);
  assert.ok(contrasteComBranco('#000000') > 20);
});

test('a mesma cor e perguntada para os DOIS fundos em que ela vai cair', () => {
  // Desde que o painel da ocupação passou a pintar pela régua cadastrada, a
  // escolha boa para o slide branco pode sumir no painel escuro — e o
  // contrário. Preto se lê no slide e não no painel; amarelo, o inverso.
  assert.equal(corFraca('#000000'), false);
  assert.equal(corFracaNoEscuro('#000000'), true);
  assert.equal(corFraca('#FFFF00'), true);
  assert.equal(corFracaNoEscuro('#FFFF00'), false);
  assert.equal(corFracaNoEscuro('nada'), false);
});

test('o contraste nao depende da ordem das duas cores', () => {
  assert.equal(contrasteEntre('#000000', '#FFFFFF'),
               contrasteEntre('#FFFFFF', '#000000'));
  assert.equal(contrasteEntre('#123456', '#123456'), 1);
  assert.equal(contrasteEntre('#123456', 'nada'), null);
});

// --- o estilo que as telas aplicam -----------------------------------------

test('a tela pinta pela faixa, e sem faixa nao pinta nada', () => {
  assert.deepEqual(estiloDaOcupacao(FAIXAS, 120),
                   { className: 'ocup-cor', style: { color: '#C62828' } });
  // Fora de toda faixa: sem cor, e sem classe que mude o peso da fonte.
  const so = [{ pct_de: 100, pct_ate: null, cor: '#C62828' }];
  assert.deepEqual(estiloDaOcupacao(so, 40), { className: '', style: undefined });
  assert.deepEqual(estiloDaOcupacao([], 90), { className: '', style: undefined });
});

test('a ocupacao infinita cai na faixa aberta no topo', () => {
  // Demanda sem capacidade nenhuma vale Infinity (lib/ocupacao.js). Ela tem que
  // pintar como qualquer estouro — e, se a régua não tiver faixa aberta no fim,
  // ficar sem cor como qualquer valor fora de faixa.
  assert.equal(corDaOcupacao(FAIXAS, Infinity), '#C62828');
  const fechadas = [{ pct_de: 0, pct_ate: 150, cor: '#C62828' }];
  assert.equal(corDaOcupacao(fechadas, Infinity), null);
});

test('ocupacao nula e cinza, e nao uma faixa qualquer', () => {
  // Sem capacidade no período não existe ocupação — pintar de verde diria
  // "folgado" sobre uma conta que não foi feita.
  assert.equal(estiloDaOcupacao(FAIXAS, null).className, 'muted');
  assert.equal(estiloDaOcupacao(FAIXAS, undefined).className, 'muted');
});

// --- validar ---------------------------------------------------------------

test('faixa que termina antes de começar é recusada com a frase', () => {
  const r = validaFaixas([{ pct_de: 100, pct_ate: 80, cor: '#000' }]);
  assert.match(r.erro, /termina antes de começar/);
});

test('sobreposição é recusada aqui, e não por erro de constraint', () => {
  // O banco também recusa, mas descobrir por lá entrega ao usuário uma frase em
  // inglês sobre um índice gist.
  const r = validaFaixas([
    { pct_de: 0, pct_ate: 90, cor: '#0a0' },
    { pct_de: 85, pct_ate: 100, cor: '#a00' },
  ]);
  assert.match(r.erro, /duas cores/);
});

test('faixas encostadas não são sobreposição', () => {
  const r = validaFaixas([
    { pct_de: 0, pct_ate: 85, cor: '#0a0' },
    { pct_de: 85, pct_ate: 100, cor: '#fa0' },
    { pct_de: 100, pct_ate: null, cor: '#a00' },
  ]);
  assert.equal(r.erro, undefined);
  assert.equal(r.faixas.length, 3);
});

test('buraco entre faixas passa: é escolha, não erro', () => {
  const r = validaFaixas([
    { pct_de: 0, pct_ate: 50, cor: '#0a0' },
    { pct_de: 90, pct_ate: null, cor: '#a00' },
  ]);
  assert.equal(r.erro, undefined);
});

test('faixa sem cor é recusada, porque cor é o ponto', () => {
  const r = validaFaixas([{ pct_de: 0, pct_ate: 85, cor: '' }]);
  assert.match(r.erro, /precisa de uma cor/);
});

test('linha totalmente em branco é ignorada, e não recusada', () => {
  // A tela mostra uma linha vazia para preencher; sair dela sem digitar nada
  // não pode virar erro.
  const r = validaFaixas([
    { pct_de: '', pct_ate: '', cor: '' },
    { pct_de: 0, pct_ate: 85, cor: '#0a0' },
  ]);
  assert.equal(r.erro, undefined);
  assert.equal(r.faixas.length, 1);
});

test('as faixas voltam ordenadas pelo início', () => {
  // A tela sai sempre na mesma ordem, e a conferência de sobreposição vira uma
  // passada só.
  const r = validaFaixas([
    { pct_de: 100, pct_ate: null, cor: '#a00' },
    { pct_de: 0, pct_ate: 85, cor: '#0a0' },
    { pct_de: 85, pct_ate: 100, cor: '#fa0' },
  ]);
  assert.deepEqual(r.faixas.map((f) => f.pct_de), [0, 85, 100]);
});

test('o rótulo da faixa se lê como alguém falaria', () => {
  assert.equal(rotuloFaixa({ pct_de: 85, pct_ate: 100 }), '85% a 100%');
  assert.equal(rotuloFaixa({ pct_de: 100, pct_ate: null }), '100% ou mais');
  assert.equal(rotuloFaixa({ pct_de: null, pct_ate: 85 }), 'até 85%');
});
