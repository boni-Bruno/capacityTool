import { NextResponse } from 'next/server';
import {
  excluirAtributo, excluirRegra, salvarAtributo, salvarRegra,
} from '../../../lib/demanda';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';
import { revalidarCadastros } from '../../../lib/revalidar';

// O DE/PARA: atributos derivados e as regras que os produzem.
//
// Não mexe no índice de conversão e por isso não chama `atualizarIndice`. Regra
// rotula e agrupa; ela não altera minuto nem metro de lugar nenhum. Refazer a
// matriz aqui seria pagar caro por nada.
const falha = (e, onde) => {
  console.error(`[de-para ${onde}]`, e);
  return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                           { status: e.status ?? 400 });
};

export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    if (b.acao === 'atributo') {
      const codigo = await salvarAtributo(b);
      revalidarCadastros();
      return NextResponse.json({ ok: true, codigo });
    }

    const id = await salvarRegra(b);
    revalidarCadastros();
    return NextResponse.json({ ok: true, id });
  } catch (e) { return falha(e, 'POST'); }
}

export async function DELETE(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    if (b.acao === 'atributo') await excluirAtributo(b.codigo);
    else await excluirRegra(b.id);

    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) { return falha(e, 'DELETE'); }
}
