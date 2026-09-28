// =============================================================================
// TICKETS — o banco (migração 39)
//
// A caixa de entrada do roadmap. As listas e a validação são puras e moram em
// `lib/ticket-formato.js`; aqui é só ler e gravar.
//
// QUEM VÊ O QUE é decidido na CONSULTA, e não na tela: quem responde
// (`tickets.editar`) vê todos, o resto vê os seus. Filtrar na tela deixaria a
// lista inteira viajar até o navegador de quem não pode lê-la — e "não mostrar"
// não é o mesmo que "não mandar".
// =============================================================================

import { sql } from './db';
import { limpaTicket, validaTicket } from './ticket-formato';

const erro = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  return e;
};

/**
 * Abre um chamado. `quem` é a sessão: usuário do banco ou a mestre, que não
 * tem id — por isso o nome vai em texto junto (ver o cabeçalho da migração).
 */
export async function criarTicket(dados, quem) {
  const faltas = validaTicket(dados);
  if (faltas.length) throw erro(`Antes de enviar: ${faltas.join('; ')}.`);
  const t = limpaTicket(dados);
  const [r] = await sql`
    insert into ticket (criado_por, criado_por_nome, produto, tipo, resumo, descricao)
    values (${quem?.tipo === 'usuario' ? quem.id : null},
            ${String(quem?.nome ?? 'desconhecido').slice(0, 120)},
            ${t.produto}, ${t.tipo}, ${t.resumo}, ${t.descricao})
    returning id`;
  return { id: r.id };
}

/**
 * Os chamados que esta sessão pode ver, do mais recente para o mais antigo.
 *
 * `vejoTodos` vem da permissão de responder. A sessão mestre não tem id de
 * usuário: sem `vejoTodos` ela veria os tickets de `criado_por is null`, que
 * são os abertos por qualquer mestre — e é isso mesmo, porque "mestre" é uma
 * pessoa só em qualquer instalação desta ferramenta.
 */
export async function tickets({ vejoTodos = false, usuarioId = null } = {}) {
  if (vejoTodos) {
    return sql`
      select t.*, u.login as autor_login, ru.nome as respondido_por_nome
        from ticket t
        left join usuario u  on u.id = t.criado_por
        left join usuario ru on ru.id = t.respondido_por
       order by t.criado_em desc`;
  }
  return sql`
    select t.*, u.login as autor_login, ru.nome as respondido_por_nome
      from ticket t
      left join usuario u  on u.id = t.criado_por
      left join usuario ru on ru.id = t.respondido_por
     where t.criado_por is not distinct from ${usuarioId}::int
     order by t.criado_em desc`;
}

/**
 * Responde e/ou muda o estado. Quem chama já provou que tem `tickets.editar`.
 *
 * O carimbo de quem respondeu só muda quando há resposta nova: trocar o status
 * de "aberto" para "em análise" não é responder, e sobrescrever o nome ali
 * apagaria quem de fato escreveu.
 */
export async function responderTicket(id, { status, resposta }, quem) {
  const texto = resposta === undefined ? undefined : String(resposta ?? '').trim();
  const [atual] = await sql`select id from ticket where id = ${Number(id)}`;
  if (!atual) throw erro('Chamado não encontrado.', 404);

  if (status !== undefined) {
    await sql`update ticket set status = ${String(status)} where id = ${Number(id)}`;
  }
  if (texto !== undefined) {
    await sql`
      update ticket
         set resposta = ${texto || null},
             respondido_por = ${quem?.tipo === 'usuario' ? quem.id : null},
             respondido_em = ${texto ? new Date().toISOString() : null}
       where id = ${Number(id)}`;
  }
  return { id: Number(id) };
}

/** Quantos chamados estão abertos — para o menu poder avisar algum dia. */
export async function ticketsAbertos() {
  const [{ n }] = await sql`
    select count(*)::int as n from ticket where status in ('ABERTO', 'ANALISE')`;
  return n;
}
