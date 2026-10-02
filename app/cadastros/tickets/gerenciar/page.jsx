import Link from 'next/link';
import { comentariosDosTickets, tickets } from '../../../../lib/tickets';
import { produtos } from '../../../../lib/ticket-formato';
import { sessaoAtual } from '../../../../lib/sessao';
import { exigeVer, podeEditarTela } from '../../guarda';
import AvisoBanco from '../../aviso-banco';
import Lista from '../lista';

export const metadata = { title: 'Gerenciar tickets' };
export const dynamic = 'force-dynamic';

// =============================================================================
// GERENCIAR TICKETS — a fila de todo mundo.
//
// É a tela que "Meus tickets" era antes para quem tinha `tickets.editar`: a
// mesma lista, os mesmos controles de resposta, estado e exclusão. O que mudou
// foi a PORTA. Antes a mesma tela mostrava uma coisa ou outra conforme a
// permissão, e era possível ganhar a fila inteira sem perceber — bastava marcar
// a linha de Roadmap inteira na grade de cargos. Agora é uma tela com nome
// próprio: dar acesso a ela é um ato, e um ato se confere.
//
// `ver` já traz a fila — acompanhar sem responder é legítimo, e é o caso de
// quem só quer saber o que está aberto. `editar` é que libera responder, mudar
// o estado e apagar; quem não tem lê a fila e os controles não aparecem.
// =============================================================================

export default async function Page() {
  const negado = await exigeVer('tickets_gerenciar');
  if (negado) return negado;

  const s = await sessaoAtual();
  const posso = await podeEditarTela('tickets_gerenciar');

  let lista;
  let conversas;
  try {
    lista = await tickets({ vejoTodos: true });
    conversas = await comentariosDosTickets(lista.map((t) => t.id));
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  const abertos = lista.filter(
    (t) => t.status === 'ABERTO' || t.status === 'ANALISE').length;

  return (
    <>
      <div className="topo">
        <h1 className="titulo">
          Gerenciar tickets
          <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>
            {' '}· {abertos} em aberto de {lista.length}
          </span>
        </h1>
        <div className="acoes">
          <Link href="/cadastros/tickets" className="btn btn-mini">
            Meus tickets
          </Link>
        </div>
      </div>

      {!posso && (
        <p className="rodape somente-leitura">
          <strong>Somente leitura.</strong> Seu cargo vê a fila, mas não
          responde nem muda o estado dos chamados.
        </p>
      )}

      <Lista
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
          comentarios: (conversas.get(Number(t.id)) ?? []).map((c) => ({
            id: c.id, autor_nome: c.autor_nome, texto: c.texto,
            criado_em: c.criado_em,
          })),
        }))}
        vejoTodos
        podeResponder={posso}
        produtos={produtos()} />
    </>
  );
}
