import { neon } from '@neondatabase/serverless';

// A conexão só é aberta na primeira consulta, não quando o arquivo é lido.
// Sem isso o build quebraria em qualquer máquina sem DATABASE_URL definida.
let _sql;
function conn() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não definida');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Tagged template. Também carrega o .transaction() do driver, usado pela
// camada de vigência para fechar e abrir uma linha sem estado intermediário.
export const sql = Object.assign(
  (strings, ...values) => conn()(strings, ...values),
  { transaction: (passos) => conn().transaction(passos) }
);

// Última rodada que tem resultado para ESTA área e ESTE ano.
//
// fn_calcular_capacidade roda por área: recalcular a Confecção cria uma
// execução que só tem linhas da Confecção. Pegar a execução mais recente sem
// olhar a área fazia o painel de outra área mostrar zero em tudo — o número
// não existia naquela rodada, e a tela dizia que a capacidade era nula.
export async function ultimaExecucao(areaId, ano) {
  const r = await sql`
    select e.id, e.periodo_inicio, e.periodo_fim, e.concluido_em, c.nome as cenario
      from calculo_execucao e
      join cenario c on c.id = e.cenario_id
     where e.status = 'OK'
       and exists (
             select 1 from capacidade_instalada_dia i
              where i.execucao_id = e.id
                and i.area_id = ${areaId}
                and extract(year from i.data) = ${ano})
     order by e.id desc
     limit 1`;
  return r[0] ?? null;
}

export async function areas() {
  return sql`
    select a.id, a.nome, p.nome as planta
      from area a
      join planta p on p.id = a.planta_id
     where a.ativo
     order by p.nome, a.nome`;
}

// Os indicadores do topo somam a mesma série que alimenta o gráfico, então
// não existe consulta separada de totais: KPI e tabela nunca discordam, e o
// número acompanha o nível do drill-down sem mais uma ida ao banco.
//
// recursoId null = a área toda. O driver Neon só aceita tagged template, então
// o filtro opcional vira uma condição que se anula sozinha em vez de SQL
// montado em pedaços.

// Série mensal para o gráfico. recursoId null = a área toda.
export async function porMes(execucaoId, areaId, ano, recursoId = null) {
  return sql`
    with inst as (
      select extract(month from data)::int as mes, sum(min_instalada) as m
        from capacidade_instalada_dia
       where execucao_id = ${execucaoId} and area_id = ${areaId}
         and extract(year from data) = ${ano}
         and (${recursoId}::int is null or recurso_id = ${recursoId}::int)
       group by 1),
    fato as (
      select extract(month from data)::int as mes,
             sum(min_planejada) as p, sum(min_disponivel) as d
        from capacidade_fato
       where execucao_id = ${execucaoId} and area_id = ${areaId}
         and extract(year from data) = ${ano}
         and (${recursoId}::int is null or recurso_id = ${recursoId}::int)
       group by 1)
    select coalesce(inst.mes, fato.mes)      as mes,
           coalesce(inst.m, 0)::bigint       as instalada,
           coalesce(fato.p, 0)::bigint       as planejada,
           coalesce(fato.d, 0)::bigint       as disponivel
      from inst full join fato on fato.mes = inst.mes
     order by 1`;
}

// Segundo nível do drill-down: os dias de um mês.
export async function porDia(execucaoId, areaId, ano, mes, recursoId = null) {
  return sql`
    with inst as (
      select extract(day from data)::int as dia, sum(min_instalada) as m
        from capacidade_instalada_dia
       where execucao_id = ${execucaoId} and area_id = ${areaId}
         and extract(year from data) = ${ano}
         and extract(month from data) = ${mes}
         and (${recursoId}::int is null or recurso_id = ${recursoId}::int)
       group by 1),
    fato as (
      select extract(day from data)::int as dia,
             sum(min_planejada) as p, sum(min_disponivel) as d
        from capacidade_fato
       where execucao_id = ${execucaoId} and area_id = ${areaId}
         and extract(year from data) = ${ano}
         and extract(month from data) = ${mes}
         and (${recursoId}::int is null or recurso_id = ${recursoId}::int)
       group by 1)
    select coalesce(inst.dia, fato.dia)      as dia,
           coalesce(inst.m, 0)::bigint       as instalada,
           coalesce(fato.p, 0)::bigint       as planejada,
           coalesce(fato.d, 0)::bigint       as disponivel
      from inst full join fato on fato.dia = inst.dia
     order by 1`;
}

/**
 * Terceiro nível: os turnos de um dia.
 *
 * Sem instalada — ela é grão dia (capacidade_instalada_dia), não grão turno.
 * Repetir o teto do dia em cada barra de turno era o bug do Qlik antigo, que
 * inflava o total. O teto vem separado, em tetoDoDia(), para ser mostrado uma
 * vez só ao lado do gráfico.
 */
export async function porTurnoDoDia(execucaoId, areaId, data, recursoId = null) {
  return sql`
    select t.codigo,
           t.nome,
           sum(f.min_planejada)::bigint  as planejada,
           sum(f.min_disponivel)::bigint as disponivel
      from capacidade_fato f
      join turno t on t.id = f.turno_id
     where f.execucao_id = ${execucaoId}
       and f.area_id     = ${areaId}
       and f.data        = ${data}::date
       and (${recursoId}::int is null or f.recurso_id = ${recursoId}::int)
     group by t.codigo, t.nome
     order by t.codigo`;
}

export async function tetoDoDia(execucaoId, areaId, data, recursoId = null) {
  const r = await sql`
    select coalesce(sum(min_instalada), 0)::bigint as instalada
      from capacidade_instalada_dia
     where execucao_id = ${execucaoId}
       and area_id     = ${areaId}
       and data        = ${data}::date
       and (${recursoId}::int is null or recurso_id = ${recursoId}::int)`;
  return Number(r[0]?.instalada ?? 0);
}

// Uma linha por recurso
export async function porRecurso(execucaoId, areaId, ano) {
  return sql`
    select r.id,
           r.codigo,
           r.nome,
           cal.codigo                              as calendario,
           coalesce(i.m, 0)::bigint                as instalada,
           coalesce(f.p, 0)::bigint                as planejada,
           coalesce(f.d, 0)::bigint                as disponivel,
           case when coalesce(i.m, 0) = 0 then null
                else round(coalesce(f.p, 0) * 100.0 / i.m, 1) end as pct_teto
      from recurso r
      left join recurso_calendario rc
             on rc.recurso_id = r.id
            and rc.vigencia @> make_date(${ano}, 12, 31)
      left join calendario cal on cal.id = rc.calendario_id
      left join lateral (
            select sum(min_instalada) as m
              from capacidade_instalada_dia
             where recurso_id = r.id and execucao_id = ${execucaoId}
               and extract(year from data) = ${ano}) i on true
      left join lateral (
            select sum(min_planejada) as p, sum(min_disponivel) as d
              from capacidade_fato
             where recurso_id = r.id and execucao_id = ${execucaoId}
               and extract(year from data) = ${ano}) f on true
     where r.area_id = ${areaId}
     order by r.nome`;
}

// Dispara o motor de cálculo para uma área e um ano.
// Devolve o id da nova rodada. A anterior continua no banco.
export async function recalcular(areaId, ano) {
  const r = await sql`
    select fn_calcular_capacidade(
      (select id from cenario where baseline limit 1),
      make_date(${ano}, 1, 1),
      make_date(${ano}, 12, 31),
      ${areaId}
    ) as id`;
  return r[0].id;
}
