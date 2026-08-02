import { NextResponse } from 'next/server';
import { apagarVigencia } from '../../../../lib/vigencia';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';

// Apagar faixa de vigência inteira. DESTRUTIVO — existe só para desfazer
// cadastro errado, e por isso mora numa rota própria em vez de virar mais um
// método na rota de recurso-turno: quem chama tem que saber que está fazendo
// outra coisa, não o "encerrar" que preserva histórico.
export async function DELETE(req) {
  try {
    await exigeSessao();
    const { tabela, id } = await req.json();
    await apagarVigencia(tabela, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[vigencia DELETE]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
