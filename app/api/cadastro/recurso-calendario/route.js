import { NextResponse } from 'next/server';
import { definirCalendario } from '../../../../lib/cadastro';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Regime de dias do recurso — rodízio ou padrão. Para quem cadastra é uma
// característica do recurso; no modelo é qual calendário ele segue.
export async function POST(req) {
  try {
    await exigeSessao();
    const { recurso_id, calendario_id } = await req.json();
    await definirCalendario(recurso_id, calendario_id);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[recurso-calendario POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
