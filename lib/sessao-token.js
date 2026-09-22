// =============================================================================
// O TOKEN DA SESSÃO
//
// O cookie cap_sessao deixa de ser o hash da senha única (o mesmo valor para
// todo mundo) e passa a ser um JWT HS256 com QUEM é a pessoa — e só isso.
// Permissões e escopo ficam no banco e são lidos a cada requisição: trocar o
// cargo de alguém vale na próxima tela, sem esperar a sessão morrer.
//
// O segredo é DERIVADO de APP_SENHA (derivaSegredo, o mesmo HMAC do SSO), e
// não uma variável de ambiente nova: APP_SENHA já é o segredo que esta
// instalação guarda, e uma variável a mais é uma a mais para esquecer no
// Vercel. Trocar APP_SENHA derruba todas as sessões — que é o que se espera
// de trocar a senha mestre.
//
// VIDA DE 12 HORAS, e o cookie é de sessão do navegador (sem maxAge, decisão
// do Bruno): fechou o navegador, entra de novo. O exp é o teto para a aba
// esquecida aberta — e para o navegador que "continua de onde parou" e
// restaura cookies de sessão.
//
// `sub` diz a natureza: 'mestre' (APP_SENHA), 'u:<id>' (usuário) ou 'nenhum'
// (veio do Hub sem cadastro aqui — tem sessão para a página /sem-acesso dizer
// isso, e nada mais). `verifica` exige sub e jti; os dois vão sempre.
//
// Motor puro: só lib/jwt.js. Roda no edge (middleware) e no node.
// =============================================================================

import { assina, derivaSegredo, novoJti, verifica } from './jwt.js';

export const COOKIE_SESSAO = 'cap_sessao';
export const VIDA_SESSAO_S = 12 * 60 * 60;
const ISS = 'capacidade';
const AUD = 'capacidade-sessao';

export async function segredoDaSessao(appSenha) {
  if (!appSenha) return null;
  return derivaSegredo(appSenha, 'sessao');
}

/**
 * `quem`: { tipo: 'mestre' | 'usuario' | 'nenhum', id?, nome?, email? }.
 */
export async function emiteSessao(quem, segredo, agora = Math.floor(Date.now() / 1000)) {
  const sub = quem.tipo === 'usuario' ? `u:${quem.id}` : quem.tipo;
  return assina({
    iss: ISS, aud: AUD, sub, jti: novoJti(),
    nome: quem.nome ?? null, email: quem.email ?? null,
    iat: agora, exp: agora + VIDA_SESSAO_S,
  }, segredo);
}

/**
 * Devolve { tipo, id, nome, email } ou null. Token ruim é null, sem exceção:
 * quem chama decide se manda para /entrar ou segue anônimo.
 */
export async function leSessao(compacto, segredo, agora) {
  if (!compacto || !segredo) return null;
  const r = await verifica(compacto, segredo, { aud: AUD, iss: ISS, agora });
  if (!r.ok) return null;
  const { sub, nome, email } = r.claims;
  if (sub === 'mestre') return { tipo: 'mestre', id: null, nome: 'mestre', email: null };
  if (sub === 'nenhum') return { tipo: 'nenhum', id: null, nome: nome ?? null, email: email ?? null };
  const m = /^u:(\d+)$/.exec(sub);
  if (!m) return null;
  return { tipo: 'usuario', id: Number(m[1]), nome: nome ?? null, email: email ?? null };
}
