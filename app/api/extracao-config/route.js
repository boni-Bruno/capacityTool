import { NextResponse } from 'next/server';
import {
  capacidadeDoRecorte, configuracaoDoRecorte, detalheDoRecorte,
} from '../../../lib/db';
import { resolvePeriodo } from '../../../lib/periodo';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';

// Os números do recorte escolhido, para o .pptx e para a página de impressão.
//
// As duas saídas leem daqui, e não cada uma da sua consulta: o slide e o papel
// mostrando números diferentes da mesma seleção seria o defeito mais difícil de
// perceber desta tela, porque os dois pareceriam certos separadamente.
//
// Vêm três coisas: o cadastro do recorte inteiro, a capacidade dele no período,
// e o mesmo recorte aberto por CT. O agrupamento em CC acontece no navegador,
// somando as linhas de CT — abrir uma segunda consulta por CC daria dois
// caminhos capazes de discordar em silêncio.
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

    // O mesmo resolvedor do painel: fecha o intervalo dentro do ano escolhido,
    // porque um recorte atravessando a virada somaria fora do ano que o
    // documento diz no título.
    const { de, ate } = resolvePeriodo({ de: b.de, ate: b.ate }, ano);

    const carga = Number.isInteger(Number(b.carga)) && Number(b.carga) > 0
      ? Number(b.carga) : null;

    const [cadastro, capacidade, grupos] = await Promise.all([
      configuracaoDoRecorte(areas, ccs),
      capacidadeDoRecorte(areas, ccs, ano, de, ate, origem, carga),
      detalheDoRecorte(areas, ccs, ano, de, ate, origem, carga),
    ]);

    return NextResponse.json({
      ok: true,
      de,
      ate,
      cadastro: cadastro[0] ?? null,
      capacidade: capacidade[0] ?? null,
      grupos,
    });
  } catch (e) {
    console.error('[extracao-config POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
