import { sql } from './db';

// Calendários e as regras deles.
//
// calendario_regra diz "neste calendário, neste dia da semana, roda este
// turno". É o que o motor consulta para saber se o dia é útil: sem a linha, a
// capacidade sai zero mesmo com o turno marcado no recurso.
//
// Para quem cadastra, o calendário é o regime de dias — RODIZIO trabalha
// domingo, PADRAO não. Por isso a tela é uma matriz dia x turno: as duas
// perguntas que o motor faz, no mesmo lugar.

export async function calendariosCadastro() {
  return sql`
    select c.id, c.codigo, c.nome, c.padrao,
           c.planta_id,
           p.nome as planta,
           (select count(*) from recurso_calendario rc
             where rc.calendario_id = c.id) as recursos,
           (select string_agg(distinct cr.dia_semana::text, ','
                              order by cr.dia_semana::text)
              from calendario_regra cr where cr.calendario_id = c.id) as dias
      from calendario c
      join planta p on p.id = c.planta_id
     order by p.nome, c.codigo`;
}

export async function criarCalendario({ planta_id, codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!planta_id) throw new Error('Escolha a planta do calendário.');
  if (!cod) throw new Error('Informe o código do calendário.');
  if (!desc) throw new Error('Informe o nome do calendário.');

  const jaTem = await sql`
    select nome from calendario
     where planta_id = ${Number(planta_id)} and codigo = ${cod}`;
  if (jaTem.length) {
    throw new Error(
      `Já existe um calendário com o código ${cod} nesta planta ("${jaTem[0].nome}").`);
  }

  const r = await sql`
    insert into calendario (planta_id, codigo, nome)
    values (${Number(planta_id)}, ${cod}, ${desc})
    returning id`;
  return r[0].id;
}

export async function alterarCalendario(id, { codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!cod) throw new Error('Informe o código do calendário.');
  if (!desc) throw new Error('Informe o nome do calendário.');

  const r = await sql`
    update calendario set codigo = ${cod}, nome = ${desc}
     where id = ${Number(id)} returning id`;
  if (!r.length) throw new Error('Calendário não encontrado.');
}

/**
 * Calendário não tem coluna `ativo`, então não há desativação: ou apaga, ou
 * recusa. Recusar é o certo quando algum recurso segue o calendário — apagar
 * deixaria o recurso sem regime e ele sumiria do cálculo em silêncio, porque o
 * motor faz INNER JOIN em recurso_calendario.
 */
export async function excluirCalendario(id) {
  const c = Number(id);
  const uso = await sql`
    select (select count(*) from recurso_calendario where calendario_id = ${c}) as recursos,
           (select count(*) from excecao_calendario  where calendario_id = ${c}) as excecoes`;

  if (Number(uso[0].recursos)) {
    throw new Error(
      `Este calendário é seguido por ${uso[0].recursos} recurso(s) e não pode ` +
      `ser apagado. Mude esses recursos para outro regime antes.`
    );
  }

  // As regras e os vínculos com exceção caem por cascade.
  const d = await sql`delete from calendario where id = ${c} returning id`;
  if (!d.length) throw new Error('Calendário não encontrado.');
  return { excecoes: Number(uso[0].excecoes) };
}

// -----------------------------------------------------------------------------
// REGRAS: dia da semana x turno
// -----------------------------------------------------------------------------

export async function regrasDoCalendario(calendarioId) {
  return sql`
    select t.id as turno_id, t.codigo, t.nome,
           (select string_agg(cr.dia_semana::text, ',' order by cr.dia_semana)
              from calendario_regra cr
             where cr.calendario_id = ${Number(calendarioId)}
               and cr.turno_id = t.id) as dias
      from calendario c
      join turno t on t.planta_id = c.planta_id and t.ativo
     where c.id = ${Number(calendarioId)}
     order by t.codigo`;
}

/**
 * Substitui as regras do calendário pelo que veio da tela.
 *
 * `marcados` é { turnoId: [dias] }. Apaga e reinsere só o que mudou — salvar a
 * matriz inteira não pode reescrever linha que ninguém tocou.
 */
export async function definirRegras(calendarioId, marcados) {
  const c = Number(calendarioId);
  const atuais = await regrasDoCalendario(c);
  const passos = [];
  let alterados = 0;

  for (const t of atuais) {
    const antes = (t.dias ?? '').split(',').filter(Boolean).map(Number).sort((a, b) => a - b);
    const depois = [...new Set((marcados?.[t.turno_id] ?? marcados?.[String(t.turno_id)] ?? [])
      .map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
      .sort((a, b) => a - b);

    if (antes.length === depois.length && antes.every((d, i) => d === depois[i])) continue;
    alterados++;

    passos.push(sql`
      delete from calendario_regra
       where calendario_id = ${c} and turno_id = ${t.turno_id}`);
    for (const d of depois) {
      passos.push(sql`
        insert into calendario_regra (calendario_id, dia_semana, turno_id)
        values (${c}, ${d}, ${t.turno_id})`);
    }
  }

  if (passos.length) await sql.transaction(passos);
  return { turnosAlterados: alterados };
}
