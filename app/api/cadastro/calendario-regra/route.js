import { NextResponse } from 'next/server';
import { definirDias } from '../../../../lib/calendario';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Dias da semana em que a linha trabalha.
// Corpo: { calendario_id, dias: [0..6] }
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();
    const r = await definirDias(b.calendario_id, b.dias ?? []);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[calendario-regra POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
