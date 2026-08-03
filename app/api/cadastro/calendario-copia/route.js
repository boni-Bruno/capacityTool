import { NextResponse } from 'next/server';
import { copiarCalendario } from '../../../../lib/calendario';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Importa um calendário de outra planta: os dias e os pesos de dia útil.
// Opcionalmente copia junto os turnos que faltarem no destino.
export async function POST(req) {
  try {
    await exigeSessao();
    const r = await copiarCalendario(await req.json());
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[calendario-copia POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
