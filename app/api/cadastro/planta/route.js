import { NextResponse } from 'next/server';
import {
  criarPlanta, alterarPlanta, excluirPlanta, reativarPlanta,
} from '../../../../lib/estrutura';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

const falha = (e, onde) => {
  console.error(`[planta ${onde}]`, e);
  return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                           { status: e.status ?? 400 });
};

export async function POST(req) {
  try {
    await exigeSessao();
    const id = await criarPlanta(await req.json());
    revalidarCadastros();
    return NextResponse.json({ ok: true, id });
  } catch (e) { return falha(e, 'POST'); }
}

export async function PATCH(req) {
  try {
    await exigeSessao();
    const { id, ...campos } = await req.json();
    await alterarPlanta(id, campos);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) { return falha(e, 'PATCH'); }
}

export async function PUT(req) {
  try {
    await exigeSessao();
    const { id } = await req.json();
    await reativarPlanta(id);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) { return falha(e, 'PUT'); }
}

export async function DELETE(req) {
  try {
    await exigeSessao();
    const { id } = await req.json();
    const r = await excluirPlanta(id);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'DELETE'); }
}
