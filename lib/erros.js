// O princípio do projeto é "falha tem que dar erro na cara" — constraint que
// recusa em vez de default que mascara. Isso continua valendo aqui: nada nesta
// lista engole erro. O que ela faz é trocar a mensagem crua do Postgres por
// uma que diz o que fazer, mantendo a original no console do servidor.

const POR_CONSTRAINT = {
  // Guarda do bug da virada de meia-noite: o 3º turno já virou -1020 minutos
  // e sumiu do cálculo em silêncio. Hoje o banco recusa.
  th_min_bruto_valido:
    'A duração do turno ficou fora de 1 a 1440 minutos. Confira o horário de ' +
    'início e fim — turno que vira a meia-noite é normal (ex.: 22:00 às 06:00), ' +
    'mas fim igual ao início daria 24 h cheias.',

  th_sem_sobreposicao:
    'Já existe outro horário valendo para esse turno nesse dia da semana e ' +
    'nesse período. Feche a vigência anterior antes de abrir uma nova.',

  rt_sem_sobreposicao:
    'Esse recurso já tem esse turno vinculado num período que se sobrepõe. ' +
    'Encerre o vínculo atual antes de abrir outro.',

  rt_escala_precisa_referencia:
    'Escala de rodízio exige uma data de referência para saber onde o ciclo começa.',

  rp_sem_sobreposicao:
    'Já existe parâmetro valendo para esse recurso nesse período.',

  rc_sem_sobreposicao:
    'Já existe calendário valendo para esse recurso nesse período.',

  oee_sem_sobreposicao:
    'Já existe OEE dessa origem valendo para esse recurso e turno nesse período.',
};

export function mensagemDeErro(e) {
  const bruta = e?.message ?? 'Falhou';

  // O driver Neon devolve o nome do constraint em e.constraint; quando não
  // devolve, ele costuma aparecer no texto da mensagem.
  const nome =
    e?.constraint ??
    Object.keys(POR_CONSTRAINT).find((c) => bruta.includes(c));

  if (nome && POR_CONSTRAINT[nome]) return POR_CONSTRAINT[nome];

  // daterange inválido: lower > upper. Acontece quando a data de início é
  // anterior ao começo da vigência que se está fechando.
  if (bruta.includes('range lower bound must be less than or equal to range upper bound')) {
    return 'A data de início é anterior ao começo da vigência atual. ' +
           'Escolha uma data posterior.';
  }

  return bruta;
}
