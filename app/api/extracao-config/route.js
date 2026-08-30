import { NextResponse } from 'next/server';
import { capacidadeDoRecorte, configuracaoDoRecorte } from '../../../lib/db';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';

// Os números do recorte escolhido, para o .pptx e para a página de impressão.
//
// As duas saídas leem daqui, e não cada uma da sua consulta: o slide e o papel
// mostrando números diferentes da mesma seleção seria o defeito mais difícil de
// perceber desta tela, porque os dois pareceriam certos separadamente.
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    const areas = (b.areas ?? []).map(Number).filter(Number.isInteger);
    if (!areas.length) throw new Error('Escolha ao menos uma área.');

    const ccs = (b.ccs ?? []).map((c) => String(c).trim()).filter(Boolean);
    const ano = Number(b.ano);
    if (!Number.isInteger(ano)) throw new Error('Ano inválido.');
    const origem = b.origem === 'SIMULADO' ? 'SIMULADO' : 'META';

    const [cadastro, capacidade] = await Promise.all([
      configuracaoDoRecorte(areas, ccs),
      capacidadeDoRecorte(areas, ccs, ano, origem),
    ]);

    return NextResponse.json({
      ok: true,
      cadastro: cadastro[0] ?? null,
      capacidade: capacidade[0] ?? null,
    });
  } catch (e) {
    console.error('[extracao-config POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
