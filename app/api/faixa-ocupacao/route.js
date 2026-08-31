import { NextResponse } from 'next/server';
import { faixasDeOcupacao, salvarFaixasDeOcupacao } from '../../../lib/db';
import { validaFaixas } from '../../../lib/faixa-cor';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';
import { revalidarCadastros } from '../../../lib/revalidar';

// As faixas de cor da ocupação no documento. Ver 29_faixa_ocupacao.sql.
//
// A validação é a mesma da tela (`lib/faixa-cor.js`), e não uma segunda escrita
// dela: tela é conveniência, quem garante é quem grava. O banco também recusa
// sobreposição, mas descobrir por lá entrega ao usuário uma frase em inglês
// sobre um índice gist.
export async function GET() {
  try {
    await exigeSessao();
    return NextResponse.json({ ok: true, faixas: await faixasDeOcupacao() });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

export async function PUT(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    const { faixas, erro } = validaFaixas(b.faixas);
    if (erro) throw new Error(erro);

    await salvarFaixasDeOcupacao(faixas);
    revalidarCadastros();
    return NextResponse.json({ ok: true, faixas: await faixasDeOcupacao() });
  } catch (e) {
    console.error('[faixa-ocupacao PUT]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
