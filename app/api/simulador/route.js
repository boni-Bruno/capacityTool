import { NextResponse } from 'next/server';
import { simuladorPorCtMes } from '../../../lib/db';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeRota } from '../../../lib/sessao';
import { alcancaArea } from '../../../lib/escopo';

// Os números do simulador de quantidade de recursos: por CT e mês, demanda,
// disponível e o que uma unidade entrega. O servidor só entrega números; a
// planilha com as fórmulas é montada no navegador (`lib/simulador.js`).
//
// O CENÁRIO É OBRIGATÓRIO, ao contrário da extração das configurações: sem
// demanda não há o que dimensionar, e uma planilha com a coluna de demanda
// zerada diria "precisa de zero máquinas" com toda a convicção.
export async function POST(req) {
  try {
    const s = await exigeRota(req);
    const b = await req.json();

    // Fora do escopo, a área simplesmente não entra: pedir a Matriz inteira
    // com escopo de Ibirama devolve Ibirama.
    const areas = (b.areas ?? []).map(Number).filter(Number.isInteger)
      .filter((id) => alcancaArea(s.areas, id));
    if (!areas.length) throw new Error('Escolha ao menos uma área.');

    const ccs = (b.ccs ?? []).map((c) => String(c).trim()).filter(Boolean);
    const ano = Number(b.ano);
    if (!Number.isInteger(ano)) throw new Error('Ano inválido.');
    const origem = b.origem === 'SIMULADO' ? 'SIMULADO' : 'META';

    const carga = Number(b.carga);
    if (!Number.isInteger(carga) || carga <= 0) {
      throw new Error('Escolha o cenário de demanda — sem ele não há o que dimensionar.');
    }

    const linhas = await simuladorPorCtMes(areas, ccs, ano, origem, carga);
    return NextResponse.json({ ok: true, linhas });
  } catch (e) {
    console.error('[simulador POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
