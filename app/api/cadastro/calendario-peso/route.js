import { NextResponse } from 'next/server';
import { definirPesos } from '../../../../lib/calendario';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Peso de cada dia da semana na contagem de dias úteis.
// Corpo: { calendario_id, pesos: { 0: 0, 1: 1, ..., 6: 0.5 } }
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();
    await definirPesos(b.calendario_id, b.pesos ?? {});
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[calendario-peso POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
