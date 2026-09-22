import { NextResponse } from 'next/server';
import { exigeSessao } from '../../../lib/sessao';
import { trocarPropriaSenha, usuarioPorId } from '../../../lib/acesso';
import { confereSenha } from '../../../lib/senha';
import { mensagemDeErro } from '../../../lib/erros';

// A própria pessoa troca a senha: { atual, nova }.
//
// A atual é exigida sempre — no primeiro acesso ela é a senha inicial que o
// gestor deu. Sem isso, uma aba esquecida aberta trocaria a senha de quem saiu
// para almoçar. Mestre não tem senha própria para trocar: a dele é APP_SENHA.
export async function POST(req) {
  try {
    const s = await exigeSessao();
    if (s.tipo !== 'usuario') {
      throw Object.assign(new Error('A senha mestre se troca no ambiente, não aqui.'),
                          { status: 400 });
    }
    const b = await req.json();
    const u = await usuarioPorId(s.id);
    if (!u || !(await confereSenha(String(b.atual ?? ''), u.senha_salt, u.senha_hash))) {
      throw Object.assign(new Error('A senha atual não confere.'), { status: 400 });
    }
    await trocarPropriaSenha(s.id, String(b.nova ?? ''));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
