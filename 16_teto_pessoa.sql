-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 16. TETO DE PESSOA É A PRÓPRIA PLANEJADA
--
-- A instalada era 1440 x qt_recursos x equivalencia para todo mundo: 24 h por
-- dia, todo dia. Para máquina é o certo e é o ponto — a máquina existe no
-- feriado, e é isso que faz o "% do teto" mostrar ociosidade de verdade.
--
-- Para pessoa não existe esse teto. Ninguém trabalha 24 h, então 5 pessoas x
-- 1.440 min é um número que não existe em lugar nenhum, e ele deixava o
-- "% do teto" de qualquer recurso de pessoa artificialmente baixo, sempre.
--
-- O teto da máquina é físico; o da pessoa é contratual. E o contrato é o turno
-- escalado, que já está na planejada — com feriado zerado pelo calendário e
-- parada descontada. Então, para PESSOA, instalada = planejada.
--
-- CONSEQUÊNCIAS, aceitas de propósito:
--   . para pessoa o "% do teto" fica 100% fixo;
--   . o indicador "disponível sobre teto" de uma seleção só de pessoas vira o
--     próprio OEE, que já aparece escrito ao lado;
--   . em área mista, a parcela de pessoas entra em cima e embaixo da razão e
--     puxa o resultado para 100%. É bem menos distorção do que o 1440 x qt
--     puxando para baixo, e o filtro de tipo do painel ("só máquina") isola o
--     número físico quando se quer ele limpo.
--
-- Nada disso muda planejada ou disponível: a instalada não é lida pela cadeia
-- de cálculo em momento nenhum, só por indicador de leitura.
--
-- ESTRUTURA: o bloco da INSTALADA passou a rodar DEPOIS do tmp_calc, porque
-- agora depende da planejada. Nenhuma outra conta mudou de lugar.
--
-- ORDEM: rode ANTES do deploy do código novo. Depois, Recalcular.
-- =============================================================================

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
    -- Guarda cada valor intermediário da cadeia, para o fato e o memorial
    -- lerem exatamente os mesmos números.
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
           coalesce(oee.oee_pct, 1.0)                 as oee_pct,
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
    -- INSTALADA — grão recurso x dia
    --
    -- MAQUINA: teto fisico. 24h por dia, todo dia, sem olhar calendario, turno
    -- nem parada. A maquina existe no feriado, e e isso que faz o "% do teto"
    -- mostrar ociosidade de verdade.
    --
    -- PESSOA: o teto e a propria planejada. Ninguem trabalha 24h, entao
    -- 1440 x quantidade era um numero que nao existe em lugar nenhum, e ele
    -- deixava o "% do teto" de todo recurso de pessoa artificialmente baixo. O
    -- teto da maquina e fisico; o da pessoa e contratual, e o contrato e o
    -- turno escalado — que ja esta na planejada, com feriado e parada
    -- descontados.
    --
    -- CONSEQUENCIA ACEITA: para pessoa o "% do teto" fica 100% fixo, e o
    -- indicador de disponivel sobre teto vira o proprio OEE. Numa area que
    -- mistura os dois, a parte de pessoas entra no numerador e no denominador
    -- e puxa a razao para 100% — menos do que o 1440 x qt puxava para baixo,
    -- e o filtro de tipo do painel isola quando se quer o numero fisico limpo.
    --
    -- Por isso este bloco roda DEPOIS do tmp_calc: ele precisa da planejada.
    -- =========================================================================
    insert into capacidade_instalada_dia
        (execucao_id, recurso_id, planta_id, area_id, data,
         qt_recursos, equivalencia, min_instalada)
    with planejada_dia as (
        -- Agrupa numa passada so. Subconsulta correlacionada por recurso e dia
        -- varreria a tmp_calc inteira uma vez por linha do calendario.
        select recurso_id, data, sum(v_planejada) as minutos
          from tmp_calc
         group by recurso_id, data
    )
    select v_execucao_id, r.id, a.planta_id, r.area_id, d.data,
           rp.qt_recursos, rp.equivalencia,
           case when r.tipo_recurso = 'PESSOA'
                -- Sem linha em tmp_calc = nenhum turno escalado = teto zero.
                then coalesce(pd.minutos, 0)
                else (1440 * rp.qt_recursos * rp.equivalencia)::numeric
           end
    from (select g::date as data
            from generate_series(p_data_inicio, p_data_fim, interval '1 day') g
         ) d
    join recurso r            on true
    join area a               on a.id = r.area_id
    -- Nao exige status_cadastro, de proposito: recurso desativado continua
    -- ocupando o teto. A maquina existe e esta em condicoes de operar; o que
    -- se decidiu foi nao usa-la. Escondendo o teto, a ociosidade escolhida
    -- desaparecia do painel em vez de aparecer. A vigencia continua valendo:
    -- maquina que ainda nao chegou nao tem teto nenhum.
    join recurso_parametro rp on rp.recurso_id = r.id
                             and rp.vigencia @> d.data
    left join planejada_dia pd on pd.recurso_id = r.id
                              and pd.data       = d.data
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

    -- =========================================================================
    -- MEMORIAL
    -- Só as etapas com delta <> 0, mais o ponto de partida. Etapa que não
    -- mudou nada não explica nada, e explicar é o propósito da tabela.
    -- =========================================================================
    insert into capacidade_memoria
        (execucao_id, recurso_id, data, turno_id, ordem, etapa,
         minutos_antes, minutos_delta, minutos_depois, origem_tabela, descricao)
    select v_execucao_id, recurso_id, data, turno_id, ordem, etapa,
           antes, depois - antes, depois, origem_tabela, descricao
      from (
        select recurso_id, data, turno_id,
               1::smallint as ordem, 'TURNO' as etapa,
               0::numeric as antes, v_bruto as depois,
               'turno_horario' as origem_tabela,
               'Duracao bruta do turno neste dia da semana' as descricao
          from tmp_calc

        union all
        select recurso_id, data, turno_id, 2, 'INTERVALO',
               v_bruto, v_liquido, 'turno_intervalo',
               'Intervalo descontado para recurso do tipo informado'
          from tmp_calc

        union all
        select recurso_id, data, turno_id, 3, 'QUANTIDADE',
               v_liquido, v_quantidade, 'recurso_parametro',
               'Multiplicado por ' || qt_recursos || ' recurso(s) e equivalencia '
                 || equivalencia
          from tmp_calc

        union all
        select recurso_id, data, turno_id, 4, 'CALENDARIO',
               v_quantidade, v_calendario, 'calendario_dia/excecao',
               'Dia nao util neste calendario: feriado, parada coletiva ou dia '
                 || 'sem turno'
          from tmp_calc

        union all
        select recurso_id, data, turno_id, 5, 'PARADA_DIA',
               v_calendario, v_parada_dia, 'parada',
               coalesce('Parada de dia inteiro: ' || nomes_parada,
                        'Parada de dia inteiro')
          from tmp_calc

        union all
        select recurso_id, data, turno_id, 6, 'PARADA',
               v_parada_dia, v_planejada, 'parada',
               coalesce('Parada planejada: ' || nomes_parada, 'Parada planejada')
          from tmp_calc

        union all
        select recurso_id, data, turno_id, 7, 'OEE',
               v_planejada, v_disponivel, 'recurso_oee',
               'OEE ' || round(oee_pct * 100, 1) || '% (' || p_origem || ')'
          from tmp_calc
      ) etapas
     -- O primeiro degrau entra sempre: sem ele a cadeia comeca do nada.
     where ordem = 1 or depois <> antes;

    update calculo_execucao
       set status = 'OK', concluido_em = now()
     where id = v_execucao_id;

    return v_execucao_id;
end;
$$;
