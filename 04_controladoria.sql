-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 04. IDENTIDADE DA MÁQUINA NA CONTROLADORIA
--
-- CC (centro de custo), CT (centro de trabalho) e Patrimônio são o que a
-- controladoria usa para identificar o equipamento. A trinca é a identidade da
-- maquina_fisica — por isso vira coluna com unicidade, e não atributo flexível
-- em recurso_atributo: aquele mecanismo guarda valor, mas não impede duas
-- máquinas com o mesmo CC-CT-Patrimônio.
--
-- Rode uma vez no SQL Editor do Neon. É seguro repetir (tudo com IF NOT EXISTS).
-- =============================================================================

alter table maquina_fisica
    add column if not exists cc         varchar(20),
    add column if not exists ct         varchar(20),
    add column if not exists patrimonio varchar(30);

comment on column maquina_fisica.cc is
    'Centro de custo da controladoria';
comment on column maquina_fisica.ct is
    'Centro de trabalho da controladoria';
comment on column maquina_fisica.patrimonio is
    'Numero de patrimonio do equipamento';

-- A trinca identifica a máquina dentro da planta.
--
-- Índice PARCIAL de propósito: as linhas que já existem não têm os três campos
-- preenchidos, e um unique comum tratando null como valor distinto deixaria
-- passar duplicata. Assim a regra vale para todo cadastro novo sem quebrar o
-- que já está lá.
create unique index if not exists ux_maquina_fisica_controladoria
    on maquina_fisica (planta_id, cc, ct, patrimonio)
 where cc is not null and ct is not null and patrimonio is not null;

-- -----------------------------------------------------------------------------
-- OPCIONAL — só depois de preencher os três campos em todas as máquinas.
-- Enquanto houver linha com null, estes comandos falham (e é para falhar
-- mesmo: obrigatoriedade pela metade é pior que nenhuma).
--
-- Confira o que falta:
--     select id, codigo, nome, cc, ct, patrimonio
--       from maquina_fisica
--      where cc is null or ct is null or patrimonio is null;
--
-- Depois de preencher tudo:
--     alter table maquina_fisica
--         alter column cc         set not null,
--         alter column ct         set not null,
--         alter column patrimonio set not null;
-- -----------------------------------------------------------------------------
