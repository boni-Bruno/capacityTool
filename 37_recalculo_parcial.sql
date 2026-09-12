-- =============================================================================
-- 37 — RECALCULAR PARCIAL: O MOTOR REGRAVA SÓ ALGUNS RECURSOS DA RODADA
--
-- Recalcular tudo refaz 48 rodadas (6 áreas x 4 anos x 2 origens) e leva uns
-- dois minutos com a aba aberta. Quem trocou o turno de três máquinas não
-- precisa disso — e é assim que o botão deixa de ser apertado, e o painel
-- envelhece. Pedido do Bruno em 11/09/2026: um "Recalcular parcial" que escolhe
-- planta, área, CC, CT, patrimônio, recurso, ano e origem.
--
-- A RODADA CONTINUA SENDO POR (área, ano, origem). Recurso não tem rodada
-- própria, e criar uma nova só com três máquinas apagaria as outras quarenta da
-- área. Então o parcial NÃO cria rodada: ele entra na que existe, apaga as
-- linhas de fato e de instalada daqueles recursos e as regrava. Um motor só —
-- a mesma função, com um filtro de recursos e a rodada alvo como parâmetros —
-- e não uma segunda implementação livre para divergir.
--
-- O QUE ISSO CUSTA, dito com todas as letras: uma rodada passa a poder ter
-- linhas de idades diferentes. O ROADMAP chama isso de "meio recalculado" e diz
-- que é pior que não recalculado — quando acontece SEM ninguém saber. A
-- diferença aqui é que é escolha de quem clicou e fica declarada: `parcial_em`
-- guarda quando a rodada foi mexida pela última vez, e o rodapé do painel diz
-- "calculada em X · recursos recalculados em Y". Recalcular tudo, ou a área
-- inteira, zera a marca — a rodada volta a ter uma idade só.
--
-- Parcial só existe onde há rodada. Sem rodada para aquela (área, ano, origem),
-- ou com a seleção cobrindo a área inteira, o motor faz a rodada cheia de
-- sempre — quem decide é lib/db.js, olhando o que existe.
--
-- A ASSINATURA MUDA, E ISSO PEDE DROP ANTES: `create or replace` com parâmetros
-- novos cria uma SEGUNDA função em vez de substituir — foi assim que a
-- migração 10 deixou uma sobrecarga de 4 argumentos morta no banco, congelada
-- no motor de antes dela (está no ROADMAP como dívida). Aqui as duas antigas
-- saem, e fica uma só: a de 7 argumentos, que com os dois últimos nulos é
-- exatamente a de 5.
--
-- IMPACTO NOS NÚMEROS: nenhum. A conta é a mesma; muda só quais linhas ela
-- escreve quando pedem parcial.
--
-- ORDEM: rode ANTES do deploy do código novo. O código velho chama com 5
-- argumentos e continua casando com a função de 7.
-- =============================================================================

alter table calculo_execucao
    add column if not exists parcial_em timestamptz;

comment on column calculo_execucao.parcial_em is
    'Quando parte dos recursos desta rodada foi recalculada por ultimo. Nulo '
    'quando a rodada tem uma idade so.';

-- As sobrecargas antigas. A de 4 e a divida da migracao 10; a de 5 e a que o
-- app chamava ate aqui. Ficar com uma so e o que impede a proxima migracao de
-- repetir o erro.
drop function if exists fn_calcular_capacidade(int, date, date, int);
drop function if exists fn_calcular_capacidade(int, date, date, int, varchar);

create or replace function fn_calcular_capacidade(
    p_cenario_id  int,
    p_data_inicio date,
    p_data_fim    date,
    p_area_id     int     default null,     -- null = todas as áreas
    p_origem      varchar default 'META',   -- qual OEE usar
    -- Os dois do parcial. Juntos ou nenhum: a rodada alvo e a lista de
    -- recursos que serao regravados nela.
    p_recursos    int[]   default null,
    p_execucao_id bigint  default null
) returns bigint
language plpgsql
as $$
declare
    v_execucao_id bigint;
    v_parcial     boolean := p_execucao_id is not null;
begin
    if p_origem not in ('META', 'SIMULADO') then
        raise exception 'Origem de OEE invalida: %', p_origem;
    end if;
    if v_parcial and (p_recursos is null or cardinality(p_recursos) = 0) then
        raise exception 'Recalculo parcial sem lista de recursos.';
    end if;

    if v_parcial then
        -- A rodada alvo tem que ser a desta area, ano e origem: regravar
        -- recursos de uma area dentro da rodada de outra deixaria linhas orfas
        -- que nenhuma consulta acha e nenhuma substituicao apaga.
        select id into v_execucao_id
          from calculo_execucao
         where id = p_execucao_id
           and status = 'OK'
           and origem = p_origem
           and area_id = p_area_id
           and periodo_inicio = p_data_inicio
           and periodo_fim    = p_data_fim;
        if v_execucao_id is null then
            raise exception 'Rodada % nao e desta area, periodo e origem.', p_execucao_id;
        end if;
    else
        insert into calculo_execucao
            (cenario_id, periodo_inicio, periodo_fim, status, origem)
        values (p_cenario_id, p_data_inicio, p_data_fim, 'RODANDO', p_origem)
        returning id into v_execucao_id;
    end if;

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
        where (p_area_id is null or r.area_id = p_area_id)
          and (p_recursos is null or r.id = any(p_recursos))
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
    -- NO PARCIAL, o que esses recursos tinham na rodada sai antes de entrar o
    -- novo. So eles: o resto da rodada nao e tocado.
    -- =========================================================================
    if v_parcial then
        delete from capacidade_fato
         where execucao_id = v_execucao_id and recurso_id = any(p_recursos);
        delete from capacidade_instalada
         where execucao_id = v_execucao_id and recurso_id = any(p_recursos);
    end if;

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
     where (p_area_id is null or r.area_id = p_area_id)
       and (p_recursos is null or r.id = any(p_recursos));

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

    if v_parcial then
        -- A rodada fica com a data de quando nasceu; o que muda e a marca de
        -- que parte dela e mais nova. E ela que o rodape do painel mostra.
        update calculo_execucao
           set parcial_em = now()
         where id = v_execucao_id;
    else
        update calculo_execucao
           set status = 'OK', concluido_em = now()
         where id = v_execucao_id;
    end if;

    return v_execucao_id;
end;
$$;
