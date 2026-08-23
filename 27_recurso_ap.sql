-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 27. QUANTIDADE DE RECURSO DO AP
--
-- O AP conta quantos recursos existem em cada centro de trabalho, e a extracao
-- precisa disso para dividir a capacidade e entregar o numero POR RECURSO —
-- que e como o outro sistema raciocina.
--
-- A informacao vem de la, importada do parquet de recursos do AP, e nao e
-- cadastrada aqui: ela e a verdade do outro sistema sobre o proprio parque.
-- Digitar a mao seria manter uma segunda copia que diverge no primeiro mes.
--
-- UM CAMPO SO, e nao dois. O arquivo separa QTMAQUINA de QTPESSOAS e usa
-- INDICADORCALCULOCAPACIDADE para dizer qual vale; a escolha acontece na
-- leitura (lib/ap.js) e aqui chega resolvida. Para dividir a capacidade tanto
-- faz se o recurso tem motor — o que importa e por quantos o tempo se reparte.
--
-- SEM VERSAO, ao contrario da carga de demanda. A demanda e um plano, e planos
-- se comparam; isto e um retrato do parque, e retrato velho nao serve para
-- nada. A importacao substitui o que havia.
--
-- ORDEM: rode ANTES do deploy do codigo novo.
-- =============================================================================

create table if not exists recurso_ap (
    -- No formato CC-CT, como vem do AP e como a extracao ja agrupa.
    ct          varchar(20) primary key,
    -- Quantos recursos o AP conta neste centro. Zero e resposta legitima:
    -- faccao e servico externo nao tem parque, e o AP nao calcula capacidade
    -- ali. A extracao deixa a coluna vazia em vez de dividir por zero.
    qtd         int         not null default 0 check (qtd >= 0),
    -- 'M', 'P' ou vazio, como veio. Guardado para a tela poder explicar de qual
    -- campo o numero saiu, sem obrigar ninguem a abrir o parquet.
    indicador   varchar(1),
    descricao   varchar(160),
    extraido_em timestamptz,
    criado_em   timestamptz not null default now()
);

comment on table recurso_ap is
    'Quantidade de recurso por centro de trabalho, importada do AP. Divisor da '
    'capacidade na extracao. Retrato do parque, sem versao: a importacao '
    'substitui o que havia.';
