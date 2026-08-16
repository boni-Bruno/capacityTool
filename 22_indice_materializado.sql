-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 22. O ÍNDICE PASSA A SER MATERIALIZADO
--
-- PROBLEMA: `vw_demanda_indice_efetivo` é uma view, e view é recalculada a cada
-- leitura. Toda abertura do painel refazia o agrupamento sobre as 116 mil
-- linhas de `demanda_linha` — e no `porRecurso` isso acontece dentro de um
-- lateral, uma vez por recurso. Trocar de área ficou visivelmente lento.
--
-- E o custo era pago mesmo em minutos, que é quando ninguém pediu conversão
-- nenhuma.
--
-- CORREÇÃO: materialized view. Ela guarda o resultado sem duplicar a definição
-- — a conta continua escrita num lugar só, nas views das migrações 20 e 21, e
-- esta aqui é só o resultado em cache.
--
-- É o mesmo arranjo de `capacidade_fato`: o número fica gravado e alguém
-- decide quando refazer. A diferença é que aqui o refazer é automático, porque
-- os gatilhos são poucos e conhecidos — importar uma carga, trocar a carga que
-- está no ar, e mexer nas regras de herança de índice.
--
-- TAMANHO: uma linha por carga, CT e mês. Com 123 CTs e 19 períodos dá pouco
-- mais de 2 mil linhas por carga. O refresh leva milissegundos.
--
-- IMPACTO NOS NÚMEROS: nenhum. É a mesma consulta, guardada.
--
-- ORDEM: rode ANTES do deploy do código novo.
-- =============================================================================

drop materialized view if exists mv_demanda_indice;

create materialized view mv_demanda_indice as
select * from vw_demanda_indice_efetivo;

-- O caminho de leitura do painel é sempre (carga, ct, mês). Único porque as
-- três origens da view não se sobrepõem — a regra exclui o próprio, e não há
-- duas regras para o mesmo CT.
create unique index ux_mvdi_chave
    on mv_demanda_indice (carga_id, ct, mes);

comment on materialized view mv_demanda_indice is
    'Resultado guardado de vw_demanda_indice_efetivo. Refeito ao importar '
    'carga, trocar a carga corrente e mexer nas regras de heranca de indice.';
