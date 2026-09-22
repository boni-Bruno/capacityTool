-- =============================================================================
-- 38. USUARIOS, CARGOS E ESCOPO — QUEM ENTRA, O QUE PODE, ONDE PODE
--
-- Ate aqui a ferramenta tinha uma senha para todo mundo (APP_SENHA): o cookie
-- cap_sessao era o mesmo hash para qualquer pessoa, e quem entrava podia tudo.
-- Em 21/09/2026 o Bruno decidiu abrir a ferramenta para mais gente e pediu o
-- controle de dentro do proprio app: cargos com permissao por tela (ver ou
-- editar), usuarios convidados com login, senha inicial e cargo, e o escopo —
-- quais plantas e areas cada pessoa enxerga e mexe.
--
-- AS TABELAS DA MIGRACAO 01 SAEM. usuario, perfil, permissao, perfil_permissao
-- e usuario_perfil nasceram na fundacao do banco como intencao, nunca receberam
-- uma linha e ninguem as le. Reaproveita-las obrigaria a chamar de "perfil" o
-- que o Bruno chama de cargo e a manter uma tabela de permissoes que mudaria a
-- cada tela nova. Melhor recriar com o vocabulario dele e o desenho de hoje.
--
-- O MODELO:
--
--   cargo             o nome e a marca "protegido". O cargo protegido e o
--                     Gestor de Planejamento: tem TODAS as permissoes sempre,
--                     inclusive das telas que ainda nao existem — por isso ele
--                     nao guarda linha em cargo_permissao, e nao pode ser
--                     apagado nem perder permissao pela tela.
--   cargo_permissao   os codigos que o cargo tem: <tela>.ver, <tela>.editar e
--                     recalcular. A lista de telas e CODIGO (lib/permissoes.js),
--                     nao tabela: tela nova entra no codigo e aparece na grade
--                     de cargos sozinha. Tabela de permissao seria um segundo
--                     lugar para manter, e o primeiro esquecimento faria uma
--                     tela nova nascer invisivel para todo cargo.
--   usuario           login (minusculo, unico), nome, e-mail (unico quando
--                     existe; e por ele que quem vem do Hub S&OP e reconhecido),
--                     senha em PBKDF2-SHA256 com salt proprio, a marca de
--                     "trocar senha no primeiro acesso", o cargo, ativo e a
--                     historia (quem criou, ultimo acesso). Usuario nao se
--                     apaga: desativa. A historia dele — quem convidou, quando
--                     entrou — e o que responde "quem mexeu nisso?" daqui a um
--                     ano.
--   usuario_escopo    onde a pessoa atua: EMPRESA (tudo), PLANTA (a planta
--                     inteira, inclusive area criada depois) ou AREA (so
--                     aquela). Varias linhas por usuario. Sem linha nenhuma o
--                     usuario nao ve fabrica nenhuma — escopo vazio e escopo,
--                     nao e "tudo".
--
-- A SENHA MESTRE CONTINUA. APP_SENHA segue entrando, com todas as permissoes e
-- escopo total, identificada como "mestre". E a rede: se o unico gestor
-- esquecer a senha, ninguem fica trancado fora — e e por ela que o primeiro
-- usuario e criado. Decisao do Bruno.
--
-- O QUE FICA DO LADO DE FORA DO BANCO: a sessao. Ela e um JWT assinado com
-- segredo derivado de APP_SENHA (lib/sessao-token.js), carrega so a identidade,
-- e permissoes e escopo sao lidos daqui a cada requisicao — trocar o cargo de
-- alguem vale na proxima tela que a pessoa abrir, sem esperar a sessao morrer.
--
-- ORDEM: rode ANTES do deploy do codigo novo. O login por usuario e as telas de
-- Acesso leem estas tabelas; a senha mestre continua funcionando com ou sem
-- elas, entao nao ha janela em que ninguem entra.
-- =============================================================================

drop table if exists usuario_perfil;
drop table if exists perfil_permissao;
drop table if exists permissao;
drop table if exists perfil;
drop table if exists usuario;

create table cargo (
    id         serial primary key,
    nome       varchar(60) not null unique,
    protegido  boolean not null default false,
    criado_em  timestamptz not null default now()
);

create table cargo_permissao (
    cargo_id  int not null references cargo(id) on delete cascade,
    codigo    varchar(60) not null,
    primary key (cargo_id, codigo)
);

create table usuario (
    id             serial primary key,
    login          varchar(60) not null unique,
    nome           varchar(120) not null,
    email          varchar(160) unique,
    senha_hash     text not null,
    senha_salt     text not null,
    trocar_senha   boolean not null default true,
    cargo_id       int not null references cargo(id),
    ativo          boolean not null default true,
    criado_em      timestamptz not null default now(),
    criado_por     int references usuario(id),
    ultimo_acesso  timestamptz,
    check (login = lower(login)),
    check (email is null or email = lower(email))
);

create table usuario_escopo (
    usuario_id     int not null references usuario(id) on delete cascade,
    nivel          varchar(10) not null check (nivel in ('EMPRESA', 'PLANTA', 'AREA')),
    referencia_id  int,
    check ((nivel = 'EMPRESA' and referencia_id is null)
        or (nivel <> 'EMPRESA' and referencia_id is not null)),
    unique nulls not distinct (usuario_id, nivel, referencia_id)
);

-- O unico cargo que nasce pronto. Sem usuario: o primeiro e criado pelo mestre
-- na tela de Usuarios, e o Bruno decide o proprio login.
insert into cargo (nome, protegido) values ('Gestor de Planejamento', true);
