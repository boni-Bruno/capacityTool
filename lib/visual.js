// =============================================================================
// A GEOMETRIA DO GRÁFICO E DA GRADE
//
// Números puros: colunas, retângulos de barra, pontos da linha. Nada de XML e
// nada de unidade — quem chama decide a escala, hoje EMU para o .pptx.
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
 * A ESCALA DO EIXO: um teto redondo e as marcas até ele.
 *
 * O eixo precisa de números que alguém leia de relance — 0, 10.000, 20.000 —, e
 * não do máximo cru da série. Terminar o eixo em 43.441 daria uma régua com
 * marcas em 8.688,2, que é pior que régua nenhuma: o olho para para decifrar em
 * vez de comparar.
 *
 * O passo sai da magnitude do intervalo, arredondado para 1, 2, 2,5 ou 5 vezes
 * a potência de dez — a mesma família de passos que qualquer eixo usa, porque é
 * a que dá números que se somam de cabeça.
 */
export function escalaY(max, alvo = 5) {
  if (!(max > 0)) return { teto: 0, passo: 0, marcas: [0] };

  const bruto = max / Math.max(1, alvo);
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const norma = bruto / mag;
  const passo = (norma <= 1 ? 1
    : norma <= 2 ? 2
    : norma <= 2.5 ? 2.5
    : norma <= 5 ? 5 : 10) * mag;

  const teto = Math.ceil(max / passo) * passo;
  const marcas = [];
  // Com tolerância de meio passo: acumular 0,1 doze vezes não dá 1,2 exato, e
  // sem folga a última marca sumiria justamente no eixo mais comum.
  for (let v = 0; v <= teto + passo / 2; v += passo) marcas.push(v);
  return { teto, passo, marcas };
}

/**
 * O gráfico: barra por mês para a demanda, linha com área para a capacidade.
 *
 * `teto` fixa o valor que fica no topo da área de desenho — é o que faz as
 * barras baterem com as linhas de grade do eixo. Sem ele vale `folga`, um
 * espaço no topo para o pico não encostar no que está acima.
 */
export function geometriaDoGrafico({
  x, y, largura, altura, serie = [], rotulo = 0, total = 0, folga = 0.10,
  espessuraBarra = 0.6, teto = null,
}) {
  const cols = colunas(x, largura, serie.length, rotulo, total);
  const base = y + altura;

  // Máximo das duas séries juntas. Zero em tudo não vira divisão por zero: as
  // barras ficam com altura nenhuma, que é a leitura certa de "não há nada".
  const max = serie.reduce(
    (m, p) => Math.max(m, num(p?.capacidade), num(p?.demanda)), 0);

  const escala = num(teto) > 0 ? num(teto) : max;
  const util = num(teto) > 0 ? altura : altura * (1 - folga);
  const alturaDe = (v) => (escala <= 0 ? 0 : (num(v) / escala) * util);

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

  return {
    colunas: cols, barras, pontos, poligono, base, topo: y, max,
    // Onde cada valor cai na vertical: é o que põe a linha de grade do eixo na
    // mesma altura da barra que ela mede.
    alturaDe, yDe: (v) => base - alturaDe(v),
  };
}

/**
 * As faixas horizontais da grade, de cima para baixo.
 *
 * Altura igual para todas: a linha do mês não é mais importante que a do
 * terceiro turno, e alturas diferentes fariam parecer que é.
 */
export function faixasDaGrade({
  x, y, largura, altura, quantas, quebras = [], folga = 0,
}) {
  // AS QUEBRAS SÃO RESPIRO ENTRE BLOCOS, e saem do total antes de dividir: se
  // saíssem depois, a última linha cairia fora da altura pedida — e "fora da
  // altura pedida" no slide quer dizer por cima do rodapé com o logotipo.
  //
  // O respiro existe porque cálculo e cadastro são duas tabelas coladas uma na
  // outra. A tinta e a chave já dizem que são dois blocos, mas dizer com espaço
  // é o que o olho lê primeiro — antes de qualquer rótulo.
  const cortes = [...new Set(quebras)].filter((i) => i > 0 && i < quantas);
  const h = quantas > 0 ? (altura - cortes.length * folga) / quantas : 0;

  return Array.from({ length: quantas }, (_, i) => ({
    i, x, largura, altura: h,
    y: y + i * h + cortes.filter((c) => c <= i).length * folga,
  }));
}
