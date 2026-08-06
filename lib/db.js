import { neon } from '@neondatabase/serverless';
import { ordenarComoNaTela } from './ordem-servidor';

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
//
// A origem entra pela mesma razão: META e SIMULADO são rodadas distintas, e
// misturá-las mostraria o número de um cenário sob o rótulo do outro.
export async function ultimaExecucao(areaId, ano, origem = 'META') {
  const r = await sql`
    select e.id, e.periodo_inicio, e.periodo_fim, e.concluido_em, e.origem,
           c.nome as cenario
      from calculo_execucao e
      join cenario c on c.id = e.cenario_id
     where e.status = 'OK'
       and e.origem = ${origem}
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
  const linhas = await sql`
    select a.id, a.codigo, a.nome, p.nome as planta,
           (select count(*) from recurso r where r.area_id = a.id) as recursos
      from area a
      join planta p on p.id = a.planta_id
     where a.ativo
     order by p.nome, a.nome`;
  return ordenarComoNaTela(linhas, 'area');
}

// Os indicadores do topo somam a mesma série que alimenta o gráfico, então
// não existe consulta separada de totais: KPI e tabela nunca discordam, e o
// número acompanha o nível do drill-down sem mais uma ida ao banco.
//
// `recursos` é uma lista de ids em texto separado por vírgula, ou null para a
// área toda. Texto e não array porque o driver Neon só aceita tagged template,
// e string_to_array resolve do lado do banco sem SQL montado em pedaços.
//
// A lista sai da página, que já filtrou por sub-área e tipo em cima do
// porRecurso() — assim a regra do filtro mora num lugar só e a tabela nunca
// mostra recurso que não entrou na conta.

// Série mensal para o gráfico. recursoId null = a área toda.
export async function porMes(execucaoId, areaId, ano, recursos = null) {
  return sql`
    with inst as (
      select extract(month from data)::int as mes, sum(min_instalada) as m
        from capacidade_instalada_dia
       where execucao_id = ${execucaoId} and area_id = ${areaId}
         and extract(year from data) = ${ano}
         and (${recursos}::text is null
              or recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       group by 1),
    fato as (
      select extract(month from data)::int as mes,
             sum(min_planejada) as p, sum(min_disponivel) as d
        from capacidade_fato
       where execucao_id = ${execucaoId} and area_id = ${areaId}
         and extract(year from data) = ${ano}
         and (${recursos}::text is null
              or recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       group by 1)
    select coalesce(inst.mes, fato.mes)      as mes,
           coalesce(inst.m, 0)::numeric      as instalada,
           coalesce(fato.p, 0)::numeric      as planejada,
           coalesce(fato.d, 0)::numeric      as disponivel
      from inst full join fato on fato.mes = inst.mes
     order by 1`;
}

// Segundo nível do drill-down: os dias de um mês.
export async function porDia(execucaoId, areaId, ano, mes, recursos = null) {
  return sql`
    with inst as (
      select extract(day from data)::int as dia, sum(min_instalada) as m
        from capacidade_instalada_dia
       where execucao_id = ${execucaoId} and area_id = ${areaId}
         and extract(year from data) = ${ano}
         and extract(month from data) = ${mes}
         and (${recursos}::text is null
              or recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       group by 1),
    fato as (
      select extract(day from data)::int as dia,
             sum(min_planejada) as p, sum(min_disponivel) as d
        from capacidade_fato
       where execucao_id = ${execucaoId} and area_id = ${areaId}
         and extract(year from data) = ${ano}
         and extract(month from data) = ${mes}
         and (${recursos}::text is null
              or recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       group by 1)
    select coalesce(inst.dia, fato.dia)      as dia,
           coalesce(inst.m, 0)::numeric      as instalada,
           coalesce(fato.p, 0)::numeric      as planejada,
           coalesce(fato.d, 0)::numeric      as disponivel
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
export async function porTurnoDoDia(execucaoId, areaId, data, recursos = null) {
  return sql`
    select t.codigo,
           t.nome,
           sum(f.min_planejada)::numeric  as planejada,
           sum(f.min_disponivel)::numeric as disponivel
      from capacidade_fato f
      join turno t on t.id = f.turno_id
     where f.execucao_id = ${execucaoId}
       and f.area_id     = ${areaId}
       and f.data        = ${data}::date
       and (${recursos}::text is null
            or f.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
     group by t.codigo, t.nome
     order by t.codigo`;
}

export async function tetoDoDia(execucaoId, areaId, data, recursos = null) {
  const r = await sql`
    select coalesce(sum(min_instalada), 0)::numeric as instalada
      from capacidade_instalada_dia
     where execucao_id = ${execucaoId}
       and area_id     = ${areaId}
       and data        = ${data}::date
       and (${recursos}::text is null
              or recurso_id = any(string_to_array(${recursos}, ',')::int[]))`;
  return Number(r[0]?.instalada ?? 0);
}

/**
 * O passo a passo do cálculo de um recurso num dia, turno a turno.
 *
 * Responde "por que esse recurso deu X h?" sem reconstruir o cadastro: cada
 * linha diz de quanto para quanto foi, em que etapa e por quê. Só existe
 * porque o motor grava isso na hora de calcular — reconstruir depois seria
 * um segundo lugar calculando a mesma coisa, livre para divergir.
 */
export async function memoriaDoDia(execucaoId, recursoId, data) {
  return sql`
    select m.turno_id,
           t.nome as turno,
           m.ordem,
           m.etapa,
           m.minutos_antes::numeric  as antes,
           m.minutos_delta::numeric  as delta,
           m.minutos_depois::numeric as depois,
           m.origem_tabela,
           m.descricao
      from capacidade_memoria m
      join turno t on t.id = m.turno_id
     where m.execucao_id = ${execucaoId}
       and m.recurso_id  = ${Number(recursoId)}
       and m.data        = ${data}::date
     order by t.codigo, m.ordem`;
}

// Uma linha por recurso
export async function porRecurso(execucaoId, areaId, ano) {
  return sql`
    select r.id,
           r.codigo,
           r.nome,
           r.tipo_recurso,
           coalesce(r.sub_area, '')                as sub_area,
           cal.codigo                              as calendario,
           coalesce(i.m, 0)::numeric               as instalada,
           coalesce(f.p, 0)::numeric               as planejada,
           coalesce(f.d, 0)::numeric               as disponivel,
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

/**
 * Os anos que já tiveram rodada, para o seletor não perder o passado.
 *
 * Sai de calculo_execucao e não das tabelas de resultado: aquela tem uma linha
 * por rodada, estas têm milhares por dia calculado. O distinct fica barato.
 */
export async function anosComRodada() {
  const r = await sql`
    select distinct extract(year from periodo_inicio)::int as ano
      from calculo_execucao
     where status = 'OK'
     order by 1`;
  return r.map((x) => Number(x.ano));
}

// Dispara o motor para uma área, um ano e uma origem de OEE.
// Devolve o id da nova rodada. As anteriores continuam no banco — é assim que
// se compara META com SIMULADO.
//
// Devolve também quantas linhas a rodada gerou. Rodada vazia é um estado
// legítimo — área sem recurso, recurso sem turno marcado — e antes ela era
// indistinguível de "nunca foi calculado": a tela mandava clicar em Recalcular
// justamente depois de ter clicado. Com a contagem, dá para dizer o que houve.
export async function recalcular(areaId, ano, origem = 'META') {
  const r = await sql`
    select fn_calcular_capacidade(
      (select id from cenario where baseline limit 1),
      make_date(${ano}, 1, 1),
      make_date(${ano}, 12, 31),
      ${areaId},
      ${origem}
    ) as id`;
  const id = r[0].id;

  const c = await sql`
    select (select count(*) from capacidade_instalada_dia where execucao_id = ${id})
             as instalada,
           (select count(*) from capacidade_fato where execucao_id = ${id})
             as fato`;

  return {
    id,
    instalada: Number(c[0].instalada),
    fato: Number(c[0].fato),
  };
}
