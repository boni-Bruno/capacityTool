import { NextResponse } from 'next/server';
import { alterarCargo, criarCargo, excluirCargo } from '../../../../lib/acesso';
import { exigePermissao } from '../../../../lib/sessao';
import { mensagemDeErro } from '../../../../lib/erros';
import { revalidarCadastros } from '../../../../lib/revalidar';

const falha = (e, onde) => {
  console.error(`[cargo ${onde}]`, e);
  return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                           { status: e.status ?? 400 });
};

export async function POST(req) {
  try {
    await exigePermissao('cargos.editar');
    const b = await req.json();
    const r = await criarCargo({ nome: b.nome, permissoes: b.permissoes });
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'POST'); }
}

export async function PATCH(req) {
  try {
    await exigePermissao('cargos.editar');
    const b = await req.json();
    const r = await alterarCargo(b.id, { nome: b.nome, permissoes: b.permissoes });
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'PATCH'); }
}

export async function DELETE(req) {
  try {
    await exigePermissao('cargos.editar');
    const b = await req.json();
    const r = await excluirCargo(b.id);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'DELETE'); }
}
