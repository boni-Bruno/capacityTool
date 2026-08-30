// =============================================================================
// PREENCHER UM SLIDE DE UM MODELO .PPTX
//
// O modelo é do Bruno: cores, fontes, logotipo, ordem dos slides. Um dos slides
// leva a marca `{{CAPACITY_TOOL}}` numa caixa de texto, e é ali que o conteúdo
// entra.
//
// SUBSTITUI O PARÁGRAFO, E NÃO O ARQUIVO. Gerar um slide do zero significaria
// escolher fonte, tamanho e cor — ou seja, ignorar o modelo que existe
// justamente para não ter que escolher. Aqui o parágrafo da marca é clonado uma
// vez por linha de conteúdo, com as propriedades dele intactas: o texto novo sai
// com a formatação que o modelo já tinha.
//
// A MARCA É TOKEN, e não posição nem título. Ela sobrevive a mover, renomear e
// reordenar slides — e quando não existe, dá para dizer isso com todas as
// letras em vez de escrever no slide errado.
//
// Sem imports e sem banco: recebe o XML como texto e devolve texto.
// =============================================================================

export const MARCA = '{{CAPACITY_TOOL}}';

/** Os slides de um .pptx já aberto, na ordem em que o arquivo os numera. */
export function slidesDo(arquivos) {
  return [...arquivos.keys()]
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));
}

const decodifica = (bytes) =>
  (typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes));

/**
 * Onde está a marca.
 *
 * A busca é no XML cru porque o PowerPoint às vezes parte um texto em vários
 * `<a:t>` — quando alguém digitou e corrigiu no meio, por exemplo. Antes de
 * procurar, os `</a:t>...<a:t>` são costurados de volta; sem isso a marca
 * digitada em duas etapas não seria encontrada, e a tela diria que o modelo não
 * tem marca nenhuma.
 */
export function acharSlideMarcado(arquivos) {
  for (const nome of slidesDo(arquivos)) {
    if (costura(decodifica(arquivos.get(nome))).includes(MARCA)) return nome;
  }
  return null;
}

export const costura = (xml) =>
  String(xml).replace(/<\/a:t>\s*<\/a:r>\s*<a:r>(?:(?!<a:t>).)*?<a:t>/g, '');

const escapa = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// De onde o parágrafo da marca começa e termina. Achar `<a:p` para trás e
// `</a:p>` para frente é o suficiente: `<a:p>` não aninha em DrawingML.
function limitesDoParagrafo(xml, posicao) {
  const abre = xml.lastIndexOf('<a:p>', posicao);
  const abreCurto = xml.lastIndexOf('<a:p ', posicao);
  const inicio = Math.max(abre, abreCurto);
  const fim = xml.indexOf('</a:p>', posicao);
  if (inicio < 0 || fim < 0) return null;
  return { inicio, fim: fim + '</a:p>'.length };
}

/**
 * Troca a marca por uma lista de linhas.
 *
 * Cada linha vira um parágrafo com a mesma formatação do parágrafo que tinha a
 * marca. Linha marcada como `forte` ganha negrito por cima do que o modelo
 * definiu — é o que separa o título de uma seção do conteúdo dela sem inventar
 * fonte nem tamanho.
 *
 * Lista vazia deixa um parágrafo em branco: apagar a caixa inteira mexeria no
 * leiaute do modelo, que não é nosso para mexer.
 */
export function preencheSlide(xml, linhas) {
  const texto = costura(decodifica(xml));
  const onde = texto.indexOf(MARCA);
  if (onde < 0) return { xml: texto, trocou: false };

  const lim = limitesDoParagrafo(texto, onde);
  if (!lim) return { xml: texto, trocou: false };

  const modelo = texto.slice(lim.inicio, lim.fim);
  const lista = (linhas ?? []).length ? linhas : [{ texto: '' }];

  const novos = lista.map((l) => {
    const conteudo = typeof l === 'string' ? l : (l.texto ?? '');
    let p = modelo.replace(
      />[^<]*</g,
      (m) => m,
    );
    // O texto de dentro do `<a:t>` é o único lugar que muda. O resto do
    // parágrafo — `<a:pPr>`, `<a:rPr>`, espaçamento — vai inteiro, e é o que
    // faz a linha nova sair com a cara do modelo.
    p = p.replace(/(<a:t>)[\s\S]*?(<\/a:t>)/, `$1${escapa(conteudo)}$2`);

    if (typeof l === 'object' && l.forte) {
      // b="1" no `<a:rPr>` que já existe; se não existir, um mínimo é criado
      // dentro do `<a:r>`, que é onde o DrawingML o espera.
      p = /<a:rPr\b/.test(p)
        ? p.replace(/<a:rPr\b([^>]*?)(\/?)>/, (m, attrs, fecha) =>
          (/\bb="/.test(attrs) ? m : `<a:rPr${attrs} b="1"${fecha}>`))
        : p.replace(/<a:r>/, '<a:r><a:rPr lang="pt-BR" b="1"/>');
    }
    return p;
  });

  return {
    xml: texto.slice(0, lim.inicio) + novos.join('') + texto.slice(lim.fim),
    trocou: true,
  };
}

/**
 * O RETÂNGULO DA CAIXA QUE TEM A MARCA — a área que o sistema pode pintar.
 *
 * A marca já diz "o conteúdo do capacity tool entra aqui"; usar a geometria da
 * própria caixa faz o desenho seguir quem a moveu ou redimensionou no modelo.
 * A alternativa seria uma posição fixa em código, que estaria errada no dia em
 * que o modelo ganhasse uma faixa lateral — e errada em silêncio, por cima do
 * logotipo.
 *
 * Nulo quando a caixa herda a geometria do leiaute e não a declara. Quem chama
 * decide o que fazer com isso; aqui não dá para adivinhar.
 */
export function retanguloDoSlideMarcado(xml) {
  const t = costura(decodifica(xml));
  for (const m of t.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    if (!m[0].includes(MARCA)) continue;
    const off = m[0].match(/<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>/);
    const ext = m[0].match(/<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/);
    if (!off || !ext) return null;
    return {
      x: Number(off[1]), y: Number(off[2]),
      largura: Number(ext[1]), altura: Number(ext[2]),
    };
  }
  return null;
}

/** O tamanho do slide em EMU, que é o limite de tudo que se desenha nele. */
export function tamanhoDoSlide(arquivos) {
  const m = decodifica(arquivos.get('ppt/presentation.xml') ?? '')
    .match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  // 13,333 × 7,5 polegadas: o 16:9 que o PowerPoint usa por padrão desde 2013.
  // Chutar é melhor que falhar — sem tamanho não dá para desenhar nada.
  return m
    ? { largura: Number(m[1]), altura: Number(m[2]) }
    : { largura: 12192000, altura: 6858000 };
}

/**
 * Põe formas novas no slide, por cima do que já existe.
 *
 * No fim do `<p:spTree>` porque o DrawingML desenha na ordem do documento: quem
 * vem depois fica em cima. Antes, o gráfico sairia atrás da imagem de fundo do
 * modelo — presente e invisível.
 */
export function insereFormas(xml, formas) {
  const t = decodifica(xml);
  if (!formas) return t;
  return t.replace('</p:spTree>', `${formas}</p:spTree>`);
}

// =============================================================================
// UM SLIDE POR GRUPO
//
// Um documento de um slide só serve para o resumo do recorte. Para falar de CT
// em CT, ou de CC em CC, o mesmo slide precisa aparecer várias vezes — e a
// única cópia fiel de um slide do modelo é ele mesmo.
//
// CLONAR É MAIS DO QUE COPIAR O .xml. Um slide do .pptx é citado em quatro
// lugares, e faltar em qualquer um deles dá o mesmo estrago: o PowerPoint diz
// que a apresentação está corrompida e oferece reparar, o que costuma
// significar perder o slide.
//
//   ppt/slides/slideN.xml            o conteúdo
//   ppt/slides/_rels/slideN.xml.rels o leiaute e as imagens que ele usa
//   [Content_Types].xml              o tipo da parte
//   ppt/_rels/presentation.xml.rels  o vínculo com a apresentação
//   ppt/presentation.xml             a POSIÇÃO dele na ordem dos slides
//
// O original é reaproveitado como o primeiro do lote: assim o slide da marca
// continua exatamente onde o Bruno o pôs, e as cópias nascem logo depois dele —
// entre a capa e o que vier a seguir, e não no fim do arquivo.
// =============================================================================

const TIPO_SLIDE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
const TIPO_CONTEUDO =
  'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';

const escapaRe = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// O maior número já usado num padrão, para o próximo nascer livre. Contar
// quantos existem não serve: um modelo com slide1 e slide7 tem dois slides e o
// próximo livre é o 8.
function proximo(texto, re, minimo = 1) {
  let maior = minimo - 1;
  for (const m of String(texto).matchAll(re)) {
    maior = Math.max(maior, Number(m[1]));
  }
  return maior + 1;
}

/**
 * Faz o slide da marca virar `quantas` slides iguais, e devolve os nomes deles
 * na ordem — o primeiro é o original.
 *
 * Muda o Map recebido, que é o mesmo que sai do `lerZip` e volta para o
 * `escreveZip`. Devolve `null` quando não há marca, para a tela poder dizer
 * isso com todas as letras.
 */
export function clonaSlideMarcado(arquivos, quantas) {
  const alvo = acharSlideMarcado(arquivos);
  if (!alvo) return null;

  const n = Math.max(1, Math.floor(Number(quantas) || 1));
  if (n === 1) return [alvo];

  const nomeApres = 'ppt/presentation.xml';
  const nomeRels = 'ppt/_rels/presentation.xml.rels';
  const nomeTipos = '[Content_Types].xml';

  let apres = decodifica(arquivos.get(nomeApres) ?? '');
  let rels = decodifica(arquivos.get(nomeRels) ?? '');
  let tipos = decodifica(arquivos.get(nomeTipos) ?? '');
  if (!apres || !rels || !tipos) {
    throw new Error('O modelo não tem as partes que descrevem a apresentação. '
      + 'Salve-o de novo como .pptx pelo PowerPoint e importe outra vez.');
  }

  // O vínculo do slide da marca com a apresentação: é a partir da posição dele
  // que as cópias entram.
  const base = alvo.split('/').pop();
  const relAlvo = rels.match(
    new RegExp(`<Relationship\\b[^>]*Target="[^"]*${escapaRe(base)}"[^>]*/>`));
  const idAlvo = relAlvo?.[0].match(/\bId="([^"]+)"/)?.[1];
  const posNaOrdem = idAlvo
    ? apres.match(new RegExp(`<p:sldId\\b[^>]*r:id="${escapaRe(idAlvo)}"[^>]*/>`))
    : null;
  if (!posNaOrdem) {
    throw new Error('Não achei o slide da marca na ordem da apresentação. '
      + 'Salve o modelo de novo pelo PowerPoint e importe outra vez.');
  }

  const conteudo = arquivos.get(alvo);
  const relsDoAlvo = arquivos.get(`ppt/slides/_rels/${base}.rels`);

  let numero = proximo(
    [...arquivos.keys()].join(' '), /ppt\/slides\/slide(\d+)\.xml\b/g);
  let rid = proximo(rels, /\bId="rId(\d+)"/g);
  // 256 é o menor que o formato aceita; abaixo disso o arquivo não abre.
  let sldId = proximo(apres, /<p:sldId\b[^>]*\bid="(\d+)"/g, 256);

  const nomes = [alvo];
  const ordem = [];

  for (let i = 1; i < n; i++) {
    const nome = `ppt/slides/slide${numero}.xml`;
    arquivos.set(nome, conteudo);

    if (relsDoAlvo !== undefined) {
      // As anotações do orador ficam para trás de propósito: uma notesSlide
      // aponta de volta para UM slide, e duas cópias citando a mesma nota é
      // exatamente o vínculo cruzado que faz o PowerPoint pedir reparo.
      arquivos.set(
        `ppt/slides/_rels/slide${numero}.xml.rels`,
        new TextEncoder().encode(
          decodifica(relsDoAlvo).replace(
            /<Relationship\b[^>]*relationships\/notesSlide"[^>]*\/>/g, '')));
    }

    tipos = tipos.replace('</Types>',
      `<Override PartName="/${nome}" ContentType="${TIPO_CONTEUDO}"/></Types>`);
    rels = rels.replace('</Relationships>',
      `<Relationship Id="rId${rid}" Type="${TIPO_SLIDE}" `
      + `Target="slides/slide${numero}.xml"/></Relationships>`);
    ordem.push(`<p:sldId id="${sldId}" r:id="rId${rid}"/>`);

    nomes.push(nome);
    numero += 1;
    rid += 1;
    sldId += 1;
  }

  arquivos.set(nomeApres, new TextEncoder().encode(
    apres.replace(posNaOrdem[0], posNaOrdem[0] + ordem.join(''))));
  arquivos.set(nomeRels, new TextEncoder().encode(rels));
  arquivos.set(nomeTipos, new TextEncoder().encode(tipos));

  return nomes;
}

/**
 * O conteúdo em linhas, a partir das seções.
 *
 * Uma seção é `{ titulo, linhas }`. O achatamento acontece aqui, e não na tela,
 * porque é a mesma lista que alimenta o .pptx e a página de impressão — duas
 * montagens do mesmo texto acabariam divergindo numa delas.
 */
export function linhasDasSecoes(secoes) {
  const saida = [];
  for (const s of secoes ?? []) {
    if (saida.length) saida.push({ texto: '' });
    saida.push({ texto: s.titulo, forte: true });
    for (const l of s.linhas ?? []) saida.push({ texto: l });
  }
  return saida;
}
