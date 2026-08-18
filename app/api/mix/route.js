import { NextResponse } from 'next/server';
import {
  apontarTaxaMix, limparMixCt, limparTaxaMix, salvarMixCt,
} from '../../../lib/demanda';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';
import { revalidarCadastros } from '../../../lib/revalidar';

// O ajuste manual de mix e o apontamento de taxa.
//
// Não refaz a matriz do índice: o mix manual não muda o índice de conversão de
// ninguém — muda como o tempo de um CT se reparte entre rótulos, e essa conta
// acontece na leitura, em fatiasDoRotulo.
const falha = (e, onde) => {
  console.error(`[mix ${onde}]`, e);
  return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                           { status: e.status ?? 400 });
};

export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    if (b.acao === 'taxa') {
      await apontarTaxaMix(b);
      revalidarCadastros();
      return NextResponse.json({ ok: true });
    }

    const gravadas = await salvarMixCt(b);
    revalidarCadastros();
    return NextResponse.json({ ok: true, gravadas });
  } catch (e) { return falha(e, 'POST'); }
}

export async function DELETE(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    if (b.acao === 'taxa') await limparTaxaMix(b.ct, b.atributo);
    else await limparMixCt(b.ct, b.ano, b.atributo);

    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) { return falha(e, 'DELETE'); }
}
