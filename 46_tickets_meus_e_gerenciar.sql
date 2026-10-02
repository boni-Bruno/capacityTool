-- =============================================================================
-- 46 — OS TICKETS VIRAM DUAS TELAS: "os meus" e "os de todos"
--
-- O QUE ACONTECEU. Em 02/10/2026 um usuario convidado recebeu um cargo com as
-- duas linhas do grupo Roadmap marcadas na grade de cargos — o gesto natural de
-- quem quer que a pessoa consiga abrir um chamado. Com isso ele passou a ver os
-- tickets de TODO MUNDO e a responde-los, porque `tickets.editar` nunca quis
-- dizer "editar os meus": ele queria dizer "sou quem cuida da fila".
--
-- Nao foi erro de quem marcou. Foi o rotulo mentindo: duas caixas identicas na
-- grade, "ver" e "editar", com um significado que nenhuma tela explicava. A
-- permissao que abria chamado chamava-se `ticket_novo.editar`, e ninguem tinha
-- como adivinhar que a de cima era a de curador.
--
-- O CORTE MUDOU. Era CRIAR x ACOMPANHAR; passa a ser O MEU x O DE TODOS:
--
--   tickets.ver               vejo os meus chamados
--   tickets.editar            abro um chamado e corrijo o que escrevi
--   tickets_gerenciar.ver     vejo a fila de toda a ferramenta
--   tickets_gerenciar.editar  respondo, mudo o estado e apago
--
-- Agora cada caixa quer dizer o que o rotulo diz, e dar a fila a alguem e um
-- ato proprio — uma tela com nome, que se confere.
--
-- O MAPA DA CONVERSAO, e a ordem importa porque `tickets.editar` troca de
-- significado no meio do caminho:
--
--   tinha tickets.editar      -> ganha tickets_gerenciar.ver + .editar
--                                (continua cuidando da fila, na tela nova)
--   tinha ticket_novo.editar  -> ganha tickets.editar  (abre e corrige o seu)
--   tinha ticket_novo.ver     -> ganha tickets.ver
--   ticket_novo.*             -> apagado: a tela deixou de existir
--
-- QUANDO RODAR: DEPOIS DO DEPLOY FICAR VERDE, e nao antes. Rodada antes, o
-- codigo antigo leria `tickets.editar` em quem so abre chamado e entregaria a
-- fila a essa pessoa por alguns minutos — exatamente o defeito que esta
-- migracao existe para fechar. Rodada depois, o pior caso e um cargo nao
-- protegido ficar sem a tela de gerenciar por alguns minutos, o que nao expoe
-- nada. O Gestor de Planejamento e a sessao mestre tem `*` e nao dependem
-- destas linhas em momento nenhum.
--
-- Em transacao: os quatro passos sao um so. Pela metade, alguem fica sem
-- permissao nenhuma de ticket ou com as duas ao mesmo tempo.
-- =============================================================================

begin;

-- 1) Quem cuidava da fila continua cuidando — agora pela tela nova.
insert into cargo_permissao (cargo_id, codigo)
select cargo_id, 'tickets_gerenciar.ver'
  from cargo_permissao where codigo = 'tickets.editar'
on conflict do nothing;

insert into cargo_permissao (cargo_id, codigo)
select cargo_id, 'tickets_gerenciar.editar'
  from cargo_permissao where codigo = 'tickets.editar'
on conflict do nothing;

-- 2) `tickets.editar` troca de dono: deixa de ser do curador...
delete from cargo_permissao where codigo = 'tickets.editar';

-- 3) ...e passa a ser de quem abre o proprio chamado.
insert into cargo_permissao (cargo_id, codigo)
select cargo_id, 'tickets.editar'
  from cargo_permissao where codigo = 'ticket_novo.editar'
on conflict do nothing;

insert into cargo_permissao (cargo_id, codigo)
select cargo_id, 'tickets.ver'
  from cargo_permissao where codigo = 'ticket_novo.ver'
on conflict do nothing;

-- 4) A tela "Criar ticket" nao existe mais: o formulario mora num pop-up
--    dentro de Meus tickets.
delete from cargo_permissao where codigo like 'ticket_novo.%';

commit;

-- Conferencia (deve sair sem nenhuma linha de ticket_novo):
--   select c.nome, array_agg(p.codigo order by p.codigo)
--     from cargo c join cargo_permissao p on p.cargo_id = c.id
--    where p.codigo like 'ticket%'
--    group by c.nome order by c.nome;
