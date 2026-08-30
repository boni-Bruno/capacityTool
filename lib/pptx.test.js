import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARCA, acharSlideMarcado, clonaSlideMarcado, costura, linhasDasSecoes,
  preencheCampo, preencheSlide, slidesDo,
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

// --- o título e o subtítulo do modelo --------------------------------------

const campo = (ph, txt) =>
  '<p:sp><p:nvSpPr><p:cNvPr id="1" name="x"/><p:cNvSpPr/>'
  + `<p:nvPr>${ph ? `<p:ph type="${ph}"/>` : ''}</p:nvPr></p:nvSpPr>`
  + '<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>'
  + (txt === null
    ? '<a:p><a:endParaRPr lang="pt-BR"/></a:p>'
    : `<a:p><a:pPr algn="l"/><a:r><a:rPr sz="2800"/><a:t>${txt}</a:t></a:r></a:p>`)
  + '</p:txBody></p:sp>';

const folha = (...s) => `<p:sld><p:cSld><p:spTree>${s.join('')}</p:spTree></p:cSld></p:sld>`;

test('escreve no espaço reservado do título sem perder a formatação dele', () => {
  const r = preencheCampo(folha(campo('title', 'Título')), 'titulo',
                          'Matriz - Confecção');
  assert.equal(r.trocou, true);
  assert.ok(r.xml.includes('<a:t>Matriz - Confecção</a:t>'));
  // O tamanho é do modelo: é ele que decidiu como um título se parece.
  assert.ok(r.xml.includes('sz="2800"'));
});

test('espaço reservado VAZIO também recebe texto', () => {
  // O "Título" que aparece na tela é sugestão do leiaute, não conteúdo do
  // arquivo: não há <a:t> nenhum para clonar, e sem este caso o título sumiria
  // justo no modelo bem montado.
  const r = preencheCampo(folha(campo('ctrTitle', null)), 'titulo', 'Matriz');
  assert.equal(r.trocou, true);
  assert.ok(r.xml.includes('<a:t>Matriz</a:t>'));
});

test('caixa comum em que alguém escreveu "Subtítulo" também vale', () => {
  // Modelo montado à mão costuma ter caixa de texto, e não espaço reservado.
  const r = preencheCampo(folha(campo(null, 'Subtítulo')), 'subtitulo',
                          'CC 278 - 9 CTs');
  assert.equal(r.trocou, true);
  assert.ok(r.xml.includes('<a:t>CC 278 - 9 CTs</a:t>'));
});

test('não escreve numa caixa que não é a pedida', () => {
  const r = preencheCampo(folha(campo(null, 'Karsten S.A.')), 'titulo', 'X');
  assert.equal(r.trocou, false);
  assert.ok(r.xml.includes('Karsten S.A.'));
});

test('o subtítulo não invade o título, e o & é escapado', () => {
  const r = preencheCampo(folha(campo('title', 'Título'), campo('subTitle', 'Subtítulo')),
                          'subtitulo', 'Confecção & Cia');
  assert.ok(r.xml.includes('Confecção &amp; Cia'));
  assert.ok(r.xml.includes('<a:t>Título</a:t>'), 'o título ficou onde estava');
});

test('modelo sem título diz que não trocou, para a tela poder decidir', () => {
  // É esse "false" que faz o texto voltar para dentro da caixa da marca em vez
  // de sumir do slide.
  const r = preencheCampo(folha(campo(null, 'qualquer coisa')), 'titulo', 'X');
  assert.equal(r.trocou, false);
});

// --- clonar ----------------------------------------------------------------

// Um .pptx mínimo com o que importa: dois slides, a marca no segundo, e as
// quatro partes que precisam saber que um slide existe.
const modelo = () => new Map([
  ['[Content_Types].xml',
   '<Types><Override PartName="/ppt/slides/slide1.xml" ContentType="s"/>'
   + '<Override PartName="/ppt/slides/slide2.xml" ContentType="s"/></Types>'],
  ['ppt/presentation.xml',
   '<p:presentation><p:sldIdLst>'
   + '<p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/>'
   + '</p:sldIdLst><p:sldSz cx="1"/></p:presentation>'],
  ['ppt/_rels/presentation.xml.rels',
   '<Relationships>'
   + '<Relationship Id="rId1" Type="x/slideMaster" Target="slideMasters/m.xml"/>'
   + '<Relationship Id="rId2" Type="x/slide" Target="slides/slide1.xml"/>'
   + '<Relationship Id="rId3" Type="x/slide" Target="slides/slide2.xml"/>'
   + '</Relationships>'],
  ['ppt/slides/slide1.xml', slide('Capa')],
  ['ppt/slides/slide2.xml', slide(MARCA)],
  ['ppt/slides/_rels/slide2.xml.rels',
   '<Relationships>'
   + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/'
   + 'officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/l.xml"/>'
   + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/'
   + 'officeDocument/2006/relationships/notesSlide" Target="../notesSlides/n.xml"/>'
   + '</Relationships>'],
]);

// As partes voltam em bytes, que é como o `lerZip` as entrega e como o
// `escreveZip` as espera.
const txt = (v) => (typeof v === 'string' ? v : new TextDecoder().decode(v));

test('clonar um só devolve o próprio slide, sem mexer no arquivo', () => {
  const arq = modelo();
  const antes = arq.get('ppt/presentation.xml');
  assert.deepEqual(clonaSlideMarcado(arq, 1), ['ppt/slides/slide2.xml']);
  assert.equal(arq.get('ppt/presentation.xml'), antes);
});

test('as cópias entram nas quatro partes que citam um slide', () => {
  // Faltar em qualquer uma delas dá o mesmo estrago: o PowerPoint diz que o
  // arquivo está corrompido e oferece reparar.
  const arq = modelo();
  const nomes = clonaSlideMarcado(arq, 3);

  assert.deepEqual(nomes, [
    'ppt/slides/slide2.xml', 'ppt/slides/slide3.xml', 'ppt/slides/slide4.xml',
  ]);
  for (const n of nomes.slice(1)) {
    assert.ok(arq.has(n), `falta a parte ${n}`);
    assert.ok(txt(arq.get('[Content_Types].xml')).includes(`PartName="/${n}"`));
  }
  const rels = txt(arq.get('ppt/_rels/presentation.xml.rels'));
  assert.ok(rels.includes('Target="slides/slide3.xml"'));
  assert.ok(rels.includes('Target="slides/slide4.xml"'));
  // rId livre, e não um que já existia: repetido, o slide antigo some.
  assert.equal((rels.match(/Id="rId4"/g) ?? []).length, 1);
  assert.equal((rels.match(/Id="rId5"/g) ?? []).length, 1);
});

test('as cópias nascem logo depois do slide da marca, e não no fim', () => {
  // O modelo tem ordem — capa, conteúdo, encerramento. Jogar as cópias no fim
  // colocaria o conteúdo depois do "obrigado".
  const arq = modelo();
  clonaSlideMarcado(arq, 3);
  const ordem = [...txt(arq.get('ppt/presentation.xml'))
    .matchAll(/r:id="(rId\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(ordem, ['rId2', 'rId3', 'rId4', 'rId5']);
});

test('o id do sldId nasce livre e acima de 256', () => {
  const arq = modelo();
  clonaSlideMarcado(arq, 2);
  const ids = [...txt(arq.get('ppt/presentation.xml'))
    .matchAll(/<p:sldId id="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(ids, [256, 257, 258]);
  assert.equal(new Set(ids).size, ids.length);
});

test('a cópia leva o leiaute do original e deixa a nota do orador', () => {
  // O leiaute é o que dá a cara do modelo à cópia. Já a notesSlide aponta de
  // volta para UM slide: duas cópias citando a mesma nota é vínculo cruzado.
  const arq = modelo();
  clonaSlideMarcado(arq, 2);
  const r = txt(arq.get('ppt/slides/_rels/slide3.xml.rels'));
  assert.ok(r.includes('slideLayout'));
  assert.ok(!r.includes('notesSlide'));
});

test('cada cópia é preenchida por conta própria', () => {
  const arq = modelo();
  const nomes = clonaSlideMarcado(arq, 2);
  nomes.forEach((n, i) => {
    arq.set(n, preencheSlide(txt(arq.get(n)), [{ texto: `CT ${i}` }]).xml);
  });
  assert.ok(txt(arq.get('ppt/slides/slide2.xml')).includes('<a:t>CT 0</a:t>'));
  assert.ok(txt(arq.get('ppt/slides/slide3.xml')).includes('<a:t>CT 1</a:t>'));
});

test('modelo sem marca devolve nulo em vez de clonar às cegas', () => {
  const arq = modelo();
  arq.set('ppt/slides/slide2.xml', slide('Conteúdo'));
  assert.equal(clonaSlideMarcado(arq, 3), null);
});

test('modelo sem presentation.xml morre com frase, e não com TypeError', () => {
  const arq = modelo();
  arq.delete('ppt/presentation.xml');
  assert.throws(() => clonaSlideMarcado(arq, 2), /PowerPoint/);
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
