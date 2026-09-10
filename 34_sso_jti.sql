-- =============================================================================
-- 34. TOKEN DE SSO USADO UMA VEZ SO
--
-- O Hub S&OP (repositorio SnOP_Applications) passa a levar as pessoas para ca ja
-- autenticadas: ele assina um token de 90 segundos e o navegador o entrega por
-- POST em /sso, que confere a assinatura e emite o mesmo cookie cap_sessao que a
-- tela de senha sempre emitiu. Nada do que existe muda — /entrar, middleware e
-- exigeSessao continuam iguais.
--
-- POR QUE ESTA TABELA EXISTE: sem ela, o token valeria quantas vezes quisessem
-- dentro dos 90 segundos. Quem interceptasse — ou quem simplesmente voltasse no
-- historico e reenviasse o formulario — entraria de novo.
--
-- POR QUE ELA MORA AQUI, E NAO NO HUB: a alternativa seria esta ferramenta
-- perguntar ao Hub "esse token ja foi usado?" a cada entrada. Isso custaria um
-- round-trip dentro do login e, pior, faria Hub fora do ar virar ninguem entra na
-- Capacidade — exatamente o que manter os dois deploys separados deveria evitar.
--
-- A chave primaria e o mecanismo: o insert com on conflict do nothing devolve
-- linha na primeira vez e nada na segunda, inclusive em duas requisicoes
-- simultaneas. Ver lib/sso-jti.js.
--
-- A tabela nao guarda quem entrou. Isso e rastro do Hub, que ja registra a
-- emissao; aqui interessa apenas se aquele identificador ja foi gasto.
-- =============================================================================

create table sso_jti (
    jti       varchar(64) primary key,
    expira_em timestamptz not null,
    usado_em  timestamptz not null default now()
);

-- A faxina roda junto de cada entrada (lib/sso-jti.js), porque este projeto nao
-- tem cron. Sem o indice, ela varreria a tabela inteira toda vez.
create index sso_jti_expira on sso_jti (expira_em);
