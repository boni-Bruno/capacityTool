-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 21. DE ONDE O CT TIRA O ÍNDICE
--
-- Nem todo CT tem demanda própria, e isso não é falha do dado: o roteiro
-- escolhe uma máquina entre irmãs, e a que não foi escolhida fica sem carga.
-- Ela continua existindo e continua tendo capacidade — só não tem em que taxa
-- converter essa capacidade.
--
-- Esta tabela diz de onde ela pega a taxa emprestada.
--
--   CT       de um CT irmão especifico, que pode ser de outro CC
--   CC       da media do CC inteiro
--   NENHUM   de lugar nenhum, e isso e uma decisao registrada
--
-- NENHUM existe para tirar o CT da fila sem inventar numero. Sem ele, um CT que
-- realmente nao produz ficaria para sempre na lista do que falta resolver.
--
-- ELA EMPRESTA O ÍNDICE, NUNCA A DEMANDA. O CT que herda continua sem carga
-- propria: se um dia a comparacao de capacidade contra demanda for construida,
-- somar a demanda do irmao aqui dobraria a carga da fabrica.
--
-- A REGRA GANHA DA DEMANDA PROPRIA, por decisao. Uma vez cadastrada, ela vale
-- sempre, mesmo nos meses em que o CT tiver carga propria — a heranca descreve
-- como o fluxo funciona, e fluxo nao muda de mes para mes. O caso em que os
-- dois existem aparece na tela de conferencia, para poder ser revisto.
--
-- O CC NAO PRECISA SER EXTRAIDO. Ele e o primeiro segmento do proprio CT:
-- 515-004 mora no CC 515. Do lado da capacidade ele ja existe separado, em
-- maquina_fisica.cc.
--
-- CUIDADO COM A MEDIA DE CC: ela esconde dispersao. No CC 401 os irmaos vao de
-- 36,1 a 149,5 m/h e a media da 59,7 — usar isso e chute com cara de numero. A
-- tela mostra a dispersao na hora de escolher; a preferencia e sempre o CT
-- irmao especifico.
--
-- ORDEM: rode ANTES do deploy do código novo.
-- =============================================================================

create table if not exists demanda_ct_origem (
    ct         varchar(20) primary key,
    tipo       varchar(10) not null check (tipo in ('CT', 'CC', 'NENHUM')),
    -- O CT irmao ou o CC. Nulo quando tipo e NENHUM.
    valor      varchar(20),
    observacao varchar(200),
    criado_em  timestamptz not null default now(),

    constraint dco_valor_coerente
        check ((tipo = 'NENHUM' and valor is null)
            or (tipo <> 'NENHUM' and valor is not null)),
    -- CT nao pode herdar de si mesmo: a regra ganha da demanda propria, entao
    -- isso seria uma referencia circular de um passo.
    constraint dco_sem_auto
        check (tipo <> 'CT' or valor <> ct)
);

comment on table demanda_ct_origem is
    'De onde cada CT sem demanda propria tira o indice de conversao. Empresta '
    'a taxa, nunca a carga.';

-- =============================================================================
-- O ÍNDICE EFETIVO
--
-- O que as consultas do painel passam a ler. Tres origens, sem sobreposicao:
-- a regra de CT, a regra de CC, e o proprio — este ultimo so quando nao ha
-- regra, que e o que faz a regra ganhar da demanda propria.
--
-- `origem` viaja junto porque numero emprestado tem que dizer de onde veio.
-- =============================================================================
create or replace view vw_demanda_indice_efetivo as
with cc as (
    select i.carga_id,
           split_part(i.ct, '-', 1)                     as cc,
           i.mes,
           sum(i.minutos)                               as minutos,
           sum(i.qtd)       / sum(i.minutos)            as qtd_por_min,
           sum(i.metros_kg) / sum(i.minutos)            as metros_por_min,
           case when bool_and(i.unidade = 'KG') then 'KG' else 'M' end as unidade
      from vw_demanda_indice i
     group by i.carga_id, split_part(i.ct, '-', 1), i.mes
)
select o.ct,
       i.carga_id, i.mes, i.qtd_por_min, i.metros_por_min, i.unidade,
       'CT ' || o.valor as origem
  from demanda_ct_origem o
  join vw_demanda_indice i on i.ct = o.valor
 where o.tipo = 'CT'

union all

select o.ct,
       c.carga_id, c.mes, c.qtd_por_min, c.metros_por_min, c.unidade,
       'CC ' || o.valor as origem
  from demanda_ct_origem o
  join cc c on c.cc = o.valor
 where o.tipo = 'CC'

union all

select i.ct,
       i.carga_id, i.mes, i.qtd_por_min, i.metros_por_min, i.unidade,
       'própria' as origem
  from vw_demanda_indice i
 where not exists (select 1 from demanda_ct_origem o
                    where o.ct = i.ct and o.tipo in ('CT', 'CC'));

comment on view vw_demanda_indice_efetivo is
    'Indice que o painel usa: proprio, ou emprestado de um CT irmao ou do CC. '
    'A coluna origem diz qual dos tres.';
