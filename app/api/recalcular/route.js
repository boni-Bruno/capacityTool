import { NextResponse } from 'next/server';
import { recalcular } from '../../../lib/db';
import { exigeSessao } from '../../../lib/sessao';
import { revalidarCadastros } from '../../../lib/revalidar';

export const maxDuration = 60;

export async function POST(req) {
  try {
    await exigeSessao();
    const { areaId, ano, origem } = await req.json();
    const r = await recalcular(Number(areaId), Number(ano), origem ?? 'META');
    revalidarCadastros();
    // As contagens vão junto: rodada que não gerou linha é um resultado, não
    // uma falha, e a tela precisa poder dizer isso em vez de mandar recalcular
    // de novo.
    return NextResponse.json({
      ok: true, execucaoId: r.id, instalada: r.instalada, fato: r.fato,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e.message ?? 'Falha no cálculo' },
      { status: e.status ?? 500 }
    );
  }
}
