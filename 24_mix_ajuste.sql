-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 24. AJUSTE MANUAL DE MIX
--
-- O mix de um CT — quanto do tempo dele pertence a cada rotulo do DE/PARA — e
-- calculado da carga de demanda, mes a mes. Trocou a carga, mudou o mix. Esta
-- tabela e a camada de ajuste POR CIMA: onde existir mix cadastrado, ele ganha
-- do calculado; onde nao existir, vale a base.
--
-- O ajuste NAO mora na carga de proposito: importar uma base nova nunca mexe
-- no que foi decidido aqui. Ele so muda quando alguem mexer nele.
--
-- GRAO: CT x ano x mes x atributo x rotulo -> %. O ajuste e por atributo
-- porque cada atributo e uma leitura independente do mesmo tempo — ajustar
-- "linha de produto" nao diz nada sobre "familia de tecelagem".
--
-- ROTULO NULO e a parte da demanda que nenhuma regra classifica. Ela entra no
-- mix como qualquer rotulo, por decisao: esconder essa fatia faria os outros
-- percentuais mentirem.
--
-- A SOMA NAO PRECISA DAR 100 AQUI. O servidor normaliza proporcionalmente ao
-- gravar, e o motor normaliza de novo ao ler — a fatia e sempre pct sobre a
-- soma do mes, entao a soma dos rotulos fecha com o total por construcao.
--
-- ORDEM: rode ANTES do deploy do codigo novo.
-- =============================================================================

create table if not exists mix_ajuste (
    id          serial primary key,
    ct          varchar(20) not null,
    ano         smallint    not null,
    mes         smallint    not null check (mes between 1 and 12),
    atributo    varchar(40) not null references demanda_atributo(codigo)
                            on delete cascade,
    rotulo      varchar(80),
    pct         numeric(8,4) not null check (pct >= 0),
    alterado_em timestamptz  not null default now()
);

-- Unicidade com o nulo participando: dois registros "sem rotulo" do mesmo
-- CT/mes seriam a mesma fatia contada duas vezes.
create unique index if not exists ux_mix_chave
    on mix_ajuste (ct, ano, mes, atributo, coalesce(rotulo, ''));

comment on table mix_ajuste is
    'Mix manual por CT/mes/atributo. Onde existe, ganha do mix calculado da '
    'carga; importar base nova nao mexe aqui. Rotulo nulo = parte sem regra.';

-- -----------------------------------------------------------------------------
-- DE ONDE VEM A TAXA DE UM ROTULO QUE O CT NAO PRODUZ NA BASE
--
-- Cadastrar 10% de Mesa num CT cuja demanda nao tem Mesa rateia o tempo, mas
-- nao tem taxa para converter em metros. Aqui o usuario aponta de onde ela
-- vem — um CT que produz aquilo, ou a media de um CC — em vez de o sistema
-- usar a media do proprio CT, que misturaria produtos.
-- -----------------------------------------------------------------------------

create table if not exists mix_taxa (
    ct       varchar(20) not null,
    atributo varchar(40) not null references demanda_atributo(codigo)
                         on delete cascade,
    tipo     varchar(4)  not null check (tipo in ('CT', 'CC')),
    valor    varchar(20) not null,

    primary key (ct, atributo),
    constraint mt_sem_auto check (tipo <> 'CT' or valor <> ct)
);

comment on table mix_taxa is
    'De onde o CT tira a taxa de conversao dos rotulos que ele nao produz na '
    'base, quando o mix manual lhe da uma fatia deles.';
