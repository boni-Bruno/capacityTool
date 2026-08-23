import { NextResponse } from 'next/server';
import { salvarRecursosAp } from '../../../lib/demanda';
import { montarRecursosAp } from '../../../lib/ap';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';
import { revalidarCadastros } from '../../../lib/revalidar';

// A quantidade de recurso do AP, importada do parquet de lá.
//
// A leitura do arquivo acontece no NAVEGADOR e chega aqui como linhas — mesma
// divisão da carga de demanda, pelo mesmo motivo: o relatório de conferência
// aparece antes de qualquer coisa ser gravada.
//
// O servidor refaz o condensamento em vez de confiar no que a tela mandou. É
// barato (duzentas e poucas linhas) e fecha o caminho de gravar uma quantidade
// que a conferência nunca viu.
export async function POST(req) {
  try {
    await exigeSessao();
    const { linhas, extraido_em } = await req.json();

    const { problemas, itens } = montarRecursosAp(linhas);
    if (problemas.length) {
      throw new Error(problemas.slice(0, 3).join(' '));
    }

    const n = await salvarRecursosAp(itens, extraido_em ?? null);
    revalidarCadastros();
    return NextResponse.json({ ok: true, centros: n });
  } catch (e) {
    console.error('[recursos-ap POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
