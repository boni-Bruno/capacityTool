import { NextResponse } from 'next/server';
import { aplicarOeeEmLote, definirOeeDoAno } from '../../../../lib/oee';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeSessao } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';

// Salva o OEE de um ano e uma origem.
//
// Corpo: { recurso_id, ano, origem, meses: { 1: '85', ... } } para um recurso,
// que REESCREVE o ano — mês em branco fica sem OEE.
//
// Com { acao: 'lote', recursos: [ids] } o mesmo valor vai para vários, e aí
// mês em branco é silêncio: ele não apaga o que o recurso já tinha. As duas
// leituras do branco convivem porque a intenção é outra em cada caso — quem
// edita um recurso está dizendo como o ano dele é; quem aplica em lote está
// mexendo num mês.
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    const ano = Number(b.ano);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      throw new Error('Ano inválido.');
    }

    const r = b.acao === 'lote'
      ? await aplicarOeeEmLote(b.recursos, ano, b.origem, b.meses ?? {})
      : await definirOeeDoAno(b.recurso_id, ano, b.origem, b.meses ?? {});

    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[oee POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
