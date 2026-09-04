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
/**
 * A rodada que vale para esta área, ano e origem.
 *
 * Desde a migração 26 existe UMA por combinação — a nova substitui a anterior —
 * e a área mora na própria linha da rodada. Antes isto exigia um `exists` na
 * maior tabela do banco com `extract(year from data)`, que não usa índice: uma
 * varredura a cada abertura do painel, crescendo com o histórico.
 */
export async function ultimaExecucao(areaId, ano, origem = 'META') {
  const r = await sql`
    select e.id, e.periodo_inicio, e.periodo_fim, e.concluido_em, e.origem,
           c.nome as cenario
      from calculo_execucao e
      join cenario c on c.id = e.cenario_id
     where e.status = 'OK'
       and e.origem  = ${origem}
       and e.area_id = ${areaId}
       and extract(year from e.periodo_inicio) = ${ano}
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

/**
 * As fatias de `lib/regras.js` na forma que as consultas aceitam.
 *
 * `ativo` decide só uma coisa: se quem não tem fatia SAI da conta. Com filtro
 * por rótulo, sai — CT que não faz aquilo não tem por que aparecer. Sem filtro,
 * as mesmas arrays servem para outra coisa: entregar o índice que veio do mix
 * ajustado a quem tem, sem excluir ninguém. Os dois usos compartilham o
 * caminho porque é o mesmo left join; o que muda é o where.
 */
export function arraysDeFatia(fatias, ativo = true) {
  return {
    // Filtro pedido que não casou com nada continua ativo, e com zero linhas:
    // o painel tem que mostrar vazio, não mostrar tudo.
    ativo: Boolean(ativo),
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
           -- A identidade na controladoria, que a tabela do painel mostra e
           -- filtra. Vem da maquina fisica, como em todo o resto do projeto:
           -- nao existe de-para de CT em lugar nenhum.
           --
           -- O CT sai COMPLETO, no formato CC-CT. Sozinha, a segunda metade
           -- nao identifica nada: o 001 do CC 278 e outro centro que o 001 do
           -- 515, e uma coluna que mostra so "001" nao diz de qual. E o formato
           -- CC-CT ja e o que a demanda, a extracao e o AP usam.
           coalesce(mf.cc, '')                     as cc,
           mf.cc || '-' || mf.ct                   as ct,
           pl.nome                                 as planta,
           ar.nome                                 as area,
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
      join area ar   on ar.id = r.area_id
      join planta pl on pl.id = ar.planta_id
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
                   -- O indice pode vir da carga OU do mix ajustado a mao; as
                   -- duas contam, senao a coluna diria "sem demanda" para um
                   -- recurso que tem numero para mostrar.
                   bool_or(idx.ct is not null or fr.ct is not null)   as tem_indice
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
/**
 * Recalcula uma área e um ano, SUBSTITUINDO a rodada anterior.
 *
 * O sistema mostra a capacidade atual; rodada velha não é consultada por
 * ninguém e só ocupava espaço — e com o botão refazendo tudo de uma vez, cada
 * pressão criava áreas × anos × 2 conjuntos completos. Ver a migração 26.
 *
 * A troca acontece DEPOIS de a nova rodada ficar pronta, e as duas instruções
 * vão numa transação: se o cálculo falhar, a anterior continua no ar — o
 * painel nunca fica sem número por causa de uma rodada que não terminou.
 */
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

  // A função não conhece a coluna area_id (ela é da migração 26 e o motor é da
  // 14); carimbar aqui evita reescrever as 250 linhas do motor por um campo.
  await sql.transaction([
    sql`update calculo_execucao set area_id = ${areaId} where id = ${id}`,
    // Pelo ANO e não pela data exata: rodada antiga de período recortado é do
    // mesmo ano e também tem que sair, senão ficaria para sempre, nunca
    // substituída e nunca consultada.
    sql`delete from calculo_execucao
         where id <> ${id}
           and origem = ${origem}
           and area_id = ${areaId}
           and extract(year from periodo_inicio) = ${ano}`,
  ]);

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
// cada par área×ano entra com a rodada OK da origem escolhida (META ou
// SIMULADO) — a mesma regra do painel, aplicada em lote.
//
// A lista de rodadas sai só de `calculo_execucao`, que tem uma linha por
// combinação desde a migração 26. A primeira versão disto agrupava a tabela de
// fatos inteira para descobrir a rodada de cada área: uma varredura da segunda
// maior tabela do banco a cada extração. Misturar rodadas de idades diferentes é
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
           -- CT completo, no formato CC-CT: e o mesmo da extracao logo abaixo,
           -- e a segunda metade sozinha nao identifica centro nenhum.
           mf.cc, mf.cc || '-' || mf.ct as ct, mf.patrimonio,
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
 *
 * SAI TAMBÉM A CAPACIDADE POR RECURSO: os minutos divididos pela quantidade que
 * o AP conta naquele centro (tabela `recurso_ap`, migração 27). É como o outro
 * sistema raciocina — lá o centro é um posto, e a capacidade que ele espera é a
 * de um.
 *
 * Centro sem quantidade no AP sai com as duas colunas NULAS, e não zeradas: a
 * facção e o serviço externo não têm parque, e um zero ali seria lido como
 * "capacidade nenhuma" em vez de "esta conta não se aplica".
 */
export async function extracaoAp({ medida = 'DISPONIVEL', origem = 'META',
                                   de, ate, recursos = null }) {
  const og = origem === 'SIMULADO' ? 'SIMULADO' : 'META';
  if (medida === 'INSTALADA') {
    return sql`
      with rodada as (
        select distinct on (area_id, periodo_inicio) id as execucao_id
          from calculo_execucao
         where status = 'OK' and origem = ${og} and area_id is not null
         order by area_id, periodo_inicio, id desc
      )
      select mf.cc || '-' || mf.ct           as ct,
             to_char(c.data, 'YYYY.MM')      as periodo,
             sum(c.min_instalada)::float8    as minutos,
             nullif(max(ap.qtd), 0)          as qtd_ap,
             (sum(c.min_instalada) / nullif(max(ap.qtd), 0))::float8
               as minutos_por_recurso
        from capacidade_instalada_dia c
        join rodada x on x.execucao_id = c.execucao_id
        join recurso r         on r.id = c.recurso_id
        join maquina_fisica mf on mf.id = r.maquina_fisica_id
        left join recurso_ap ap on ap.ct = mf.cc || '-' || mf.ct
       where c.data between ${de}::date and ${ate}::date
         and (${recursos}::text is null
              or c.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       group by 1, 2
       order by 1, 2`;
  }

  const planejada = medida === 'PLANEJADA';
  return sql`
    with rodada as (
      select distinct on (area_id, periodo_inicio) id as execucao_id
        from calculo_execucao
       where status = 'OK' and origem = ${og} and area_id is not null
       order by area_id, periodo_inicio, id desc
    )
    select mf.cc || '-' || mf.ct      as ct,
           to_char(f.data, 'YYYY.MM') as periodo,
           sum(case when ${planejada}::boolean then f.min_planejada
                    else f.min_disponivel end)::float8 as minutos,
           nullif(max(ap.qtd), 0)     as qtd_ap,
           (sum(case when ${planejada}::boolean then f.min_planejada
                     else f.min_disponivel end)
            / nullif(max(ap.qtd), 0))::float8 as minutos_por_recurso
      from capacidade_fato f
      join rodada x on x.execucao_id = f.execucao_id
      join recurso r         on r.id = f.recurso_id
      join maquina_fisica mf on mf.id = r.maquina_fisica_id
      left join recurso_ap ap on ap.ct = mf.cc || '-' || mf.ct
     where f.data between ${de}::date and ${ate}::date
       and (${recursos}::text is null
            or f.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
     group by 1, 2
     order by 1, 2`;
}

// -----------------------------------------------------------------------------
// OCUPAÇÃO: A CAPACIDADE CONTRA A DEMANDA
//
// A capacidade é do RECURSO e a demanda é do CENTRO DE TRABALHO. Dois recursos
// no mesmo CT dividem uma demanda que não sabe deles — e não existe critério
// no dado para repartir. Por isso a comparação acontece no grão do CT: somar a
// capacidade dos recursos dele é uma conta que o dado sustenta; espalhar a
// demanda entre eles seria inventar um número.
//
// A demanda entra em MINUTO, como está na base: é tempo de roteiro já
// explodido para a quantidade do plano. Comparar minuto com minuto dispensa
// índice de conversão, e é por isso que este painel não tem unidade física.
// -----------------------------------------------------------------------------

/** Demanda em minutos, mês a mês, dos CTs da seleção. */
export async function demandaPorMesDaArea(cargaId, areaId, de, ate,
                                          recursos = null) {
  if (!cargaId) return [];
  return sql`
    with cts as (
      select distinct mf.cc || '-' || mf.ct as ct
        from recurso r
        join maquina_fisica mf on mf.id = r.maquina_fisica_id
       where r.area_id = ${areaId}
         and (${recursos}::text is null
              or r.id = any(string_to_array(${recursos}, ',')::int[]))
    )
    select extract(month from l.periodo_data)::int as mes,
           sum(l.duracao_min)::float8              as minutos
      from demanda_linha l
      join cts on cts.ct = l.ct
     where l.carga_id = ${Number(cargaId)}
       and l.periodo_data between ${de}::date and ${ate}::date
     group by 1
     order by 1`;
}

/** Demanda em minutos, dia a dia — o segundo nível do drill-down. */
export async function demandaPorDiaDaArea(cargaId, areaId, de, ate,
                                          recursos = null) {
  if (!cargaId) return [];
  return sql`
    with cts as (
      select distinct mf.cc || '-' || mf.ct as ct
        from recurso r
        join maquina_fisica mf on mf.id = r.maquina_fisica_id
       where r.area_id = ${areaId}
         and (${recursos}::text is null
              or r.id = any(string_to_array(${recursos}, ',')::int[]))
    )
    select l.periodo_data::text as mes_data,
           sum(l.duracao_min)::float8 as minutos
      from demanda_linha l
      join cts on cts.ct = l.ct
     where l.carga_id = ${Number(cargaId)}
       and l.periodo_data between ${de}::date and ${ate}::date
     group by 1
     order by 1`;
}

/**
 * Uma linha por centro de trabalho: a capacidade dos recursos dele contra a
 * demanda que o plano lhe deu.
 *
 * FULL JOIN de propósito. CT com demanda e sem capacidade é o caso que mais
 * importa — plano pedindo de uma máquina que não existe no cadastro — e um
 * inner join o esconderia justamente onde ele precisa aparecer.
 */
export async function ocupacaoPorCt(execucaoId, areaId, de, ate,
                                    recursos = null, cargaId = null) {
  return sql`
    with cap as (
      select mf.cc || '-' || mf.ct                as ct,
             min(mf.cc)                           as cc,
             string_agg(distinct r.nome, ', ')    as recursos,
             min(pl.nome)                         as planta,
             min(ar.nome)                         as area,
             sum(f.min_planejada)::float8         as planejada,
             sum(f.min_disponivel)::float8        as disponivel
        from capacidade_fato f
        join recurso r         on r.id = f.recurso_id
        join maquina_fisica mf on mf.id = r.maquina_fisica_id
        join area ar   on ar.id = r.area_id
        join planta pl on pl.id = ar.planta_id
       where f.execucao_id = ${execucaoId} and f.area_id = ${areaId}
         and f.data between ${de}::date and ${ate}::date
         and (${recursos}::text is null
              or f.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       group by 1
    ),
    inst as (
      select mf.cc || '-' || mf.ct         as ct,
             sum(c.min_instalada)::float8  as instalada
        from capacidade_instalada_dia c
        join recurso r         on r.id = c.recurso_id
        join maquina_fisica mf on mf.id = r.maquina_fisica_id
       where c.execucao_id = ${execucaoId} and c.area_id = ${areaId}
         and c.data between ${de}::date and ${ate}::date
         and (${recursos}::text is null
              or c.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       group by 1
    ),
    dem as (
      select l.ct, sum(l.duracao_min)::float8 as demanda
        from demanda_linha l
       where l.carga_id = ${cargaId}::int
         and l.periodo_data between ${de}::date and ${ate}::date
         and exists (
               select 1 from recurso r
                 join maquina_fisica mf on mf.id = r.maquina_fisica_id
                where r.area_id = ${areaId}
                  and mf.cc || '-' || mf.ct = l.ct
                  and (${recursos}::text is null
                       or r.id = any(string_to_array(${recursos}, ',')::int[])))
       group by 1
    )
    select coalesce(cap.ct, dem.ct)                as ct,
           coalesce(cap.cc, split_part(dem.ct, '-', 1)) as cc,
           coalesce(cap.recursos, '')              as recursos,
           coalesce(cap.planta, '')                as planta,
           coalesce(cap.area, '')                  as area,
           coalesce(inst.instalada, 0)             as instalada,
           coalesce(cap.planejada, 0)              as planejada,
           coalesce(cap.disponivel, 0)             as disponivel,
           coalesce(dem.demanda, 0)                as demanda
      from cap
      full join dem  on dem.ct = cap.ct
      left join inst on inst.ct = coalesce(cap.ct, dem.ct)
     order by 1`;
}

/**
 * A capacidade em MINUTOS por centro de trabalho e mês.
 *
 * É a matéria-prima da tabela por atributo: o rateio entre rótulos e a
 * conversão para metro acontecem em JavaScript, com o mesmo motor do resto —
 * refazer aquelas regras em SQL seria um segundo lugar decidindo a mesma coisa.
 *
 * Vem em minuto cru, sem índice nenhum aplicado, porque cada rótulo converte à
 * taxa dele e a multiplicação tem que acontecer DEPOIS do rateio.
 */
export async function capacidadePorCtMes(execucaoId, areaId, de, ate,
                                         recursos = null, campo = 'disponivel') {
  const instalada = campo === 'instalada';
  const planejada = campo === 'planejada';

  if (instalada) {
    return sql`
      select mf.cc || '-' || mf.ct                        as ct,
             date_trunc('month', c.data)::date::text      as mes,
             sum(c.min_instalada)::float8                 as minutos
        from capacidade_instalada_dia c
        join recurso r         on r.id = c.recurso_id
        join maquina_fisica mf on mf.id = r.maquina_fisica_id
       where c.execucao_id = ${execucaoId} and c.area_id = ${areaId}
         and c.data between ${de}::date and ${ate}::date
         and (${recursos}::text is null
              or c.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
       group by 1, 2`;
  }

  return sql`
    select mf.cc || '-' || mf.ct                    as ct,
           date_trunc('month', f.data)::date::text  as mes,
           sum(case when ${planejada}::boolean then f.min_planejada
                    else f.min_disponivel end)::float8 as minutos
      from capacidade_fato f
      join recurso r         on r.id = f.recurso_id
      join maquina_fisica mf on mf.id = r.maquina_fisica_id
     where f.execucao_id = ${execucaoId} and f.area_id = ${areaId}
       and f.data between ${de}::date and ${ate}::date
       and (${recursos}::text is null
            or f.recurso_id = any(string_to_array(${recursos}, ',')::int[]))
     group by 1, 2`;
}

// -----------------------------------------------------------------------------
// A EXTRAÇÃO DAS CONFIGURAÇÕES
//
// O que o documento leva: como a fábrica está CONFIGURADA no recorte escolhido
// e quanta capacidade isso produz. Duas seções, porque são duas perguntas — o
// cadastro explica o número, e o número justifica o cadastro.
//
// O recorte é planta › área › CC, e chega como lista de ids: a tela já resolveu
// a árvore de marcações, e refazer aquela regra aqui seria um segundo lugar
// decidindo quem entra.
// -----------------------------------------------------------------------------

/** A árvore que a tela do drill-down desenha: planta › área › CC. */
export async function arvoreDeConfiguracao() {
  return sql`
    select p.id            as planta_id,
           p.nome          as planta,
           a.id            as area_id,
           a.nome          as area,
           coalesce(m.cc, '(sem CC)') as cc,
           count(*)::int   as recursos
      from recurso r
      join maquina_fisica m on m.id = r.maquina_fisica_id
      join area a  on a.id = r.area_id
      join planta p on p.id = a.planta_id
     group by 1, 2, 3, 4, 5
     order by p.nome, a.nome, 5`;
}

/**
 * O RECORTE ABERTO POR CENTRO DE TRABALHO.
 *
 * É a matéria-prima das três granularidades do documento: um slide por CT sai
 * daqui direto, um slide por CC sai da soma destas linhas, e o resumo do recorte
 * inteiro sai da soma de todas elas — tudo em `lib/documento.js`.
 *
 * ANTES ERAM TRÊS CONSULTAS, uma por nível, e três lugares capazes de discordar
 * em silêncio: os números do resumo e a soma dos slides pareceriam certos
 * separadamente, e ninguém confere um contra o outro num .pptx.
 *
 * Turnos e calendários saem como LISTA DE IDs, e não como contagem. Dois CTs
 * costumam dividir o mesmo turno: somar "1 turno" com "1 turno" daria dois, e
 * o resumo diria que a fábrica tem o dobro de turnos que tem. Com a lista,
 * juntar é união de conjunto, e a conta fecha em qualquer nível.
 *
 * O intervalo é DE DATA, e não de mês, pela mesma razão do painel: o dia é a
 * granularidade em que a capacidade foi calculada, e somar mês fechado quando
 * alguém pediu de 15/03 a 10/04 daria um número que não é o pedido.
 *
 * A demanda entra por cenário — a carga escolhida, que pode não ser a corrente:
 * comparar contra outro cenário não deveria obrigar a trocar o que todo mundo
 * está vendo.
 */
export async function detalheDoRecorte(areaIds, ccs, ano, de, ate,
                                       origem = 'META', cargaId = null) {
  const areas = (areaIds ?? []).join(',') || '0';
  const lista = (ccs ?? []).join(',') || null;

  return sql`
    with rodada as (
      select id from calculo_execucao
       where status = 'OK' and origem = ${origem}
         and area_id = any(string_to_array(${areas}, ',')::int[])
         and extract(year from periodo_inicio) = ${Number(ano)}
    ),
    alvo as (
      select r.id, r.nome, r.tipo_recurso,
             coalesce(m.cc, '(sem CC)') as cc,
             -- Sem o coalesce, um cadastro com CT em branco viraria chave nula
             -- e o recurso sumiria do documento sem nada dizer. Aparecer como
             -- "(sem CT)" é o que faz alguém ir corrigir o cadastro.
             coalesce(m.cc, '(sem CC)') || '-' || coalesce(m.ct, '(sem CT)')
               as chave,
             p.nome as planta, a.nome as area,
             coalesce(rp.qt_recursos, 1) as qt
        from recurso r
        join maquina_fisica m on m.id = r.maquina_fisica_id
        join area a  on a.id = r.area_id
        join planta p on p.id = a.planta_id
        left join recurso_parametro rp on rp.recurso_id = r.id
                                      and rp.status_cadastro
       where r.area_id = any(string_to_array(${areas}, ',')::int[])
         -- O mesmo coalesce da árvore: ela oferece "(sem CC)" para marcar, e
         -- comparar contra m.cc cru faria essa marcação não trazer ninguém.
         and (${lista}::text is null
              or coalesce(m.cc, '(sem CC)') = any(string_to_array(${lista}, ',')))
    ),
    cad as (
      select chave,
             min(planta)                        as planta,
             min(area)                          as area,
             min(cc)                            as cc,
             string_agg(distinct nome, ', ')    as recursos,
             count(*)::int                      as qtd_recursos,
             sum(qt)::int                       as postos,
             count(*) filter (where tipo_recurso = 'MAQUINA')::int as maquinas,
             count(*) filter (where tipo_recurso = 'PESSOA')::int  as pessoas
        from alvo group by 1
    ),
    turnos as (
      select a.chave, array_agg(distinct t.turno_id) as turno_ids
        from alvo a join recurso_turno t on t.recurso_id = a.id group by 1
    ),
    cals as (
      select a.chave, array_agg(distinct c.calendario_id) as calendario_ids
        from alvo a join recurso_calendario c on c.recurso_id = a.id group by 1
    ),
    oees as (
      select a.chave, count(*)::int as faixas_oee
        from alvo a join recurso_oee o on o.recurso_id = a.id group by 1
    ),
    pars as (
      select a.chave, count(*)::int as paradas
        from alvo a join parada p on p.recurso_id = a.id group by 1
    ),
    cap as (
      select a.chave,
             sum(f.min_planejada)::float8  as planejada,
             sum(f.min_disponivel)::float8 as disponivel
        from capacidade_fato f
        join rodada x on x.id = f.execucao_id
        join alvo a   on a.id = f.recurso_id
       where f.data between ${de}::date and ${ate}::date
       group by 1
    ),
    inst as (
      select a.chave, sum(c.min_instalada)::float8 as instalada
        from capacidade_instalada_dia c
        join rodada x on x.id = c.execucao_id
        join alvo a   on a.id = c.recurso_id
       where c.data between ${de}::date and ${ate}::date
       group by 1
    ),
    dem as (
      select l.ct as chave, sum(l.duracao_min)::float8 as demanda
        from demanda_linha l
       where l.carga_id = ${cargaId}::int
         and l.periodo_data between ${de}::date and ${ate}::date
         and l.ct in (select chave from alvo)
       group by 1
    )
    select cad.chave                          as ct,
           cad.planta, cad.area, cad.cc,
           cad.recursos, cad.qtd_recursos, cad.postos,
           cad.maquinas, cad.pessoas,
           coalesce(turnos.turno_ids, '{}'::int[])    as turno_ids,
           coalesce(cals.calendario_ids, '{}'::int[]) as calendario_ids,
           coalesce(oees.faixas_oee, 0)       as faixas_oee,
           coalesce(pars.paradas, 0)          as paradas,
           coalesce(inst.instalada, 0)        as instalada,
           coalesce(cap.planejada, 0)         as planejada,
           coalesce(cap.disponivel, 0)        as disponivel,
           coalesce(dem.demanda, 0)           as demanda
      from cad
      left join turnos on turnos.chave = cad.chave
      left join cals   on cals.chave   = cad.chave
      left join oees   on oees.chave   = cad.chave
      left join pars   on pars.chave   = cad.chave
      left join cap    on cap.chave    = cad.chave
      left join inst   on inst.chave   = cad.chave
      left join dem    on dem.chave    = cad.chave
     order by cad.planta, cad.area, cad.cc, cad.chave`;
}

/**
 * O MESMO RECORTE, MÊS A MÊS — a matéria-prima do gráfico do slide.
 *
 * Uma linha por CT e por mês, sempre TODOS os meses do período: o `cross join`
 * com a série de meses garante a coluna vazia. Sem ela, um mês sem capacidade
 * sumiria do gráfico e os outros se espalhariam para preencher o espaço — um
 * ano de onze colunas parece um ano normal, e ninguém percebe que falta março.
 *
 * O OEE não vem daqui: ele é `disponível ÷ planejada`, calculado na exibição.
 * Ler a faixa cadastrada de novo seria uma segunda fonte para o mesmo número, e
 * ela poderia mostrar 78% embaixo de uma barra calculada com 75% — a rodada é
 * de ontem, o cadastro é de hoje, e o slide não teria como avisar.
 *
 * OS MINUTOS DE PARADA são o que o motor DESCONTOU nesta mesma rodada, e não
 * uma soma da tabela `parada`. Somar o cadastro daria outro número: parada vale
 * por turno, e o intervalo dela pode cair fora do calendário do recurso.
 *
 * E NÃO É a coluna `min_parada_planejada`, que foi a minha primeira tentativa e
 * estava errada: ela só conta parada com MINUTOS. Parada de dia inteiro não tem
 * minutos — ela zera o dia —, então caía como zero, e o slide mostrava "0" num
 * mês em que a capacidade tinha desabado à vista de todos.
 *
 * A conta certa é o degrau da cadeia: o que o dia valia depois do calendário
 * menos o que sobrou como planejada. Dia não útil dá zero — a perda é do
 * feriado, não da parada — e dia inteiro dá o dia todo, que é o certo.
 * `min_turno_liquido` é o turno de UMA máquina, então a multiplicação por
 * `qt_recursos` e `equivalencia` tem que estar aqui: sem ela, um recurso de
 * seis máquinas declararia um sexto da parada.
 */
export async function serieDoRecorte(areaIds, ccs, ano, de, ate,
                                     origem = 'META', cargaId = null) {
  const areas = (areaIds ?? []).join(',') || '0';
  const lista = (ccs ?? []).join(',') || null;

  return sql`
    with rodada as (
      select id from calculo_execucao
       where status = 'OK' and origem = ${origem}
         and area_id = any(string_to_array(${areas}, ',')::int[])
         and extract(year from periodo_inicio) = ${Number(ano)}
    ),
    alvo as (
      select r.id,
             coalesce(m.cc, '(sem CC)') as cc,
             coalesce(m.cc, '(sem CC)') || '-' || coalesce(m.ct, '(sem CT)')
               as chave,
             p.nome as planta, a.nome as area
        from recurso r
        join maquina_fisica m on m.id = r.maquina_fisica_id
        join area a  on a.id = r.area_id
        join planta p on p.id = a.planta_id
       where r.area_id = any(string_to_array(${areas}, ',')::int[])
         and (${lista}::text is null
              or coalesce(m.cc, '(sem CC)') = any(string_to_array(${lista}, ',')))
    ),
    ident as (
      select chave, min(planta) as planta, min(area) as area, min(cc) as cc
        from alvo group by 1
    ),
    mes as (
      select generate_series(extract(month from ${de}::date)::int,
                             extract(month from ${ate}::date)::int) as mes
    ),
    cap as (
      select a.chave, extract(month from f.data)::int as mes,
             sum(f.min_planejada)::float8   as planejada,
             sum(f.min_disponivel)::float8  as disponivel,
             -- A MESMA capacidade em metro e na UM do material. O indice e por
             -- CT e por mes, e e o mesmo que o painel usa: minuto vezes
             -- metros_por_min da o que aquele tempo produz no mix do mes.
             --
             -- Zero quando nao ha indice, e nao nulo: CT sem demanda naquele
             -- mes nao converte, e somar nulo apagaria o mes inteiro do total.
             sum(f.min_planejada  * coalesce(idx.metros_por_min, 0))::float8
               as planejada_m,
             sum(f.min_disponivel * coalesce(idx.metros_por_min, 0))::float8
               as disponivel_m,
             sum(f.min_planejada  * coalesce(idx.qtd_por_min, 0))::float8
               as planejada_u,
             sum(f.min_disponivel * coalesce(idx.qtd_por_min, 0))::float8
               as disponivel_u,
             sum(case when f.dia_util
                      then (f.min_turno_liquido * f.qt_recursos * f.equivalencia)
                           - f.min_planejada
                      else 0 end)::float8   as parada
        from capacidade_fato f
        join rodada x on x.id = f.execucao_id
        join alvo a   on a.id = f.recurso_id
        left join mv_demanda_indice idx
               on idx.carga_id = ${cargaId}::int
              and idx.ct       = a.chave
              and idx.mes      = date_trunc('month', f.data)::date
       where f.data between ${de}::date and ${ate}::date
       group by 1, 2
    ),
    inst as (
      select a.chave, extract(month from c.data)::int as mes,
             sum(c.min_instalada)::float8 as instalada
        from capacidade_instalada_dia c
        join rodada x on x.id = c.execucao_id
        join alvo a   on a.id = c.recurso_id
       where c.data between ${de}::date and ${ate}::date
       group by 1, 2
    ),
    dem as (
      -- A demanda em metro e em UM sai da COLUNA, e nao do indice: ela e o
      -- numero que veio no plano, e o indice foi calculado a partir dela. Ir
      -- pelo indice seria desfazer e refazer a mesma divisao, com o
      -- arredondamento de brinde.
      select l.ct as chave, extract(month from l.periodo_data)::int as mes,
             sum(l.duracao_min)::float8   as demanda,
             sum(l.qtd_metros_kg)::float8 as demanda_m,
             sum(l.qtd)::float8           as demanda_u
        from demanda_linha l
       where l.carga_id = ${cargaId}::int
         and l.periodo_data between ${de}::date and ${ate}::date
         and l.ct in (select chave from alvo)
       group by 1, 2
    )
    select i.chave as ct, i.planta, i.area, i.cc, mes.mes,
           -- A instalada NAO converte, de proposito e igual ao painel: ela e
           -- teto fisico de 24 h, e multiplicar isso pelo indice do mix daria
           -- "quantos metros caberiam se a maquina rodasse o ano inteiro no
           -- ritmo deste mes" — um numero que ninguem pediu e que parece
           -- capacidade. Em metro ou UM a tela nao oferece a instalada.
           coalesce(inst.instalada, 0)   as instalada,
           coalesce(cap.planejada, 0)    as planejada,
           coalesce(cap.disponivel, 0)   as disponivel,
           coalesce(cap.planejada_m, 0)  as planejada_m,
           coalesce(cap.disponivel_m, 0) as disponivel_m,
           coalesce(cap.planejada_u, 0)  as planejada_u,
           coalesce(cap.disponivel_u, 0) as disponivel_u,
           -- A parada fica em MINUTO em qualquer unidade: ela e tempo que a
           -- maquina nao rodou, e "300 metros de parada" nao quer dizer nada.
           coalesce(cap.parada, 0)       as parada,
           coalesce(dem.demanda, 0)      as demanda,
           coalesce(dem.demanda_m, 0)    as demanda_m,
           coalesce(dem.demanda_u, 0)    as demanda_u
      from ident i
      cross join mes
      left join cap  on cap.chave  = i.chave and cap.mes  = mes.mes
      left join inst on inst.chave = i.chave and inst.mes = mes.mes
      left join dem  on dem.chave  = i.chave and dem.mes  = mes.mes
     order by i.planta, i.area, i.cc, i.chave, mes.mes`;
}

/**
 * OS TURNOS DO RECORTE, mês a mês, com quantos recursos rodam em cada um.
 *
 * MÊS A MÊS PORQUE A VIGÊNCIA MUDA: um turno que entra em maio apareceria o ano
 * inteiro numa contagem única, e a linha embaixo do gráfico diria que a fábrica
 * tinha três turnos em janeiro. O cruzamento é por sobreposição do mês com a
 * vigência, então a mudança aparece na coluna em que aconteceu.
 *
 * O NÚMERO É DE PATRIMÔNIO, e não de linha de cadastro. Cada patrimônio é um
 * recurso com a máquina física dele, e um recurso pode ainda representar várias
 * máquinas iguais (`recurso_parametro.qt_recursos`). O que sai é a soma dos dois
 * casos: num CT com quatro patrimônios, dois no 1º e 2º turno, um nos três
 * turnos e um no rodízio 24/7, saem 3 · 3 · 1 · 1.
 *
 * `recurso_turno.qt_recursos` nulo quer dizer "todas as máquinas do recurso" —
 * é a convenção da migração 15, e ignorá-la contaria uma máquina onde rodam
 * seis.
 *
 * Volta o ID do turno, e não só o nome: o documento lista TODOS os turnos
 * cadastrados e precisa casar cada linha com o turno certo. Dois turnos de
 * plantas diferentes podem se chamar igual, e casar por nome juntaria os dois
 * numa linha só.
 */
export async function turnosDoRecorte(areaIds, ccs, ano, de, ate) {
  const areas = (areaIds ?? []).join(',') || '0';
  const lista = (ccs ?? []).join(',') || null;

  return sql`
    with alvo as (
      select r.id,
             coalesce(m.cc, '(sem CC)') as cc,
             coalesce(m.cc, '(sem CC)') || '-' || coalesce(m.ct, '(sem CT)')
               as chave,
             p.nome as planta, a.nome as area,
             coalesce(rp.qt_recursos, 1) as qt
        from recurso r
        join maquina_fisica m on m.id = r.maquina_fisica_id
        join area a  on a.id = r.area_id
        join planta p on p.id = a.planta_id
        left join recurso_parametro rp on rp.recurso_id = r.id
                                      and rp.status_cadastro
       where r.area_id = any(string_to_array(${areas}, ',')::int[])
         and (${lista}::text is null
              or coalesce(m.cc, '(sem CC)') = any(string_to_array(${lista}, ',')))
    ),
    mes as (
      select generate_series(extract(month from ${de}::date)::int,
                             extract(month from ${ate}::date)::int) as mes
    ),
    por_recurso as (
      -- UMA LINHA POR RECURSO, e só depois a soma. Um recurso que trocou de
      -- configuração no meio do mês tem DUAS vigências tocando aquele mês, e a
      -- sobreposição casa com as duas: somar direto contaria o mesmo patrimônio
      -- duas vezes, e o slide diria que o turno tem seis máquinas onde há três.
      -- O maior das duas é a leitura certa do mês: quantas chegaram a rodar.
      select a.chave, t.id as turno_id, t.nome as turno, mes.mes, a.id as recurso_id,
             max(coalesce(rt.qt_recursos, a.qt)) as qt
        from alvo a
        join recurso_turno rt on rt.recurso_id = a.id
        join turno t on t.id = rt.turno_id
        cross join mes
       where rt.vigencia && daterange(
               make_date(${Number(ano)}, mes.mes, 1),
               (make_date(${Number(ano)}, mes.mes, 1) + interval '1 month')::date,
               '[)')
       group by 1, 2, 3, 4, 5
    )
    select pr.chave as ct, min(a.planta) as planta, min(a.area) as area,
           min(a.cc) as cc, pr.turno_id, pr.turno, pr.mes,
           sum(pr.qt)::int as qt
      from por_recurso pr
      join alvo a on a.id = pr.recurso_id
     group by pr.chave, pr.turno_id, pr.turno, pr.mes
     order by 1, 5, 7`;
}

// -----------------------------------------------------------------------------
// O MODELO DE SLIDE
//
// O arquivo viaja em base64 porque o driver do Neon é tagged template de texto.
// Ver 28_modelo_slide.sql.
// -----------------------------------------------------------------------------

/**
 * O MODELO CHEGA EM PEDAÇOS, como a base de demanda.
 *
 * Ele sobe em base64 — um terço maior que o arquivo — dentro de um JSON, e o
 * corpo de uma requisição serverless tem teto. Um modelo de apresentação com
 * logotipo e imagem de fundo passa dele com facilidade, e o que voltava era um
 * "Request Entity Too Large" em texto puro, que o cliente tentava ler como JSON
 * e transformava numa mensagem sobre sintaxe.
 *
 * Em pedaços não existe teto: cada um cabe folgado, e o arquivo cresce no banco
 * por concatenação. É o mesmo caminho de `gravarLote`, pela mesma razão.
 */
export async function iniciarModeloSlide({ arquivo, slideMarca, slides }) {
  const nome = String(arquivo ?? '').trim();
  if (!nome) throw new Error('O modelo precisa de um nome de arquivo.');

  await sql`
    insert into modelo_slide (id, arquivo, conteudo, slide_marca, slides, tamanho)
    values (true, ${nome}, ''::bytea, ${slideMarca ?? null},
            ${Number(slides) || 0}, 0)
    on conflict (id) do update
       set arquivo = excluded.arquivo, conteudo = ''::bytea,
           slide_marca = excluded.slide_marca, slides = excluded.slides,
           tamanho = 0, criado_em = now()`;
}

/**
 * Anexa um pedaço.
 *
 * Cada pedaço é decodificado por conta própria, então quem fatia precisa cortar
 * os BYTES e codificar cada parte — cortar o base64 no meio de um grupo de
 * quatro daria um arquivo corrompido que só o PowerPoint reclamaria.
 */
export async function anexarModeloSlide(base64) {
  if (!base64) return;
  await sql`
    update modelo_slide
       set conteudo = conteudo || decode(${base64}, 'base64')
     where id`;
}

/** Fecha e devolve o tamanho de verdade, medido no banco. */
export async function concluirModeloSlide() {
  const r = await sql`
    update modelo_slide
       set tamanho = length(conteudo)
     where id
     returning tamanho, slides, slide_marca`;
  const m = r[0];
  if (!m || !m.tamanho) {
    throw new Error('O modelo chegou vazio — nenhum pedaço foi gravado.');
  }
  return m;
}

/** Só o cabeçalho, para a tela dizer o que está guardado sem trazer os bytes. */
export async function resumoModeloSlide() {
  const r = await sql`
    select arquivo, slide_marca, slides, tamanho, criado_em
      from modelo_slide where id`;
  return r[0] ?? null;
}

/** Os bytes, em base64, só na hora de exportar. */
export async function modeloSlideBase64() {
  const r = await sql`
    select arquivo, encode(conteudo, 'base64') as base64
      from modelo_slide where id`;
  return r[0] ?? null;
}

export async function apagarModeloSlide() {
  await sql`delete from modelo_slide where id`;
}

// -----------------------------------------------------------------------------
// AS FAIXAS DE COR DA OCUPAÇÃO
//
// Ver 29_faixa_ocupacao.sql. O intervalo é guardado como numrange para o banco
// poder recusar sobreposição sozinho; aqui ele volta aberto em duas colunas,
// que é a forma que o JavaScript e a tela usam.
// -----------------------------------------------------------------------------

export async function faixasDeOcupacao() {
  return sql`
    select id,
           lower(faixa)::float8 as pct_de,
           upper(faixa)::float8 as pct_ate,
           cor, rotulo
      from faixa_ocupacao
     order by lower(faixa) nulls first`;
}

/**
 * Grava a lista inteira, substituindo a anterior.
 *
 * APAGAR E INSERIR NUMA TRANSAÇÃO, e não atualizar linha a linha: a tela edita
 * o conjunto, e um passo intermediário com a faixa velha e a nova convivendo
 * bate na trava de sobreposição do banco — trocar "0 a 85" por "0 a 90" falharia
 * contra a própria linha que está sendo trocada.
 *
 * As faixas chegam já validadas por `lib/faixa-cor.js`; aqui é só escrita.
 */
export async function salvarFaixasDeOcupacao(faixas) {
  const lista = faixas ?? [];
  await sql.transaction([
    sql`delete from faixa_ocupacao`,
    ...lista.map((f) => sql`
      insert into faixa_ocupacao (faixa, cor, rotulo)
      values (numrange(${f.pct_de === null ? null : Number(f.pct_de)}::numeric,
                       ${f.pct_ate === null ? null : Number(f.pct_ate)}::numeric,
                       '[)'),
              ${f.cor}, ${f.rotulo ?? null})`),
  ]);
}
