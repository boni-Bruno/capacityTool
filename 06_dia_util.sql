-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 06. PESO DE DIA ÚTIL
--
-- Quanto cada dia da semana vale na contagem de dias úteis do mês. Segunda a
-- sexta conta 1, sábado trabalhado conta 0,5, domingo conta 0 — mas isso é
-- convenção da casa e muda de empresa para empresa, então fica configurável.
--
-- O peso é POR CALENDÁRIO: a linha de rodízio trabalha domingo e a padrão não,
-- e elas não precisam contar o dia da mesma forma.
--
-- Tabela vazia = comportamento padrão. As linhas só existem quando alguém
-- muda alguma coisa, então não é preciso semear nada.
--
-- Isto NÃO entra no cálculo de capacidade: capacidade é minuto, dia útil é
-- indicador de leitura. Por isso não mexe em 03_motor.sql.
--
-- Rode uma vez no SQL Editor do Neon. É seguro repetir.
-- =============================================================================

create table if not exists calendario_peso (
    calendario_id int          not null references calendario(id) on delete cascade,
    dia_semana    smallint     not null check (dia_semana between 0 and 6),
    peso          numeric(4,2) not null check (peso >= 0 and peso <= 1),
    primary key (calendario_id, dia_semana)
);

comment on table calendario_peso is
    'Quanto cada dia da semana vale na contagem de dias uteis. Sem linha, vale o padrao: seg-sex 1, sabado 0.5, domingo 0.';
