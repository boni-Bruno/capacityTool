import { NextResponse } from 'next/server';
import { definirTurnosDoAno } from '../../../../lib/cadastro';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';

// Salva a matriz mês x turno de um recurso, um ano por vez.
//
// Corpo: { recurso_id, ano, marcados: { turnoId: [meses] } }
//
// O ano inteiro vem da tela em cada salvamento — turno que não aparece em
// `marcados` fica desligado no ano. O que está configurado fora do ano é
// preservado pelo recomporFaixas().
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    const recursoId = Number(b.recurso_id);
    const ano = Number(b.ano);
    if (!Number.isInteger(recursoId) || recursoId <= 0) {
      throw new Error('Recurso inválido.');
    }
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      throw new Error('Ano inválido.');
    }

    const r = await definirTurnosDoAno(recursoId, ano, b.marcados ?? {});
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[recurso-turno POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
