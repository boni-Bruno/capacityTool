// =============================================================================
// O MOTOR DE CLASSIFICAÇÃO DA DEMANDA
//
// Traduz a língua da base para a língua da empresa: renomeia, agrupa, e decide
// por condição — "TECIDO CRU FELPUDO E família 225 são Banho Jacquard".
//
// PURO E SEM BANCO, de propósito. É o mesmo código que roda na tela para
// mostrar a prévia antes de gravar e no servidor para classificar de verdade —
// duas implementações da mesma regra acabariam divergindo, e a divergência
// apareceria como um número diferente do que a prévia prometeu.
//
// ELE NÃO RODA SOBRE AS 116 MIL LINHAS. Os seis atributos que as regras
// enxergam formam 1.279 combinações distintas na base inteira, 91 vezes menos.
// Classificar a combinação e depois multiplicar pelas linhas dá o mesmo
// resultado por muito menos trabalho — e é o que permite a prévia ser exata e
// instantânea em vez de uma amostra.
//
// SE...E / SE...OU SEM PARÊNTESES. As condições vêm em blocos: dentro do bloco
// tudo é E, entre blocos é OU. Isso é forma normal disjuntiva, cobre qualquer
// combinação que alguém vá querer escrever, e na tela vira dois botões em vez
// de uma linguagem para aprender.
// =============================================================================

// Os atributos que as regras podem ler. `familia_produto` (167 valores) e
// `tecido_base` (508) ficam de fora pela mesma razão que descartou o grão de
// SKU: cadastro que ninguém mantém é pior que cadastro nenhum.
export const ATRIBUTOS_ORIGEM = [
  { codigo: 'grupo_estoque',          nome: 'Grupo de estoque' },
  { codigo: 'nivel_estoque',          nome: 'Nível de estoque' },
  { codigo: 'linha_produto_agrupada', nome: 'Linha de produto' },
  { codigo: 'familia_tecelagem',      nome: 'Família de tecelagem' },
  { codigo: 'um',                     nome: 'UM do material' },
  { codigo: 'ct',                     nome: 'Centro de trabalho' },
  { codigo: 'area',                   nome: 'Área' },
];

export const OPERADORES = [
  { codigo: '=',      nome: 'é' },
  { codigo: '<>',     nome: 'não é' },
  { codigo: 'CONTEM', nome: 'contém' },
  { codigo: 'COMECA', nome: 'começa com' },
  { codigo: 'VAZIO',  nome: 'está vazio' },
];

// Sem acento e sem caixa. Quem escreve a regra digita "felpudo" e a base traz
// "FELPUDO"; recusar isso seria implicância, e o erro que ela geraria — regra
// que não pega nada — é justamente o mais difícil de perceber.
const achata = (v) => String(v ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function condicaoCasa(cond, valores) {
  const atual = valores?.[cond.atributo];
  const vazio = atual === null || atual === undefined || String(atual).trim() === '';

  if (cond.operador === 'VAZIO') return vazio;
  if (vazio) return cond.operador === '<>';   // nulo não é igual a nada

  const a = achata(atual);
  const b = achata(cond.valor);

  switch (cond.operador) {
    case '=':      return a === b;
    case '<>':     return a !== b;
    case 'CONTEM': return a.includes(b);
    case 'COMECA': return a.startsWith(b);
    default:       return false;
  }
}

/**
 * A regra casa quando ALGUM bloco casa por inteiro.
 *
 * Regra sem condição nenhuma não casa com nada — e isso é deliberado. Ela
 * poderia ser lida como "pega tudo", que é exatamente o tipo de armadilha que
 * reclassifica a base inteira sem ninguém notar. Quem quer um pega-tudo escreve
 * uma condição que sempre vale.
 */
export function regraCasa(regra, valores) {
  const cond = regra?.condicoes ?? [];
  if (!cond.length) return false;

  const blocos = new Map();
  for (const c of cond) {
    const b = Number(c.bloco ?? 1);
    if (!blocos.has(b)) blocos.set(b, []);
    blocos.get(b).push(c);
  }

  for (const lista of blocos.values()) {
    if (lista.every((c) => condicaoCasa(c, valores))) return true;
  }
  return false;
}

/**
 * A primeira regra que casa, na ordem cadastrada.
 *
 * Empate de ordem resolve pelo id, para o resultado nunca depender do acaso da
 * consulta. Regra desativada não entra.
 */
export function primeiraQueCasa(regras, valores) {
  const ativas = (regras ?? [])
    .filter((r) => r.ativa !== false)
    .sort((x, y) => (Number(x.ordem ?? 0) - Number(y.ordem ?? 0))
                 || (Number(x.id ?? 0) - Number(y.id ?? 0)));

  return ativas.find((r) => regraCasa(r, valores)) ?? null;
}

/**
 * Classifica uma combinação, atributo por atributo, do nível mais baixo para o
 * mais alto.
 *
 * A ordem por nível é o que permite uma regra ler um atributo já derivado: no
 * nível 2 os do nível 1 já existem. E como uma regra só enxerga níveis
 * menores — validado em `podeSerCondicao` —, ciclo é impossível por construção,
 * não por detecção.
 *
 * Atributo sem regra que case fica com `null`, e quem lê decide o que mostrar.
 * A tela mostra o valor de origem: linha sem regra nunca some.
 */
export function classificar(valores, atributos, regras) {
  const saida = { ...valores };
  const porNivel = [...(atributos ?? [])]
    .sort((a, b) => (Number(a.nivel ?? 1) - Number(b.nivel ?? 1))
                 || (Number(a.ordem ?? 0) - Number(b.ordem ?? 0)));

  for (const attr of porNivel) {
    const doAtributo = (regras ?? []).filter((r) => r.atributo === attr.codigo);
    const achou = primeiraQueCasa(doAtributo, saida);
    saida[attr.codigo] = achou ? achou.rotulo : null;
  }
  return saida;
}

/**
 * Quanto cada regra de um atributo pega, sobre as combinações da carga.
 *
 * Este é o número que a tela mostra antes de gravar, e ele não é enfeite: no
 * exemplo real, "TECIDO CRU FELPUDO E família 225" pega 128.565 h, enquanto só
 * a linha de produto pegaria 651.218 e só a família 225 espalharia por outros
 * cinco grupos, levando junto 39.201 h de BANHO. Sem ver isso antes, a
 * diferença só apareceria conferindo na mão.
 *
 * `combinacoes` traz `linhas` e `minutos` já somados por combinação distinta —
 * por isso a conta é exata e não uma amostra.
 */
export function previa(combinacoes, atributos, regras, atributo) {
  const doAtributo = (regras ?? []).filter((r) => r.atributo === atributo);
  const conta = new Map();
  for (const r of doAtributo) conta.set(r.id, { linhas: 0, minutos: 0, valores: new Set() });

  const semRegra = { linhas: 0, minutos: 0 };
  const rotulos = new Map();

  // Os atributos de nível menor precisam existir antes: uma regra deste
  // atributo pode depender deles.
  const anteriores = (atributos ?? []).filter((a) => a.codigo !== atributo);

  for (const c of combinacoes ?? []) {
    const valores = classificar(c, anteriores, regras);
    const achou = primeiraQueCasa(doAtributo, valores);
    const linhas = Number(c.linhas ?? 0);
    const minutos = Number(c.minutos ?? 0);

    if (achou) {
      const acc = conta.get(achou.id);
      acc.linhas += linhas;
      acc.minutos += minutos;
      // Guarda de onde veio, para a tela poder mostrar o que caiu na regra.
      acc.valores.add([c.linha_produto_agrupada, c.familia_tecelagem, c.ct]
        .filter(Boolean).join(' · '));

      const r = rotulos.get(achou.rotulo) ?? { linhas: 0, minutos: 0 };
      r.linhas += linhas; r.minutos += minutos;
      rotulos.set(achou.rotulo, r);
    } else {
      semRegra.linhas += linhas;
      semRegra.minutos += minutos;
    }
  }

  return {
    porRegra: doAtributo.map((r) => ({
      id: r.id,
      rotulo: r.rotulo,
      ...conta.get(r.id),
      valores: [...conta.get(r.id).valores].slice(0, 8),
    })),
    porRotulo: [...rotulos.entries()]
      .map(([rotulo, v]) => ({ rotulo, ...v }))
      .sort((a, b) => b.minutos - a.minutos),
    semRegra,
  };
}

/**
 * Um atributo pode ser condição de outro?
 *
 * Origem sempre pode. Derivado só se o nível dele for MENOR que o do alvo — é
 * a regra que torna ciclo impossível, e ela precisa valer na hora de cadastrar,
 * não na hora de classificar.
 */
export function podeSerCondicao(codigo, alvo, atributos) {
  if (ATRIBUTOS_ORIGEM.some((a) => a.codigo === codigo)) return true;
  const cond = (atributos ?? []).find((a) => a.codigo === codigo);
  const dest = (atributos ?? []).find((a) => a.codigo === alvo);
  if (!cond || !dest) return false;
  return Number(cond.nivel) < Number(dest.nivel);
}
