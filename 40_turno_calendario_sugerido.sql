-- =============================================================================
-- 40. CALENDARIO SUGERIDO PELO TURNO
--
-- Continuacao direta do regime de dias por mes (29/09/2026). Resolvido o QUE se
-- cadastra, sobrou o COMO: quem monta 2027 marca o turno de rodizio em julho e,
-- numa segunda coluna, precisa lembrar de trocar o regime daquele mes tambem.
-- Duas decisoes que na cabeca de quem cadastra sao uma so — "essa maquina passa
-- a rodar em rodizio em julho" —, e a segunda e a que fica para tras.
--
-- O turno passa a poder APONTAR um calendario: o turno de rodizio sugere o
-- calendario RODIZIO. Marcado o turno num mes cujo regime e outro, a tela
-- oferece a troca em um clique, com os meses listados.
--
-- SUGESTAO, E NAO AMARRACAO — e e a linha inteira da decisao. O calendario
-- continua sendo do RECURSO, mes a mes, e e ele que o motor le; o turno so
-- opina. Derivar o regime do turno seria mais curto de escrever e erraria o
-- caso real: a mesma maquina pode rodar o turno de rodizio numa planta que
-- trabalha aos domingos e noutra que nao, e existe recurso com dois turnos
-- marcados no mesmo mes apontando para calendarios diferentes. Quem decide
-- entre eles e uma pessoa, e a tela pergunta em vez de escolher calada.
--
-- NULL E O NORMAL: turno sem sugestao nao sugere nada, e e assim que todos
-- nascem. Semear a coluna com um palpite faria a ferramenta propor troca de
-- regime a quem nunca pediu — e proposta que aparece sozinha e ignorada por
-- reflexo na terceira vez.
--
-- A planta nao entra numa foreign key composta porque turno e calendario ja
-- sao os dois da mesma planta por construcao; quem confere e o cadastro
-- (lib/cadastro.js), que so oferece e so aceita calendario da planta do turno.
--
-- ORDEM: rode ANTES do deploy. A tela de Turnos le esta coluna.
-- =============================================================================

alter table turno
    add column calendario_sugerido_id int null references calendario(id);

comment on column turno.calendario_sugerido_id is
    'Regime de dias que este turno sugere ao recurso. Sugestao: quem vale no '
    'calculo e recurso_calendario, mes a mes.';
