import { NextResponse } from 'next/server';
import { definirHorario, removerHorario } from '../../../../lib/cadastro';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Horário de um turno num dia da semana, com o intervalo de refeição da pessoa
// naquele dia. Substitui o que houver — o cadastro de turno guarda a
// configuração atual, não histórico.
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();
    await definirHorario(b.turno_id, b.dia_semana, b.hora_inicio, b.hora_fim,
                         b.intervalo_pessoa);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[turno-horario POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

// Sem linha para o dia da semana, o turno não roda nesse dia.
export async function DELETE(req) {
  try {
    await exigeSessao();
    const b = await req.json();
    await removerHorario(b.turno_id, b.dia_semana);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[turno-horario DELETE]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
