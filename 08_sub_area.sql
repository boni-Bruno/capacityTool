-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 08. SUB-ÁREA DO RECURSO
--
-- Subdivisão livre dentro da área, opcional. Texto na própria linha do
-- recurso, sem tabela nem cadastro à parte.
--
-- É uma escolha deliberada de NÃO normalizar: enquanto a sub-área servir só
-- para agrupar na leitura, tabela própria só acrescentaria uma tela de
-- cadastro e um vínculo para manter. Se um dia ela precisar de regra própria
-- — turno diferente por sub-área, OEE por sub-área — aí vira tabela, e este
-- campo vira a origem da migração.
--
-- Rode uma vez no SQL Editor do Neon. É seguro repetir.
-- =============================================================================

alter table recurso add column if not exists sub_area varchar(60);

comment on column recurso.sub_area is
    'Subdivisao livre dentro da area. Texto solto, sem tabela propria.';
