import { NextResponse } from 'next/server';
import {
  apagarModeloSlide, modeloSlideBase64, salvarModeloSlide,
} from '../../../lib/db';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';
import { revalidarCadastros } from '../../../lib/revalidar';

// O modelo .pptx da extração.
//
// O ARQUIVO É ABERTO NO NAVEGADOR, não aqui: é lá que ele precisa ser aberto de
// novo na hora de exportar, e uma segunda implementação do mesmo desempacotar
// acabaria discordando da primeira. O servidor recebe os bytes já conferidos,
// com o slide da marca já identificado, e só guarda.
//
// 4 MB é o teto. O arquivo viaja em base64 — um terço maior — e um modelo de
// apresentação com logotipo e fundo não passa perto disso; acima, é imagem que
// não devia estar num modelo.
const LIMITE = 4 * 1024 * 1024;

export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    const base64 = String(b.base64 ?? '');
    if (!base64) throw new Error('Modelo vazio.');
    if ((base64.length * 3) / 4 > LIMITE) {
      throw new Error('O modelo passa de 4 MB. Isso costuma ser imagem grande '
        + 'dentro do arquivo — comprima as imagens e importe de novo.');
    }
    if (!b.slide_marca) {
      throw new Error('Nenhum slide do modelo tem {{CAPACITY_TOOL}}. '
        + 'Ponha essa marca numa caixa de texto do slide que vai receber o '
        + 'conteúdo e importe de novo.');
    }

    await salvarModeloSlide({
      arquivo: b.arquivo, base64,
      slideMarca: b.slide_marca, slides: b.slides,
    });
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[modelo-slide POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

// Os bytes só saem quando alguém vai exportar — a tela lista pelo resumo.
export async function GET() {
  try {
    await exigeSessao();
    const m = await modeloSlideBase64();
    if (!m) throw new Error('Nenhum modelo importado.');
    return NextResponse.json({ ok: true, ...m });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

export async function DELETE() {
  try {
    await exigeSessao();
    await apagarModeloSlide();
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
