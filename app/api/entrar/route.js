import { NextResponse } from 'next/server';
import { token } from '../../../middleware';

export async function POST(req) {
  const { senha } = await req.json();
  const correta = process.env.APP_SENHA;

  if (!correta || senha !== correta) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('cap_sessao', await token(correta), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
