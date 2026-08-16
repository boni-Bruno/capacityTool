-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 23. REGRAS DE CLASSIFICAÇÃO DA DEMANDA
--
-- A base fala a língua do sistema de origem; cada área da empresa fala a sua. E
-- um mesmo CT produz mais de uma linha de produto — 52 dos 123 — com índices
-- que diferem de verdade. Sem poder rotular e agrupar, não há como ler a
-- capacidade por atributo.
--
-- TRÊS TABELAS
--
--   demanda_atributo    o atributo derivado, e o NÍVEL dele
--   demanda_regra       qual rótulo, para qual atributo, em que ordem
--   demanda_regra_cond  as condições, agrupadas em blocos
--
-- SE...E / SE...OU SEM PARÊNTESES. Dentro do bloco, tudo é E. Entre blocos, é
-- OU. Cobre qualquer combinação sem parser, sem precedência de operador e sem
-- regra ambígua — e na tela vira dois botões: adicionar condição, adicionar
-- bloco.
--
-- O NÍVEL IMPEDE CICLO POR CONSTRUÇÃO. Uma regra só enxerga atributo de origem
-- ou derivado de nível MENOR. Detectar ciclo em tempo de execução daria erro no
-- meio de uma classificação; assim ele não pode existir.
--
-- PRIMEIRA REGRA QUE CASA GANHA, pela ordem. É previsível, mas o modo classico
-- de errar e regra fora de ordem ou valor digitado errado, e os dois sao
-- invisiveis — por isso a tela mostra quantas linhas cada regra pega, e a
-- previa roda antes de gravar.
--
-- LINHA SEM REGRA NUNCA SOME: fica com o valor de origem. Esconder linha por
-- falta de cadastro apagaria demanda do painel.
--
-- A RECLASSIFICAÇÃO É RETROATIVA, por decisão: alterar a regra vale para todas
-- as cargas, inclusive as antigas. Para rótulo isso é desejável — a história
-- inteira passa a falar a língua atual. Para agrupamento muda a soma de um
-- recorte, e como não há versionamento o rastro fica em criado_em/alterado_em.
--
-- ORDEM: rode ANTES do deploy do código novo.
-- =============================================================================

create table if not exists demanda_atributo (
    codigo     varchar(40) primary key,
    nome       varchar(80) not null,
    -- Quem enxerga quem. Regra de um atributo so le origem ou derivado de nivel
    -- menor, e e isso que torna ciclo impossivel.
    nivel      smallint    not null default 1 check (nivel between 1 and 9),
    ordem      smallint    not null default 1,
    criado_em  timestamptz not null default now()
);

comment on table demanda_atributo is
    'Atributos derivados por regra. O nivel impede referencia circular: regra '
    'so enxerga origem ou derivado de nivel menor.';

create table if not exists demanda_regra (
    id         serial primary key,
    atributo   varchar(40) not null references demanda_atributo(codigo)
                           on delete cascade,
    rotulo     varchar(80) not null,
    -- Primeira que casa ganha. Empate resolvido pelo id, para a ordem nunca
    -- depender do acaso.
    ordem      smallint    not null default 1,
    ativa      boolean     not null default true,
    observacao varchar(200),
    criado_em  timestamptz not null default now(),
    alterado_em timestamptz not null default now()
);

create index if not exists ix_dr_atributo on demanda_regra (atributo, ordem, id);

create table if not exists demanda_regra_cond (
    id       serial primary key,
    regra_id int not null references demanda_regra(id) on delete cascade,
    -- Mesmo bloco = E. Blocos diferentes = OU.
    bloco    smallint    not null default 1,
    -- Atributo de origem da base, ou um derivado de nivel menor.
    atributo varchar(40) not null,
    operador varchar(12) not null
             check (operador in ('=', '<>', 'CONTEM', 'COMECA', 'VAZIO')),
    -- Nulo so quando o operador e VAZIO.
    valor    varchar(160),

    constraint drc_valor_coerente
        check ((operador = 'VAZIO' and valor is null)
            or (operador <> 'VAZIO' and valor is not null))
);

create index if not exists ix_drc_regra on demanda_regra_cond (regra_id, bloco);

comment on table demanda_regra_cond is
    'Condicoes em forma normal disjuntiva: E dentro do bloco, OU entre blocos. '
    'Sem parenteses, sem parser, sem regra ambigua.';
