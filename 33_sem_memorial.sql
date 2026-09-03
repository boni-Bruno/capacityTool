-- =============================================================================
-- 33 — O MOTOR PARA DE GRAVAR O MEMORIAL
--
-- O banco nao cabe mais no Neon: 480 MB de 512, com 172 MB ainda por inserir.
-- A causa nao e desperdicio nem vazamento — e a Tecelagem. Os 173 recursos
-- dela nao tinham turno cadastrado, entao nao geravam calculo nenhum; uma
-- rodada que ocupava 4.695 linhas passou a ocupar 125.499 no dia em que o
-- cadastro em lote encheu a area. A fabrica entrou no banco, e o banco nao
-- comporta.
--
-- Das duas tabelas que o motor escreve, uma e resultado e a outra e explicacao:
--
--   capacidade_fato    quantos minutos aquele recurso teve. O painel, a
--                      ocupacao e a extracao leem DAQUI. Nao sai.
--   capacidade_memoria de quanto para quanto foi em cada etapa e por que.
--                      Nenhum numero depende dela. Sai.
--
-- O memorial projetado eram 229 MB — 44% do limite inteiro — para uma tela que
-- explica UM recurso em UM dia. Foi a escolha do Bruno, com a conta na mao.
--
-- O QUE SE PERDE, dito sem maquiagem: a resposta gravada para "por que esse dia
-- deu X minutos". A cadeia continua reconstruivel do cadastro, mas reconstruir
-- e escrever a mesma regra uma segunda vez, e duas implementacoes divergem —
-- foi por isso que o memorial existiu. A tela do painel ja sabe viver sem ele.
--
-- O QUE NAO SE PERDE, e vale dizer porque a pergunta apareceu: calcular no
-- MOTOR continua necessario, e nao era o memorial que justificava isso. As
-- razoes sao outras tres, e nenhuma depende dele — volume (800 mil linhas de
-- recurso x dia x turno nao sao conta de tela), um lugar so decidindo (tres
-- telas lendo a mesma capacidade_fato nao podem divergir) e estabilidade
-- (recalcular e um botao de proposito, para o numero nao mudar debaixo de quem
-- esta lendo).
--
-- E REVERSIVEL. A tabela fica, vazia. O dia que couber, basta devolver o insert
-- e rodar Recalcular tudo: o memorial volta inteiro, porque ele sempre foi
-- derivado e nunca guardou decisao nenhuma.
--
-- DEPOIS DE RODAR: truncate capacidade_memoria, e Recalcular tudo.
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


    update calculo_execucao
       set status = 'OK', concluido_em = now()
     where id = v_execucao_id;

    return v_execucao_id;
end;
$$;
