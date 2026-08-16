import { NextResponse } from 'next/server';
import { definirOrigem, herdarCcEmLote, limparOrigem } from '../../../lib/demanda';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';
import { revalidarCadastros } from '../../../lib/revalidar';

// De onde cada CT sem demanda própria tira o índice de conversão.
//
// Separado da rota de importação porque não é carga: é decisão de cadastro, e
// ela vale para todas as cargas, presentes e futuras. Importar uma base nova
// não desfaz o que foi decidido aqui.
const falha = (e, onde) => {
  console.error(`[demanda-origem ${onde}]`, e);
  return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                           { status: e.status ?? 400 });
};

export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    if (b.acao === 'lote') {
      const n = await herdarCcEmLote(b.carga_id, b.cc);
      revalidarCadastros();
      return NextResponse.json({ ok: true, aplicados: n });
    }

    await definirOrigem(b.ct, b.tipo, b.valor);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) { return falha(e, 'POST'); }
}

export async function DELETE(req) {
  try {
    await exigeSessao();
    const { ct } = await req.json();
    await limparOrigem(ct);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) { return falha(e, 'DELETE'); }
}
