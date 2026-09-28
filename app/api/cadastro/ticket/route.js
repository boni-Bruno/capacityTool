import { NextResponse } from 'next/server';
import {
  criarTicket, editarTicket, excluirTicket, responderTicket,
} from '../../../../lib/tickets';
import { STATUS } from '../../../../lib/ticket-formato';
import { pode } from '../../../../lib/permissoes';
import { exigeRota } from '../../../../lib/sessao';
import { mensagemDeErro } from '../../../../lib/erros';
import { revalidarCadastros } from '../../../../lib/revalidar';

const falha = (e, onde) => {
  console.error(`[ticket ${onde}]`, e);
  return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                           { status: e.status ?? 400 });
};

// Abrir um chamado. A sessão diz quem é — o corpo não manda autor, senão
// qualquer um abriria ticket em nome de outro.
export async function POST(req) {
  try {
    const s = await exigeRota(req);
    const b = await req.json();
    const r = await criarTicket(b, s);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'POST'); }
}

// Corrigir o que foi escrito. A rota pede só `ticket_novo.editar` — a
// pergunta "este chamado é seu, e ainda dá tempo?" é do domínio e mora em
// lib/tickets.js, com o ticket lido do banco. Esconder o botão na tela não
// impediria um PUT direto.
export async function PUT(req) {
  try {
    const s = await exigeRota(req);
    const b = await req.json();
    const r = await editarTicket(b.id, b, {
      usuarioId: s.tipo === 'usuario' ? s.id : null,
      cuidoDaFila: pode(s.perms, 'tickets.editar'),
    });
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'PUT'); }
}

// Apagar — só quem cuida da fila, e a rota já conferiu isso.
export async function DELETE(req) {
  try {
    await exigeRota(req);
    const { id } = await req.json();
    const r = await excluirTicket(id);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'DELETE'); }
}

// Responder e mudar o estado — só quem tem `tickets.editar`, e a rota já
// conferiu isso.
export async function PATCH(req) {
  try {
    const s = await exigeRota(req);
    const b = await req.json();
    if (b.status !== undefined && !STATUS.some((x) => x.codigo === b.status)) {
      throw Object.assign(new Error('Estado desconhecido.'), { status: 400 });
    }
    const r = await responderTicket(b.id, { status: b.status, resposta: b.resposta }, s);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'PATCH'); }
}
