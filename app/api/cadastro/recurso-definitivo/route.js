import { NextResponse } from 'next/server';
import { excluirRecursoDefinitivo } from '../../../../lib/estrutura';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Apaga o recurso e o rastro dele nas rodadas. DESTRUTIVO e sem volta.
//
// Mora numa rota própria, e não como mais um método na rota de recurso, para
// que ninguém chegue aqui por engano: o DELETE de lá desativa, este apaga.
export async function DELETE(req) {
  try {
    await exigeSessao();
    const { id } = await req.json();
    const r = await excluirRecursoDefinitivo(id);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[recurso-definitivo DELETE]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
