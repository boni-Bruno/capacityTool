-- =============================================================================
-- FERRAMENTA DE CAPACIDADE  —  03. MOTOR DE CÁLCULO
--
-- Para cada recurso / dia / turno do período, resolve:
--   1. o recurso existia?          -> recurso_parametro (vigência)
--   2. qual calendário ele segue?  -> recurso_calendario
--   3. em quais turnos trabalha?   -> recurso_turno
--   4. esse dia/turno é útil?      -> calendario_regra + excecao + escala
--   5. quantos minutos tem?        -> turno_horario (máquina x pessoa)
--   6. tem parada planejada?       -> parada + tipo_parada
--   7. qual o OEE?                 -> recurso_oee
--
-- FÓRMULAS
--   instalada  = 1440 x qt_recursos x equivalencia          (grão dia)
--   planejada  = minutos x qt_recursos x equivalencia - paradas   (grão turno)
--   disponivel = planejada x oee
-- =============================================================================

create or replace function fn_calcular_capacidade(
    p_cenario_id  int,
    p_data_inicio date,
    p_data_fim    date,
    p_area_id     int default null       -- null = todas as áreas
) returns bigint
language plpgsql
as $$
declare
    v_execucao_id bigint;
begin
    insert into calculo_execucao (cenario_id, periodo_inicio, periodo_fim, status)
    values (p_cenario_id, p_data_inicio, p_data_fim, 'RODANDO')
    returning id into v_execucao_id;

    -- =========================================================================
    -- INSTALADA — grão recurso x dia
    -- Teto físico: 24h por dia, todo dia. Não olha calendário, turno nem parada.
    -- =========================================================================
    insert into capacidade_instalada_dia
        (execucao_id, recurso_id, planta_id, area_id, data,
         qt_recursos, equivalencia, min_instalada)
    select v_execucao_id, r.id, a.planta_id, r.area_id, d.data,
           rp.qt_recursos, rp.equivalencia,
           (1440 * rp.qt_recursos * rp.equivalencia)::bigint
    from dim_data d
    join recurso r            on true
    join area a               on a.id = r.area_id
    join recurso_parametro rp on rp.recurso_id = r.id
                             and rp.vigencia @> d.data
                             and rp.status_cadastro
    where d.data between p_data_inicio and p_data_fim
      and (p_area_id is null or r.area_id = p_area_id);

    -- =========================================================================
    -- PLANEJADA E DISPONÍVEL — grão recurso x dia x turno
    -- =========================================================================
    with base as (
        select r.id as recurso_id, r.tipo_recurso, a.planta_id, r.area_id,
               d.data, d.dia_semana, t.id as turno_id,
               rp.qt_recursos, rp.equivalencia, rc.calendario_id,
               rt.escala_id, rt.escala_data_referencia
        from dim_data d
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
        where d.data between p_data_inicio and p_data_fim
          and (p_area_id is null or r.area_id = p_area_id)
    ),
    com_regra as (
        select b.*,
               -- O calendário manda trabalhar? Ordem de prioridade:
               --   1. exceção específica daquele turno
               --   2. exceção do dia inteiro
               --   3. regra normal do dia da semana
               -- A exceção só vale se o calendário do recurso a observar.
               coalesce(
                   (select ex.dia_util
                      from excecao ex
                      join excecao_calendario ec on ec.excecao_id = ex.id
                     where ec.calendario_id = b.calendario_id
                       and ex.data     = b.data
                       and ex.turno_id = b.turno_id
                     limit 1),
                   (select ex.dia_util
                      from excecao ex
                      join excecao_calendario ec on ec.excecao_id = ex.id
                     where ec.calendario_id = b.calendario_id
                       and ex.data = b.data
                       and ex.turno_id is null
                     limit 1),
                   exists (select 1 from calendario_regra cr
                            where cr.calendario_id = b.calendario_id
                              and cr.dia_semana    = b.dia_semana
                              and cr.turno_id      = b.turno_id)
               ) as calendario_ok,
               -- Escala de rodízio (sem escala cadastrada = sempre trabalha)
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
                                 then p.minutos else 0 end), 0) as min_parada_outras
        from com_regra b
        join parada p       on p.recurso_id = b.recurso_id
                           and b.data between p.data_inicio and p.data_fim
                           and (p.turno_id is null or p.turno_id = b.turno_id)
        join tipo_parada tp on tp.id = p.tipo_parada_id
        group by b.recurso_id, b.data, b.turno_id
    )
    insert into capacidade_fato
        (execucao_id, recurso_id, planta_id, area_id, data, turno_id,
         qt_recursos, equivalencia, oee_pct, dia_util,
         min_turno_liquido, min_parada_planejada, min_parada_outras,
         min_planejada, min_disponivel)
    select v_execucao_id, c.recurso_id, c.planta_id, c.area_id, c.data, c.turno_id,
           c.qt_recursos, c.equivalencia, coalesce(oee.oee_pct, 1.0),
           (c.calendario_ok and c.escala_ok),
           vtm.minutos,
           coalesce(pa.min_parada_planejada, 0),
           coalesce(pa.min_parada_outras, 0),
           planejada.valor,
           round(planejada.valor * coalesce(oee.oee_pct, 1.0))::bigint
    from com_regra c
    -- Sem horário cadastrado para o turno naquele dia da semana,
    -- a linha nem é gerada: o turno não existe nesse dia.
    join vw_turno_minutos vtm on vtm.turno_id     = c.turno_id
                             and vtm.dia_semana   = c.dia_semana
                             and vtm.tipo_recurso = c.tipo_recurso
                             and vtm.vigencia    @> c.data
    left join paradas pa on pa.recurso_id = c.recurso_id
                        and pa.data       = c.data
                        and pa.turno_id   = c.turno_id
    -- OEE: prefere o específico do turno; senão o geral do recurso
    left join lateral (
        select o.oee_pct from recurso_oee o
         where o.recurso_id = c.recurso_id
           and o.vigencia @> c.data
           and (o.turno_id is null or o.turno_id = c.turno_id)
         order by o.turno_id nulls last
         limit 1
    ) oee on true
    cross join lateral (
        select case
                 when not (c.calendario_ok and c.escala_ok) then 0
                 when coalesce(pa.tem_dia_inteiro, false)   then 0
                 else greatest(0,
                        (vtm.minutos * c.qt_recursos * c.equivalencia)::bigint
                        - coalesce(pa.min_parada_planejada, 0))
               end as valor
    ) planejada;

    update calculo_execucao
       set status = 'OK', concluido_em = now()
     where id = v_execucao_id;

    return v_execucao_id;
end;
$$;

-- =============================================================================
-- COMO RODAR
-- =============================================================================
-- Ano de 2026 para a Confecção:
/*
select fn_calcular_capacidade(
    (select id from cenario where codigo = 'BASELINE'),
    date '2026-01-01',
    date '2026-12-31',
    (select id from area where codigo = 'CONFECCAO')
);
*/
-- Devolve o "execucao_id" daquela rodada. Cada execução cria um conjunto novo;
-- nada é sobrescrito, então dá para comparar antes e depois de uma mudança.


-- =============================================================================
-- CONSULTAS DE CONFERÊNCIA
-- Troque <ID> pelo número devolvido acima.
-- =============================================================================

-- (A) Resumo do ano por recurso, em horas
/*
select r.nome as recurso,
       cal.codigo as calendario,
       round(i.h_inst, 0) as h_instalada,
       round(f.h_plan, 0) as h_planejada,
       round(f.h_disp, 0) as h_disponivel,
       round(f.h_plan / i.h_inst * 100, 1) as pct_do_teto
from recurso r
join recurso_calendario rc on rc.recurso_id = r.id
join calendario cal        on cal.id = rc.calendario_id
join lateral (select sum(min_instalada)/60.0 as h_inst
                from capacidade_instalada_dia where recurso_id = r.id
                 and execucao_id = <ID>) i on true
join lateral (select sum(min_planejada)/60.0  as h_plan,
                     sum(min_disponivel)/60.0 as h_disp
                from capacidade_fato where recurso_id = r.id
                 and execucao_id = <ID>) f on true
order by r.nome;
*/

-- (B) TESTE-CHAVE: em dia útil sem parada, os 3 turnos somam 1440 min.
--     Se der diferente, há erro de cadastro.
/*
select f.data,
       to_char(f.data, 'Dy') as dia,
       sum(f.min_planejada)  as planejada_dia,
       max(i.min_instalada)  as instalada_dia
from capacidade_fato f
join capacidade_instalada_dia i on i.recurso_id  = f.recurso_id
                               and i.data        = f.data
                               and i.execucao_id = f.execucao_id
where f.execucao_id = <ID>
  and f.recurso_id  = (select id from recurso where codigo = 'TEXPA-01')
  and f.data between date '2026-07-01' and date '2026-07-14'
group by f.data order by f.data;
*/

-- (C) Onde os dois calendários divergem no ano
/*
select f.data, to_char(f.data,'Dy') as dia,
       sum(case when r.codigo = 'TEXPA-01' then f.min_planejada end) as rodizio,
       sum(case when r.codigo = 'TEXPA-02' then f.min_planejada end) as padrao
from capacidade_fato f
join recurso r on r.id = f.recurso_id
where f.execucao_id = <ID>
  and r.codigo in ('TEXPA-01','TEXPA-02')
group by f.data
having sum(case when r.codigo = 'TEXPA-01' then f.min_planejada end)
    <> sum(case when r.codigo = 'TEXPA-02' then f.min_planejada end)
order by f.data;
*/
