import { NextResponse } from 'next/server';
import { criarParada, apagarParada } from '../../../../lib/cadastro';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';

// Parada é evento, não parâmetro versionado — por isso insert/delete direto.
// Setup não entra aqui: já está embutido no OEE, descontar de novo contaria
// a mesma perda duas vezes.
export async function POST(req) {
  try {
    await exigeSessao();
    const id = await criarParada(await req.json());
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error('[parada POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

export async function DELETE(req) {
  try {
    await exigeSessao();
    const { id } = await req.json();
    await apagarParada(Number(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[parada DELETE]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
