-- =============================================================================
-- 35 — A INSTALADA DEIXA DE SER GRÃO DIA E VIRA FAIXA
--
-- Em 11/09/2026 o Neon recusou escrita pela segunda vez no meio de um
-- Recalcular tudo: 474 MB de 512, e a Tecelagem 2027 — a maior rodada da
-- fábrica, 162 mil linhas de fato por origem — não coube. Três rodadas ficaram
-- com os números de 09/09, anteriores aos recursos novos, ao lado de 45 com os
-- de hoje. O ROADMAP já dizia onde estava o desperdício, e a medida confirmou:
--
--   capacidade_instalada_dia   950 mil linhas   167 MB   para 2.604 pares
--                                                         recurso x rodada
--
-- São 365 linhas por recurso e rodada guardando um número que não muda de um
-- dia para o outro: 1440 x qt x equivalencia. 58% delas estão em rodadas que
-- não têm uma única linha de fato (anos sem turno), e META e SIMULADO carregam
-- cópias idênticas, porque o OEE não entra na instalada.
--
-- A NOVA FORMA: uma linha por (rodada, recurso, vigência), com os minutos de
-- instalada POR DIA que valem naquela faixa. Um recurso que não trocou de
-- quantidade no ano é UMA linha. 950 mil viram ~2,6 mil.
--
-- PESSOA NÃO TEM FAIXA DE VALOR: para ela a instalada é a própria planejada
-- (migração 16), que varia dia a dia e já está no fato. A faixa dela existe —
-- diz que o recurso existia naquele período — mas leva `pessoa = true` e
-- `min_dia` nulo, e o teto sai do fato. A decisão de quem é pessoa é tomada NA
-- RODADA, e gravada aqui: se alguém trocar o tipo de um recurso depois, a
-- rodada guardada continua contando como contou, que é a regra de todo o resto.
--
-- O DIA A DIA NÃO SE PERDE. A view vw_instalada_dia devolve exatamente a forma
-- da tabela antiga — recurso x dia, min_instalada — expandindo a faixa com
-- generate_series e lendo a planejada do fato para pessoa. As consultas do
-- painel trocam o nome da tabela pelo da view e nada mais muda: pedir o dia 17
-- de março devolve o mesmo número que a tabela de hoje devolve. O que se deixa
-- de fazer é GUARDAR 365 vezes o que se pode gerar.
--
-- POR QUE UMA VIEW, e não a conta de dias em cada consulta: são nove consultas
-- lendo instalada, com fatia, filtro de recurso e recorte de datas no meio. Nove
-- implementações da mesma sobreposição de vigência com intervalo é onde uma
-- delas erra o dia da ponta e ninguém vê. A view é o lugar único decidindo.
--
-- O ESPAÇO VOLTA NA HORA. Tabela nova é criada, preenchida a partir da velha e
-- conferida; a velha é DERRUBADA com drop, que devolve o arquivo ao disco sem
-- passar pela catraca do vacuum full (ver ROADMAP, "o dia em que a fábrica não
-- coube").
--
-- IMPACTO NOS NÚMEROS: nenhum. A conferência da parte A soma a instalada por
-- rodada nas duas formas e exige igualdade antes de a velha sair.
--
-- ORDEM — em duas partes, e é a única migração do projeto assim:
--   PARTE A  antes do deploy: dois índices fora, tabela nova, backfill, view,
--            motor. O código que está no ar continua lendo a tabela velha.
--   PARTE B  depois do deploy: drop da tabela velha.
--            Se rodasse antes, o painel no ar ficaria sem tabela por alguns
--            minutos — e o ganho de espaço não tem pressa de minutos.
-- Depois das duas: Recalcular tudo, para as rodadas que falharam entrarem.
-- =============================================================================

-- =============================================================================
-- PARTE A
-- =============================================================================

-- PRIMEIRO OS ÍNDICES, e não por estética: na hora de rodar isto, a branch
-- estava em 512,85 MiB medidos pelo Neon — acima do teto —, e o create table de
-- uma tabela de kilobytes falhou com "could not extend file". Drop de índice é
-- a única operação que devolve espaço sem precisar de espaço (a lição da 32).
--
-- Os dois são (area_id, data), sem execucao_id. Toda consulta do painel, da
-- ocupação e das extrações filtra execucao_id primeiro, e a chave primária
-- começa por ele: 20 e 107 scans na vida do banco, 14 e 17 MB. O da instalada
-- morreria junto com a tabela na parte B; sai antes só para abrir espaço.
drop index if exists ix_cid_area_data;
drop index if exists ix_cf_area_data;

create table if not exists capacidade_instalada (
    execucao_id  bigint    not null references calculo_execucao(id) on delete cascade,
    recurso_id   int       not null references recurso(id),
    planta_id    int       not null references planta(id),
    area_id      int       not null references area(id),
    -- Os dias do período da rodada em que esta linha vale. Um recurso que
    -- trocou de quantidade em julho tem duas faixas; o que não trocou tem uma.
    vigencia     daterange not null,
    qt_recursos  int       not null,
    equivalencia numeric(10,4) not null,
    -- Minutos de instalada POR DIA nesta faixa: 1440 x qt x equivalencia.
    -- Nulo quando `pessoa`: o teto de pessoa é a planejada, que mora no fato.
    min_dia      numeric(18,6),
    pessoa       boolean   not null default false,

    constraint ci_pessoa_sem_min check (pessoa = (min_dia is null)),
    constraint ci_nao_vazia      check (not isempty(vigencia)),
    constraint ci_sem_sobreposicao
        exclude using gist (execucao_id with =, recurso_id with =, vigencia with &&)
);

comment on table capacidade_instalada is
    'Instalada por rodada, recurso e faixa de vigencia: minutos POR DIA. '
    'Grao dia sai de vw_instalada_dia. Pessoa leva min_dia nulo: o teto dela '
    'e a planejada do fato.';

-- Backfill: ilhas de dias consecutivos com o mesmo valor viram uma faixa.
-- data - row_number e constante dentro de uma sequencia sem buraco, e muda
-- quando a sequencia quebra ou o valor muda: e o que separa as ilhas.
-- Para pessoa o valor nao entra na chave — ele varia por dia de proposito, e a
-- faixa dela e so a existencia do recurso no periodo.
insert into capacidade_instalada
    (execucao_id, recurso_id, planta_id, area_id, vigencia,
     qt_recursos, equivalencia, min_dia, pessoa)
with base as (
    select c.execucao_id, c.recurso_id, c.planta_id, c.area_id, c.data,
           c.qt_recursos, c.equivalencia,
           r.tipo_recurso = 'PESSOA' as pessoa,
           case when r.tipo_recurso = 'PESSOA' then null
                else c.min_instalada end as min_dia
      from capacidade_instalada_dia c
      join recurso r on r.id = c.recurso_id
),
ilhas as (
    select b.*,
           b.data - (row_number() over (
               partition by b.execucao_id, b.recurso_id, b.qt_recursos,
                            b.equivalencia, b.min_dia, b.pessoa
               order by b.data))::int as grupo
      from base b
)
select execucao_id, recurso_id, min(planta_id), min(area_id),
       daterange(min(data), max(data) + 1, '[)'),
       qt_recursos, equivalencia, min_dia, pessoa
  from ilhas
 group by execucao_id, recurso_id, qt_recursos, equivalencia, min_dia, pessoa,
          grupo;

-- A forma antiga, gerada em vez de guardada. Mesmas colunas, mesmos nomes: as
-- consultas trocam so o nome da tabela.
create or replace view vw_instalada_dia as
select i.execucao_id, i.recurso_id, i.planta_id, i.area_id,
       d::date        as data,
       i.qt_recursos, i.equivalencia,
       i.min_dia      as min_instalada
  from capacidade_instalada i
 cross join lateral generate_series(lower(i.vigencia), upper(i.vigencia) - 1,
                                    interval '1 day') as d
 where not i.pessoa

union all

-- Pessoa: o teto do dia e a planejada do dia. Amarrado a faixa da rodada, e nao
-- ao tipo_recurso de hoje: quem decide se e pessoa e a rodada que calculou.
select f.execucao_id, f.recurso_id, f.planta_id, f.area_id,
       f.data,
       i.qt_recursos, i.equivalencia,
       sum(f.min_planejada)
  from capacidade_instalada i
  join capacidade_fato f on f.execucao_id = i.execucao_id
                        and f.recurso_id  = i.recurso_id
                        and i.vigencia   @> f.data
 where i.pessoa
 group by f.execucao_id, f.recurso_id, f.planta_id, f.area_id, f.data,
          i.qt_recursos, i.equivalencia;

comment on view vw_instalada_dia is
    'Instalada em grao recurso x dia, gerada das faixas de capacidade_instalada. '
    'E o que o painel, a ocupacao e as extracoes leem.';

-- CONFERENCIA, antes de qualquer drop. Tem que voltar zero linhas: a soma da
-- instalada por rodada nas duas formas e identica, ou a velha nao sai.
--
--   with velha as (select execucao_id, sum(min_instalada) s, count(*) n
--                    from capacidade_instalada_dia group by 1),
--        nova  as (select execucao_id, sum(min_instalada) s, count(*) n
--                    from vw_instalada_dia group by 1)
--   select coalesce(v.execucao_id, n.execucao_id), v.s, n.s, v.n, n.n
--     from velha v full join nova n on n.execucao_id = v.execucao_id
--    where v.s is distinct from n.s or v.n is distinct from n.n;

-- O motor: a instalada passa a ser escrita como faixa. A intersecao da vigencia
-- do parametro com o periodo pedido e a faixa; os dias sao os mesmos que o
-- generate_series antigo produzia, sem gerar nenhum.
create or replace function fn_calcular_capacidade(
    p_cenario_id  int,
    p_data_inicio date,
    p_data_fim    date,
    p_area_id     int default null,        -- null = todas as áreas
    p_origem      varchar default 'META'   -- qual OEE usar
) returns bigint
language plpgsql
as $$
declare
    v_execucao_id bigint;
begin
    if p_origem not in ('META', 'SIMULADO') then
        raise exception 'Origem de OEE invalida: %', p_origem;
    end if;

    insert into calculo_execucao
        (cenario_id, periodo_inicio, periodo_fim, status, origem)
    values (p_cenario_id, p_data_inicio, p_data_fim, 'RODANDO', p_origem)
    returning id into v_execucao_id;

    -- =========================================================================
    -- O CÁLCULO, MATERIALIZADO
    -- Guarda cada valor intermediário da cadeia, para o fato ler exatamente
    -- os mesmos números.
    -- =========================================================================
    create temporary table tmp_calc on commit drop as
    with base as (
        select r.id as recurso_id, r.tipo_recurso, a.planta_id, r.area_id,
               d.data, d.dia_semana, t.id as turno_id,
               -- Quantas maquinas rodam NESTE turno. Nulo em recurso_turno
               -- quer dizer "todas", que e o caso normal e o que ja estava
               -- cadastrado. So a planejada usa isto: a instalada continua
               -- com o numero do recurso, porque maquina parada no 3o turno
               -- continua existindo e continua ocupando o teto.
               coalesce(rt.qt_recursos, rp.qt_recursos) as qt_recursos,
               rp.equivalencia, rc.calendario_id,
               rt.escala_id, rt.escala_data_referencia
        -- O dia sai do periodo pedido, nao de uma tabela de calendario
        -- pre-populada. Aquela ia so ate 2027: pedir 2028 devolvia zero linha
        -- em silencio, a rodada saia "OK" sem gravar nada e o painel dizia
        -- "nunca foi calculado" — sem erro, sem pista, para sempre. Assim nao
        -- existe mais ano que falta.
        --
        -- dow: 0 = domingo, o mesmo que a tabela antiga guardava.
        from (select g::date as data,
                     extract(dow from g)::smallint as dia_semana
                from generate_series(p_data_inicio, p_data_fim, interval '1 day') g
             ) d
        join recurso r             on true
        join area a                on a.id = r.area_id
        join recurso_parametro rp  on rp.recurso_id = r.id
                                  and rp.vigencia @> d.data
                                  and rp.status_cadastro
        join recurso_calendario rc on rc.recurso_id = r.id
                                  and rc.vigencia @> d.data
        join recurso_turno rt      on rt.recurso_id = r.id
                                  and rt.vigencia @> d.data
        join turno t               on t.id = rt.turno_id
        where p_area_id is null or r.area_id = p_area_id
    ),
    com_regra as (
        select b.*,
               -- O calendário manda trabalhar? Ordem de prioridade:
               --   1. exceção específica daquele turno
               --   2. exceção do dia inteiro
               --   3. o calendário trabalha nesse dia da semana
               --
               -- A exceção só vale quando as DUAS marcações batem: a área do
               -- recurso está na lista, e o calendário dele também.
               coalesce(
                   -- afeta_capacidade filtra os dois ramos: excecao marcada
                   -- como so apresentacao nao entra no coalesce, entao o dia
                   -- cai na regra normal do calendario e produz igual. Ela
                   -- existe para a contagem de dias uteis e para a leitura da
                   -- grade do ano, nao para o motor.
                   (select ex.dia_util
                      from excecao ex
                      join excecao_calendario ec on ec.excecao_id = ex.id
                      join excecao_area ea       on ea.excecao_id = ex.id
                     where ec.calendario_id = b.calendario_id
                       and ea.area_id       = b.area_id
                       and ex.data     = b.data
                       and ex.turno_id = b.turno_id
                       and ex.afeta_capacidade
                     limit 1),
                   (select ex.dia_util
                      from excecao ex
                      join excecao_calendario ec on ec.excecao_id = ex.id
                      join excecao_area ea       on ea.excecao_id = ex.id
                     where ec.calendario_id = b.calendario_id
                       and ea.area_id       = b.area_id
                       and ex.data = b.data
                       and ex.turno_id is null
                       and ex.afeta_capacidade
                     limit 1),
                   exists (select 1 from calendario_dia cd
                            where cd.calendario_id = b.calendario_id
                              and cd.dia_semana    = b.dia_semana)
               ) as calendario_ok,
               case
                 when b.escala_id is null then true
                 else coalesce((
                     select ed.trabalha
                       from escala e
                       join escala_dia ed on ed.escala_id = e.id
                      where e.id = b.escala_id
                        and ed.posicao_ciclo =
                            ((b.data - b.escala_data_referencia) % e.ciclo_dias
                             + e.ciclo_dias) % e.ciclo_dias
                 ), false)
               end as escala_ok
        from base b
    ),
    paradas as (
        select b.recurso_id, b.data, b.turno_id,
               bool_or(p.dia_inteiro) as tem_dia_inteiro,
               coalesce(sum(case when not p.dia_inteiro and tp.abate_planejada
                                 then p.minutos else 0 end), 0) as min_parada_planejada,
               coalesce(sum(case when not p.dia_inteiro and not tp.abate_planejada
                                 then p.minutos else 0 end), 0) as min_parada_outras,
               string_agg(distinct tp.nome, ', ')                as nomes_parada
        from com_regra b
        join parada p       on p.recurso_id = b.recurso_id
                           and b.data between p.data_inicio and p.data_fim
                           and (p.turno_id is null or p.turno_id = b.turno_id)
        join tipo_parada tp on tp.id = p.tipo_parada_id
        group by b.recurso_id, b.data, b.turno_id
    )
    select c.recurso_id, c.planta_id, c.area_id, c.data, c.turno_id,
           c.qt_recursos, c.equivalencia,
           (c.calendario_ok and c.escala_ok)          as dia_util,
           coalesce(oee.oee_pct, 0)                   as oee_pct,
           coalesce(pa.tem_dia_inteiro, false)        as tem_dia_inteiro,
           coalesce(pa.min_parada_planejada, 0)::bigint as min_parada_planejada,
           coalesce(pa.min_parada_outras, 0)::bigint    as min_parada_outras,
           pa.nomes_parada,

           -- A cadeia, passo a passo.
           vtm.duracao_turno::numeric                 as v_bruto,
           vtm.minutos::numeric                       as v_liquido,
           (vtm.minutos * c.qt_recursos * c.equivalencia)::numeric as v_quantidade,
           case when not (c.calendario_ok and c.escala_ok) then 0::numeric
                else (vtm.minutos * c.qt_recursos * c.equivalencia)::numeric
           end                                        as v_calendario,
           case when not (c.calendario_ok and c.escala_ok)
                  or coalesce(pa.tem_dia_inteiro, false) then 0::numeric
                else (vtm.minutos * c.qt_recursos * c.equivalencia)::numeric
           end                                        as v_parada_dia
      from com_regra c
      join vw_turno_minutos vtm on vtm.turno_id     = c.turno_id
                               and vtm.dia_semana   = c.dia_semana
                               and vtm.tipo_recurso = c.tipo_recurso
                               and vtm.vigencia    @> c.data
      left join paradas pa on pa.recurso_id = c.recurso_id
                          and pa.data       = c.data
                          and pa.turno_id   = c.turno_id
      left join lateral (
          select o.oee_pct from recurso_oee o
           where o.recurso_id = c.recurso_id
             and o.origem     = p_origem
             and o.vigencia @> c.data
             and (o.turno_id is null or o.turno_id = c.turno_id)
           order by o.turno_id nulls last
           limit 1
      ) oee on true;

    -- Os dois últimos degraus dependem dos anteriores, então saem daqui.
    alter table tmp_calc add column v_planejada  numeric;
    alter table tmp_calc add column v_disponivel numeric;

    update tmp_calc
       set v_planejada = greatest(0, v_parada_dia - min_parada_planejada);
    -- Sem round: era ele que quebrava a conta de cabeca. Arredondar cada
    -- linha (recurso x dia x turno) e depois somar o mes nao da o mesmo que
    -- multiplicar o mes pelo OEE — as sobras de meio minuto de cada linha se
    -- acumulam. Guardando a fracao, planejada x OEE fecha em qualquer nivel.
    update tmp_calc
       set v_disponivel = v_planejada * oee_pct;

    -- =========================================================================
    -- INSTALADA — uma FAIXA por recurso e vigência do parâmetro
    --
    -- MAQUINA: teto fisico. 24h por dia, todo dia, sem olhar calendario, turno
    -- nem parada. A maquina existe no feriado, e e isso que faz o "% do teto"
    -- mostrar ociosidade de verdade. O valor e por dia e nao muda dentro da
    -- vigencia do parametro, entao a faixa e o proprio parametro recortado no
    -- periodo — a intersecao de dois daterange.
    --
    -- PESSOA: o teto e a propria planejada, que varia por dia e ja esta no
    -- fato. A faixa dela e gravada com min_dia nulo: diz que o recurso existia
    -- no periodo, e a view vw_instalada_dia le a planejada de la. Decidido na
    -- rodada, para o numero guardado nao mudar se o tipo do recurso mudar.
    --
    -- Nao exige status_cadastro, de proposito: recurso desativado continua
    -- ocupando o teto. A maquina existe e esta em condicoes de operar; o que
    -- se decidiu foi nao usa-la. A vigencia continua valendo: maquina que
    -- ainda nao chegou nao tem teto nenhum.
    -- =========================================================================
    insert into capacidade_instalada
        (execucao_id, recurso_id, planta_id, area_id, vigencia,
         qt_recursos, equivalencia, min_dia, pessoa)
    select v_execucao_id, r.id, a.planta_id, r.area_id,
           rp.vigencia * daterange(p_data_inicio, p_data_fim, '[]'),
           rp.qt_recursos, rp.equivalencia,
           case when r.tipo_recurso = 'PESSOA' then null
                else (1440 * rp.qt_recursos * rp.equivalencia)::numeric end,
           r.tipo_recurso = 'PESSOA'
      from recurso r
      join area a               on a.id = r.area_id
      join recurso_parametro rp on rp.recurso_id = r.id
                               and rp.vigencia && daterange(p_data_inicio, p_data_fim, '[]')
     where p_area_id is null or r.area_id = p_area_id;

    -- =========================================================================
    -- FATO
    -- =========================================================================
    insert into capacidade_fato
        (execucao_id, recurso_id, planta_id, area_id, data, turno_id,
         qt_recursos, equivalencia, oee_pct, dia_util,
         min_turno_liquido, min_parada_planejada, min_parada_outras,
         min_planejada, min_disponivel)
    select v_execucao_id, recurso_id, planta_id, area_id, data, turno_id,
           qt_recursos, equivalencia, oee_pct, dia_util,
           v_liquido, min_parada_planejada, min_parada_outras,
           v_planejada, v_disponivel
      from tmp_calc;


    update calculo_execucao
       set status = 'OK', concluido_em = now()
     where id = v_execucao_id;

    return v_execucao_id;
end;
$$;

-- =============================================================================
-- PARTE B — só depois de o deploy que lê vw_instalada_dia estar no ar
-- =============================================================================

-- drop table capacidade_instalada_dia;
