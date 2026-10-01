-- =============================================================================
-- 45. VERSOES DO CENARIO — A UNIDADE DE TRABALHO DEIXA DE SER O ANO
--
-- Pedido do Bruno em 01/10/2026, e a informacao que mudou o desenho veio dele:
-- o orcamento NAO E UM EVENTO, E UM CICLO. Comeca em setembro, bate o martelo em
-- novembro ou dezembro, e no meio do caminho sao TRES A SEIS VERSOES, cada uma
-- com mudanca de cadastro.
--
-- Isso quebrava o modelo em dois lugares:
--
--   1. A versao anterior DESAPARECIA. O cadastro e sobrescrito, e "uma rodada
--      por (area, ano, origem)" quer dizer que os numeros da v3 somem quando a
--      v4 roda. Ninguem conseguia responder "por que a capacidade mudou entre a
--      v3 e a v4?", que e a pergunta que a reuniao de orcamento faz.
--
--   2. O checklist de revisao que esta entrega existe para criar viraria inutil
--      na segunda rodada: tudo apareceria "concluido", e o feriado que entrou em
--      outubro nao avisaria ninguem.
--
-- Entao a unidade de trabalho passa a ser a VERSAO DO ANO.
--
-- UMA VERSAO ABERTA POR (cenario, ano), e quem garante e o banco, com um indice
-- parcial unico. Duas abertas seriam duas pessoas cadastrando coisas diferentes
-- achando que e a mesma — e o erro so apareceria no numero, semanas depois.
--
-- A FOTOGRAFIA E MENSAL, E ESSA E A DECISAO CARA. Guardar a capacidade_fato de
-- cada versao custaria ~88 MB por versao: seis versoes do Orcamento 2027
-- passariam de 500 MB sozinhas e estourariam o banco (medicao de 29/09). O grao
-- de MES custa ~4.700 linhas e ~1 MB por versao, e responde tudo que a reuniao
-- pergunta — o dia a dia nao responde nenhuma pergunta a mais, so pesa.
--
-- PASSOS_EXIGIDOS FICA NO BANCO, e nao em codigo, porque e decisao de quem
-- abriu a versao naquele dia: "a v4 so mexeu em jornada e OEE" e uma escolha do
-- gestor, e e ela que o fluxo cobra. O sistema nao tem como adivinhar o que
-- mudou — recurso_turno, recurso_calendario e recurso_oee nao gravam quando
-- foram alterados nem por quem.
--
-- O FECHAMENTO DE CENARIO que o Bruno pediu em 30/09 esta aqui dentro: versao
-- fechada e exatamente "ninguem mexe mais nisso". Nao precisou de feature
-- separada, so do ciclo certo.
--
-- A SEMENTE E OBRIGATORIA E E O RISCO DESTA MIGRACAO: 2026 e 2027 nos dois
-- cenarios entram com uma v1 aberta. Sem ela a ferramenta congela no deploy —
-- sem versao aberta nao ha ano cadastravel, e ninguem consegue nem corrigir o
-- que ja existe.
--
-- ORDEM: pode rodar antes do deploy. Enquanto o codigo nao le estas tabelas,
-- elas sao inertes; a trava so passa a valer no commit que a implementa.
-- =============================================================================

create table cenario_versao (
    id              serial primary key,
    origem          varchar(10) not null
                    check (origem in ('META', 'SIMULADO')),
    ano             int not null check (ano between 2000 and 2100),
    numero          int not null check (numero > 0),

    -- "v3 - depois do corte da Renner". E o que distingue duas versoes do mesmo
    -- ano daqui a dois meses; o numero sozinho nao lembra nada a ninguem.
    rotulo          varchar(80),

    -- Quais etapas ESTA versao exige, em codigo (ver lib/versao.js, PASSOS).
    passos_exigidos text[] not null,

    aberta_em       timestamptz not null default now(),
    aberta_por      int references usuario(id) on delete set null,
    fechada_em      timestamptz,
    fechada_por     int references usuario(id) on delete set null,
    observacao      text,

    unique (origem, ano, numero)
);

create unique index cv_uma_aberta on cenario_versao (origem, ano)
    where fechada_em is null;

comment on table cenario_versao is
    'Uma versao do planejamento de um (cenario, ano). Fechada = ninguem mexe mais.';

-- -----------------------------------------------------------------------------
-- O PROGRESSO DA REVISAO
--
-- E o que faz "nao esquecer de revisar nada" ser verdade: sem progresso gravado,
-- fechar o navegador perde a trilha e a tela nao teria o que mostrar. Por VERSAO
-- e nao por ano, senao a segunda rodada nasceria toda concluida.
--
-- Concluir e EXPLICITO (um clique em "Confirmei esta etapa"), e nao automatico
-- ao sair da tela: passar por uma tela nao e te-la revisado.
-- -----------------------------------------------------------------------------

create table planejamento_passo (
    versao_id     int not null references cenario_versao(id) on delete cascade,
    area_id       int not null references area(id) on delete cascade,
    passo         varchar(20) not null,
    concluido_em  timestamptz not null default now(),
    concluido_por int references usuario(id) on delete set null,
    primary key (versao_id, area_id, passo)
);

-- -----------------------------------------------------------------------------
-- A FOTOGRAFIA, tirada ao fechar a versao.
--
-- Recurso x MES. Nao guarda cadastro nem dia: guarda o RESULTADO, que e o que se
-- compara. A origem dos numeros e capacidade_fato e vw_instalada_dia agregados
-- por mes no instante do fechamento — depois disso a rodada pode ser
-- sobrescrita a vontade que esta linha nao muda.
-- -----------------------------------------------------------------------------

create table versao_fato (
    versao_id      int not null references cenario_versao(id) on delete cascade,
    recurso_id     int not null references recurso(id) on delete cascade,
    area_id        int not null,
    mes            date not null,
    min_instalada  numeric,
    min_planejada  numeric,
    min_disponivel numeric,
    primary key (versao_id, recurso_id, mes)
);

create index ix_vf_versao_mes on versao_fato (versao_id, mes);

-- -----------------------------------------------------------------------------
-- A SEMENTE. Ver o cabecalho: sem isto a ferramenta congela no deploy.
--
-- Os anos sao os que tem rodada hoje (2026 e 2027), nos dois cenarios, com todos
-- os passos exigidos — o que ja esta cadastrado entra como revisao, nao como
-- redigitacao. `aberta_por` fica nulo: ninguem abriu, a migracao abriu.
-- -----------------------------------------------------------------------------

insert into cenario_versao (origem, ano, numero, rotulo, passos_exigidos)
select o.origem, a.ano, 1, 'v1 - aberta pela migracao 45',
       array['recursos', 'jornada', 'oee', 'paradas', 'recalcular', 'conferir']
  from (values ('META'), ('SIMULADO')) as o(origem)
 cross join (values (2026), (2027)) as a(ano);
