import { NextResponse } from 'next/server';
import { COOKIE_SESSAO, emiteSessao, segredoDaSessao } from '../../../lib/sessao-token';
import { registraAcesso, usuarioPorLogin } from '../../../lib/acesso';
import { confereSenha } from '../../../lib/senha';
import { iguaisEmTempoConstante } from '../../../lib/jwt';
import { entradaLocalLigada } from '../../../lib/hub';

// A ESCOTILHA.
//
// Esta porta fica FECHADA. Desde 22/09/2026 a entrada é pelo Hub S&OP, e a
// senha de cada pessoa existe num lugar só — é o que torna desnecessário
// sincronizar senha entre dois bancos.
//
// ENTRADA_LOCAL=1 reabre, e serve para uma coisa: o dia em que o Hub estiver
// fora do ar e alguém precisar entrar aqui assim mesmo. Ligar exige mexer na
// Vercel e redeployar — a fricção certa para uma segunda porta de emergência.
//
// Aberta, ela aceita os dois caminhos de antes. Sem login e com a senha igual a
// APP_SENHA, entra a sessão MESTRE: tudo, em toda parte, identificada como
// "mestre". Com login, é o usuário do banco — e a senha dele continua no
// cadastro, sem uso no dia a dia, justamente para esta escotilha funcionar.
//
// A recusa é a mesma frase nos dois caminhos e em qualquer motivo: dizer se
// foi o login ou a senha é entregar metade da resposta a quem está tentando.
//
// O COOKIE É DE SESSÃO DO NAVEGADOR — sem maxAge, decisão do Bruno: fechou o
// navegador, entra de novo. O exp do token (12 h) é o teto.

export const runtime = 'nodejs';

const ATRIBUTOS = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };

export async function POST(req) {
  const correta = process.env.APP_SENHA;
  if (!correta) return NextResponse.json({ ok: false }, { status: 401 });

  // A mesma recusa de senha errada, e não um 404 ou uma mensagem própria: a
  // porta fechada não precisa anunciar que existe.
  if (!entradaLocalLigada()) {
    return NextResponse.json({ ok: false, erro: 'Usuário ou senha incorretos.' },
                             { status: 401 });
  }

  let corpo;
  try { corpo = await req.json(); } catch { corpo = {}; }
  const login = String(corpo?.login ?? '').trim().toLowerCase();
  const senha = String(corpo?.senha ?? '');
  const segredo = await segredoDaSessao(correta);

  let quem = null;
  let trocarSenha = false;

  if (!login) {
    if (iguaisEmTempoConstante(senha, correta)) quem = { tipo: 'mestre' };
  } else {
    const u = await usuarioPorLogin(login);
    if (u && u.ativo && await confereSenha(senha, u.senha_salt, u.senha_hash)) {
      quem = { tipo: 'usuario', id: u.id, nome: u.nome, email: u.email };
      trocarSenha = Boolean(u.trocar_senha);
      await registraAcesso(u.id);
    }
  }

  if (!quem) {
    return NextResponse.json({ ok: false, erro: 'Usuário ou senha incorretos.' },
                             { status: 401 });
  }

  const res = NextResponse.json({ ok: true, trocarSenha });
  res.cookies.set(COOKIE_SESSAO, await emiteSessao(quem, segredo), ATRIBUTOS);
  return res;
}
