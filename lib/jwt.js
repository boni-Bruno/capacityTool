// Token assinado do SSO: JWS compacto com HS256, feito so com Web Crypto.
//
// ESTE ARQUIVO E COPIADO BYTE A BYTE PARA CADA FERRAMENTA. Nao adicione import
// nenhum aqui — nem 'next', nem './db', nem um utilitario de base64 do projeto.
// Uma dependencia aqui vira uma dependencia em CADA ferramenta que entrar no
// Hub, e o arquivo precisa continuar rodando no edge, no node e no node --test
// sem instalar nada. O contrato completo esta em SSO.md.

const ENC = new TextEncoder();
const DEC = new TextDecoder();

// Folga de relogio, so no iat. Duas funcoes serverless podem discordar de alguns
// segundos, e relogio adiantado no emissor e o unico desvio que produz falha de
// login intermitente — o defeito mais caro de diagnosticar numa porta de entrada.
// Nao ha folga no exp: isso so transformaria 90 s em 150 s.
export const FOLGA_S = 60;

// Vida do token. Ele nasce e morre dentro de uma unica navegacao; 90 s cobre
// cold start das duas funcoes mais uma rede ruim de fabrica.
export const VIDA_S = 90;

// Teto de tamanho antes de qualquer parse: entrada do atacante nao decide quanto
// trabalho a funcao faz.
const MAXIMO_BYTES = 4096;

export function paraBase64Url(bytes) {
  let bin = '';
  // Laco em vez de String.fromCharCode(...bytes): o spread estoura a pilha em
  // entrada grande, e num modulo de autenticacao nao vale carregar armadilha.
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deBase64Url(texto) {
  const b64 = String(texto).replace(/-/g, '+').replace(/_/g, '/');
  // atob recusa entrada invalida com excecao, e quem chama trata. Aqui nao se
  // engole erro: token corrompido virando token vazio seria token vazio valido.
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// JSON -> bytes -> base64url, e NUNCA btoa(JSON.stringify(...)).
// btoa recusa qualquer caractere acima de 255: um "Jose" com acento no claim
// nome ja derrubaria a emissao. O TextEncoder resolve porque emite UTF-8.
const paraSegmento = (obj) => paraBase64Url(ENC.encode(JSON.stringify(obj)));
const deSegmento = (seg) => JSON.parse(DEC.decode(deBase64Url(seg)));

const chaveHmac = (segredo, usos) => crypto.subtle.importKey(
  'raw', ENC.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, usos,
);

/** Identificador de uso unico do token. 16 bytes bastam contra colisao e adivinhacao. */
export function novoJti() {
  return paraBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * Segredo de uma ferramenta, derivado do mestre que so o Hub conhece.
 *
 * E isto que impede a Capacity Tool de forjar um token valido para o PMP mesmo
 * tendo o proprio segredo — o antidoto para o defeito central da assinatura
 * simetrica, ao custo de um HMAC.
 */
export async function derivaSegredo(mestre, chaveDaFerramenta) {
  const bruta = await crypto.subtle.sign(
    'HMAC', await chaveHmac(mestre, ['sign']),
    ENC.encode('sso:v1:' + chaveDaFerramenta),
  );
  return paraBase64Url(new Uint8Array(bruta));
}

export async function assina(claims, segredo, kid = 'v1') {
  if (!segredo) throw new Error('Segredo de SSO ausente.');
  const corpo = paraSegmento({ alg: 'HS256', typ: 'JWT', kid })
    + '.' + paraSegmento(claims);
  const bruta = await crypto.subtle.sign(
    'HMAC', await chaveHmac(segredo, ['sign']), ENC.encode(corpo),
  );
  return corpo + '.' + paraBase64Url(new Uint8Array(bruta));
}

/**
 * Devolve { ok: false, motivo } ou { ok: true, kid, claims }.
 *
 * Nao lanca para token ruim: excecao em caminho de auth acaba virando um
 * try/catch largo que engole tambem o caso legitimo. O motivo vai para o log do
 * servidor, nunca para a tela — dizer ao visitante se foi assinatura ou validade
 * e entregar de graca um oraculo de teste.
 */
export async function verifica(compacto, segredo, opcoes = {}) {
  const {
    aud, iss,
    agora = Math.floor(Date.now() / 1000),
    folga = FOLGA_S,
  } = opcoes;

  if (!segredo) return { ok: false, motivo: 'sem-segredo' };
  if (typeof compacto !== 'string' || compacto.length > MAXIMO_BYTES) {
    return { ok: false, motivo: 'formato' };
  }

  const p = compacto.split('.');
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return { ok: false, motivo: 'formato' };

  let cabecalho;
  let claims;
  let assinatura;
  try {
    cabecalho = deSegmento(p[0]);
    claims = deSegmento(p[1]);
    assinatura = deBase64Url(p[2]);
  } catch {
    return { ok: false, motivo: 'formato' };
  }

  // O alg vem de DENTRO do token, ou seja, do atacante. Ele e conferido, nunca
  // obedecido: e dai que nascem o "alg: none" e a confusao HS/RS.
  if (cabecalho?.alg !== 'HS256' || cabecalho?.typ !== 'JWT') return { ok: false, motivo: 'alg' };
  if (!claims || typeof claims !== 'object') return { ok: false, motivo: 'formato' };

  // ASSINATURA ANTES DE QUALQUER CLAIM. Conferir claim de token nao verificado e
  // decidir em cima de dado do atacante — e, no caso do jti, seria deixar
  // qualquer um encher a tabela do banco sem saber segredo nenhum.
  // crypto.subtle.verify compara em tempo constante.
  const confere = await crypto.subtle.verify(
    'HMAC', await chaveHmac(segredo, ['verify']), assinatura,
    ENC.encode(p[0] + '.' + p[1]),
  );
  if (!confere) return { ok: false, motivo: 'assinatura' };

  if (typeof claims.exp !== 'number' || agora >= claims.exp) return { ok: false, motivo: 'expirado' };
  if (typeof claims.iat !== 'number' || claims.iat > agora + folga) return { ok: false, motivo: 'futuro' };
  if (iss && claims.iss !== iss) return { ok: false, motivo: 'iss' };
  // Sem esta linha o "audience" e decoracao: um token da Capacity abriria o PMP.
  if (aud && claims.aud !== aud) return { ok: false, motivo: 'aud' };
  if (typeof claims.sub !== 'string' || !claims.sub) return { ok: false, motivo: 'sub' };
  if (typeof claims.jti !== 'string' || claims.jti.length < 16 || claims.jti.length > 64) {
    return { ok: false, motivo: 'jti' };
  }

  return { ok: true, kid: cabecalho.kid ?? 'v1', claims };
}

/**
 * Para quando nao da para usar crypto.subtle.verify — comparar dois valores ja
 * derivados. O tamanho vaza, e tudo bem: aqui os dois lados tem tamanho fixo
 * conhecido. O que nao pode vazar e ONDE eles diferem, que e o que o !== entrega
 * ao sair no primeiro caractere diferente.
 */
export function iguaisEmTempoConstante(a, b) {
  const x = String(a);
  const y = String(b);
  if (x.length !== y.length) return false;
  let dif = 0;
  for (let i = 0; i < x.length; i += 1) dif |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return dif === 0;
}
