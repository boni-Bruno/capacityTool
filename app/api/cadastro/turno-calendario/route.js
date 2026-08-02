import { NextResponse } from 'next/server';
import { incluirTurnoNosCalendarios } from '../../../../lib/cadastro';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Coloca um turno existente nos calendários da planta. Serve para consertar
// turno criado antes de isso passar a ser automático — sem regra de calendário
// ele sai com capacidade zero mesmo estando marcado no recurso.
export async function POST(req) {
  try {
    await exigeSessao();
    const { turno_id } = await req.json();
    const r = await incluirTurnoNosCalendarios(turno_id);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[turno-calendario POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
