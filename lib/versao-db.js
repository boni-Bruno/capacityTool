import { sql } from './db';
import { CODIGOS, limpaPassos, proximoNumero } from './versao';

// Consultas das versões do cenário (migração 45). A REGRA mora em lib/versao.js
// e em lib/prontidao.js, que são puros; aqui só se lê e se grava.

export async function versoes() {
  return sql`
    select v.id, v.origem, v.ano, v.numero, v.rotulo, v.passos_exigidos,
           v.aberta_em, v.fechada_em, v.observacao,
           a.nome as aberta_por_nome,
           f.nome as fechada_por_nome,
           (select count(*) from versao_fato vf where vf.versao_id = v.id) as fotos
      from cenario_versao v
      left join usuario a on a.id = v.aberta_por
      left join usuario f on f.id = v.fechada_por
     order by v.origem, v.ano desc, v.numero desc`;
}

/**
 * O progresso de cada área numa versão: quais passos já foram confirmados.
 *
 * Devolve TODA área, mesmo as sem passo nenhum — é a lista do passo 0 do fluxo,
 * e área que ainda não começou é justamente a que precisa aparecer.
 */
export async function progressoDaVersao(versaoId) {
  return sql`
    select ar.id as area_id, ar.nome as area, p.nome as planta, ar.planta_id,
           coalesce(array_agg(pp.passo order by pp.passo)
                    filter (where pp.passo is not null), '{}') as feitos
      from area ar
      join planta p on p.id = ar.planta_id
      left join planejamento_passo pp
             on pp.area_id = ar.id and pp.versao_id = ${Number(versaoId)}
     where ar.ativo and p.ativo
     group by ar.id, ar.nome, p.nome, ar.planta_id
     order by p.nome, ar.nome`;
}

/**
 * Os números que o checklist de prontidão consome, por planta.
 *
 * Uma consulta só para todas as plantas: o checklist é mostrado para a lista
 * inteira de uma vez, e uma consulta por planta seria N round trips num driver
 * que faz uma requisição por instrução.
 *
 * `excecao` não tem planta direto — ela alcança por `excecao_calendario`, e o
 * calendário é que é da planta. Por isso o distinct: a mesma exceção marcada em
 * dois calendários da planta é um feriado, não dois.
 */
export async function prontidaoBruta(ano) {
  return sql`
    select p.id as planta_id, p.nome as planta,
           (select count(*) from calendario c where c.planta_id = p.id)
             as calendarios,
           (select count(*) from calendario c
             where c.planta_id = p.id
               and not exists (select 1 from calendario_dia cd
                                where cd.calendario_id = c.id))
             as calendarios_sem_dia,
           (select count(distinct e.id)
              from excecao e
              join excecao_calendario ec on ec.excecao_id = e.id
              join calendario c on c.id = ec.calendario_id
             where c.planta_id = p.id
               and extract(year from e.data) = ${Number(ano)})
             as excecoes_do_ano,
           (select count(distinct e.id)
              from excecao e
              join excecao_calendario ec on ec.excecao_id = e.id
              join calendario c on c.id = ec.calendario_id
             where c.planta_id = p.id
               and extract(year from e.data) = ${Number(ano) - 1})
             as excecoes_do_ano_anterior,
           (select count(*) from turno t where t.planta_id = p.id and t.ativo)
             as turnos_ativos,
           (select count(*) from turno t
             where t.planta_id = p.id and t.ativo
               and not exists (select 1 from turno_horario th
                                where th.turno_id = t.id))
             as turnos_sem_horario
      from planta p
     where p.ativo
     order by p.nome`;
}

// -----------------------------------------------------------------------------
// ESCRITA
// -----------------------------------------------------------------------------

/**
 * Abre a versão seguinte de um (cenário, ano).
 *
 * O índice parcial único do banco é quem garante que só há uma aberta — e por
 * isso a colisão vira mensagem em português aqui, em vez de subir como erro de
 * constraint. Duas abertas seriam duas pessoas cadastrando coisas diferentes
 * achando que é a mesma.
 */
export async function abrirVersao(origem, ano, { rotulo, passos, usuarioId }) {
  const exigidos = limpaPassos(passos?.length ? passos : CODIGOS);
  if (!exigidos.length) {
    throw new Error('A versão precisa exigir ao menos uma etapa — '
      + 'uma versão que não pede revisão de nada já nasce fechada.');
  }

  const lista = await sql`
    select origem, ano, numero, fechada_em from cenario_versao
     where origem = ${origem} and ano = ${Number(ano)}`;

  if (lista.some((v) => !v.fechada_em)) {
    throw new Error('Já existe uma versão aberta para este cenário e ano. '
      + 'Feche-a antes de abrir a próxima.');
  }

  const numero = proximoNumero(lista, origem, Number(ano));
  const r = await sql`
    insert into cenario_versao
           (origem, ano, numero, rotulo, passos_exigidos, aberta_por)
    values (${origem}, ${Number(ano)}, ${numero},
            ${String(rotulo ?? '').trim() || null},
            ${exigidos}::text[], ${usuarioId ?? null})
    returning id, numero`;
  return r[0];
}

/**
 * Fecha a versão e tira a FOTOGRAFIA — as duas coisas na mesma transação.
 *
 * Fechar sem fotografar deixaria uma versão que ninguém consegue comparar, e
 * fotografar sem fechar deixaria a foto envelhecendo enquanto o cadastro muda.
 *
 * A foto sai de `capacidade_fato` e `vw_instalada_dia` agregadas por MÊS, da
 * rodada mais recente de cada área naquele (cenário, ano). Depois disso a rodada
 * pode ser sobrescrita à vontade que esta linha não muda — é esse o ponto.
 */
export async function fecharVersao(versaoId, { usuarioId, observacao }) {
  const v = Number(versaoId);
  const atual = await sql`
    select id, origem, ano, fechada_em from cenario_versao where id = ${v}`;
  if (!atual.length) throw new Error('Versão não encontrada.');
  if (atual[0].fechada_em) throw new Error('Esta versão já está fechada.');

  const { origem, ano } = atual[0];
  const de = `${ano}-01-01`;
  const ate = `${ano}-12-31`;

  await sql.transaction([
    sql`
      insert into versao_fato
             (versao_id, recurso_id, area_id, mes,
              min_instalada, min_planejada, min_disponivel)
      with rodada as (
        -- A mais recente de cada área: o fechamento fotografa o que está no ar,
        -- e o que está no ar é a última rodada de cada área.
        select distinct on (area_id) id, area_id
          from calculo_execucao
         where status = 'OK' and origem = ${origem}
           and periodo_inicio >= ${de}::date and periodo_fim <= ${ate}::date
         order by area_id, iniciado_em desc
      ),
      fato as (
        select cf.recurso_id, cf.area_id,
               date_trunc('month', cf.data)::date as mes,
               sum(cf.min_planejada)  as planejada,
               sum(cf.min_disponivel) as disponivel
          from capacidade_fato cf
          join rodada r on r.id = cf.execucao_id
         group by 1, 2, 3
      ),
      inst as (
        select i.recurso_id, i.area_id,
               date_trunc('month', i.data)::date as mes,
               sum(i.min_instalada) as instalada
          from vw_instalada_dia i
          join rodada r on r.id = i.execucao_id
         group by 1, 2, 3
      ),
      meses as (
        select recurso_id, area_id, mes from fato
        union
        select recurso_id, area_id, mes from inst
      )
      -- A área entra no join por garantia, e não por necessidade: hoje o recurso
      -- tem uma área só, então (recurso, mês) já é único. Se um dia ele puder
      -- mudar de área, sem isto a foto duplicaria a linha calada.
      select ${v}, m.recurso_id, m.area_id, m.mes,
             inst.instalada, fato.planejada, fato.disponivel
        from meses m
        left join fato on fato.recurso_id = m.recurso_id
                      and fato.area_id    = m.area_id
                      and fato.mes        = m.mes
        left join inst on inst.recurso_id = m.recurso_id
                      and inst.area_id    = m.area_id
                      and inst.mes        = m.mes`,
    sql`
      update cenario_versao
         set fechada_em = now(), fechada_por = ${usuarioId ?? null},
             observacao = ${String(observacao ?? '').trim() || null}
       where id = ${v}`,
  ]);

  const n = await sql`
    select count(*)::int as linhas from versao_fato where versao_id = ${v}`;
  return { linhas: n[0].linhas };
}

/** Marca (ou desmarca) uma etapa como revisada numa área. */
export async function marcarPasso(versaoId, areaId, passo, usuarioId, feito = true) {
  if (!CODIGOS.includes(passo)) throw new Error('Etapa desconhecida.');
  const v = Number(versaoId);
  const a = Number(areaId);

  const aberta = await sql`
    select 1 from cenario_versao where id = ${v} and fechada_em is null`;
  if (!aberta.length) {
    throw new Error('Esta versão está fechada — não há mais o que revisar nela.');
  }

  if (!feito) {
    await sql`
      delete from planejamento_passo
       where versao_id = ${v} and area_id = ${a} and passo = ${passo}`;
    return { feito: false };
  }

  // Reconfirmar é inofensivo e não deve dar erro: quem clica duas vezes está
  // dizendo a mesma coisa.
  await sql`
    insert into planejamento_passo (versao_id, area_id, passo, concluido_por)
    values (${v}, ${a}, ${passo}, ${usuarioId ?? null})
    on conflict (versao_id, area_id, passo) do nothing`;
  return { feito: true };
}

/**
 * AS ANOMALIAS DE UMA ÁREA NUM ANO E CENÁRIO — o passo "Conferir" do fluxo.
 *
 * Tudo aqui é cadastro que o motor aceita e que produz número errado em
 * silêncio. Nenhuma é erro de digitação — são ausências, e ausência não dá
 * mensagem em lugar nenhum:
 *
 *   SEM TURNO     recurso que não roda em mês nenhum. Planejada zero, e some do
 *                 painel como se não existisse.
 *   SEM REGIME    mês sem calendário. O motor casa o dia com o calendário por
 *                 INNER JOIN, então o recurso não sai zerado: SOME do mês.
 *   OEE 100%      nunca medido. Não é erro, é "ainda não medi" — mas uma área
 *                 inteira em 100% quase sempre é cadastro que ficou para trás.
 *
 * Uma consulta só: são três varreduras na mesma área, e em três requisições
 * pagaríamos três round trips por um resultado que cabe num `union all`.
 */
export async function anomalias(areaId, ano, origem) {
  const a = Number(areaId);
  const ini = `${Number(ano)}-01-01`;
  const fim = `${Number(ano) + 1}-01-01`;

  return sql`
    with alvo as (
      select r.id, r.codigo, r.nome
        from recurso r
        join recurso_parametro rp on rp.recurso_id = r.id
                                 and rp.origem = ${origem}
                                 and rp.status_cadastro
       where r.area_id = ${a}
    ),
    -- Os meses que o regime NÃO cobre, pelo primeiro dia de cada mês: é o mesmo
    -- critério de lib/faixas.js (mesesDescobertos), feito no banco porque aqui
    -- são 50 recursos de uma vez.
    meses as (
      select generate_series(${ini}::date, (${fim}::date - 1), interval '1 month')::date as m
    )
    select 'sem_turno' as tipo, a.id as recurso_id, a.codigo, a.nome,
           null::text as detalhe
      from alvo a
     where not exists (
       select 1 from recurso_turno rt
        where rt.recurso_id = a.id and rt.origem = ${origem}
          and rt.vigencia && daterange(${ini}::date, ${fim}::date))

    union all
    select 'sem_regime', a.id, a.codigo, a.nome,
           string_agg(to_char(m.m, 'Mon'), ', ' order by m.m)
      from alvo a
     cross join meses m
     where not exists (
       select 1 from recurso_calendario rc
        where rc.recurso_id = a.id and rc.origem = ${origem}
          and rc.vigencia @> m.m)
     group by a.id, a.codigo, a.nome

    union all
    select 'oee_cem', a.id, a.codigo, a.nome, null
      from alvo a
     where not exists (
       select 1 from recurso_oee o
        where o.recurso_id = a.id and o.origem = ${origem}
          and o.oee_pct <> 1.0
          and o.vigencia && daterange(${ini}::date, ${fim}::date))

     order by 1, 3`;
}

/**
 * A planejada da área neste ano contra a do ano anterior, no mesmo cenário.
 *
 * Salto grande é sinal — não é erro, e por isso não entra em `anomalias`: pode
 * ser uma máquina nova legítima. Mas vale ser dito antes de fechar a versão.
 */
export async function contraAnoAnterior(areaId, ano, origem) {
  return sql`
    with rodadas as (
      select distinct on (extract(year from periodo_inicio)) id,
             extract(year from periodo_inicio)::int as ano
        from calculo_execucao
       where status = 'OK' and origem = ${origem} and area_id = ${Number(areaId)}
         and extract(year from periodo_inicio) in (${Number(ano)}, ${Number(ano) - 1})
       order by extract(year from periodo_inicio), iniciado_em desc
    )
    select r.ano, sum(cf.min_planejada)::float8 as planejada
      from rodadas r
      join capacidade_fato cf on cf.execucao_id = r.id
     group by r.ano order by r.ano`;
}

/**
 * A comparação de duas versões, mês a mês — a pergunta da reunião de orçamento.
 *
 * Soma por mês; o recurso fica de fora de propósito nesta leitura, que é a de
 * cima. Descer ao recurso é outra consulta, e só faz sentido depois de o mês
 * apontar onde olhar.
 */
export async function compararVersoes(versaoA, versaoB, areaIds = null) {
  const areas = (areaIds ?? []).join(',') || null;
  return sql`
    select coalesce(a.mes, b.mes)::text            as mes,
           coalesce(a.instalada, 0)::float8        as instalada_a,
           coalesce(b.instalada, 0)::float8        as instalada_b,
           coalesce(a.planejada, 0)::float8        as planejada_a,
           coalesce(b.planejada, 0)::float8        as planejada_b,
           coalesce(a.disponivel, 0)::float8       as disponivel_a,
           coalesce(b.disponivel, 0)::float8       as disponivel_b
      from (select mes, sum(min_instalada) as instalada,
                   sum(min_planejada) as planejada,
                   sum(min_disponivel) as disponivel
              from versao_fato
             where versao_id = ${Number(versaoA)}
               and (${areas}::text is null
                    or area_id = any(string_to_array(${areas}, ',')::int[]))
             group by mes) a
      full join (select mes, sum(min_instalada) as instalada,
                        sum(min_planejada) as planejada,
                        sum(min_disponivel) as disponivel
                   from versao_fato
                  where versao_id = ${Number(versaoB)}
                    and (${areas}::text is null
                         or area_id = any(string_to_array(${areas}, ',')::int[]))
                  group by mes) b on b.mes = a.mes
     order by 1`;
}
