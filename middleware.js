import { NextResponse } from 'next/server';

// Porteiro: roda antes de qualquer página. Sem o cookie certo, manda para /entrar.
// A senha fica só no servidor (variável APP_SENHA); o cookie guarda um código
// derivado dela, nunca a senha em si.

export async function token(senha) {
  const dados = new TextEncoder().encode(senha + '::capacidade');
  const hash = await crypto.subtle.digest('SHA-256', dados);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(req) {
  const senha = process.env.APP_SENHA;

  // Sem senha configurada, o app fica aberto — mas avisa na tela.
  if (!senha) return NextResponse.next();

  const cookie = req.cookies.get('cap_sessao')?.value;
  if (cookie && cookie === (await token(senha))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/entrar';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!entrar|api/entrar|_next/static|_next/image|favicon.ico).*)',
  ],
};
