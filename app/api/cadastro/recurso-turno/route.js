import { NextResponse } from 'next/server';
import { abrirVigencia, encerrarVigencia } from '../../../../lib/vigencia';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';

// Vínculo recurso x turno. escala_id fica quase sempre null: na empresa o
// rodízio é das pessoas e resolvido por calendário, não por escala.
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();
    const r = await abrirVigencia(
      'recurso_turno',
      { recurso_id: Number(b.recurso_id), turno_id: Number(b.turno_id) },
      b.a_partir_de,
      {
        escala_id: b.escala_id ? Number(b.escala_id) : null,
        escala_data_referencia: b.escala_data_referencia || null,
      }
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[recurso-turno POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

export async function DELETE(req) {
  try {
    await exigeSessao();
    const b = await req.json();
    const r = await encerrarVigencia(
      'recurso_turno',
      { recurso_id: Number(b.recurso_id), turno_id: Number(b.turno_id) },
      b.em
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[recurso-turno DELETE]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
