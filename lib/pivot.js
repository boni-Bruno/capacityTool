// =============================================================================
// TABELA DINÂMICA
//
// Agrupa linhas por uma sequência de campos (planta › CC › CT › mês…), calcula
// uma agregação por medida em cada grupo e devolve a árvore pronta para uma
// tela abrir e fechar. É o que o Excel chama de tabela dinâmica, sem o Excel.
//
// A AGREGAÇÃO É SOBRE AS LINHAS DO GRÃO, nunca sobre os subtotais dos filhos.
// "Média" num CC é a média das linhas CT × mês daquele CC — como o Excel faz
// com a tabela de origem. Média dos subtotais dos filhos daria outro número,
// e um que muda conforme a ordem em que a pessoa empilhou os níveis.
//
// AS RAZÕES NÃO SE AGREGAM. Ocupação, % do teto e OEE são sempre a soma do
// numerador sobre a soma do denominador do grupo — divisão de somas, a regra
// do projeto. A função escolhida vale para as medidas em minutos; a razão fica
// do lado dizendo o que é. Média de ocupações não é ocupação, e mediana de
// máximos não é nada.
//
// Motor puro: sem banco, sem tela, sem formatação. Roda no navegador.
// =============================================================================

export const AGREGACOES = [
  { valor: 'soma',     rotulo: 'Soma' },
  { valor: 'media',    rotulo: 'Média' },
  { valor: 'mediana',  rotulo: 'Mediana' },
  { valor: 'maximo',   rotulo: 'Máximo' },
  { valor: 'minimo',   rotulo: 'Mínimo' },
  { valor: 'contagem', rotulo: 'Contagem' },
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Uma agregação sobre uma lista de números. Lista vazia devolve nulo. */
export function agrega(valores, fn = 'soma') {
  const v = (valores ?? []).map(num);
  if (fn === 'contagem') return v.length;
  if (!v.length) return null;
  switch (fn) {
    case 'media':  return v.reduce((s, x) => s + x, 0) / v.length;
    case 'maximo': return Math.max(...v);
    case 'minimo': return Math.min(...v);
    case 'mediana': {
      const o = [...v].sort((a, b) => a - b);
      const meio = Math.floor(o.length / 2);
      return o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2;
    }
    default: return v.reduce((s, x) => s + x, 0);
  }
}

const SEP = '';

/**
 * Monta a árvore.
 *
 * `linhas`  — as linhas do grão (CT × mês, recurso × mês…), objetos planos.
 * `niveis`  — os campos que viram níveis, na ordem: ['planta', 'cc', 'mes'].
 * `medidas` — [{ campo, fn }]: a agregação de cada medida.
 * `razoes`  — [{ nome, num, den }]: calculadas como Σnum ÷ Σden do grupo.
 *
 * Devolve a raiz — o total — com `filhos` recursivos. Cada nó tem `chave`
 * (o caminho, único na árvore), `valor` (o rótulo do nível), `n` (linhas do
 * grão embaixo dele), `medidas`, `somas` e `razoes`.
 *
 * Os filhos saem ORDENADOS pelo valor: número como número, texto como texto
 * em português. Mês chega como 'AAAA-MM-01' e ordena sozinho.
 */
export function montarPivot(linhas, { niveis = [], medidas = [], razoes = [] } = {}) {
  const raiz = novoNo('', null, -1);

  for (const l of linhas ?? []) {
    let no = raiz;
    no.linhas.push(l);
    niveis.forEach((campo, i) => {
      const valor = l[campo] ?? '';
      const chave = no.chave ? `${no.chave}${SEP}${valor}` : String(valor);
      let filho = no.indice.get(String(valor));
      if (!filho) {
        filho = novoNo(chave, valor, i);
        filho.campo = campo;
        no.indice.set(String(valor), filho);
        no.filhos.push(filho);
      }
      filho.linhas.push(l);
      no = filho;
    });
  }

  fechar(raiz, medidas, razoes);
  return raiz;
}

function novoNo(chave, valor, nivel) {
  return {
    chave, valor, nivel, campo: null, filhos: [], indice: new Map(), linhas: [],
    n: 0, medidas: {}, somas: {}, razoes: {},
  };
}

// Calcula os números de cada nó e ordena os filhos. `indice` e `linhas`
// saem no fim: a tela não precisa deles, e linhas repetidas em cada nó da
// árvore seriam o mesmo dado copiado uma vez por nível.
function fechar(no, medidas, razoes) {
  no.n = no.linhas.length;
  for (const m of medidas) {
    const valores = no.linhas.map((l) => num(l[m.campo]));
    no.somas[m.campo] = valores.reduce((s, x) => s + x, 0);
    no.medidas[m.campo] = agrega(valores, m.fn);
  }
  for (const r of razoes) {
    const cima = no.linhas.reduce((s, l) => s + num(l[r.num]), 0);
    const baixo = no.linhas.reduce((s, l) => s + num(l[r.den]), 0);
    no.razoes[r.nome] = baixo === 0 ? null : cima / baixo;
  }
  no.filhos.sort((a, b) => comparaValor(a.valor, b.valor));
  for (const f of no.filhos) fechar(f, medidas, razoes);
  delete no.indice;
  delete no.linhas;
}

function comparaValor(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b), 'pt-BR');
}

/**
 * A árvore como lista de linhas para desenhar, respeitando o que está aberto.
 *
 * `abertos` é o conjunto de chaves abertas; a raiz sai sempre e é a linha de
 * total. Um nó fechado sai sem os filhos. `temFilhos` diz se cabe um botão.
 */
export function achatar(raiz, abertos = new Set()) {
  const saida = [];
  const anda = (no, profundidade) => {
    const temFilhos = no.filhos.length > 0;
    const aberto = no === raiz || abertos.has(no.chave);
    saida.push({ no, profundidade, temFilhos, aberto });
    if (aberto) for (const f of no.filhos) anda(f, profundidade + 1);
  };
  anda(raiz, 0);
  return saida;
}

/** Todas as chaves de nós com filhos — para "expandir tudo". */
export function chavesComFilhos(raiz) {
  const s = new Set();
  const anda = (no) => {
    if (no.filhos.length && no.chave) s.add(no.chave);
    no.filhos.forEach(anda);
  };
  anda(raiz);
  return s;
}

/** As chaves dos nós até uma profundidade (1 = só o primeiro nível aberto). */
export function chavesAteNivel(raiz, nivel) {
  const s = new Set();
  const anda = (no) => {
    if (no.chave && no.nivel < nivel - 1 && no.filhos.length) s.add(no.chave);
    no.filhos.forEach(anda);
  };
  anda(raiz);
  return s;
}

/**
 * Lê "planta,cc,ct" da URL: só campos conhecidos, sem repetição, na ordem em
 * que vieram. Vazio ou inválido cai no padrão.
 */
export function leNiveis(texto, conhecidos, padrao) {
  const lista = String(texto ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const validos = [];
  for (const c of lista) {
    if (conhecidos.includes(c) && !validos.includes(c)) validos.push(c);
  }
  return validos.length ? validos : [...padrao];
}

/** Lê a função de uma medida da URL; desconhecida vira soma. */
export function leAgregacao(texto) {
  return AGREGACOES.some((a) => a.valor === texto) ? texto : 'soma';
}
