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
// A PLANILHA DECOMPÕE O DISPONÍVEL DA RODADA em quatro fatores, por CT e mês:
//
//   disponível = unidades/dia × min por unidade por dia × dias úteis × OEE
//
//   unidades/dia   Σ qt_recursos dos turnos de dia útil ÷ dias úteis. 10 no
//                  1º turno e 8 no 2º dão 18 — como se cadastra e como se lê.
//   min/unid/dia   planejada ÷ (unidades × dias úteis): o turno líquido médio
//                  de uma unidade, já com intervalos, paradas e sábado curto.
//   dias úteis     os do MOTOR (dia_util do fato) — sem os de apresentação.
//   OEE            disponível ÷ planejada, o da rodada.
//
// Com os valores da rodada a fórmula devolve exatamente o disponível do painel
// — é a prova de que ela está certa. UNIDADES e OEE são as células de entrada:
// muda-se 18 para 22, ou 65% para 70%, e disponível e ocupação respondem. Como
// dividir as 22 entre os turnos é decisão de quem cadastra, depois — abrir a
// planilha por turno só espalharia a mesma pergunta em mais linhas.
//
// A PRIMEIRA VERSÃO (11/09/2026) dividia o disponível pelo que UMA pessoa
// entregava somando os turnos e chamava de "atuais": dava 9 para 10 + 8
// cadastradas. Aritmética certa, conceito errado, e as colunas de necessárias,
// diferença e pico que vinham junto só poluíam. Saíram todas; ficou a
// decomposição.
//
// DIVISÃO DE SOMAS, como no resto do projeto: a linha do ano soma demanda,
// dias úteis e disponível; unidades e minutos por unidade do ano são médias
// ponderadas por SUMPRODUCT — nunca a média das doze linhas.
//
// AS REFERÊNCIAS DE CÉLULA NASCEM AQUI. É o único lugar que sabe em que linha
// cada CT começa, e é por isso que a aba "Por CC" consegue somar a "Por CT" com
// SUMIFS em vez de repetir a conta.
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

// Colunas da aba Por CT. As letras aparecem nas fórmulas abaixo; a ordem aqui
// e lá tem que ser a mesma.
//   A Planta  B Área  C CC  D CT  E Recursos  F Unidade  G Mês
//   H Demanda  I Dias úteis  J Min/unid/dia  K Unidades/dia  L OEE
//   M Disponível  N Ocupação
const COLUNAS_CT = [
  { titulo: 'Planta',                  largura: 16 },
  { titulo: 'Área',                    largura: 18 },
  { titulo: 'CC',                      largura: 8,  texto: true },
  { titulo: 'CT',                      largura: 12, texto: true },
  { titulo: 'Recursos',                largura: 34 },
  { titulo: 'Unidade',                 largura: 9 },
  { titulo: 'Mês',                     largura: 6 },
  { titulo: 'Demanda (min)',           largura: 15 },
  { titulo: 'Dias úteis',              largura: 10 },
  { titulo: 'Min por unidade por dia', largura: 20 },
  { titulo: 'Unidades por dia',        largura: 16 },
  { titulo: 'OEE',                     largura: 8 },
  { titulo: 'Disponível (min)',        largura: 16 },
  { titulo: 'Ocupação',                largura: 10 },
];

//   A Planta  B Área  C CC  D CTs  E Mês  F Demanda  G Unidades/dia
//   H Disponível  I Ocupação
const COLUNAS_CC = [
  { titulo: 'Planta',            largura: 16 },
  { titulo: 'Área',              largura: 18 },
  { titulo: 'CC',                largura: 8,  texto: true },
  { titulo: 'CTs',               largura: 6 },
  { titulo: 'Mês',               largura: 6 },
  { titulo: 'Demanda (min)',     largura: 15 },
  { titulo: 'Unidades por dia',  largura: 16 },
  { titulo: 'Disponível (min)',  largura: 16 },
  { titulo: 'Ocupação',          largura: 10 },
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

/** Os quatro fatores de um mês, a partir do que a rodada gravou. */
function fatores(m) {
  return {
    unidades: m.diasUteis > 0 ? m.unidadeDias / m.diasUteis : 0,
    minPorUnidadeDia: m.unidadeDias > 0 ? m.planejada / m.unidadeDias : 0,
    oee: m.planejada > 0 ? m.disponivel / m.planejada : 0,
  };
}

/**
 * As abas do .xlsx, prontas para `escreveXlsx({ abas })`.
 *
 * Demanda, dias úteis, minutos por unidade, unidades e OEE saem como VALOR —
 * os dois últimos em célula de entrada. Disponível e ocupação são FÓRMULA,
 * para a planilha responder quando alguém mexe nas entradas.
 */
export function montarSimulador(linhas) {
  const cts = porCt(linhas);

  const linhasCt = [];
  const inicioDe = new Map();          // chave do CT -> primeira linha (jan)
  let r = LINHA_CABECALHO + 1;

  for (const ct of cts) {
    inicioDe.set(chaveDe(ct), r);
    const ini = r;
    const fim = r + 11;
    ct.meses.forEach((m, i) => {
      const f = fatores(m);
      linhasCt.push([
        ct.planta, ct.area, ct.cc, ct.ct, ct.recursos, ct.unidade, i + 1,
        { v: m.demanda,          estilo: ESTILO.INTEIRO },
        { v: m.diasUteis,        estilo: ESTILO.INTEIRO },
        { v: f.minPorUnidadeDia, estilo: ESTILO.DECIMAL },
        { v: f.unidades,         estilo: ESTILO.ENTRADA },
        { v: f.oee,              estilo: ESTILO.ENTRADA_PCT },
        { f: `K${r}*J${r}*I${r}*L${r}`,          estilo: ESTILO.INTEIRO },
        { f: `IF(M${r}=0,"",H${r}/M${r})`,       estilo: ESTILO.PERCENTUAL },
      ]);
      r += 1;
    });
    // A linha do ano: somas do que se soma; unidades e minutos por unidade
    // como média PONDERADA pelos dias (e pelas unidades), porque a média das
    // doze linhas mentiria num ano em que a equipe cresce em julho. O OEE do
    // ano é disponível ÷ planejada, e a planejada é K×J×I somado.
    const pond = (col) => `SUMPRODUCT(${col}${ini}:${col}${fim},I${ini}:I${fim})`;
    const unidDias = pond('K');
    const planejada = `SUMPRODUCT(J${ini}:J${fim},K${ini}:K${fim},I${ini}:I${fim})`;
    linhasCt.push([
      ct.planta, ct.area, ct.cc, ct.ct, ct.recursos, ct.unidade,
      { v: 'Ano', estilo: ESTILO.NEGRITO },
      { f: `SUM(H${ini}:H${fim})`, estilo: ESTILO.INTEIRO },
      { f: `SUM(I${ini}:I${fim})`, estilo: ESTILO.INTEIRO },
      { f: `IF(${unidDias}=0,"",${planejada}/${unidDias})`, estilo: ESTILO.DECIMAL },
      { f: `IF(I${r}=0,"",${unidDias}/I${r})`,              estilo: ESTILO.DECIMAL },
      { f: `IF(${planejada}=0,"",M${r}/${planejada})`,      estilo: ESTILO.PERCENTUAL },
      { f: `SUM(M${ini}:M${fim})`,                          estilo: ESTILO.INTEIRO },
      { f: `IF(M${r}=0,"",H${r}/M${r})`,                    estilo: ESTILO.PERCENTUAL },
    ]);
    r += 1;
  }
  const ultimaCt = r - 1;

  // ---- Por CC: SUMIFS sobre a aba de CT --------------------------------------
  //
  // As faixas são FIXAS (linha 2 até a última), e não colunas inteiras: coluna
  // inteira somaria o cabeçalho se algum dia ele coincidisse com o critério.
  // Planta e área entram no critério porque o mesmo CC pode existir em duas
  // áreas.
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
    const linhaCc = (mes, rotulo) => [
      cc.planta, cc.area, cc.cc, cc.cts, rotulo,
      { f: somaDe('H', r2, mes), estilo: ESTILO.INTEIRO },
      { f: somaDe('K', r2, mes), estilo: ESTILO.DECIMAL },
      { f: somaDe('M', r2, mes), estilo: ESTILO.INTEIRO },
      { f: `IF(H${r2}=0,"",F${r2}/H${r2})`, estilo: ESTILO.PERCENTUAL },
    ];
    for (let i = 0; i < 12; i += 1) {
      linhasCc.push(linhaCc(`E${r2}`, i + 1));
      r2 += 1;
    }
    linhasCc.push(linhaCc('"Ano"', { v: 'Ano', estilo: ESTILO.NEGRITO }));
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
 * A mesma conta em JS, por CT e ano, com os valores da rodada — a prévia da
 * tela. Unidades e minutos por unidade são médias ponderadas (divisão de
 * somas), como a linha do ano da planilha.
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
      oee: planejada > 0 ? f.oee : null,
      ocupacao: disponivel > 0 ? demanda / disponivel : null,
      aviso,
    };
  });
}
