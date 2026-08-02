import { NextResponse } from 'next/server';
import { abrirVigencia, encerrarVigencia } from '../../../../lib/vigencia';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';

// Horário de um turno num dia da semana. Sempre fecha-e-abre vigência:
// editar no lugar reescreveria o histórico.
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();
    const r = await abrirVigencia(
      'turno_horario',
      { turno_id: Number(b.turno_id), dia_semana: Number(b.dia_semana) },
      b.a_partir_de,
      { hora_inicio: b.hora_inicio, hora_fim: b.hora_fim }
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[turno-horario POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

// Encerrar = turno deixa de rodar nesse dia da semana a partir da data.
// Não apaga o passado: o que já foi calculado continua explicável.
export async function DELETE(req) {
  try {
    await exigeSessao();
    const b = await req.json();
    const r = await encerrarVigencia(
      'turno_horario',
      { turno_id: Number(b.turno_id), dia_semana: Number(b.dia_semana) },
      b.em
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[turno-horario DELETE]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
