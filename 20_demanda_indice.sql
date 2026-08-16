-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 20. O ÍNDICE DE CONVERSÃO
--
-- É o que transforma capacidade em minutos em capacidade em metro. Uma view, e
-- não uma tabela: ela é derivada da carga, e materializar significaria um
-- segundo lugar guardando a mesma verdade, livre para divergir da base.
--
-- A CONTA
--
--   índice(ct, mês) = Σ quantidade  ÷  Σ minutos
--
-- Somar na cabeça do CT e do mês resolve o mix sozinho: cada material entra
-- ponderado pela quantidade que a demanda pede. É a média harmônica ponderada,
-- e é o único jeito certo.
--
-- Ponderar as taxas pela participação em QUANTIDADE, que é o erro natural,
-- infla a capacidade — o produto lento ocupa mais tempo do que a participação
-- em quantidade sugere. Com 1.000 unidades de A a 100/h e 1.000 de B a 50/h, a
-- média por quantidade dá 75/h e a realidade é 66,7. Aqui a divisão de somas
-- faz a ponderação certa sem ninguém precisar lembrar disso.
--
-- DUAS QUANTIDADES, DOIS ÍNDICES
--
--   qtd_por_min      na UM do material (peça, jogo, metro de produto)
--   metros_por_min   em metro de tecelagem — a régua comum da fábrica
--
-- Os dois saem da mesma soma e são paralelos, não encadeados.
--
-- A UNIDADE FÍSICA sai do próprio material: CT que só produz item medido em KG
-- é fiação, e fio não tem metro de tecelagem. São 30 dos 123 CTs.
--
-- Linha sem CT ou sem duração fica de fora: sem tempo não há o que converter, e
-- sem CT não há em que recurso pendurar.
--
-- ORDEM: rode ANTES do deploy do código novo.
-- =============================================================================

create or replace view vw_demanda_indice as
select l.carga_id,
       l.ct,
       date_trunc('month', l.periodo_data)::date          as mes,
       sum(l.duracao_min)                                 as minutos,
       sum(l.qtd)                                         as qtd,
       sum(l.qtd_metros_kg)                               as metros_kg,
       sum(l.qtd)           / sum(l.duracao_min)          as qtd_por_min,
       sum(l.qtd_metros_kg) / sum(l.duracao_min)          as metros_por_min,
       case when bool_and(l.um = 'KG') then 'KG' else 'M' end as unidade
  from demanda_linha l
 where l.ct is not null
   and l.duracao_min > 0
 group by l.carga_id, l.ct, date_trunc('month', l.periodo_data);

comment on view vw_demanda_indice is
    'Indice de conversao por CT e mes: soma de quantidade dividida por soma de '
    'minutos. Media harmonica ponderada — ponderar taxa por quantidade infla a '
    'capacidade.';

-- O caminho de leitura junta capacidade e demanda por (ct, mes), e o join sai
-- do cc-ct da propria maquina fisica — sem tabela de-para.
create index if not exists ix_dl_indice
    on demanda_linha (carga_id, ct, periodo_data)
 where ct is not null and duracao_min > 0;
