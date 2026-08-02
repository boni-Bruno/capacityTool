import { cookies } from 'next/headers';
import { token } from './token';

// Segunda tranca, dentro da rota.
//
// O middleware.js já barra visitante sem cookie, mas a versão do Next usada
// aqui (14.2.15) tem o GHSA-f82v-jwr5-mffw: dá para pular o middleware inteiro
// mandando um header. Enquanto o app era só leitura isso era chato; com rotas
// que gravam e apagam, vira porta aberta.
//
// Então quem escreve confere a sessão por conta própria. Isso não substitui
// atualizar o Next — só faz o bypass do middleware não valer nada sozinho.
export async function exigeSessao() {
  const senha = process.env.APP_SENHA;

  // Sem APP_SENHA o app é aberto de propósito (mesma regra do middleware),
  // para não travar quem está rodando local.
  if (!senha) return;

  const cookie = cookies().get('cap_sessao')?.value;
  if (!cookie || cookie !== (await token(senha))) {
    const e = new Error('Sessão expirada. Entre de novo.');
    e.status = 401;
    throw e;
  }
}
