import { NextResponse } from 'next/server';
import { extracaoAp } from '../../../lib/db';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';

// A extração para o AP. Só lê — o arquivo nasce no navegador, desta resposta.
//
// Os filtros de recurso chegam como lista de ids, resolvida na tela: a regra
// de planta/área/CC/CT/patrimônio mora num lugar só, e o servidor não precisa
// reimplementá-la.
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    const medida = ['DISPONIVEL', 'PLANEJADA', 'INSTALADA'].includes(b.medida)
      ? b.medida : 'DISPONIVEL';
    const de = String(b.de ?? '').slice(0, 10);
    const ate = String(b.ate ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
      throw new Error('Informe o período da extração.');
    }
    if (de > ate) throw new Error('O início do período vem antes do fim.');

    const linhas = await extracaoAp({
      medida, de, ate, recursos: b.recursos ?? null,
    });
    return NextResponse.json({ ok: true, linhas });
  } catch (e) {
    console.error('[extracao POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
