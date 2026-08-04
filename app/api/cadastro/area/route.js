import { NextResponse } from 'next/server';
import {
  criarArea, alterarArea, excluirArea, definirAtivoArea,
} from '../../../../lib/estrutura';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

const falha = (e, onde) => {
  console.error(`[area ${onde}]`, e);
  return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                           { status: e.status ?? 400 });
};

export async function POST(req) {
  try {
    await exigeSessao();
    const id = await criarArea(await req.json());
    revalidarCadastros();
    return NextResponse.json({ ok: true, id });
  } catch (e) { return falha(e, 'POST'); }
}

export async function PATCH(req) {
  try {
    await exigeSessao();
    const { id, ...campos } = await req.json();
    await alterarArea(id, campos);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) { return falha(e, 'PATCH'); }
}

export async function PUT(req) {
  try {
    await exigeSessao();
    // Recebe o estado, não "reativa": a tela tem um interruptor, e mandar o
    // valor desejado evita os dois lados discordarem sobre o que era antes.
    const { id, ativo } = await req.json();
    await definirAtivoArea(id, ativo);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) { return falha(e, 'PUT'); }
}

export async function DELETE(req) {
  try {
    await exigeSessao();
    const { id } = await req.json();
    const r = await excluirArea(id);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'DELETE'); }
}
