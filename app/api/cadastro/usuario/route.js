import { NextResponse } from 'next/server';
import {
  alterarUsuario, criarUsuario, definirAtivoUsuario, gestoresAtivos,
  redefinirSenha, usuarioPorId,
} from '../../../../lib/acesso';
import { exigePermissao } from '../../../../lib/sessao';
import { mensagemDeErro } from '../../../../lib/erros';
import { revalidarCadastros } from '../../../../lib/revalidar';

const falha = (e, onde) => {
  console.error(`[usuario ${onde}]`, e);
  return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                           { status: e.status ?? 400 });
};

const recusa = (msg) => Object.assign(new Error(msg), { status: 400 });

// O ÚLTIMO GESTOR NÃO SAI. Desativar o único usuário do cargo protegido, ou
// tirá-lo do cargo, deixaria a ferramenta sem ninguém que possa tudo — e a
// mestre é rede, não é o jeito normal de trabalhar.
async function protegeUltimoGestor(alvoId, { novoCargoId = null, desativando = false }) {
  const alvo = await usuarioPorId(alvoId);
  if (!alvo || !alvo.cargo_protegido || !alvo.ativo) return;
  const saindo = desativando || (novoCargoId !== null && Number(novoCargoId) !== alvo.cargo_id);
  if (saindo && (await gestoresAtivos()) <= 1) {
    throw recusa('Este é o último Gestor de Planejamento ativo. Dê o cargo a outra pessoa antes.');
  }
}

export async function POST(req) {
  try {
    const s = await exigePermissao('usuarios.editar');
    const b = await req.json();
    const r = await criarUsuario({
      login: b.login, nome: b.nome, email: b.email, senha: b.senha,
      cargo_id: b.cargo_id, escopo: b.escopo,
    }, s.tipo === 'usuario' ? s.id : null);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'POST'); }
}

export async function PATCH(req) {
  try {
    const s = await exigePermissao('usuarios.editar');
    const b = await req.json();
    await protegeUltimoGestor(b.id, { novoCargoId: b.cargo_id ?? null });
    // Ninguém tira o próprio cargo de gestor por engano: quem edita a si
    // mesmo mantém o cargo. O escopo e o nome ainda podem mudar.
    const cargoId = s.tipo === 'usuario' && Number(b.id) === s.id ? undefined : b.cargo_id;
    const r = await alterarUsuario(b.id, {
      nome: b.nome, email: b.email, cargo_id: cargoId, escopo: b.escopo,
    });
    if (b.senha) await redefinirSenha(b.id, b.senha);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'PATCH'); }
}

export async function PUT(req) {
  try {
    const s = await exigePermissao('usuarios.editar');
    const b = await req.json();
    if (s.tipo === 'usuario' && Number(b.id) === s.id && !b.ativo) {
      throw recusa('Você não pode desativar a si mesmo.');
    }
    if (!b.ativo) await protegeUltimoGestor(b.id, { desativando: true });
    const r = await definirAtivoUsuario(b.id, b.ativo);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return falha(e, 'PUT'); }
}
