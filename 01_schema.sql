-- =============================================================================
-- FERRAMENTA DE CAPACIDADE  —  01. ESTRUTURA DO BANCO
--
-- Grão do cálculo: RECURSO x DIA x TURNO (planejada e disponível)
--                  RECURSO x DIA        (instalada)
-- Moeda base: MINUTOS inteiros. Conversão para peças/metros/ton = fase 2.
--
-- PRINCÍPIO: cada informação mora em UM lugar só.
-- =============================================================================

create extension if not exists btree_gist;

-- =============================================================================
-- 1. ESTRUTURA FÍSICA
-- =============================================================================

create table unidade_medida (
    id          serial primary key,
    codigo      varchar(10)  not null unique,
    descricao   varchar(60)  not null,
    tipo        varchar(20)  not null
);

create table planta (
    id          serial primary key,
    codigo      varchar(20)  not null unique,
    nome        varchar(120) not null,
    timezone    varchar(60)  not null default 'America/Sao_Paulo',
    ativo       boolean      not null default true
);

create table area (
    id          serial primary key,
    planta_id   int          not null references planta(id),
    codigo      varchar(20)  not null,
    nome        varchar(120) not null,
    ativo       boolean      not null default true,
    unique (planta_id, codigo)
);

create table maquina_fisica (
    id          serial primary key,
    planta_id   int          not null references planta(id),
    codigo      varchar(30)  not null,
    nome        varchar(120) not null,
    tag_ativo   varchar(40),
    ativo       boolean      not null default true,
    unique (planta_id, codigo)
);

-- A unidade de capacidade. tipo_recurso decide se o intervalo de refeição desconta.
create table recurso (
    id                  serial primary key,
    maquina_fisica_id   int          not null references maquina_fisica(id),
    area_id             int          not null references area(id),
    codigo              varchar(30)  not null unique,
    nome                varchar(120) not null,
    tipo_recurso        varchar(10)  not null default 'MAQUINA'
                        check (tipo_recurso in ('MAQUINA','PESSOA')),
    unidade_medida_id   int          references unidade_medida(id),
    criado_em           timestamptz  not null default now(),
    criado_por          int
);
create index ix_recurso_area on recurso (area_id);

comment on column recurso.tipo_recurso is
    'MAQUINA nao para na refeicao; PESSOA desconta os intervalos marcados.';

-- ---- Agrupamentos analíticos ----
create table grupo_recurso (
    id      serial primary key,
    tipo    varchar(30)  not null,
    codigo  varchar(30)  not null,
    nome    varchar(120) not null,
    unique (tipo, codigo)
);

create table recurso_grupo (
    recurso_id int not null references recurso(id) on delete cascade,
    grupo_id   int not null references grupo_recurso(id) on delete cascade,
    primary key (recurso_id, grupo_id)
);

-- ---- Atributos flexíveis (novo atributo não exige mexer no banco) ----
create table atributo_definicao (
    id          serial primary key,
    codigo      varchar(40)  not null unique,
    nome        varchar(120) not null,
    tipo_dado   varchar(15)  not null,
    dominio     jsonb,
    obrigatorio boolean      not null default false,
    ordem       int          not null default 0
);

create table recurso_atributo (
    recurso_id  int not null references recurso(id) on delete cascade,
    atributo_id int not null references atributo_definicao(id),
    valor_texto text,
    valor_num   numeric(18,6),
    valor_data  date,
    valor_bool  boolean,
    primary key (recurso_id, atributo_id)
);

-- =============================================================================
-- 2. TURNOS
--    O turno guarda só a identidade. O horário mora em turno_horario,
--    uma linha por dia da semana — então sábado pode ter horário diferente
--    sem criar turno novo.
-- =============================================================================

create table turno (
    id        serial primary key,
    planta_id int         not null references planta(id),
    codigo    varchar(20) not null,
    nome      varchar(60) not null,
    ativo     boolean     not null default true,
    unique (planta_id, codigo)
);

-- dia_semana: 0=domingo, 1=segunda ... 6=sábado
-- Sem linha para um dia = o turno não roda nesse dia.
create table turno_horario (
    id               serial primary key,
    turno_id         int      not null references turno(id) on delete cascade,
    dia_semana       smallint not null check (dia_semana between 0 and 6),
    hora_inicio      time     not null,
    hora_fim         time     not null,
    min_bruto        int,
    cruza_meia_noite boolean  not null default false,
    vigencia         daterange not null,
    -- Trava: minuto negativo ou zero nunca entra calado.
    constraint th_min_bruto_valido
        check (min_bruto is null or (min_bruto > 0 and min_bruto <= 1440)),
    constraint th_sem_sobreposicao
        exclude using gist (turno_id with =, dia_semana with =, vigencia with &&)
);

-- O front-end manda só hora_inicio e hora_fim; o banco calcula o resto.
--
-- ATENÇÃO: somar interval a um campo 'time' dá a volta no relógio
-- (time '05:00' + 24h = '05:00'). Por isso o cast para interval,
-- onde 05:00 + 24h = 29:00 e a subtração funciona.
create or replace function fn_turno_horario_calcula() returns trigger
language plpgsql as $$
begin
    new.cruza_meia_noite := new.hora_fim <= new.hora_inicio;
    if new.min_bruto is null then
        new.min_bruto := extract(epoch from (
            new.hora_fim::interval
            + case when new.cruza_meia_noite then interval '24 hours'
                   else interval '0' end
            - new.hora_inicio::interval
        )) / 60;
    end if;
    return new;
end $$;

create trigger trg_turno_horario_calcula
    before insert or update on turno_horario
    for each row execute function fn_turno_horario_calcula();

-- Refeições e pausas. aplica_a decide de quem desconta.
create table turno_intervalo (
    id          serial primary key,
    turno_id    int         not null references turno(id) on delete cascade,
    -- O intervalo e por dia da semana: sabado de meio periodo nao leva a mesma
    -- refeicao do dia cheio. Ver 17_intervalo_por_dia.sql.
    dia_semana  smallint    not null check (dia_semana between 0 and 6),
    descricao   varchar(60) not null,
    minutos     int         not null check (minutos > 0),
    descontavel boolean     not null default true,
    aplica_a    varchar(10) not null default 'AMBOS'
                check (aplica_a in ('MAQUINA','PESSOA','AMBOS'))
);
create index ix_ti_turno_dia on turno_intervalo (turno_id, dia_semana);

-- =============================================================================
-- 3. ESCALA DE RODÍZIO
--    Só necessária quando a folga ANDA e não acompanha o dia da semana.
--    Se a folga é sempre no mesmo dia, o calendário resolve sozinho.
-- =============================================================================

create table escala (
    id          serial primary key,
    codigo      varchar(20)  not null unique,
    descricao   varchar(120) not null,
    ciclo_dias  int          not null check (ciclo_dias > 0)
);

create table escala_dia (
    escala_id     int      not null references escala(id) on delete cascade,
    posicao_ciclo int      not null,
    trabalha      boolean  not null,
    primary key (escala_id, posicao_ciclo)
);

-- =============================================================================
-- 4. CALENDÁRIO
-- =============================================================================

create table calendario (
    id        serial primary key,
    planta_id int          not null references planta(id),
    codigo    varchar(30)  not null,
    nome      varchar(120) not null,
    padrao    boolean      not null default false,
    unique (planta_id, codigo)
);

-- Que turnos rodam em cada dia da semana
create table calendario_regra (
    id            serial primary key,
    calendario_id int      not null references calendario(id) on delete cascade,
    dia_semana    smallint not null check (dia_semana between 0 and 6),
    turno_id      int      not null references turno(id),
    unique (calendario_id, dia_semana, turno_id)
);

-- ---------------------------------------------------------------------------
-- EXCEÇÃO: feriado, parada coletiva ou dia extraordinário.
-- Cadastrada UMA VEZ por planta. Depois marca-se quais calendários observam.
-- Assim um feriado que a linha de rodízio trabalha e a linha padrão para
-- é uma data só com uma caixinha marcada, não duas datas em dois lugares.
-- ---------------------------------------------------------------------------
create table excecao (
    id          serial primary key,
    planta_id   int      not null references planta(id),
    data        date     not null,
    turno_id    int      references turno(id),   -- null = dia inteiro
    tipo        varchar(25) not null
                check (tipo in ('FERIADO','PARADA_COLETIVA','DIA_EXTRA',
                                'OUTRAS_PARADAS')),
    dia_util    boolean  not null,               -- false zera; true habilita dia normalmente parado
    -- Dois eixos independentes. Ver 18_parada_apresentacao.sql.
    --   afeta_capacidade  o dia produz?        -> motor
    --   impacto_dia       quanto o dia conta?  -> indicador de dias uteis
    afeta_capacidade boolean not null default true,
    impacto_dia numeric(4,2) not null default 1
                check (impacto_dia >= 0 and impacto_dia <= 1),
    descricao   varchar(120),
    unique nulls not distinct (planta_id, data, turno_id, tipo)
);

-- Quais calendários observam a exceção. Sem linha = o calendário ignora.
create table excecao_calendario (
    excecao_id    int not null references excecao(id) on delete cascade,
    calendario_id int not null references calendario(id) on delete cascade,
    primary key (excecao_id, calendario_id)
);

create table dim_data (
    data       date primary key,
    ano        smallint not null,
    mes        smallint not null,
    dia        smallint not null,
    dia_semana smallint not null,
    semana_iso smallint not null,
    mes_ano    char(7)  not null,
    trimestre  smallint not null
);

-- =============================================================================
-- 5. PARÂMETROS DO RECURSO (tudo com vigência)
--    O exclude constraint impede duas linhas valendo ao mesmo tempo —
--    é o que garante que o número do passado nunca mude sozinho.
-- =============================================================================

create table recurso_parametro (
    id              serial primary key,
    recurso_id      int       not null references recurso(id) on delete cascade,
    vigencia        daterange not null,
    equivalencia    numeric(10,4) not null default 1 check (equivalencia > 0),
    qt_recursos     int       not null default 1 check (qt_recursos >= 0),
    status_cadastro boolean   not null default true,
    observacao      text,
    criado_em       timestamptz not null default now(),
    criado_por      int,
    constraint rp_sem_sobreposicao
        exclude using gist (recurso_id with =, vigencia with &&)
);

create table recurso_calendario (
    id            serial primary key,
    recurso_id    int       not null references recurso(id) on delete cascade,
    calendario_id int       not null references calendario(id),
    vigencia      daterange not null,
    constraint rc_sem_sobreposicao
        exclude using gist (recurso_id with =, vigencia with &&)
);

create table recurso_turno (
    id                     serial primary key,
    recurso_id             int       not null references recurso(id) on delete cascade,
    turno_id               int       not null references turno(id),
    -- Quantas maquinas rodam neste turno. Nulo = todas as do recurso.
    -- Ver 15_qt_por_turno.sql.
    qt_recursos            int       check (qt_recursos is null or qt_recursos > 0),
    escala_id              int       references escala(id),
    escala_data_referencia date,
    vigencia               daterange not null,
    constraint rt_escala_precisa_referencia
        check (escala_id is null or escala_data_referencia is not null),
    constraint rt_sem_sobreposicao
        exclude using gist (recurso_id with =, turno_id with =, vigencia with &&)
);

create table recurso_oee (
    id              serial primary key,
    recurso_id      int references recurso(id) on delete cascade,
    grupo_id        int references grupo_recurso(id),
    turno_id        int references turno(id),
    vigencia        daterange not null,
    origem          varchar(15) not null check (origem in ('META','REAL','PROJETADO')),
    disponibilidade numeric(6,5) check (disponibilidade between 0 and 1),
    performance     numeric(6,5) check (performance     between 0 and 1),
    qualidade       numeric(6,5) check (qualidade       between 0 and 1),
    oee_pct         numeric(6,5) not null check (oee_pct between 0 and 1),
    check (recurso_id is not null or grupo_id is not null),
    constraint oee_sem_sobreposicao
        exclude using gist (recurso_id with =, turno_id with =, origem with =, vigencia with &&)
);

-- =============================================================================
-- 6. PARADAS
--    Setup NÃO entra aqui: já está embutido no OEE.
--    Parada que atinge a planta inteira -> excecao.
--    Parada que atinge recursos específicos -> parada.
-- =============================================================================

create table tipo_parada (
    id               serial primary key,
    codigo           varchar(30)  not null unique,
    nome             varchar(120) not null,
    planejada        boolean not null default true,
    abate_planejada  boolean not null default true,
    abate_disponivel boolean not null default true,
    cor              varchar(7)
);

-- minutos é SEMPRE por turno.
-- turno_id null = vale para todos os turnos do dia.
-- dia_inteiro = zera o dia (ignora minutos).
create table parada (
    id             serial primary key,
    recurso_id     int  not null references recurso(id) on delete cascade,
    tipo_parada_id int  not null references tipo_parada(id),
    data_inicio    date not null,
    data_fim       date not null,
    turno_id       int  references turno(id),
    minutos        int  check (minutos >= 0),
    dia_inteiro    boolean not null default false,
    recorrencia_id int,
    descricao      varchar(200),
    criado_em      timestamptz not null default now(),
    criado_por     int,
    check (data_fim >= data_inicio),
    check (dia_inteiro or minutos is not null)
);
create index ix_parada_recurso_data on parada (recurso_id, data_inicio, data_fim);

create table parada_recorrencia (
    id             serial primary key,
    recurso_id     int  not null references recurso(id) on delete cascade,
    tipo_parada_id int  not null references tipo_parada(id),
    turno_id       int  references turno(id),
    regra          varchar(200) not null,
    minutos        int  not null check (minutos >= 0),
    vigencia       daterange not null,
    descricao      varchar(200)
);

alter table parada add constraint fk_parada_recorrencia
    foreign key (recorrencia_id) references parada_recorrencia(id) on delete set null;

-- =============================================================================
-- 7. CENÁRIO E RESULTADO
-- =============================================================================

create table cenario (
    id         serial primary key,
    codigo     varchar(30)  not null unique,
    nome       varchar(120) not null,
    descricao  text,
    baseline   boolean not null default false,
    criado_em  timestamptz not null default now(),
    criado_por int
);

create table cenario_ajuste (
    id           serial primary key,
    cenario_id   int not null references cenario(id) on delete cascade,
    recurso_id   int references recurso(id),
    grupo_id     int references grupo_recurso(id),
    vigencia     daterange not null,
    campo        varchar(20) not null,
    valor_num    numeric(18,6),
    valor_ref_id int,
    check (recurso_id is not null or grupo_id is not null)
);

create table calculo_execucao (
    id              bigserial primary key,
    cenario_id      int  not null references cenario(id),
    periodo_inicio  date not null,
    periodo_fim     date not null,
    status          varchar(15) not null default 'PENDENTE'
                    check (status in ('PENDENTE','RODANDO','OK','ERRO')),
    mensagem_erro   text,
    iniciado_em     timestamptz not null default now(),
    concluido_em    timestamptz,
    executado_por   int
);

-- ---------------------------------------------------------------------------
-- INSTALADA — grão RECURSO x DIA.
-- Teto físico 24h/dia, todo dia, inclusive domingo e feriado.
-- Tabela separada porque no domingo não existe turno — e é justamente ali
-- que o teto precisa aparecer.
-- ---------------------------------------------------------------------------
create table capacidade_instalada_dia (
    execucao_id   bigint not null references calculo_execucao(id) on delete cascade,
    recurso_id    int    not null references recurso(id),
    planta_id     int    not null references planta(id),
    area_id       int    not null references area(id),
    data          date   not null,
    qt_recursos   int    not null,
    equivalencia  numeric(10,4) not null,
    -- Numeric e nao bigint: arredondar minuto no meio da cadeia faz a soma
    -- do mes discordar da multiplicacao. Ver 12_minuto_fracao.sql.
    min_instalada numeric(18,6) not null,
    primary key (execucao_id, recurso_id, data)
);
create index ix_cid_area_data on capacidade_instalada_dia (area_id, data);

-- ---------------------------------------------------------------------------
-- PLANEJADA E DISPONÍVEL — grão RECURSO x DIA x TURNO.
-- Guarda os parâmetros usados junto do resultado: o número fica auditável
-- sem precisar reconstruir o cadastro daquela data.
-- ---------------------------------------------------------------------------
create table capacidade_fato (
    execucao_id          bigint not null references calculo_execucao(id) on delete cascade,
    recurso_id           int    not null references recurso(id),
    planta_id            int    not null references planta(id),
    area_id              int    not null references area(id),
    data                 date   not null,
    turno_id             int    not null references turno(id),

    qt_recursos          int    not null,
    equivalencia         numeric(10,4) not null,
    oee_pct              numeric(6,5)  not null,
    dia_util             boolean not null,

    min_turno_liquido    int    not null,
    min_parada_planejada int    not null default 0,
    min_parada_outras    int    not null default 0,
    min_planejada        numeric(18,6) not null,
    min_disponivel       numeric(18,6) not null,

    unidade_medida_id    int references unidade_medida(id),
    qtd_planejada        numeric(18,4),
    qtd_disponivel       numeric(18,4),

    primary key (execucao_id, recurso_id, data, turno_id)
);
create index ix_cf_area_data on capacidade_fato (area_id, data);
create index ix_cf_recurso_data on capacidade_fato (recurso_id, data);

-- Memorial: o passo a passo do que foi descontado.
create table capacidade_memoria (
    id             bigserial primary key,
    execucao_id    bigint not null references calculo_execucao(id) on delete cascade,
    recurso_id     int  not null,
    data           date not null,
    turno_id       int  not null,
    ordem          smallint not null,
    etapa          varchar(40) not null,
    minutos_antes  numeric(18,6) not null,
    minutos_delta  numeric(18,6) not null,
    minutos_depois numeric(18,6) not null,
    origem_tabela  varchar(40),
    origem_id      bigint,
    descricao      varchar(200)
);
create index ix_cm_chave on capacidade_memoria (execucao_id, recurso_id, data, turno_id);

-- =============================================================================
-- 8. CONVERSÃO PARA UNIDADES (fase 2 — estrutura pronta, sem uso ainda)
-- =============================================================================

create table produto (
    id                serial primary key,
    codigo            varchar(40)  not null unique,
    nome              varchar(160) not null,
    unidade_medida_id int not null references unidade_medida(id),
    ativo             boolean not null default true
);

create table recurso_taxa (
    id                serial primary key,
    recurso_id        int not null references recurso(id) on delete cascade,
    produto_id        int references produto(id),
    vigencia          daterange not null,
    qtd_por_hora      numeric(18,6) not null check (qtd_por_hora > 0),
    unidade_medida_id int not null references unidade_medida(id),
    min_setup         int not null default 0,
    constraint taxa_sem_sobreposicao
        exclude using gist (recurso_id with =, produto_id with =, vigencia with &&)
);

-- =============================================================================
-- 9. ACESSOS E AUDITORIA
--    Estrutura criada; empresa/multi-tenant e RLS entram numa migration futura,
--    quando existir tela de login.
-- =============================================================================

create table usuario (
    id        serial primary key,
    email     varchar(160) not null unique,
    nome      varchar(120) not null,
    ativo     boolean not null default true,
    criado_em timestamptz not null default now()
);

create table perfil (
    id     serial primary key,
    codigo varchar(30) not null unique,
    nome   varchar(60) not null
);

create table permissao (
    id        serial primary key,
    codigo    varchar(60)  not null unique,
    descricao varchar(160) not null
);

create table perfil_permissao (
    perfil_id    int not null references perfil(id) on delete cascade,
    permissao_id int not null references permissao(id) on delete cascade,
    primary key (perfil_id, permissao_id)
);

create table usuario_perfil (
    id            serial primary key,
    usuario_id    int not null references usuario(id) on delete cascade,
    perfil_id     int not null references perfil(id),
    nivel         varchar(10) not null check (nivel in ('EMPRESA','PLANTA','AREA')),
    referencia_id int,
    concedido_por int references usuario(id),
    concedido_em  timestamptz not null default now(),
    check ((nivel  = 'EMPRESA' and referencia_id is null)
        or (nivel <> 'EMPRESA' and referencia_id is not null)),
    unique nulls not distinct (usuario_id, perfil_id, nivel, referencia_id)
);

create table auditoria (
    id             bigserial primary key,
    tabela         varchar(60) not null,
    registro_id    varchar(40) not null,
    operacao       char(1) not null check (operacao in ('I','U','D')),
    campo          varchar(60),
    valor_anterior text,
    valor_novo     text,
    usuario_id     int,
    em             timestamptz not null default now()
);
create index ix_auditoria_registro on auditoria (tabela, registro_id);

create table importacao (
    id          bigserial primary key,
    arquivo     varchar(200) not null,
    origem      varchar(40)  not null,
    status      varchar(15)  not null default 'PENDENTE',
    linhas_ok   int not null default 0,
    linhas_erro int not null default 0,
    criado_em   timestamptz not null default now(),
    criado_por  int
);

create table importacao_linha (
    id            bigserial primary key,
    importacao_id bigint not null references importacao(id) on delete cascade,
    linha         int    not null,
    payload       jsonb  not null,
    erro          text
);

-- =============================================================================
-- 10. VIEW DE MINUTOS
--     Minutos de cada turno, por dia da semana, já descontando o intervalo
--     que se aplica àquele tipo de recurso.
-- =============================================================================

create view vw_turno_minutos as
select th.turno_id,
       th.dia_semana,
       th.vigencia,
       tr.tipo_recurso,
       th.min_bruto as duracao_turno,
       th.min_bruto - coalesce(sum(i.minutos) filter (
           where i.descontavel
             and (i.aplica_a = 'AMBOS' or i.aplica_a = tr.tipo_recurso)
       ), 0) as minutos
from turno_horario th
cross join (values ('MAQUINA'), ('PESSOA')) as tr(tipo_recurso)
left join turno_intervalo i on i.turno_id   = th.turno_id
                           and i.dia_semana = th.dia_semana
group by th.turno_id, th.dia_semana, th.vigencia, tr.tipo_recurso, th.min_bruto;
