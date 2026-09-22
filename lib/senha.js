// =============================================================================
// SENHA — regra, hash e conferência
//
// PBKDF2-SHA256 com salt próprio, pelo Web Crypto: existe no Node 18+ e no
// navegador, e é o que este projeto usa em tudo que é criptografia (lib/jwt.js)
// — sem instalar nada, que é a regra da casa. 100 mil iterações é o piso
// razoável de hoje para um login de fábrica: a conferência custa alguns
// milissegundos, e um vazamento do banco não entrega as senhas prontas.
//
// A regra da senha é a que o Bruno pediu em 21/09/2026: mínimo 8, uma
// maiúscula, uma minúscula e um caractere especial. `validaSenha` devolve a
// LISTA do que falta, e não um booleano: a tela diz "falta uma maiúscula" em
// vez de "senha inválida", que é a mensagem que faz a pessoa tentar quatro
// vezes.
//
// Motor puro: sem banco, sem tela.
// =============================================================================

import { iguaisEmTempoConstante, paraBase64Url, deBase64Url } from './jwt.js';

const ENC = new TextEncoder();
export const ITERACOES = 100000;

export const REGRAS = [
  { codigo: 'tamanho',   texto: 'mínimo 8 caracteres',      testa: (s) => s.length >= 8 },
  { codigo: 'maiuscula', texto: 'uma letra maiúscula',      testa: (s) => /[A-ZÀ-Ý]/.test(s) },
  { codigo: 'minuscula', texto: 'uma letra minúscula',      testa: (s) => /[a-zà-ÿ]/.test(s) },
  { codigo: 'especial',  texto: 'um caractere especial',    testa: (s) => /[^A-Za-zÀ-ÿ0-9\s]/.test(s) },
];

/** O que falta para a senha valer. Lista vazia é senha válida. */
export function validaSenha(senha) {
  const s = String(senha ?? '');
  return REGRAS.filter((r) => !r.testa(s)).map((r) => r.texto);
}

export function geraSalt() {
  return paraBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashSenha(senha, salt) {
  const chave = await crypto.subtle.importKey(
    'raw', ENC.encode(String(senha)), { name: 'PBKDF2' }, false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: deBase64Url(salt), iterations: ITERACOES },
    chave, 256,
  );
  return paraBase64Url(new Uint8Array(bits));
}

/** Compara em tempo constante: o lugar da diferença não pode vazar. */
export async function confereSenha(senha, salt, hash) {
  if (!salt || !hash) return false;
  return iguaisEmTempoConstante(await hashSenha(senha, salt), hash);
}
