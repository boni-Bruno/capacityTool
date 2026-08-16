-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 19. BASE DE DEMANDA
--
-- A demanda orçada chega num parquet exportado da controladoria: 116 mil
-- linhas, uma por combinação de CT, período e material. Ela traz `duracao_min`
-- já explodida pelo roteiro, o que é o que permite converter capacidade em
-- metro sem cadastrar taxa nenhuma — ver ROADMAP.md, seção 1.
--
-- DUAS TABELAS, E A LINHA É GUARDADA CRUA. O agregado por (ct, mês) seria
-- suficiente para a conversão e caberia em 3 mil linhas em vez de 116 mil, mas
-- responderia só a pergunta de hoje. A base crua responde as que ainda não
-- foram feitas — e é por isso que ela é guardada inteira, inclusive as linhas
-- sem CT e as com valor zero.
--
-- CADA CARGA É UMA VERSÃO. Nunca uma sobrescrita: em março alguém vai perguntar
-- por que o número de janeiro era outro, e a resposta costuma ser "a demanda
-- era outra".
--
-- O VÍNCULO COM O RECURSO NÃO É CADASTRADO. `ct` é o `cc-ct` da maquina_fisica,
-- e a ligação é resolvida na leitura. Um CT sem recurso hoje passa a casar
-- sozinho no dia em que o recurso for cadastrado, sem reimportar nada.
--
-- ORDEM: rode ANTES do deploy do código novo.
-- =============================================================================

create table if not exists demanda_carga (
    id             serial primary key,
    arquivo        varchar(200) not null,
    -- Vem do proprio parquet: identifica a versao do plano na origem.
    cenario        varchar(120) not null,
    -- Carimbo de quando a controladoria extraiu, tambem do arquivo. E o que
    -- distingue duas cargas do mesmo cenario.
    extraido_em    timestamptz,
    criado_em      timestamptz not null default now(),
    linhas         int         not null default 0,
    -- Quem escreveu o arquivo, para o relatorio dizer de onde ele saiu.
    criado_por     varchar(160),
    observacao     text
);

comment on table demanda_carga is
    'Uma linha por importacao da base de demanda. Versao, nunca sobrescrita.';

create table if not exists demanda_linha (
    id                  bigserial primary key,
    carga_id            int not null references demanda_carga(id) on delete cascade,

    -- Atributos do material, como vieram. Nulo e nulo: o parquet ja usa NULL
    -- de verdade, sem o '-' que o xlsx antigo punha no lugar.
    grupo_estoque          varchar(60),
    nivel_estoque          varchar(60),
    linha_produto_agrupada varchar(80),
    familia_produto        varchar(120),
    familia_tecelagem      varchar(40),
    tecido_base            varchar(120),
    um                     varchar(10),

    -- O centro de trabalho, no formato CC-CT da controladoria. Nulo em 37% das
    -- linhas: item comprado ou de revenda, que coerentemente vem sem duracao.
    ct                     varchar(20),

    -- O periodo vem nas duas formas. O texto e guardado como veio, para
    -- rastreabilidade e para a extracao de volta; a data e por onde o join com
    -- a capacidade acontece, porque data tipada nao depende de formatacao.
    periodo                varchar(10)  not null,
    periodo_data           date         not null,

    -- Producao na UM do material.
    qtd                    numeric(18,6) not null default 0,
    -- A MESMA producao em metro de tecelagem (kg na fiacao). O que liga as duas
    -- e a pista: o tear faz 2, 3 ou mais toalhas lado a lado no mesmo metro.
    qtd_metros_kg          numeric(18,6) not null default 0,
    -- Tempo do roteiro ja explodido para esta quantidade neste CT.
    duracao_min            numeric(18,6) not null default 0
);

comment on column demanda_linha.duracao_min is
    'Tempo do roteiro ja explodido, nao uma taxa. O mesmo item na mesma '
    'quantidade tem duracao diferente em CTs diferentes.';

-- O caminho de leitura e sempre (carga, ct, periodo): a conversao agrupa por
-- CT e mes, e a validacao varre por CT.
create index if not exists ix_dl_carga_ct  on demanda_linha (carga_id, ct);
create index if not exists ix_dl_carga_per on demanda_linha (carga_id, periodo_data);

-- =============================================================================
-- A CARGA CORRENTE
--
-- O painel precisa de UMA carga por vez. Marcar em vez de "a mais recente"
-- porque importar nao deveria trocar o que todo mundo esta vendo sem alguem
-- decidir — mesma razao de o Recalcular ser um botao e nao um efeito colateral.
-- =============================================================================
alter table demanda_carga
    add column if not exists corrente boolean not null default false;

-- Uma so, e o indice parcial e quem garante.
drop index if exists ix_dc_corrente;
create unique index ix_dc_corrente on demanda_carga (corrente) where corrente;
