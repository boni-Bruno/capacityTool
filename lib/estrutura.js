import { sql } from './db';

// Cadastro da estrutura física: planta > área > recurso.
//
// Cada nível referencia o de cima, então a tela é encadeada: escolher a planta
// filtra as áreas, escolher a área filtra os recursos.

// -----------------------------------------------------------------------------
// PLANTA
// -----------------------------------------------------------------------------

export async function plantasCadastro() {
  return sql`
    select p.id, p.codigo, p.nome, p.timezone, p.ativo,
           (select count(*) from area a where a.planta_id = p.id) as areas
      from planta p
     order by p.ativo desc, p.nome`;
}

export async function criarPlanta({ codigo, nome, timezone }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!cod) throw new Error('Informe o código da planta.');
  if (!desc) throw new Error('Informe o nome da planta.');

  const jaTem = await sql`select nome from planta where codigo = ${cod}`;
  if (jaTem.length) {
    throw new Error(`Já existe uma planta com o código ${cod} ("${jaTem[0].nome}").`);
  }

  const r = await sql`
    insert into planta (codigo, nome, timezone)
    values (${cod}, ${desc}, ${String(timezone ?? '').trim() || 'America/Sao_Paulo'})
    returning id`;
  return r[0].id;
}

export async function alterarPlanta(id, { codigo, nome, timezone }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!cod) throw new Error('Informe o código da planta.');
  if (!desc) throw new Error('Informe o nome da planta.');

  const r = await sql`
    update planta
       set codigo = ${cod}, nome = ${desc},
           timezone = ${String(timezone ?? '').trim() || 'America/Sao_Paulo'}
     where id = ${Number(id)} returning id`;
  if (!r.length) throw new Error('Planta não encontrada.');
}

// Planta com área é desativada, não apagada: apagar arrancaria a referência de
// tudo que pende dela. Mesma regra usada em turno.
export async function excluirPlanta(id) {
  const p = Number(id);
  const r = await sql`select count(*) as n from area where planta_id = ${p}`;

  if (Number(r[0].n)) {
    await sql`update planta set ativo = false where id = ${p}`;
    return { desativado: true, motivo: `tem ${r[0].n} área(s)` };
  }
  const d = await sql`delete from planta where id = ${p} returning id`;
  if (!d.length) throw new Error('Planta não encontrada.');
  return { desativado: false };
}

export async function reativarPlanta(id) {
  await sql`update planta set ativo = true where id = ${Number(id)}`;
}

// -----------------------------------------------------------------------------
// ÁREA
// -----------------------------------------------------------------------------

export async function areasDaPlanta(plantaId) {
  return sql`
    select a.id, a.codigo, a.nome, a.ativo,
           (select count(*) from recurso r where r.area_id = a.id) as recursos
      from area a
     where a.planta_id = ${Number(plantaId)}
     order by a.ativo desc, a.nome`;
}

export async function criarArea({ planta_id, codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!planta_id) throw new Error('Escolha a planta da área.');
  if (!cod) throw new Error('Informe o código da área.');
  if (!desc) throw new Error('Informe o nome da área.');

  const jaTem = await sql`
    select nome from area where planta_id = ${Number(planta_id)} and codigo = ${cod}`;
  if (jaTem.length) {
    throw new Error(
      `Já existe uma área com o código ${cod} nesta planta ("${jaTem[0].nome}").`);
  }

  const r = await sql`
    insert into area (planta_id, codigo, nome)
    values (${Number(planta_id)}, ${cod}, ${desc})
    returning id`;
  return r[0].id;
}

export async function alterarArea(id, { codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!cod) throw new Error('Informe o código da área.');
  if (!desc) throw new Error('Informe o nome da área.');

  const r = await sql`
    update area set codigo = ${cod}, nome = ${desc}
     where id = ${Number(id)} returning id`;
  if (!r.length) throw new Error('Área não encontrada.');
}

export async function excluirArea(id) {
  const a = Number(id);
  const r = await sql`select count(*) as n from recurso where area_id = ${a}`;

  if (Number(r[0].n)) {
    await sql`update area set ativo = false where id = ${a}`;
    return { desativado: true, motivo: `tem ${r[0].n} recurso(s)` };
  }
  const d = await sql`delete from area where id = ${a} returning id`;
  if (!d.length) throw new Error('Área não encontrada.');
  return { desativado: false };
}

export async function reativarArea(id) {
  await sql`update area set ativo = true where id = ${Number(id)}`;
}

// -----------------------------------------------------------------------------
// RECURSO
//
// O recurso exige uma maquina_fisica. Para quem cadastra isso não existe: ele
// informa CC, CT e Patrimônio, que é como a controladoria identifica o
// equipamento. A máquina física é criada ou reaproveitada a partir da trinca.
// -----------------------------------------------------------------------------

export async function recursosDaArea(areaId) {
  return sql`
    select r.id, r.codigo, r.nome, r.tipo_recurso,
           m.cc, m.ct, m.patrimonio, m.nome as maquina
      from recurso r
      join maquina_fisica m on m.id = r.maquina_fisica_id
     where r.area_id = ${Number(areaId)}
     order by r.nome`;
}

export async function criarRecurso({
  area_id, codigo, nome, tipo_recurso, cc, ct, patrimonio,
}) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  const vCc = String(cc ?? '').trim();
  const vCt = String(ct ?? '').trim();
  const vPat = String(patrimonio ?? '').trim();
  const tipo = tipo_recurso === 'PESSOA' ? 'PESSOA' : 'MAQUINA';

  if (!area_id) throw new Error('Escolha a área do recurso.');
  if (!cod) throw new Error('Informe o código do recurso.');
  if (!desc) throw new Error('Informe o nome do recurso.');
  if (!vCc || !vCt || !vPat) {
    throw new Error('Informe CC, CT e Patrimônio — os três identificam a máquina.');
  }

  const jaTem = await sql`select nome from recurso where codigo = ${cod}`;
  if (jaTem.length) {
    throw new Error(`Já existe um recurso com o código ${cod} ("${jaTem[0].nome}").`);
  }

  const planta = await sql`
    select planta_id from area where id = ${Number(area_id)}`;
  if (!planta.length) throw new Error('Área não encontrada.');
  const plantaId = planta[0].planta_id;

  // Duas máquinas com a mesma trinca são a mesma máquina. Um recurso novo com
  // CC-CT-Patrimônio já existente reaproveita o registro em vez de duplicar —
  // é o caso de dois recursos que dividem o mesmo equipamento físico.
  const existente = await sql`
    select id from maquina_fisica
     where planta_id = ${plantaId}
       and cc = ${vCc} and ct = ${vCt} and patrimonio = ${vPat}`;

  let maquinaId = existente[0]?.id;

  if (!maquinaId) {
    const m = await sql`
      insert into maquina_fisica (planta_id, codigo, nome, cc, ct, patrimonio)
      values (${plantaId}, ${`${vCc}-${vCt}-${vPat}`}, ${desc},
              ${vCc}, ${vCt}, ${vPat})
      returning id`;
    maquinaId = m[0].id;
  }

  const r = await sql`
    insert into recurso (maquina_fisica_id, area_id, codigo, nome, tipo_recurso)
    values (${maquinaId}, ${Number(area_id)}, ${cod}, ${desc}, ${tipo})
    returning id`;
  return r[0].id;
}

export async function alterarRecurso(id, { codigo, nome, tipo_recurso, cc, ct, patrimonio }) {
  const rid = Number(id);
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  const vCc = String(cc ?? '').trim();
  const vCt = String(ct ?? '').trim();
  const vPat = String(patrimonio ?? '').trim();
  const tipo = tipo_recurso === 'PESSOA' ? 'PESSOA' : 'MAQUINA';

  if (!cod) throw new Error('Informe o código do recurso.');
  if (!desc) throw new Error('Informe o nome do recurso.');
  if (!vCc || !vCt || !vPat) {
    throw new Error('Informe CC, CT e Patrimônio — os três identificam a máquina.');
  }

  const atual = await sql`
    select maquina_fisica_id from recurso where id = ${rid}`;
  if (!atual.length) throw new Error('Recurso não encontrado.');

  await sql`
    update recurso set codigo = ${cod}, nome = ${desc}, tipo_recurso = ${tipo}
     where id = ${rid}`;

  await sql`
    update maquina_fisica
       set cc = ${vCc}, ct = ${vCt}, patrimonio = ${vPat},
           codigo = ${`${vCc}-${vCt}-${vPat}`}
     where id = ${atual[0].maquina_fisica_id}`;
}

/**
 * Exclui o recurso. Cadastro dependente (parâmetro, turno, calendário, OEE,
 * parada) tem on delete cascade e vai junto.
 *
 * Recurso que já entrou numa rodada de cálculo não é apagado: capacidade_fato
 * e capacidade_instalada_dia referenciam sem cascade, e apagar arrancaria a
 * referência de números que já foram vistos. Nesse caso o cadastro é zerado
 * pela vigência do parâmetro, e não pela remoção da linha.
 */
export async function excluirRecurso(id) {
  const r = Number(id);

  const usos = await sql`
    select (select count(*) from capacidade_fato where recurso_id = ${r})
             as calculos`;

  if (Number(usos[0].calculos)) {
    throw new Error(
      'Este recurso já entrou em rodadas de cálculo e não pode ser apagado — ' +
      'os números já divulgados perderiam a referência. Para tirá-lo do ' +
      'planejamento, desmarque todos os turnos dele.'
    );
  }

  const d = await sql`delete from recurso where id = ${r} returning id`;
  if (!d.length) throw new Error('Recurso não encontrado.');
}
