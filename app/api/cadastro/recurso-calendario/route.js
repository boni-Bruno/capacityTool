import { NextResponse } from 'next/server';
import { definirCalendarioDoAno } from '../../../../lib/cadastro';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeRota } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Regime de dias do recurso — rodízio ou padrão, MÊS A MÊS. Para quem cadastra
// é uma característica do recurso; no modelo é qual calendário ele segue em
// cada faixa de vigência.
//
// `por_mes` é { mes: calendario_id } e só precisa trazer os meses que mudam: o
// que não vier fica como estava. Ver definirCalendarioDoAno — aqui o branco não
// pode significar "apagar", porque recurso sem regime some do cálculo calado.
export async function POST(req) {
  try {
    await exigeRota(req);
    const { recurso_id, ano, por_mes } = await req.json();
    const r = await definirCalendarioDoAno(recurso_id, ano, por_mes);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[recurso-calendario POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
