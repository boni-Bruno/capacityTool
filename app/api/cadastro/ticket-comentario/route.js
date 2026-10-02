import { NextResponse } from 'next/server';
import { comentarTicket } from '../../../../lib/tickets';
import { pode } from '../../../../lib/permissoes';
import { exigeRota } from '../../../../lib/sessao';
import { mensagemDeErro } from '../../../../lib/erros';
import { revalidarCadastros } from '../../../../lib/revalidar';

// A CONVERSA DO CHAMADO (migração 47).
//
// Rota própria, e não mais um método em `cadastro/ticket`: aquela pasta já usa
// os quatro verbos — POST abre, PUT corrige, PATCH responde, DELETE apaga — e
// comentar é um quinto ato, com uma regra de permissão só dele.
//
// A rota aceita quem abre chamado OU quem cuida da fila; DE QUEM É O CHAMADO é
// pergunta do domínio e fica em lib/tickets.js, com o ticket lido do banco.
export async function POST(req) {
  try {
    const s = await exigeRota(req);
    const b = await req.json();
    const r = await comentarTicket(b.id, b.texto, {
      usuarioId: s.tipo === 'usuario' ? s.id : null,
      cuidoDaFila: pode(s.perms, 'tickets_gerenciar.editar'),
      nome: s.nome,
    });
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[ticket-comentario POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
