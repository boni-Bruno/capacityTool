-- =============================================================================
-- 29 — AS CORES DA OCUPAÇÃO NO DOCUMENTO
--
-- O slide já mostra a ocupação mês a mês. Ler doze porcentagens e achar as que
-- estouram é o que ninguém faz numa reunião: a cor é que faz o mês problemático
-- saltar antes de alguém terminar de ler a linha.
--
-- QUAL COR PARA QUAL FAIXA É DECISÃO DE QUEM APRESENTA, e não do sistema. Numa
-- fábrica 95% já é aperto; noutra, 105% é normal porque o plano é agressivo de
-- propósito. Chutar essa régua em código seria pintar de vermelho um mês que o
-- Bruno considera bom — e ele não teria como discordar.
--
-- É a única cor do documento que NÃO vem do tema do modelo. As do gráfico vêm
-- (accent1, accent2, tx1), porque um azul nosso no meio da paleta da empresa
-- denuncia que o slide foi colado. Esta é diferente: ela não decora, ela
-- informa, e quem escolhe é quem conhece a régua.
--
-- SEM SOBREPOSIÇÃO, garantido pelo banco. Duas faixas cobrindo 90% dariam duas
-- cores para o mesmo número, e a que ganhasse dependeria da ordem em que o
-- banco devolvesse as linhas — ou seja, mudaria sozinha. `exclude using gist`
-- é a mesma trava que o projeto já usa para vigência de turno e de OEE.
--
-- BURACO É PERMITIDO, e de propósito: faixa nenhuma cobrindo 40% quer dizer
-- "40% não merece cor", que é uma resposta legítima. Obrigar a cobrir de 0 a
-- infinito forçaria a inventar uma cor para o que não interessa.
--
-- O intervalo é `[de, ate)` — fechado embaixo, aberto em cima. Assim "85 a 100"
-- e "100 a 115" se encostam sem se sobrepor, e 100% cai na segunda, que é como
-- se lê "de 100 em diante".
-- =============================================================================

create table if not exists faixa_ocupacao (
    id       serial primary key,
    -- Em pontos percentuais: 0.85 seria 0,85%, e não 85%. Guardar o número como
    -- ele é lido evita a conversão silenciosa que ninguém lembra de fazer.
    faixa    numrange    not null,
    cor      varchar(7)  not null check (cor ~ '^#[0-9A-Fa-f]{6}$'),
    rotulo   varchar(40),
    criado_em timestamptz not null default now(),

    constraint faixa_ocupacao_nao_vazia check (not isempty(faixa)),
    constraint faixa_ocupacao_sem_sobreposicao exclude using gist (faixa with &&)
);

comment on table faixa_ocupacao is
    'Faixas de ocupação e a cor que a célula recebe no documento das configurações.';

-- Um ponto de partida razoável, para a tela não abrir vazia na primeira vez.
-- Só entra se a tabela estiver vazia: rodar a migração de novo não pode
-- ressuscitar faixa que alguém apagou de propósito.
insert into faixa_ocupacao (faixa, cor, rotulo)
select * from (values
    (numrange(0,   85,  '[)'), '#2E7D32', 'folga'),
    (numrange(85,  100, '[)'), '#F9A825', 'apertado'),
    (numrange(100, null, '[)'), '#C62828', 'estourado')
) as v(faixa, cor, rotulo)
where not exists (select 1 from faixa_ocupacao);
