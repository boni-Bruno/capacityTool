import { NextResponse } from 'next/server';
import { definirRegras } from '../../../../lib/calendario';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Matriz dia da semana x turno de um calendário.
// Corpo: { calendario_id, marcados: { turnoId: [dias] } }
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();
    const r = await definirRegras(b.calendario_id, b.marcados ?? {});
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[calendario-regra POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
