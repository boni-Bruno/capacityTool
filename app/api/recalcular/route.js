import { NextResponse } from 'next/server';
import { recalcular } from '../../../lib/db';
import { exigeSessao } from '../../../lib/sessao';

export const maxDuration = 60;

export async function POST(req) {
  try {
    await exigeSessao();
    const { areaId, ano } = await req.json();
    const id = await recalcular(Number(areaId), Number(ano));
    return NextResponse.json({ ok: true, execucaoId: id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e.message ?? 'Falha no cálculo' },
      { status: e.status ?? 500 }
    );
  }
}
