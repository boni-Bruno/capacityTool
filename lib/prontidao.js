// =============================================================================
// PRONTIDÃO DA PLANTA PARA UM ANO — o checklist antes de abrir a versão
//
// Puro: recebe os números já lidos do banco e devolve o que está pronto, o que
// está em alerta e o que fazer. Nenhuma consulta aqui.
//
// POR QUE ELE EXISTE, com a medição que o criou (01/10/2026):
//
//     2026 → 32 exceções de calendário
//     2027 → 69
//     2028 →  8
//
// Quem abrisse 2028 teria ~60 feriados tratados como dia útil e a capacidade
// sairia inflada — sem erro, sem aviso e sem nada na tela denunciando. Turno sem
// horário e calendário sem dia da semana produzem o mesmo tipo de silêncio, pelo
// outro lado: capacidade de menos.
//
// Nenhum destes itens é do cenário. Turno, calendário e feriado são da PLANTA e
// valem para o Orçamento e para a Simulação igual — por isso o checklist fica
// aqui, na abertura, e não dentro do laço por área: oito áreas da Matriz
// revisariam os mesmos feriados oito vezes.
// =============================================================================

// Abaixo disto, a diferença para o ano anterior deixa de ser ruído de calendário
// (um feriado que caiu no domingo, uma emenda a menos) e passa a ser cadastro
// que ninguém fez. Meio é folgado de propósito: acusar de menos é o erro caro.
const FRACAO_MINIMA = 0.5;

const item = (chave, estado, titulo, detalhe, ondeResolver) =>
  ({ chave, estado, titulo, detalhe, ondeResolver });

/**
 * @param dados {{
 *   planta: string,
 *   calendarios: number,            quantos calendários a planta tem
 *   calendariosSemDia: number,      quantos deles não têm dia da semana marcado
 *   excecoesDoAno: number,          feriados e exceções cadastrados para o ano
 *   excecoesDoAnoAnterior: number,
 *   turnosAtivos: number,
 *   turnosSemHorario: number,       ativos que não têm horário em dia nenhum
 * }}
 * @returns [{ chave, estado: 'ok'|'alerta'|'falta', titulo, detalhe, ondeResolver }]
 */
export function prontidaoDaPlanta(dados, ano) {
  const d = dados ?? {};
  const itens = [];

  // --- calendário ----------------------------------------------------------
  if (!Number(d.calendarios)) {
    itens.push(item('calendario', 'falta',
      'Esta planta não tem calendário',
      'Sem calendário o recurso não casa com dia nenhum e some do cálculo — '
      + 'não sai zerado, some. Nada vai ser calculado para esta planta.',
      '/cadastros/calendarios'));
  } else if (Number(d.calendariosSemDia) > 0) {
    itens.push(item('calendario', 'falta',
      `${d.calendariosSemDia} calendário(s) sem dia da semana marcado`,
      'Calendário que não trabalha em dia nenhum zera a planejada de todo '
      + 'recurso que o segue.',
      '/cadastros/calendarios'));
  } else {
    itens.push(item('calendario', 'ok',
      `${d.calendarios} calendário(s), todos com dias marcados`, null, null));
  }

  // --- os feriados DO ANO --------------------------------------------------
  //
  // A regra é COMPARAÇÃO COM O ANO ANTERIOR, e não um limite absoluto: não
  // existe "quantos feriados são o certo" — depende da cidade, do ano e das
  // emendas. Mas oito contra sessenta e nove fala sozinho.
  const doAno = Number(d.excecoesDoAno ?? 0);
  const anterior = Number(d.excecoesDoAnoAnterior ?? 0);

  if (doAno === 0) {
    itens.push(item('feriados', 'falta',
      `Nenhum feriado cadastrado para ${ano}`,
      anterior
        ? `${ano - 1} tem ${anterior}. O ano inteiro seria calculado como se `
          + 'não houvesse feriado nenhum, e a capacidade sairia inflada sem '
          + 'nada avisar.'
        : 'O ano seria calculado como se não houvesse feriado nenhum.',
      '/cadastros/calendarios'));
  } else if (anterior > 0 && doAno < anterior * FRACAO_MINIMA) {
    itens.push(item('feriados', 'alerta',
      `${ano} tem ${doAno} exceção(ões) contra ${anterior} de ${ano - 1}`,
      'Pode ser que o calendário do ano ainda não tenha sido lançado por '
      + 'inteiro. Cada feriado que falta vira um dia útil a mais, e a '
      + 'capacidade sai maior do que vai ser.',
      '/cadastros/calendarios'));
  } else {
    itens.push(item('feriados', 'ok',
      `${doAno} exceção(ões) cadastrada(s) para ${ano}`
      + (anterior ? ` (${ano - 1} teve ${anterior})` : ''), null, null));
  }

  // --- turnos --------------------------------------------------------------
  if (!Number(d.turnosAtivos)) {
    itens.push(item('turnos', 'falta',
      'Esta planta não tem turno ativo',
      'Sem turno não há jornada para cadastrar, e a planejada é zero.',
      '/cadastros/turnos'));
  } else if (Number(d.turnosSemHorario) > 0) {
    itens.push(item('turnos', 'falta',
      `${d.turnosSemHorario} turno(s) ativo(s) sem horário`,
      'Turno sem horário não gera linha em dia nenhum. Ele aparece para '
      + 'marcar na matriz e não produz nada — é o jeito mais silencioso de '
      + 'perder capacidade.',
      '/cadastros/turnos'));
  } else {
    itens.push(item('turnos', 'ok',
      `${d.turnosAtivos} turno(s) ativo(s), todos com horário`, null, null));
  }

  return itens;
}

/** O pior estado de uma lista de itens: falta > alerta > ok. */
export function piorEstado(itens) {
  const e = (itens ?? []).map((i) => i.estado);
  if (e.includes('falta')) return 'falta';
  if (e.includes('alerta')) return 'alerta';
  return 'ok';
}

/**
 * Se dá para abrir a versão sem confirmar de novo.
 *
 * `falta` desliga o botão: é cadastro ausente, e abrir assim produz número
 * errado em silêncio. `alerta` deixa abrir COM confirmação — pode ser que o
 * calendário daquele ano seja mesmo mais curto, e o checklist informa, não
 * tutela.
 */
export function podeAbrir(itens) {
  const pior = piorEstado(itens);
  return { permitido: pior !== 'falta', pedeConfirmacao: pior === 'alerta' };
}
