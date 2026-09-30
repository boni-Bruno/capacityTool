-- =============================================================================
-- 43. O ORCAMENTO GANHA A FABRICA — E A ORIGEM VIRA OBRIGATORIA
--
-- Roda JUNTO com o deploy do codigo que sabe de cenario, e nao antes. Ela e a
-- metade que faltava da 41, separada de proposito: a 41 sozinha nao pode
-- duplicar linha nenhuma, porque o app que estava no ar lia e apagava por
-- recurso_id sem olhar origem — duas linhas por recurso e ele duplicaria a lista
-- de Recursos e apagaria os dois cenarios a cada salvamento.
--
-- 1. O ORCAMENTO RECEBE AS MAQUINAS E O REGIME, nao a jornada.
--
--    recurso_parametro e recurso_calendario sao copiados da Simulacao. As duas
--    coisas nao sao escolha de plano — sao a fabrica que existe —, e sem elas o
--    Orcamento seria inutilizavel: a tela de Recursos lista por
--    recurso_parametro, entao sem parametro nao ha recurso para escolher e nao
--    ha onde cadastrar turno nenhum. O regime vai junto pela armadilha da 40:
--    recurso sem calendario nao sai zerado, SOME do calculo.
--
--    recurso_turno NAO e copiado. E o que vem das fabricas, e e o que o Bruno
--    vai digitar. Com isso o Orcamento nasce valido e com capacidade ZERO —
--    zero que se explica sozinho ("nao tem turno cadastrado"), e nao ausencia
--    calada.
--
--    Os ids sao novos: as duas linhas seguem a vida delas separadas daqui em
--    diante, e mexer numa nunca mexe na outra.
--
-- 2. O DEFAULT SAI.
--
--    Na 41 as colunas nasceram com default 'SIMULADO' para a linha velha cair na
--    Simulacao e para o codigo antigo continuar gravando em algum lugar valido
--    entre as duas migracoes. Agora quem grava diz em qual cenario esta, e o
--    default vira o oposto de uma rede: gravacao que esquecer a origem passaria
--    a escolher um cenario por sorteio, e o erro so apareceria como numero
--    errado num painel, semanas depois.
--
-- ORDEM: junto com o deploy. Antes dele, a tela de Recursos duplica.
--
-- DEPOIS DE APLICAR: rodar "Recalcular tudo". A Simulacao sai igual ao que ja
-- estava; o Orcamento passa a existir, com instalada (as maquinas) e planejada
-- zero (sem jornada).
-- =============================================================================

insert into recurso_parametro
    (recurso_id, vigencia, equivalencia, qt_recursos, status_cadastro,
     observacao, criado_em, criado_por, origem)
select recurso_id, vigencia, equivalencia, qt_recursos, status_cadastro,
       observacao, criado_em, criado_por, 'META'
  from recurso_parametro
 where origem = 'SIMULADO'
   and not exists (select 1 from recurso_parametro m
                    where m.recurso_id = recurso_parametro.recurso_id
                      and m.origem = 'META');

insert into recurso_calendario (recurso_id, calendario_id, vigencia, origem)
select recurso_id, calendario_id, vigencia, 'META'
  from recurso_calendario
 where origem = 'SIMULADO'
   and not exists (select 1 from recurso_calendario m
                    where m.recurso_id = recurso_calendario.recurso_id
                      and m.origem = 'META');

alter table recurso_turno      alter column origem drop default;
alter table recurso_calendario alter column origem drop default;
alter table recurso_parametro  alter column origem drop default;
