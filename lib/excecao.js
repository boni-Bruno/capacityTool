import { sql } from './db';

// Feriados, paradas coletivas e dias extraordinários.
//
// A exceção é cadastrada UMA VEZ na planta, com a data. Depois marca-se quais
// calendários a observam: um feriado que a linha de rodízio trabalha e a linha
// padrão para é uma data com uma marcação, não duas datas em dois lugares.
//
// dia_util = false zera o dia. dia_util = true habilita um dia normalmente
// parado — é como se cadastra trabalho em feriado ou num domingo.
//
// A tela trabalha com o dia inteiro (turno_id null). O schema permite exceção
// de um turno só e o motor prefere ela quando existe, mas isso ainda não tem
// tela.

export const TIPOS = [
  { valor: 'FERIADO',         rotulo: 'Feriado',           dia_util: false },
  { valor: 'PARADA_COLETIVA', rotulo: 'Parada coletiva',   dia_util: false },
  { valor: 'DIA_EXTRA',       rotulo: 'Dia extraordinário', dia_util: true },
];

export async function excecoesDoAno(plantaId, ano) {
  return sql`
    select e.id,
           e.data::text as data,
           e.tipo,
           e.dia_util,
           e.descricao,
           (select string_agg(c.nome, ', ' order by c.nome)
              from excecao_calendario ec
              join calendario c on c.id = ec.calendario_id
             where ec.excecao_id = e.id) as calendarios,
           (select string_agg(ec.calendario_id::text, ',')
              from excecao_calendario ec
             where ec.excecao_id = e.id) as calendario_ids
      from excecao e
     where e.planta_id = ${Number(plantaId)}
       and e.turno_id is null
       and extract(year from e.data) = ${ano}
     order by e.data`;
}

export async function calendariosDaPlanta(plantaId) {
  return sql`
    select id, codigo, nome from calendario
     where planta_id = ${Number(plantaId)} order by codigo`;
}

function exigeData(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data ?? ''))) {
    throw new Error('Informe a data no formato AAAA-MM-DD.');
  }
}

// A data não entra aqui: no update ela não muda, e o dia é escolhido clicando
// na grade do ano, não digitado.
function validar({ tipo, calendarios }) {
  if (!TIPOS.some((t) => t.valor === tipo)) throw new Error('Tipo inválido.');

  // Exceção que nenhum calendário observa não faz nada: o motor só a aplica
  // pelo vínculo em excecao_calendario. Melhor recusar do que gravar um
  // feriado que silenciosamente não vale para ninguém.
  const ids = (calendarios ?? []).map(Number).filter(Number.isInteger);
  if (!ids.length) {
    throw new Error(
      'Marque pelo menos um calendário. Exceção que nenhum calendário observa ' +
      'não muda nada no cálculo.'
    );
  }
  return ids;
}

export async function criarExcecao({ planta_id, data, tipo, descricao, calendarios }) {
  exigeData(data);
  const ids = validar({ tipo, calendarios });
  const diaUtil = TIPOS.find((t) => t.valor === tipo).dia_util;

  const jaTem = await sql`
    select id from excecao
     where planta_id = ${Number(planta_id)} and data = ${data}::date
       and turno_id is null and tipo = ${tipo}`;
  if (jaTem.length) {
    throw new Error(`Já existe ${tipo.toLowerCase().replace('_', ' ')} em ${data} nesta planta.`);
  }

  const r = await sql`
    insert into excecao (planta_id, data, tipo, dia_util, descricao)
    values (${Number(planta_id)}, ${data}::date, ${tipo}, ${diaUtil},
            ${String(descricao ?? '').trim() || null})
    returning id`;

  await sql.transaction(ids.map((c) => sql`
    insert into excecao_calendario (excecao_id, calendario_id)
    values (${r[0].id}, ${c}) on conflict do nothing`));

  return r[0].id;
}

export async function alterarExcecao(id, { tipo, descricao, calendarios }) {
  const e = Number(id);
  const ids = validar({ tipo, calendarios });
  const diaUtil = TIPOS.find((t) => t.valor === tipo).dia_util;

  const r = await sql`
    update excecao
       set tipo = ${tipo}, dia_util = ${diaUtil},
           descricao = ${String(descricao ?? '').trim() || null}
     where id = ${e} returning id`;
  if (!r.length) throw new Error('Exceção não encontrada.');

  await sql.transaction([
    sql`delete from excecao_calendario where excecao_id = ${e}`,
    ...ids.map((c) => sql`
      insert into excecao_calendario (excecao_id, calendario_id) values (${e}, ${c})`),
  ]);
}

export async function excluirExcecao(id) {
  // excecao_calendario cai por cascade.
  const d = await sql`delete from excecao where id = ${Number(id)} returning id`;
  if (!d.length) throw new Error('Exceção não encontrada.');
}
