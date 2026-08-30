// =============================================================================
// A GEOMETRIA DO GRÁFICO E DA GRADE
//
// Números puros: colunas, retângulos de barra, pontos da linha. Nada de XML,
// nada de SVG, nada de unidade — quem chama decide se está em EMU (o .pptx) ou
// em pixel (a página de impressão).
//
// AQUI E NÃO EM CADA SAÍDA porque a exigência do desenho é o ALINHAMENTO: o
// rótulo de março, embaixo, tem que cair debaixo da barra de março, em cima.
// Duas contas de coluna — uma para o gráfico, outra para a grade — batem hoje e
// deixam de bater na primeira mudança de margem, e o desalinhamento é daqueles
// que só se enxerga projetado.
//
// A ESCALA É COMUM ÀS DUAS SÉRIES. Capacidade e demanda medem a mesma coisa em
// minutos; escalas separadas fariam uma barra menor parecer maior que a linha, e
// o slide existe justamente para mostrar essa distância.
//
// A CAPACIDADE É A ÁREA, A DEMANDA É A BARRA — como no Painel da Ocupação. A
// capacidade é um teto: ela vale o mês inteiro, e uma superfície contínua é o
// que se parece com isso. A demanda é o que foi pedido, evento a evento, e cai
// bem em coluna. Invertido, o desenho diz que a demanda é o contínuo e a
// capacidade o discreto — o contrário do que a fábrica é.
//
// Sem imports: é chamado do navegador, do servidor e do teste.
// =============================================================================

export const EMU_POR_POLEGADA = 914400;
export const pol = (n) => Math.round(n * EMU_POR_POLEGADA);

const num = (v) => Number(v ?? 0);

/**
 * As colunas do desenho, iguais para o gráfico e para a grade.
 *
 * `rotulo` é a largura reservada à esquerda para os nomes das linhas da grade —
 * "OEE", "1º turno". O gráfico também começa depois dela: se ele ocupasse a
 * largura toda, cada coluna ficaria deslocada da coluna de baixo pela largura
 * do rótulo, que é exatamente o desalinhamento que se quer evitar.
 */
export function colunas(x, largura, quantas, rotulo = 0, total = 0) {
  const util = Math.max(0, largura - rotulo - total);
  const w = quantas > 0 ? util / quantas : 0;
  return Array.from({ length: quantas }, (_, i) => {
    const ini = x + rotulo + i * w;
    return { i, x: ini, largura: w, centro: ini + w / 2 };
  });
}

/**
 * A COLUNA DO TOTAL, à direita de tudo.
 *
 * Fora das colunas de mês de propósito: ela não é um mês, e deixá-la entrar na
 * divisão faria as doze barras encolherem para caber um treze que não existe no
 * gráfico. O gráfico ocupa só os meses; o total é da grade.
 */
export const colunaTotal = (x, largura, total) =>
  ({ x: x + largura - total, largura: total, centro: x + largura - total / 2 });

/**
 * O gráfico: barra por mês para a demanda, linha com área para a capacidade.
 *
 * `folga` é o espaço deixado no topo para o desenho não encostar no que está
 * acima. Sem ela o pico da área toca o teto e parece cortado.
 */
export function geometriaDoGrafico({
  x, y, largura, altura, serie = [], rotulo = 0, total = 0, folga = 0.10,
  espessuraBarra = 0.6,
}) {
  const cols = colunas(x, largura, serie.length, rotulo, total);
  const base = y + altura;
  const util = altura * (1 - folga);

  // Máximo das duas séries juntas. Zero em tudo não vira divisão por zero: as
  // barras ficam com altura nenhuma, que é a leitura certa de "não há nada".
  const max = serie.reduce(
    (m, p) => Math.max(m, num(p?.capacidade), num(p?.demanda)), 0);
  const alturaDe = (v) => (max <= 0 ? 0 : (num(v) / max) * util);

  const barras = cols.map((c, i) => {
    const h = alturaDe(serie[i]?.demanda);
    const w = c.largura * espessuraBarra;
    return {
      i, x: c.centro - w / 2, largura: w, y: base - h, altura: h,
      valor: num(serie[i]?.demanda),
    };
  });

  const pontos = cols.map((c, i) => ({
    i, x: c.centro, y: base - alturaDe(serie[i]?.capacidade),
    valor: num(serie[i]?.capacidade),
  }));

  // O contorno fechado da área: a linha, e a volta pela base. Fechar pela base
  // e não pelo topo é o que faz a superfície ficar embaixo da linha; do outro
  // jeito ela pintaria o vazio.
  const poligono = pontos.length
    ? [{ x: pontos[0].x, y: base }, ...pontos.map((p) => ({ x: p.x, y: p.y })),
       { x: pontos[pontos.length - 1].x, y: base }]
    : [];

  return { colunas: cols, barras, pontos, poligono, base, topo: y, max };
}

/**
 * As faixas horizontais da grade, de cima para baixo.
 *
 * Altura igual para todas: a linha do mês não é mais importante que a do
 * terceiro turno, e alturas diferentes fariam parecer que é.
 */
export function faixasDaGrade({ x, y, largura, altura, quantas }) {
  const h = quantas > 0 ? altura / quantas : 0;
  return Array.from({ length: quantas }, (_, i) => ({
    i, x, largura, y: y + i * h, altura: h,
  }));
}
