// =============================================================================
// TRADUÇÃO ENTRE MATRIZ DE MESES E DATERANGE
//
// A tela de turnos do recurso é uma matriz de flags: 12 meses por turno, marca
// e desmarca. O banco guarda daterange com exclude constraint — o que é certo,
// porque é isso que impede duas configurações de valerem ao mesmo tempo.
//
// Estas funções fazem a ponte. São puras de propósito: se errarem, o cadastro
// fica diferente do que a tela mostra e ninguém percebe, então dá para testar
// tudo sem banco (lib/matriz.test.js).
//
// Datas em texto 'YYYY-MM-DD', que comparam cronologicamente com < e >.
// Sem objeto Date e sem fuso horário no meio.
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
