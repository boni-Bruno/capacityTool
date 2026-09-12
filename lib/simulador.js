// =============================================================================
// SIMULADOR DE QUANTIDADE DE RECURSOS
//
// Responde "quantas máquinas (ou pessoas) este CT precisaria para atender a
// demanda do cenário?" — e responde num .xlsx COM FÓRMULAS, não numa tela. A
// decisão é do Bruno: ele simula no Excel, onde já mora a conversa com a
// fábrica, e cadastra a resposta na aplicação pelo caminho de sempre (Qtd do
// recurso para máquina; Turnos do recurso para pessoa). Uma tela de simulação
// aqui seria um segundo lugar para decidir capacidade, e o painel já é o
// primeiro.
//
// A CONTA, por CT e mês:
//
//   por_unidade = Σ ( min_disponivel ÷ qt_recursos )   ← o que UMA unidade entrega
//                                                         no mês, com os turnos,
//                                                         o calendário e o OEE da rodada
//   atuais      = disponível ÷ por_unidade               ← unidades efetivas
//   ocupação    = demanda ÷ (disponível × fator)
//   necessárias = ROUNDUP( demanda ÷ (por_unidade × fator), 0 )
//   diferença   = necessárias − atuais
//
// O FATOR DE OEE é a única célula de entrada. Vale 1 = o OEE cadastrado da
// rodada; 1,1 pergunta "e se cada máquina rendesse 10% a mais?". Ele entra
// multiplicando a capacidade e não a demanda, para a ocupação e a quantidade
// mudarem juntas e no mesmo sentido.
//
// `qt_recursos` do fato é a quantidade DO TURNO — máquinas ou pessoas —, e é
// exatamente o divisor certo: dois turnos com quantidades diferentes dão
// "atuais" fracionário, que é a verdade (3 máquinas de dia e 1 de noite não
// são nem 3 nem 1). Pessoa e máquina entram na mesma fórmula porque a
// planejada é linear na quantidade nos dois casos.
//
// DIVISÃO DE SOMAS, como no resto do projeto: a linha do ano divide a soma da
// demanda pela soma do que uma unidade entrega no ano, e não tira a média das
// doze quantidades. O PICO é o mês que mais pede — quem dimensiona pelo ano
// aceita fila nos meses acima da média; quem dimensiona pelo pico não.
//
// AS REFERÊNCIAS DE CÉLULA NASCEM AQUI. É o único lugar que sabe em que linha
// cada CT começa, e é por isso que a aba "Por CC" consegue somar a "Por CT" com
// SUMIFS em vez de repetir a conta.
//
// Motor puro: sem banco, sem tela. `resumoDoSimulador` faz em JS, com fator 1,
// o que a planilha faz em fórmula — é a prévia da tela e o teste de que as
// duas contas batem.
// =============================================================================

import { ESTILO } from './xlsx.js';

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                      'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Onde cada coisa mora na aba "Por CT". A célula do fator é fixa ($B$1) e o
// cabeçalho fica na linha 3, com duas linhas livres acima — mover isso é
// mover todas as fórmulas, e por isso está num lugar só.
export const FATOR = '$B$1';
export const LINHA_CABECALHO = 3;

const COLUNAS_CT = [
  { titulo: 'Planta',             largura: 16 },
  { titulo: 'Área',               largura: 18 },
  { titulo: 'CC',                 largura: 8,  texto: true },
  { titulo: 'CT',                 largura: 12, texto: true },
  { titulo: 'Recursos',           largura: 34 },
  { titulo: 'Unidade',            largura: 9 },
  { titulo: 'Mês',                largura: 6 },
  { titulo: 'Demanda (min)',      largura: 15 },
  { titulo: 'Disponível (min)',   largura: 16 },
  { titulo: 'Por unidade (min)',  largura: 17 },
  { titulo: 'Atuais',             largura: 9 },
  { titulo: 'Ocupação',           largura: 10 },
  { titulo: 'Necessárias',        largura: 12 },
  { titulo: 'Diferença',          largura: 10 },
  { titulo: 'Pico (mês)',         largura: 11 },
];

const COLUNAS_CC = [
  { titulo: 'Planta',             largura: 16 },
  { titulo: 'Área',               largura: 18 },
  { titulo: 'CC',                 largura: 8,  texto: true },
  { titulo: 'CTs',                largura: 6 },
  { titulo: 'Mês',                largura: 6 },
  { titulo: 'Demanda (min)',      largura: 15 },
  { titulo: 'Disponível (min)',   largura: 16 },
  { titulo: 'Atuais',             largura: 9 },
  { titulo: 'Ocupação',           largura: 10 },
  { titulo: 'Necessárias',        largura: 12 },
  { titulo: 'Diferença',          largura: 10 },
  { titulo: 'Pico (mês)',         largura: 11 },
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const chaveDe = (l) => `${l.planta}${l.area}${l.cc}${l.ct}`;

/**
 * Agrupa as linhas CT×mês por CT, na ordem em que chegaram, com os doze meses
 * SEMPRE presentes: mês que a consulta não trouxe vale zero, e a planilha
 * continua tendo doze linhas por CT — é isso que faz as faixas de SUM e MAX
 * terem tamanho fixo.
 */
function porCt(linhas) {
  const mapa = new Map();
  for (const l of linhas ?? []) {
    const k = chaveDe(l);
    if (!mapa.has(k)) {
      mapa.set(k, {
        planta: l.planta, area: l.area, cc: l.cc, ct: l.ct,
        recursos: l.recursos ?? '', unidade: l.unidade ?? '',
        meses: Array.from({ length: 12 }, () =>
          ({ demanda: 0, disponivel: 0, porUnidade: 0 })),
      });
    }
    const m = Number(l.mes);
    if (m >= 1 && m <= 12) {
      const alvo = mapa.get(k).meses[m - 1];
      alvo.demanda += num(l.demanda);
      alvo.disponivel += num(l.disponivel);
      alvo.porUnidade += num(l.por_unidade);
    }
  }
  return [...mapa.values()];
}

/**
 * As abas do .xlsx, prontas para `escreveXlsx({ abas })`.
 *
 * Os números da rodada e da demanda saem como VALOR; tudo que depende do fator
 * sai como FÓRMULA, para a planilha responder quando alguém mexe em B1. Atuais
 * também é fórmula: quem editar "Disponível" à mão para testar um turno a mais
 * vê a quantidade acompanhar.
 */
export function montarSimulador(linhas, { fator = 1 } = {}) {
  const cts = porCt(linhas);

  const antes = [
    ['Fator de OEE', { v: num(fator) || 1, estilo: ESTILO.ENTRADA },
     'edite esta célula: 1 = o OEE cadastrado; 1,1 = cada unidade rende 10% a mais'],
    [],
  ];

  const linhasCt = [];
  const inicioDe = new Map();          // chave do CT -> primeira linha (jan)
  let r = LINHA_CABECALHO + 1;

  for (const ct of cts) {
    inicioDe.set(chaveDe(ct), r);
    const ini = r;
    const fim = r + 11;
    ct.meses.forEach((m, i) => {
      linhasCt.push([
        ct.planta, ct.area, ct.cc, ct.ct, ct.recursos, ct.unidade, i + 1,
        { v: m.demanda,    estilo: ESTILO.INTEIRO },
        { v: m.disponivel, estilo: ESTILO.INTEIRO },
        { v: m.porUnidade, estilo: ESTILO.INTEIRO },
        { f: `IF(J${r}=0,"",I${r}/J${r})`,                            estilo: ESTILO.DECIMAL },
        { f: `IF(I${r}=0,"",H${r}/(I${r}*${FATOR}))`,                 estilo: ESTILO.PERCENTUAL },
        { f: `IF(J${r}=0,"",ROUNDUP(H${r}/(J${r}*${FATOR}),0))`,      estilo: ESTILO.INTEIRO },
        { f: `IF(M${r}="","",M${r}-K${r})`,                           estilo: ESTILO.DECIMAL },
        null,
      ]);
      r += 1;
    });
    // A linha do ano: soma dos doze meses, e a quantidade do ano pela divisão
    // das somas. O pico só existe aqui — é o MAX das doze quantidades acima.
    linhasCt.push([
      ct.planta, ct.area, ct.cc, ct.ct, ct.recursos, ct.unidade,
      { v: 'Ano', estilo: ESTILO.NEGRITO },
      { f: `SUM(H${ini}:H${fim})`, estilo: ESTILO.INTEIRO },
      { f: `SUM(I${ini}:I${fim})`, estilo: ESTILO.INTEIRO },
      { f: `SUM(J${ini}:J${fim})`, estilo: ESTILO.INTEIRO },
      { f: `IF(J${r}=0,"",I${r}/J${r})`,                              estilo: ESTILO.DECIMAL },
      { f: `IF(I${r}=0,"",H${r}/(I${r}*${FATOR}))`,                   estilo: ESTILO.PERCENTUAL },
      { f: `IF(J${r}=0,"",ROUNDUP(H${r}/(J${r}*${FATOR}),0))`,        estilo: ESTILO.INTEIRO },
      { f: `IF(M${r}="","",M${r}-K${r})`,                             estilo: ESTILO.DECIMAL },
      { f: `MAX(M${ini}:M${fim})`, estilo: ESTILO.INTEIRO },
    ]);
    r += 1;
  }
  const ultimaCt = r - 1;

  // ---- Por CC: SUMIFS sobre a aba de CT --------------------------------------
  //
  // As faixas são FIXAS (linha 4 até a última), e não colunas inteiras: coluna
  // inteira somaria o cabeçalho e a célula do fator se algum dia eles
  // coincidissem com o critério. Planta e área entram no critério porque o
  // mesmo CC pode existir em duas áreas.
  const faixa = (col) => `'Por CT'!$${col}$${LINHA_CABECALHO + 1}:$${col}$${Math.max(ultimaCt, LINHA_CABECALHO + 1)}`;
  const somaDe = (col, r2, mes) =>
    `SUMIFS(${faixa(col)},${faixa('A')},A${r2},${faixa('B')},B${r2},${faixa('C')},C${r2},${faixa('G')},${mes})`;

  const ccs = new Map();
  for (const ct of cts) {
    const k = `${ct.planta}${ct.area}${ct.cc}`;
    if (!ccs.has(k)) ccs.set(k, { planta: ct.planta, area: ct.area, cc: ct.cc, cts: 0 });
    ccs.get(k).cts += 1;
  }

  const linhasCc = [];
  let r2 = LINHA_CABECALHO + 1;
  for (const cc of ccs.values()) {
    const ini = r2;
    const fim = r2 + 11;
    for (let i = 0; i < 12; i += 1) {
      linhasCc.push([
        cc.planta, cc.area, cc.cc, cc.cts, i + 1,
        { f: somaDe('H', r2, `E${r2}`), estilo: ESTILO.INTEIRO },
        { f: somaDe('I', r2, `E${r2}`), estilo: ESTILO.INTEIRO },
        { f: somaDe('K', r2, `E${r2}`), estilo: ESTILO.DECIMAL },
        { f: `IF(G${r2}=0,"",F${r2}/(G${r2}*${FATOR}))`, estilo: ESTILO.PERCENTUAL },
        { f: somaDe('M', r2, `E${r2}`), estilo: ESTILO.INTEIRO },
        { f: `J${r2}-H${r2}`, estilo: ESTILO.DECIMAL },
        null,
      ]);
      r2 += 1;
    }
    linhasCc.push([
      cc.planta, cc.area, cc.cc, cc.cts,
      { v: 'Ano', estilo: ESTILO.NEGRITO },
      { f: somaDe('H', r2, '"Ano"'), estilo: ESTILO.INTEIRO },
      { f: somaDe('I', r2, '"Ano"'), estilo: ESTILO.INTEIRO },
      { f: somaDe('K', r2, '"Ano"'), estilo: ESTILO.DECIMAL },
      { f: `IF(G${r2}=0,"",F${r2}/(G${r2}*${FATOR}))`, estilo: ESTILO.PERCENTUAL },
      { f: somaDe('M', r2, '"Ano"'), estilo: ESTILO.INTEIRO },
      { f: `J${r2}-H${r2}`, estilo: ESTILO.DECIMAL },
      { f: `MAX(J${ini}:J${fim})`, estilo: ESTILO.INTEIRO },
    ]);
    r2 += 1;
  }

  return {
    abas: [
      { nome: 'Por CT', colunas: COLUNAS_CT, antes, linhas: linhasCt },
      { nome: 'Por CC', colunas: COLUNAS_CC, linhas: linhasCc,
        antes: [
          ['Fator de OEE', { f: "'Por CT'!B1", estilo: ESTILO.DECIMAL },
           'o fator se edita na aba Por CT; esta aba só soma aquela'],
          [],
        ] },
    ],
    inicioDe,
  };
}

/**
 * A mesma conta em JS, com fator 1, por CT e ano — a prévia da tela.
 *
 * `necessarias` nula quando o CT não tem capacidade calculada (por_unidade
 * zero): dividir por zero não é "precisa de infinitas máquinas", é "esta
 * rodada não conhece este CT", e a tela avisa em vez de mostrar um número.
 */
export function resumoDoSimulador(linhas) {
  return porCt(linhas).map((ct) => {
    const demanda = ct.meses.reduce((s, m) => s + m.demanda, 0);
    const disponivel = ct.meses.reduce((s, m) => s + m.disponivel, 0);
    const porUnidade = ct.meses.reduce((s, m) => s + m.porUnidade, 0);
    const semCapacidade = porUnidade <= 0;
    const necessariasMes = ct.meses.map((m) =>
      (m.porUnidade > 0 ? Math.ceil(m.demanda / m.porUnidade) : null));
    const pico = necessariasMes.some((n) => n !== null)
      ? Math.max(...necessariasMes.filter((n) => n !== null)) : null;

    let aviso = null;
    if (semCapacidade) aviso = 'sem capacidade calculada para este CT';
    else if (demanda <= 0) aviso = 'sem demanda no cenário';
    else if (necessariasMes.some((n, i) => n === null && ct.meses[i].demanda > 0)) {
      aviso = 'há mês com demanda e sem capacidade';
    }

    return {
      planta: ct.planta, area: ct.area, cc: ct.cc, ct: ct.ct,
      recursos: ct.recursos, unidade: ct.unidade,
      demanda, disponivel, porUnidade,
      atuais: semCapacidade ? null : disponivel / porUnidade,
      ocupacao: disponivel > 0 ? demanda / disponivel : null,
      necessarias: semCapacidade ? null : Math.ceil(demanda / porUnidade),
      pico,
      aviso,
    };
  });
}
