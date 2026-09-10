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
    // 'sso' fica de fora porque a rota de entrada vinda do Hub S&OP e atingida
    // sem cookie nenhum — se o porteiro a barrasse, ela nunca teria chance de
    // conferir o token e emitir o cookie. Ela tem a propria tranca, mais dura que
    // esta: sem SSO_SEGREDO, recusa; ver app/sso/route.js.
    '/((?!entrar|api/entrar|sso|_next/static|_next/image|favicon.ico).*)',
  ],
};
