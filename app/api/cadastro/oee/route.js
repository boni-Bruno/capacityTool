import { NextResponse } from 'next/server';
import { definirOeeDoAno } from '../../../../lib/oee';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Salva o OEE de um recurso, um ano e uma origem por vez.
// Corpo: { recurso_id, ano, origem, meses: { 1: '85', ... } }
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    const ano = Number(b.ano);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      throw new Error('Ano inválido.');
    }

    const r = await definirOeeDoAno(b.recurso_id, ano, b.origem, b.meses ?? {});
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[oee POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
