import { NextResponse } from 'next/server';
import { excluirAtributo, excluirRegra, salvarDePara } from '../../../lib/demanda';
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

    // Uma chamada só: a regra e, se ainda não existir, o atributo em que ela
    // escreve. Duas idas seriam duas chances de gravar metade.
    const { id, atributo } = await salvarDePara(b);
    revalidarCadastros();
    return NextResponse.json({ ok: true, id, atributo });
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
