import { sql } from './db';
import { ATRIBUTOS_ORIGEM, OPERADORES, podeSerCondicao } from './regras';

// =============================================================================
// A BASE DE DEMANDA NO BANCO
//
// A leitura do parquet acontece no NAVEGADOR e as linhas chegam aqui em lotes.
// Três razões, nesta ordem de importância:
//
//   1. o relatório de conferência aparece ANTES de qualquer coisa ser gravada
//   2. inserir 116 mil linhas numa requisição só não cabe no tempo de uma
//      função serverless
//   3. some o limite de corpo da Vercel, que o arquivo de 1,2 MB até respeita,
//      mas que não sobreviveria a uma base maior
//
// Cada carga é uma versão. Importar não troca o que todo mundo está vendo — a
// carga nasce fora do ar e alguém decide torná-la corrente, pela mesma razão de
// o Recalcular ser um botão e não um efeito colateral.
// =============================================================================

// Quantas linhas por requisição. 2.000 x 13 colunas dá ~200 KB de corpo, bem
// abaixo de qualquer limite, e as 116 mil linhas viram ~60 idas ao banco.
export const TAMANHO_LOTE = 2000;

/**
 * Refaz o índice guardado.
 *
 * `mv_demanda_indice` é o resultado de `vw_demanda_indice_efetivo` em cache —
 * ver 22_indice_materializado.sql. Sem ele, cada abertura do painel refazia o
 * agrupamento sobre 116 mil linhas, e dentro de um lateral por recurso.
 *
 * Os gatilhos são poucos e todos passam por aqui: importar carga, trocar a
 * carga corrente, apagar carga, e mexer nas regras de herança. Nenhum outro
 * caminho muda o índice, então nenhum outro precisa chamar isto.
 */
export async function atualizarIndice() {
  await sql`refresh materialized view mv_demanda_indice`;
}

export async function criarCarga({ arquivo, cenario, extraido_em, criado_por }) {
  const nome = String(arquivo ?? '').trim();
  const cen = String(cenario ?? '').trim();
  if (!nome) throw new Error('Informe o nome do arquivo.');
  if (!cen) throw new Error('A carga precisa de um cenário — ele é a identidade dela.');

  const r = await sql`
    insert into demanda_carga (arquivo, cenario, extraido_em, criado_por)
    values (${nome}, ${cen}, ${extraido_em ?? null}::timestamptz,
            ${criado_por ?? null})
    returning id`;
  return r[0].id;
}

/**
 * Grava um lote de linhas.
 *
 * Uma instrução só, com `unnest`: treze arrays entram e viram N linhas. Inserir
 * uma a uma seriam 116 mil idas ao banco pelo driver HTTP do Neon, que é
 * requisição por instrução — não terminaria nunca.
 */
export async function gravarLote(cargaId, linhas) {
  const c = Number(cargaId);
  if (!Number.isInteger(c) || c <= 0) throw new Error('Carga inválida.');
  if (!Array.isArray(linhas) || !linhas.length) return 0;
  if (linhas.length > TAMANHO_LOTE * 2) {
    throw new Error(`Lote de ${linhas.length} linhas, acima do limite.`);
  }

  const col = (nome) => linhas.map((l) => l[nome] ?? null);
  const num = (nome) => linhas.map((l) => Number(l[nome] ?? 0));

  await sql`
    insert into demanda_linha
      (carga_id, grupo_estoque, nivel_estoque, linha_produto_agrupada,
       familia_produto, familia_tecelagem, tecido_base, um, ct,
       periodo, periodo_data, qtd, qtd_metros_kg, duracao_min)
    select ${c}, * from unnest(
      ${col('grupo_estoque')}::text[],
      ${col('nivel_estoque')}::text[],
      ${col('linha_produto_agrupada')}::text[],
      ${col('familia_produto')}::text[],
      ${col('familia_tecelagem')}::text[],
      ${col('tecido_base')}::text[],
      ${col('um')}::text[],
      ${col('ct')}::text[],
      ${col('periodo')}::text[],
      ${col('periodo_data')}::date[],
      ${num('qtd')}::numeric[],
      ${num('qtd_metros_kg')}::numeric[],
      ${num('duracao_min')}::numeric[])`;

  return linhas.length;
}

// Fecha a carga com o total que realmente entrou — contado no banco, não
// informado pelo navegador. Se um lote se perdeu no caminho, é aqui que aparece.
export async function concluirCarga(cargaId) {
  const c = Number(cargaId);
  const r = await sql`
    update demanda_carga
       set linhas = (select count(*) from demanda_linha where carga_id = ${c})
     where id = ${c}
     returning id, linhas`;
  if (!r.length) throw new Error('Carga não encontrada.');

  // O índice é refeito aqui e não a cada lote: gravar 116 mil linhas são ~60
  // requisições, e refazer o agrupamento em todas elas seria pagar 60 vezes
  // por um resultado que só interessa no fim.
  await atualizarIndice();
  return Number(r[0].linhas);
}

export async function definirCorrente(cargaId) {
  const c = Number(cargaId);
  await sql.transaction([
    sql`update demanda_carga set corrente = false where corrente`,
    sql`update demanda_carga set corrente = true where id = ${c}`,
  ]);
}

export async function excluirCarga(cargaId) {
  // demanda_linha cai por cascade.
  const d = await sql`
    delete from demanda_carga where id = ${Number(cargaId)} returning id`;
  if (!d.length) throw new Error('Carga não encontrada.');
  await atualizarIndice();
}

export async function cargas() {
  return sql`
    select c.id, c.arquivo, c.cenario, c.corrente, c.linhas, c.criado_por,
           c.extraido_em, c.criado_em,
           (select count(distinct l.periodo) from demanda_linha l
             where l.carga_id = c.id)                        as periodos,
           (select round(sum(l.duracao_min) / 60)
              from demanda_linha l where l.carga_id = c.id)  as horas
      from demanda_carga c
     order by c.corrente desc, c.criado_em desc`;
}

export async function cargaCorrente() {
  const r = await sql`
    select id, arquivo, cenario, linhas, extraido_em, criado_em
      from demanda_carga where corrente limit 1`;
  return r[0] ?? null;
}

// -----------------------------------------------------------------------------
// CONFERÊNCIA
//
// As duas pontas soltas do casamento entre demanda e capacidade. Nenhuma das
// duas é erro: a primeira é a fila do que falta cadastrar, a segunda é máquina
// que o plano não usa. Mas as duas caladas viram número errado que ninguém vê.
//
// O vínculo é derivado do próprio cadastro — `cc-ct` da máquina física — e por
// isso é reavaliado a cada leitura. CT sem recurso hoje passa a casar sozinho no
// dia em que o recurso for cadastrado, sem reimportar nada.
// -----------------------------------------------------------------------------

export async function demandaSemCapacidade(cargaId) {
  return sql`
    select l.ct,
           round(sum(l.duracao_min) / 60)::int as horas,
           count(*)::int                       as linhas
      from demanda_linha l
     where l.carga_id = ${Number(cargaId)}
       and l.ct is not null
       and l.duracao_min > 0
       and not exists (
             select 1 from recurso r
               join maquina_fisica m on m.id = r.maquina_fisica_id
              where m.cc || '-' || m.ct = l.ct)
     group by l.ct
     order by 2 desc`;
}

export async function capacidadeSemDemanda(cargaId) {
  return sql`
    select m.cc || '-' || m.ct                        as ct,
           count(*)::int                              as recursos,
           string_agg(r.nome, ', ' order by r.nome)   as maquinas
      from recurso r
      join maquina_fisica m on m.id = r.maquina_fisica_id
     where not exists (
             select 1 from demanda_linha l
              where l.carga_id = ${Number(cargaId)}
                and l.ct = m.cc || '-' || m.ct)
     group by 1
     order by 1`;
}

/**
 * O retrato da carga: o que entrou, o que não tem onde cair, e quanto disso
 * pesa em horas. É o que a tela mostra depois de gravar.
 */
export async function resumoCarga(cargaId) {
  const c = Number(cargaId);
  const r = await sql`
    select count(*)::int                                          as total,
           count(*) filter (where ct is null)::int                 as sem_ct,
           count(*) filter (where qtd = 0 and qtd_metros_kg = 0
                              and duracao_min = 0)::int            as zeradas,
           count(*) filter (where duracao_min = 0
                              and (qtd <> 0 or qtd_metros_kg <> 0))::int
                                                                   as sem_tempo,
           count(distinct ct)::int                                 as cts,
           count(distinct periodo)::int                            as periodos,
           min(periodo)                                            as periodo_de,
           max(periodo)                                            as periodo_ate,
           coalesce(round(sum(duracao_min) / 60), 0)::bigint       as horas
      from demanda_linha where carga_id = ${c}`;

  const casados = await sql`
    select count(distinct l.ct)::int                          as cts,
           coalesce(round(sum(l.duracao_min) / 60), 0)::bigint as horas
      from demanda_linha l
     where l.carga_id = ${c} and l.ct is not null and l.duracao_min > 0
       and exists (
             select 1 from recurso r
               join maquina_fisica m on m.id = r.maquina_fisica_id
              where m.cc || '-' || m.ct = l.ct)`;

  return { ...r[0], casados: casados[0] };
}

// Minutos de demanda por período, para a leitura do plano mês a mês.
export async function demandaPorPeriodo(cargaId) {
  return sql`
    select periodo,
           coalesce(round(sum(duracao_min) / 60), 0)::bigint as horas
      from demanda_linha
     where carga_id = ${Number(cargaId)}
     group by periodo
     order by periodo`;
}

// -----------------------------------------------------------------------------
// O ÍNDICE
//
// A definição mora na view `vw_demanda_indice` (ver 20_demanda_indice.sql), e
// não aqui: ela é usada tanto por esta tela de conferência quanto pelas
// consultas do painel, e duas definições da mesma conta acabariam divergindo.
// -----------------------------------------------------------------------------

/**
 * O índice de cada CT, com a conferência de sanidade à vista.
 *
 * `metros_por_hora` é o número que se olha para saber se a conta está de pé:
 * tear de felpudo fica na casa de 11 a 51 m/h. Índice absurdo é sinal de
 * ponderação feita por quantidade em vez de por tempo.
 */
export async function indicePorCt(cargaId) {
  return sql`
    select i.ct,
           i.unidade,
           sum(i.minutos)                                   as minutos,
           round(sum(i.minutos) / 60)::bigint               as horas,
           round(sum(i.metros_kg) / sum(i.minutos) * 60, 2) as metros_por_hora,
           round(sum(i.qtd)       / sum(i.minutos) * 60, 2) as qtd_por_hora,
           count(*)::int                                    as meses,
           exists (select 1 from recurso r
                     join maquina_fisica m on m.id = r.maquina_fisica_id
                    where m.cc || '-' || m.ct = i.ct)       as tem_recurso
      from vw_demanda_indice i
     where i.carga_id = ${Number(cargaId)}
     group by i.ct, i.unidade
     order by 3 desc`;
}

// -----------------------------------------------------------------------------
// DE ONDE O CT TIRA O ÍNDICE
//
// A regra mora em `demanda_ct_origem` e o resultado em `vw_demanda_indice_efetivo`
// — as duas definidas em 21_demanda_ct_origem.sql. Ela empresta a TAXA, nunca a
// carga: o CT que herda continua sem demanda própria.
// -----------------------------------------------------------------------------

/**
 * Os CTs que têm recurso cadastrado e não têm demanda própria, com o que já foi
 * decidido para cada um.
 *
 * É a fila de trabalho da tela: ordenada por quanto o CC do órfão pesa, porque
 * é ali que a escolha errada custa mais caro.
 */
export async function ctsOrfaos(cargaId) {
  return sql`
    with cad as (
      select distinct m.cc || '-' || m.ct as ct,
             m.cc                          as cc,
             string_agg(distinct r.nome, ', ') as maquinas
        from recurso r
        join maquina_fisica m on m.id = r.maquina_fisica_id
       group by 1, 2
    ),
    cc as (
      select split_part(i.ct, '-', 1)                as cc,
             sum(i.minutos)                          as minutos,
             sum(i.metros_kg) / sum(i.minutos) * 60  as metros_por_hora,
             count(distinct i.ct)::int               as irmaos
        from vw_demanda_indice i
       where i.carga_id = ${Number(cargaId)}
       group by 1
    )
    select c.ct, c.cc, c.maquinas,
           o.tipo, o.valor,
           round(cc.metros_por_hora, 2) as cc_metros_por_hora,
           coalesce(cc.irmaos, 0)       as cc_irmaos,
           round(cc.minutos / 60)       as cc_horas
      from cad c
      left join demanda_ct_origem o on o.ct = c.ct
      left join cc on cc.cc = c.cc
     where not exists (select 1 from vw_demanda_indice i
                        where i.carga_id = ${Number(cargaId)} and i.ct = c.ct)
     order by cc.minutos desc nulls last, c.ct`;
}

/**
 * Os CTs que podem doar índice, com a taxa de cada um à vista.
 *
 * A taxa vai junto de propósito: escolher um irmão sem ver a que ritmo ele
 * roda é escolher no escuro, e a dispersão dentro de um CC chega a quatro
 * vezes.
 */
export async function ctsDoadores(cargaId) {
  return sql`
    select i.ct,
           split_part(i.ct, '-', 1)                   as cc,
           round(sum(i.metros_kg) / sum(i.minutos) * 60, 2) as metros_por_hora,
           round(sum(i.minutos) / 60)::bigint         as horas,
           case when bool_and(i.unidade = 'KG') then 'KG' else 'M' end as unidade
      from vw_demanda_indice i
     where i.carga_id = ${Number(cargaId)}
     group by i.ct
     order by i.ct`;
}

/**
 * O que o cadastro sabe de cada CT: planta e área, via recurso.
 *
 * Serve aos filtros da tela de demanda. A base não tem planta nem área — esse
 * vínculo é sempre derivado do CC-CT da máquina física, nunca digitado.
 */
export async function ctsCadastro() {
  return sql`
    select m.cc || '-' || m.ct as ct,
           p.nome as planta,
           a.nome as area,
           string_agg(distinct r.nome, ', ') as recursos
      from recurso r
      join maquina_fisica m on m.id = r.maquina_fisica_id
      join area a  on a.id = r.area_id
      join planta p on p.id = a.planta_id
     group by 1, 2, 3
     order by 1`;
}

/**
 * Os CTs que têm recurso cadastrado E demanda própria, com a taxa própria e a
 * decisão de herança de cada um.
 *
 * A herança nunca foi só dos órfãos — a regra ganha da demanda própria por
 * decisão, desde a migração 21. Esta consulta é o que deixa a tela oferecer a
 * troca para qualquer CT: quem herda por regra de fluxo (a prioridade manda a
 * carga para o irmão, mas quem produz é ele) escolhe aqui de quem usar o mix.
 *
 * A taxa própria vai junto porque a escolha é uma comparação: trocar a taxa de
 * casa pela do vizinho sem ver as duas seria escolher no escuro.
 */
export async function ctsComDemanda(cargaId) {
  return sql`
    with cad as (
      select m.cc || '-' || m.ct as ct,
             m.cc                as cc,
             string_agg(distinct r.nome, ', ') as maquinas
        from recurso r
        join maquina_fisica m on m.id = r.maquina_fisica_id
       group by 1, 2
    )
    select c.ct, c.cc, c.maquinas,
           o.tipo, o.valor,
           round(sum(i.metros_kg) / sum(i.minutos) * 60, 2) as propria_metros_por_hora,
           round(sum(i.minutos) / 60)::bigint               as propria_horas
      from cad c
      join vw_demanda_indice i on i.ct = c.ct and i.carga_id = ${Number(cargaId)}
      left join demanda_ct_origem o on o.ct = c.ct
     group by c.ct, c.cc, c.maquinas, o.tipo, o.valor
     order by 7 desc`;
}

export async function definirOrigem(ct, tipo, valor) {
  const c = String(ct ?? '').trim();
  const t = String(tipo ?? '').trim().toUpperCase();
  const v = String(valor ?? '').trim() || null;

  if (!c) throw new Error('Informe o centro de trabalho.');
  if (!['CT', 'CC', 'NENHUM'].includes(t)) throw new Error('Origem inválida.');
  if (t !== 'NENHUM' && !v) {
    throw new Error('Escolha de qual centro de trabalho ou centro de custo herdar.');
  }
  if (t === 'CT' && v === c) {
    throw new Error('Um centro de trabalho não pode herdar de si mesmo.');
  }

  await sql`
    insert into demanda_ct_origem (ct, tipo, valor)
    values (${c}, ${t}, ${t === 'NENHUM' ? null : v})
    on conflict (ct) do update
       set tipo = excluded.tipo, valor = excluded.valor, criado_em = now()`;

  await atualizarIndice();
}

export async function limparOrigem(ct) {
  await sql`delete from demanda_ct_origem where ct = ${String(ct ?? '').trim()}`;
  await atualizarIndice();
}

/**
 * Manda todos os órfãos de um CC herdarem da média do próprio CC.
 *
 * O atalho existe porque a fila começa com mais de cem linhas, e preencher uma
 * a uma faria ninguém preencher. Ele não toca em CT que já tem decisão: quem
 * escolheu um irmão específico escolheu por um motivo.
 */
export async function herdarCcEmLote(cargaId, cc) {
  const c = String(cc ?? '').trim();
  if (!c) throw new Error('Informe o centro de custo.');

  const r = await sql`
    insert into demanda_ct_origem (ct, tipo, valor)
    select distinct m.cc || '-' || m.ct, 'CC', ${c}
      from recurso r
      join maquina_fisica m on m.id = r.maquina_fisica_id
     where m.cc = ${c}
       and not exists (select 1 from vw_demanda_indice i
                        where i.carga_id = ${Number(cargaId)}
                          and i.ct = m.cc || '-' || m.ct)
       and not exists (select 1 from demanda_ct_origem o
                        where o.ct = m.cc || '-' || m.ct)
       and exists (select 1 from vw_demanda_indice i
                    where i.carga_id = ${Number(cargaId)}
                      and split_part(i.ct, '-', 1) = ${c})
    returning ct`;

  await atualizarIndice();
  return r.length;
}

// -----------------------------------------------------------------------------
// AS REGRAS DE CLASSIFICAÇÃO
//
// O motor mora em lib/regras.js, puro e sem banco, e é o mesmo código que roda
// na tela para a prévia. Aqui fica só o que ele não sabe fazer: guardar, ler, e
// buscar as combinações sobre as quais ele decide.
// -----------------------------------------------------------------------------

export async function atributos() {
  return sql`
    select a.codigo, a.nome, a.nivel, a.ordem,
           (select count(*) from demanda_regra r where r.atributo = a.codigo)::int
             as regras
      from demanda_atributo a
     order by a.nivel, a.ordem, a.codigo`;
}

export async function salvarAtributo({ codigo, nome, nivel, ordem }) {
  const c = String(codigo ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const n = String(nome ?? '').trim();
  if (!c) throw new Error('O atributo precisa de um código.');
  if (!n) throw new Error('O atributo precisa de um nome.');

  // Um derivado não pode se chamar como uma coluna da base: a regra passaria a
  // ler o rótulo onde quem escreveu queria o valor de origem.
  if (ATRIBUTOS_ORIGEM.some((a) => a.codigo === c)) {
    throw new Error(`Já existe um atributo de origem chamado ${c}.`);
  }

  const niv = Math.min(9, Math.max(1, Number(nivel ?? 1)));
  await sql`
    insert into demanda_atributo (codigo, nome, nivel, ordem)
    values (${c}, ${n}, ${niv}, ${Number(ordem ?? 1)})
    on conflict (codigo) do update
       set nome = excluded.nome, nivel = excluded.nivel, ordem = excluded.ordem`;
  return c;
}

/**
 * O nível que um atributo novo precisa ter para poder ler estas condições.
 *
 * Ele sai da regra, não de um campo na tela. Nível é consequência de quem a
 * regra lê: se ela usa um derivado de nível 2, ela só pode produzir nível 3.
 * Perguntar isso a quem está escrevendo a regra seria pedir que a pessoa
 * resolvesse à mão uma conta que a própria regra já respondeu — e errar aqui
 * não dá erro, dá regra que nunca casa.
 */
function nivelNecessario(condicoes, attrs) {
  let n = 0;
  for (const c of condicoes ?? []) {
    const a = attrs.find((x) => x.codigo === c.atributo);
    if (a) n = Math.max(n, Number(a.nivel ?? 1));
  }
  return Math.min(9, n + 1);
}

/**
 * Grava uma regra DE/PARA inteira, criando o atributo se ele ainda não existir.
 *
 * O atributo deixou de ser um cadastro à parte de propósito. Quem está
 * escrevendo a regra está pensando em "isso aqui vira Banho Jacquard", não em
 * "preciso primeiro declarar uma coluna". Duas telas para uma ideia só é uma a
 * mais, e a primeira delas não tinha nada que fizesse sentido decidir sozinho.
 */
export async function salvarDePara(regra) {
  let atributo = String(regra.atributo ?? '').trim();

  if (!atributo) {
    const nome = String(regra.para_novo ?? '').trim();
    if (!nome) throw new Error('Diga em que atributo esta regra escreve.');

    const attrs = await atributos();
    const codigo = nome.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    // Nome repetido reaproveita o atributo em vez de criar outro igual — e sem
    // mexer no nível dele, que já foi decidido pelas regras que existem.
    const existente = attrs.find((a) => a.codigo === codigo);
    atributo = existente ? existente.codigo : await salvarAtributo({
      codigo, nome,
      nivel: nivelNecessario(regra.condicoes, attrs),
      ordem: attrs.length + 1,
    });
  }

  const id = await salvarRegra({ ...regra, atributo });
  return { id, atributo };
}

/**
 * Apaga o atributo e, em cascata, as regras dele.
 *
 * Recusa enquanto alguma regra de outro atributo depender deste: apagar assim
 * deixaria uma condição apontando para o vazio, que nunca casa, e a regra
 * pararia de pegar sem nenhum sinal.
 */
export async function excluirAtributo(codigo) {
  const c = String(codigo ?? '').trim();
  const usos = await sql`
    select distinct r.atributo
      from demanda_regra_cond c
      join demanda_regra r on r.id = c.regra_id
     where c.atributo = ${c} and r.atributo <> ${c}`;
  if (usos.length) {
    throw new Error(
      `${c} é condição em ${usos.map((u) => u.atributo).join(', ')}. `
      + 'Tire a condição antes de apagar.');
  }
  await sql`delete from demanda_atributo where codigo = ${c}`;
}

/** As regras de um atributo, com as condições já dentro de cada uma. */
export async function regrasDoAtributo(atributo) {
  const a = String(atributo ?? '').trim();
  const [regras, conds] = await Promise.all([
    sql`select id, atributo, rotulo, ordem, ativa, observacao
          from demanda_regra where atributo = ${a} order by ordem, id`,
    sql`select c.id, c.regra_id, c.bloco, c.atributo, c.operador, c.valor
          from demanda_regra_cond c
          join demanda_regra r on r.id = c.regra_id
         where r.atributo = ${a}
         order by c.bloco, c.id`,
  ]);
  return juntaCondicoes(regras, conds);
}

/** Todas as regras de todos os atributos — o que a classificação precisa. */
export async function todasAsRegras() {
  const [regras, conds] = await Promise.all([
    sql`select id, atributo, rotulo, ordem, ativa, observacao
          from demanda_regra order by atributo, ordem, id`,
    sql`select id, regra_id, bloco, atributo, operador, valor
          from demanda_regra_cond order by bloco, id`,
  ]);
  return juntaCondicoes(regras, conds);
}

function juntaCondicoes(regras, conds) {
  const porRegra = new Map(regras.map((r) => [r.id, []]));
  for (const c of conds) porRegra.get(c.regra_id)?.push(c);
  return regras.map((r) => ({ ...r, condicoes: porRegra.get(r.id) ?? [] }));
}

/**
 * Grava uma regra inteira: cabeçalho e condições, de uma vez.
 *
 * As condições são reescritas por completo, não remendadas. Meia regra gravada
 * é uma regra que classifica errado em silêncio, e reconciliar condição a
 * condição só criaria caminhos para isso acontecer.
 */
export async function salvarRegra({ id, atributo, rotulo, ordem, ativa,
                                    observacao, condicoes }) {
  const a = String(atributo ?? '').trim();
  const rot = String(rotulo ?? '').trim();
  if (!a) throw new Error('Informe o atributo.');
  if (!rot) throw new Error('A regra precisa de um rótulo — é o que ela produz.');

  const attrs = await atributos();

  const limpas = (condicoes ?? []).map((c) => {
    const op = String(c.operador ?? '=').trim().toUpperCase();
    const alvo = String(c.atributo ?? '').trim();
    if (!OPERADORES.some((o) => o.codigo === op)) {
      throw new Error(`Operador desconhecido: ${op}.`);
    }
    if (!podeSerCondicao(alvo, a, attrs)) {
      throw new Error(
        `${alvo || 'a condição'} não pode ser condição de ${a}: `
        + 'uma regra só enxerga atributo de origem ou derivado de nível menor.');
    }
    const valor = op === 'VAZIO' ? null : String(c.valor ?? '').trim();
    if (op !== 'VAZIO' && !valor) throw new Error('Condição sem valor.');
    return { bloco: Number(c.bloco ?? 1), atributo: alvo, operador: op, valor };
  });

  if (!limpas.length) {
    // O motor trata regra sem condição como "não casa com nada"; deixar gravar
    // seria oferecer uma regra que não faz nada e não diz por quê.
    throw new Error('A regra precisa de pelo menos uma condição.');
  }

  let regraId = Number(id) || null;
  if (regraId) {
    await sql`
      update demanda_regra
         set rotulo = ${rot}, ordem = ${Number(ordem ?? 1)},
             ativa = ${ativa !== false}, observacao = ${observacao || null},
             alterado_em = now()
       where id = ${regraId}`;
    await sql`delete from demanda_regra_cond where regra_id = ${regraId}`;
  } else {
    const r = await sql`
      insert into demanda_regra (atributo, rotulo, ordem, ativa, observacao)
      values (${a}, ${rot}, ${Number(ordem ?? 1)}, ${ativa !== false},
              ${observacao || null})
      returning id`;
    regraId = r[0].id;
  }

  await sql`
    insert into demanda_regra_cond (regra_id, bloco, atributo, operador, valor)
    select ${regraId}, b, at, op, va
      from unnest(${limpas.map((c) => c.bloco)}::smallint[],
                  ${limpas.map((c) => c.atributo)}::varchar[],
                  ${limpas.map((c) => c.operador)}::varchar[],
                  ${limpas.map((c) => c.valor)}::varchar[])
        as t(b, at, op, va)`;

  return regraId;
}

export async function excluirRegra(id) {
  await sql`delete from demanda_regra where id = ${Number(id)}`;
}

/**
 * As combinações distintas de atributos da carga, com linhas e minutos somados.
 *
 * É sobre isto que o motor roda, e é por isto que a prévia é exata e
 * instantânea: as 116 mil linhas da base formam pouco mais de mil combinações
 * dos atributos que as regras enxergam. Classificar a combinação e multiplicar
 * pelo que ela pesa dá o mesmo resultado que classificar linha a linha.
 *
 * A área vem do cadastro de recurso pelo CC-CT, e não da base, que não tem
 * área. CT sem recurso cadastrado fica com área nula, e continua aparecendo:
 * sumir com ele esconderia demanda por falta de cadastro.
 */
export async function combinacoesDaCarga(cargaId) {
  return sql`
    with ct_area as (
      select m.cc || '-' || m.ct as ct,
             min(a.nome)         as area
        from recurso r
        join maquina_fisica m on m.id = r.maquina_fisica_id
        join area a on a.id = r.area_id
       group by 1
    )
    select l.grupo_estoque, l.nivel_estoque, l.linha_produto_agrupada,
           l.familia_tecelagem, l.um, l.ct, ca.area,
           count(*)::int              as linhas,
           sum(l.duracao_min)::float8 as minutos
      from demanda_linha l
      left join ct_area ca on ca.ct = l.ct
     where l.carga_id = ${Number(cargaId)}
     group by 1, 2, 3, 4, 5, 6, 7
     order by 9 desc`;
}

/**
 * As combinações da carga por MÊS, para o rateio do painel.
 *
 * Diferente de `combinacoesDaCarga`, que serve à prévia do DE/PARA: aqui o mês
 * entra no grão, porque a fatia de cada rótulo muda de mês para mês — um CT que
 * em março só faz felpudo e em abril só faz liso tem fatias diferentes, e usar
 * a média do ano diria que ele faz metade de cada um o ano inteiro.
 *
 * `campos` é a lista de colunas que as regras realmente leem. Agrupar pelas seis
 * e por mês dá dezenas de milhares de linhas para trazer a cada abertura do
 * painel; regra nenhuma lê as seis, e o que não é lido pode virar nulo antes do
 * group by. Com uma ou duas colunas isto costuma colapsar para algumas centenas.
 */
export async function combinacoesPorMes(cargaId, campos = []) {
  const usa = (c) => campos.includes(c);
  return sql`
    select case when ${usa('grupo_estoque')} then l.grupo_estoque end
             as grupo_estoque,
           case when ${usa('nivel_estoque')} then l.nivel_estoque end
             as nivel_estoque,
           case when ${usa('linha_produto_agrupada')} then l.linha_produto_agrupada end
             as linha_produto_agrupada,
           case when ${usa('familia_produto')} then l.familia_produto end
             as familia_produto,
           case when ${usa('familia_tecelagem')} then l.familia_tecelagem end
             as familia_tecelagem,
           case when ${usa('tecido_base')} then l.tecido_base end
             as tecido_base,
           case when ${usa('um')} then l.um end
             as um,
           l.ct,
           date_trunc('month', l.periodo_data)::date::text as mes,
           sum(l.duracao_min)::float8   as minutos,
           sum(l.qtd_metros_kg)::float8 as metros,
           sum(l.qtd)::float8           as qtd
      from demanda_linha l
     where l.carga_id = ${Number(cargaId)}
       and l.ct is not null
       and l.duracao_min > 0
     group by 1, 2, 3, 4, 5, 6, 7, 8, 9`;
}

// -----------------------------------------------------------------------------
// O AJUSTE MANUAL DE MIX
//
// O mix calculado da carga mora em `demanda_linha`; o ajustado mora em
// `mix_ajuste` e ganha dele. O motor que junta os dois é `fatiasDoRotulo`, em
// lib/regras.js — aqui é só guardar e ler.
// -----------------------------------------------------------------------------

export async function mixAjustes(atributo, ano) {
  return sql`
    select ct, mes, rotulo, pct::float8 as pct
      from mix_ajuste
     where atributo = ${String(atributo)} and ano = ${Number(ano)}
     order by ct, mes`;
}

export async function taxasDoMix(atributo) {
  return sql`
    select ct, tipo, valor
      from mix_taxa
     where atributo = ${String(atributo)}`;
}

/** Os anos que já têm algum ajuste, para o seletor não perder nenhum. */
export async function anosComMix() {
  const r = await sql`select distinct ano from mix_ajuste order by 1`;
  return r.map((x) => Number(x.ano));
}

/**
 * Grava o mix de um CT num ano: apaga o que havia e escreve o novo, inteiro.
 *
 * NORMALIZA AO GRAVAR, por decisão: a soma do mês vira 100, proporcionalmente.
 * Quem digitou 30/30 quis meio a meio — bloquear seria burocracia, e gravar
 * como veio faria o mesmo mix somar 60 numa tela e 100 na outra.
 *
 * Mês com soma zero não é gravado: mix vazio não diz nada, e a ausência é o
 * que devolve aquele mês ao cálculo da base.
 */
export async function salvarMixCt({ ct, ano, atributo, linhas }) {
  const c = String(ct ?? '').trim();
  const a = String(atributo ?? '').trim();
  if (!c) throw new Error('Informe o centro de trabalho.');
  if (!a) throw new Error('Informe o atributo.');

  const porMes = new Map();
  for (const l of linhas ?? []) {
    const mes = Number(l.mes);
    if (!(mes >= 1 && mes <= 12)) continue;
    const pct = Number(l.pct ?? 0);
    if (!(pct > 0)) continue;
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push({ rotulo: l.rotulo ?? null, pct });
  }

  const meses = [];
  const rotulos = [];
  const pcts = [];
  for (const [mes, lista] of porMes) {
    const total = lista.reduce((s, l) => s + l.pct, 0);
    for (const l of lista) {
      meses.push(mes);
      rotulos.push(l.rotulo);
      pcts.push(Math.round((l.pct * 100 / total) * 10000) / 10000);
    }
  }

  await sql`
    delete from mix_ajuste
     where ct = ${c} and ano = ${Number(ano)} and atributo = ${a}`;
  if (meses.length) {
    await sql`
      insert into mix_ajuste (ct, ano, mes, atributo, rotulo, pct)
      select ${c}, ${Number(ano)}, m, ${a}, r, p
        from unnest(${meses}::smallint[], ${rotulos}::varchar[],
                    ${pcts}::numeric[]) as t(m, r, p)`;
  }
  return meses.length;
}

export async function limparMixCt(ct, ano, atributo) {
  await sql`
    delete from mix_ajuste
     where ct = ${String(ct ?? '').trim()} and ano = ${Number(ano)}
       and atributo = ${String(atributo ?? '').trim()}`;
}

export async function apontarTaxaMix({ ct, atributo, tipo, valor }) {
  const c = String(ct ?? '').trim();
  const t = String(tipo ?? '').trim().toUpperCase();
  const v = String(valor ?? '').trim();
  if (!['CT', 'CC'].includes(t)) throw new Error('Origem de taxa inválida.');
  if (!v) throw new Error('Escolha de onde vem a taxa.');
  if (t === 'CT' && v === c) {
    throw new Error('Um centro de trabalho não pode apontar para si mesmo.');
  }
  await sql`
    insert into mix_taxa (ct, atributo, tipo, valor)
    values (${c}, ${String(atributo ?? '').trim()}, ${t}, ${v})
    on conflict (ct, atributo) do update
       set tipo = excluded.tipo, valor = excluded.valor`;
}

export async function limparTaxaMix(ct, atributo) {
  await sql`
    delete from mix_taxa
     where ct = ${String(ct ?? '').trim()}
       and atributo = ${String(atributo ?? '').trim()}`;
}

// -----------------------------------------------------------------------------
// A QUANTIDADE DE RECURSO DO AP
//
// A leitura do parquet e a escolha entre QTMAQUINA e QTPESSOAS acontecem em
// lib/ap.js, puro e testado. Aqui é só guardar e ler. Ver 27_recurso_ap.sql.
// -----------------------------------------------------------------------------

/**
 * Substitui a tabela inteira pelo que veio do arquivo.
 *
 * Apaga e insere, não reconcilia: isto é um retrato do parque do AP, e centro
 * que saiu de lá tem que sair daqui. Deixar o antigo sobreviver faria a
 * extração dividir a capacidade por um recurso que não existe mais.
 */
export async function salvarRecursosAp(itens, extraidoEm = null) {
  const lista = (itens ?? []).filter((x) => x?.ct);
  if (!lista.length) throw new Error('Nada para gravar.');

  await sql.transaction([
    sql`delete from recurso_ap`,
    sql`
      insert into recurso_ap (ct, qtd, indicador, descricao, extraido_em)
      select c, q, i, d, ${extraidoEm}::timestamptz
        from unnest(${lista.map((x) => x.ct)}::varchar[],
                    ${lista.map((x) => Number(x.qtd) || 0)}::int[],
                    ${lista.map((x) => x.indicador || null)}::varchar[],
                    ${lista.map((x) => x.descricao || null)}::varchar[])
          as t(c, q, i, d)`,
  ]);
  return lista.length;
}

/** O que está guardado, para a tela mostrar e conferir. */
export async function recursosAp() {
  return sql`
    select ct, qtd, indicador, descricao, extraido_em, criado_em
      from recurso_ap
     order by ct`;
}

/**
 * O retrato em números, e quantos dos centros do AP têm recurso cadastrado
 * aqui — é esse cruzamento que diz se a divisão vai alcançar a extração.
 */
export async function resumoRecursosAp() {
  const r = await sql`
    select count(*)::int                                  as centros,
           count(*) filter (where qtd > 0)::int            as com_quantidade,
           coalesce(sum(qtd), 0)::int                      as total_recursos,
           max(extraido_em)                                as extraido_em,
           max(criado_em)                                  as importado_em,
           count(*) filter (
             where exists (select 1 from recurso r
                             join maquina_fisica m on m.id = r.maquina_fisica_id
                            where m.cc || '-' || m.ct = recurso_ap.ct))::int
             as com_recurso_cadastrado
      from recurso_ap`;
  return r[0] ?? null;
}

/**
 * Os centros que têm capacidade calculada aqui e não têm quantidade no AP.
 *
 * É a fila de conferência da extração: são exatamente as linhas que vão sair
 * com a coluna por recurso vazia.
 */
export async function ctsSemQuantidadeAp() {
  return sql`
    select m.cc || '-' || m.ct as ct,
           string_agg(distinct r.nome, ', ') as recursos,
           a.qtd is not null                 as no_ap
      from recurso r
      join maquina_fisica m on m.id = r.maquina_fisica_id
      left join recurso_ap a on a.ct = m.cc || '-' || m.ct
     where coalesce(a.qtd, 0) = 0
     group by 1, 3
     order by 1`;
}
