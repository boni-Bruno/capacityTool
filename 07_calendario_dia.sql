-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 07. CALENDÁRIO PASSA A GUARDAR SÓ DIAS
--
-- calendario_regra guardava calendário x dia x turno. A coluna turno_id
-- duplicava o que turno_horario já diz: se o turno não tem horário naquele dia
-- da semana, ele não roda, ponto. A única coisa que a coluna comprava era
-- "domingo roda só o 1º turno" — caso que não existe nesta operação.
--
-- O custo da duplicação não era teórico: turno criado depois do seed nascia
-- fora dos calendários e produzia zero em silêncio, mesmo com horário
-- cadastrado e marcado no recurso.
--
-- Agora o calendário responde só "esta linha trabalha neste dia da semana?".
-- Quais turnos rodam vem de turno_horario (o turno tem horário nesse dia?)
-- cruzado com recurso_turno (a máquina faz esse turno?).
--
-- IMPACTO NOS NÚMEROS: nenhum. A consulta de impacto — combinações em que o
-- calendário trabalha o dia, o turno tem horário e a regra o excluía — voltou
-- zero linhas antes desta migração.
--
-- ORDEM: rode este arquivo ANTES do deploy do código novo. calendario_regra
-- continua existindo aqui, então a versão que está no ar segue funcionando
-- enquanto o deploy não sobe.
-- =============================================================================

create table if not exists calendario_dia (
    calendario_id int      not null references calendario(id) on delete cascade,
    dia_semana    smallint not null check (dia_semana between 0 and 6),
    primary key (calendario_id, dia_semana)
);

comment on table calendario_dia is
    'Em que dias da semana a linha trabalha. Quais turnos rodam vem de turno_horario.';

-- Herda o que já estava configurado: dia com qualquer turno marcado vira dia
-- trabalhado.
insert into calendario_dia (calendario_id, dia_semana)
select distinct calendario_id, dia_semana from calendario_regra
on conflict do nothing;


-- =============================================================================
-- MOTOR
-- Só o terceiro nível do coalesce muda: em vez de perguntar se aquele turno
-- está marcado naquele dia, pergunta se o calendário trabalha naquele dia.
-- O resto da função é idêntico.
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
               -- A exceção só vale se o calendário do recurso a observar.
               --
               -- O nível 3 não olha turno: quais turnos rodam já está decidido
               -- por turno_horario (sem horário no dia, a linha nem é gerada)
               -- e por recurso_turno (a máquina faz aquele turno?).
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


-- -----------------------------------------------------------------------------
-- DEPOIS — só quando o deploy do código novo estiver no ar e conferido.
-- Enquanto calendario_regra existir, nada quebra; ela apenas deixa de ser lida.
--
--     drop table calendario_regra;
-- -----------------------------------------------------------------------------
