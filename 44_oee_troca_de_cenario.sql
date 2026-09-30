-- =============================================================================
-- 44. O OEE TROCA DE LADO
--
-- Remendo da 41, pedido pelo Bruno em 30/09/2026 ao ver o painel: a 41 levou
-- turno, regime e parametro para a Simulacao, mas nao tocou no recurso_oee — e
-- o OEE que ele tinha cadastrado estava em META, porque META era o padrao da
-- tela de OEE. O resultado era um cadastro partido: a jornada na Simulacao e o
-- OEE que vale para ela no Orcamento.
--
-- TROCA, E NAO MUDANCA DE LADO. Os dois lados tinham cadastro de verdade:
--
--     Orcamento (META)      1.107 faixas, 664 medidas (fora dos 100%)
--     Simulacao (SIMULADO)    675 faixas, 275 medidas
--
-- E cruzando recurso a recurso: nenhum recurso tinha medida so na Simulacao,
-- 118 tinham medida so no Orcamento, e 261 tinham medida NOS DOIS e diferente.
-- Mover um por cima do outro apagaria 261 numeros que alguem digitou. Trocar
-- nao apaga nada: o que ele chamava de "meta" vira a Simulacao, e o que ele
-- chamava de "simulado" vira o ponto de partida do Orcamento — que ele vai
-- sobrescrever quando as fabricas mandarem o plano.
--
-- Foi a escolha dele entre tres, com os numeros acima na mesa.
--
-- POR QUE EM TRES PASSOS E COM UM VALOR TEMPORARIO. recurso_oee tem
-- `exclude using gist (recurso_id, turno_id, origem, vigencia)` desde a 01, e a
-- restricao e conferida linha a linha, na hora. Um `update ... set origem =
-- case ... end` bateria na primeira linha: ao virar SIMULADO, ela colidiria com
-- a linha SIMULADO que ainda existe para o mesmo recurso e periodo. O terceiro
-- valor tira as linhas do caminho antes de o outro lado ocupar o lugar.
--
-- O check de origem cai junto e volta no fim — ele e que proibe o valor
-- temporario, e proibir e o certo: 'TROCA' nao pode sobreviver a esta migracao.
--
-- ORDEM: pode rodar a qualquer momento; nenhum codigo le a coluna por valor
-- fixo. DEPOIS: "Recalcular tudo", obrigatorio. As rodadas que estao no ar
-- foram calculadas com o OEE do lado antigo, e ate recalcular a Simulacao mostra
-- disponivel com o OEE que agora e do Orcamento.
-- =============================================================================

alter table recurso_oee drop constraint recurso_oee_origem_check;

update recurso_oee set origem = 'TROCA'    where origem = 'META';
update recurso_oee set origem = 'META'     where origem = 'SIMULADO';
update recurso_oee set origem = 'SIMULADO' where origem = 'TROCA';

alter table recurso_oee add constraint recurso_oee_origem_check
    check (origem in ('META', 'SIMULADO'));
