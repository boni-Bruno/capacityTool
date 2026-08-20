-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 26. SÓ A RODADA CORRENTE FICA
--
-- O sistema mostra a capacidade ATUAL. Rodada antiga nao e consultada por
-- ninguem, e cada Recalcular gravava um conjunto completo novo sem apagar o
-- anterior: recurso x dia na instalada, recurso x dia x turno no fato, e umas
-- quatro linhas de memorial para cada linha de fato. Com o botao passando a
-- refazer tudo de uma vez, uma pressao criava areas x anos x 2 rodadas.
--
-- A partir daqui vale UMA rodada por (area, ano, origem). A nova substitui a
-- anterior, e o banco para de crescer.
--
-- A CHAVE DA SUBSTITUICAO PRECISA EXISTIR. `calculo_execucao` nao guardava de
-- que area a rodada era — a area so aparecia nas linhas de resultado, e
-- descobri-la exigia varrer a maior tabela do banco. Por isso a coluna entra
-- aqui: ela e o que permite trocar a rodada e, de quebra, torna barata a
-- pergunta "qual a ultima rodada desta area neste ano?", que o painel faz em
-- toda abertura.
--
-- ORDEM: rode ANTES do deploy do codigo novo. As duas partes sao seguras de
-- repetir.
-- =============================================================================

-- ---- 1. a rodada passa a saber de que area ela e ---------------------------

alter table calculo_execucao
    add column if not exists area_id int references area(id);

comment on column calculo_execucao.area_id is
    'A area desta rodada. Null so em rodada antiga que nao gerou linha nenhuma.';

-- Backfill: a area vem das proprias linhas que a rodada gerou.
update calculo_execucao e
   set area_id = i.area_id
  from (select distinct execucao_id, area_id from capacidade_instalada_dia) i
 where i.execucao_id = e.id
   and e.area_id is null;

-- A chave da substituicao, e o indice que o painel usa para achar a rodada.
create index if not exists ix_execucao_area_periodo
    on calculo_execucao (area_id, origem, periodo_inicio, id desc);

-- ---- 2. a poda de uma vez --------------------------------------------------
--
-- Guarda a rodada OK mais recente de cada (area, periodo, origem) e apaga o
-- resto — inclusive as que ficaram em RODANDO ou ERRO, e as antigas que nao
-- geraram linha nenhuma (sem area para backfill, elas nao guardam nada).
--
-- O `on delete cascade` das tres tabelas de resultado faz a limpeza sozinho:
-- apagar a linha da rodada leva instalada, fato e memorial junto.
--
-- CONFIRA ANTES, se quiser ver o tamanho do estrago:
--
--     select count(*) as rodadas_hoje,
--            (select count(*) from capacidade_memoria) as memorial,
--            (select count(*) from capacidade_fato)    as fato
--       from calculo_execucao;

delete from calculo_execucao e
 where e.id not in (
     select distinct on (area_id, periodo_inicio, origem) id
       from calculo_execucao
      where status = 'OK' and area_id is not null
      order by area_id, periodo_inicio, origem, id desc
 );

-- ---- 3. devolver o espaco ao disco -----------------------------------------
--
-- RODE ESTAS TRES LINHAS SOZINHAS, uma de cada vez e sem mais nada
-- selecionado: VACUUM nao roda dentro de transacao, e o editor do Neon envolve
-- em transacao tudo que voce mandar de uma vez.
--
-- Sem isto as linhas saem da tabela mas o arquivo continua do tamanho de
-- antes — o espaco fica reservado para reuso, e a fatura nao percebe a
-- diferenca.
--
--     vacuum full capacidade_memoria;
--     vacuum full capacidade_fato;
--     vacuum full capacidade_instalada_dia;

-- ---- ALTERNATIVA, se a poda demorar demais ---------------------------------
--
-- Com milhoes de linhas de memorial, o delete acima pode se arrastar. O
-- caminho rapido e zerar tudo e mandar Recalcular tudo no painel, que refaz em
-- minutos — o que nao existe mais e so o que ia ser apagado mesmo:
--
--     truncate capacidade_memoria, capacidade_fato,
--              capacidade_instalada_dia, calculo_execucao restart identity;
--
-- E um OU o outro, nunca os dois. E o painel fica sem numero ate voce
-- recalcular.
