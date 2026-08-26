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

// Os campos da base pelos quais mix e recorte tambem podem ser lidos, sem
// passar por regra nenhuma: o valor da coluna JA e o rotulo. `familia_produto`
// e `tecido_base` entram aqui mesmo tendo ficado fora das regras — para
// filtrar e ratear a cardinalidade alta nao atrapalha, so para manter cadastro.
export const CAMPOS_BASE = [
  { codigo: 'grupo_estoque',          nome: 'Grupo de estoque' },
  { codigo: 'nivel_estoque',          nome: 'Nível de estoque' },
  { codigo: 'linha_produto_agrupada', nome: 'Linha de produto' },
  { codigo: 'familia_produto',        nome: 'Família de produto' },
  { codigo: 'familia_tecelagem',      nome: 'Família de tecelagem' },
  { codigo: 'tecido_base',            nome: 'Tecido base' },
  { codigo: 'um',                     nome: 'UM do material' },
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
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

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

/**
 * Os valores distintos de um atributo nas combinacoes, do mais pesado ao menos.
 *
 * A tela oferece a lista em vez de pedir que se digite. Valor digitado errado e
 * o modo classico de a regra nao pegar nada, e ele nao da erro em lugar nenhum:
 * a regra simplesmente fica quieta.
 */
export function valoresDe(combinacoes, atributo) {
  const conta = new Map();
  for (const c of combinacoes ?? []) {
    const v = c?.[atributo];
    if (v === null || v === undefined || String(v).trim() === '') continue;
    conta.set(String(v), (conta.get(String(v)) ?? 0) + Number(c.minutos ?? 0));
  }
  return [...conta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([valor, minutos]) => ({ valor, minutos }));
}

// -----------------------------------------------------------------------------
// O RATEIO: DA LINHA DE DEMANDA PARA A CAPACIDADE DO RECURSO
//
// A capacidade é do RECURSO; o atributo é da LINHA de demanda. Um CT faz várias
// linhas de produto no mesmo mês, então filtrar por "Banho Jacquard" não pode
// ser "somar os recursos que fazem Banho Jacquard" — isso contaria o CT inteiro,
// inclusive o que ele faz de outra coisa, e a soma dos rótulos daria mais que o
// total.
//
// O que se soma é a FATIA: quanto do tempo daquele CT naquele mês é do rótulo.
// As fatias de um CT somam 1, então a soma dos rótulos fecha com o total. É essa
// propriedade que faz o número ser confiável, e é por ela que o rateio existe.
// -----------------------------------------------------------------------------

/**
 * Quais colunas da base as regras realmente leem.
 *
 * Serve para a consulta agrupar só pelo que importa: agrupar pelas seis colunas
 * e por mês dá dezenas de milhares de linhas para trazer do banco a cada
 * abertura do painel, e regra nenhuma lê as seis.
 */
export function camposUsados(regras) {
  const usados = new Set();
  for (const r of regras ?? []) {
    for (const c of r.condicoes ?? []) {
      if (ATRIBUTOS_ORIGEM.some((a) => a.codigo === c.atributo)) usados.add(c.atributo);
    }
  }
  return [...usados];
}

/** Os rótulos que um atributo pode produzir, sem repetir e na ordem das regras. */
export function rotulosDe(regras, atributo) {
  const vistos = [];
  for (const r of (regras ?? []).filter((x) => x.atributo === atributo
                                            && x.ativa !== false)) {
    if (r.rotulo && !vistos.includes(r.rotulo)) vistos.push(r.rotulo);
  }
  return vistos;
}

const mesIso = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}-01`;

/**
 * A fatia de cada CT em cada mês que pertence a um rótulo.
 *
 * `combinacoes` precisa trazer `ct`, `mes`, `minutos`, `metros` e `qtd` já
 * somados por combinação distinta — o mesmo colapso que faz a prévia do DE/PARA
 * ser exata.
 *
 * Sai também o índice DO RÓTULO, e não o do CT. Um CT que faz felpudo e liso no
 * mesmo mês converte a taxas diferentes; usar a taxa média do CT numa fatia
 * filtrada daria metro a mais ou a menos sem nada denunciar. Quando o rótulo não
 * tem metro nenhum a taxa sai nula, e quem consulta cai na do CT.
 *
 * CT que não tem nada daquele rótulo simplesmente não aparece — e é isso que o
 * painel usa para excluí-lo do filtro.
 *
 * `ajuste` é a camada manual: `{ ano, manuais, taxas }`. Onde houver mix
 * cadastrado para um CT×mês, ele GANHA da base — inclusive quando dá zero ao
 * rótulo, que é como um CT sai de um filtro de propósito. Os percentuais são
 * normalizados pela soma do mês, então a soma dos rótulos continua fechando
 * com o total. `taxas` aponta de onde vem a conversão quando o CT não produz o
 * rótulo na base; sem apontamento a taxa sai nula e quem consulta cai na do CT.
 */
export function fatiasDoRotulo(combinacoes, atributos, regras, atributo, rotulo,
                               ajuste = null) {
  const acc = new Map();

  for (const c of combinacoes ?? []) {
    if (!c.ct || !c.mes) continue;
    const min = Number(c.minutos ?? 0);
    if (!min) continue;

    const chave = `${c.ct}|${c.mes}`;
    let a = acc.get(chave);
    if (!a) {
      a = { ct: c.ct, mes: c.mes, total: 0, doRotulo: 0, metros: 0, qtd: 0 };
      acc.set(chave, a);
    }
    a.total += min;

    if (classificar(c, atributos, regras)[atributo] === rotulo) {
      a.doRotulo += min;
      a.metros += Number(c.metros ?? 0);
      a.qtd += Number(c.qtd ?? 0);
    }
  }

  // O mix manual, agrupado por CT×mês. É `ganha da base`, não `soma com ela`.
  const porChave = new Map();
  for (const m of ajuste?.manuais ?? []) {
    const k = `${m.ct}|${mesIso(ajuste.ano, m.mes)}`;
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(m);
  }

  const fatias = [];
  for (const a of acc.values()) {
    if (porChave.has(`${a.ct}|${a.mes}`)) continue;
    if (!a.doRotulo) continue;
    fatias.push({
      ct: a.ct,
      mes: a.mes,
      fatia: a.doRotulo / a.total,
      metros_por_min: a.metros ? a.metros / a.doRotulo : null,
      qtd_por_min: a.qtd ? a.qtd / a.doRotulo : null,
    });
  }

  if (!porChave.size) return fatias;

  // A taxa do rótulo num CT: a do mês exato, ou a do ano inteiro como reserva.
  // Serve ao próprio CT e ao doador apontado — o doador empresta a taxa DELE
  // para este rótulo, que é justamente o que o apontamento quer dizer.
  const noMes = (ct, mes) => {
    const a = acc.get(`${ct}|${mes}`);
    if (!a?.doRotulo) return null;
    return { m: a.metros ? a.metros / a.doRotulo : null,
             q: a.qtd ? a.qtd / a.doRotulo : null };
  };
  const noAno = new Map();
  for (const a of acc.values()) {
    if (!a.doRotulo) continue;
    const t = noAno.get(a.ct) ?? { doRotulo: 0, metros: 0, qtd: 0 };
    t.doRotulo += a.doRotulo; t.metros += a.metros; t.qtd += a.qtd;
    noAno.set(a.ct, t);
  }
  const doCt = (ct, mes) => {
    const p = noMes(ct, mes);
    if (p) return p;
    const t = noAno.get(ct);
    if (!t) return null;
    return { m: t.metros ? t.metros / t.doRotulo : null,
             q: t.qtd ? t.qtd / t.doRotulo : null };
  };
  const doCc = (cc) => {
    let doR = 0; let met = 0; let qt = 0;
    for (const [ct, t] of noAno) {
      if (!ct.startsWith(`${cc}-`)) continue;
      doR += t.doRotulo; met += t.metros; qt += t.qtd;
    }
    if (!doR) return null;
    return { m: met ? met / doR : null, q: qt ? qt / doR : null };
  };

  for (const [k, linhas] of porChave) {
    const [ct, mes] = k.split('|');
    const total = linhas.reduce((s, l) => s + Number(l.pct ?? 0), 0);
    if (!total) continue;
    const doRot = linhas
      .filter((l) => (l.rotulo ?? null) === rotulo)
      .reduce((s, l) => s + Number(l.pct ?? 0), 0);
    if (!doRot) continue;

    let taxa = doCt(ct, mes);
    if (!taxa) {
      const t = (ajuste?.taxas ?? []).find((x) => x.ct === ct);
      if (t) taxa = t.tipo === 'CC' ? doCc(t.valor) : doCt(t.valor, mes);
    }
    fatias.push({
      ct,
      mes,
      fatia: doRot / total,
      metros_por_min: taxa?.m ?? null,
      qtd_por_min: taxa?.q ?? null,
      manual: true,
    });
  }
  return fatias;
}

/**
 * O mix da base: quanto do tempo de cada CT, em cada mês do ano, pertence a
 * cada rótulo do atributo — com `''` para a parte que nenhuma regra classifica.
 *
 * É o que a tela de ajuste mostra e pré-preenche: ninguém digita mix do zero,
 * corrige o que a base diz. Os metros vão junto para a tela saber quais
 * rótulos o CT não produz — são esses que precisam de taxa apontada.
 */
export function mixDaBase(combinacoes, atributos, regras, atributo, ano) {
  const porCtMes = new Map();
  for (const c of combinacoes ?? []) {
    if (!c.ct || !String(c.mes ?? '').startsWith(`${ano}-`)) continue;
    const min = Number(c.minutos ?? 0);
    if (!min) continue;
    const mes = Number(String(c.mes).slice(5, 7));
    const rot = classificar(c, atributos, regras)[atributo] ?? '';

    const k = `${c.ct}|${mes}`;
    if (!porCtMes.has(k)) porCtMes.set(k, new Map());
    const rots = porCtMes.get(k);
    const r = rots.get(rot) ?? { minutos: 0, metros: 0, qtd: 0 };
    r.minutos += min;
    r.metros += Number(c.metros ?? 0);
    r.qtd += Number(c.qtd ?? 0);
    rots.set(rot, r);
  }

  const saida = [];
  for (const [k, rots] of porCtMes) {
    const [ct, mes] = k.split('|');
    let total = 0;
    for (const r of rots.values()) total += r.minutos;
    for (const [rotulo, r] of rots) {
      saida.push({
        ct, mes: Number(mes), rotulo,
        pct: (r.minutos * 100) / total,
        minutos: r.minutos, metros: r.metros, qtd: r.qtd,
      });
    }
  }
  return saida;
}

/**
 * O ÍNDICE DE CONVERSÃO QUE SAI DO MIX AJUSTADO À MÃO.
 *
 * O índice de um CT é a média das taxas dos produtos que ele faz, PONDERADA
 * PELO TEMPO de cada um. Um tear que passa metade do tempo em Cama a 15 m/min
 * e metade em Decoração a 5 m/min converte a 10 m/min; em 100% de Cama, a 15.
 * Mudar o mix muda o índice — não é um efeito colateral, é a definição.
 *
 * Sem isto, ajustar o mix só mexia no painel quando havia um rótulo escolhido
 * no filtro: o resto do tempo o painel lia o índice da carga, e o ajuste ficava
 * mudo justamente na tela onde ele deveria aparecer.
 *
 * A taxa de cada rótulo sai da própria base — o CT já faz aquilo, e a que
 * ritmo. Rótulo que ele não faz usa a taxa apontada em `taxas`, o mesmo
 * apontamento da tela de mix. Rótulo sem taxa em lugar nenhum sai da conta
 * inteira, numerador e denominador: dizer que ele rende zero derrubaria a
 * capacidade em silêncio, e a fatia que ficou de fora volta em `semTaxa` para
 * a tela poder contar.
 */
export function indiceDoMixManual(combinacoes, atributos, regras, atributo,
                                  ajuste) {
  const manuais = ajuste?.manuais ?? [];
  if (!manuais.length) return [];

  const base = mixDaBase(combinacoes, atributos, regras, atributo, ajuste.ano);

  // (ct, mes, rotulo) -> taxa; e a mesma coisa no ano, como reserva para o mês
  // em que o CT não fez aquele produto.
  const noMes = new Map();
  const noAno = new Map();
  for (const b of base) {
    if (!b.minutos) continue;
    noMes.set(`${b.ct}|${b.mes}|${b.rotulo}`,
      { m: b.metros / b.minutos, q: b.qtd / b.minutos });

    const k = `${b.ct}|${b.rotulo}`;
    const t = noAno.get(k) ?? { minutos: 0, metros: 0, qtd: 0 };
    t.minutos += b.minutos; t.metros += b.metros; t.qtd += b.qtd;
    noAno.set(k, t);
  }
  const doAno = (ct, rotulo) => {
    const t = noAno.get(`${ct}|${rotulo}`);
    return t?.minutos ? { m: t.metros / t.minutos, q: t.qtd / t.minutos } : null;
  };

  // A média de um CC para um rótulo, para o apontamento do tipo CC.
  const doCc = (cc, rotulo) => {
    let min = 0; let met = 0; let qt = 0;
    for (const [k, t] of noAno) {
      const [ct, rot] = k.split('|');
      if (rot !== rotulo || !ct.startsWith(`${cc}-`)) continue;
      min += t.minutos; met += t.metros; qt += t.qtd;
    }
    return min ? { m: met / min, q: qt / min } : null;
  };

  const apontada = new Map((ajuste?.taxas ?? []).map((t) => [t.ct, t]));
  const taxaDe = (ct, mes, rotulo) => {
    const propria = noMes.get(`${ct}|${mes}|${rotulo}`) ?? doAno(ct, rotulo);
    if (propria) return propria;
    const t = apontada.get(ct);
    if (!t) return null;
    return t.tipo === 'CC' ? doCc(t.valor, rotulo) : doAno(t.valor, rotulo);
  };

  // O mix manual, por CT e mês.
  const porChave = new Map();
  for (const m of manuais) {
    const k = `${m.ct}|${Number(m.mes)}`;
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(m);
  }

  const saida = [];
  for (const [k, linhas] of porChave) {
    const [ct, mesTexto] = k.split('|');
    const mes = Number(mesTexto);

    let peso = 0;      // fatia com taxa conhecida
    let fora = 0;      // fatia sem taxa em lugar nenhum
    let som = 0;
    let somQ = 0;
    for (const l of linhas) {
      const pct = Number(l.pct ?? 0);
      if (!(pct > 0)) continue;
      const taxa = taxaDe(ct, mes, l.rotulo ?? '');
      if (!taxa) { fora += pct; continue; }
      peso += pct;
      som += pct * (taxa.m ?? 0);
      somQ += pct * (taxa.q ?? 0);
    }
    if (!peso) continue;

    saida.push({
      ct,
      mes: mesIso(ajuste.ano, mes),
      fatia: 1,                      // não rateia: só troca o índice
      metros_por_min: som / peso,
      qtd_por_min: somQ / peso,
      semTaxa: fora / (peso + fora),
    });
  }
  return saida;
}

/**
 * A CAPACIDADE REPARTIDA ENTRE OS RÓTULOS DE UM ATRIBUTO.
 *
 * O painel mostra quanto cabe num recurso; esta conta mostra quanto cabe de
 * CADA COISA que ele faz. Um tear com 15 mil minutos que passa 60% do tempo em
 * Cama e 40% em Decoração tem 9 mil minutos de Cama — e, em metro, 9 mil vezes
 * a taxa DA CAMA, que não é a média do tear.
 *
 * `capCt` traz a capacidade em MINUTOS por (ct, mes), como o motor gravou. As
 * fatias e as taxas saem de `fatiasDoRotulo`, então o mix ajustado à mão vale
 * aqui do mesmo jeito que vale no resto do painel.
 *
 * A SOMA DOS RÓTULOS FECHA COM O TOTAL em minuto, porque as fatias de um CT
 * somam 1. Em metro e peça ela não fecha, e não deveria: cada rótulo converte
 * a uma taxa diferente, e é justamente essa diferença que a tabela existe para
 * mostrar. CT sem índice fica de fora do físico e aparece em `semIndice`.
 */
export function capacidadePorAtributo(capCt, combinacoes, atributos, regras,
                                      atributo, rotulos, ajuste = null) {
  const linhas = [];
  const semIndice = new Set();

  for (const rotulo of rotulos) {
    const fatias = fatiasDoRotulo(combinacoes, atributos, regras, atributo,
                                  rotulo, ajuste);
    const porChave = new Map(fatias.map((f) => [`${f.ct}|${f.mes}`, f]));

    const meses = new Map();
    for (const c of capCt ?? []) {
      const f = porChave.get(`${c.ct}|${c.mes}`);
      if (!f) continue;
      const min = Number(c.minutos ?? 0) * Number(f.fatia ?? 0);
      if (!min) continue;

      const a = meses.get(c.mes) ?? { min: 0, m: 0, um: 0 };
      a.min += min;
      a.m += min * Number(f.metros_por_min ?? 0);
      a.um += min * Number(f.qtd_por_min ?? 0);
      meses.set(c.mes, a);
      if (f.metros_por_min === null) semIndice.add(c.ct);
    }

    if (meses.size) linhas.push({ rotulo, meses });
  }

  return { linhas, semIndice: [...semIndice] };
}

/**
 * A DEMANDA repartida entre os rótulos de um atributo, mês a mês.
 *
 * Aqui não há rateio nenhum: a demanda É da linha, e a linha É classificada.
 * Somar por rótulo é ler o que a base já diz — o oposto da capacidade, que é
 * do recurso e precisa da fatia para virar produto.
 *
 * `cts` limita aos centros da seleção; nulo é a área inteira.
 */
export function demandaPorAtributo(combinacoes, atributos, regras, atributo,
                                   cts = null) {
  const dentro = cts ? new Set(cts) : null;
  const porRotulo = new Map();

  for (const c of combinacoes ?? []) {
    if (!c.ct || !c.mes) continue;
    if (dentro && !dentro.has(c.ct)) continue;
    const min = Number(c.minutos ?? 0);
    if (!min) continue;

    const rot = classificar(c, atributos, regras)[atributo] ?? null;
    if (!porRotulo.has(rot)) porRotulo.set(rot, new Map());
    const meses = porRotulo.get(rot);
    meses.set(c.mes, (meses.get(c.mes) ?? 0) + min);
  }

  return [...porRotulo.entries()].map(([rotulo, meses]) => ({ rotulo, meses }));
}
