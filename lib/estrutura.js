import { sql } from './db';

// Cadastro da estrutura física: planta > área > recurso.
//
// Cada nível referencia o de cima, então a tela é encadeada: escolher a planta
// filtra as áreas, escolher a área filtra os recursos.

// -----------------------------------------------------------------------------
// PLANTA
// -----------------------------------------------------------------------------

// O fuso não é pedido na tela: a coluna existe no banco com default
// America/Sao_Paulo e não muda nada enquanto a operação for de um país só.
export async function plantasCadastro() {
  return sql`
    select p.id, p.codigo, p.nome, p.ativo,
           (select count(*) from area a where a.planta_id = p.id) as areas
      from planta p
     order by p.ativo desc, p.nome`;
}

export async function criarPlanta({ codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!cod) throw new Error('Informe o código da planta.');
  if (!desc) throw new Error('Informe o nome da planta.');

  const jaTem = await sql`select nome from planta where codigo = ${cod}`;
  if (jaTem.length) {
    throw new Error(`Já existe uma planta com o código ${cod} ("${jaTem[0].nome}").`);
  }

  const r = await sql`
    insert into planta (codigo, nome) values (${cod}, ${desc}) returning id`;
  return r[0].id;
}

export async function alterarPlanta(id, { codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!cod) throw new Error('Informe o código da planta.');
  if (!desc) throw new Error('Informe o nome da planta.');

  const r = await sql`
    update planta set codigo = ${cod}, nome = ${desc}
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

// Todas as áreas, com a planta à vista.
//
// A tela de área não herda mais a planta de uma seleção feita acima: o vínculo
// é escolhido no próprio formulário. Contexto implícito é frágil — dá para não
// reparar em qual planta se está e cadastrar a área no lugar errado.
export async function areasCadastro() {
  return sql`
    select a.id, a.codigo, a.nome, a.ativo,
           a.planta_id,
           p.nome as planta,
           (select count(*) from recurso r where r.area_id = a.id) as recursos
      from area a
      join planta p on p.id = a.planta_id
     order by p.nome, a.ativo desc, a.nome`;
}

export async function criarArea({ planta_id, codigo, nome }) {
  const cod = String(codigo ?? '').trim();
  const desc = String(nome ?? '').trim();
  if (!planta_id) throw new Error('Escolha a planta da área.');
  if (!cod) throw new Error('Informe o código da área.');
  if (!desc) throw new Error('Informe o nome da área.');

  const planta = await sql`select id from planta where id = ${Number(planta_id)}`;
  if (!planta.length) throw new Error('Planta não encontrada.');

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

// Todos os recursos, com a área e a planta à vista — mesma razão da área.
export async function recursosCadastro() {
  return sql`
    select r.id, r.codigo, r.nome, r.tipo_recurso,
           coalesce(r.sub_area, '') as sub_area,
           r.area_id,
           a.nome as area,
           p.nome as planta,
           m.cc, m.ct, m.patrimonio,
           coalesce(rp.qt_recursos, 1)  as qt_recursos,
           coalesce(rp.equivalencia, 1) as equivalencia,
           (rp.id is null)              as sem_parametro,
           -- Este campo e o que o componente de cadastro le para pintar a
           -- linha em cinza e oferecer Reativar. Recurso sem parametro conta
           -- como ativo: o problema dele e outro, avisado em separado.
           coalesce(rp.status_cadastro, true) as ativo
      from recurso r
      join area a            on a.id = r.area_id
      join planta p          on p.id = a.planta_id
      join maquina_fisica m  on m.id = r.maquina_fisica_id
      left join recurso_parametro rp
             on rp.recurso_id = r.id and rp.vigencia @> current_date
     order by p.nome, a.nome, r.nome`;
}

/**
 * qt_recursos e equivalencia entram direto na fórmula da capacidade, e o motor
 * faz INNER JOIN em recurso_parametro: recurso sem essa linha é invisível para
 * o cálculo — nem a instalada sai. Por isso todo recurso nasce com uma, e
 * salvar o cadastro garante que ela exista.
 *
 * Vigência ilimitada, mesmo tratamento dado ao horário do turno e ao
 * calendário do recurso: o cadastro guarda a configuração atual.
 */
async function garantirParametro(recursoId, { qt_recursos, equivalencia }) {
  const qt = Number(qt_recursos);
  const eq = Number(equivalencia);

  if (!Number.isFinite(qt) || qt < 0) {
    throw new Error('Quantidade de recursos inválida.');
  }
  if (!Number.isFinite(eq) || eq <= 0) {
    throw new Error('Equivalência tem que ser maior que zero.');
  }

  // Preserva o status: editar o nome de um recurso desativado não pode
  // ressuscitá-lo no cálculo pelas costas.
  const atual = await sql`
    select status_cadastro from recurso_parametro where recurso_id = ${recursoId}`;
  const ativo = atual.length ? atual[0].status_cadastro : true;

  await sql.transaction([
    sql`delete from recurso_parametro where recurso_id = ${recursoId}`,
    sql`insert into recurso_parametro
               (recurso_id, vigencia, qt_recursos, equivalencia, status_cadastro)
        values (${recursoId}, daterange(null::date, null::date), ${qt}, ${eq},
                ${ativo})`,
  ]);
}

// Para o seletor obrigatório da tela de recurso.
export async function areasParaEscolha() {
  return sql`
    select a.id, a.nome, p.nome as planta
      from area a
      join planta p on p.id = a.planta_id
     where a.ativo and p.ativo
     order by p.nome, a.nome`;
}

export async function plantasParaEscolha() {
  return sql`select id, nome from planta where ativo order by nome`;
}

export async function criarRecurso({
  area_id, codigo, nome, tipo_recurso, cc, ct, patrimonio,
  sub_area = '', qt_recursos = 1, equivalencia = 1,
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
    insert into recurso (maquina_fisica_id, area_id, codigo, nome, tipo_recurso,
                         sub_area)
    values (${maquinaId}, ${Number(area_id)}, ${cod}, ${desc}, ${tipo},
            ${String(sub_area ?? '').trim() || null})
    returning id`;

  await garantirParametro(r[0].id, { qt_recursos, equivalencia });
  return r[0].id;
}

export async function alterarRecurso(id, {
  codigo, nome, tipo_recurso, cc, ct, patrimonio,
  sub_area = '', qt_recursos = 1, equivalencia = 1,
}) {
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
    update recurso
       set codigo = ${cod}, nome = ${desc}, tipo_recurso = ${tipo},
           sub_area = ${String(sub_area ?? '').trim() || null}
     where id = ${rid}`;

  await sql`
    update maquina_fisica
       set cc = ${vCc}, ct = ${vCt}, patrimonio = ${vPat},
           codigo = ${`${vCc}-${vCt}-${vPat}`}
     where id = ${atual[0].maquina_fisica_id}`;

  // Recria o parâmetro também no update: é o que conserta recurso criado antes
  // desta correção, que ficou sem linha nenhuma e invisível para o motor.
  await garantirParametro(rid, { qt_recursos, equivalencia });
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

  // Recurso que já entrou em rodada não some: capacidade_fato aponta para ele
  // sem cascade, e apagar arrancaria a referência de números já divulgados.
  //
  // Mas some do planejamento, que é o que se quer de verdade. É para isso que
  // recurso_parametro.status_cadastro existe — o motor o exige nos dois
  // lugares, então desativado deixa de gerar instalada, planejada e
  // disponível a partir do próximo cálculo. O histórico fica intacto.
  if (Number(usos[0].calculos)) {
    await sql`
      update recurso_parametro set status_cadastro = false where recurso_id = ${r}`;
    return { desativado: true, motivo: `já entrou em ${usos[0].calculos} linha(s) de cálculo` };
  }

  const d = await sql`delete from recurso where id = ${r} returning id`;
  if (!d.length) throw new Error('Recurso não encontrado.');
  return { desativado: false };
}

// Os desativados, com o tamanho do rastro que eles deixaram no cálculo.
// A contagem existe para a confirmação dizer o que vai sumir, em vez de
// pedir um "tem certeza?" no vazio.
export async function recursosDesativados() {
  return sql`
    select r.id, r.codigo, r.nome,
           a.nome as area,
           p.nome as planta,
           (select count(*) from capacidade_fato f
             where f.recurso_id = r.id)          as linhas_fato,
           (select count(distinct f.execucao_id) from capacidade_fato f
             where f.recurso_id = r.id)          as rodadas
      from recurso r
      join area a   on a.id = r.area_id
      join planta p on p.id = a.planta_id
      join recurso_parametro rp on rp.recurso_id = r.id
                              and rp.vigencia @> current_date
                              and not rp.status_cadastro
     order by p.nome, a.nome, r.nome`;
}

/**
 * Apaga o recurso de verdade, junto com o rastro dele nas rodadas.
 *
 * DESTRUTIVO e sem volta. capacidade_fato e capacidade_instalada_dia apontam
 * para recurso sem cascade justamente para impedir isso por acidente — aqui a
 * remoção é explícita e deliberada.
 *
 * O que acontece com o histórico: as rodadas que incluíam este recurso passam
 * a somar menos. Um total que alguém já viu muda. É o preço, e é por isso que
 * o caminho normal é desativar.
 *
 * capacidade_memoria não tem FK para recurso, então não bloqueia — mas fica
 * órfã se não for limpa junto.
 */
export async function excluirRecursoDefinitivo(id) {
  const r = Number(id);

  const antes = await sql`
    select (select count(*) from capacidade_fato where recurso_id = ${r}) as fato,
           (select count(*) from capacidade_instalada_dia where recurso_id = ${r}) as instalada,
           (select count(*) from capacidade_memoria where recurso_id = ${r}) as memoria,
           (select maquina_fisica_id from recurso where id = ${r}) as maquina`;
  if (antes[0].maquina === null) throw new Error('Recurso não encontrado.');

  await sql.transaction([
    sql`delete from capacidade_memoria      where recurso_id = ${r}`,
    sql`delete from capacidade_fato         where recurso_id = ${r}`,
    sql`delete from capacidade_instalada_dia where recurso_id = ${r}`,
    // Parâmetro, turnos, calendário, OEE e paradas caem por cascade.
    sql`delete from recurso where id = ${r}`,
    // A máquina física fica órfã se nenhum outro recurso apontar para ela.
    sql`delete from maquina_fisica m
         where m.id = ${antes[0].maquina}
           and not exists (select 1 from recurso x where x.maquina_fisica_id = m.id)`,
  ]);

  return {
    fato: Number(antes[0].fato),
    instalada: Number(antes[0].instalada),
    memoria: Number(antes[0].memoria),
  };
}

export async function reativarRecurso(id) {
  const r = await sql`
    update recurso_parametro set status_cadastro = true
     where recurso_id = ${Number(id)} returning recurso_id`;
  if (!r.length) throw new Error('Recurso sem parâmetro de capacidade.');
}
