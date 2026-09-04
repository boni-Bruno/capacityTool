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
  grupos: {
    'cálculo': 'Indicadores calculados.',
    cadastros: 'Dados operacionais.',
  },
  rodape: 'ano de 2026 · OEE meta',
  unidade: 'Minutos',
};

// --- a área ----------------------------------------------------------------

test('a esquerda sai da caixa da marca, e não de uma posição fixa', () => {
  // Posição fixa em código estaria errada no dia em que o modelo ganhasse uma
  // faixa lateral — e errada em silêncio, por cima do logotipo. A DIREITA é
  // outra pergunta e tem outra resposta: ela vem da régua, porque até onde a
  // tabela vai é decisão de quem projeta o slide na parede.
  const a = areaDoVisual(
    { x: pol(1), y: pol(1), largura: pol(10), altura: pol(5) }, SLIDE);
  assert.equal(a.x, pol(1));
  assert.ok(a.y > pol(1), 'a faixa de cima fica com o título');
  assert.ok(a.x + a.largura >= pol(11), 'a direita nunca encolhe a caixa');
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

test('a área vem antes das barras, e não há linha por cima delas', () => {
  // O DrawingML pinta na ordem do documento: área por cima cobriria a demanda
  // com uma camada translúcida.
  const x = xml();
  // A ULTIMA ocorrencia de accent2, e nao a primeira: a primeira e o quadradinho
  // da legenda, que vem antes de tudo. Medir por ela daria um teste que passa
  // pelo motivo errado.
  const area = x.indexOf('a:close');
  const ultimaBarra = x.lastIndexOf('val="accent2"');
  assert.ok(area > -1 && area < ultimaBarra, 'a área é o fundo');

  // Só UMA forma livre: a área. O contorno da capacidade saiu — ele repetia a
  // borda do preenchimento e disputava atenção com as barras. (A chave dos
  // blocos também é traçada, mas é prstGeom, não caminho livre.)
  assert.equal([...x.matchAll(/<a:custGeom>/g)].length, 1);
  assert.ok(x.includes('<a:close/>'), 'a única forma livre é preenchida');
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
  // Em caixa alta, que é como o nome do bloco sai no cartão da esquerda.
  assert.equal((x.match(/<a:t>CÁLCULO<\/a:t>/g) ?? []).length, 1);
  assert.equal((x.match(/<a:t>CADASTROS<\/a:t>/g) ?? []).length, 1);
  assert.equal((x.match(/prst="leftBrace"/g) ?? []).length, 2);
  // E a frase que diz o que o bloco é: quem lê o slide não tem a quem
  // perguntar o que "cadastros" quer dizer.
  assert.ok(x.includes('Dados operacionais.'));
});

test('o mês é escrito uma vez só, no cabeçalho da tabela', () => {
  // Ele nomeia a coluna do gráfico logo acima e a da tabela logo abaixo.
  // Escrito nos dois, seria a mesma palavra duas vezes na vertical.
  const x = xml();
  assert.equal((x.match(/<a:t>jan<\/a:t>/g) ?? []).length, 1);
  assert.equal((x.match(/<a:t>fev<\/a:t>/g) ?? []).length, 1);
});

test('o eixo sai com números redondos e uma régua para cada um', () => {
  const x = xml();
  // Máximo 1.300 na série: o eixo vai de 0 a 1.500, de 500 em 500.
  for (const v of ['0', '500', '1.000', '1.500']) {
    assert.ok(x.includes(`<a:t>${v}</a:t>`), `falta a marca ${v}`);
  }
  assert.ok(x.includes('<a:t>Minutos</a:t>'));
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

// --- o subtítulo puxa o desenho para cima ------------------------------------

test('com o título no modelo, o desenho sobe para junto do subtítulo', () => {
  // A caixa marcada foi posta por quem contava escrever dentro dela. Com o
  // texto nos campos do modelo, a faixa entre o subtítulo e ela fica vazia por
  // construção — e era a maior mancha de branco do slide.
  const caixa = { x: pol(1), y: pol(2.4), largura: pol(10), altura: pol(4) };
  const subtitulo = { x: pol(1), y: pol(0.7), largura: pol(8), altura: pol(0.4) };

  const semSubir = areaDoVisual(caixa, SLIDE, { reservaTitulo: false });
  const subindo = areaDoVisual(caixa, SLIDE,
    { reservaTitulo: false, abaixoDe: subtitulo });

  assert.ok(subindo.y < semSubir.y, 'deveria subir');
  assert.ok(subindo.y > subtitulo.y + subtitulo.altura, 'sem encostar no texto');
  assert.equal(subindo.y + subindo.altura, semSubir.y + semSubir.altura,
               'o fim da caixa marcada continua mandando');
});

test('subtítulo abaixo da caixa não empurra o desenho para baixo', () => {
  // Modelo em que os dois se sobrepõem: subir viraria descer, e o desenho
  // passaria por cima do texto do modelo.
  const caixa = { x: 0, y: pol(1.5), largura: pol(12), altura: pol(4) };
  const a = areaDoVisual(caixa, SLIDE, {
    reservaTitulo: false,
    abaixoDe: { x: 0, y: pol(3), largura: pol(8), altura: pol(0.4) },
  });
  assert.equal(a.y, pol(1.5));
});

test('a pílula sobe para a linha do subtítulo e devolve a faixa ao gráfico', () => {
  const area = { x: pol(0.5), y: pol(1.5), largura: pol(12), altura: pol(4.5) };
  const linha = { x: pol(0.5), y: pol(0.8), largura: pol(8), altura: pol(0.4) };

  const dentro = formasDoVisual({ area, visual, idBase: 100 });
  const acima = formasDoVisual({ area, visual, idBase: 100, pilulaAcima: linha });

  const ys = (x) => [...x.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"/g)]
    .map((m) => Number(m[2]));

  assert.ok(Math.min(...ys(acima)) < pol(1.2),
            'a pílula deveria estar na altura do subtítulo');
  assert.ok(Math.min(...ys(dentro)) >= area.y,
            'sem linha do subtítulo, nada sai da área');
});

test('os rótulos dos blocos saem centrados', () => {
  // Anotação do Bruno no slide: cartão estreito e alto com o rótulo à esquerda
  // deixa o texto pendurado num canto, e os dois cartões param de parecer um par.
  const x = xml();
  assert.ok(x.includes('CÁLCULO') || x.includes('CADASTROS'));
  const rotulos = [...x.matchAll(/<a:pPr algn="([a-z]+)"><\/a:pPr><a:r>(?:(?!<a:t>).)*?<a:t>(C[ÁA]LCULO|CADASTROS)<\/a:t>/g)];
  assert.ok(rotulos.length > 0, 'não achei os rótulos dos blocos');
  for (const r of rotulos) assert.equal(r[1], 'ctr');
});

// --- a régua manda na largura da tabela --------------------------------------

test('a tabela começa e termina onde a régua pediu, e não onde a caixa cai', () => {
  // -13 cm e +16 cm na régua centrada de um slide de 33,87 cm. A caixa marcada
  // diz onde há espaço; a largura da tabela é decisão de quem projeta na parede.
  const caixa = { x: pol(0.3), y: pol(1.6), largura: pol(6), altura: pol(4) };
  const a = areaDoVisual(caixa, SLIDE, { reservaTitulo: false });

  const deveComecar = SLIDE.largura * (3.93 / 33.87);
  const deveTerminar = SLIDE.largura * (32.93 / 33.87);

  assert.ok(Math.abs((a.x + a.calhaGrupo) - deveComecar) < pol(0.02),
            'a primeira coluna deveria nascer em -13 cm');
  assert.ok(Math.abs((a.x + a.largura) - deveTerminar) < pol(0.02),
            'a última coluna deveria terminar em +16 cm');
});

test('caixa que já passa da régua não é encolhida', () => {
  // Se o modelo reservar MAIS que a régua pediu, quem está errado é o desenho,
  // não o modelo: encolher jogaria fora espaço que alguém reservou de propósito.
  const caixa = { x: 0, y: pol(1.5), largura: SLIDE.largura, altura: pol(4) };
  const a = areaDoVisual(caixa, SLIDE, { reservaTitulo: false });
  assert.equal(a.x + a.largura, SLIDE.largura);
});

test('a calha medida vence a estimada por proporção', () => {
  const caixa = { x: pol(0.3), y: pol(1.6), largura: pol(12), altura: pol(4) };
  const a = areaDoVisual(caixa, SLIDE, { reservaTitulo: false });
  const x = formasDoVisual({ area: a, visual, idBase: 500 });

  // O cartão do bloco começa na calha; se ela fosse a estimada (13,5% da
  // largura), cairia em outro lugar.
  const xs = [...x.matchAll(/<a:off x="(-?\d+)"/g)].map((m) => Number(m[1]));
  const alvo = Math.round(a.x + a.calhaGrupo);
  assert.ok(xs.some((v) => Math.abs(v - alvo) <= 1),
            `nenhuma forma começa na calha medida (${alvo})`);
});

test('o rótulo do bloco cabe numa linha por mais estreita que seja a calha', () => {
  // ESTE É O DEFEITO QUE ESTE TESTE EXISTE PARA NÃO TER: com a calha medida
  // pela régua, o cartão ficou com 0,25 polegada de texto e "CADASTROS" precisa
  // de 0,58 no menor corpo legível. O PowerPoint não encolhe: ele quebra a
  // palavra e escreve por cima do que vier embaixo — saiu "CAD ASTR OS" com a
  // descrição atravessada no meio.
  const estreita = { x: 0, y: 0, largura: pol(11), altura: pol(4.5),
                     calhaGrupo: pol(0.85) };
  const x = formasDoVisual({ area: estreita, visual, idBase: 800 });

  for (const nome of ['CÁLCULO', 'CADASTROS']) {
    const i = x.indexOf(`<a:t>${nome}</a:t>`);
    assert.ok(i > -1, `${nome} não saiu`);
    const bloco = x.slice(x.lastIndexOf('<p:sp>', i), i);
    const cx = Number(bloco.match(/<a:ext cx="(\d+)"/)[1]);
    const sz = Number(bloco.match(/sz="(\d+)"/)[1]);
    const precisa = nome.length * pol(0.0072 * sz / 100);
    assert.ok(precisa <= cx,
      `${nome} a ${sz / 100}pt precisa de ${precisa} e tem ${cx}`);
  }
});

test('a descrição do bloco nunca começa antes de o título terminar', () => {
  // A altura do título era fixa em 0,22 polegada. Um título que quebrasse em
  // três linhas passava por baixo dela e a descrição entrava por cima.
  const x = formasDoVisual({
    area: { x: 0, y: 0, largura: pol(11), altura: pol(6), calhaGrupo: pol(0.85) },
    visual, idBase: 900,
  });

  const caixaDe = (marca) => {
    const i = x.indexOf(marca);
    if (i < 0) return null;
    const b = x.slice(x.lastIndexOf('<p:sp>', i), i);
    return {
      y: Number(b.match(/<a:off x="(-?\d+)" y="(-?\d+)"/)[2]),
      cy: Number(b.match(/<a:ext cx="(\d+)" cy="(\d+)"/)[2]),
    };
  };

  const titulo = caixaDe('<a:t>CADASTROS</a:t>');
  const descricao = caixaDe('<a:t>Dados operacionais.');
  // Omitida é resposta legítima: some a frase, e não o leiaute.
  if (descricao) {
    assert.ok(descricao.y >= titulo.y + titulo.cy,
      `descrição em ${descricao.y} sobe sobre o título que acaba em `
      + `${titulo.y + titulo.cy}`);
  }
});

// --- o leiaute que o Bruno ajustou à mão -------------------------------------

test('a geometria bate com o .pptx que o Bruno ajustou', () => {
  // Os números saíram MEDIDOS do configuracoes_2027.pptx que ele devolveu com
  // os ajustes finos. Este teste é o contrato: se um dia alguém mexer numa
  // constante do leiaute, aqui é onde vai aparecer — e não projetado numa
  // reunião. Tudo em polegada, como o PowerPoint mostra.
  const marcada = { x: pol(0.667), y: pol(1.542),
                    largura: pol(12.000), altura: pol(0.399) };
  const subtitulo = { x: 0, y: pol(0.484),
                      largura: pol(13.333), altura: pol(0.438) };

  const a = areaDoVisual(marcada, SLIDE,
    { reservaTitulo: false, abaixoDe: subtitulo });

  const doze = (v) => Array(12).fill(v);
  const x = formasDoVisual({
    area: a,
    pilulaAcima: subtitulo,
    visual: {
      pontos: doze(0).map((_, i) => (
        { mes: i + 1, rotulo: 'jan', capacidade: 648000, demanda: 232692 })),
      linhas: [
        { rotulo: '', valores: doze('jan'), total: 'Ano', cabecalho: true },
        ...['Capacidade', 'Demanda', 'Ocupação'].map((r) => (
          { grupo: 'cálculo', rotulo: r, valores: doze('1'), total: '1' })),
        ...['OEE (meta)', '1º Turno', '2º Turno', '3º Turno', '4º e 6º Turno',
            '5º Turno', 'Rodízio (24/7)', 'Paradas'].map((r) => (
          { grupo: 'cadastros', rotulo: r, valores: doze('N/A'), total: '–' })),
      ],
      rotuloCapacidade: 'Capacidade disponível',
      rotuloDemanda: 'Demanda cenário S&OP',
      grupos: { 'cálculo': 'Capacidade, demanda e ocupação.',
                cadastros: 'As premissas que produziram a capacidade calculada.' },
      rodape: 'ano de 2027 · OEE meta',
      unidade: 'Minutos',
    },
    fmt: String,
  });

  const geo = (marca) => {
    const i = x.indexOf(marca);
    assert.ok(i > -1, `não achei ${marca}`);
    const b = x.slice(x.lastIndexOf('<p:sp>', i), i + 200);
    const o = b.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
    const e = b.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    return { x: +o[1], y: +o[2], w: +e[1], h: +e[2] };
  };

  // Meio milímetro de tolerância: o arquivo dele foi arrastado com o mouse.
  const perto = (v, polegadas, quem) => assert.ok(
    Math.abs(v - pol(polegadas)) < pol(0.02),
    `${quem}: esperava ${polegadas}" e saiu ${(v / 914400).toFixed(3)}"`);

  const pilula = geo('name="CT pilula do periodo"');
  perto(pilula.x, 10.959, 'pílula x');
  perto(pilula.y, 0.533, 'pílula y');

  const grafico = geo('name="CT area do grafico"');
  perto(grafico.x, 0.667, 'gráfico x');
  perto(grafico.y, 1.081, 'gráfico y');
  perto(grafico.w, 12.297, 'gráfico largura');
  perto(grafico.h, 3.341, 'gráfico altura');

  const b1 = geo('name="CT bloco 1 cálculo"');
  perto(b1.x, 1.547, 'bloco 1 x');
  perto(b1.y, 4.728, 'bloco 1 y');
  perto(b1.w, 11.416, 'bloco 1 largura');

  const b2 = geo('name="CT bloco 2 cadastros"');
  perto(b2.y, 5.325, 'bloco 2 y');
  perto(b2.h, 1.325, 'bloco 2 altura');
  perto(b2.y + b2.h, 6.650, 'a tabela termina acima do rodapé');

  const titulo = geo('<a:t>CADASTROS</a:t>');
  perto(titulo.x, 0.370, 'título x');
  perto(titulo.w, 0.890, 'título largura');

  // As duas frases entram: no arquivo dele as duas estão lá, e a do bloco de
  // três linhas só coube depois de a margem de baixo encolher.
  assert.ok(x.includes('<a:t>Capacidade, demanda e ocupação.</a:t>'));
  assert.ok(x.includes('As premissas que produziram a capacidade calculada.'));
});

test('a nota de rodapé cai entre a tabela e a faixa do modelo', () => {
  // Ela mora ABAIXO da área: a grade termina exatamente onde a área termina, e
  // roubar altura dela mudaria a altura de todas as linhas. O espaço vem da
  // reserva de MARGEM_INFERIOR, cuja fatia de baixo é do rodapé do modelo — no
  // .pptx do Bruno a faixa escura começa em 6,834".
  const a = areaDoVisual(
    { x: pol(0.667), y: pol(1.542), largura: pol(12.000), altura: pol(0.399) },
    SLIDE, { reservaTitulo: false });

  const comNota = formasDoVisual({
    area: a, idBase: 1100,
    visual: { ...visual, nota: '* Unidade de Medida padrão do material.' },
  });

  const i = comNota.indexOf('<a:t>* Unidade de Medida');
  assert.ok(i > -1, 'a nota deveria ter sido desenhada');
  const b = comNota.slice(comNota.lastIndexOf('<p:sp>', i), i + 200);
  const y = Number(b.match(/<a:off x="(-?\d+)" y="(-?\d+)"/)[2]);
  const h = Number(b.match(/<a:ext cx="(\d+)" cy="(\d+)"/)[2]);

  assert.ok(y >= a.y + a.altura, 'a nota não pode entrar na tabela');
  assert.ok(y + h <= pol(6.834),
    `a nota termina em ${((y + h) / 914400).toFixed(3)}" e invade a faixa`);
});

test('sem nota, o slide sai idêntico ao de antes', () => {
  // A frase é opcional e não pode custar leiaute: só a UM tem nota, e o slide
  // em minuto não pode mudar um EMU por causa disso.
  const area = { x: pol(0.5), y: pol(1.5), largura: pol(12), altura: pol(4.5) };
  const sem = formasDoVisual({ area, visual, idBase: 1200 });
  const nulo = formasDoVisual({ area, visual: { ...visual, nota: null },
                                idBase: 1200 });
  assert.equal(sem, nulo);
});

