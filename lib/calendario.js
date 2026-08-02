import { sql } from './db';
import { PESO_PADRAO } from './dia-util';

// Calendários e as regras deles.
//
// calendario_regra diz "neste calendário, neste dia da semana, roda este
// turno". É o que o motor consulta para saber se o dia é útil: sem a linha, a
// capacidade sai zero mesmo com o turno marcado no recurso.
//
// Para quem cadastra, o calendário é o regime de dias — RODIZIO trabalha
// domingo, PADRAO não. Por isso a tela é uma matriz dia x turno: as duas
// perguntas que o motor faz, no mesmo lugar.

export async function calendariosCadastro() {
  return sql`
    select c.id, c.codigo, c.nome,
           c.planta_id,
           p.nome as planta,
           (select count(*) from recurso_calendario rc
             where rc.calendario_id = c.id) as recursos,
           (select string_agg(distinct cr.dia_semana::text, ','
                              order by cr.dia_semana::text)
              from calendario_regra cr where cr.calendario_id = c.id) as dias
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
 * Copia um calendário de outra planta, com as regras.
 *
 * O pulo do gato: calendario_regra.turno_id aponta para turnos DA PLANTA DE
 * ORIGEM, e turno é por planta. Copiar as regras cruas criaria um calendário
 * apontando para turnos de outra planta — o motor nunca casaria isso com o
 * recurso_turno do destino e a capacidade sairia zero, calada.
 *
 * Então os turnos são casados por código. O que não existir no destino é
 * criado, com horários e intervalos iguais aos da origem — sem isso o
 * calendário importado nasce inerte, que é pior do que não importar.
 */
export async function copiarCalendario({ origem_id, planta_destino_id, codigo, nome }) {
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

  const regras = await sql`
    select cr.dia_semana, t.codigo as turno_codigo, t.nome as turno_nome, t.id as turno_id
      from calendario_regra cr
      join turno t on t.id = cr.turno_id
     where cr.calendario_id = ${origemId}
     order by t.codigo, cr.dia_semana`;

  // Casa por código; cria no destino o que faltar.
  const doDestino = await sql`
    select id, codigo from turno where planta_id = ${destinoId}`;
  const mapa = new Map(doDestino.map((t) => [t.codigo, t.id]));

  const criados = [];
  const vistos = new Map();
  for (const r of regras) {
    if (mapa.has(r.turno_codigo) || vistos.has(r.turno_codigo)) continue;
    vistos.set(r.turno_codigo, r.turno_id);
  }

  for (const [codTurno, turnoOrigemId] of vistos) {
    const novo = await sql`
      insert into turno (planta_id, codigo, nome)
      select ${destinoId}, ${codTurno}, t.nome from turno t where t.id = ${turnoOrigemId}
      returning id`;
    const novoId = novo[0].id;
    mapa.set(codTurno, novoId);
    criados.push(codTurno);

    // Horário e intervalos junto: turno sem horário não gera capacidade.
    await sql.transaction([
      sql`insert into turno_horario (turno_id, dia_semana, hora_inicio, hora_fim, vigencia)
          select ${novoId}, th.dia_semana, th.hora_inicio, th.hora_fim,
                 daterange(null::date, null::date)
            from turno_horario th
           where th.turno_id = ${turnoOrigemId} and th.vigencia @> current_date`,
      sql`insert into turno_intervalo (turno_id, descricao, minutos, descontavel, aplica_a)
          select ${novoId}, ti.descricao, ti.minutos, ti.descontavel, ti.aplica_a
            from turno_intervalo ti where ti.turno_id = ${turnoOrigemId}`,
    ]);
  }

  const novoCal = await sql`
    insert into calendario (planta_id, codigo, nome)
    values (${destinoId}, ${cod}, ${desc}) returning id`;
  const calId = novoCal[0].id;

  const passos = regras.map((r) => sql`
    insert into calendario_regra (calendario_id, dia_semana, turno_id)
    values (${calId}, ${r.dia_semana}, ${mapa.get(r.turno_codigo)})
    on conflict do nothing`);

  // Os pesos de dia útil vão junto: fazem parte de como aquele calendário conta.
  passos.push(sql`
    insert into calendario_peso (calendario_id, dia_semana, peso)
    select ${calId}, dia_semana, peso from calendario_peso
     where calendario_id = ${origemId}`);

  if (passos.length) await sql.transaction(passos);

  return { id: calId, regras: regras.length, turnosCriados: criados };
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
export async function diasTrabalhadosPorMes(calendarioId, ano) {
  return sql`
    with d as (
      select dia::date as data,
             extract(month from dia)::int as mes,
             extract(dow   from dia)::int as dia_semana
        from generate_series(make_date(${ano}, 1, 1),
                             make_date(${ano}, 12, 31),
                             interval '1 day') as dia
    )
    select d.mes, d.dia_semana, count(*)::int as dias
      from d
     where coalesce(
             (select ex.dia_util
                from excecao ex
                join excecao_calendario ec on ec.excecao_id = ex.id
               where ec.calendario_id = ${Number(calendarioId)}
                 and ex.data = d.data
                 and ex.turno_id is null
               limit 1),
             exists (select 1 from calendario_regra cr
                      where cr.calendario_id = ${Number(calendarioId)}
                        and cr.dia_semana = d.dia_semana)
           )
     group by d.mes, d.dia_semana
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
 */
export async function diasDoAno(calendarioId, ano) {
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
           coalesce(ex.dia_util, regra.tem) as trabalha,
           ex.id         as excecao_id,
           ex.tipo,
           ex.descricao,
           ex.dia_util   as excecao_util
      from d
      left join lateral (
            select e.id, e.tipo, e.descricao, e.dia_util
              from excecao e
              join excecao_calendario ec on ec.excecao_id = e.id
             where ec.calendario_id = ${c}
               and e.data = d.data
               and e.turno_id is null
             limit 1) ex on true
     cross join lateral (
            select exists (select 1 from calendario_regra cr
                            where cr.calendario_id = ${c}
                              and cr.dia_semana = d.dia_semana) as tem) regra
     order by d.data`;
}

// -----------------------------------------------------------------------------
// REGRAS: dia da semana x turno
// -----------------------------------------------------------------------------

export async function regrasDoCalendario(calendarioId) {
  return sql`
    select t.id as turno_id, t.codigo, t.nome,
           (select string_agg(cr.dia_semana::text, ',' order by cr.dia_semana)
              from calendario_regra cr
             where cr.calendario_id = ${Number(calendarioId)}
               and cr.turno_id = t.id) as dias
      from calendario c
      join turno t on t.planta_id = c.planta_id and t.ativo
     where c.id = ${Number(calendarioId)}
     order by t.codigo`;
}

/**
 * Substitui as regras do calendário pelo que veio da tela.
 *
 * `marcados` é { turnoId: [dias] }. Apaga e reinsere só o que mudou — salvar a
 * matriz inteira não pode reescrever linha que ninguém tocou.
 */
export async function definirRegras(calendarioId, marcados) {
  const c = Number(calendarioId);
  const atuais = await regrasDoCalendario(c);
  const passos = [];
  let alterados = 0;

  for (const t of atuais) {
    const antes = (t.dias ?? '').split(',').filter(Boolean).map(Number).sort((a, b) => a - b);
    const depois = [...new Set((marcados?.[t.turno_id] ?? marcados?.[String(t.turno_id)] ?? [])
      .map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
      .sort((a, b) => a - b);

    if (antes.length === depois.length && antes.every((d, i) => d === depois[i])) continue;
    alterados++;

    passos.push(sql`
      delete from calendario_regra
       where calendario_id = ${c} and turno_id = ${t.turno_id}`);
    for (const d of depois) {
      passos.push(sql`
        insert into calendario_regra (calendario_id, dia_semana, turno_id)
        values (${c}, ${d}, ${t.turno_id})`);
    }
  }

  if (passos.length) await sql.transaction(passos);
  return { turnosAlterados: alterados };
}
