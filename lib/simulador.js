// =============================================================================
// SIMULADOR DE QUANTIDADE DE RECURSOS
//
// Responde "com quantas pessoas (ou máquinas) por dia este CT atende a demanda
// do cenário?" — e responde num .xlsx COM FÓRMULAS, não numa tela. A decisão
// é do Bruno: ele simula no Excel, onde já mora a conversa com a fábrica, e
// cadastra a resposta na aplicação pelo caminho de sempre (Qtd do recurso para
// máquina; Turnos do recurso para pessoa). Uma tela de simulação aqui seria um
// segundo lugar para decidir capacidade, e o cadastro já é o primeiro.
//
// A PLANILHA DECOMPÕE O DISPONÍVEL DA RODADA em fatores, por CT e mês, em duas
// etapas — a leitura do Bruno é "cada pessoa entrega X minutos por dia num OEE
// Y", e a planilha segue essa ordem:
//
//   min disponíveis por unidade por dia = min planejados por unidade por dia × OEE
//   disponível = unidades/dia × min disponíveis por unidade por dia × dias úteis
//
//   min planejados/unid/dia   planejada ÷ (unidades × dias úteis): o turno
//                             líquido médio de uma unidade, com intervalos,
//                             paradas e sábado curto — SEM o OEE. É média
//                             porque sábado tem 240 min e segunda 480: em
//                             janeiro dá 436, e não é OEE, é sábado.
//   OEE                       disponível ÷ planejada, o da rodada.
//   unidades/dia              Σ qt_recursos dos turnos de dia útil ÷ dias úteis.
//                             10 no 1º turno e 8 no 2º dão 18 — como se
//                             cadastra e como se lê.
//   dias úteis                os do MOTOR (dia_util do fato) — sem os de
//                             apresentação.
//
// O OEE entra UMA vez, nos minutos por unidade — e não de novo no disponível.
// A primeira forma multiplicava os dois na mesma fórmula, e quem lia "minutos
// por unidade por dia" esperava que o OEE já estivesse ali dentro; estava fora,
// e a coluna parecia mentir. Agora os minutos planejados são valor da rodada,
// os disponíveis são fórmula deles com o OEE, e o disponível só multiplica.
//
// Com os valores da rodada a fórmula devolve exatamente o disponível do painel
// — é a prova de que ela está certa. UNIDADES, OEE e OCUPAÇÃO ALVO são as
// células de entrada: muda-se 18 para 22, ou 65% para 70%, e tudo à direita
// responde. Como dividir as 22 entre os turnos é decisão de quem cadastra,
// depois — abrir a planilha por turno só espalharia a mesma pergunta em mais
// linhas.
//
// O ALVO fecha a conta de trás para a frente: unidades/dia necessárias =
// (demanda ÷ dias úteis) ÷ min disponíveis por unidade por dia ÷ ocupação alvo.
// A 100% é o mínimo que cabe a demanda; a 85% precisa de 1/0,85 a mais —
// quem quer folga precisa de gente, e por isso o alvo DIVIDE. A ocupação
// calculada fica ao lado, para a comparação ser numa linha só.
//
// A PRIMEIRA VERSÃO (11/09/2026) dividia o disponível pelo que UMA pessoa
// entregava somando os turnos e chamava de "atuais": dava 9 para 10 + 8
// cadastradas. Aritmética certa, conceito errado, e as colunas de necessárias,
// diferença e pico que vinham junto só poluíam. Saíram todas; ficou a
// decomposição — e o "necessárias" voltou depois, com alvo, do jeito que ele
// pediu.
//
// DIVISÃO DE SOMAS, como no resto do projeto: as duas colunas auxiliares do
// fim — planejado (min) e unidades × dias — existem para a linha do ano e a
// aba Por CC ponderarem minutos por unidade e OEE pela soma, nunca pela média
// das doze linhas ou dos CTs.
//
// AS REFERÊNCIAS DE CÉLULA NASCEM AQUI. É o único lugar que sabe em que linha
// cada CT começa, e é por isso que a aba "Por CC" soma a "Por CT" por
// REFERÊNCIA DIRETA ('Por CT'!H2+'Por CT'!H15) e não por SUMIFS: a primeira
// versão usava SUMIFS com critério de planta, área, CC e mês, e no Excel do
// Bruno as colunas vieram vazias. Sem critério não há o que casar errado.
//
// Motor puro: sem banco, sem tela. `resumoDoSimulador` faz em JS o que a
// planilha faz em fórmula, com os valores da rodada — é a prévia da tela e o
// teste de que as duas contas batem.
// =============================================================================

import { ESTILO } from './xlsx.js';

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                      'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// O cabeçalho é a linha 1; os dados começam na 2. Mover isso é mover todas as
// fórmulas, e por isso está num lugar só.
export const LINHA_CABECALHO = 1;

// A ocupação alvo com que a planilha nasce: 100%, para "necessárias" abrir
// igual ao mínimo que cabe a demanda. Quem quer folga digita a dele.
export const ALVO_INICIAL = 1;

// Colunas da aba Por CT. As letras aparecem nas fórmulas abaixo; a ordem aqui
// e lá tem que ser a mesma.
//   A Planta  B Área  C CC  D CT  E Recursos  F Unidade  G Mês
//   H Demanda  I Dias úteis  J Min planejados/unid/dia  K OEE
//   L Min disponíveis/unid/dia (= J×K)  M Unidades/dia
//   N Disponível (= M×L×I)  O Ocupação calculada (= H÷N)
//   P Ocupação alvo  Q Unidades/dia necessárias (= (H÷I)÷L÷P)
//   R Planejado (min) (= J×M×I)  S Unidades × dias (= M×I)
const COLUNAS_CT = [
  { titulo: 'Planta',                              largura: 16 },
  { titulo: 'Área',                                largura: 18 },
  { titulo: 'CC',                                  largura: 8,  texto: true },
  { titulo: 'CT',                                  largura: 12, texto: true },
  { titulo: 'Recursos',                            largura: 34 },
  { titulo: 'Unidade',                             largura: 9 },
  { titulo: 'Mês',                                 largura: 6 },
  { titulo: 'Demanda (min)',                       largura: 15 },
  { titulo: 'Dias úteis',                          largura: 10 },
  { titulo: 'Min planejados por unidade por dia',  largura: 22 },
  { titulo: 'OEE',                                 largura: 8 },
  { titulo: 'Min disponíveis por unidade por dia', largura: 22 },
  { titulo: 'Unidades por dia',                    largura: 16 },
  { titulo: 'Disponível (min)',                    largura: 16 },
  { titulo: 'Ocupação calculada',                  largura: 12 },
  { titulo: 'Ocupação alvo',                       largura: 12 },
  { titulo: 'Unidades por dia necessárias',        largura: 18 },
  { titulo: 'Planejado (min)',                     largura: 15 },
  { titulo: 'Unidades × dias úteis',               largura: 14 },
];

// Colunas da aba Por CC: as mesmas, sem CT, recursos e unidade, com a
// contagem de CTs no lugar.
//   A Planta  B Área  C CC  D CTs  E Mês
//   F Demanda  G Dias úteis  H Min planejados/unid/dia  I OEE
//   J Min disponíveis/unid/dia  K Unidades/dia  L Disponível
//   M Ocupação calculada  N Ocupação alvo  O Unidades/dia necessárias
//   P Planejado (min)  Q Unidades × dias
const COLUNAS_CC = [
  { titulo: 'Planta',                              largura: 16 },
  { titulo: 'Área',                                largura: 18 },
  { titulo: 'CC',                                  largura: 8,  texto: true },
  { titulo: 'CTs',                                 largura: 6 },
  { titulo: 'Mês',                                 largura: 6 },
  { titulo: 'Demanda (min)',                       largura: 15 },
  { titulo: 'Dias úteis',                          largura: 10 },
  { titulo: 'Min planejados por unidade por dia',  largura: 22 },
  { titulo: 'OEE',                                 largura: 8 },
  { titulo: 'Min disponíveis por unidade por dia', largura: 22 },
  { titulo: 'Unidades por dia',                    largura: 16 },
  { titulo: 'Disponível (min)',                    largura: 16 },
  { titulo: 'Ocupação calculada',                  largura: 12 },
  { titulo: 'Ocupação alvo',                       largura: 12 },
  { titulo: 'Unidades por dia necessárias',        largura: 18 },
  { titulo: 'Planejado (min)',                     largura: 15 },
  { titulo: 'Unidades × dias úteis',               largura: 14 },
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const chaveDe = (l) => `${l.planta}${l.area}${l.cc}${l.ct}`;

/**
 * Agrupa as linhas CT×mês por CT, na ordem em que chegaram, com os doze meses
 * SEMPRE presentes: mês que a consulta não trouxe vale zero, e a planilha
 * continua tendo doze linhas por CT — é isso que faz as faixas de SUM terem
 * tamanho fixo.
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
          ({ demanda: 0, planejada: 0, disponivel: 0, diasUteis: 0, unidadeDias: 0 })),
      });
    }
    const m = Number(l.mes);
    if (m >= 1 && m <= 12) {
      const alvo = mapa.get(k).meses[m - 1];
      alvo.demanda += num(l.demanda);
      alvo.planejada += num(l.planejada);
      alvo.disponivel += num(l.disponivel);
      alvo.diasUteis += num(l.dias_uteis);
      alvo.unidadeDias += num(l.unidade_dias);
    }
  }
  return [...mapa.values()];
}

/** Os fatores de um mês, a partir do que a rodada gravou. */
function fatores(m) {
  return {
    unidades: m.diasUteis > 0 ? m.unidadeDias / m.diasUteis : 0,
    minPorUnidadeDia: m.unidadeDias > 0 ? m.planejada / m.unidadeDias : 0,
    oee: m.planejada > 0 ? m.disponivel / m.planejada : 0,
  };
}

// As fórmulas que se repetem nas duas abas, dadas as letras de cada coluna.
// Zero no divisor vira célula vazia, e não #DIV/0!: CT sem cálculo é um CT
// que a rodada não conhece, não um erro de planilha.
const vazioSe = (cond, expr) => `IF(${cond},"",${expr})`;

/**
 * As abas do .xlsx, prontas para `escreveXlsx({ abas })`.
 *
 * Demanda, dias úteis, minutos planejados por unidade, OEE, unidades e a
 * ocupação alvo saem como VALOR — os três últimos em célula de entrada. O
 * resto é FÓRMULA, para a planilha responder quando alguém mexe nas entradas.
 */
export function montarSimulador(linhas) {
  const cts = porCt(linhas);

  const linhasCt = [];
  const inicioDe = new Map();          // chave do CT -> primeira linha (jan)
  let r = LINHA_CABECALHO + 1;

  // As colunas calculadas de uma linha da Por CT, na ordem L..S.
  const calculadas = (n) => [
    { f: `J${n}*K${n}`,                                     estilo: ESTILO.DECIMAL },
    null,                                                    // M: unidades (valor ou fórmula)
    { f: `M${n}*L${n}*I${n}`,                               estilo: ESTILO.INTEIRO },
    { f: vazioSe(`N${n}=0`, `H${n}/N${n}`),                 estilo: ESTILO.PERCENTUAL },
    { v: ALVO_INICIAL,                                      estilo: ESTILO.ENTRADA_PCT },
    { f: vazioSe(`OR(I${n}=0,L${n}=0,P${n}=0)`,
                 `(H${n}/I${n})/L${n}/P${n}`),              estilo: ESTILO.DECIMAL },
    { f: `J${n}*M${n}*I${n}`,                               estilo: ESTILO.INTEIRO },
    { f: `M${n}*I${n}`,                                     estilo: ESTILO.DECIMAL },
  ];

  for (const ct of cts) {
    inicioDe.set(chaveDe(ct), r);
    const ini = r;
    const fim = r + 11;
    ct.meses.forEach((m, i) => {
      const f = fatores(m);
      const calc = calculadas(r);
      calc[1] = { v: f.unidades, estilo: ESTILO.ENTRADA };
      linhasCt.push([
        ct.planta, ct.area, ct.cc, ct.ct, ct.recursos, ct.unidade, i + 1,
        { v: m.demanda,          estilo: ESTILO.INTEIRO },
        { v: m.diasUteis,        estilo: ESTILO.INTEIRO },
        { v: f.minPorUnidadeDia, estilo: ESTILO.DECIMAL },
        { v: f.oee,              estilo: ESTILO.ENTRADA_PCT },
        ...calc,
      ]);
      r += 1;
    });
    // A linha do ano: somas do que se soma, e o resto derivado das somas —
    // minutos por unidade = planejado ÷ unidades×dias, OEE = disponível ÷
    // planejado, unidades = unidades×dias ÷ dias. A média das doze linhas
    // mentiria num ano em que a equipe cresce em julho.
    linhasCt.push([
      ct.planta, ct.area, ct.cc, ct.ct, ct.recursos, ct.unidade,
      { v: 'Ano', estilo: ESTILO.NEGRITO },
      { f: `SUM(H${ini}:H${fim})`,                          estilo: ESTILO.INTEIRO },
      { f: `SUM(I${ini}:I${fim})`,                          estilo: ESTILO.INTEIRO },
      { f: vazioSe(`S${r}=0`, `R${r}/S${r}`),               estilo: ESTILO.DECIMAL },
      { f: vazioSe(`R${r}=0`, `N${r}/R${r}`),               estilo: ESTILO.PERCENTUAL },
      { f: vazioSe(`S${r}=0`, `N${r}/S${r}`),               estilo: ESTILO.DECIMAL },
      { f: vazioSe(`I${r}=0`, `S${r}/I${r}`),               estilo: ESTILO.DECIMAL },
      { f: `SUM(N${ini}:N${fim})`,                          estilo: ESTILO.INTEIRO },
      { f: vazioSe(`N${r}=0`, `H${r}/N${r}`),               estilo: ESTILO.PERCENTUAL },
      { v: ALVO_INICIAL,                                    estilo: ESTILO.ENTRADA_PCT },
      { f: vazioSe(`OR(I${r}=0,L${r}=0,P${r}=0)`,
                   `(H${r}/I${r})/L${r}/P${r}`),            estilo: ESTILO.DECIMAL },
      { f: `SUM(R${ini}:R${fim})`,                          estilo: ESTILO.INTEIRO },
      { f: `SUM(S${ini}:S${fim})`,                          estilo: ESTILO.DECIMAL },
    ]);
    r += 1;
  }

  // ---- Por CC: soma das linhas dos CTs, por referência direta --------------
  const ccs = new Map();
  for (const ct of cts) {
    const k = `${ct.planta}${ct.area}${ct.cc}`;
    if (!ccs.has(k)) ccs.set(k, { planta: ct.planta, area: ct.area, cc: ct.cc, inicios: [] });
    ccs.get(k).inicios.push(inicioDe.get(chaveDe(ct)));
  }

  const linhasCc = [];
  let r2 = LINHA_CABECALHO + 1;
  for (const cc of ccs.values()) {
    // `desl` é 0..11 para o mês e 12 para a linha do ano de cada CT.
    const refs = (col, desl) => cc.inicios.map((ini) => `'Por CT'!${col}${ini + desl}`);
    const soma = (col, desl) => refs(col, desl).join('+');
    const linhaCc = (desl, rotulo) => [
      cc.planta, cc.area, cc.cc, cc.inicios.length, rotulo,
      { f: soma('H', desl),                                  estilo: ESTILO.INTEIRO },
      // Dias úteis do CC: o maior entre os CTs. Calendários costumam ser o
      // mesmo; quando não são, somar diria que o CC tem 44 dias no mês.
      { f: `MAX(${refs('I', desl).join(',')})`,              estilo: ESTILO.INTEIRO },
      { f: vazioSe(`Q${r2}=0`, `P${r2}/Q${r2}`),             estilo: ESTILO.DECIMAL },
      { f: vazioSe(`P${r2}=0`, `L${r2}/P${r2}`),             estilo: ESTILO.PERCENTUAL },
      { f: vazioSe(`Q${r2}=0`, `L${r2}/Q${r2}`),             estilo: ESTILO.DECIMAL },
      { f: soma('M', desl),                                  estilo: ESTILO.DECIMAL },
      { f: soma('N', desl),                                  estilo: ESTILO.INTEIRO },
      { f: vazioSe(`L${r2}=0`, `F${r2}/L${r2}`),             estilo: ESTILO.PERCENTUAL },
      { v: ALVO_INICIAL,                                     estilo: ESTILO.ENTRADA_PCT },
      { f: vazioSe(`OR(G${r2}=0,J${r2}=0,N${r2}=0)`,
                   `(F${r2}/G${r2})/J${r2}/N${r2}`),          estilo: ESTILO.DECIMAL },
      { f: soma('R', desl),                                  estilo: ESTILO.INTEIRO },
      { f: soma('S', desl),                                  estilo: ESTILO.DECIMAL },
    ];
    for (let i = 0; i < 12; i += 1) {
      linhasCc.push(linhaCc(i, i + 1));
      r2 += 1;
    }
    linhasCc.push(linhaCc(12, { v: 'Ano', estilo: ESTILO.NEGRITO }));
    r2 += 1;
  }

  return {
    abas: [
      { nome: 'Por CT', colunas: COLUNAS_CT, linhas: linhasCt },
      { nome: 'Por CC', colunas: COLUNAS_CC, linhas: linhasCc },
    ],
    inicioDe,
  };
}

/**
 * A mesma conta em JS, por CT e ano, com os valores da rodada e alvo de 100%
 * — a prévia da tela. Unidades e minutos por unidade são médias ponderadas
 * (divisão de somas), como a linha do ano da planilha.
 *
 * `aviso` quando o CT não tem capacidade calculada ou não tem demanda: a
 * ocupação sai vazia, e a tela diz por quê em vez de mostrar traço mudo.
 */
export function resumoDoSimulador(linhas) {
  return porCt(linhas).map((ct) => {
    const soma = (campo) => ct.meses.reduce((s, m) => s + m[campo], 0);
    const demanda = soma('demanda');
    const planejada = soma('planejada');
    const disponivel = soma('disponivel');
    const diasUteis = soma('diasUteis');
    const unidadeDias = soma('unidadeDias');
    const f = fatores({ planejada, disponivel, diasUteis, unidadeDias });
    const minDisp = unidadeDias > 0 ? disponivel / unidadeDias : null;

    let aviso = null;
    if (disponivel <= 0) aviso = 'sem capacidade calculada para este CT';
    else if (demanda <= 0) aviso = 'sem demanda no cenário';
    else if (ct.meses.some((m) => m.demanda > 0 && m.disponivel <= 0)) {
      aviso = 'há mês com demanda e sem capacidade';
    }

    return {
      planta: ct.planta, area: ct.area, cc: ct.cc, ct: ct.ct,
      recursos: ct.recursos, unidade: ct.unidade,
      demanda, diasUteis, disponivel,
      unidades: diasUteis > 0 ? f.unidades : null,
      minPorUnidadeDia: unidadeDias > 0 ? f.minPorUnidadeDia : null,
      minDisponiveisPorUnidadeDia: minDisp,
      oee: planejada > 0 ? f.oee : null,
      ocupacao: disponivel > 0 ? demanda / disponivel : null,
      necessarias: diasUteis > 0 && minDisp > 0
        ? (demanda / diasUteis) / minDisp / ALVO_INICIAL : null,
      aviso,
    };
  });
}
