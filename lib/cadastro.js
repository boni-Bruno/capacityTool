import { sql } from './db';
import { recomporFaixas, faixasIguais } from './faixas';

// Consultas das telas de cadastro. As de leitura do painel ficam em db.js.
//
// Vigência aparece em turno_horario e recurso_turno, mas as telas guardam a
// configuração atual, não uma linha do tempo: as faixas são reescritas em vez
// de fechadas e reabertas. A tradução entre matriz de meses e daterange está
// em lib/faixas.js.

// -----------------------------------------------------------------------------
// TURNOS
// -----------------------------------------------------------------------------

// Turnos ativos — para os lugares que só oferecem escolha (paradas, matriz).
export async function turnos() {
  return sql`
    select t.id, t.codigo, t.nome, p.nome as planta
      from turno t
      join planta p on p.id = t.planta_id
     where t.ativo
     order by t.codigo`;
}

// Para a tela de cadastro: inclui os desativados.
//
// Turno referenciado em cálculo ou calendário não pode ser apagado, então
// excluirTurno() desativa. Se a tela de cadastro escondesse o desativado, ele
// sumiria sem volta e o unique (planta_id, codigo) continuaria bloqueando o
// código — dava para "excluir" o turno 4 e nunca mais conseguir criar um 4.
export async function turnosParaCadastro() {
  return sql`
    select t.id, t.codigo, t.nome, t.ativo, p.nome as planta
      from turno t
      join planta p on p.id = t.planta_id
     order by t.ativo desc, t.codigo`;
}

export async function reativarTurno(id) {
  const r = await sql`
    update turno set ativo = true where id = ${Number(id)} returning id`;
  if (!r.length) throw new Error('Turno não encontrado.');
}

export async function plantas() {
  return sql`select id, codigo, nome from planta where ativo order by nome`;
}

// Os 7 dias da semana com o horário e os minutos que o motor enxerga.
// Dia sem linha = o turno não roda nesse dia (vem com horario_id null).
//
// Sem filtro de data: o cadastro de turno guarda uma configuração só por dia
// da semana, não uma linha de tempo. Ver "vigencia is null or @> current_date"
// abaixo — cadastro novo entra com vigência ilimitada, e o filtro por hoje
// existe só para não tropeçar em linha antiga com vigência fechada no passado.
export async function horariosDoTurno(turnoId) {
  return sql`
    select d.dia_semana,
           th.id                as horario_id,
           th.hora_inicio::text as hora_inicio,
           th.hora_fim::text    as hora_fim,
           th.min_bruto,
           th.cruza_meia_noite,
           maq.minutos          as min_maquina,
           pes.minutos          as min_pessoa
      from generate_series(0, 6) as d(dia_semana)
      left join turno_horario th
             on th.turno_id   = ${turnoId}
            and th.dia_semana = d.dia_semana
            and th.vigencia  @> current_date
      left join vw_turno_minutos maq
             on maq.turno_id     = th.turno_id
            and maq.dia_semana   = th.dia_semana
            and maq.vigencia     = th.vigencia
            and maq.tipo_recurso = 'MAQUINA'
      left join vw_turno_minutos pes
             on pes.turno_id     = th.turno_id
            and pes.dia_semana   = th.dia_semana
            and pes.vigencia     = th.vigencia
            and pes.tipo_recurso = 'PESSOA'
     order by d.dia_semana`;
}

export async function criarTurno({ planta_id, codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();

  if (!cod) throw new Error('Informe o código do turno.');
  if (!desc) throw new Error('Informe a descrição do turno.');

  // O unique (planta_id, codigo) não olha `ativo`, então um turno desativado
  // continua segurando o código. Sem esta checagem o usuário só veria
  // "duplicate key value violates unique constraint", sem saber que existe um
  // turno desativado ocupando aquele código nem que dá para reativá-lo.
  const jaTem = await sql`
    select id, nome, ativo from turno
     where planta_id = ${Number(planta_id)} and codigo = ${cod}`;

  if (jaTem.length) {
    const t = jaTem[0];
    throw new Error(
      t.ativo
        ? `Já existe um turno com o código ${cod} ("${t.nome}") nesta planta.`
        : `O código ${cod} está ocupado por "${t.nome}", que está desativado. ` +
          `Reative-o na lista acima ou escolha outro código.`
    );
  }

  const r = await sql`
    insert into turno (planta_id, codigo, nome)
    values (${Number(planta_id)}, ${cod}, ${desc})
    returning id`;

  return r[0].id;
}

export async function renomearTurno(id, { codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();

  if (!cod) throw new Error('Informe o código do turno.');
  if (!desc) throw new Error('Informe a descrição do turno.');

  const r = await sql`
    update turno set codigo = ${cod}, nome = ${desc}
     where id = ${Number(id)} returning id`;
  if (!r.length) throw new Error('Turno não encontrado.');
}

/**
 * Exclui o turno. Horários e intervalos caem junto (têm on delete cascade).
 *
 * Se o turno já foi usado em qualquer outro lugar — recurso, parada,
 * exceção, OEE ou numa rodada de cálculo — apagar arrancaria a
 * referência de um número que alguém já viu. Nesse caso ele é desativado em
 * vez de apagado, e a tela diz o porquê.
 */
export async function excluirTurno(id) {
  const turnoId = Number(id);

  const r = await sql`
    select
      (select count(*) from recurso_turno    where turno_id = ${turnoId}) as recursos,
      (select count(*) from parada           where turno_id = ${turnoId}) as paradas,
      (select count(*) from excecao          where turno_id = ${turnoId}) as excecoes,
      (select count(*) from recurso_oee      where turno_id = ${turnoId}) as oees,
      (select count(*) from capacidade_fato  where turno_id = ${turnoId}) as calculos`;

  const usos = r[0];
  const onde = [];
  if (Number(usos.recursos))    onde.push('recursos');
  if (Number(usos.paradas))     onde.push('paradas');
  if (Number(usos.excecoes))    onde.push('exceções');
  if (Number(usos.oees))        onde.push('OEE');
  if (Number(usos.calculos))    onde.push('cálculos já rodados');

  if (onde.length) {
    await sql`update turno set ativo = false where id = ${turnoId}`;
    return { desativado: true, onde };
  }

  const d = await sql`delete from turno where id = ${turnoId} returning id`;
  if (!d.length) throw new Error('Turno não encontrado.');
  return { desativado: false, onde: [] };
}

/**
 * Define o horário de um dia da semana. Substitui o que houver.
 *
 * A vigência entra ilimitada (daterange(null, null)): o cadastro de turno
 * guarda a configuração atual, não uma linha do tempo. O exclude constraint
 * continua valendo e passa a garantir exatamente uma linha por turno e dia.
 *
 * min_bruto e cruza_meia_noite não são enviados — o trigger
 * fn_turno_horario_calcula preenche, e o check th_min_bruto_valido recusa
 * duração fora de 1..1440. É ele que pega a virada de meia-noite errada.
 */
export async function definirHorario(turnoId, diaSemana, horaInicio, horaFim) {
  const t = Number(turnoId);
  const d = Number(diaSemana);

  if (!Number.isInteger(d) || d < 0 || d > 6) throw new Error('Dia da semana inválido.');
  if (!horaInicio || !horaFim) throw new Error('Informe início e fim.');

  await sql.transaction([
    sql`delete from turno_horario where turno_id = ${t} and dia_semana = ${d}`,
    sql`insert into turno_horario (turno_id, dia_semana, hora_inicio, hora_fim, vigencia)
        values (${t}, ${d}, ${horaInicio}::time, ${horaFim}::time,
                daterange(null::date, null::date))`,
  ]);
}

// Turno deixa de rodar nesse dia da semana: sem linha, o motor nem gera
// capacidade para o dia.
export async function removerHorario(turnoId, diaSemana) {
  const d = Number(diaSemana);
  if (!Number.isInteger(d) || d < 0 || d > 6) throw new Error('Dia da semana inválido.');

  await sql`delete from turno_horario
             where turno_id = ${Number(turnoId)} and dia_semana = ${d}`;
}

// Intervalos de refeição/pausa do turno. aplica_a decide de quem desconta:
// máquina não para para almoçar, posto de pessoa para.
export async function intervalosDoTurno(turnoId) {
  return sql`
    select id, descricao, minutos, descontavel, aplica_a
      from turno_intervalo
     where turno_id = ${turnoId}
     order by id`;
}

// -----------------------------------------------------------------------------
// RECURSOS
// -----------------------------------------------------------------------------

export async function recursos(areaId) {
  return sql`
    select r.id, r.codigo, r.nome, r.tipo_recurso
      from recurso r
     where r.area_id = ${areaId}
     order by r.nome`;
}

/**
 * Calendários disponíveis para o recurso, com os dias da semana que cada um
 * cobre e qual está valendo.
 *
 * Para quem cadastra, "rodízio" é um regime de trabalho do recurso. No modelo
 * é um calendário: RODIZIO roda de domingo a sábado, PADRAO de segunda a
 * sábado. O contexto do projeto é explícito que rodízio é calendário e não
 * escala — as tabelas escala/escala_dia ficam sem uso de propósito, porque na
 * empresa quem faz rodízio é a pessoa, e a máquina nunca para.
 */
export async function calendariosDoRecurso(recursoId) {
  return sql`
    select c.id,
           c.codigo,
           c.nome,
           (rc.id is not null) as atual,
           (select string_agg(cd.dia_semana::text, ',' order by cd.dia_semana)
              from calendario_dia cd
             where cd.calendario_id = c.id) as dias
      from recurso r
      join area a       on a.id = r.area_id
      join calendario c on c.planta_id = a.planta_id
      left join recurso_calendario rc
             on rc.calendario_id = c.id
            and rc.recurso_id    = r.id
            and rc.vigencia      @> current_date
     where r.id = ${recursoId}
     order by c.codigo`;
}

// Um calendário por recurso, sem linha do tempo — mesmo tratamento dado ao
// horário do turno. O exclude constraint de recurso_calendario continua e
// passa a garantir exatamente uma linha por recurso.
export async function definirCalendario(recursoId, calendarioId) {
  const r = Number(recursoId);
  const c = Number(calendarioId);
  if (!Number.isInteger(c) || c <= 0) throw new Error('Calendário inválido.');

  await sql.transaction([
    sql`delete from recurso_calendario where recurso_id = ${r}`,
    sql`insert into recurso_calendario (recurso_id, calendario_id, vigencia)
        values (${r}, ${c}, daterange(null::date, null::date))`,
  ]);
}

// Matriz mês x turno do ano, para o recurso escolhido.
//
// Devolve quantos dias de cada mês estão cobertos, não só sim/não: um cadastro
// antigo pode ter faixa começando no dia 15, e a tela precisa mostrar que
// aquele mês está pela metade em vez de mentir "ligado o mês todo".
//
// upper(vigencia) é null quando a vigência é aberta. least() no Postgres
// ignora null, então least(null, fim_do_mes) = fim_do_mes — que é exatamente
// o comportamento desejado para uma faixa sem data de fim.
export async function matrizTurnosDoAno(recursoId, ano) {
  return sql`
    with m as (
      select d::date as ini, (d + interval '1 month')::date as fim
        from generate_series(make_date(${ano}, 1, 1),
                             make_date(${ano}, 12, 1),
                             interval '1 month') as d
    )
    select t.id                         as turno_id,
           t.codigo,
           t.nome,
           extract(month from m.ini)::int as mes,
           (m.fim - m.ini)              as dias_mes,
           coalesce((
             select sum(least(upper(rt.vigencia), m.fim)
                      - greatest(lower(rt.vigencia), m.ini))
               from recurso_turno rt
              where rt.recurso_id = ${recursoId}
                and rt.turno_id   = t.id
                and rt.vigencia  && daterange(m.ini, m.fim)
           ), 0)                        as dias_cobertos
      from turno t
     cross join m
     where t.ativo
     order by t.codigo, m.ini`;
}

/**
 * Meses e dias da semana em que os turnos marcados somam mais de 24 h.
 *
 * O motor soma turno a turno, como manda: se um recurso tiver marcado um turno
 * de 24/7 e também o 1º, 2º e 3º, os minutos empilham e a planejada passa da
 * instalada. Não é erro de cálculo, é cadastro sobreposto — e só aparece
 * depois, como "% do teto" acima de 100%.
 *
 * É o mesmo teste que 03_motor.sql já sugeria como conferência: em dia útil
 * sem parada, os turnos do recurso somam no máximo 1440 minutos.
 *
 * qt_recursos e equivalencia ficam de fora de propósito: eles multiplicam o
 * conjunto (N máquinas iguais), então o limite de 24 h vale por máquina.
 */
export async function turnosSobrepostos(recursoId, ano, tipoRecurso) {
  return sql`
    with meses as (
      select d::date as ini, (d + interval '1 month')::date as fim
        from generate_series(make_date(${ano}, 1, 1),
                             make_date(${ano}, 12, 1),
                             interval '1 month') as d
    ),
    marcados as (
      select extract(month from m.ini)::int as mes, m.ini, rt.turno_id
        from meses m
        join recurso_turno rt
          on rt.recurso_id = ${Number(recursoId)}
         and rt.vigencia && daterange(m.ini, m.fim)
    )
    select mk.mes,
           vtm.dia_semana,
           sum(vtm.minutos)::int as minutos
      from marcados mk
      join vw_turno_minutos vtm on vtm.turno_id     = mk.turno_id
                               and vtm.tipo_recurso = ${tipoRecurso}
                               and vtm.vigencia    @> mk.ini
     group by mk.mes, vtm.dia_semana
    having sum(vtm.minutos) > 1440
     order by mk.mes, vtm.dia_semana`;
}

/**
 * Aplica a matriz de um ano inteiro.
 *
 * `marcados` é { turnoId: [meses] }. O ano é substituído pelo que veio da
 * tela; o que estiver configurado fora dele é recortado na virada e mantido.
 *
 * Reescreve as faixas do turno em vez de fazer update no lugar, mas só dos
 * turnos que realmente mudaram — salvar a matriz não pode apagar e recriar
 * linha que ninguém tocou.
 */
export async function definirTurnosDoAno(recursoId, ano, marcados) {
  const atuais = await sql`
    select id, turno_id,
           lower(vigencia)::text as inicio,
           upper(vigencia)::text as fim,
           escala_id,
           escala_data_referencia::text as escala_data_referencia
      from recurso_turno
     where recurso_id = ${recursoId}
     order by turno_id, lower(vigencia)`;

  const ativos = await sql`select id from turno where ativo order by id`;

  const porTurno = new Map();
  for (const t of ativos) porTurno.set(Number(t.id), []);
  for (const r of atuais) {
    const k = Number(r.turno_id);
    if (!porTurno.has(k)) porTurno.set(k, []);   // turno inativo com faixa antiga
    porTurno.get(k).push(r);
  }

  const passos = [];
  let alterados = 0;

  for (const [turnoId, existentes] of porTurno) {
    const meses = marcados?.[turnoId] ?? marcados?.[String(turnoId)] ?? [];
    const novas = recomporFaixas(existentes, ano, meses);

    if (faixasIguais(existentes, novas)) continue;
    alterados++;

    // Escala quase nunca é usada (o rodízio da empresa é calendário, não
    // escala), mas se alguém preencheu não é a matriz de meses que vai apagar.
    const comEscala = existentes.find((e) => e.escala_id !== null);
    const escalaId = comEscala?.escala_id ?? null;
    const escalaRef = comEscala?.escala_data_referencia ?? null;

    for (const e of existentes) {
      passos.push(sql`delete from recurso_turno where id = ${e.id}`);
    }
    for (const n of novas) {
      passos.push(sql`
        insert into recurso_turno
               (recurso_id, turno_id, escala_id, escala_data_referencia, vigencia)
        values (${recursoId}, ${turnoId}, ${escalaId}, ${escalaRef},
                daterange(${n.inicio}::date, ${n.fim}::date))`);
    }
  }

  if (passos.length) await sql.transaction(passos);
  return { turnosAlterados: alterados };
}

// -----------------------------------------------------------------------------
// PARADAS
//
// Parada NÃO tem vigência: é evento com data_inicio/data_fim, então apagar é
// apagar mesmo. O histórico do número fica preservado pela rodada de cálculo
// (capacidade_fato guarda o resultado daquela execução), não pela linha aqui.
//
// Regra de fronteira do contexto: parada da planta inteira vai em `excecao`;
// parada de recursos específicos vai em `parada`. Esta tela é só a segunda.
// -----------------------------------------------------------------------------

export async function tiposParada() {
  return sql`
    select id, codigo, nome, planejada, abate_planejada, abate_disponivel, cor
      from tipo_parada
     order by nome`;
}

export async function paradas(areaId, ano) {
  return sql`
    select p.id,
           p.data_inicio::text as data_inicio,
           p.data_fim::text    as data_fim,
           p.minutos,
           p.dia_inteiro,
           p.descricao,
           r.nome              as recurso,
           r.codigo            as recurso_codigo,
           tp.nome             as tipo,
           tp.cor,
           tp.abate_planejada,
           tp.abate_disponivel,
           t.codigo            as turno
      from parada p
      join recurso r      on r.id = p.recurso_id
      join tipo_parada tp on tp.id = p.tipo_parada_id
      left join turno t   on t.id = p.turno_id
     where r.area_id = ${areaId}
       and p.data_inicio <= make_date(${ano}, 12, 31)
       and p.data_fim    >= make_date(${ano}, 1, 1)
     order by p.data_inicio desc, r.nome`;
}

export async function criarParada(p) {
  const diaInteiro = Boolean(p.dia_inteiro);

  // O banco tem check (dia_inteiro or minutos is not null), mas a mensagem
  // dele não ajuda quem está preenchendo o formulário.
  if (!diaInteiro && (p.minutos === null || p.minutos === undefined || p.minutos === '')) {
    throw new Error('Informe os minutos ou marque a parada como dia inteiro.');
  }
  if (p.data_fim < p.data_inicio) {
    throw new Error('A data final não pode ser anterior à inicial.');
  }

  const r = await sql`
    insert into parada
           (recurso_id, tipo_parada_id, data_inicio, data_fim,
            turno_id, minutos, dia_inteiro, descricao)
    values (${p.recurso_id}, ${p.tipo_parada_id},
            ${p.data_inicio}::date, ${p.data_fim}::date,
            ${p.turno_id || null},
            ${diaInteiro ? null : Number(p.minutos)},
            ${diaInteiro},
            ${p.descricao || null})
    returning id`;
  return r[0].id;
}

export async function apagarParada(id) {
  const r = await sql`delete from parada where id = ${id} returning id`;
  if (!r.length) throw new Error('Parada não encontrada.');
  return r[0].id;
}
