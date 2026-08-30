import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARCA, acharSlideMarcado, costura, linhasDasSecoes, preencheSlide, slidesDo,
} from './pptx.js';

// O modelo é do Bruno — cores, fontes, logotipo. Preencher errado aqui não dá
// erro: entrega um .pptx que abre com o texto no slide errado, ou sem a cara do
// modelo, e isso só se descobre projetando na reunião.

const slide = (texto) => `<?xml version="1.0"?>
<p:sld><p:cSld><p:spTree>
  <p:sp><p:txBody>
    <a:p><a:pPr algn="l"/><a:r><a:rPr lang="pt-BR" sz="1400"/><a:t>${texto}</a:t></a:r></a:p>
  </p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

// --- achar o slide ---------------------------------------------------------

test('os slides saem na ordem do número, e não na do alfabeto', () => {
  // Sem isto slide10 viria antes de slide2, e "o primeiro slide" seria outro.
  const arq = new Map([
    ['ppt/slides/slide10.xml', ''], ['ppt/slides/slide2.xml', ''],
    ['ppt/slides/slide1.xml', ''], ['ppt/presentation.xml', ''],
  ]);
  assert.deepEqual(slidesDo(arq), [
    'ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide10.xml',
  ]);
});

test('acha a marca em qualquer slide, não só no primeiro', () => {
  const arq = new Map([
    ['ppt/slides/slide1.xml', slide('Capa')],
    ['ppt/slides/slide2.xml', slide(MARCA)],
  ]);
  assert.equal(acharSlideMarcado(arq), 'ppt/slides/slide2.xml');
});

test('modelo sem marca devolve nulo, para a tela poder dizer isso', () => {
  const arq = new Map([['ppt/slides/slide1.xml', slide('Capa')]]);
  assert.equal(acharSlideMarcado(arq), null);
});

test('marca partida em dois <a:t> continua sendo achada', () => {
  // O PowerPoint parte o texto quando alguém digita e corrige no meio. Sem
  // costurar, o modelo pareceria não ter marca nenhuma.
  const partido = `<a:p><a:r><a:rPr lang="pt-BR"/><a:t>{{CAPACITY</a:t></a:r>`
    + `<a:r><a:rPr lang="pt-BR" dirty="0"/><a:t>_TOOL}}</a:t></a:r></a:p>`;
  assert.ok(costura(partido).includes(MARCA));
  assert.equal(
    acharSlideMarcado(new Map([['ppt/slides/slide1.xml', partido]])),
    'ppt/slides/slide1.xml');
});

// --- preencher -------------------------------------------------------------

test('cada linha vira um parágrafo com a formatação do modelo', () => {
  const r = preencheSlide(slide(MARCA), [{ texto: 'Matriz' }, { texto: 'CC 278' }]);
  assert.equal(r.trocou, true);
  assert.equal((r.xml.match(/<a:p>/g) ?? []).length, 2);
  // O que faz a linha sair com a cara do modelo: pPr e rPr vão inteiros.
  assert.equal((r.xml.match(/sz="1400"/g) ?? []).length, 2);
  assert.equal((r.xml.match(/algn="l"/g) ?? []).length, 2);
  assert.ok(r.xml.includes('<a:t>Matriz</a:t>'));
  assert.ok(r.xml.includes('<a:t>CC 278</a:t>'));
  assert.ok(!r.xml.includes(MARCA));
});

test('linha forte ganha negrito sem perder o resto da formatação', () => {
  const r = preencheSlide(slide(MARCA), [{ texto: 'Cadastro', forte: true }]);
  assert.ok(r.xml.includes('b="1"'));
  assert.ok(r.xml.includes('sz="1400"'));
});

test('o que está fora do parágrafo da marca não é tocado', () => {
  const xml = `<p:sld><a:p><a:r><a:t>Título fixo</a:t></a:r></a:p>`
    + `<a:p><a:r><a:rPr sz="1200"/><a:t>${MARCA}</a:t></a:r></a:p></p:sld>`;
  const r = preencheSlide(xml, [{ texto: 'X' }]);
  assert.ok(r.xml.includes('<a:t>Título fixo</a:t>'));
  assert.ok(r.xml.includes('<a:t>X</a:t>'));
});

test('caractere de XML no conteúdo é escapado', () => {
  // "Confecção & Cia" com & cru geraria um .pptx que o PowerPoint recusa.
  const r = preencheSlide(slide(MARCA), [{ texto: 'Confecção & Cia <2027>' }]);
  assert.ok(r.xml.includes('Confecção &amp; Cia &lt;2027&gt;'));
  assert.ok(!/&(?!amp;|lt;|gt;)/.test(r.xml));
});

test('lista vazia deixa um parágrafo em branco, e não apaga a caixa', () => {
  const r = preencheSlide(slide(MARCA), []);
  assert.equal(r.trocou, true);
  assert.ok(r.xml.includes('<a:t></a:t>'));
  assert.ok(r.xml.includes('sz="1400"'));
});

test('slide sem marca volta como veio, e diz que não trocou', () => {
  const r = preencheSlide(slide('Capa'), [{ texto: 'X' }]);
  assert.equal(r.trocou, false);
  assert.ok(r.xml.includes('<a:t>Capa</a:t>'));
});

// --- as seções -------------------------------------------------------------

test('as seções viram linhas, com título forte e branco entre elas', () => {
  const l = linhasDasSecoes([
    { titulo: 'Cadastro', linhas: ['12 recursos', '3 turnos'] },
    { titulo: 'Capacidade', linhas: ['26.729.912 min'] },
  ]);
  assert.deepEqual(l, [
    { texto: 'Cadastro', forte: true },
    { texto: '12 recursos' },
    { texto: '3 turnos' },
    { texto: '' },
    { texto: 'Capacidade', forte: true },
    { texto: '26.729.912 min' },
  ]);
});

test('a primeira seção não vem precedida de branco', () => {
  const l = linhasDasSecoes([{ titulo: 'Só uma', linhas: [] }]);
  assert.deepEqual(l, [{ texto: 'Só uma', forte: true }]);
});
