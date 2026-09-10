// Regras de destino e de escape da rota de SSO. Puro e testado, porque as duas
// coisas que este arquivo faz sao exatamente as duas que dao buraco quando
// erradas: redirecionamento aberto e injecao no HTML.

/**
 * Caminho interno, e so.
 *
 * A barra dupla e a pegadinha: sem esta funcao, um destino "//evil.com" viraria
 * URL absoluta com o mesmo esquema, e a rota de entrada do portal passaria a
 * mandar gente para fora — comecando por um link legitimo.
 */
export function caminhoInterno(dest) {
  const d = typeof dest === 'string' ? dest : '';
  if (!d.startsWith('/')) return '/';
  if (d.startsWith('//') || d.startsWith('/\\')) return '/';
  if (d.length > 512) return '/';
  if (temControle(d)) return '/';
  return d;
}

/**
 * Caractere de controle, conferido por codigo e nao por expressao regular.
 *
 * Uma classe com escape Unicode e facil de estragar sem ninguem perceber: basta
 * o editor gravar o caractere literal no lugar do escape. Um controle solto no
 * destino e o que abre injecao de cabecalho e de tag.
 */
export function temControle(texto) {
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

export function escapaHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
