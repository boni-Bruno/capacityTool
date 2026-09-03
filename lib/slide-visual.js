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
// silêncio. Ela pinta o NÚMERO, e não o fundo da célula. Ver
// 29_faixa_ocupacao.sql.
//
// Fora isso, só a geometria pura de `visual.js`: uma conta de coluna só, para o
// rótulo do mês na grade cair debaixo da barra daquele mês no gráfico.
// =============================================================================

// Com a extensão, e não sem: o executor de testes do Node resolve caminho de
// módulo pelas regras do ESM, que não adivinham o .js como o empacotador do
// Next adivinha. Sem ela o teste deste arquivo nem chega a rodar.
import {
  colunaTotal, colunas, escalaY, faixasDaGrade, geometriaDoGrafico, pol,
} from './visual.js';

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
  alfa = null, ancora = 'ctr', entrelinha = null,
} = {}) {
  // `lnSpc` só entra quando pedido: uma frase de duas linhas dentro de um
  // cartão precisa de respiro, e um número numa faixa de 0,2 polegada não.
  const pPr = `<a:pPr algn="${alinhamento}">`
    + (entrelinha ? `<a:lnSpc><a:spcPct val="${entrelinha}"/></a:lnSpc>` : '')
    + '</a:pPr>';

  return `<p:sp>${nv(id, `t${id}`, true)}<p:spPr>${xfrm(x, y, largura, altura)}`
    + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
    + '<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"'
    + ` anchor="${ancora}"/><a:lstStyle/>`
    + `<a:p>${pPr}<a:r>`
    + `<a:rPr lang="pt-BR" sz="${tamanho}" b="${negrito ? 1 : 0}" dirty="0">`
    + `<a:solidFill>${cor(esquema, alfa)}</a:solidFill>`
    + '<a:latin typeface="+mn-lt"/></a:rPr>'
    + `<a:t>${esc(texto)}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

/**
 * Um cartão de canto arredondado — o do gráfico, os dois da esquerda, a faixa
 * do cabeçalho e a pílula do período.
 *
 * `adj` é o raio do canto em milésimos do lado menor. O padrão do PowerPoint
 * (16667) arredonda demais uma faixa baixa e larga: ela vira uma cápsula. Aqui
 * o raio é escolhido caso a caso.
 */
const cartao = (id, { x, y, largura, altura }, {
  fundo = null, alfaFundo = null, borda = null, alfaBorda = null, adj = 6000,
} = {}) =>
  `<p:sp>${nv(id, `c${id}`)}<p:spPr>${xfrm(x, y, largura, altura)}`
  + `<a:prstGeom prst="roundRect"><a:avLst>`
  + `<a:gd name="adj" fmla="val ${adj}"/></a:avLst></a:prstGeom>`
  + (fundo ? `<a:solidFill>${cor(fundo, alfaFundo)}</a:solidFill>` : '<a:noFill/>')
  + (borda
    ? `<a:ln w="9525"><a:solidFill>${cor(borda, alfaBorda)}</a:solidFill></a:ln>`
    : '<a:ln><a:noFill/></a:ln>')
  + '</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p>'
  + '<a:endParaRPr lang="pt-BR"/></a:p></p:txBody></p:sp>';

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
      ? `<a:solidFill>${cor('accent1', '20000')}</a:solidFill><a:ln><a:noFill/></a:ln>`
      : `<a:noFill/><a:ln w="28575" cap="rnd">`
        + `<a:solidFill>${cor('accent1')}</a:solidFill><a:round/></a:ln>`)
    + '</p:spPr>'
    + '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="pt-BR"/></a:p>'
    + '</p:txBody></p:sp>';
}

/**
 * A CHAVE que abraça um bloco de linhas — o `{` do desenho à mão.
 *
 * `leftBrace` é forma pronta do DrawingML, e é por isso que ela é a escolha
 * certa: desenhar a curva num caminho livre daria uma chave que engorda quando o
 * bloco cresce, porque o traço acompanharia a escala da forma. A pronta mantém a
 * espessura e só estica.
 *
 * `adj1` é a curvatura da ponta e `adj2` onde fica o bico. Nos padrões, um bloco
 * alto sai com bico no meio e canto suave, que é como alguém a desenha.
 */
const chaveDeGrupo = (id, { x, y, largura, altura }, esquema = 'accent1') =>
  `<p:sp>${nv(id, `g${id}`)}<p:spPr>${xfrm(x, y, largura, altura)}`
  + '<a:prstGeom prst="leftBrace"><a:avLst>'
  + '<a:gd name="adj1" fmla="val 30000"/>'
  + '<a:gd name="adj2" fmla="val 50000"/></a:avLst></a:prstGeom>'
  + `<a:noFill/><a:ln w="15875" cap="rnd">`
  + `<a:solidFill>${cor(esquema, '80000')}</a:solidFill><a:round/></a:ln>`
  + '</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p>'
  + '<a:endParaRPr lang="pt-BR"/></a:p></p:txBody></p:sp>';

// As proporções da área. O gráfico fica com a maior parte porque é ele que
// responde a pergunta; a grade é a explicação, e explicação em corpo menor.
const ALTURA_LEGENDA = 0.24;
// Meio a meio entre o desenho e a tabela. Com 0,58 para o gráfico, as onze
// linhas de baixo ficavam com 0,19 polegada cada e o cartão do bloco menor não
// tinha altura para a frase que o explica.
const FATIA_GRAFICO = 0.52;
const ROTULO_MAX = 1.15;
const TOTAL_MAX = 1.25;
// A calha do grupo, à esquerda dos rótulos: o cartão com o nome e a frase, mais
// a chave. A primeira versão reservou uma polegada, e a frase transbordou por
// baixo do cartão e por cima do bloco seguinte — cartão estreito com texto
// dentro não encolhe o texto, ele o derrama.
const GRUPO_MAX = 1.75;
const CHAVE_LARGURA = 0.12;

// O respiro entre um bloco e o seguinte. Cálculo e cadastro são duas tabelas,
// e coladas elas leem como uma só de onze linhas — a tinta e a chave dizem que
// são duas, mas espaço é o que o olho entende antes de ler qualquer rótulo.
const FOLGA_BLOCO = 0.10;

// Quanto o desenho fica abaixo do subtítulo quando sobe para junto dele. Menos
// que isso e a pílula encosta no texto do modelo; mais e o espaço volta a
// sobrar, que é o que se está corrigindo.
const FOLGA_SUBTITULO = 0.16;

// Quanto uma letra ocupa, por ponto de corpo. É estimativa — o DrawingML não
// mede texto — e serve para decidir se a frase CABE antes de escrevê-la. Errar
// para mais é seguro: some a frase, e não o leiaute.
const LARGURA_LETRA = 0.0072;

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
export function areaDoVisual(retangulo, slide, {
  reservaTitulo = true, abaixoDe = null,
} = {}) {
  const r = retangulo ?? {
    x: pol(0.6), y: pol(1.15),
    largura: slide.largura - pol(1.2), altura: slide.altura - pol(2.0),
  };

  const tituloH = reservaTitulo
    ? Math.min(r.altura * FATIA_TITULO, pol(TITULO_MAX)) : 0;

  // SOBE PARA JUNTO DO SUBTÍTULO quando o texto foi para os campos do modelo.
  // A caixa marcada foi posicionada por alguém que contava escrever dentro
  // dela; com o título e o subtítulo no alto, a faixa entre eles e ela fica
  // vazia por construção — e era ali a maior mancha de branco do slide.
  //
  // Só sobe, nunca desce: se o subtítulo estiver mais baixo que a caixa (modelo
  // em que as duas se sobrepõem), vale a caixa, senão o desenho passaria por
  // cima do texto do modelo.
  const sobSubtitulo = abaixoDe
    ? abaixoDe.y + abaixoDe.altura + pol(FOLGA_SUBTITULO) : null;
  const topo = reservaTitulo || sobSubtitulo === null
    ? r.y + tituloH
    : Math.min(r.y, sobSubtitulo);

  const ateOFim = slide.altura - pol(MARGEM_INFERIOR) - topo;

  return {
    x: r.x,
    y: topo,
    largura: r.largura,
    // Com o topo mais alto, a altura tem que crescer junto: a caixa marcada
    // continua terminando onde terminava, e é o fim dela que manda.
    altura: Math.max(r.y + r.altura - topo, ateOFim, pol(1.5)),
  };
}

/**
 * Todas as formas do visual, prontas para entrar no `<p:spTree>`.
 *
 * `area` em EMU. `idBase` começa alto de propósito: id repetido com uma forma
 * que já existe no modelo faz o PowerPoint pedir reparo do arquivo.
 */
export function formasDoVisual({
  area, visual, idBase = 7000, fmt = String, pilulaAcima = null,
}) {
  if (!visual || !visual.pontos?.length) return '';

  const { x, y, largura, altura } = area;

  // ---- as três calhas -------------------------------------------------------
  // Elas valem para o gráfico E para a tabela: é isso que faz a barra de março
  // cair exatamente sobre a coluna de março lá embaixo.
  const rotulo = Math.min(pol(ROTULO_MAX), largura * 0.13);
  const temGrupo = visual.linhas.some((l) => l.grupo);
  const grupo = temGrupo ? Math.min(pol(GRUPO_MAX), largura * 0.135) : 0;
  const temTotal = visual.linhas.some((l) => l.total);
  const total = temTotal ? Math.min(pol(TOTAL_MAX), largura * 0.105) : 0;
  const calha = grupo + rotulo;

  // ---- as faixas horizontais ------------------------------------------------
  // A pílula do período só reserva faixa AQUI DENTRO quando não tem para onde
  // subir. Havendo a linha do subtítulo (`pilulaAcima`), ela vai para lá e o
  // desenho recupera a faixa inteira — era ela que empurrava o gráfico para
  // baixo por um dado de três palavras.
  const pilulaFora = Boolean(visual.rodape && pilulaAcima);
  const pilulaH = visual.rodape && !pilulaFora ? pol(0.30) : 0;
  const cartaoY = y + (pilulaH ? pilulaH + pol(0.08) : 0);
  const cartaoH = (altura - (cartaoY - y)) * FATIA_GRAFICO;
  const gradeY = cartaoY + cartaoH + pol(0.14);
  const gradeH = altura - (gradeY - y);

  const plot = {
    x: x + calha,
    y: cartaoY + pol(0.52),
    largura: largura - calha - total,
    altura: cartaoH - pol(0.52) - pol(0.20),
  };

  let id = idBase;
  const proximo = () => { id += 1; return id; };
  const saida = [];

  // ---- a pílula do período --------------------------------------------------
  // Fora do cartão e no canto oposto à legenda: é o "quando", e colado no "o
  // quê" as duas viram uma frase só que ninguém termina de ler.
  if (visual.rodape) {
    const w = Math.min(largura * 0.34,
                       pol(0.42) + visual.rodape.length * pol(0.072));
    // Alinhada pela DIREITA nos dois casos: é a borda que ela compartilha com a
    // coluna do ano e com o cartão do gráfico, e é o que faz a pílula parecer
    // parte do bloco em vez de um adesivo solto.
    const alturaPilula = pilulaFora
      ? Math.min(pilulaAcima.altura, pol(0.34)) : pilulaH;
    const caixaPilula = {
      x: x + largura - w,
      y: pilulaFora
        ? pilulaAcima.y + (pilulaAcima.altura - alturaPilula) / 2
        : y,
      largura: w,
      altura: alturaPilula,
    };
    saida.push(cartao(proximo(), caixaPilula, { fundo: 'accent1', adj: 50000 }));
    saida.push(caixa(proximo(), caixaPilula, visual.rodape.toUpperCase(), {
      tamanho: 800, negrito: true, esquema: 'bg1',
    }));
  }

  // ---- o cartão do gráfico --------------------------------------------------
  // Ele começa onde a TABELA começa, e não na borda da área: alinhado com a
  // calha do grupo, o cartão sobra quase três polegadas de vazio à esquerda
  // porque o desenho é obrigado a começar depois das duas calhas. Assim a borda
  // do cartão cai sobre a borda dos blocos, e o vazio que resta é a faixa dos
  // números do eixo — que é para o que ela serve.
  saida.push(cartao(proximo(),
    { x: x + grupo, y: cartaoY, largura: largura - grupo, altura: cartaoH },
    { fundo: 'bg1', borda: 'tx1', alfaBorda: '15000', adj: 4000 }));

  const maior = visual.pontos.reduce(
    (m, p) => Math.max(m, Number(p.capacidade) || 0, Number(p.demanda) || 0), 0);
  const eixo = escalaY(maior);

  const g = geometriaDoGrafico({
    x, y: plot.y, largura, altura: plot.altura,
    serie: visual.pontos, rotulo: calha, total, teto: eixo.teto,
    // Barra mais fina que a coluna: colada na vizinha ela vira uma parede, e o
    // que o desenho quer mostrar é a distância entre a barra e a linha.
    espessuraBarra: 0.5,
  });

  // ---- o eixo ---------------------------------------------------------------
  // As linhas de grade ANTES do desenho, para ficarem atrás dele: régua por cima
  // de barra risca justamente o número que a barra representa.
  const rotuloEixoW = pol(0.78);
  for (const marca of eixo.marcas) {
    const yv = g.yDe(marca);
    saida.push(retangulo(proximo(), {
      x: plot.x, y: yv, largura: plot.largura, altura: pol(0.006),
    }, 'tx1', marca === 0 ? '38000' : '12000'));
    saida.push(caixa(proximo(), {
      x: plot.x - rotuloEixoW - pol(0.08), y: yv - pol(0.09),
      largura: rotuloEixoW, altura: pol(0.18),
    }, fmt(marca), {
      tamanho: 700, alinhamento: 'r', esquema: 'tx1', alfa: '55000',
    }));
  }

  if (visual.unidade) {
    saida.push(caixa(proximo(), {
      x: plot.x - rotuloEixoW - pol(0.08), y: plot.y - pol(0.26),
      largura: rotuloEixoW, altura: pol(0.20),
    }, visual.unidade, {
      tamanho: 700, negrito: true, alinhamento: 'r', esquema: 'tx1',
      alfa: '65000',
    }));
  }

  // ---- a legenda ------------------------------------------------------------
  // Centrada sobre o desenho, e não encostada na esquerda: ela fala das duas
  // séries, e no canto pareceria falar só da primeira.
  const itens = [
    { esquema: 'accent1', texto: visual.rotuloCapacidade, tracinho: true },
    ...(visual.rotuloDemanda
      ? [{ esquema: 'accent2', texto: visual.rotuloDemanda }] : []),
  ];
  const larguraItem = (t) => pol(0.30) + t.length * pol(0.062);
  const larguraLegenda = itens.reduce(
    (w, i) => w + larguraItem(i.texto) + pol(0.20), -pol(0.20));

  let lx = plot.x + Math.max(0, (plot.largura - larguraLegenda) / 2);
  const legendaY = cartaoY + pol(0.12);
  for (const item of itens) {
    // A chave imita a forma da série: traço para a linha da capacidade, bloco
    // para a coluna da demanda. Chave que não se parece com o que representa
    // obriga a ler a legenda duas vezes.
    saida.push(retangulo(proximo(), item.tracinho
      ? { x: lx, y: legendaY + pol(0.09), largura: pol(0.20), altura: pol(0.035) }
      : { x: lx, y: legendaY + pol(0.03), largura: pol(0.13), altura: pol(0.15) },
    item.esquema));
    saida.push(caixa(proximo(), {
      x: lx + pol(0.28), y: legendaY,
      largura: larguraItem(item.texto), altura: pol(0.22),
    }, item.texto, {
      tamanho: 800, alinhamento: 'l', esquema: 'tx1', alfa: '75000',
    }));
    lx += larguraItem(item.texto) + pol(0.20);
  }

  // ---- o gráfico ------------------------------------------------------------
  // A ÁREA PRIMEIRO, as barras depois, a linha por último: o DrawingML pinta na
  // ordem do documento. Área por cima cobriria a demanda com uma camada
  // translúcida; linha por baixo deixaria o teto encoberto pela barra.
  saida.push(poligonal(proximo(), plot, g.poligono, true));
  for (const b of g.barras) {
    if (b.altura > 0) saida.push(retangulo(proximo(), b, 'accent2'));
  }
  saida.push(poligonal(proximo(), plot, g.pontos));

  // ---- a grade --------------------------------------------------------------
  // Cada bloco é uma corrida de linhas seguidas com o mesmo grupo. A marca é de
  // POSIÇÃO na tabela, não de categoria: o mesmo nome em dois trechos separados
  // sai como duas marcas, que é o certo.
  //
  // Calculado ANTES das faixas porque agora ele decide onde a altura é gasta: o
  // respiro entre blocos sai do total, e a divisão precisa saber quantos são.
  const blocos = [];
  visual.linhas.forEach((l, i) => {
    const ultimo = blocos[blocos.length - 1];
    if (l.grupo && ultimo && ultimo.nome === l.grupo && ultimo.fim === i - 1) {
      ultimo.fim = i;
    } else if (l.grupo) {
      blocos.push({ nome: l.grupo, ini: i, fim: i });
    }
  });

  const faixas = faixasDaGrade({
    x, y: gradeY, largura, altura: gradeH, quantas: visual.linhas.length,
    // O respiro vai onde um bloco COMEÇA, menos o primeiro: antes dele quem
    // separa é a faixa cheia do cabeçalho dos meses.
    quebras: blocos.slice(1).map((b) => b.ini),
    folga: pol(FOLGA_BLOCO),
  });
  const cols = colunas(x, largura, visual.pontos.length, calha, total);
  const colTotal = temTotal ? colunaTotal(x, largura, total) : null;

  // O cabeçalho dos meses é uma faixa cheia, e é o ÚNICO lugar onde o mês
  // aparece: ele nomeia a coluna do gráfico logo acima e a da tabela logo
  // abaixo. Escrito nos dois, seria a mesma palavra duas vezes na vertical.
  const cab = faixas[0];
  saida.push(cartao(proximo(), {
    x: plot.x, y: cab.y, largura: plot.largura, altura: cab.altura,
  }, { fundo: 'accent1', adj: 12000 }));
  if (colTotal) {
    saida.push(cartao(proximo(), {
      x: colTotal.x + pol(0.03), y: cab.y,
      largura: colTotal.largura - pol(0.03), altura: cab.altura,
    }, { fundo: 'accent1', adj: 12000 }));
  }

  // Tinta em vez de moldura para separar os blocos: moldura vira mais uma borda
  // no meio de uma tabela que já é feita de bordas.
  const tintaDoBloco = (i) => (i === 0
    ? { esquema: 'accent1', alfa: '09000' }
    : { esquema: 'tx1', alfa: '06000' });

  blocos.forEach((b, i) => {
    const topo = faixas[b.ini].y;
    const base = faixas[b.fim].y + faixas[b.fim].altura;
    const tinta = tintaDoBloco(i);

    saida.push(cartao(proximo(), {
      x: x + grupo, y: topo, largura: largura - grupo, altura: base - topo,
    }, { fundo: tinta.esquema, alfaFundo: tinta.alfa, adj: 5000 }));

    // O cartão da esquerda: o nome do bloco e, embaixo, o que ele é. Quem lê o
    // slide não tem a quem perguntar o que "cadastros" quer dizer.
    //
    // Um respiro de cada lado na vertical, senão os dois cartões se encostam e
    // viram um retângulo comprido com dois títulos dentro.
    const cartaoW = grupo - pol(CHAVE_LARGURA) - pol(0.26);
    const cartaoY2 = topo + pol(0.03);
    const cartaoH2 = base - topo - pol(0.06);
    saida.push(cartao(proximo(), {
      x, y: cartaoY2, largura: cartaoW, altura: cartaoH2,
    }, { fundo: tinta.esquema, alfaFundo: '14000', adj: 9000 }));

    const pad = pol(0.11);
    const tituloH = pol(0.22);
    saida.push(caixa(proximo(), {
      x: x + pad, y: cartaoY2 + pol(0.07),
      largura: cartaoW - pad * 2, altura: tituloH,
    }, String(b.nome).toUpperCase(), {
      // CENTRADO, e não encostado na esquerda. Num cartão estreito e alto o
      // rótulo à esquerda fica pendurado num canto, e os dois cartões param de
      // parecer um par — que é justamente o que eles são.
      tamanho: 900, negrito: true, alinhamento: 'ctr',
      esquema: tinta.esquema, ancora: 't',
    }));

    // A FRASE SÓ ENTRA SE COUBER. Sem esta conta ela derrama por baixo do
    // cartão e escreve por cima do bloco de baixo — foi exatamente o que
    // aconteceu quando a calha era estreita.
    const descricao = visual.grupos?.[b.nome];
    const sobra = cartaoH2 - tituloH - pol(0.14);
    const corpo = 600;
    const larguraTexto = cartaoW - pad * 2;
    const porLinha = Math.max(1, larguraTexto / pol(LARGURA_LETRA * corpo / 100));
    const linhasDaFrase = Math.ceil((descricao?.length ?? 0) / porLinha);
    const alturaLinha = pol(0.092);

    if (descricao && linhasDaFrase * alturaLinha <= sobra) {
      saida.push(caixa(proximo(), {
        x: x + pad, y: cartaoY2 + pol(0.07) + tituloH,
        largura: larguraTexto, altura: sobra,
      }, descricao, {
        tamanho: corpo, alinhamento: 'ctr', esquema: 'tx1', alfa: '70000',
        ancora: 't', entrelinha: '86000',
      }));
    }

    // A chave entre o cartão e as linhas, com folga vertical para a ponta não
    // encostar no primeiro e no último número.
    saida.push(chaveDeGrupo(proximo(), {
      x: x + grupo - pol(CHAVE_LARGURA) - pol(0.08),
      y: topo + pol(0.04),
      largura: pol(CHAVE_LARGURA),
      altura: Math.max(pol(0.12), base - topo - pol(0.08)),
    }, tinta.esquema));
  });

  // ---- as linhas ------------------------------------------------------------
  visual.linhas.forEach((linha, i) => {
    const f = faixas[i];

    // Régua só entre linhas de dado do mesmo bloco: embaixo do cabeçalho e na
    // virada de bloco quem separa é a faixa cheia e a troca de tinta, e uma
    // régua ali seria a terceira marca dizendo a mesma coisa.
    if (i > 1 && !blocos.some((b) => b.ini === i)) {
      saida.push(retangulo(proximo(), {
        x: x + grupo, y: f.y, largura: largura - grupo, altura: pol(0.006),
      }, 'tx1', '13000'));
    }

    if (linha.rotulo) {
      saida.push(caixa(proximo(), {
        x: x + grupo + pol(0.10), y: f.y,
        largura: rotulo - pol(0.20), altura: f.altura,
      }, linha.rotulo, {
        tamanho: 750, alinhamento: 'l', esquema: 'tx1', alfa: '80000',
      }));
    }

    const estilo = (pintada) => ({
      tamanho: linha.cabecalho ? 800 : 750,
      negrito: Boolean(linha.cabecalho) || Boolean(pintada),
      // No cabeçalho o texto vai sobre a faixa cheia, então ele é o claro.
      esquema: linha.cabecalho ? 'bg1' : (pintada ?? 'tx1'),
    });

    linha.valores.forEach((v, j) => {
      if (v === '' || v === null || v === undefined) return;
      // A cor pinta O NÚMERO, e não o fundo: faixa colorida atrás dele vira
      // tarja, e tarja no meio de uma grade de porcentagens compete com o
      // gráfico em vez de ajudá-lo a ser lido.
      saida.push(caixa(proximo(), {
        x: cols[j].x, y: f.y, largura: cols[j].largura, altura: f.altura,
      }, v, estilo(linha.cores?.[j])));
    });

    // O total em negrito em toda linha: é a coluna que se procura primeiro, e
    // ela está longe do rótulo da esquerda.
    if (colTotal && linha.total) {
      saida.push(caixa(proximo(), {
        x: colTotal.x, y: f.y, largura: colTotal.largura, altura: f.altura,
      }, linha.total, { ...estilo(linha.corTotal), negrito: true }));
    }
  });

  return saida.join('');
}
