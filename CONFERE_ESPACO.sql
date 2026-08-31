-- =============================================================================
-- CONFERE_ESPACO.sql — DIAGNÓSTICO, não é migração. Não altera nada.
--
-- "O storage encheu e eu não cadastrei mais recurso nenhum." Estas quatro
-- consultas dizem onde o espaço foi parar, em ordem do que mais costuma ser a
-- causa. Rode uma de cada vez e leia o resultado antes de passar para a
-- próxima.
--
-- ANTES DE TUDO, DUAS COISAS QUE CONFUNDEM A LEITURA:
--
-- 1. APAGAR LINHA NÃO DEVOLVE ESPAÇO. O Postgres marca a linha como morta e
--    reserva o lugar para reuso; o arquivo continua do tamanho de antes, e a
--    fatura também. Quem devolve é `vacuum full`, e ele está no fim deste
--    arquivo.
--
-- 2. O NEON COBRA TAMBÉM O HISTÓRICO. Além dos dados de agora, ele guarda uma
--    janela de restauração no tempo. Ou seja: um `delete` grande AUMENTA o
--    espaço cobrado por alguns dias, porque a escrita do apagamento também
--    entra na janela. O tamanho que as consultas abaixo mostram é o de HOJE, e
--    pode ser bem menor que o cobrado.
-- =============================================================================

-- ---- 1. o tamanho de cada tabela, da maior para a menor ---------------------
--
-- Inclui índices e TOAST, que é onde o binário grande mora. Se a soma daqui
-- for muito menor que o cobrado, o que está pesando é o histórico do item 2 —
-- e aí a resposta é esperar a janela passar, não apagar mais nada.

select relname                                          as tabela,
       to_char(n_live_tup, 'FM999G999G999')             as linhas_vivas,
       to_char(n_dead_tup, 'FM999G999G999')             as linhas_mortas,
       pg_size_pretty(pg_total_relation_size(relid))    as tamanho
  from pg_stat_user_tables
 order by pg_total_relation_size(relid) desc
 limit 15;

-- ---- 2. as rodadas de capacidade -------------------------------------------
--
-- Desde a migração 26 vale UMA rodada por (área, ano, origem), e o recalcular
-- apaga a anterior sozinho. Se `rodadas` for maior que 1 em alguma linha, a
-- substituição não está acontecendo — é defeito, e me diga.
--
-- Mas repare no total: "uma por combinação" não quer dizer "uma". Recalcular
-- tudo cria uma rodada para CADA área, CADA ano e CADA origem de OEE. Com 5
-- áreas, 4 anos e META+SIMULADO são 40 conjuntos completos guardados ao mesmo
-- tempo, todos legítimos e todos ocupando espaço.

select a.nome                                as area,
       extract(year from e.periodo_inicio)   as ano,
       e.origem,
       count(*)                              as rodadas
  from calculo_execucao e
  left join area a on a.id = e.area_id
 where e.status = 'OK'
 group by 1, 2, 3
having count(*) > 0
 order by 4 desc, 1, 2;

-- ---- 3. as bases de demanda importadas -------------------------------------
--
-- ESTE COSTUMA SER O CULPADO QUANDO "NADA MUDOU". Cada importação é uma carga
-- nova com ~116 mil linhas, e ELA NÃO SUBSTITUI A ANTERIOR de propósito: a
-- carga nasce fora do ar e alguém decide torná-la corrente, para poder comparar
-- cenários. Só que carga velha que ninguém vai comparar fica lá para sempre.
--
-- A corrente é a que o sistema usa. As outras dá para apagar pela tela de
-- Demanda, sem migração nem risco.

select c.id,
       c.cenario,
       c.arquivo,
       c.corrente,
       to_char(c.linhas, 'FM999G999G999') as linhas,
       c.criado_em::date                  as importada_em
  from demanda_carga c
 order by c.corrente desc, c.criado_em desc;

-- ---- 4. o modelo de slide --------------------------------------------------
--
-- Uma linha só, mas ela guarda o .pptx inteiro. Cada reimportação reescreve a
-- linha, e a versão anterior entra na janela de histórico do item 2 — um modelo
-- de 4 MB importado cinco vezes numa tarde são 20 MB de histórico.

select arquivo,
       pg_size_pretty(tamanho::bigint) as tamanho,
       criado_em
  from modelo_slide;

-- =============================================================================
-- DEVOLVER O ESPAÇO
--
-- Só depois de olhar o de cima, e só para o que a leitura apontou. Cada uma
-- SOZINHA, sem mais nada selecionado: `vacuum` não roda dentro de transação, e
-- o editor do Neon envolve em transação tudo que você mandar de uma vez.
--
--     vacuum full capacidade_memoria;
--     vacuum full capacidade_fato;
--     vacuum full capacidade_instalada_dia;
--     vacuum full demanda_linha;
--     vacuum full modelo_slide;
--
-- O `vacuum full` trava a tabela enquanto roda e reescreve o arquivo inteiro —
-- em tabela de milhões de linhas leva minutos. E ele mesmo escreve histórico:
-- o espaço cobrado cai de verdade quando a janela de restauração passar.
-- =============================================================================
