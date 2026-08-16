import { sql } from './db';
import { PESO_PADRAO } from './dia-util';

// Calendários e as regras deles.
//
// calendario_dia diz "esta linha trabalha neste dia da semana". É o que o
// motor consulta para saber se o dia é útil.
//
// Guardava também qual turno, mas isso duplicava o turno_horario: se o turno
// não tem horário no dia, ele já não roda. A duplicação custava caro — turno
// criado depois do seed nascia fora dos calendários e produzia zero em
// silêncio. Quais turnos rodam vem de turno_horario cruzado com recurso_turno.

export async function calendariosCadastro() {
  return sql`
    select c.id, c.codigo, c.nome,
           c.planta_id,
           p.nome as planta,
           (select count(*) from recurso_calendario rc
             where rc.calendario_id = c.id) as recursos,
           (select string_agg(cd.dia_semana::text, ',' order by cd.dia_semana)
              from calendario_dia cd where cd.calendario_id = c.id) as dias
      from calendario c
      join planta p on p.id = c.planta_id
     order by p.nome, c.codigo`;
}

export async function criarCalendario({ planta_id, codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!planta_id) throw new Error('Escolha a planta do calendário.');
  if (!cod) throw new Error('Informe o código do calendário.');
  if (!desc) throw new Error('Informe o nome do calendário.');

  const jaTem = await sql`
    select nome from calendario
     where planta_id = ${Number(planta_id)} and codigo = ${cod}`;
  if (jaTem.length) {
    throw new Error(
      `Já existe um calendário com o código ${cod} nesta planta ("${jaTem[0].nome}").`);
  }

  const r = await sql`
    insert into calendario (planta_id, codigo, nome)
    values (${Number(planta_id)}, ${cod}, ${desc})
    returning id`;
  return r[0].id;
}

export async function alterarCalendario(id, { codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!cod) throw new Error('Informe o código do calendário.');
  if (!desc) throw new Error('Informe o nome do calendário.');

  const r = await sql`
    update calendario set codigo = ${cod}, nome = ${desc}
     where id = ${Number(id)} returning id`;
  if (!r.length) throw new Error('Calendário não encontrado.');
}

/**
 * Copia um calendário de outra planta: os dias e os pesos.
 *
 * Ficou trivial depois que o calendário deixou de referenciar turnos — antes
 * era preciso casar turno por código e criar no destino o que faltasse, senão
 * o calendário importado apontava para turnos de outra planta e produzia zero.
 *
 * Turno continua sendo por planta, e a planta nova precisa dos seus. Copiar
 * junto é opcional (`copiar_turnos`) porque agora é conveniência, não
 * requisito: o calendário funciona sozinho.
 *
 * Feriados não vêm — são justamente o que muda de cidade para cidade.
 */
export async function copiarCalendario({
  origem_id, planta_destino_id, codigo, nome, copiar_turnos = false,
}) {
  const origemId = Number(origem_id);
  const destinoId = Number(planta_destino_id);

  const orig = await sql`
    select c.id, c.codigo, c.nome, c.planta_id from calendario c where c.id = ${origemId}`;
  if (!orig.length) throw new Error('Calendário de origem não encontrado.');

  if (orig[0].planta_id === destinoId) {
    throw new Error('Escolha uma planta diferente da planta de origem.');
  }

  const cod = String(codigo ?? '').trim() || orig[0].codigo;
  const desc = String(nome ?? '').trim() || orig[0].nome;

  const conflito = await sql`
    select nome from calendario where planta_id = ${destinoId} and codigo = ${cod}`;
  if (conflito.length) {
    throw new Error(
      `A planta de destino já tem um calendário com o código ${cod} ("${conflito[0].nome}").`);
  }

  const novoCal = await sql`
    insert into calendario (planta_id, codigo, nome)
    values (${destinoId}, ${cod}, ${desc}) returning id`;
  const calId = novoCal[0].id;

  await sql.transaction([
    sql`insert into calendario_dia (calendario_id, dia_semana)
        select ${calId}, dia_semana from calendario_dia
         where calendario_id = ${origemId}`,
    // Os pesos vão junto: fazem parte de como aquele calendário conta.
    sql`insert into calendario_peso (calendario_id, dia_semana, peso)
        select ${calId}, dia_semana, peso from calendario_peso
         where calendario_id = ${origemId}`,
  ]);

  const dias = await sql`
    select count(*)::int as n from calendario_dia where calendario_id = ${calId}`;

  const criados = copiar_turnos
    ? await copiarTurnos(orig[0].planta_id, destinoId)
    : [];

  return { id: calId, dias: dias[0].n, turnosCriados: criados };
}

// Turnos que existem na origem e não no destino, casados por código, com
// horários e intervalos. Turno sem horário não gera capacidade nenhuma, então
// não faz sentido copiar só o nome.
async function copiarTurnos(plantaOrigem, plantaDestino) {
  const faltando = await sql`
    select o.id, o.codigo
      from turno o
     where o.planta_id = ${plantaOrigem} and o.ativo
       and not exists (select 1 from turno d
                        where d.planta_id = ${plantaDestino}
                          and d.codigo = o.codigo)
     order by o.codigo`;

  const criados = [];
  for (const t of faltando) {
    const novo = await sql`
      insert into turno (planta_id, codigo, nome)
      select ${plantaDestino}, o.codigo, o.nome from turno o where o.id = ${t.id}
      returning id`;

    await sql.transaction([
      sql`insert into turno_horario (turno_id, dia_semana, hora_inicio, hora_fim, vigencia)
          select ${novo[0].id}, th.dia_semana, th.hora_inicio, th.hora_fim,
                 daterange(null::date, null::date)
            from turno_horario th
           where th.turno_id = ${t.id} and th.vigencia @> current_date`,
      sql`insert into turno_intervalo
                 (turno_id, dia_semana, descricao, minutos, descontavel, aplica_a)
          select ${novo[0].id}, ti.dia_semana, ti.descricao, ti.minutos,
                 ti.descontavel, ti.aplica_a
            from turno_intervalo ti where ti.turno_id = ${t.id}`,
    ]);
    criados.push(t.codigo);
  }
  return criados;
}

/**
 * Calendário não tem coluna `ativo`, então não há desativação: ou apaga, ou
 * recusa. Recusar é o certo quando algum recurso segue o calendário — apagar
 * deixaria o recurso sem regime e ele sumiria do cálculo em silêncio, porque o
 * motor faz INNER JOIN em recurso_calendario.
 */
export async function excluirCalendario(id) {
  const c = Number(id);
  const uso = await sql`
    select (select count(*) from recurso_calendario where calendario_id = ${c}) as recursos,
           (select count(*) from excecao_calendario  where calendario_id = ${c}) as excecoes`;

  if (Number(uso[0].recursos)) {
    throw new Error(
      `Este calendário é seguido por ${uso[0].recursos} recurso(s) e não pode ` +
      `ser apagado. Mude esses recursos para outro regime antes.`
    );
  }

  // As regras e os vínculos com exceção caem por cascade.
  const d = await sql`delete from calendario where id = ${c} returning id`;
  if (!d.length) throw new Error('Calendário não encontrado.');
  return { excecoes: Number(uso[0].excecoes) };
}

// -----------------------------------------------------------------------------
// DIA ÚTIL
//
// Convenção da casa: segunda a sexta conta 1, sábado trabalhado conta 0,5,
// domingo conta 0. Fica configurável porque isso muda de empresa para empresa.
//
// O peso só vale nos dias que o calendário de fato trabalha — sábado sem regra
// de turno conta zero, não 0,5. É a mesma pergunta que o motor faz para saber
// se o dia é útil, então o número da tela e o do cálculo contam a mesma coisa.
// -----------------------------------------------------------------------------

export async function pesosDoCalendario(calendarioId) {
  const linhas = await sql`
    select dia_semana, peso::float8 as peso
      from calendario_peso
     where calendario_id = ${Number(calendarioId)}`;

  const pesos = [...PESO_PADRAO];
  for (const l of linhas) pesos[Number(l.dia_semana)] = Number(l.peso);
  return pesos;
}

export async function definirPesos(calendarioId, pesos) {
  const c = Number(calendarioId);
  const passos = [sql`delete from calendario_peso where calendario_id = ${c}`];

  for (let dia = 0; dia <= 6; dia++) {
    const p = Number(String(pesos?.[dia] ?? '').replace(',', '.'));
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      throw new Error(`Peso inválido para ${dia}: use um valor de 0 a 1.`);
    }
    // Só grava o que difere do padrão — tabela vazia é o comportamento normal.
    if (p === PESO_PADRAO[dia]) continue;
    passos.push(sql`
      insert into calendario_peso (calendario_id, dia_semana, peso)
      values (${c}, ${dia}, ${p})`);
  }

  await sql.transaction(passos);
}

/**
 * Quantos dias de cada dia da semana o calendário trabalha em cada mês do ano.
 *
 * Segue a mesma prioridade do motor: exceção do dia inteiro manda, senão vale
 * a regra do dia da semana. Devolve a contagem crua; o peso é aplicado depois,
 * em JS, para mudar o peso não exigir nova consulta.
 */
export async function diasTrabalhadosPorMes(calendarioId, ano, areaId = null) {
  return sql`
    with d as (
      select dia::date as data,
             extract(month from dia)::int as mes,
             extract(dow   from dia)::int as dia_semana
        from generate_series(make_date(${ano}, 1, 1),
                             make_date(${ano}, 12, 31),
                             interval '1 day') as dia
    )
    select d.mes, d.dia_semana,
           -- Quanto do dia as paradas de apresentacao consomem. Parada que
           -- afeta a capacidade nao entra aqui: ela ja tirou o dia da contagem
           -- pelo filtro do where.
           coalesce((
             select sum(ex.impacto_dia)
               from excecao ex
               join excecao_calendario ec on ec.excecao_id = ex.id
              where ec.calendario_id = ${Number(calendarioId)}
                and ex.data = d.data
                and ex.turno_id is null
                and not ex.afeta_capacidade
                and (${areaId}::int is null or exists (
                      select 1 from excecao_area ea
                       where ea.excecao_id = ex.id
                         and ea.area_id = ${areaId}::int))
           ), 0)::float8 as impacto,
           count(*)::int as dias
      from d
     where coalesce(
             (select ex.dia_util
                from excecao ex
                join excecao_calendario ec on ec.excecao_id = ex.id
               where ec.calendario_id = ${Number(calendarioId)}
                 and ex.data = d.data
                 and ex.turno_id is null
                 and ex.afeta_capacidade
                 and (${areaId}::int is null or exists (
                       select 1 from excecao_area ea
                        where ea.excecao_id = ex.id
                          and ea.area_id = ${areaId}::int))
               limit 1),
             exists (select 1 from calendario_dia cd
                      where cd.calendario_id = ${Number(calendarioId)}
                        and cd.dia_semana = d.dia_semana)
           )
     group by d.mes, d.dia_semana, 3
     order by d.mes, d.dia_semana`;
}

/**
 * Todo dia do ano, dizendo se ESTE calendário trabalha nele e por quê.
 *
 * A prioridade é a mesma do motor: exceção observada por este calendário manda;
 * sem exceção, vale a regra do dia da semana. Por isso a grade fica diferente
 * conforme o calendário — domingo é parado no padrão e trabalhado no rodízio, e
 * um feriado só pinta em quem o observa.
 *
 * `excecao_id` vem só quando ESTE calendário observa a exceção. Uma cadastrada
 * na planta e não marcada aqui não aparece, porque de fato não para esta linha
 * — quem lista as da planta é excecoesDoAno(), em lib/excecao.js.
 *
 * `areaId` estreita ainda mais: depois que a exceção passou a valer por área,
 * a grade sem filtro mostraria feriado que só alcança a Confecção como se
 * parasse a planta inteira.
 */
export async function diasDoAno(calendarioId, ano, areaId = null) {
  const c = Number(calendarioId);
  return sql`
    with d as (
      select dia::date as data,
             extract(dow from dia)::int as dia_semana
        from generate_series(make_date(${ano}, 1, 1),
                             make_date(${ano}, 12, 31),
                             interval '1 day') as dia
    )
    select d.data::text  as data,
           d.dia_semana,
           -- Parada de apresentacao nao muda o "trabalha": ela aparece na
           -- grade e conta no dia util, mas o dia produz igual.
           coalesce(case when ex.afeta_capacidade then ex.dia_util end,
                    regra.tem) as trabalha,
           ex.id         as excecao_id,
           ex.tipo,
           ex.descricao,
           ex.dia_util   as excecao_util,
           ex.afeta_capacidade,
           ex.impacto_dia::float8 as impacto_dia
      from d
      left join lateral (
            select e.id, e.tipo, e.descricao, e.dia_util,
                   e.afeta_capacidade, e.impacto_dia
              from excecao e
              join excecao_calendario ec on ec.excecao_id = e.id
             where ec.calendario_id = ${c}
               and e.data = d.data
               and e.turno_id is null
               -- Sem área escolhida, vale qualquer exceção que este calendário
               -- observe — é a visão "todas as áreas ao mesmo tempo". Com uma
               -- área, só as que alcançam ela.
               and (${areaId}::int is null or exists (
                     select 1 from excecao_area ea
                      where ea.excecao_id = e.id
                        and ea.area_id = ${areaId}::int))
             limit 1) ex on true
     cross join lateral (
            select exists (select 1 from calendario_dia cd
                            where cd.calendario_id = ${c}
                              and cd.dia_semana = d.dia_semana) as tem) regra
     order by d.data`;
}

// -----------------------------------------------------------------------------
// DIAS DA SEMANA EM QUE A LINHA TRABALHA
// -----------------------------------------------------------------------------

export async function diasDoCalendario(calendarioId) {
  const r = await sql`
    select dia_semana from calendario_dia
     where calendario_id = ${Number(calendarioId)}
     order by dia_semana`;
  return r.map((x) => Number(x.dia_semana));
}

/**
 * Substitui os dias do calendário pelo que veio da tela.
 *
 * Sete linhas no máximo, então apaga e reinsere sem se preocupar em detectar o
 * que mudou — o custo de comparar seria maior que o de reescrever.
 */
export async function definirDias(calendarioId, dias) {
  const c = Number(calendarioId);
  const limpos = [...new Set((dias ?? []).map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);

  await sql.transaction([
    sql`delete from calendario_dia where calendario_id = ${c}`,
    ...limpos.map((d) => sql`
      insert into calendario_dia (calendario_id, dia_semana) values (${c}, ${d})`),
  ]);

  return { dias: limpos.length };
}

/**
 * Os regimes que os recursos de uma área seguem, do mais usado para o menos.
 *
 * A contagem de dias úteis é por CALENDÁRIO, e uma área pode ter máquina em
 * rodízio e máquina em padrão ao mesmo tempo — nesse caso não existe "o dia
 * útil da área", existem dois. A tela usa o primeiro como padrão e oferece a
 * troca, em vez de escolher em silêncio.
 */
export async function calendariosDaArea(areaId, ate) {
  return sql`
    select c.id, c.codigo, c.nome, count(*)::int as recursos
      from recurso r
      join recurso_calendario rc on rc.recurso_id = r.id
                                and rc.vigencia @> ${ate}::date
      join calendario c on c.id = rc.calendario_id
     where r.area_id = ${Number(areaId)}
     group by c.id, c.codigo, c.nome
     order by count(*) desc, c.codigo`;
}
