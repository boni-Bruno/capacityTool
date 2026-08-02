import { NextResponse } from 'next/server';
import { criarTurno, renomearTurno, excluirTurno } from '../../../../lib/cadastro';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';

// Criar turno. Nasce sem nenhum horário: os 7 dias da semana ficam zerados
// para o usuário cadastrar. Turno sem linha num dia = não roda nesse dia.
export async function POST(req) {
  try {
    await exigeSessao();
    const id = await criarTurno(await req.json());
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error('[turno POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

export async function PATCH(req) {
  try {
    await exigeSessao();
    const { id, codigo, nome } = await req.json();
    await renomearTurno(id, { codigo, nome });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[turno PATCH]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

// Turno já usado em outro lugar é desativado em vez de apagado — a resposta
// diz o que aconteceu para a tela poder explicar.
export async function DELETE(req) {
  try {
    await exigeSessao();
    const { id } = await req.json();
    const r = await excluirTurno(id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[turno DELETE]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
