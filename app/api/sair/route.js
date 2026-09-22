import { NextResponse } from 'next/server';
import { COOKIE_SESSAO } from '../../../lib/sessao-token';

// Sair: apaga o cookie. Não há nada para invalidar no servidor — o token é
// assinado e vive no navegador —, então "sair" é o navegador esquecer.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESSAO, '', {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
  });
  return res;
}
