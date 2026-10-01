import { NextResponse } from 'next/server';
import { abrirVersao, fecharVersao } from '../../../../lib/versao-db';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeRota, sessaoAtual } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';
import { ORIGENS } from '../../../../lib/origens';

// Abrir e fechar versão do cenário (migração 45).
//
// POST abre a próxima versão de um (cenário, ano); PATCH fecha a aberta e tira
// a fotografia mensal. Não há DELETE: versão apagada levaria junto a foto, que
// é o registro de um número que alguém já aprovou numa reunião.

export async function POST(req) {
  try {
    await exigeRota(req);
    const { origem, ano, rotulo, passos } = await req.json();

    if (!ORIGENS.includes(origem)) throw new Error('Cenário inválido.');
    const a = Number(ano);
    if (!Number.isInteger(a) || a < 2000 || a > 2100) {
      throw new Error('Ano inválido.');
    }

    const s = await sessaoAtual();
    const r = await abrirVersao(origem, a, {
      rotulo, passos, usuarioId: s?.tipo === 'usuario' ? s.id : null,
    });
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[versao POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}

export async function PATCH(req) {
  try {
    await exigeRota(req);
    const { id, observacao } = await req.json();
    if (!Number.isInteger(Number(id))) throw new Error('Versão inválida.');

    const s = await sessaoAtual();
    const r = await fecharVersao(id, {
      observacao, usuarioId: s?.tipo === 'usuario' ? s.id : null,
    });
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[versao PATCH]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
