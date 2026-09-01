import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaDoVisual, formasDoVisual } from './slide-visual.js';
import { pol } from './visual.js';

// XML malformado aqui não dá erro: dá um .pptx que o PowerPoint diz estar
// corrompido e oferece reparar — o que costuma significar perder o slide.

const SLIDE = { largura: 12192000, altura: 6858000 };

const visual = {
  pontos: [
    { mes: 1, rotulo: 'jan', capacidade: 1000, demanda: 800, oee: 75 },
    { mes: 2, rotulo: 'fev', capacidade: 1200, demanda: 1300, oee: 78 },
  ],
  linhas: [
    { rotulo: '', valores: ['jan', 'fev'], total: 'Ano', cabecalho: true },
    { grupo: 'cálculo', rotulo: 'Capacidade', valores: ['1.000', '1.200'], total: '2.200' },
    { grupo: 'cálculo', rotulo: 'Demanda', valores: ['800', '1.300'], total: '2.100' },
    { grupo: 'cálculo', rotulo: 'Ocupação', valores: ['80,0%', '108,3%'], total: '95,5%' },
    { grupo: 'cadastros', rotulo: 'OEE', valores: ['75,0%', '78,0%'], total: '76,5%' },
    { grupo: 'cadastros', rotulo: '1º turno', valores: ['4', '4'], total: '' },
    { grupo: 'cadastros', rotulo: 'Paradas', valores: ['0', '480'], total: '480' },
  ],
  rotuloCapacidade: 'Capacidade disponível',
  rotuloDemanda: 'Demanda cenário S&OP',
};

// --- a área ----------------------------------------------------------------

test('a área sai da caixa da marca, e não de uma posição fixa', () => {
  // Posição fixa em código estaria errada no dia em que o modelo ganhasse uma
  // faixa lateral — e errada em silêncio, por cima do logotipo.
  const a = areaDoVisual(
    { x: pol(1), y: pol(1), largura: pol(10), altura: pol(5) }, SLIDE);
  assert.equal(a.x, pol(1));
  assert.equal(a.largura, pol(10));
  assert.ok(a.y > pol(1), 'a faixa de cima fica com o título');
});

test('caixa baixa não achata o desenho: ele desce até a margem', () => {
  const a = areaDoVisual(
    { x: 0, y: pol(1), largura: pol(12), altura: pol(0.6) }, SLIDE);
  assert.ok(a.altura > pol(3), `altura ${a.altura} deveria descer até o rodapé`);
  assert.ok(a.y + a.altura <= SLIDE.altura, 'não pode passar do fim do slide');
});

test('sem geometria declarada, vale uma área padrão dentro do slide', () => {
  // A caixa herda o tamanho do leiaute e não o declara — dá para não adivinhar,
  // mas não dá para escrever por cima do rodapé.
  const a = areaDoVisual(null, SLIDE);
  assert.ok(a.x > 0 && a.y > 0);
  assert.ok(a.x + a.largura <= SLIDE.largura);
  assert.ok(a.y + a.altura <= SLIDE.altura);
});

// --- as formas -------------------------------------------------------------

const xml = () => formasDoVisual({
  area: { x: pol(0.5), y: pol(1.5), largura: pol(12), altura: pol(4.5) },
  visual,
  fmt: (n) => Number(n).toLocaleString('pt-BR'),
});

test('as tags abrem e fecham na mesma conta', () => {
  const x = xml();
  for (const tag of ['p:sp', 'p:spPr', 'p:txBody', 'a:p']) {
    const abre = (x.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length;
    const fecha = (x.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;
    assert.equal(abre, fecha, `${tag}: ${abre} abre, ${fecha} fecha`);
  }
});

test('todo id de forma é único', () => {
  // Id repetido com uma forma que já existe no modelo faz o PowerPoint pedir
  // reparo do arquivo.
  const ids = [...xml().matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 10);
  assert.equal(new Set(ids).size, ids.length);
});

test('a cor e a fonte vêm do tema do modelo, nunca daqui', () => {
  // Um azul nosso no meio da paleta do cliente denuncia de longe que aquele
  // slide foi colado. Sem faixa cadastrada, nenhuma cor sai fora do tema.
  const x = xml();
  assert.ok(x.includes('<a:schemeClr val="accent1"'));
  assert.ok(x.includes('<a:schemeClr val="accent2"'));
  assert.ok(x.includes('typeface="+mn-lt"'));
  assert.ok(!/#[0-9a-fA-F]{6}/.test(x), 'nenhum hexadecimal');
  assert.ok(!/srgbClr/.test(x), 'nenhuma cor fora do tema');
});

test('o & do cenário é escapado', () => {
  // "S&OP" com & cru gera um .pptx que o PowerPoint recusa a abrir.
  const x = xml();
  assert.ok(x.includes('Demanda cenário S&amp;OP'));
  assert.ok(!/&(?!amp;|lt;|gt;|quot;)/.test(x));
});

test('sem cenário não há barra de demanda, mas a capacidade continua', () => {
  // A capacidade é o desenho; a demanda é a comparação. Sem cenário escolhido o
  // slide ainda tem o que mostrar.
  const semDemanda = formasDoVisual({
    area: { x: 0, y: 0, largura: pol(10), altura: pol(4) },
    visual: {
      ...visual,
      pontos: visual.pontos.map((p) => ({ ...p, demanda: 0 })),
      rotuloDemanda: null,
    },
  });
  assert.ok(semDemanda.includes('custGeom'), 'a área da capacidade fica');
  assert.ok(!semDemanda.includes('accent2'), 'nada de demanda');
});

test('a área vem antes das barras, e a linha depois de tudo', () => {
  // O DrawingML pinta na ordem do documento. Área por cima cobriria a demanda
  // com uma camada translúcida; linha por baixo deixaria o teto encoberto.
  const x = xml();
  // A ULTIMA ocorrencia de accent2, e nao a primeira: a primeira e o quadradinho
  // da legenda, que vem antes de tudo. Medir por ela daria um teste que passa
  // pelo motivo errado.
  const area = x.indexOf('a:close');
  const ultimaBarra = x.lastIndexOf('val="accent2"');
  const linha = x.lastIndexOf('custGeom');
  assert.ok(area > -1 && area < ultimaBarra, 'a área é o fundo');
  assert.ok(ultimaBarra < linha, 'a linha da capacidade é o topo');
});

test('o total sai em negrito, e o turno não totaliza', () => {
  // Somar "6 recursos em janeiro" com "6 em fevereiro" daria doze recursos numa
  // fábrica que tem seis: turno é estado, não fluxo.
  const x = xml();
  for (const t of ['Ano', '2.200', '2.100', '95,5%', '76,5%']) {
    assert.ok(x.includes(`<a:t>${t}</a:t>`), `falta o total ${t}`);
  }
  assert.ok((x.match(/b="1"/g) ?? []).length >= 5);
});

test('a faixa cadastrada pinta o número, e só ela sai fora do tema', () => {
  // A cor da ocupação é a única exceção: ela não decora, informa, e quem
  // escolheu foi quem conhece a régua da fábrica. E pinta o NÚMERO — faixa
  // colorida atrás dele vira tarja, e tarja compete com o gráfico.
  const x = formasDoVisual({
    area: { x: 0, y: 0, largura: pol(10), altura: pol(4) },
    visual: {
      ...visual,
      linhas: visual.linhas.map((l) => (l.rotulo === 'Ocupação'
        ? { ...l, cores: ['#2E7D32', '#C62828'], corTotal: '#F9A825' } : l)),
    },
  });
  assert.equal((x.match(/srgbClr val="2E7D32"/g) ?? []).length, 1);
  assert.equal((x.match(/srgbClr val="C62828"/g) ?? []).length, 1);
  assert.equal((x.match(/srgbClr val="F9A825"/g) ?? []).length, 1);
  // A cor está no texto, e não num retângulo atrás dele: cada uma aparece uma
  // vez só, dentro de um <a:rPr>.
  for (const c of ['2E7D32', 'C62828', 'F9A825']) {
    const antes = x.slice(0, x.indexOf(`srgbClr val="${c}"`));
    assert.ok(antes.lastIndexOf('<a:rPr') > antes.lastIndexOf('<a:prstGeom'),
      `${c} deveria estar no texto, não no preenchimento de uma forma`);
  }
});

test('o grupo vira uma chave por bloco, e não uma por linha', () => {
  // Três linhas de "cálculo" seguidas são UMA chave: uma por linha viraria uma
  // escada de chavinhas que não agrupa nada.
  const x = xml();
  assert.equal((x.match(/<a:t>cálculo<\/a:t>/g) ?? []).length, 1);
  assert.equal((x.match(/<a:t>cadastros<\/a:t>/g) ?? []).length, 1);
  assert.equal((x.match(/prst="leftBrace"/g) ?? []).length, 2);
});

test('a chave é traçada, e não preenchida', () => {
  // Chave preenchida vira um borrão sólido no lugar de um traço.
  const x = xml();
  const i = x.indexOf('prst="leftBrace"');
  const forma = x.slice(i, x.indexOf('</p:sp>', i));
  assert.ok(forma.includes('<a:noFill/>'));
  assert.ok(forma.includes('<a:ln w='));
});

test('a chave estica com o bloco sem engordar o traço', () => {
  // É o motivo de usar a forma pronta em vez de um caminho livre: num caminho
  // livre o traço acompanharia a escala e a chave de um bloco alto sairia gorda.
  const alto = formasDoVisual({
    area: { x: 0, y: 0, largura: pol(10), altura: pol(8) },
    visual, fmt: String,
  });
  const espessura = (t) => [...t.matchAll(/prst="leftBrace"[\s\S]{0,400}?<a:ln w="(\d+)"/g)]
    .map((m) => m[1]);
  assert.deepEqual(espessura(alto), espessura(xml()));
});

test('as colunas do gráfico começam depois das duas calhas', () => {
  // Sem isso cada barra ficaria deslocada da coluna de baixo pela largura do
  // grupo — o desalinhamento inteiro, de novo.
  const comGrupo = xml();
  const semGrupo = formasDoVisual({
    area: { x: pol(0.5), y: pol(1.5), largura: pol(12), altura: pol(4.5) },
    visual: { ...visual, linhas: visual.linhas.map(({ grupo, ...l }) => l) },
    fmt: String,
  });
  assert.ok(!semGrupo.includes('cadastros'), 'sem grupo, sem calha');
  // A primeira barra do gráfico com grupo nasce mais à direita.
  const primeiraBarra = (t) => Number(
    t.match(/<a:off x="(\d+)"[^>]*\/><a:ext[^>]*\/><\/a:xfrm><a:prstGeom prst="rect"><a:avLst\/><\/a:prstGeom><a:solidFill><a:schemeClr val="accent2"/)?.[1] ?? 0);
  assert.ok(primeiraBarra(comGrupo) > primeiraBarra(semGrupo));
});

test('coordenada nenhuma sai fracionária', () => {
  // EMU é inteiro; um "123.45" no atributo faz o PowerPoint recusar o arquivo.
  const fracao = [...xml().matchAll(/(?:x|y|cx|cy)="(-?[\d.]+)"/g)]
    .map((m) => m[1]).filter((v) => v.includes('.'));
  assert.deepEqual(fracao, []);
});

test('visual vazio não desenha nada, em vez de desenhar uma moldura vazia', () => {
  assert.equal(formasDoVisual({ area: { x: 0, y: 0, largura: 1, altura: 1 },
                                visual: null }), '');
  assert.equal(formasDoVisual({ area: { x: 0, y: 0, largura: 1, altura: 1 },
                                visual: { pontos: [], linhas: [] } }), '');
});
