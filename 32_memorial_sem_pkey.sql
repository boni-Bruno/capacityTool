-- =============================================================================
-- 32 — A CHAVE PRIMARIA DO MEMORIAL SAI, E COM ELA 30 MB
--
-- O banco bateu no teto do Neon (512 MB de tamanho logico por branch, plano
-- free) no meio de um Recalcular tudo: 14 rodadas falharam com "could not
-- extend file because project size limit has been exceeded", e ficaram com os
-- numeros do motor antigo enquanto as outras 10 ja tinham os novos. Painel meio
-- recalculado e meio nao e pior que painel nao recalculado, porque as duas
-- metades parecem igualmente confiaveis.
--
-- Nao havia entulho para varrer: zero linhas mortas nas quatro tabelas grandes.
-- O dado vivo e que nao cabia. Entao o corte tinha que sair de alguma coisa que
-- ninguem usa — e tinha uma.
--
-- capacidade_memoria_pkey ocupava 30 MB para indexar um id sequencial que:
--   - nenhuma FK referencia (zero constraints apontando para a tabela);
--   - nenhuma consulta usa — o memorial e lido por (execucao_id, recurso_id,
--     data), que tem o ix_cm_chave proprio, e apagado por execucao_id ou
--     recurso_id;
--   - o pg_stat_user_indexes contou UM scan na vida do banco.
--
-- Trinta megabytes e uma tabela de meio milhao de linhas para uma chave que so
-- existia por habito de por "id serial primary key" em tudo. Numa tabela que e
-- log append-only, lida por chave natural, a surrogate nao paga o aluguel.
--
-- POR QUE SO O INDICE, E NAO A COLUNA: dropar a coluna id nao devolve espaco
-- sem reescrever a tabela, e reescrever exige espaco livre do tamanho dela
-- (113 MB) — que e exatamente o que nao ha. Pela mesma razao nao se roda
-- vacuum full aqui agora. O drop do indice, esse, libera na hora.
--
-- ISTO NAO RESOLVE O PROBLEMA DE FUNDO, so compra folga para terminar o
-- recalculo. O desperdicio grande continua no ROADMAP: capacidade_instalada_dia
-- guarda uma linha por recurso por DIA para um numero que e 1440 x qt x
-- equivalencia e so muda quando o parametro muda.
--
-- DEPOIS DE RODAR: Recalcular tudo, para as 14 rodadas que falharam pegarem o
-- motor da migracao 31.
-- =============================================================================

alter table capacidade_memoria
    drop constraint capacidade_memoria_pkey;

comment on table capacidade_memoria is
    'Log append-only do passo a passo do calculo. Sem chave primaria de '
    'proposito: e lido por (execucao_id, recurso_id, data) via ix_cm_chave e '
    'apagado por execucao_id ou recurso_id. Um id surrogate aqui custou 30 MB '
    'e serviu para um unico scan — ver a migracao 32.';
