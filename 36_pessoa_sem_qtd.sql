-- =============================================================================
-- 36 — RECURSO DE PESSOA NÃO TEM QUANTIDADE NO CADASTRO
--
-- A quantidade de pessoas mora NO TURNO, e só lá. Decisão do Bruno em
-- 11/09/2026, e o motivo é este: a Qtd do cadastro de recurso é o teto físico
-- da máquina — quantas existem, e é dela que sai a instalada de 24 h. Para
-- pessoa não há teto: a instalada é a própria planejada (migração 16), e a
-- pergunta que faz sentido é "quantas pessoas trabalham NESTE turno", que
-- muda de turno para turno. Doze no primeiro, oito no segundo, vinte no
-- terceiro é cadastro legítimo, e a tela recusava porque a matriz de turnos
-- não deixava passar da Qtd do cadastro — um limite herdado da máquina que,
-- em pessoa, não significava nada.
--
-- A PARTIR DAQUI:
--   . recurso PESSOA nasce e fica com qt_recursos = 1 no parâmetro. A tela não
--     pergunta, o servidor força. O 1 existe para a multiplicação não zerar;
--     ele não é "uma pessoa";
--   . a matriz de Turnos do recurso, para pessoa, é sempre numérica e sem teto:
--     a célula é quantas pessoas trabalham naquele turno naquele mês, e é
--     gravada como número explícito — nunca como "todas", que para pessoa não
--     quer dizer nada.
--
-- O QUE ESTA MIGRAÇÃO FAZ COM O QUE JÁ EXISTE, e por que a ordem importa:
--
--   1. Todo turno de pessoa gravado como "todas" (qt_recursos nulo) recebe o
--      NÚMERO que "todas" resolvia até hoje — a Qtd do cadastro. Um posto com
--      Qtd 7 marcado nos três turnos passa a ter 7 escrito em cada um. O motor
--      lê coalesce(rt.qt_recursos, rp.qt_recursos), então a planejada é a
--      mesma antes e depois, ao minuto. Sem este passo, o passo 2 faria os 25
--      vínculos em "todas" caírem para 1 pessoa em silêncio no próximo
--      Recalcular.
--   2. Só então a Qtd de todo recurso PESSOA vai para 1.
--
-- O QUE SE PERDE, dito com todas as letras: onze postos da Confecção Cama têm
-- Qtd e NENHUM turno marcado — a quantidade não tem onde ir, e vai para 1.
-- Fica registrada aqui, para quando os turnos deles forem cadastrados:
--
--   465-002-1 CONFECCAO JOGOS CAMA TRUSSARDI     19
--   465-003-1 CONFECCAO COLCHAS KARSTEN          18
--   465-004-1 PREP/ACAB DE BORDADO TRUSSARDI      8
--   465-006-1 PRODUCAO EDREDOM - PESSOAS         16
--   465-007-1 CONFECCAO JOGOS CAMA KARSTEN       19
--   465-009-1 CONFECCAO AVULSO CAMA TRUSSARDI    22
--   465-010-1 CONFECCAO PONTO ROYAL               2
--   465-011-1 COSTURA COLCHAS TRUSSARDI           8
--   465-012-1 ENFESTO E CORTE COLCHA              4
--   465-013-1 ENFESTO/CORTE CAMA - MAQUINA        8
--   465-014-1 ENFESTO/CORTE CAMA - MANUAL         8
--
-- IMPACTO NOS NÚMEROS: nenhum. Rodada guardada não é tocada, e o próximo
-- Recalcular produz a mesma planejada, porque o número que era implícito ficou
-- explícito. Recalcular NÃO é necessário depois desta migração.
--
-- ORDEM: rode ANTES do deploy do código novo. Com o código velho no ar, nada
-- muda de comportamento: ele continua lendo o número explícito do turno.
-- =============================================================================

-- 1. "todas" vira o número que ela valia. Um parâmetro por recurso, que é como
--    a tela grava; se um dia houver vigências partidas, vale a que cruza a do
--    turno, e na falta dela a mais recente.
update recurso_turno rt
   set qt_recursos = (
        select rp.qt_recursos
          from recurso_parametro rp
         where rp.recurso_id = rt.recurso_id
         order by (rp.vigencia && rt.vigencia) desc, lower(rp.vigencia) desc nulls last
         limit 1)
 where rt.qt_recursos is null
   and exists (select 1 from recurso r
                where r.id = rt.recurso_id and r.tipo_recurso = 'PESSOA');

-- 2. A Qtd de pessoa passa a ser 1 — o valor que a tela deixa de perguntar.
update recurso_parametro rp
   set qt_recursos = 1
  from recurso r
 where r.id = rp.recurso_id
   and r.tipo_recurso = 'PESSOA'
   and rp.qt_recursos <> 1;

-- CONFERÊNCIA: nenhum turno de pessoa em "todas", nenhuma pessoa com Qtd <> 1.
--
--   select (select count(*) from recurso_turno rt join recurso r on r.id = rt.recurso_id
--            where r.tipo_recurso = 'PESSOA' and rt.qt_recursos is null) as em_todas,
--          (select count(*) from recurso_parametro rp join recurso r on r.id = rp.recurso_id
--            where r.tipo_recurso = 'PESSOA' and rp.qt_recursos <> 1) as qtd_diferente_de_1;
