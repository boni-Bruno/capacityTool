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

// =============================================================================
// MATRIZ MÊS x TURNO
//
// A tela de turnos do recurso é uma matriz de flags: 12 meses por turno, marca
// e desmarca. Mas o banco guarda daterange com exclude constraint — o que é
// certo, porque é isso que faz duas configurações não valerem ao mesmo tempo.
//
// As funções abaixo traduzem entre os dois: meses marcados viram faixas
// contíguas, e o que existe fora do ano editado é preservado intacto.
// Tudo em texto 'YYYY-MM-DD', sem objeto Date e sem fuso.
// =============================================================================

// Aceita mes 13 e devolve janeiro do ano seguinte — serve para o fim exclusivo
// de dezembro sem precisar de caso especial.
export function inicioDoMes(ano, mes) {
  const a = mes > 12 ? ano + 1 : ano;
  const m = mes > 12 ? mes - 12 : mes;
  return `${a}-${String(m).padStart(2, '0')}-01`;
}

// [1,2,3,7,8] em 2026 -> jan–abr e jul–set (fim exclusivo).
// Meses vizinhos viram uma faixa só: 12 cliques não podem gerar 12 linhas.
export function mesesParaFaixas(meses, ano) {
  const ord = [...new Set((meses ?? []).map(Number))]
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
    .sort((a, b) => a - b);

  const faixas = [];
  let i = 0;
  while (i < ord.length) {
    let j = i;
    while (j + 1 < ord.length && ord[j + 1] === ord[j] + 1) j++;
    faixas.push({ inicio: inicioDoMes(ano, ord[i]), fim: inicioDoMes(ano, ord[j] + 1) });
    i = j + 1;
  }
  return faixas;
}

// Cola faixas que se encostam. Sem isso, editar 2026 quebraria em três uma
// faixa que ia de 2025 a 2027 direto.
export function juntarFaixas(faixas) {
  const ord = [...faixas].sort((a, b) =>
    a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0);

  const saida = [];
  for (const f of ord) {
    const ultima = saida[saida.length - 1];
    // Faixa com fim null já vai até o infinito; nada se cola depois dela.
    if (ultima && ultima.fim !== null && ultima.fim === f.inicio) ultima.fim = f.fim;
    else saida.push({ ...f });
  }
  return saida;
}

/**
 * Estado completo das faixas depois de aplicar a matriz de um ano.
 *
 * O ano editado é substituído inteiro pelo que está marcado na tela; o que
 * existe antes e depois dele é recortado na fronteira e preservado. Assim
 * mexer em 2026 nunca apaga o que foi configurado para 2025.
 */
export function recomporFaixas(existentes, ano, mesesMarcados) {
  const anoIni = `${ano}-01-01`;
  const anoFim = `${ano + 1}-01-01`;
  const fora = [];

  for (const e of existentes) {
    // Pedaço anterior ao ano editado.
    if (e.inicio < anoIni) {
      const fim = e.fim === null || e.fim > anoIni ? anoIni : e.fim;
      if (e.inicio < fim) fora.push({ inicio: e.inicio, fim });
    }
    // Pedaço posterior ao ano editado.
    if (e.fim === null || e.fim > anoFim) {
      const inicio = e.inicio > anoFim ? e.inicio : anoFim;
      if (e.fim === null || inicio < e.fim) fora.push({ inicio, fim: e.fim });
    }
  }

  return juntarFaixas([...fora, ...mesesParaFaixas(mesesMarcados, ano)]);
}

// Compara dois conjuntos de faixas já ordenados. Serve para não reescrever no
// banco turno que ninguém mexeu — salvar a matriz inteira não pode significar
// apagar e recriar 12 linhas que continuam idênticas.
export function faixasIguais(a, b) {
  if (a.length !== b.length) return false;
  return a.every((x, i) =>
    x.inicio === b[i].inicio && (x.fim ?? null) === (b[i].fim ?? null));
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
