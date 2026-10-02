-- =============================================================================
-- 47 — A CONVERSA DO CHAMADO
--
-- POR QUE. Ate aqui um chamado tinha a descricao (de quem abriu) e a resposta
-- (de quem cuida da fila). Quando a conversa precisava continuar — "voltou a
-- acontecer", "era isso mesmo, obrigado", "consegue me mandar o print?" — o
-- unico caminho era REESCREVER a descricao ou a resposta. E reescrever apaga
-- rastro: a resposta deixa de responder a pergunta que foi feita, e quem ler
-- depois nao tem como saber que houve troca.
--
-- Na mesma conversa (02/10/2026) o Bruno fechou a edicao por estado: chamado
-- que saiu de ABERTO nao se reescreve mais, nem pelo dono nem pelo gestor. Esta
-- tabela e a outra metade dessa decisao — o que se perde em reescrever se ganha
-- em acrescentar.
--
-- O QUE E UM COMENTARIO. Uma linha de texto com autor e hora, que so cresce:
-- nao se edita e nao se apaga. Ele vale em QUALQUER estado, inclusive em Feito
-- e Nao procedente, porque e assim que se diz "voltou a acontecer" sem abrir um
-- chamado novo que perderia o historico do primeiro.
--
-- QUEM COMENTA: o dono do chamado e quem cuida da fila
-- (`tickets_gerenciar.editar`). A regra mora em lib/ticket-formato.js e e
-- conferida no servidor, com o ticket lido do banco.
--
-- O AUTOR VAI EM TEXTO JUNTO DO ID, como em `ticket` (migracao 39): a sessao
-- mestre nao tem id de usuario, e o nome congela quem a pessoa era no dia —
-- renomear no cadastro nao reescreve a historia da conversa.
--
-- `on delete cascade`: apagar o chamado leva a conversa junto. Comentario orfao
-- seria texto sem pergunta, e apagar um chamado ja e ato de quem cuida da fila,
-- com confirmacao.
--
-- Esta migracao so CRIA tabela: nenhuma linha existente muda, e a cardinalidade
-- de nada e alterada. Pode rodar antes do deploy sem risco — o codigo antigo
-- nao sabe que ela existe.
-- =============================================================================

create table if not exists ticket_comentario (
    id          serial primary key,
    ticket_id   int not null references ticket(id) on delete cascade,
    -- Nulo e a sessao mestre, como em ticket.criado_por.
    autor_id    int references usuario(id) on delete set null,
    autor_nome  varchar(120) not null,
    texto       text not null,
    criado_em   timestamptz not null default now()
);

-- A leitura e sempre "os comentarios deste chamado, na ordem em que foram
-- escritos" — e e ela que o indice serve.
create index if not exists ix_ticket_comentario
    on ticket_comentario (ticket_id, criado_em);
