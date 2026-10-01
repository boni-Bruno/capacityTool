// =============================================================================
// VERSÕES DO CENÁRIO — a regra, sem banco e sem tela
//
// A unidade de trabalho do planejamento não é o ano, é a VERSÃO do ano. O
// orçamento começa em setembro, bate o martelo em novembro ou dezembro, e no
// meio são três a seis versões, cada uma com mudança de cadastro (migração 45).
//
// Daqui saem três coisas: quais anos estão cadastráveis num cenário, o que falta
// revisar numa área, e se a versão pode ser fechada.
// =============================================================================

/**
 * AS ETAPAS, NA ORDEM DA CADEIA DO MOTOR: instalada (recursos) → planejada
 * (jornada, regime, paradas) → disponível (OEE) → o número (recalcular) → a
 * conferência.
 *
 * Jornada e regime são UM passo porque são a mesma matriz: o regime de dias é a
 * primeira coluna dela desde a migração 41, e os dois se decidem juntos —
 * separá-los aqui faria a tela ser aberta duas vezes para a mesma decisão.
 *
 * `tela` é só documentação de qual editor o passo reusa; o fluxo não navega
 * para lá, ele monta o editor dentro do próprio passo.
 */
export const PASSOS = [
  { codigo: 'recursos',   rotulo: 'Recursos',          tela: 'recursos',
    ajuda: 'Quantidade, equivalência, janela de operação. Máquina nova entra aqui.' },
  { codigo: 'jornada',    rotulo: 'Jornada e regime',  tela: 'turnos_recurso',
    ajuda: 'Quais turnos cada recurso roda em cada mês, e o regime de dias.' },
  { codigo: 'oee',        rotulo: 'OEE',               tela: 'oee',
    ajuda: 'O rendimento que vira disponível. Ausência vale 0% no motor.' },
  { codigo: 'paradas',    rotulo: 'Paradas',           tela: 'paradas',
    ajuda: 'Preventiva, férias coletivas, obra. Parada NÃO tem cenário: é a mesma nos dois.' },
  { codigo: 'recalcular', rotulo: 'Recalcular',        tela: null,
    ajuda: 'A rodada desta área, deste ano e deste cenário.' },
  { codigo: 'conferir',   rotulo: 'Conferir',          tela: null,
    ajuda: 'As anomalias que o cadastro deixou: mês sem regime, turno sobreposto, CT sem capacidade.' },
];

export const CODIGOS = PASSOS.map((p) => p.codigo);

const conhecidos = new Set(CODIGOS);

/** Só códigos que existem, sem repetição, na ordem de PASSOS. */
export function limpaPassos(lista) {
  const s = new Set((lista ?? []).filter((c) => conhecidos.has(c)));
  return CODIGOS.filter((c) => s.has(c));
}

// -----------------------------------------------------------------------------
// O CICLO
// -----------------------------------------------------------------------------

export const aberta = (v) => !!v && !v.fechada_em;

/**
 * A versão aberta de um (cenário, ano), se houver.
 *
 * Só pode haver uma — o banco garante com um índice parcial único (migração 45)
 * —, então achar a primeira é achar a certa.
 */
export function versaoAberta(versoes, origem, ano) {
  return (versoes ?? []).find(
    (v) => v.origem === origem && Number(v.ano) === Number(ano) && aberta(v)) ?? null;
}

/**
 * Os anos CADASTRÁVEIS de um cenário: os que têm versão aberta.
 *
 * É esta lista que os seletores de ano das telas de cadastro passam a oferecer.
 * Ano sem versão aberta não é "ano que não existe" — é ano que ninguém abriu
 * ainda, ou que já foi fechado. Consulta continua enxergando os dois.
 */
export function anosAbertos(versoes, origem) {
  return [...new Set((versoes ?? [])
    .filter((v) => v.origem === origem && aberta(v))
    .map((v) => Number(v.ano)))].sort((a, b) => a - b);
}

/** O número da próxima versão de um (cenário, ano). */
export function proximoNumero(versoes, origem, ano) {
  const nums = (versoes ?? [])
    .filter((v) => v.origem === origem && Number(v.ano) === Number(ano))
    .map((v) => Number(v.numero));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

// -----------------------------------------------------------------------------
// O PROGRESSO
// -----------------------------------------------------------------------------

/**
 * O que falta revisar numa área, na ordem das etapas.
 *
 * `exigidos` é o que a versão pede (escolhido por quem a abriu); `feitos` é o
 * que já foi confirmado. Passo exigido e não confirmado é o que o fluxo cobra.
 */
export function pendentes(exigidos, feitos) {
  const f = new Set(feitos ?? []);
  return limpaPassos(exigidos).filter((c) => !f.has(c));
}

/** O primeiro passo pendente — por onde o fluxo abre. Null quando acabou. */
export function proximoPasso(exigidos, feitos) {
  return pendentes(exigidos, feitos)[0] ?? null;
}

export function progresso(exigidos, feitos) {
  const total = limpaPassos(exigidos).length;
  const falta = pendentes(exigidos, feitos).length;
  const prontos = total - falta;
  return {
    feitos: prontos,
    total,
    pct: total ? Math.round((prontos * 100) / total) : 100,
    completo: falta === 0,
  };
}

/**
 * O que impede fechar a versão — e nada aqui IMPEDE de verdade.
 *
 * A lista é informativa de propósito: o martelo do orçamento bate quando bate, e
 * uma ferramenta que recusasse fechar por causa de uma área pendente viraria o
 * motivo de alguém fechar por fora. O que ela faz é obrigar a decisão a ser
 * tomada de olhos abertos — e fica registrado que foi fechada assim.
 */
export function pendenciasParaFechar(areas) {
  return (areas ?? [])
    .map((a) => ({ ...a, falta: pendentes(a.exigidos, a.feitos) }))
    .filter((a) => a.falta.length > 0);
}
