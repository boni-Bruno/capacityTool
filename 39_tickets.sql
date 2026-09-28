-- =============================================================================
-- 39. TICKETS — O CANAL DE QUEM USA A FERRAMENTA
--
-- Pedido do Bruno em 28/09/2026. Com a ferramenta aberta para mais gente, as
-- duvidas, as sugestoes e os defeitos passaram a chegar por conversa de
-- corredor, mensagem solta e e-mail — cada um num lugar, nenhum com resposta
-- rastreavel. Um grupo novo no menu, "Roadmap", passa a receber isso de dentro
-- da propria ferramenta: quem esta olhando a tela abre o chamado dali mesmo.
--
-- UMA TABELA SO, e de proposito. Nao ha projeto, nao ha sprint, nao ha
-- prioridade, nao ha anexo. Isto nao e um Jira: e a caixa de entrada do
-- roadmap, e o que ela precisa provar primeiro e que alguem responde. Campo
-- que ninguem preenche vira ruido que ninguem le.
--
-- O PRODUTO E TEXTO, e nao uma chave para outra tabela. A lista de telas mora
-- no codigo (lib/permissoes.js, TELAS) e muda quando uma tela nasce; uma tabela
-- de produtos seria um segundo lugar para manter em dia, e o primeiro
-- esquecimento faria a tela nova nao aparecer no seletor. Em troca, o codigo
-- guardado pode nao existir mais um dia — a tela mostra o codigo cru quando nao
-- reconhece, que e melhor que esconder o ticket.
--
-- QUEM ABRIU VAI EM DOIS CAMPOS: o id do usuario E o nome em texto. A sessao
-- mestre (APP_SENHA, sem usuario) tambem abre ticket, e ali nao ha id para
-- guardar; sem o nome em texto, o ticket ficaria orfao de autor. O nome
-- tambem congela quem era a pessoa no dia — trocar o nome no cadastro nao
-- reescreve a historia do chamado.
--
-- QUEM VE O QUE, a regra do Bruno: quem responde ve todos, o resto ve os seus.
-- Isso NAO esta no banco, e sim na consulta (lib/tickets.js): "ve todos" e ter
-- a permissao tickets.editar, que o Gestor de Planejamento tem por ser cargo
-- protegido. Trancar no banco exigiria RLS e uma conexao por pessoa, que este
-- projeto nao tem.
--
-- ORDEM: rode ANTES do deploy do codigo novo. As telas de Roadmap leem esta
-- tabela; sem ela, elas quebram na primeira abertura.
-- =============================================================================

create table ticket (
    id              serial primary key,

    -- Quem abriu. O id some se o usuario for apagado algum dia; o nome fica.
    criado_por      int references usuario(id) on delete set null,
    criado_por_nome varchar(120) not null,

    -- 'tudo', o codigo de um grupo do menu ('g:Extração') ou o de uma tela
    -- ('painel'). Ver lib/ticket-formato.js.
    produto         varchar(60)  not null default 'tudo',
    tipo            varchar(12)  not null
                    check (tipo in ('DUVIDA', 'SUGESTAO', 'BUG')),
    resumo          varchar(160) not null,
    descricao       text         not null,

    status          varchar(12)  not null default 'ABERTO'
                    check (status in ('ABERTO', 'ANALISE', 'FEITO', 'RECUSADO')),

    -- A resposta e do mesmo tamanho da pergunta de proposito: "nao vamos fazer"
    -- sem o porque e pior que nao responder.
    resposta        text,
    respondido_por  int references usuario(id) on delete set null,
    respondido_em   timestamptz,

    criado_em       timestamptz  not null default now()
);

-- A lista abre sempre pelo mais recente, e a de quem nao responde e filtrada
-- por autor. Sem o indice, cada abertura varre a tabela inteira.
create index ticket_meus on ticket (criado_por, criado_em desc);
create index ticket_recentes on ticket (criado_em desc);
