import { NextResponse } from 'next/server';
import { COOKIE_SESSAO, leSessao, segredoDaSessao } from './lib/sessao-token';

// Porteiro: roda antes de qualquer página. Sem sessão válida, manda para /entrar.
//
// Só confere a ASSINATURA e a validade do token — no edge não há banco, e
// permissão e escopo são conferidos dentro de cada rota (lib/sessao.js). Não
// é a única tranca: as rotas que gravam chamam exigeSessao()/exigePermissao()
// por conta própria, porque esta versão do Next tem bypass de middleware
// conhecido (GHSA-f82v-jwr5-mffw).
//
// Quem veio do Hub sem cadastro aqui tem sessão do tipo 'nenhum': ela passa
// pelo porteiro só para chegar a /sem-acesso, que diz o que fazer — e a
// qualquer outra página, onde a Nav mostra o mesmo aviso e nada mais.

export async function middleware(req) {
  const senha = process.env.APP_SENHA;

  // Sem senha configurada, o app fica aberto — mas avisa na tela.
  if (!senha) return NextResponse.next();

  const bruto = req.cookies.get(COOKIE_SESSAO)?.value;
  const quem = await leSessao(bruto, await segredoDaSessao(senha));
  if (quem) return NextResponse.next();

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
