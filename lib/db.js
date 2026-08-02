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

// Última rodada de cálculo. Cada execução do motor gera uma nova;
// a tela sempre mostra a mais recente que terminou bem.
export async function ultimaExecucao() {
  const r = await sql`
    select e.id, e.periodo_inicio, e.periodo_fim, e.concluido_em, c.nome as cenario
      from calculo_execucao e
      join cenario c on c.id = e.cenario_id
     where e.status = 'OK'
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

// Totais do período — instalada vem da tabela de dia, as outras da de turno.
export async function totais(execucaoId, areaId, ano) {
  const r = await sql`
    select
      (select coalesce(sum(min_instalada), 0)
         from capacidade_instalada_dia
        where execucao_id = ${execucaoId}
          and area_id = ${areaId}
          and extract(year from data) = ${ano})                as min_instalada,
      (select coalesce(sum(min_planejada), 0)
         from capacidade_fato
        where execucao_id = ${execucaoId}
          and area_id = ${areaId}
          and extract(year from data) = ${ano})                as min_planejada,
      (select coalesce(sum(min_disponivel), 0)
         from capacidade_fato
        where execucao_id = ${execucaoId}
          and area_id = ${areaId}
          and extract(year from data) = ${ano})                as min_disponivel`;
  return r[0];
}

// Série mensal para o gráfico
export async function porMes(execucaoId, areaId, ano) {
  return sql`
    with inst as (
      select extract(month from data)::int as mes, sum(min_instalada) as m
        from capacidade_instalada_dia
       where execucao_id = ${execucaoId} and area_id = ${areaId}
         and extract(year from data) = ${ano}
       group by 1),
    fato as (
      select extract(month from data)::int as mes,
             sum(min_planejada) as p, sum(min_disponivel) as d
        from capacidade_fato
       where execucao_id = ${execucaoId} and area_id = ${areaId}
         and extract(year from data) = ${ano}
       group by 1)
    select coalesce(inst.mes, fato.mes)          as mes,
           round(coalesce(inst.m, 0) / 60.0)     as instalada,
           round(coalesce(fato.p, 0) / 60.0)     as planejada,
           round(coalesce(fato.d, 0) / 60.0)     as disponivel
      from inst full join fato on fato.mes = inst.mes
     order by 1`;
}

// Uma linha por recurso
export async function porRecurso(execucaoId, areaId, ano) {
  return sql`
    select r.codigo,
           r.nome,
           cal.codigo                              as calendario,
           round(coalesce(i.m, 0) / 60.0)          as instalada,
           round(coalesce(f.p, 0) / 60.0)          as planejada,
           round(coalesce(f.d, 0) / 60.0)          as disponivel,
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
