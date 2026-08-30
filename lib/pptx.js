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
