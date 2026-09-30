-- =============================================================================
-- 41. DOIS CENARIOS DE CONFIGURACAO, ISOLADOS: ORCAMENTO E SIMULACAO
--
-- Pedido do Bruno em 30/09/2026, depois do estudo de tamanho do banco. Ele quer
-- comparar duas configuracoes lado a lado — "e se esta maquina rodar 3 turnos no
-- segundo semestre?" — e a saida obvia (uma branch do Neon por cenario) custava
-- ~310 MB cada e obrigava a sair do plano gratuito.
--
-- O EIXO JA EXISTIA E ESTAVA QUASE VAZIO. A rodada e por (area, ano, ORIGEM)
-- desde o comeco, e a capacidade_fato ja guarda os dois calculos em paralelo —
-- 221 mil linhas de 2027 vezes dois. So que a unica coisa que mudava entre META
-- e SIMULADO era o OEE: turno, calendario e quantidade eram os mesmos. Ou seja,
-- ja se pagava o armazenamento de dois cenarios e os dois eram iguais.
--
-- Esta migracao termina o que estava pela metade.
--
-- ISOLADOS, E NAO BASE MAIS DIFERENCA. A primeira versao desta migracao tinha
-- uma sentinela 'AMBAS': o Orcamento seria a base e a Simulacao so o que mudasse
-- por cima. O Bruno derrubou, e ele esta certo sobre o uso real: os dois planos
-- vem de lugares diferentes — a Simulacao e construida aqui dentro, o Orcamento
-- chega das fabricas e e digitado — e nao sao versoes um do outro. Heranca entre
-- eles faria uma correcao no Orcamento mexer calado num numero de Simulacao que
-- alguem ja tinha aprovado. Cada linha de cadastro pertence a UM cenario, ponto.
--
-- E o isolamento sai mais barato de ler: o motor deixa de ter regra de queda, e
-- vira `and origem = p_origem` em cada junção.
--
-- PARA ONDE VAI O QUE JA EXISTE: tudo para SIMULACAO. E o que o Bruno cadastrou
-- ate aqui e e o cenario que ele esta construindo; o Orcamento chega depois.
--
-- O ORCAMENTO NASCE VAZIO AQUI, E E DE PROPOSITO — a semente dele ficou para a
-- 43, que roda junto com o deploy do codigo que sabe de cenario.
--
-- A primeira versao desta migracao ja copiava maquinas e regime para META. Foi
-- aplicada, conferida e DESFEITA no mesmo dia, porque ela quebra o app que esta
-- no ar: com duas linhas por recurso em recurso_parametro, `recursos()` e a
-- lista de Recursos passam a duplicar cada maquina, e `definirTurnosDoAno` e
-- `definirCalendarioDoAno` — que apagam por recurso_id, sem origem — apagariam o
-- cadastro dos DOIS cenarios de uma vez.
--
-- A licao esta no CLAUDE.md e vale repetir: migracao vai ANTES do deploy, mas
-- migracao que muda a cardinalidade de uma tabela so pode ir antes do deploy que
-- a acompanha. Enquanto so existe uma linha por recurso, o app de hoje continua
-- correto sem saber de nada.
--
-- O DEFAULT 'SIMULADO' FICA, POR ORA. Com dois cenarios isolados, escrita que
-- esquece a origem escolhendo um deles por sorteio e exatamente o tipo de
-- silencio que este projeto evita — e o default sai na 43, quando as telas
-- passarem a perguntar. Ate la ele e a rede: o codigo que esta no ar nao sabe de
-- cenario, e sem default toda gravacao de turno, regime ou parametro quebraria
-- entre esta migracao e o proximo deploy.
--
-- OS CODIGOS NO BANCO CONTINUAM META E SIMULADO. Os rotulos na tela viram
-- "Orcamento" e "Simulacao" (lib/origens.js). Renomear o valor gravado obrigaria
-- a reescrever calculo_execucao, recurso_oee e toda URL ja compartilhada, para
-- ganhar nada: codigo e rotulo serem coisas diferentes ja e a regra do projeto
-- em TELAS.
--
-- O QUE NAO ENTRA POR ORA: parada. Ela nao tem vigencia (e evento com data), e a
-- alavanca de cenario que o Bruno descreveu e turno, regime e quantidade. Fica
-- registrado como o proximo passo se fizer falta.
--
-- ORDEM: esta PRIMEIRO, a 42 (o motor) logo em seguida, e so entao o deploy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AS COLUNAS — nascem preenchidas com SIMULADO, que e para onde vai o que ja
--    existe, e perdem o default logo depois.
-- -----------------------------------------------------------------------------

alter table recurso_turno
    add column origem varchar(10) not null default 'SIMULADO'
        check (origem in ('META', 'SIMULADO'));

alter table recurso_calendario
    add column origem varchar(10) not null default 'SIMULADO'
        check (origem in ('META', 'SIMULADO'));

alter table recurso_parametro
    add column origem varchar(10) not null default 'SIMULADO'
        check (origem in ('META', 'SIMULADO'));

comment on column recurso_turno.origem is
    'Cenario a que esta linha pertence. Os dois sao isolados: nao ha heranca.';
comment on column recurso_calendario.origem is
    'Cenario a que esta linha pertence. Os dois sao isolados: nao ha heranca.';
comment on column recurso_parametro.origem is
    'Cenario a que esta linha pertence. Os dois sao isolados: nao ha heranca.';

-- -----------------------------------------------------------------------------
-- 2. AS RESTRICOES DE SOBREPOSICAO
--
-- A origem entra na chave: as duas linhas do mesmo recurso no mesmo periodo sao
-- legitimas quando sao de cenarios diferentes — e justamente isso que o cenario
-- e. O que continua proibido e duas linhas do MESMO cenario se sobrepondo, que
-- seria o motor escolhendo uma delas por acaso.
--
-- O recurso_oee ja fazia assim desde a 01 (origem WITH = no exclude); as tres
-- abaixo so passam a seguir o mesmo desenho.
-- -----------------------------------------------------------------------------

alter table recurso_turno      drop constraint rt_sem_sobreposicao;
alter table recurso_calendario drop constraint rc_sem_sobreposicao;
alter table recurso_parametro  drop constraint rp_sem_sobreposicao;

alter table recurso_turno add constraint rt_sem_sobreposicao
    exclude using gist (recurso_id with =, turno_id with =,
                        origem with =, vigencia with &&);

alter table recurso_calendario add constraint rc_sem_sobreposicao
    exclude using gist (recurso_id with =, origem with =, vigencia with &&);

alter table recurso_parametro add constraint rp_sem_sobreposicao
    exclude using gist (recurso_id with =, origem with =, vigencia with &&);

-- -----------------------------------------------------------------------------
-- 3. O ORCAMENTO, NAO — ver a 43.
--
-- Semear META aqui deixaria duas linhas por recurso num app que ainda apaga e
-- lista por recurso_id sem olhar origem. A semente vai na 43, junto com o
-- codigo que sabe de cenario.
-- -----------------------------------------------------------------------------
