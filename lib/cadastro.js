import { sql } from './db';
import { recomporFaixas, faixasIguais } from './vigencia-plano';

// Consultas das telas de cadastro. As de leitura do painel ficam em db.js.
//
// Nada aqui faz update em tabela com vigência — isso é responsabilidade de
// lib/vigencia.js. Aqui só se lê o estado e se escreve o que não tem vigência
// (parada é evento com data início/fim, não parâmetro versionado).

// -----------------------------------------------------------------------------
// TURNOS
// -----------------------------------------------------------------------------

export async function turnos() {
  return sql`
    select t.id, t.codigo, t.nome, p.nome as planta
      from turno t
      join planta p on p.id = t.planta_id
     where t.ativo
     order by t.codigo`;
}

// Os 7 dias da semana com o horário que vale em `data`.
// Dia sem linha = o turno não roda nesse dia (e vem com horario_id null).
export async function horariosDoTurno(turnoId, data) {
  return sql`
    select d.dia_semana,
           th.id                    as horario_id,
           th.hora_inicio::text     as hora_inicio,
           th.hora_fim::text        as hora_fim,
           th.min_bruto,
           th.cruza_meia_noite,
           lower(th.vigencia)::text as vigente_desde
      from generate_series(0, 6) as d(dia_semana)
      left join turno_horario th
             on th.turno_id   = ${turnoId}
            and th.dia_semana = d.dia_semana
            and th.vigencia  @> ${data}::date
     order by d.dia_semana`;
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

// O que a vw_turno_minutos entrega ao motor — o número que de fato entra na
// conta, já com o intervalo descontado por tipo de recurso.
export async function minutosEfetivos(turnoId, data) {
  return sql`
    select dia_semana, tipo_recurso, duracao_turno, minutos
      from vw_turno_minutos
     where turno_id = ${turnoId} and vigencia @> ${data}::date
     order by dia_semana, tipo_recurso`;
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
