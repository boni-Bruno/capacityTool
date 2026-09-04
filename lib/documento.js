// =============================================================================
// O CONTEÚDO DO DOCUMENTO DAS CONFIGURAÇÕES
//
// Uma consulta só entrega o recorte aberto por centro de trabalho. Daqui saem
// os três níveis em que ele pode ser contado — o recorte inteiro, cada centro
// de custo, cada centro de trabalho — e o texto de cada slide.
//
// AQUI E NÃO NA TELA porque a tela não decide número. O que muda de um
// documento para o outro — medida, cenário, período, granularidade — entra como
// parâmetro, e o resultado é conferível por teste sem abrir o PowerPoint.
//
// A SOMA É DE SOMA, NUNCA MÉDIA DE MÉDIAS, como no resto do projeto: a ocupação
// de um CC é a demanda somada dividida pela capacidade somada. Média das
// ocupações dos CTs daria peso igual a um CT gigante e a um que quase não roda.
//
// Turnos e calendários chegam como LISTA DE IDs e são juntados por união. Dois
// CTs costumam dividir o mesmo turno: somar as contagens diria que a fábrica
// tem o dobro de turnos que tem.
//
// Sem banco: recebe linhas, devolve linhas. O único import é a regra de cor da
// ocupação, que é outro motor puro — com a extensão, para o executor de testes
// do Node resolver o caminho pelas regras do ESM.
// =============================================================================

import { corDaOcupacao } from './faixa-cor.js';

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

// Com vírgula, como o resto dos números do documento: "75.0%" no meio de
// "10.790.127" é um documento que parece traduzido pela metade.
export const fmtPct = (v) => (v === null || v === undefined
  ? '—'
  : `${Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  })}%`);

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

  const ordem = [];
  const balde = new Map();
  for (const l of lista) {
    const k = chaveDoGrupo(l, granularidade);
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

// =============================================================================
// O VISUAL: o gráfico mês a mês e a grade embaixo dele
//
// A grade repete as colunas do gráfico de propósito — mês, OEE e turnos caem
// debaixo da barra do mês a que pertencem. É a leitura que o desenho existe
// para permitir: a barra de março caiu porque o OEE caiu, ou porque perdeu um
// turno? Com as três linhas alinhadas isso se responde olhando para baixo.
// =============================================================================

export const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                          'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// O que cada bloco da grade é, em uma frase. Fica no documento e não na tela
// porque quem lê o slide não tem a quem perguntar.
// Curtas de propósito: o cartão do bloco menor tem três linhas de altura, e uma
// frase que não cabe some inteira — pior que uma curta que fica.
// As duas frases são do Bruno, escritas por ele no .pptx e trazidas de lá.
// "O que o sistema calculou" descrevia a ferramenta; "Capacidade, demanda e
// ocupação" diz o que está na tabela, que é o que quem olha o slide precisa.
export const GRUPOS = {
  'cálculo': 'Capacidade, demanda e ocupação.',
  cadastros: 'As premissas que produziram a capacidade calculada.',
};

/**
 * A chave do grupo a que uma linha pertence.
 *
 * Exportada porque três consultas — o detalhe, a série e os turnos — precisam
 * cair no MESMO grupo. Cada uma com a sua regra seria o jeito de um slide de CC
 * mostrar o gráfico de outro, e nada denunciaria: os dois números existem.
 */
export const chaveDoGrupo = (l, granularidade) =>
  (granularidade === 'CT' ? l.ct
    : granularidade === 'CC' ? `${l.planta}|${l.area}|${l.cc}`
    : '*');

const porMes = (linhas, granularidade, chave) => {
  const meus = (linhas ?? []).filter(
    (l) => chaveDoGrupo(l, granularidade) === chave);
  const mapa = new Map();
  for (const l of meus) {
    const m = Number(l.mes);
    if (!mapa.has(m)) mapa.set(m, []);
    mapa.get(m).push(l);
  }
  return mapa;
};

/**
 * O que o gráfico e a grade de um grupo mostram.
 *
 * O OEE sai de `disponível ÷ planejada` — divisão de somas, como tudo neste
 * projeto. Ler a faixa cadastrada daria um segundo número para a mesma coisa, e
 * ele poderia dizer 78% embaixo de uma barra calculada com 75%: a rodada é de
 * ontem, o cadastro é de hoje, e o slide não teria como avisar.
 */
export function visualDoGrupo({
  grupo, granularidade, serie, turnos, medida = 'disponivel', cenario = null,
  de = null, ate = null, origem = 'META', faixas = null,
  turnosCadastrados = null,
}) {
  const chave = grupo?.chave ?? '*';
  const meses = [...new Set((serie ?? []).map((l) => Number(l.mes)))]
    .sort((a, b) => a - b);
  if (!meses.length) return null;

  const daSerie = porMes(serie, granularidade, chave);
  const dosTurnos = porMes(turnos, granularidade, chave);

  const pontos = meses.map((m) => {
    const linhas = daSerie.get(m) ?? [];
    const planejada = soma(linhas, 'planejada');
    const disponivel = soma(linhas, 'disponivel');
    const capacidade = soma(linhas, medida);
    const demanda = cenario ? soma(linhas, 'demanda') : 0;
    return {
      mes: m,
      rotulo: MES_CURTO[m - 1] ?? String(m),
      capacidade,
      demanda,
      planejada,
      disponivel,
      parada: soma(linhas, 'parada'),
      // Nulo e não zero quando não houve planejada: "0%" faria parecer um mês
      // de rendimento nulo, quando na verdade não houve turno nenhum.
      oee: planejada > 0 ? (disponivel * 100) / planejada : null,
    };
  });

  // O TOTALIZADOR DO PERÍODO, à direita de tudo.
  //
  // Cada medida totaliza do jeito dela, e é aí que se erra: capacidade e demanda
  // SOMAM; ocupação e OEE são DIVISÃO DE SOMAS, nunca média das colunas. Somar
  // doze porcentagens e dividir por doze dá o mesmo peso a dezembro, que tem
  // recesso, e a março, que roda cheio — e o total deixa de bater com a conta
  // que a própria linha de cima mostra.
  const total = {
    capacidade: pontos.reduce((s, p) => s + p.capacidade, 0),
    demanda: pontos.reduce((s, p) => s + p.demanda, 0),
    planejada: pontos.reduce((s, p) => s + p.planejada, 0),
    disponivel: pontos.reduce((s, p) => s + p.disponivel, 0),
    parada: pontos.reduce((s, p) => s + p.parada, 0),
  };
  total.ocupacao = ocupacao(total.demanda, total.capacidade);
  total.oee = total.planejada > 0
    ? (total.disponivel * 100) / total.planejada : null;

  // "Ano" só quando é o ano inteiro; um recorte de março a junho totalizado sob
  // o rótulo "Ano" seria uma legenda mentindo num documento apresentado.
  const rotuloTotal = meses.length === 12 ? 'Ano' : 'Total';

  // TODOS OS TURNOS CADASTRADOS, e não só os que este recorte usa. Um turno que
  // não aparece na lista é indistinguível de um turno que aparece zerado, e a
  // pergunta que o slide responde é como a fábrica ESTÁ montada — "o terceiro
  // turno não roda aqui" é resposta, e resposta que só existe se a linha estiver
  // lá para dizê-la.
  //
  // Sem a lista, cai no que o recorte tem: é o comportamento antigo, e serve de
  // rede para quem chamar a função sem passar os turnos.
  const doRecorte = [...new Map((turnos ?? [])
    .filter((l) => chaveDoGrupo(l, granularidade) === chave)
    .map((l) => [Number(l.turno_id), l.turno])).entries()]
    .map(([id, nome]) => ({ id, nome }));

  const listaTurnos = (turnosCadastrados?.length ? turnosCadastrados : doRecorte)
    .map((t) => ({ id: Number(t.id), nome: t.nome ?? t.codigo }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

  const linhasDeTurno = listaTurnos.map((t) => ({
    rotulo: t.nome,
    // Travessão e não vazio: célula em branco na coluna do ano parece um total
    // que faltou calcular, e turno não se totaliza — é estado, não fluxo.
    total: '–',
    valores: meses.map((m) => {
      const q = (dosTurnos.get(m) ?? [])
        .filter((l) => Number(l.turno_id) === t.id)
        .reduce((s, l) => s + Number(l.qt ?? 0), 0);
      // "N/A" e não vazio: célula em branco é ambígua entre "não tem" e "não
      // consegui contar", e as duas mereciam reações diferentes de quem lê.
      return q > 0 ? fmt(q) : 'N/A';
    }),
  }));

  return {
    meses,
    pontos,
    total,
    grupos: GRUPOS,
    // O eixo do gráfico. Os dois números do documento são minutos, e dizer isso
    // uma vez no alto do desenho evita a pergunta em toda reunião.
    unidade: 'Minutos',
    // A ORDEM É A DA LEITURA: primeiro o que o gráfico desenhou — capacidade,
    // demanda, ocupação —, e só depois o que explica o desenho, que é o OEE e os
    // turnos. Quem olha quer primeiro o número da barra que está vendo.
    //
    // A primeira faixa é o eixo do gráfico, e por isso não tem rótulo à
    // esquerda: ela nomeia as colunas, não descreve uma medida.
    // O GRUPO SEPARA O QUE É CONTA DO QUE É CADASTRO. As três primeiras são o
    // resultado do cálculo; as de baixo são as premissas que produziram esse
    // resultado. Sem a separação, OEE e turno parecem saída do motor, e quem lê
    // não sabe o que pode mudar para o número mudar.
    linhas: [
      { rotulo: '', valores: pontos.map((p) => p.rotulo),
        total: rotuloTotal, cabecalho: true },
      { grupo: 'cálculo',
        rotulo: 'Capacidade', valores: pontos.map((p) => fmt(p.capacidade)),
        total: fmt(total.capacidade) },
      ...(cenario ? [
        { grupo: 'cálculo',
          rotulo: 'Demanda', valores: pontos.map((p) => fmt(p.demanda)),
          total: fmt(total.demanda) },
        // A ÚNICA LINHA COLORIDA, e a única cor do documento que não vem do
        // tema do modelo. Ler doze porcentagens e achar as que estouram é o que
        // ninguém faz numa reunião; a cor faz o mês problemático saltar antes
        // de alguém terminar de ler a linha. Ver 29_faixa_ocupacao.sql.
        { grupo: 'cálculo',
          rotulo: 'Ocupação',
          valores: pontos.map((p) => fmtPct(ocupacao(p.demanda, p.capacidade))),
          cores: pontos.map(
            (p) => corDaOcupacao(faixas, ocupacao(p.demanda, p.capacidade))),
          total: fmtPct(total.ocupacao),
          corTotal: corDaOcupacao(faixas, total.ocupacao) },
      ] : []),
      // Com a origem no rótulo: "OEE 75%" não diz se é a meta ou o simulado, e
      // são duas conversas diferentes na mesma reunião.
      { grupo: 'cadastros',
        rotulo: `OEE (${origem === 'META' ? 'meta' : 'simulado'})`,
        valores: pontos.map((p) => fmtPct(p.oee)), total: fmtPct(total.oee) },
      // Turno não totaliza: somar "6 recursos em janeiro" com "6 em fevereiro"
      // daria doze recursos numa fábrica que tem seis. É estado, não fluxo.
      ...linhasDeTurno.map((l) => ({ ...l, grupo: 'cadastros' })),
      // Por último, e não ao lado do OEE: a lista de turnos é o corpo do bloco
      // de cadastro, e partir esse bloco em dois com uma linha de minutos no
      // meio faz o olho perder onde ele começa e onde termina.
      { grupo: 'cadastros', rotulo: 'Paradas',
        valores: pontos.map((p) => fmt(p.parada)), total: fmt(total.parada) },
    ],
    // A legenda diz a MEDIDA e o CENÁRIO por extenso. "Disponível" e "Demanda"
    // sozinhos deixam quem lê sem saber qual das três capacidades está na barra
    // e contra qual plano a linha está comparando — e essas duas escolhas são
    // exatamente o que muda de um documento para o outro.
    rotuloCapacidade: `Capacidade ${rotuloMedida(medida).toLowerCase()}`,
    rotuloDemanda: cenario ? `Demanda cenário ${cenario}` : null,
    // O período e a origem do OEE ficam no canto, e não no título: são o
    // "quando", e o título é o "de quem".
    rodape: de && ate
      ? `${rotuloIntervalo(de, ate)} · OEE ${origem === 'META' ? 'meta' : 'simulado'}`
      : null,
  };
}

/**
 * O TÍTULO E O SUBTÍTULO DO SLIDE, para os campos do próprio modelo.
 *
 * "Planta - Área" em cima e "CC - CTs" embaixo, que é como o modelo pede. Eles
 * vão para as caixas de título e subtítulo do leiaute, e não para dentro da
 * caixa do conteúdo: lá em cima eles já têm posição, fonte e tamanho decididos,
 * e não gastam a altura de que o desenho precisa.
 */
export const tituloDoSlide = (g) => `${g.planta} - ${g.area}`;

export function subtituloDoSlide(g) {
  if (g.granularidade === 'CT') {
    return g.recursos_nomes
      ? `CC ${g.cc} - CT ${g.ct} · ${g.recursos_nomes}`
      : `CC ${g.cc} - CT ${g.ct}`;
  }
  if (g.granularidade === 'CC') return `CC ${g.cc} - ${fmt(g.cts)} CTs`;
  return `${fmt(g.ccs)} CCs - ${fmt(g.cts)} CTs`;
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
 * O texto do slide QUANDO ELE TEM GRÁFICO — só a identidade, em quatro linhas.
 *
 * Com o desenho embaixo, repetir os números em texto rouba a altura de que o
 * gráfico precisa e dá ao leitor duas versões da mesma informação para
 * conferir. A capacidade, a demanda, o OEE e os turnos estão todos no desenho,
 * mês a mês — o texto só precisa dizer de quem é aquilo.
 */
export function secoesDoTitulo(g, opcoes = {}) {
  const { de, ate, origem = 'META' } = opcoes;
  return [{
    titulo: tituloDoGrupo(g),
    linhas: [
      `${g.planta} · ${g.area}`,
      `${rotuloIntervalo(de, ate)} · OEE ${origem === 'META' ? 'meta' : 'simulado'}`,
      `${fmt(g.recursos)} recurso(s) · ${fmt(g.postos)} posto(s) · `
        + `${fmt(g.turnos)} turno(s) · ${fmt(g.calendarios)} calendário(s)`,
    ],
  }];
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
