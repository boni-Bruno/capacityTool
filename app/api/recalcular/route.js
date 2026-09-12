import { NextResponse } from 'next/server';
import { recalcular, recursosParaExtracao } from '../../../lib/db';
import { exigeSessao } from '../../../lib/sessao';
import { revalidarCadastros } from '../../../lib/revalidar';

export const maxDuration = 60;

// Uma rodada por requisição — o laço mora no navegador. Com `recursos` no
// corpo é o Recalcular parcial: só aqueles, dentro da rodada que existe.
export async function POST(req) {
  try {
    await exigeSessao();
    const { areaId, ano, origem, recursos } = await req.json();
    const r = await recalcular(Number(areaId), Number(ano), origem ?? 'META',
                               Array.isArray(recursos) ? recursos : null);
    revalidarCadastros();
    // As contagens vão junto: rodada que não gerou linha é um resultado, não
    // uma falha, e a tela precisa poder dizer isso em vez de mandar recalcular
    // de novo.
    return NextResponse.json({
      ok: true, execucaoId: r.id, parcial: r.parcial,
      instalada: r.instalada, fato: r.fato,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e.message ?? 'Falha no cálculo' },
      { status: e.status ?? 500 }
    );
  }
}

// A lista de recursos para o pop-up do parcial. Lida só quando ele abre:
// trezentas linhas não têm por que viajar em toda abertura do painel.
export async function GET() {
  try {
    await exigeSessao();
    return NextResponse.json({ ok: true, recursos: await recursosParaExtracao() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e.message ?? 'Falhou' },
      { status: e.status ?? 500 }
    );
  }
}
