-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 17. INTERVALO POR DIA DA SEMANA
--
-- turno_intervalo valia para o turno inteiro: uma linha de "Refeição, 30 min,
-- PESSOA" descontava 30 minutos em TODOS os dias em que o turno roda. Sábado
-- de meio período levava o mesmo desconto do dia cheio, o que não existe na
-- prática, e não havia como corrigir sem tirar o intervalo da semana toda.
--
-- A tabela ganha dia_semana. As linhas existentes viram sete, uma por dia, com
-- os mesmos minutos — o comportamento não muda em nada até alguém editar. É de
-- propósito que a coluna termina NOT NULL: "nulo = todos os dias" convivendo
-- com linha por dia daria duas maneiras de dizer a mesma coisa, e some com a
-- pergunta "o que ganha, a regra geral ou a do sábado?".
--
-- A view soma só os intervalos DAQUELE dia. O motor não muda: ele lê a view.
--
-- IMPACTO NOS NÚMEROS: nenhum. Sete linhas de 30 min descontam o mesmo que uma
-- linha de 30 min valendo para os sete dias.
--
-- ORDEM: rode ANTES do deploy do código novo.
-- =============================================================================

alter table turno_intervalo
    add column if not exists dia_semana smallint;

-- Expande cada linha atual em sete. O SELECT enxerga o estado do começo do
-- comando, então as linhas recém-inseridas não se multiplicam sozinhas.
insert into turno_intervalo
       (turno_id, dia_semana, descricao, minutos, descontavel, aplica_a)
select ti.turno_id, d.dia_semana, ti.descricao, ti.minutos,
       ti.descontavel, ti.aplica_a
  from turno_intervalo ti
 cross join generate_series(0, 6) as d(dia_semana)
 where ti.dia_semana is null;

delete from turno_intervalo where dia_semana is null;

alter table turno_intervalo
    alter column dia_semana set not null;

alter table turno_intervalo
    drop constraint if exists ti_dia_valido;
alter table turno_intervalo
    add constraint ti_dia_valido check (dia_semana between 0 and 6);

create index if not exists ix_ti_turno_dia
    on turno_intervalo (turno_id, dia_semana);

-- =============================================================================
-- A VIEW passa a casar o dia, e não só o turno.
--
-- Mesmas colunas e mesmos tipos de antes, então o create or replace basta e
-- nada que depende dela precisa ser recriado.
-- =============================================================================
create or replace view vw_turno_minutos as
select th.turno_id,
       th.dia_semana,
       th.vigencia,
       tr.tipo_recurso,
       th.min_bruto as duracao_turno,
       th.min_bruto - coalesce(sum(i.minutos) filter (
           where i.descontavel
             and (i.aplica_a = 'AMBOS' or i.aplica_a = tr.tipo_recurso)
       ), 0) as minutos
from turno_horario th
cross join (values ('MAQUINA'), ('PESSOA')) as tr(tipo_recurso)
left join turno_intervalo i on i.turno_id   = th.turno_id
                           and i.dia_semana = th.dia_semana
group by th.turno_id, th.dia_semana, th.vigencia, tr.tipo_recurso, th.min_bruto;
