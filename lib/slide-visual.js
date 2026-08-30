// =============================================================================
// O VISUAL DESENHADO DENTRO DO SLIDE
//
// Formas de DrawingML — retângulos, uma linha livre e caixas de texto — para
// entrar no `<p:spTree>` do slide da marca. Sem biblioteca, como o resto dos
// formatos deste projeto.
//
// DESENHADO À MÃO E NÃO UM GRÁFICO DO POWERPOINT. Um gráfico de verdade é uma
// parte `charts/chart1.xml` MAIS uma planilha .xlsx embutida dentro do .pptx,
// com o relacionamento entre as duas; e o que se ganha com isso é poder editar
// os números no PowerPoint — coisa que ninguém vai fazer num documento que sai
// pronto do sistema e é regerado a cada mudança. Formas simples abrem em
// qualquer versão, não pedem planilha e não têm o que corromper.
//
// AS CORES E A FONTE VÊM DO TEMA DO MODELO — `accent1`, `accent2`, `tx1`,
// `+mn-lt`. Nenhum hexadecimal daqui: o documento é do Bruno, e um azul nosso
// no meio da paleta dele denunciaria de longe que aquele slide foi colado.
//
// Sem imports além da geometria pura, que é a mesma que a página de impressão
// usa para desenhar o SVG: duas contas de coluna sairiam do alinhamento na
// primeira mudança de margem.
// =============================================================================

// Com a extensão, e não sem: o executor de testes do Node resolve caminho de
// módulo pelas regras do ESM, que não adivinham o .js como o empacotador do
// Next adivinha. Sem ela o teste deste arquivo nem chega a rodar.
import {
  colunas, faixasDaGrade, geometriaDoGrafico, pol,
} from './visual.js';

const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const inteiro = (n) => Math.round(Number(n) || 0);

const xfrm = (x, y, w, h) =>
  `<a:xfrm><a:off x="${inteiro(x)}" y="${inteiro(y)}"/>`
  + `<a:ext cx="${Math.max(1, inteiro(w))}" cy="${Math.max(1, inteiro(h))}"/></a:xfrm>`;

const cor = (nome, alfa) =>
  `<a:schemeClr val="${nome}">${alfa ? `<a:alpha val="${alfa}"/>` : ''}</a:schemeClr>`;

const nv = (id, nome, txBox) =>
  `<p:nvSpPr><p:cNvPr id="${id}" name="${esc(nome)}"/>`
  + `<p:cNvSpPr${txBox ? ' txBox="1"' : ''}/><p:nvPr/></p:nvSpPr>`;

/** Um retângulo cheio — barra do gráfico, régua da grade, marcador. */
const retangulo = (id, { x, y, largura, altura }, esquema, alfa, geo = 'rect') =>
  `<p:sp>${nv(id, `v${id}`)}<p:spPr>${xfrm(x, y, largura, altura)}`
  + `<a:prstGeom prst="${geo}"><a:avLst/></a:prstGeom>`
  + `<a:solidFill>${cor(esquema, alfa)}</a:solidFill><a:ln><a:noFill/></a:ln>`
  + `</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="pt-BR"/>`
  + `</a:p></p:txBody></p:sp>`;

/**
 * Uma caixa de texto sem preenchimento nem borda.
 *
 * As margens internas vão a zero e o texto é ancorado no centro: com as margens
 * que o PowerPoint põe por padrão, um rótulo de 7pt numa faixa de 0,2 polegada
 * fica fora do lugar — e "fora do lugar" aqui quer dizer desalinhado da coluna
 * de cima, que é o defeito que este desenho existe para não ter.
 */
function caixa(id, { x, y, largura, altura }, texto, {
  tamanho = 700, alinhamento = 'ctr', negrito = false, esquema = 'tx1',
  alfa = null,
} = {}) {
  return `<p:sp>${nv(id, `t${id}`, true)}<p:spPr>${xfrm(x, y, largura, altura)}`
    + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
    + '<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"'
    + ' anchor="ctr"/><a:lstStyle/>'
    + `<a:p><a:pPr algn="${alinhamento}"/><a:r>`
    + `<a:rPr lang="pt-BR" sz="${tamanho}" b="${negrito ? 1 : 0}" dirty="0">`
    + `<a:solidFill>${cor(esquema, alfa)}</a:solidFill>`
    + '<a:latin typeface="+mn-lt"/></a:rPr>'
    + `<a:t>${esc(texto)}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

/** A linha da demanda: uma forma livre, sem preenchimento, só contorno. */
function poligonal(id, { x, y, largura, altura }, pontos) {
  const p = pontos.map((pt, i) => {
    const px = inteiro(pt.x - x);
    const py = inteiro(pt.y - y);
    const t = `<a:pt x="${px}" y="${py}"/>`;
    return i === 0 ? `<a:moveTo>${t}</a:moveTo>` : `<a:lnTo>${t}</a:lnTo>`;
  }).join('');

  return `<p:sp>${nv(id, `l${id}`)}<p:spPr>${xfrm(x, y, largura, altura)}`
    + '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>'
    + `<a:rect l="0" t="0" r="r" b="b"/><a:pathLst>`
    + `<a:path w="${Math.max(1, inteiro(largura))}" h="${Math.max(1, inteiro(altura))}">`
    + `${p}</a:path></a:pathLst></a:custGeom>`
    + `<a:noFill/><a:ln w="28575" cap="rnd"><a:solidFill>${cor('accent2')}</a:solidFill>`
    + '<a:round/></a:ln></p:spPr>'
    + '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="pt-BR"/></a:p>'
    + '</p:txBody></p:sp>';
}

// As proporções da área. O gráfico fica com a maior parte porque é ele que
// responde a pergunta; a grade é a explicação, e explicação em corpo menor.
const ALTURA_LEGENDA = 0.24;
const FATIA_GRAFICO = 0.58;
const ROTULO_MAX = 1.15;

// A caixa da marca costuma ser o corpo do slide inteiro. A faixa de cima só é
// reservada ao texto quando não há onde escrever o título no modelo; havendo,
// ele sobe para lá e o desenho fica com a caixa inteira.
const FATIA_TITULO = 0.34;
const TITULO_MAX = 1.05;
const MARGEM_INFERIOR = 0.85;

/**
 * A área que o desenho pode ocupar, a partir do retângulo da caixa marcada.
 *
 * Quando a caixa é baixa — um marcador solto no meio do slide —, o desenho
 * desce até a margem de baixo em vez de sair achatado numa tira de dois
 * centímetros. Quando ela é o corpo inteiro, fica dentro dela. Nos dois casos
 * respeita a largura marcada: é ali que o modelo diz que há espaço livre.
 *
 * `null` no retângulo acontece quando a caixa herda a geometria do leiaute e
 * não a declara. Aí vale uma área padrão com folga para título e rodapé — não
 * dá para adivinhar o modelo, mas dá para não escrever por cima do logotipo.
 */
export function areaDoVisual(retangulo, slide, { reservaTitulo = true } = {}) {
  const r = retangulo ?? {
    x: pol(0.6), y: pol(1.15),
    largura: slide.largura - pol(1.2), altura: slide.altura - pol(2.0),
  };

  const tituloH = reservaTitulo
    ? Math.min(r.altura * FATIA_TITULO, pol(TITULO_MAX)) : 0;
  const topo = r.y + tituloH;
  const ateOFim = slide.altura - pol(MARGEM_INFERIOR) - topo;

  return {
    x: r.x,
    y: topo,
    largura: r.largura,
    altura: Math.max(r.altura - tituloH, ateOFim, pol(1.5)),
  };
}

/**
 * Todas as formas do visual, prontas para entrar no `<p:spTree>`.
 *
 * `area` em EMU. `idBase` começa alto de propósito: id repetido com uma forma
 * que já existe no modelo faz o PowerPoint pedir reparo do arquivo.
 */
export function formasDoVisual({ area, visual, idBase = 7000, fmt = String }) {
  if (!visual || !visual.pontos?.length) return '';

  const { x, y, largura, altura } = area;
  const rotulo = Math.min(pol(ROTULO_MAX), largura * 0.14);

  const legendaH = Math.min(pol(ALTURA_LEGENDA), altura * 0.12);
  const restante = altura - legendaH;
  const graficoH = restante * FATIA_GRAFICO;
  const gradeY = y + legendaH + graficoH;
  const gradeH = restante - graficoH;

  const g = geometriaDoGrafico({
    x, y: y + legendaH, largura, altura: graficoH,
    serie: visual.pontos, rotulo,
  });

  let id = idBase;
  const proximo = () => { id += 1; return id; };
  const saida = [];

  // ---- legenda ------------------------------------------------------------
  // No alto e à esquerda porque é a primeira coisa a se ler: sem ela, barra e
  // linha são duas séries anônimas.
  const swatch = pol(0.13);
  let lx = x + rotulo;
  const legenda = (esquema, texto, redonda) => {
    saida.push(retangulo(proximo(), {
      x: lx, y: y + (legendaH - swatch) / 2, largura: swatch, altura: swatch,
    }, esquema, null, redonda ? 'ellipse' : 'rect'));
    const w = pol(0.02) + swatch * 8 + texto.length * pol(0.055);
    saida.push(caixa(proximo(), {
      x: lx + swatch + pol(0.06), y, largura: w, altura: legendaH,
    }, texto, { tamanho: 800, alinhamento: 'l', esquema: 'tx1', alfa: '70000' }));
    lx += swatch + pol(0.06) + w + pol(0.14);
  };
  legenda('accent1', visual.rotuloCapacidade);
  if (visual.rotuloDemanda) legenda('accent2', visual.rotuloDemanda, true);

  // O período e a origem do OEE no canto oposto: são o "quando", e ficam longe
  // do "o quê" para não virarem uma frase só com a legenda.
  if (visual.rodape) {
    saida.push(caixa(proximo(), {
      x: x + largura * 0.5, y, largura: largura * 0.5, altura: legendaH,
    }, visual.rodape, {
      tamanho: 800, alinhamento: 'r', esquema: 'tx1', alfa: '55000',
    }));
  }

  // ---- gráfico ------------------------------------------------------------
  for (const b of g.barras) {
    if (b.altura <= 0) continue;
    saida.push(retangulo(proximo(), b, 'accent1'));
    // O valor sobre a barra, e não dentro: dentro ele some quando a barra é
    // baixa, que é justamente o mês sobre o qual alguém vai perguntar.
    saida.push(caixa(proximo(), {
      x: g.colunas[b.i].x, y: b.y - pol(0.17),
      largura: g.colunas[b.i].largura, altura: pol(0.17),
    }, fmt(b.valor), { tamanho: 600, esquema: 'tx1', alfa: '75000' }));
  }

  // A base do gráfico, que é onde as barras nascem e a grade começa.
  saida.push(retangulo(proximo(), {
    x: x + rotulo, y: g.base, largura: largura - rotulo, altura: pol(0.008),
  }, 'tx1', '35000'));

  if (visual.rotuloDemanda) {
    saida.push(poligonal(proximo(),
      { x: x + rotulo, y: y + legendaH, largura: largura - rotulo, altura: graficoH },
      g.pontos));
    const d = pol(0.075);
    for (const p of g.pontos) {
      saida.push(retangulo(proximo(), {
        x: p.x - d / 2, y: p.y - d / 2, largura: d, altura: d,
      }, 'accent2', null, 'ellipse'));
    }
  }

  // ---- grade --------------------------------------------------------------
  const faixas = faixasDaGrade({
    x, y: gradeY, largura, altura: gradeH, quantas: visual.linhas.length,
  });
  const cols = colunas(x, largura, visual.pontos.length, rotulo);

  visual.linhas.forEach((linha, i) => {
    const f = faixas[i];
    if (i > 0) {
      saida.push(retangulo(proximo(), {
        x, y: f.y, largura, altura: pol(0.006),
      }, 'tx1', '18000'));
    }
    if (linha.rotulo) {
      saida.push(caixa(proximo(), {
        x, y: f.y, largura: rotulo - pol(0.06), altura: f.altura,
      }, linha.rotulo, {
        tamanho: 700, alinhamento: 'r', esquema: 'tx1', alfa: '70000',
      }));
    }
    linha.valores.forEach((v, j) => {
      if (v === '' || v === null || v === undefined) return;
      saida.push(caixa(proximo(), {
        x: cols[j].x, y: f.y, largura: cols[j].largura, altura: f.altura,
      }, v, { tamanho: linha.cabecalho ? 800 : 700, negrito: Boolean(linha.cabecalho) }));
    });
  });

  return saida.join('');
}
