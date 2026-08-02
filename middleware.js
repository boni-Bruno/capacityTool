import { NextResponse } from 'next/server';
import { token } from './lib/token';

// Porteiro: roda antes de qualquer página. Sem o cookie certo, manda para /entrar.
//
// Não é a única tranca: as rotas que gravam chamam exigeSessao() por conta
// própria (lib/sessao.js), porque esta versão do Next tem bypass de middleware
// conhecido (GHSA-f82v-jwr5-mffw).

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
