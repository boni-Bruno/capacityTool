// Derivação do cookie de sessão, isolada aqui porque roda nos dois lados:
// no middleware (edge runtime) e nas rotas de cadastro (node). Por isso não
// importa nada do 'next' — só crypto.subtle, que existe nos dois.
//
// A senha fica só no servidor (APP_SENHA); o cookie guarda este hash,
// nunca a senha em si.
export async function token(senha) {
  const dados = new TextEncoder().encode(senha + '::capacidade');
  const hash = await crypto.subtle.digest('SHA-256', dados);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
