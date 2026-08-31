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
// `+mn-lt`. Nenhum hexadecimal escolhido por nós: o documento é do Bruno, e um
// azul nosso no meio da paleta dele denunciaria de longe que aquele slide foi
// colado.
//
// A ÚNICA EXCEÇÃO é a faixa de cor da ocupação, que vem cadastrada em
// "#RRGGBB". Ela não decora, informa — e quem escolheu foi quem conhece a régua
// da fábrica. Trocá-la pela cor mais parecida do tema seria desobedecer em
// silêncio. Ver 29_faixa_ocupacao.sql.
//
// Fora a geometria pura — a mesma que a página de impressão usa para o SVG,
// porque duas contas de coluna sairiam do alinhamento na primeira mudança de
// margem — e a regra de contraste do texto sobre a cor cadastrada.
// =============================================================================

// Com a extensão, e não sem: o executor de testes do Node resolve caminho de
// módulo pelas regras do ESM, que não adivinham o .js como o empacotador do
// Next adivinha. Sem ela o teste deste arquivo nem chega a rodar.
import {
  colunaTotal, colunas, faixasDaGrade, geometriaDoGrafico, pol,
} from './visual.js';
import { corDoTexto } from './faixa-cor.js';

const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const inteiro = (n) => Math.round(Number(n) || 0);

const xfrm = (x, y, w, h) =>
  `<a:xfrm><a:off x="${inteiro(x)}" y="${inteiro(y)}"/>`
  + `<a:ext cx="${Math.max(1, inteiro(w))}" cy="${Math.max(1, inteiro(h))}"/></a:xfrm>`;

// Cor do TEMA do modelo, sempre — menos quando o nome já vem como "#RRGGBB",
// que é o caso das faixas de ocupação: essa o Bruno cadastrou, e trocá-la pela
// mais parecida do tema seria desobedecer em silêncio.
const cor = (nome, alfa) => (String(nome).startsWith('#')
  ? `<a:srgbClr val="${String(nome).slice(1).toUpperCase()}">`
    + `${alfa ? `<a:alpha val="${alfa}"/>` : ''}</a:srgbClr>`
  : `<a:schemeClr val="${nome}">`
    + `${alfa ? `<a:alpha val="${alfa}"/>` : ''}</a:schemeClr>`);

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

/**
 * Uma forma livre: a linha da capacidade, ou a área embaixo dela.
 *
 * `preenche` fecha o caminho e pinta por dentro; sem ele sai só o contorno. São
 * duas formas e não uma porque a área quer transparência e a linha quer opacidade
 * — pintadas juntas, ou a linha desbota ou a área tapa as barras.
 */
function poligonal(id, { x, y, largura, altura }, pontos, preenche = false) {
  const p = pontos.map((pt, i) => {
    const px = inteiro(pt.x - x);
    const py = inteiro(pt.y - y);
    const t = `<a:pt x="${px}" y="${py}"/>`;
    return i === 0 ? `<a:moveTo>${t}</a:moveTo>` : `<a:lnTo>${t}</a:lnTo>`;
  }).join('');

  return `<p:sp>${nv(id, `l${id}`)}<p:spPr>${xfrm(x, y, largura, altura)}`
    + '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>'
    + `<a:rect l="0" t="0" r="r" b="b"/><a:pathLst>`
    + `<a:path w="${Math.max(1, inteiro(largura))}" h="${Math.max(1, inteiro(altura))}"`
    + `${preenche ? '' : ' fill="none"'}>`
    + `${p}${preenche ? '<a:close/>' : ''}</a:path></a:pathLst></a:custGeom>`
    + (preenche
      ? `<a:solidFill>${cor('accent1', '30000')}</a:solidFill><a:ln><a:noFill/></a:ln>`
      : `<a:noFill/><a:ln w="28575" cap="rnd">`
        + `<a:solidFill>${cor('accent1')}</a:solidFill><a:round/></a:ln>`)
    + '</p:spPr>'
    + '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="pt-BR"/></a:p>'
    + '</p:txBody></p:sp>';
}

// As proporções da área. O gráfico fica com a maior parte porque é ele que
// responde a pergunta; a grade é a explicação, e explicação em corpo menor.
const ALTURA_LEGENDA = 0.24;
const FATIA_GRAFICO = 0.58;
const ROTULO_MAX = 1.15;
const TOTAL_MAX = 1.25;

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
  // A coluna do total existe só se alguma linha tiver total para mostrar.
  const temTotal = visual.linhas.some((l) => l.total);
  const total = temTotal ? Math.min(pol(TOTAL_MAX), largura * 0.12) : 0;

  const legendaH = Math.min(pol(ALTURA_LEGENDA), altura * 0.12);
  const restante = altura - legendaH;
  const graficoH = restante * FATIA_GRAFICO;
  const gradeY = y + legendaH + graficoH;
  const gradeH = restante - graficoH;

  const g = geometriaDoGrafico({
    x, y: y + legendaH, largura, altura: graficoH,
    serie: visual.pontos, rotulo, total,
  });
  const plot = {
    x: x + rotulo, y: y + legendaH,
    largura: largura - rotulo - total, altura: graficoH,
  };

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
  if (visual.rotuloDemanda) legenda('accent2', visual.rotuloDemanda);

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
  // A ÁREA PRIMEIRO, as barras depois: o DrawingML pinta na ordem do documento,
  // e a área é o fundo contra o qual as barras se leem. Ao contrário, ela
  // cobriria a demanda com uma camada translúcida em cima.
  saida.push(poligonal(proximo(), plot, g.poligono, true));

  for (const b of g.barras) {
    if (b.altura <= 0) continue;
    saida.push(retangulo(proximo(), b, 'accent2'));
  }

  // A linha da capacidade por cima de tudo: é o teto, e teto encoberto por
  // barra deixa de ser teto.
  saida.push(poligonal(proximo(), plot, g.pontos));

  // A base do gráfico, que é onde as barras nascem e a grade começa.
  saida.push(retangulo(proximo(), {
    x: x + rotulo, y: g.base, largura: largura - rotulo, altura: pol(0.008),
  }, 'tx1', '35000'));

  // ---- grade --------------------------------------------------------------
  const faixas = faixasDaGrade({
    x, y: gradeY, largura, altura: gradeH, quantas: visual.linhas.length,
  });
  const cols = colunas(x, largura, visual.pontos.length, rotulo, total);
  const colTotal = temTotal ? colunaTotal(x, largura, total) : null;

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
      const celula = {
        x: cols[j].x, y: f.y, largura: cols[j].largura, altura: f.altura,
      };
      const pintada = linha.cores?.[j];
      // A cor pinta a CÉLULA INTEIRA, e não a letra: no meio de doze números
      // iguais, letra colorida se perde e faixa colorida salta. O retângulo vem
      // antes do texto porque o DrawingML pinta na ordem do documento.
      if (pintada) {
        saida.push(retangulo(proximo(), celula, pintada));
      }
      saida.push(caixa(proximo(), celula, v, {
        tamanho: linha.cabecalho ? 800 : 700,
        negrito: Boolean(linha.cabecalho),
        esquema: pintada ? corDoTexto(pintada) : 'tx1',
      }));
    });

    // O total sai em negrito em toda linha, e não só no cabeçalho: é a coluna
    // que se procura primeiro, e ela está longe do rótulo da esquerda.
    if (colTotal && linha.total) {
      const celula = {
        x: colTotal.x, y: f.y, largura: colTotal.largura, altura: f.altura,
      };
      if (linha.corTotal) saida.push(retangulo(proximo(), celula, linha.corTotal));
      saida.push(caixa(proximo(), celula, linha.total, {
        tamanho: linha.cabecalho ? 800 : 700,
        negrito: true,
        esquema: linha.corTotal ? corDoTexto(linha.corTotal) : 'tx1',
      }));
    }
  });

  return saida.join('');
}
