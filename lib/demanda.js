import { sql } from './db';

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
