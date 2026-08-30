import { NextResponse } from 'next/server';
import {
  anexarModeloSlide, apagarModeloSlide, concluirModeloSlide,
  iniciarModeloSlide, modeloSlideBase64,
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
// EM PEDAÇOS, como a base de demanda. O arquivo sobe em base64 — um terço maior
// — dentro de um JSON, e o corpo de uma requisição serverless tem teto; um
// modelo com logotipo e imagem de fundo passa dele com facilidade. Ver
// `iniciarModeloSlide` em lib/db.js.
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    if (b.acao === 'abrir') {
      if (!b.slide_marca) {
        throw new Error('Nenhum slide do modelo tem {{CAPACITY_TOOL}}. '
          + 'Ponha essa marca numa caixa de texto do slide que vai receber o '
          + 'conteúdo e importe de novo.');
      }
      await iniciarModeloSlide({
        arquivo: b.arquivo, slideMarca: b.slide_marca, slides: b.slides,
      });
      return NextResponse.json({ ok: true });
    }

    if (b.acao === 'parte') {
      await anexarModeloSlide(String(b.base64 ?? ''));
      return NextResponse.json({ ok: true });
    }

    if (b.acao === 'fechar') {
      const m = await concluirModeloSlide();
      revalidarCadastros();
      return NextResponse.json({ ok: true, ...m });
    }

    throw new Error('Ação desconhecida.');
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
