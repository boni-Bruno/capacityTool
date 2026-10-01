import { NextResponse } from 'next/server';
import { marcarPasso } from '../../../../lib/versao-db';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeRota, sessaoAtual } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// "Confirmei esta etapa" no fluxo guiado (migração 45).
//
// Marcar é ATO EXPLÍCITO, e não efeito de ter aberto a tela: passar por uma
// etapa não é tê-la revisado, e é exatamente isso que o fluxo existe para
// garantir. Por isso é uma rota própria, e não um lado de outra gravação.
//
// `feito: false` desmarca — quem percebeu que confirmou sem olhar precisa poder
// voltar atrás, senão a próxima pessoa confia num visto que ninguém deu.
export async function POST(req) {
  try {
    await exigeRota(req);
    const { versao_id, area_id, passo, feito } = await req.json();

    const s = await sessaoAtual();
    const r = await marcarPasso(versao_id, area_id, passo,
                                s?.tipo === 'usuario' ? s.id : null,
                                feito !== false);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[passo POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
