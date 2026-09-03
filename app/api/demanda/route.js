import { NextResponse } from 'next/server';
import {
  anotarCarga, concluirCarga, criarCarga, definirCorrente, excluirCarga, gravarLote,
} from '../../../lib/demanda';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';
import { revalidarCadastros } from '../../../lib/revalidar';

// A carga entra em três atos, e não numa requisição só.
//
// O navegador lê o parquet, mostra a conferência, e só então começa a mandar. O
// arquivo nunca sobe: sobem as linhas já lidas, em lotes. Assim o relatório
// aparece antes de gravar, e nenhuma requisição carrega 116 mil linhas.
//
//   abrir     cria a carga vazia e devolve o id
//   lote      grava um pedaço
//   concluir  fecha contando no banco quantas linhas realmente entraram
const falha = (e, onde) => {
  console.error(`[demanda ${onde}]`, e);
  return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                           { status: e.status ?? 400 });
};

export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    if (b.acao === 'abrir') {
      const id = await criarCarga(b);
      return NextResponse.json({ ok: true, carga_id: id });
    }

    if (b.acao === 'lote') {
      const n = await gravarLote(b.carga_id, b.linhas);
      return NextResponse.json({ ok: true, gravadas: n });
    }

    if (b.acao === 'concluir') {
      const linhas = await concluirCarga(b.carga_id);
      if (b.corrente) await definirCorrente(b.carga_id);
      revalidarCadastros();
      return NextResponse.json({ ok: true, linhas });
    }

    throw new Error(`Ação desconhecida: ${b.acao}`);
  } catch (e) { return falha(e, 'POST'); }
}

// Troca qual carga está no ar, ou anota o cenário. Separado do POST porque não
// é importação: é decisão de qual versão do plano todo mundo está vendo.
//
// A anotação entra aqui e não numa rota própria porque é a mesma linha e o
// mesmo dono; e ela NÃO revalida cadastro nenhum: é texto ao lado do número, e
// invalidar o cache do painel por causa de uma frase seria pagar caro por nada.
export async function PUT(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    if (b.acao === 'observacao') {
      const r = await anotarCarga(b.id, b.observacao);
      return NextResponse.json({ ok: true, ...r });
    }

    await definirCorrente(b.id);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) { return falha(e, 'PUT'); }
}

export async function DELETE(req) {
  try {
    await exigeSessao();
    const { id } = await req.json();
    await excluirCarga(id);
    revalidarCadastros();
    return NextResponse.json({ ok: true });
  } catch (e) { return falha(e, 'DELETE'); }
}
