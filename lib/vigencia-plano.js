// Decisão pura da camada de vigência — sem banco, sem import nenhum.
//
// Está separada de vigencia.js de propósito: é a parte que, se estiver errada,
// reescreve histórico em silêncio. Isolada assim, roda direto no node --test
// (lib/vigencia.test.js) sem precisar de DATABASE_URL.
//
// As datas chegam do Postgres como texto 'YYYY-MM-DD' (o ::text nas consultas
// de vigencia.js), então comparar com < e > já é comparar cronologicamente:
// sem objeto Date, sem fuso horário no meio.

// A linha que está valendo em `data` — daterange é [), o fim é exclusivo.
export function vigenteEm(linhas, data) {
  return linhas.find((l) => l.inicio <= data && (l.fim === null || l.fim > data));
}

/**
 * Decide o que fazer com as linhas existentes para abrir uma vigência em `data`.
 *
 * Devolve { acao, alvo }:
 *   'inserir'    — nada valendo, só abre a linha nova
 *   'fechar'     — fecha a atual em `data` e abre a nova
 *   'substituir' — a atual começa na mesma data; troca a linha em vez de
 *                  fechar, porque fechar geraria um daterange vazio
 * Ou { erro } quando há linha futura no caminho.
 */
export function planejar(linhas, data, rotulo = 'registro') {
  const futura = linhas.find((l) => l.inicio > data);
  if (futura) {
    return {
      erro:
        `Já existe ${rotulo} programado a partir de ${futura.inicio}, ` +
        `depois de ${data}. Encerre ou remova esse registro antes.`,
    };
  }

  const atual = vigenteEm(linhas, data);
  if (!atual) return { acao: 'inserir', alvo: null };
  return { acao: atual.inicio === data ? 'substituir' : 'fechar', alvo: atual };
}
