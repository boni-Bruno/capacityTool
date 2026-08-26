// =============================================================================
// OS FILTROS DE COLUNA
//
// Um filtro é um campo, um operador e uma lista de valores. Ele mora na URL,
// como todo o resto do painel, e vale ao mesmo tempo para a barra de cima e
// para o botãozinho no cabeçalho da coluna — os dois escrevem no mesmo lugar,
// então nunca discordam.
//
// PURO E SEM BANCO. Filtro que recorta errado não dá erro em lugar nenhum: ele
// mostra menos, e o total menor parece capacidade menor. É exatamente o tipo de
// coisa que precisa de teste.
//
// NA URL: `f_cc=in:278,401`. O nome do campo vem depois de `f_`, o operador
// antes dos dois-pontos, e os valores separados por vírgula. Vírgula dentro de
// um valor é escapada com `\\,` — nome de recurso com vírgula existe, e sem isso
// ele viraria dois filtros silenciosamente.
// =============================================================================

export const OPERADORES = [
  { codigo: 'in',      nome: 'é um de',          lista: true },
  { codigo: 'nin',     nome: 'não é nenhum de',  lista: true },
  { codigo: 'contem',  nome: 'contém',           texto: true },
  { codigo: 'ncontem', nome: 'não contém',       texto: true },
  { codigo: 'comeca',  nome: 'começa com',       texto: true },
  { codigo: 'termina', nome: 'termina com',      texto: true },
  { codigo: 'vazio',   nome: 'está vazio' },
  { codigo: 'nvazio',  nome: 'não está vazio' },
];

const CODIGOS = OPERADORES.map((o) => o.codigo);

export const ehLista = (op) =>
  Boolean(OPERADORES.find((o) => o.codigo === op)?.lista);
export const ehTexto = (op) =>
  Boolean(OPERADORES.find((o) => o.codigo === op)?.texto);

// Sem acento e sem caixa: quem filtra digita "cotton" e o cadastro traz "COTTON
// FLOW". Recusar isso seria implicância, e o erro que ela geraria — filtro que
// não acha nada — é o mais difícil de perceber.
const achata = (v) => String(v ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const escapa = (v) => String(v).replace(/\\/g, '\\\\').replace(/,/g, '\\,');

// Separa por vírgula respeitando a barra invertida.
function separa(texto) {
  const saida = [];
  let atual = '';
  let escapando = false;
  for (const c of String(texto ?? '')) {
    if (escapando) { atual += c; escapando = false; continue; }
    if (c === '\\') { escapando = true; continue; }
    if (c === ',') { saida.push(atual); atual = ''; continue; }
    atual += c;
  }
  saida.push(atual);
  return saida.filter((x) => x !== '');
}

/** "in:278,401" -> { op: 'in', valores: ['278','401'] }. Lixo vira null. */
export function leFiltro(texto) {
  const t = String(texto ?? '');
  const corte = t.indexOf(':');
  const op = corte === -1 ? t : t.slice(0, corte);
  if (!CODIGOS.includes(op)) return null;

  const valores = corte === -1 ? [] : separa(t.slice(corte + 1));
  // Operador que precisa de valor e não tem não filtra nada — e um filtro que
  // não filtra, mas aparece ligado na tela, é pior que nenhum.
  if ((ehLista(op) || ehTexto(op)) && !valores.length) return null;
  return { op, valores };
}

export const escreveFiltro = (f) =>
  (!f?.op ? '' : `${f.op}:${(f.valores ?? []).map(escapa).join(',')}`);

/** Todos os `f_*` de uma query, já validados. */
export function leFiltros(searchParams, campos) {
  const saida = {};
  for (const campo of campos ?? []) {
    const f = leFiltro(searchParams?.[`f_${campo}`]);
    if (f) saida[campo] = f;
  }
  return saida;
}

/** Uma linha passa por um filtro? */
export function passaFiltro(valor, filtro) {
  if (!filtro?.op) return true;
  const vazio = valor === null || valor === undefined || String(valor).trim() === '';

  if (filtro.op === 'vazio') return vazio;
  if (filtro.op === 'nvazio') return !vazio;

  const v = achata(valor);
  const alvos = (filtro.valores ?? []).map(achata);
  if (!alvos.length) return true;

  switch (filtro.op) {
    // Vazio não é nenhum dos valores listados, então ele PASSA no "não é
    // nenhum de" — e some no "é um de". Tratar o vazio como "não sei" faria a
    // soma dos dois recortes não dar o todo.
    case 'in':      return !vazio && alvos.includes(v);
    case 'nin':     return vazio || !alvos.includes(v);
    case 'contem':  return !vazio && alvos.some((a) => v.includes(a));
    case 'ncontem': return vazio || !alvos.some((a) => v.includes(a));
    case 'comeca':  return !vazio && alvos.some((a) => v.startsWith(a));
    case 'termina': return !vazio && alvos.some((a) => v.endsWith(a));
    default:        return true;
  }
}

/**
 * A linha passa por TODOS os filtros — E entre campos, OU dentro de um campo.
 *
 * É a leitura que todo mundo espera de uma barra de filtros: estreitar a cada
 * escolha. Vários valores no mesmo campo alargam, porque "CC 278 e CC 401"
 * pedidos juntos só podem querer dizer os dois.
 */
export function passaTodos(linha, filtros) {
  for (const [campo, f] of Object.entries(filtros ?? {})) {
    if (!passaFiltro(linha?.[campo], f)) return false;
  }
  return true;
}

/** O filtro em uma frase, para a tela dizer o que está recortando. */
export function descreveFiltro(rotulo, filtro) {
  if (!filtro?.op) return '';
  const nome = OPERADORES.find((o) => o.codigo === filtro.op)?.nome ?? filtro.op;
  if (!filtro.valores?.length) return `${rotulo} ${nome}`;
  const lista = filtro.valores.length > 3
    ? `${filtro.valores.slice(0, 3).join(', ')} e mais ${filtro.valores.length - 3}`
    : filtro.valores.join(', ');
  return `${rotulo} ${nome} ${lista}`;
}
