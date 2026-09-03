import { NextResponse } from 'next/server';
import {
  criarTurno, renomearTurno, excluirTurno, reativarTurno,
} from '../../../../lib/cadastro';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Criar turno. Nasce sem nenhum horário: os 7 dias da semana ficam zerados
// para o usuário cadastrar. Turno sem linha num dia = não roda nesse dia.
export async function POST(req) {
  try {
    await exigeSessao();
    const id = await criarTurno(await req.json());
    revalidarCadastros();
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error('[turno POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

export async function PATCH(req) {
  try {
    await exigeSessao();
    const { id, codigo, nome } = await req.json();
    await renomearTurno(id, { codigo, nome });
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[turno PATCH]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

// Volta a ativar um turno desativado.
export async function PUT(req) {
  try {
    await exigeSessao();
    const { id } = await req.json();
    await reativarTurno(id);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[turno PUT]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

// Apagar de vez, migrando o cadastro para outro turno quando houver.
//
// A resposta diz o que aconteceu — apagou, migrou, ou parou pedindo destino —
// porque as três levam a telas diferentes, e uma resposta só de "ok" faria a
// tela adivinhar qual delas mostrar.
export async function DELETE(req) {
  try {
    await exigeSessao();
    const { id, migrar_para: migrarPara } = await req.json();
    const r = await excluirTurno(id, { migrarPara });
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[turno DELETE]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
