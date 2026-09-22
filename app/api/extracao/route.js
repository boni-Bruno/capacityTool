import { NextResponse } from 'next/server';
import { extracaoAp, recursosParaExtracao } from '../../../lib/db';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeRota } from '../../../lib/sessao';
import { alcancaArea } from '../../../lib/escopo';

// A extração para o AP. Só lê — o arquivo nasce no navegador, desta resposta.
//
// Os filtros de recurso chegam como lista de ids, resolvida na tela: a regra
// de planta/área/CC/CT/patrimônio mora num lugar só, e o servidor não precisa
// reimplementá-la.
export async function POST(req) {
  try {
    const s = await exigeRota(req);
    const b = await req.json();

    // O ESCOPO recorta os recursos: quem tem só a Tecelagem extrai só a
    // Tecelagem, peça o que pedir. Sem lista, a lista é a do escopo.
    let recursos = b.recursos ?? null;
    if (s.areas !== null) {
      const permitidos = new Set((await recursosParaExtracao())
        .filter((r) => alcancaArea(s.areas, r.area_id)).map((r) => Number(r.id)));
      recursos = (recursos ?? [...permitidos]).map(Number).filter((id) => permitidos.has(id));
    }

    const medida = ['DISPONIVEL', 'PLANEJADA', 'INSTALADA'].includes(b.medida)
      ? b.medida : 'DISPONIVEL';
    const origem = b.origem === 'SIMULADO' ? 'SIMULADO' : 'META';
    const de = String(b.de ?? '').slice(0, 10);
    const ate = String(b.ate ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
      throw new Error('Informe o período da extração.');
    }
    if (de > ate) throw new Error('O início do período vem antes do fim.');

    const linhas = await extracaoAp({ medida, origem, de, ate, recursos });
    return NextResponse.json({ ok: true, linhas });
  } catch (e) {
    console.error('[extracao POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
