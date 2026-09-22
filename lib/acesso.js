// =============================================================================
// ACESSO — cargos, usuários e escopo (migração 38)
//
// O que o banco guarda sobre quem entra. A regra do que cada permissão
// significa mora em lib/permissoes.js e a do escopo em lib/escopo.js, os dois
// puros; aqui é só leitura e escrita.
//
// USUÁRIO NÃO SE APAGA: desativa. `criado_por` e `ultimo_acesso` são a
// história de quem mexeu na fábrica, e apagar a linha apagaria a resposta de
// "quem convidou fulano?" daqui a um ano.
//
// O CARGO PROTEGIDO (Gestor de Planejamento) não perde permissão nem some:
// ele é a garantia de que sempre existe um cargo que pode tudo, e a tela de
// cargos nem oferece a grade para ele.
// =============================================================================

import { sql } from './db';
import { geraSalt, hashSenha, validaSenha } from './senha';
import { normaliza } from './permissoes';
import { NIVEIS } from './escopo';

const erro = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  return e;
};

// ---- cargos -----------------------------------------------------------------

export async function cargos() {
  return sql`
    select c.id, c.nome, c.protegido,
           coalesce(array_agg(cp.codigo order by cp.codigo)
                    filter (where cp.codigo is not null), '{}') as permissoes,
           (select count(*)::int from usuario u where u.cargo_id = c.id) as usuarios
      from cargo c
      left join cargo_permissao cp on cp.cargo_id = c.id
     group by c.id
     order by c.protegido desc, c.nome`;
}

export async function cargoPorId(id) {
  const r = await sql`
    select c.id, c.nome, c.protegido,
           coalesce(array_agg(cp.codigo order by cp.codigo)
                    filter (where cp.codigo is not null), '{}') as permissoes
      from cargo c
      left join cargo_permissao cp on cp.cargo_id = c.id
     where c.id = ${Number(id)}
     group by c.id`;
  return r[0] ?? null;
}

const nomeLimpo = (nome) => {
  const n = String(nome ?? '').trim();
  if (!n) throw erro('Dê um nome ao cargo.');
  if (n.length > 60) throw erro('Nome do cargo: no máximo 60 caracteres.');
  return n;
};

export async function criarCargo({ nome, permissoes }) {
  const n = nomeLimpo(nome);
  const dup = await sql`select 1 from cargo where lower(nome) = lower(${n})`;
  if (dup.length) throw erro(`Já existe um cargo chamado "${n}".`);
  const [c] = await sql`insert into cargo (nome) values (${n}) returning id`;
  await gravaPermissoes(c.id, permissoes);
  return { id: c.id };
}

export async function alterarCargo(id, { nome, permissoes }) {
  const atual = await cargoPorId(id);
  if (!atual) throw erro('Cargo não encontrado.', 404);
  const n = nomeLimpo(nome ?? atual.nome);
  const dup = await sql`
    select 1 from cargo where lower(nome) = lower(${n}) and id <> ${Number(id)}`;
  if (dup.length) throw erro(`Já existe um cargo chamado "${n}".`);
  await sql`update cargo set nome = ${n} where id = ${Number(id)}`;
  // O protegido não tem grade: qualquer lista mandada para ele é ignorada.
  if (!atual.protegido && permissoes !== undefined) await gravaPermissoes(id, permissoes);
  return { id: Number(id) };
}

async function gravaPermissoes(cargoId, permissoes) {
  const lista = normaliza(permissoes);
  await sql.transaction([
    sql`delete from cargo_permissao where cargo_id = ${Number(cargoId)}`,
    sql`insert into cargo_permissao (cargo_id, codigo)
        select ${Number(cargoId)}, unnest(${lista}::text[])`,
  ]);
}

export async function excluirCargo(id) {
  const c = await cargoPorId(id);
  if (!c) throw erro('Cargo não encontrado.', 404);
  if (c.protegido) throw erro('Este cargo é protegido e não pode ser apagado.');
  const [{ n }] = await sql`
    select count(*)::int as n from usuario where cargo_id = ${Number(id)}`;
  if (n > 0) {
    throw erro(`${n} usuário(s) estão neste cargo. Troque o cargo deles antes.`);
  }
  await sql`delete from cargo where id = ${Number(id)}`;
  return { id: Number(id) };
}

/** As permissões efetivas de um cargo: '*' para o protegido, senão a lista. */
export async function permissoesDoCargo(cargoId) {
  const c = await cargoPorId(cargoId);
  if (!c) return [];
  return c.protegido ? '*' : c.permissoes;
}

// ---- usuários ---------------------------------------------------------------

export async function usuarios() {
  const lista = await sql`
    select u.id, u.login, u.nome, u.email, u.trocar_senha, u.cargo_id,
           c.nome as cargo, c.protegido as cargo_protegido, u.ativo,
           u.criado_em, u.criado_por, u.ultimo_acesso,
           (select coalesce(json_agg(json_build_object(
                     'nivel', e.nivel, 'referencia_id', e.referencia_id)), '[]')
              from usuario_escopo e where e.usuario_id = u.id) as escopo
      from usuario u
      join cargo c on c.id = u.cargo_id
     order by u.ativo desc, u.nome`;
  return lista;
}

export async function usuarioPorId(id) {
  const r = await sql`
    select u.id, u.login, u.nome, u.email, u.trocar_senha, u.cargo_id,
           c.nome as cargo, c.protegido as cargo_protegido, u.ativo,
           u.senha_hash, u.senha_salt
      from usuario u join cargo c on c.id = u.cargo_id
     where u.id = ${Number(id)}`;
  return r[0] ?? null;
}

export async function usuarioPorLogin(login) {
  const l = String(login ?? '').trim().toLowerCase();
  if (!l) return null;
  const r = await sql`
    select u.id, u.login, u.nome, u.email, u.trocar_senha, u.cargo_id,
           c.protegido as cargo_protegido, u.ativo, u.senha_hash, u.senha_salt
      from usuario u join cargo c on c.id = u.cargo_id
     where u.login = ${l}`;
  return r[0] ?? null;
}

export async function usuarioPorEmail(email) {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return null;
  const r = await sql`
    select u.id, u.login, u.nome, u.email, u.trocar_senha, u.cargo_id,
           c.protegido as cargo_protegido, u.ativo
      from usuario u join cargo c on c.id = u.cargo_id
     where u.email = ${e}`;
  return r[0] ?? null;
}

/** As linhas de escopo de um usuário. */
export async function escopoDe(usuarioId) {
  return sql`
    select nivel, referencia_id from usuario_escopo
     where usuario_id = ${Number(usuarioId)}
     order by nivel, referencia_id`;
}

const loginLimpo = (login) => {
  const l = String(login ?? '').trim().toLowerCase();
  if (!l) throw erro('Informe o usuário de login.');
  if (!/^[a-z0-9._-]{3,60}$/.test(l)) {
    throw erro('Login: de 3 a 60 caracteres, só letras minúsculas, números, ponto, hífen e sublinhado.');
  }
  return l;
};

const emailLimpo = (email) => {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw erro('E-mail inválido.');
  return e;
};

const nomePessoa = (nome) => {
  const n = String(nome ?? '').trim();
  if (!n) throw erro('Informe o nome.');
  return n;
};

const senhaValida = (senha) => {
  const faltas = validaSenha(senha);
  if (faltas.length) throw erro(`Senha: falta ${faltas.join(', ')}.`);
  return String(senha);
};

const linhasDeEscopo = (escopo) => {
  const linhas = (escopo ?? []).filter((e) => NIVEIS.includes(e?.nivel));
  for (const e of linhas) {
    const ref = e.nivel === 'EMPRESA' ? null : Number(e.referencia_id);
    if (e.nivel !== 'EMPRESA' && !Number.isInteger(ref)) throw erro('Escopo inválido.');
    e.referencia_id = ref;
  }
  return linhas;
};

async function gravaEscopo(usuarioId, escopo) {
  const linhas = linhasDeEscopo(escopo);
  await sql.transaction([
    sql`delete from usuario_escopo where usuario_id = ${Number(usuarioId)}`,
    sql`insert into usuario_escopo (usuario_id, nivel, referencia_id)
        select ${Number(usuarioId)}, n, r
          from unnest(${linhas.map((e) => e.nivel)}::text[],
                      ${linhas.map((e) => e.referencia_id)}::int[]) as t(n, r)`,
  ]);
}

/**
 * Convida: cria com a senha inicial e `trocar_senha` ligado — a pessoa define
 * a dela no primeiro acesso. `criadoPor` é o id de quem convidou (nulo para a
 * sessão mestre).
 */
export async function criarUsuario({ login, nome, email, senha, cargo_id, escopo },
                                   criadoPor = null) {
  const l = loginLimpo(login);
  const n = nomePessoa(nome);
  const e = emailLimpo(email);
  const s = senhaValida(senha);
  const cargo = await cargoPorId(cargo_id);
  if (!cargo) throw erro('Escolha um cargo.');

  const dupLogin = await sql`select 1 from usuario where login = ${l}`;
  if (dupLogin.length) throw erro(`Já existe o login "${l}".`);
  if (e) {
    const dupEmail = await sql`select 1 from usuario where email = ${e}`;
    if (dupEmail.length) throw erro(`O e-mail ${e} já está em outro usuário.`);
  }

  const salt = geraSalt();
  const hash = await hashSenha(s, salt);
  const [u] = await sql`
    insert into usuario (login, nome, email, senha_hash, senha_salt, trocar_senha,
                         cargo_id, criado_por)
    values (${l}, ${n}, ${e}, ${hash}, ${salt}, true, ${Number(cargo_id)}, ${criadoPor})
    returning id`;
  await gravaEscopo(u.id, escopo);
  return { id: u.id };
}

/**
 * Altera nome, e-mail, cargo e escopo. Login não muda: é a identidade que a
 * pessoa digita e que aparece na história. Senha vai por redefinirSenha.
 */
export async function alterarUsuario(id, { nome, email, cargo_id, escopo }) {
  const atual = await usuarioPorId(id);
  if (!atual) throw erro('Usuário não encontrado.', 404);
  const n = nomePessoa(nome ?? atual.nome);
  const e = email === undefined ? atual.email : emailLimpo(email);
  const cargoId = cargo_id === undefined ? atual.cargo_id : Number(cargo_id);
  if (!(await cargoPorId(cargoId))) throw erro('Escolha um cargo.');
  if (e) {
    const dup = await sql`
      select 1 from usuario where email = ${e} and id <> ${Number(id)}`;
    if (dup.length) throw erro(`O e-mail ${e} já está em outro usuário.`);
  }
  await sql`
    update usuario set nome = ${n}, email = ${e}, cargo_id = ${cargoId}
     where id = ${Number(id)}`;
  if (escopo !== undefined) await gravaEscopo(id, escopo);
  return { id: Number(id) };
}

/** O gestor redefine: senha nova e trocar_senha ligado de novo. */
export async function redefinirSenha(id, senha) {
  const s = senhaValida(senha);
  const salt = geraSalt();
  const hash = await hashSenha(s, salt);
  await sql`
    update usuario set senha_hash = ${hash}, senha_salt = ${salt}, trocar_senha = true
     where id = ${Number(id)}`;
  return { id: Number(id) };
}

/** A própria pessoa troca: senha nova e trocar_senha desligado. */
export async function trocarPropriaSenha(id, senha) {
  const s = senhaValida(senha);
  const salt = geraSalt();
  const hash = await hashSenha(s, salt);
  await sql`
    update usuario set senha_hash = ${hash}, senha_salt = ${salt}, trocar_senha = false
     where id = ${Number(id)}`;
  return { id: Number(id) };
}

export async function definirAtivoUsuario(id, ativo) {
  await sql`update usuario set ativo = ${Boolean(ativo)} where id = ${Number(id)}`;
  return { id: Number(id), ativo: Boolean(ativo) };
}

export async function registraAcesso(id) {
  await sql`update usuario set ultimo_acesso = now() where id = ${Number(id)}`;
}

/** Quantos usuários ATIVOS têm o cargo protegido — para ninguém tirar o último. */
export async function gestoresAtivos() {
  const [{ n }] = await sql`
    select count(*)::int as n
      from usuario u join cargo c on c.id = u.cargo_id
     where u.ativo and c.protegido`;
  return n;
}
