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

// A CONVERSÃO PARA UNIDADE FÍSICA
//
// Cada consulta de série multiplica os minutos pelo índice do CT daquele mês —
// `mv_demanda_indice`, que já resolve de onde o índice vem: do próprio
// CT, de um CT irmão ou da média do CC. Ver 21_demanda_ct_origem.sql. A multiplicação
// acontece ANTES da soma, por recurso e por mês, porque CTs diferentes têm
// índices diferentes: converter o total da área de uma vez usaria um índice
// médio que não é de ninguém.
//
// O vínculo com o CT sai do `cc-ct` da própria máquina física. Recurso cujo CT
// não está na carga converte para zero — o painel avisa quando isso acontece,
// porque um zero desses baixa o total sem dizer por quê.
//
// `cargaId` nulo faz o left join não casar nunca e todas as colunas físicas
// saírem zeradas, que é o certo quando não há demanda importada.

// O RATEIO POR ATRIBUTO
//
// A capacidade é do RECURSO; o atributo do DE/PARA é da LINHA de demanda. Um CT
// faz várias linhas de produto no mesmo mês, então filtrar por um rótulo não
// pode ser "somar os recursos que fazem aquilo" — isso contaria o CT inteiro,
// inclusive o que ele faz de outra coisa, e a soma dos rótulos daria mais que o
// total.
//
// O que entra é a FATIA: quanto do tempo daquele CT naquele mês pertence ao
// rótulo. As fatias de um CT somam 1, e é essa propriedade que faz a soma dos
// rótulos fechar com o total.
//
// Ela chega pronta, calculada em JavaScript por `fatiasDoRotulo` — as regras do
// DE/PARA são JavaScript, e reimplementá-las em SQL seria um segundo lugar
// decidindo a mesma coisa, livre para divergir. Vem em arrays paralelos porque
// o driver Neon só aceita tagged template.
//
// SEM FILTRO as arrays chegam vazias: o left join não casa, `coalesce(fa.fatia,
// 1)` devolve 1 e nada muda. COM FILTRO, quem não tem fatia é excluído — CT sem
// nada daquele rótulo não tem por que aparecer.
//
// O índice de conversão vem do RÓTULO, não do CT: um CT que faz felpudo e liso
// no mesmo mês converte a taxas diferentes, e usar a média do CT numa fatia
// filtrada daria metro a mais ou a menos sem nada denunciar. Quando o rótulo não
// tem metro na base, cai no índice do CT.

const SEM_FATIA = {
  ativo: false, cts: [], meses: [], fatias: [], metros: [], qtds: [],
};

/** As fatias de `lib/regras.js` na forma que as consultas aceitam. */
export function arraysDeFatia(fatias, ativo = true) {
  if (!ativo) return SEM_FATIA;
  return {
    // Filtro pedido que não casou com nada continua ativo, e com zero linhas:
    // o painel tem que mostrar vazio, não mostrar tudo.
    ativo: true,
    cts:    (fatias ?? []).map((f) => f.ct),
    meses:  (fatias ?? []).map((f) => f.mes),
    fatias: (fatias ?? []).map((f) => f.fatia),
    metros: (fatias ?? []).map((f) => f.metros_por_min),
    qtds:   (fatias ?? []).map((f) => f.qtd_por_min),
  };
}

// Série mensal para o gráfico, dentro do intervalo pedido.
//
// O intervalo substituiu o par ano+mes: com ele dá para pedir março a junho,
// que antes não tinha caminho nenhum. Mês na ponta entra cortado de propósito
// — quem pediu de 15/03 quer a soma daquilo, não do março inteiro.
export async function porMes(execucaoId, areaId, de, ate, recursos = null,
                            cargaId = null, fa = SEM_FATIA) {
  return sql`
    with fa as (
      select * from unnest(${fa.cts}::text[], ${fa.meses}::date[],
                           ${fa.fatias}::numeric[], ${fa.metros}::numeric[],
                           ${fa.qtds}::numeric[])
        as t(ct, mes, fatia, metros_por_min, qtd_por_min)),
    inst as (
      select extract(month from c.data)::int as mes,
             sum(c.min_instalada * coalesce(fa.fatia, 1)) as m
        from capacidade_instalada_dia c
        join recurso r          on r.id = c.recurso_id
        join maquina_fisica mf  on mf.id = r.maquina_fisica_id
        left join fa on fa.ct  = mf.cc || '-' || mf.ct
                    and fa.mes = date_trunc('month', c.data)::date
       where c.execucao_id = ${execucaoId} and c.area_id = ${areaId}
         and c.data between ${de}::date and ${ate}::date
         and (${recursos}::text is null
              or c.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
         and (${fa.ativo}::boolean is not true or fa.ct is not null)
       group by 1),
    fato as (
      select extract(month from f.data)::int as mes,
             sum(f.min_planejada  * coalesce(fa.fatia, 1)) as p,
             sum(f.min_disponivel * coalesce(fa.fatia, 1)) as d,
             sum(f.min_planejada  * coalesce(fa.fatia, 1)
                 * coalesce(fa.metros_por_min, i.metros_por_min, 0)) as pm,
             sum(f.min_disponivel * coalesce(fa.fatia, 1)
                 * coalesce(fa.metros_por_min, i.metros_por_min, 0)) as dm,
             sum(f.min_planejada  * coalesce(fa.fatia, 1)
                 * coalesce(fa.qtd_por_min, i.qtd_por_min, 0))       as pu,
             sum(f.min_disponivel * coalesce(fa.fatia, 1)
                 * coalesce(fa.qtd_por_min, i.qtd_por_min, 0))       as du
        from capacidade_fato f
        join recurso r          on r.id = f.recurso_id
        join maquina_fisica mf  on mf.id = r.maquina_fisica_id
        left join mv_demanda_indice i
               on i.carga_id = ${cargaId}::int
              and i.ct       = mf.cc || '-' || mf.ct
              and i.mes      = date_trunc('month', f.data)::date
        left join fa on fa.ct  = mf.cc || '-' || mf.ct
                    and fa.mes = date_trunc('month', f.data)::date
       where f.execucao_id = ${execucaoId} and f.area_id = ${areaId}
         and f.data between ${de}::date and ${ate}::date
         and (${recursos}::text is null
              or f.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
         and (${fa.ativo}::boolean is not true or fa.ct is not null)
       group by 1)
    select coalesce(inst.mes, fato.mes)      as mes,
           coalesce(inst.m, 0)::numeric      as instalada,
           coalesce(fato.p, 0)::numeric      as planejada,
           coalesce(fato.d, 0)::numeric      as disponivel,
           coalesce(fato.pm, 0)::numeric     as planejada_m,
           coalesce(fato.dm, 0)::numeric     as disponivel_m,
           coalesce(fato.pu, 0)::numeric     as planejada_u,
           coalesce(fato.du, 0)::numeric     as disponivel_u
      from inst full join fato on fato.mes = inst.mes
     order by 1`;
}

// Segundo nível: os dias do intervalo. Devolve a data inteira, e não o número
// do dia — a página casa por data e não precisa saber de que mês ela é.
export async function porDia(execucaoId, areaId, de, ate, recursos = null,
                            cargaId = null, fa = SEM_FATIA) {
  return sql`
    with fa as (
      select * from unnest(${fa.cts}::text[], ${fa.meses}::date[],
                           ${fa.fatias}::numeric[], ${fa.metros}::numeric[],
                           ${fa.qtds}::numeric[])
        as t(ct, mes, fatia, metros_por_min, qtd_por_min)),
    inst as (
      select c.data, sum(c.min_instalada * coalesce(fa.fatia, 1)) as m
        from capacidade_instalada_dia c
        join recurso r          on r.id = c.recurso_id
        join maquina_fisica mf  on mf.id = r.maquina_fisica_id
        left join fa on fa.ct  = mf.cc || '-' || mf.ct
                    and fa.mes = date_trunc('month', c.data)::date
       where c.execucao_id = ${execucaoId} and c.area_id = ${areaId}
         and c.data between ${de}::date and ${ate}::date
         and (${recursos}::text is null
              or c.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
         and (${fa.ativo}::boolean is not true or fa.ct is not null)
       group by 1),
    fato as (
      select f.data,
             sum(f.min_planejada  * coalesce(fa.fatia, 1)) as p,
             sum(f.min_disponivel * coalesce(fa.fatia, 1)) as d,
             sum(f.min_planejada  * coalesce(fa.fatia, 1)
                 * coalesce(fa.metros_por_min, i.metros_por_min, 0)) as pm,
             sum(f.min_disponivel * coalesce(fa.fatia, 1)
                 * coalesce(fa.metros_por_min, i.metros_por_min, 0)) as dm,
             sum(f.min_planejada  * coalesce(fa.fatia, 1)
                 * coalesce(fa.qtd_por_min, i.qtd_por_min, 0))       as pu,
             sum(f.min_disponivel * coalesce(fa.fatia, 1)
                 * coalesce(fa.qtd_por_min, i.qtd_por_min, 0))       as du
        from capacidade_fato f
        join recurso r          on r.id = f.recurso_id
        join maquina_fisica mf  on mf.id = r.maquina_fisica_id
        left join mv_demanda_indice i
               on i.carga_id = ${cargaId}::int
              and i.ct       = mf.cc || '-' || mf.ct
              and i.mes      = date_trunc('month', f.data)::date
        left join fa on fa.ct  = mf.cc || '-' || mf.ct
                    and fa.mes = date_trunc('month', f.data)::date
       where f.execucao_id = ${execucaoId} and f.area_id = ${areaId}
         and f.data between ${de}::date and ${ate}::date
         and (${recursos}::text is null
              or f.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
         and (${fa.ativo}::boolean is not true or fa.ct is not null)
       group by 1)
    select coalesce(inst.data, fato.data)::text as data,
           coalesce(inst.m, 0)::numeric         as instalada,
           coalesce(fato.p, 0)::numeric         as planejada,
           coalesce(fato.d, 0)::numeric         as disponivel,
           coalesce(fato.pm, 0)::numeric        as planejada_m,
           coalesce(fato.dm, 0)::numeric        as disponivel_m,
           coalesce(fato.pu, 0)::numeric        as planejada_u,
           coalesce(fato.du, 0)::numeric        as disponivel_u
      from inst full join fato on fato.data = inst.data
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
export async function porTurnoDoDia(execucaoId, areaId, data, recursos = null,
                                   cargaId = null, fa = SEM_FATIA) {
  return sql`
    with fa as (
      select * from unnest(${fa.cts}::text[], ${fa.meses}::date[],
                           ${fa.fatias}::numeric[], ${fa.metros}::numeric[],
                           ${fa.qtds}::numeric[])
        as t(ct, mes, fatia, metros_por_min, qtd_por_min))
    select t.codigo,
           t.nome,
           sum(f.min_planejada  * coalesce(fa.fatia, 1))::numeric as planejada,
           sum(f.min_disponivel * coalesce(fa.fatia, 1))::numeric as disponivel,
           sum(f.min_planejada  * coalesce(fa.fatia, 1)
               * coalesce(fa.metros_por_min, i.metros_por_min, 0))::numeric
             as planejada_m,
           sum(f.min_disponivel * coalesce(fa.fatia, 1)
               * coalesce(fa.metros_por_min, i.metros_por_min, 0))::numeric
             as disponivel_m,
           sum(f.min_planejada  * coalesce(fa.fatia, 1)
               * coalesce(fa.qtd_por_min, i.qtd_por_min, 0))::numeric
             as planejada_u,
           sum(f.min_disponivel * coalesce(fa.fatia, 1)
               * coalesce(fa.qtd_por_min, i.qtd_por_min, 0))::numeric
             as disponivel_u
      from capacidade_fato f
      join turno t on t.id = f.turno_id
      join recurso r         on r.id = f.recurso_id
      join maquina_fisica mf on mf.id = r.maquina_fisica_id
      left join mv_demanda_indice i
             on i.carga_id = ${cargaId}::int
            and i.ct       = mf.cc || '-' || mf.ct
            and i.mes      = date_trunc('month', f.data)::date
      left join fa on fa.ct  = mf.cc || '-' || mf.ct
                  and fa.mes = date_trunc('month', f.data)::date
     where f.execucao_id = ${execucaoId}
       and f.area_id     = ${areaId}
       and f.data        = ${data}::date
       and (${recursos}::text is null
            or f.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       and (${fa.ativo}::boolean is not true or fa.ct is not null)
     group by t.codigo, t.nome
     order by t.codigo`;
}

export async function tetoDoDia(execucaoId, areaId, data, recursos = null,
                                fa = SEM_FATIA) {
  const r = await sql`
    with fa as (
      select * from unnest(${fa.cts}::text[], ${fa.meses}::date[],
                           ${fa.fatias}::numeric[])
        as t(ct, mes, fatia))
    select coalesce(sum(c.min_instalada * coalesce(fa.fatia, 1)), 0)::numeric
             as instalada
      from capacidade_instalada_dia c
      join recurso r         on r.id = c.recurso_id
      join maquina_fisica mf on mf.id = r.maquina_fisica_id
      left join fa on fa.ct  = mf.cc || '-' || mf.ct
                  and fa.mes = date_trunc('month', c.data)::date
     where c.execucao_id = ${execucaoId}
       and c.area_id     = ${areaId}
       and c.data        = ${data}::date
       and (${recursos}::text is null
              or c.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       and (${fa.ativo}::boolean is not true or fa.ct is not null)`;
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

// Uma linha por recurso, somando só o intervalo mostrado — senão a tabela de
// baixo discordaria dos indicadores e do gráfico logo acima.
export async function porRecurso(execucaoId, areaId, de, ate, cargaId = null,
                                fa = SEM_FATIA) {
  return sql`
    with fa as (
      select * from unnest(${fa.cts}::text[], ${fa.meses}::date[],
                           ${fa.fatias}::numeric[], ${fa.metros}::numeric[],
                           ${fa.qtds}::numeric[])
        as t(ct, mes, fatia, metros_por_min, qtd_por_min))
    select r.id,
           r.codigo,
           r.nome,
           r.tipo_recurso,
           coalesce(r.sub_area, '')                as sub_area,
           cal.codigo                              as calendario,
           coalesce(i.m, 0)::numeric               as instalada,
           coalesce(f.p, 0)::numeric               as planejada,
           coalesce(f.d, 0)::numeric               as disponivel,
           coalesce(f.pm, 0)::numeric              as planejada_m,
           coalesce(f.dm, 0)::numeric              as disponivel_m,
           coalesce(f.pu, 0)::numeric              as planejada_u,
           coalesce(f.du, 0)::numeric              as disponivel_u,
           coalesce(f.tem_indice, false)           as tem_demanda,
           case when coalesce(i.m, 0) = 0 then null
                else round(coalesce(f.p, 0) * 100.0 / i.m, 1) end as pct_teto
      from recurso r
      join maquina_fisica mf on mf.id = r.maquina_fisica_id
      left join recurso_calendario rc
             on rc.recurso_id = r.id
            and rc.vigencia @> ${ate}::date
      left join calendario cal on cal.id = rc.calendario_id
      left join lateral (
            select sum(c.min_instalada * coalesce(fa.fatia, 1)) as m
              from capacidade_instalada_dia c
              left join fa on fa.ct  = mf.cc || '-' || mf.ct
                          and fa.mes = date_trunc('month', c.data)::date
             where c.recurso_id = r.id and c.execucao_id = ${execucaoId}
               and c.data between ${de}::date and ${ate}::date) i on true
      left join lateral (
            -- Alias idx, e nao i: a lateral da instalada ja usa i logo acima,
            -- e dois aliases iguais em escopos aninhados sao pedido de
            -- ambiguidade na primeira vez que alguem mexer aqui.
            select sum(cf.min_planejada  * coalesce(fr.fatia, 1)) as p,
                   sum(cf.min_disponivel * coalesce(fr.fatia, 1)) as d,
                   sum(cf.min_planejada  * coalesce(fr.fatia, 1)
                       * coalesce(fr.metros_por_min, idx.metros_por_min, 0)) as pm,
                   sum(cf.min_disponivel * coalesce(fr.fatia, 1)
                       * coalesce(fr.metros_por_min, idx.metros_por_min, 0)) as dm,
                   sum(cf.min_planejada  * coalesce(fr.fatia, 1)
                       * coalesce(fr.qtd_por_min, idx.qtd_por_min, 0))       as pu,
                   sum(cf.min_disponivel * coalesce(fr.fatia, 1)
                       * coalesce(fr.qtd_por_min, idx.qtd_por_min, 0))       as du,
                   bool_or(idx.ct is not null)                       as tem_indice
              from capacidade_fato cf
              left join mv_demanda_indice idx
                     on idx.carga_id = ${cargaId}::int
                    and idx.ct       = mf.cc || '-' || mf.ct
                    and idx.mes      = date_trunc('month', cf.data)::date
              left join fa fr
                     on fr.ct  = mf.cc || '-' || mf.ct
                    and fr.mes = date_trunc('month', cf.data)::date
             where cf.recurso_id = r.id and cf.execucao_id = ${execucaoId}
               and cf.data between ${de}::date and ${ate}::date) f on true
     where r.area_id = ${areaId}
       -- Com filtro por rotulo, recurso cujo CT nao tem nada daquele rotulo sai
       -- da tabela inteiro. Deixar a linha zerada seria pior: parece recurso
       -- parado, e e recurso que nao faz aquilo.
       and (${fa.ativo}::boolean is not true
            or exists (select 1 from fa where fa.ct = mf.cc || '-' || mf.ct))
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

// -----------------------------------------------------------------------------
// A EXTRAÇÃO PARA O AP
//
// O AP recebe a capacidade no formato que a base de demanda usa: CT no formato
// CC-CT e período AAAA.MM — o período vem assim porque a base de lá não pode
// ser mexida, então quem se adapta é a extração.
//
// A rodada é por área, ano e origem, e a extração cruza várias de uma vez:
// cada par área×ano entra com a ÚLTIMA rodada OK do OEE META — a mesma regra
// do painel, aplicada em lote. Misturar rodadas de idades diferentes é
// inevitável aqui e não é defeito: cada área responde pela sua última palavra.
// -----------------------------------------------------------------------------

/**
 * Todos os recursos de todas as plantas, com o que os filtros da extração
 * precisam. A tela filtra em memória e manda só os ids — a mesma divisão do
 * painel: a regra do filtro mora num lugar só.
 */
export async function recursosParaExtracao() {
  return sql`
    select r.id, r.codigo, r.nome, coalesce(r.sub_area, '') as sub_area,
           mf.cc, mf.ct, mf.patrimonio,
           p.nome as planta, a.nome as area
      from recurso r
      join maquina_fisica mf on mf.id = r.maquina_fisica_id
      join area a  on a.id = r.area_id
      join planta p on p.id = a.planta_id
     order by p.nome, a.nome, r.nome`;
}

/**
 * CT × período × minutos, condensado por mês.
 *
 * `medida` escolhe o que soma: DISPONIVEL (planejada × OEE, o que o AP
 * normalmente quer), PLANEJADA ou INSTALADA. `recursos` é a lista de ids em
 * texto, ou null para tudo — o padrão das consultas do painel.
 */
export async function extracaoAp({ medida = 'DISPONIVEL', de, ate,
                                   recursos = null }) {
  if (medida === 'INSTALADA') {
    return sql`
      with rodada as (
        select i.area_id, extract(year from i.data)::int as ano,
               max(e.id) as execucao_id
          from calculo_execucao e
          join capacidade_instalada_dia i on i.execucao_id = e.id
         where e.status = 'OK' and e.origem = 'META'
         group by 1, 2
      )
      select mf.cc || '-' || mf.ct           as ct,
             to_char(c.data, 'YYYY.MM')      as periodo,
             sum(c.min_instalada)::float8    as minutos
        from capacidade_instalada_dia c
        join rodada x on x.execucao_id = c.execucao_id
                     and x.area_id = c.area_id
                     and x.ano = extract(year from c.data)::int
        join recurso r         on r.id = c.recurso_id
        join maquina_fisica mf on mf.id = r.maquina_fisica_id
       where c.data between ${de}::date and ${ate}::date
         and (${recursos}::text is null
              or c.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       group by 1, 2
       order by 1, 2`;
  }

  const planejada = medida === 'PLANEJADA';
  return sql`
    with rodada as (
      select i.area_id, extract(year from i.data)::int as ano,
             max(e.id) as execucao_id
        from calculo_execucao e
        join capacidade_instalada_dia i on i.execucao_id = e.id
       where e.status = 'OK' and e.origem = 'META'
       group by 1, 2
    )
    select mf.cc || '-' || mf.ct      as ct,
           to_char(f.data, 'YYYY.MM') as periodo,
           sum(case when ${planejada}::boolean then f.min_planejada
                    else f.min_disponivel end)::float8 as minutos
      from capacidade_fato f
      join rodada x on x.execucao_id = f.execucao_id
                   and x.area_id = f.area_id
                   and x.ano = extract(year from f.data)::int
      join recurso r         on r.id = f.recurso_id
      join maquina_fisica mf on mf.id = r.maquina_fisica_id
     where f.data between ${de}::date and ${ate}::date
       and (${recursos}::text is null
            or f.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
     group by 1, 2
     order by 1, 2`;
}
