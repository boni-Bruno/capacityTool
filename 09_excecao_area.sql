-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 09. EXCEÇÃO POR ÁREA
--
-- A exceção passa a ter dois filtros, que respondem coisas diferentes:
--
--   ÁREA       onde o feriado vale — a Confecção para, a Tecelagem não
--   CALENDÁRIO qual regime para    — o padrão para, o rodízio trabalha
--
-- O segundo já existia e continua: o contexto.txt lista como decisão
-- deliberada que "um feriado que a linha de rodízio trabalha e a linha padrão
-- para é uma data com uma marcação". O primeiro é novo.
--
-- Não existe herança de "área usa o calendário da planta": no cadastro todas
-- as áreas vêm marcadas. Área marcada segue a planta; desmarcar é o que a
-- torna diferente. Herança seria uma tabela a mais para dizer o que o padrão
-- já diz.
--
-- IMPACTO NOS NÚMEROS: nenhum, por construção — o backfill liga cada exceção
-- a TODAS as áreas da planta dela, que é exatamente o alcance de hoje.
--
-- Antes de rodar, confira que a consulta de impacto volta zero linhas: ela
-- acha exceção marcada num calendário de OUTRA planta, caso que hoje vale
-- (o motor não confere planta) e depois desta mudança deixaria de valer.
--
-- ORDEM: rode ANTES do deploy do código novo.
-- =============================================================================

create table if not exists excecao_area (
    excecao_id int not null references excecao(id) on delete cascade,
    area_id    int not null references area(id)    on delete cascade,
    primary key (excecao_id, area_id)
);

comment on table excecao_area is
    'Em que areas a excecao vale. Sem linha nenhuma, a excecao nao alcanca ninguem.';

-- Backfill: o que já existe passa a valer em todas as áreas da planta dele.
insert into excecao_area (excecao_id, area_id)
select e.id, a.id
  from excecao e
  join area a on a.planta_id = e.planta_id
on conflict do nothing;


-- =============================================================================
-- MOTOR
-- Os dois níveis de exceção ganham a mesma condição de área. O resto da função
-- é idêntico.
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
               --   3. o calendário trabalha nesse dia da semana
               --
               -- A exceção só vale quando as DUAS marcações batem: a área do
               -- recurso está na lista, e o calendário dele também. Uma diz
               -- onde o feriado vale, a outra qual regime para.
               coalesce(
                   (select ex.dia_util
                      from excecao ex
                      join excecao_calendario ec on ec.excecao_id = ex.id
                      join excecao_area ea       on ea.excecao_id = ex.id
                     where ec.calendario_id = b.calendario_id
                       and ea.area_id       = b.area_id
                       and ex.data     = b.data
                       and ex.turno_id = b.turno_id
                     limit 1),
                   (select ex.dia_util
                      from excecao ex
                      join excecao_calendario ec on ec.excecao_id = ex.id
                      join excecao_area ea       on ea.excecao_id = ex.id
                     where ec.calendario_id = b.calendario_id
                       and ea.area_id       = b.area_id
                       and ex.data = b.data
                       and ex.turno_id is null
                     limit 1),
                   exists (select 1 from calendario_dia cd
                            where cd.calendario_id = b.calendario_id
                              and cd.dia_semana    = b.dia_semana)
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
