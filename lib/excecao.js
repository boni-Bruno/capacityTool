import { sql } from './db';

// Feriados, paradas coletivas e dias extraordinários.
//
// A exceção é cadastrada UMA VEZ na planta, com a data. Depois marca-se quais
// calendários a observam: um feriado que a linha de rodízio trabalha e a linha
// padrão para é uma data com uma marcação, não duas datas em dois lugares.
//
// Duas marcações decidem o alcance, e respondem coisas diferentes:
//   ÁREA       onde o feriado vale — a Confecção para, a Tecelagem não
//   CALENDÁRIO qual regime para    — o padrão para, o rodízio trabalha
// O motor exige as duas. Sem uma delas a exceção não alcança ninguém.
//
// dia_util = false zera o dia. dia_util = true habilita um dia normalmente
// parado — é como se cadastra trabalho em feriado ou num domingo.
//
// A tela trabalha com o dia inteiro (turno_id null). O schema permite exceção
// de um turno só e o motor prefere ela quando existe, mas isso ainda não tem
// tela.

// `dia_util` é o que a exceção faz com o dia QUANDO ela afeta a capacidade:
// false zera, true habilita um dia normalmente parado. Se `afeta_capacidade`
// for falso, ele não é lido por ninguém.
export const TIPOS = [
  { valor: 'FERIADO',         rotulo: 'Feriado',            dia_util: false },
  { valor: 'PARADA_COLETIVA', rotulo: 'Parada coletiva',    dia_util: false },
  { valor: 'OUTRAS_PARADAS',  rotulo: 'Outras paradas',     dia_util: false },
  { valor: 'DIA_EXTRA',       rotulo: 'Dia extraordinário', dia_util: true },
];

/**
 * Quanto do dia a parada consome na contagem de dias úteis.
 *
 * Aceita "0,5" e "0.5" — o teclado brasileiro entrega vírgula, e recusar isso
 * seria implicância. Fora de 0..1 devolve null, e quem chama decide o que
 * fazer: não existe parada de dia e meio, isso são duas paradas.
 */
export function leImpacto(entrada) {
  const t = String(entrada ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}

export async function excecoesDoAno(plantaId, ano) {
  return sql`
    select e.id,
           e.data::text as data,
           e.tipo,
           e.dia_util,
           e.afeta_capacidade,
           e.impacto_dia::float8 as impacto_dia,
           e.descricao,
           (select string_agg(c.nome, ', ' order by c.nome)
              from excecao_calendario ec
              join calendario c on c.id = ec.calendario_id
             where ec.excecao_id = e.id) as calendarios,
           (select string_agg(ec.calendario_id::text, ',')
              from excecao_calendario ec
             where ec.excecao_id = e.id) as calendario_ids,
           (select string_agg(a.nome, ', ' order by a.nome)
              from excecao_area ea
              join area a on a.id = ea.area_id
             where ea.excecao_id = e.id) as areas,
           (select string_agg(ea.area_id::text, ',')
              from excecao_area ea
             where ea.excecao_id = e.id) as area_ids
      from excecao e
     where e.planta_id = ${Number(plantaId)}
       and e.turno_id is null
       and extract(year from e.data) = ${ano}
     order by e.data`;
}

function exigeData(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data ?? ''))) {
    throw new Error('Informe a data no formato AAAA-MM-DD.');
  }
}

// Áreas da planta, para o cadastro marcar todas por padrão.
export async function areasDaPlanta(plantaId) {
  return sql`
    select id, nome from area
     where planta_id = ${Number(plantaId)} and ativo
     order by nome`;
}

function idsValidos(lista) {
  return [...new Set((lista ?? []).map(Number))].filter(Number.isInteger);
}

// A data não entra aqui: no update ela não muda, e o dia é escolhido clicando
// na grade do ano, não digitado.
function validar({ tipo, calendarios, areas }) {
  if (!TIPOS.some((t) => t.valor === tipo)) throw new Error('Tipo inválido.');

  // Exceção sem uma das duas marcações não faz nada: o motor exige as duas.
  // Melhor recusar do que gravar um feriado que silenciosamente não alcança
  // ninguém.
  const cals = idsValidos(calendarios);
  if (!cals.length) {
    throw new Error(
      'Marque pelo menos um regime. Exceção que nenhum calendário observa não ' +
      'muda nada no cálculo.'
    );
  }

  const ars = idsValidos(areas);
  if (!ars.length) {
    throw new Error(
      'Marque pelo menos uma área. Exceção que não vale em área nenhuma não ' +
      'muda nada no cálculo.'
    );
  }

  return { cals, ars };
}

/**
 * Os dois eixos da exceção, validados juntos porque um restringe o outro.
 *
 * Parada que não afeta a capacidade e consome zero dia não faz absolutamente
 * nada — não some da capacidade, não mexe no indicador. Melhor recusar do que
 * gravar uma linha que só ocupa espaço na grade.
 */
function leEfeito(afetaCapacidade, impactoDia) {
  const afeta = Boolean(afetaCapacidade);

  // Exceção que afeta a capacidade para o dia inteiro, e ponto: `dia_util` é
  // booleano e o motor zera o dia todo. Aceitar 0,5 aqui gravaria um número
  // que ninguém lê e que contradiz o que vai acontecer no cálculo.
  if (afeta) return { afeta: true, impacto: 1 };

  const impacto = leImpacto(impactoDia);
  if (impacto === null) {
    throw new Error(
      'Quanto do dia a parada consome: informe um número de 0 a 1 — ' +
      '1 é o dia inteiro, 0,5 é meio dia.');
  }
  if (impacto === 0) {
    throw new Error(
      'Esta exceção não faria nada: não afeta a capacidade e não consome nada ' +
      'do dia. Ou ela para os recursos, ou consome parte do dia.');
  }
  return { afeta: false, impacto };
}

export async function criarExcecao({
  planta_id, data, tipo, descricao, calendarios, areas,
  afeta_capacidade = true, impacto_dia = 1,
}) {
  exigeData(data);
  const { cals, ars } = validar({ tipo, calendarios, areas });
  const diaUtil = TIPOS.find((t) => t.valor === tipo).dia_util;
  const { afeta, impacto } = leEfeito(afeta_capacidade, impacto_dia);

  const jaTem = await sql`
    select id from excecao
     where planta_id = ${Number(planta_id)} and data = ${data}::date
       and turno_id is null and tipo = ${tipo}`;
  if (jaTem.length) {
    throw new Error(`Já existe ${tipo.toLowerCase().replace('_', ' ')} em ${data} nesta planta.`);
  }

  const r = await sql`
    insert into excecao (planta_id, data, tipo, dia_util, afeta_capacidade,
                         impacto_dia, descricao)
    values (${Number(planta_id)}, ${data}::date, ${tipo}, ${diaUtil}, ${afeta},
            ${impacto}, ${String(descricao ?? '').trim() || null})
    returning id`;

  await sql.transaction([
    ...cals.map((c) => sql`
      insert into excecao_calendario (excecao_id, calendario_id)
      values (${r[0].id}, ${c}) on conflict do nothing`),
    ...ars.map((a) => sql`
      insert into excecao_area (excecao_id, area_id)
      values (${r[0].id}, ${a}) on conflict do nothing`),
  ]);

  return r[0].id;
}

export async function alterarExcecao(id, {
  tipo, descricao, calendarios, areas,
  afeta_capacidade = true, impacto_dia = 1,
}) {
  const e = Number(id);
  const { cals, ars } = validar({ tipo, calendarios, areas });
  const diaUtil = TIPOS.find((t) => t.valor === tipo).dia_util;
  const { afeta, impacto } = leEfeito(afeta_capacidade, impacto_dia);

  const r = await sql`
    update excecao
       set tipo = ${tipo}, dia_util = ${diaUtil},
           afeta_capacidade = ${afeta}, impacto_dia = ${impacto},
           descricao = ${String(descricao ?? '').trim() || null}
     where id = ${e} returning id`;
  if (!r.length) throw new Error('Exceção não encontrada.');

  await sql.transaction([
    sql`delete from excecao_calendario where excecao_id = ${e}`,
    sql`delete from excecao_area       where excecao_id = ${e}`,
    ...cals.map((c) => sql`
      insert into excecao_calendario (excecao_id, calendario_id) values (${e}, ${c})`),
    ...ars.map((a) => sql`
      insert into excecao_area (excecao_id, area_id) values (${e}, ${a})`),
  ]);
}

export async function excluirExcecao(id) {
  // excecao_calendario e excecao_area caem por cascade.
  const d = await sql`delete from excecao where id = ${Number(id)} returning id`;
  if (!d.length) throw new Error('Exceção não encontrada.');
}
