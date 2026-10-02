import { comentariosDosTickets, tickets } from '../../../lib/tickets';
import { produtos } from '../../../lib/ticket-formato';
import { sessaoAtual } from '../../../lib/sessao';
import { exigeVer, podeEditarTela } from '../guarda';
import AvisoBanco from '../aviso-banco';
import Abrir from './abrir';
import Lista from './lista';

export const metadata = { title: 'Meus tickets' };
export const dynamic = 'force-dynamic';

// =============================================================================
// MEUS TICKETS — os seus, e só os seus.
//
// Uma tela para o ciclo inteiro de quem usa a ferramenta: ver o que abriu,
// abrir um novo (no pop-up) e corrigir o que escreveu enquanto ninguém
// respondeu. A fila de TODOS é outra tela, Gerenciar tickets, e essa separação
// é o conserto de uma armadilha: até 02/10/2026 `tickets.editar` queria dizer
// "ver e responder os de todo mundo", e marcar a linha de Roadmap inteira na
// grade de cargos — o gesto natural — entregava a fila da ferramenta a um
// usuário convidado.
//
// AQUI `vejoTodos` É SEMPRE FALSO, e não "depende da permissão": a tela é "os
// meus" pelo nome e pelo endereço. Quem cuida da fila entra pela outra porta e
// sabe que entrou nela.
//
// O recorte é da CONSULTA (lib/tickets.js), não da tela: filtrar depois faria a
// fila inteira viajar até o navegador de quem não pode lê-la, e "não mostrar"
// não é o mesmo que "não mandar".
// =============================================================================

export default async function Page() {
  const negado = await exigeVer('tickets');
  if (negado) return negado;

  const s = await sessaoAtual();

  let lista;
  let conversas;
  try {
    lista = await tickets({
      vejoTodos: false, usuarioId: s.tipo === 'usuario' ? s.id : null,
    });
    // Numa consulta só, e não uma por chamado: a lista abre dezenas, e uma ida
    // ao banco por linha seria uma série de round trips numa tela que hoje é
    // uma consulta.
    conversas = await comentariosDosTickets(lista.map((t) => t.id));
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  return (
    <>
      <div className="topo">
        <h1 className="titulo">
          Meus tickets
          <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>
            {' '}· {lista.length} chamado(s)
          </span>
        </h1>
        <div className="acoes">
          <Abrir produtos={produtos()}
                 podeEnviar={await podeEditarTela('tickets')} />
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
          // Aqui são todos meus, por construção da consulta — mas o campo
          // continua saindo do dado, e não de um `true` cravado: é ele que
          // libera o botão de corrigir, e cravá-lo seria decidir na tela uma
          // coisa que o banco já responde.
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
        vejoTodos={false}
        produtos={produtos()} />
    </>
  );
}
