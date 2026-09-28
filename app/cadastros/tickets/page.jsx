import Link from 'next/link';
import { tickets } from '../../../lib/tickets';
import { sessaoAtual } from '../../../lib/sessao';
import { podeEditar } from '../../../lib/permissoes';
import { exigeVer } from '../guarda';
import AvisoBanco from '../aviso-banco';
import Lista from './lista';

export const metadata = { title: 'Meus tickets' };
export const dynamic = 'force-dynamic';

// =============================================================================
// MEUS TICKETS
//
// QUEM RESPONDE VÊ TODOS; o resto vê os seus. A regra é do Bruno, e ela é
// aplicada na CONSULTA (lib/tickets.js), não aqui: filtrar na tela deixaria a
// fila inteira viajar até o navegador de quem não pode lê-la.
//
// "Ver todos" é ter `tickets.editar` — quem responde. O Gestor de Planejamento
// tem, por ser cargo protegido; qualquer outro cargo só se alguém marcar.
// =============================================================================

export default async function Page() {
  const negado = await exigeVer('tickets');
  if (negado) return negado;

  const s = await sessaoAtual();
  const vejoTodos = podeEditar(s.perms, 'tickets');

  let lista;
  try {
    lista = await tickets({
      vejoTodos, usuarioId: s.tipo === 'usuario' ? s.id : null,
    });
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  return (
    <>
      <div className="topo">
        <h1 className="titulo">
          {vejoTodos ? 'Tickets' : 'Meus tickets'}
          <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>
            {' '}· {lista.length} chamado(s)
          </span>
        </h1>
        <div className="acoes">
          <Link href="/cadastros/tickets/novo" className="btn btn-primario">
            Criar ticket
          </Link>
        </div>
      </div>

      <Lista
        // O que a tela precisa, e nada do que ela não mostra: descrição e
        // resposta são texto livre de quem escreveu, e o resto é identidade.
        tickets={lista.map((t) => ({
          id: t.id,
          criado_em: t.criado_em,
          autor: t.criado_por_nome,
          autor_login: t.autor_login ?? null,
          meu: s.tipo === 'usuario' ? Number(t.criado_por) === s.id : t.criado_por === null,
          produto: t.produto,
          tipo: t.tipo,
          resumo: t.resumo,
          descricao: t.descricao,
          status: t.status,
          resposta: t.resposta,
          respondido_em: t.respondido_em,
          respondido_por_nome: t.respondido_por_nome ?? null,
        }))}
        vejoTodos={vejoTodos} />
    </>
  );
}
