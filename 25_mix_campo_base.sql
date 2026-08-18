-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 25. MIX TAMBEM POR CAMPO DA BASE
--
-- O ajuste de mix nasceu amarrado aos atributos do DE/PARA: a coluna atributo
-- referenciava demanda_atributo. Mas o mix faz sentido em qualquer leitura do
-- tempo do CT — familia de tecelagem, grupo de estoque, nivel de estoque — sem
-- exigir que alguem crie uma regra DE/PARA antes.
--
-- A referencia cai. O codigo do atributo passa a poder ser um campo da base
-- (familia_tecelagem, grupo_estoque, ...) ou um derivado do DE/PARA; quem
-- valida e a aplicacao, que e quem conhece as duas listas. Um derivado nunca
-- pode ter o nome de um campo da base — salvarAtributo ja recusa — entao nao
-- ha ambiguidade.
--
-- Apagar um atributo derivado deixa de varrer os ajustes dele em cascata; em
-- troca, ajuste de campo da base sobrevive por conta propria. A limpeza do
-- orfao e da aplicacao, se um dia importar.
--
-- ORDEM: rode ANTES do deploy do codigo novo.
-- =============================================================================

alter table mix_ajuste drop constraint if exists mix_ajuste_atributo_fkey;
alter table mix_taxa   drop constraint if exists mix_taxa_atributo_fkey;
