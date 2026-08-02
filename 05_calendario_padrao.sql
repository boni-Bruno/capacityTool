-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 05. REMOVE calendario.padrao
--
-- A coluna marcava um calendário como "o padrão da planta", mas nada a lê:
-- nem o motor (03_motor.sql), nem as telas. Qual calendário o recurso segue é
-- decidido em recurso_calendario, um por recurso.
--
-- Coluna que existe e ninguém usa vira armadilha: alguém marca, acha que
-- mudou alguma coisa, e não mudou.
--
-- Rode uma vez no SQL Editor do Neon. É seguro repetir.
-- =============================================================================

alter table calendario drop column if exists padrao;
