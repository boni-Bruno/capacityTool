-- =============================================================================
-- 30 — OBSERVAÇÃO NA CARGA DE DEMANDA
--
-- O cenário tem nome e data, e isso responde "qual é". Não responde "por que
-- este". Três cargas chamadas "S&OP Ciclo 06-2027" com dois dias de diferença
-- são indistinguíveis daqui a um mês, e a diferença entre elas costuma ser uma
-- frase: "sem o pedido da Renner", "com a linha nova de Blumenau", "reprocesso
-- do ciclo anterior".
--
-- Essa frase hoje mora no e-mail de quem importou, e some quando ele sai de
-- férias. Aqui ela fica ao lado do número que ela explica.
--
-- TEXTO LIVRE, e não uma lista de motivos: o que precisa ser dito muda a cada
-- ciclo, e uma lista fechada obrigaria a escolher "outros" na metade das vezes
-- — o que é o mesmo que não anotar nada.
--
-- Nula por padrão. Carga sem observação é o caso comum e não é erro nenhum:
-- obrigar a escrever algo faria aparecer um ponto final como conteúdo.
-- =============================================================================

alter table demanda_carga
    add column if not exists observacao text;

comment on column demanda_carga.observacao is
    'Anotação livre sobre este cenário: o que ele tem de diferente dos outros.';
