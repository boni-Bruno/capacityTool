// =============================================================================
// O CONTEÚDO DO DOCUMENTO DAS CONFIGURAÇÕES
//
// Uma consulta só entrega o recorte aberto por centro de trabalho. Daqui saem
// os três níveis em que ele pode ser contado — o recorte inteiro, cada centro
// de custo, cada centro de trabalho — e o texto de cada slide.
//
// AQUI E NÃO NA TELA porque são duas saídas: o .pptx montado no navegador e a
// página de impressão que vira PDF. Duas montagens do mesmo texto divergem na
// primeira mudança, e a divergência sai num documento que ninguém confere
// contra o outro — cada um parece certo sozinho.
//
// A SOMA É DE SOMA, NUNCA MÉDIA DE MÉDIAS, como no resto do projeto: a ocupação
// de um CC é a demanda somada dividida pela capacidade somada. Média das
// ocupações dos CTs daria peso igual a um CT gigante e a um que quase não roda.
//
// Turnos e calendários chegam como LISTA DE IDs e são juntados por união. Dois
// CTs costumam dividir o mesmo turno: somar as contagens diria que a fábrica
// tem o dobro de turnos que tem.
//
// Sem imports e sem banco: recebe linhas, devolve linhas.
// =============================================================================

export const GRANULARIDADES = [
  { valor: 'RESUMO', rotulo: 'Um slide só',
    dica: 'o recorte inteiro, somado' },
  { valor: 'CC', rotulo: 'Um slide por CC',
    dica: 'todos os CTs do centro de custo juntos' },
  { valor: 'CT', rotulo: 'Um slide por CT',
    dica: 'um centro de trabalho em cada slide' },
];

export const MEDIDAS = [
  { valor: 'disponivel', rotulo: 'Disponível', dica: 'planejada × OEE' },
  { valor: 'planejada',  rotulo: 'Planejada',  dica: 'turnos menos paradas' },
  { valor: 'instalada',  rotulo: 'Instalada',  dica: 'teto de 24 h por dia' },
];

export const ehGranularidade = (v) =>
  GRANULARIDADES.some((g) => g.valor === v);
export const ehMedida = (v) => MEDIDAS.some((m) => m.valor === v);

export const rotuloMedida = (v) =>
  MEDIDAS.find((m) => m.valor === v)?.rotulo ?? 'Disponível';

const num = (v) => Number(v ?? 0);
export const fmt = (n) =>
  Number(n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// Nulo e não zero quando não há capacidade: 0% diria "sobra tudo" para um CT
// que não tem nada onde caber, que é o contrário do que acontece.
export const ocupacao = (demanda, capacidade) =>
  (num(capacidade) === 0 ? null : (num(demanda) * 100) / num(capacidade));

export const fmtPct = (v) => (v === null || v === undefined
  ? '—' : `${Number(v).toFixed(1)}%`);

// "01/03 a 10/04 de 2026" — o período por extenso, para o cabeçalho.
export function rotuloIntervalo(de, ate) {
  const br = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const ano = String(de).slice(0, 4);
  if (de === ate) return `${br(de)} de ${ano}`;
  const anoInteiro = String(de).endsWith('-01-01') && String(ate).endsWith('-12-31');
  return anoInteiro ? `ano de ${ano}` : `${br(de)} a ${br(ate)} de ${ano}`;
}

const uniao = (linhas, campo) => {
  const s = new Set();
  for (const l of linhas) for (const v of l?.[campo] ?? []) s.add(v);
  return s.size;
};

const soma = (linhas, campo) =>
  linhas.reduce((s, l) => s + num(l?.[campo]), 0);

/**
 * As linhas de CT viradas nos grupos que o documento vai mostrar.
 *
 * Um grupo por slide, na ordem em que a consulta veio — planta, área, CC, CT.
 * `RESUMO` devolve um grupo só, que é o recorte inteiro.
 */
export function agrupa(linhas, granularidade = 'RESUMO') {
  const lista = linhas ?? [];
  if (!lista.length) return [];

  const chaveDe = (l) => (granularidade === 'CT' ? l.ct
    : granularidade === 'CC' ? `${l.planta}|${l.area}|${l.cc}`
    : '*');

  const ordem = [];
  const balde = new Map();
  for (const l of lista) {
    const k = chaveDe(l);
    if (!balde.has(k)) { balde.set(k, []); ordem.push(k); }
    balde.get(k).push(l);
  }

  return ordem.map((k) => {
    const g = balde.get(k);
    const p = g[0];

    // Plantas e áreas viram lista quando o grupo atravessa mais de uma: no
    // resumo de um recorte com duas plantas, mostrar só a primeira seria uma
    // legenda errada num documento que alguém vai apresentar.
    const distintos = (campo) => [...new Set(g.map((l) => l[campo]))];
    const plantas = distintos('planta');
    const areas = distintos('area');
    const ccs = distintos('cc');

    return {
      chave: k,
      granularidade,
      ct: granularidade === 'CT' ? p.ct : null,
      cc: granularidade === 'RESUMO' ? null : p.cc,
      planta: plantas.join(' · '),
      area: areas.join(' · '),
      ccs: ccs.length,
      cts: new Set(g.map((l) => l.ct)).size,
      // Nome do recurso só onde ele cabe: um CC com quarenta máquinas viraria
      // um parágrafo de nomes no lugar do conteúdo.
      recursos_nomes: granularidade === 'CT' ? (p.recursos ?? '') : '',
      recursos: soma(g, 'qtd_recursos'),
      postos: soma(g, 'postos'),
      maquinas: soma(g, 'maquinas'),
      pessoas: soma(g, 'pessoas'),
      turnos: uniao(g, 'turno_ids'),
      calendarios: uniao(g, 'calendario_ids'),
      faixas_oee: soma(g, 'faixas_oee'),
      paradas: soma(g, 'paradas'),
      instalada: soma(g, 'instalada'),
      planejada: soma(g, 'planejada'),
      disponivel: soma(g, 'disponivel'),
      demanda: soma(g, 'demanda'),
    };
  });
}

/** O título do slide daquele grupo. */
export function tituloDoGrupo(g) {
  if (g.granularidade === 'CT') {
    return g.recursos_nomes ? `CT ${g.ct} · ${g.recursos_nomes}` : `CT ${g.ct}`;
  }
  if (g.granularidade === 'CC') return `CC ${g.cc} · ${g.area}`;
  return 'Recorte completo';
}

/**
 * As seções de um grupo: o que ele é, como está configurado, quanto cabe.
 *
 * A capacidade sai na medida escolhida, e só nela — as três lado a lado num
 * slide fazem quem lê procurar qual é a que importa. A demanda e a ocupação só
 * aparecem quando há cenário escolhido: uma linha "0 min" onde ninguém pediu
 * demanda pareceria uma fábrica sem pedido.
 */
export function secoesDoGrupo(g, opcoes = {}) {
  const {
    de, ate, medida = 'disponivel', origem = 'META', cenario = null,
  } = opcoes;

  const cap = num(g[medida]);
  const temDemanda = Boolean(cenario);

  const identidade = [];
  if (g.granularidade !== 'RESUMO') {
    identidade.push(`${g.planta} · ${g.area}`);
  } else {
    identidade.push(`${g.planta} · ${g.area}`);
    identidade.push(`${fmt(g.ccs)} centro(s) de custo · ${fmt(g.cts)} centro(s) de trabalho`);
  }
  if (g.granularidade === 'CC') {
    identidade.push(`${fmt(g.cts)} centro(s) de trabalho`);
  }
  identidade.push(`${rotuloIntervalo(de, ate)} · OEE ${origem === 'META' ? 'meta' : 'simulado'}`);

  const config = [
    `${fmt(g.recursos)} recurso(s) · ${fmt(g.postos)} posto(s)`,
    `${fmt(g.maquinas)} máquina(s) e ${fmt(g.pessoas)} posto(s) de pessoa`,
    `${fmt(g.turnos)} turno(s) e ${fmt(g.calendarios)} calendário(s) em uso`,
    `${fmt(g.faixas_oee)} faixa(s) de OEE · ${fmt(g.paradas)} parada(s) cadastrada(s)`,
  ];

  const capacidade = cap > 0
    ? [
      `${rotuloMedida(medida)}: ${fmt(cap)} min (${fmt(cap / 60)} h)`,
      ...(temDemanda ? [
        `Demanda ${cenario}: ${fmt(g.demanda)} min`,
        `Ocupação: ${fmtPct(ocupacao(g.demanda, cap))}`,
      ] : []),
    ]
    // Sem número não é o mesmo que zero: ou a rodada não existe para este ano,
    // ou o recorte caiu fora dela. Dizer "0 min" faria alguém apresentar uma
    // fábrica parada.
    : ['Sem cálculo neste período — rode Recalcular tudo no painel.'];

  return [
    { titulo: tituloDoGrupo(g), linhas: identidade },
    { titulo: 'Configuração', linhas: config },
    { titulo: `Capacidade ${rotuloMedida(medida).toLowerCase()}`, linhas: capacidade },
  ];
}
