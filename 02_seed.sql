-- =============================================================================
-- FERRAMENTA DE CAPACIDADE  —  02. CADASTRO INICIAL
-- Matriz / Confecção
--
-- Procure por "AJUSTAR" e revise antes de usar para valer.
-- =============================================================================

begin;

-- =============================================================================
-- 1. PLANTA E ÁREA
-- =============================================================================

insert into planta (codigo, nome) values ('MATRIZ', 'Matriz');

insert into area (planta_id, codigo, nome)
select id, 'CONFECCAO', 'Confecção' from planta where codigo = 'MATRIZ';

-- =============================================================================
-- 2. TURNOS
--    1º 05:00-13:30 = 510 min
--    2º 13:30-22:00 = 510 min
--    3º 22:00-05:00 = 420 min (vira a meia-noite)
--    Soma = 1440 min = cobertura de 24 horas
-- =============================================================================

insert into turno (planta_id, codigo, nome)
select p.id, t.codigo, t.nome
from planta p,
(values ('1','1º Turno'), ('2','2º Turno'), ('3','3º Turno')) as t(codigo, nome)
where p.codigo = 'MATRIZ';

-- Horário de cada turno em cada dia da semana.
-- Todos os dias iguais por enquanto. Para mudar o sábado, veja os exemplos no fim.
-- min_bruto fica null de propósito: o banco calcula sozinho.
insert into turno_horario (turno_id, dia_semana, hora_inicio, hora_fim, vigencia)
select t.id, d.dia, h.ini, h.fim, daterange(date '2026-01-01', null, '[)')
from turno t
join planta p on p.id = t.planta_id and p.codigo = 'MATRIZ'
join (values
    ('1', time '05:00', time '13:30'),
    ('2', time '13:30', time '22:00'),
    ('3', time '22:00', time '05:00')
) as h(cod, ini, fim) on h.cod = t.codigo
cross join generate_series(0, 6) as d(dia);

-- Intervalo de refeição: 30 min, só para recurso do tipo PESSOA.
-- Máquina não para para almoçar.
insert into turno_intervalo (turno_id, descricao, minutos, descontavel, aplica_a)
select t.id, 'Refeição', 30, true, 'PESSOA'
from turno t
join planta p on p.id = t.planta_id
where p.codigo = 'MATRIZ';

-- =============================================================================
-- 3. CALENDÁRIOS
--    RODIZIO: domingo a sábado (o recurso nunca para)
--    PADRAO:  segunda a sábado (domingo parado)
-- =============================================================================

insert into calendario (planta_id, codigo, nome, padrao)
select p.id, c.codigo, c.nome, c.padrao
from planta p,
(values
    ('PADRAO',  'Padrão — segunda a sábado', true),
    ('RODIZIO', 'Rodízio — todos os dias',   false)
) as c(codigo, nome, padrao)
where p.codigo = 'MATRIZ';

-- Turnos que rodam em cada dia (0=domingo ... 6=sábado)
insert into calendario_regra (calendario_id, dia_semana, turno_id)
select c.id, d.dia, t.id
from calendario c
join planta p on p.id = c.planta_id
join turno  t on t.planta_id = p.id
cross join (values (1),(2),(3),(4),(5),(6)) as d(dia)
where c.codigo = 'PADRAO';

insert into calendario_regra (calendario_id, dia_semana, turno_id)
select c.id, d.dia, t.id
from calendario c
join planta p on p.id = c.planta_id
join turno  t on t.planta_id = p.id
cross join (values (0),(1),(2),(3),(4),(5),(6)) as d(dia)
where c.codigo = 'RODIZIO';

-- =============================================================================
-- 4. FERIADOS
--    Cadastrados UMA VEZ na planta. Depois marca-se quais calendários param.
--    ***AJUSTAR***: falta acrescentar feriados municipais de Blumenau
--    e estaduais de SC que a fábrica realmente para.
-- =============================================================================

insert into excecao (planta_id, data, tipo, dia_util, descricao)
select p.id, f.data, 'FERIADO', false, f.descricao
from planta p,
(values
    (date '2026-01-01', 'Confraternização Universal'),
    (date '2026-02-16', 'Carnaval'),
    (date '2026-02-17', 'Carnaval'),
    (date '2026-04-03', 'Sexta-feira Santa'),
    (date '2026-04-21', 'Tiradentes'),
    (date '2026-05-01', 'Dia do Trabalho'),
    (date '2026-06-04', 'Corpus Christi'),
    (date '2026-09-07', 'Independência'),
    (date '2026-10-12', 'Nossa Senhora Aparecida'),
    (date '2026-11-02', 'Finados'),
    (date '2026-11-15', 'Proclamação da República'),
    (date '2026-12-25', 'Natal')
) as f(data, descricao)
where p.codigo = 'MATRIZ';

-- O calendário PADRÃO observa TODOS os feriados.
insert into excecao_calendario (excecao_id, calendario_id)
select e.id, c.id
from excecao e
join calendario c on c.planta_id = e.planta_id
where c.codigo = 'PADRAO';

-- O calendário RODÍZIO observa só alguns.
-- ***AJUSTAR***: hoje só 1º de janeiro, Sexta-feira Santa e Natal.
insert into excecao_calendario (excecao_id, calendario_id)
select e.id, c.id
from excecao e
join calendario c on c.planta_id = e.planta_id
where c.codigo = 'RODIZIO'
  and e.data in (date '2026-01-01', date '2026-04-03', date '2026-12-25');

-- =============================================================================
-- 5. MÁQUINAS E RECURSOS
-- =============================================================================

insert into maquina_fisica (planta_id, codigo, nome)
select p.id, m.codigo, m.nome
from planta p,
(values
    ('TEXPA-01',     'Texpa 01'),
    ('TEXPA-02',     'Texpa 02'),
    ('AUTOMATEX-01', 'Automatex 01'),
    ('AUTOMATEX-02', 'Automatex 02'),
    ('AUTOMATEX-03', 'Automatex 03'),
    ('SCHMALLE-01',  'Schmalle 01'),
    ('SCHMALLE-02',  'Schmalle 02'),
    ('SCHMALLE-03',  'Schmalle 03')
) as m(codigo, nome)
where p.codigo = 'MATRIZ';

insert into recurso (maquina_fisica_id, area_id, codigo, nome, tipo_recurso)
select mf.id, a.id, mf.codigo, mf.nome, 'MAQUINA'
from maquina_fisica mf
join planta p on p.id = mf.planta_id and p.codigo = 'MATRIZ'
join area   a on a.planta_id = p.id  and a.codigo = 'CONFECCAO';

-- =============================================================================
-- 6. PARÂMETROS DOS RECURSOS
-- =============================================================================

-- Equivalência 1, quantidade 1, vigência aberta
insert into recurso_parametro (recurso_id, vigencia, equivalencia, qt_recursos)
select r.id, daterange(date '2026-01-01', null, '[)'), 1.0, 1
from recurso r join area a on a.id = r.area_id
where a.codigo = 'CONFECCAO';

-- Calendário: só a TEXPA-01 é rodízio; as outras 7 são padrão.
insert into recurso_calendario (recurso_id, calendario_id, vigencia)
select r.id,
       (select c.id from calendario c
         where c.codigo = case when r.codigo = 'TEXPA-01' then 'RODIZIO' else 'PADRAO' end),
       daterange(date '2026-01-01', null, '[)')
from recurso r join area a on a.id = r.area_id
where a.codigo = 'CONFECCAO';

-- Os 3 turnos para todos os recursos.
-- escala_id fica NULL: o rodízio da empresa é das pessoas, não do recurso.
-- A máquina não para, então quem se reveza na frente dela não afeta a capacidade.
insert into recurso_turno (recurso_id, turno_id, vigencia)
select r.id, t.id, daterange(date '2026-01-01', null, '[)')
from recurso r
join area   a on a.id = r.area_id and a.codigo = 'CONFECCAO'
join planta p on p.id = a.planta_id
join turno  t on t.planta_id = p.id;

-- OEE  ***AJUSTAR***: 0.85 é chute. 85% se escreve 0.85.
insert into recurso_oee (recurso_id, vigencia, origem, oee_pct)
select r.id, daterange(date '2026-01-01', null, '[)'), 'META', 0.85
from recurso r join area a on a.id = r.area_id
where a.codigo = 'CONFECCAO';

-- =============================================================================
-- 7. TIPOS DE PARADA
--    Setup não entra: já está no OEE.
-- =============================================================================

insert into tipo_parada (codigo, nome, planejada, abate_planejada, abate_disponivel, cor) values
    ('MANUT_PREVENTIVA',    'Manutenção preventiva', true, true, true, '#2a78d6'),
    ('MANUT_PREDITIVA',     'Manutenção preditiva',  true, true, true, '#1baf7a'),
    ('FERIAS_COLETIVAS',    'Férias coletivas',      true, true, true, '#e87ba4'),
    ('PARADA_INVESTIMENTO', 'Parada para obra',      true, true, true, '#eb6834'),
    ('INVENTARIO',          'Inventário',            true, true, true, '#eda100');

-- =============================================================================
-- 8. CENÁRIO E CALENDÁRIO AUXILIAR
-- =============================================================================

insert into cenario (codigo, nome, descricao, baseline)
values ('BASELINE', 'Baseline', 'Cenário oficial, espelha o cadastro real', true);

insert into dim_data (data, ano, mes, dia, dia_semana, semana_iso, mes_ano, trimestre)
select d::date,
       extract(year from d)::smallint, extract(month from d)::smallint,
       extract(day  from d)::smallint, extract(dow   from d)::smallint,
       extract(week from d)::smallint, to_char(d, 'YYYY-MM'),
       extract(quarter from d)::smallint
from generate_series(date '2026-01-01', date '2027-12-31', interval '1 day') as d;

commit;

-- =============================================================================
-- EXEMPLOS PARA DEPOIS (não rode sem querer)
-- =============================================================================

-- Sábado o 1º turno vai só até 11:00:
/*
update turno_horario set hora_fim = time '11:00', min_bruto = null
 where turno_id = (select t.id from turno t join planta p on p.id=t.planta_id
                    where t.codigo='1' and p.codigo='MATRIZ')
   and dia_semana = 6;
*/

-- Fazer o rodízio parar também no Carnaval:
/*
insert into excecao_calendario (excecao_id, calendario_id)
select e.id, c.id from excecao e, calendario c
 where e.data in (date '2026-02-16', date '2026-02-17')
   and c.codigo = 'RODIZIO';
*/

-- Preventiva de 4h na Texpa 02, no 1º turno, dia 20/07:
/*
insert into parada (recurso_id, tipo_parada_id, data_inicio, data_fim, turno_id, minutos, descricao)
select (select id from recurso where codigo='TEXPA-02'),
       (select id from tipo_parada where codigo='MANUT_PREVENTIVA'),
       date '2026-07-20', date '2026-07-20',
       (select t.id from turno t join planta p on p.id=t.planta_id
         where t.codigo='1' and p.codigo='MATRIZ'),
       240, 'Preventiva trimestral';
*/
