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
 * Decide o que fazer com as linhas existentes para abrir uma vigência que vale
 * de `data` até `ate`. `ate` null = aberta para a frente (o caso comum).
 *
 * Devolve { acao, alvo }:
 *   'inserir'    — nada valendo, só abre a linha nova
 *   'fechar'     — fecha a atual em `data` e abre a nova
 *   'substituir' — a atual começa na mesma data; troca a linha em vez de
 *                  fechar, porque fechar geraria um daterange vazio
 * Ou { erro } quando há linha no caminho.
 */
export function planejar(linhas, data, rotulo = 'registro', ate = null) {
  // Linha que começa depois de `data` e antes do fim do intervalo novo.
  // Com `ate` null o intervalo novo vai até o infinito, então qualquer linha
  // posterior atrapalha; com `ate` preenchido, só as que caem dentro dele.
  const futura = linhas.find((l) => l.inicio > data && (ate === null || l.inicio < ate));
  if (futura) {
    return {
      erro:
        `Já existe ${rotulo} programado a partir de ${futura.inicio}, ` +
        `depois de ${data}. Encerre ou remova esse registro antes.`,
    };
  }

  const atual = vigenteEm(linhas, data);
  if (!atual) return { acao: 'inserir', alvo: null };

  // Mesma data de início: a linha antiga nunca cobriu período diferente,
  // então trocar inteira não reescreve passado nenhum.
  if (atual.inicio === data) return { acao: 'substituir', alvo: atual };

  // Fechar a atual em `data` e abrir uma limitada em `ate` deixaria o trecho
  // depois de `ate` descoberto — a linha antiga ia mais longe que isso.
  // Recortar e recolar o rabo seria dividir a faixa em três; em vez de fazer
  // isso escondido, recusa e manda usar os dois passos que já funcionam.
  if (ate !== null && (atual.fim === null || atual.fim > ate)) {
    return {
      erro:
        `Já existe ${rotulo} valendo de ${atual.inicio} até ` +
        `${atual.fim ?? 'sem data de fim'}, que passa de ${ate}. ` +
        `Encerre esse registro em ${data} primeiro e depois cadastre o novo período.`,
    };
  }

  return { acao: 'fechar', alvo: atual };
}
