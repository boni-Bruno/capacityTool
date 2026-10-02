// =============================================================================
// A OCUPAÇÃO — demanda ÷ capacidade, e o caso em que não há capacidade.
//
// A conta é trivial e estava copiada em cinco lugares (o painel, o mês a mês, a
// tabela por atributo, a tabela dinâmica e o slide). Isso bastaria para trazê-la
// para cá; o que obrigou foi o caso da divisão por zero, que cada cópia resolvia
// do mesmo jeito — devolvendo nulo — e que o Bruno viu em 02/10/2026:
//
//   *"quando não tem capacidade cadastrada mas tem demanda, a ocupação não está
//   apresentando nada"*
//
// E não apresentar nada é a pior resposta possível ali, porque esse é o caso
// MAIS GRAVE da tela: o plano pede de um centro que não tem nenhuma capacidade.
// O travessão cinza dizia "nada a ver aqui" exatamente onde tudo está
// descoberto.
//
// A SAÍDA É INFINITO, e não um número grande. O pedido foi dividir por 1 para
// sair algum número; dividir por 1 daria `demanda × 100` — 265.398.400% para um
// mês de 2,6 milhões de minutos — e esse número tem dois problemas: não se lê, e
// MUDA COM A UNIDADE (em horas o mesmo caso daria 4.423.307%), o que é a
// armadilha que este projeto evita em toda parte. Infinito diz a mesma coisa —
// "não cabe de jeito nenhum" —, ordena no topo, cai na faixa de cor mais alta
// como qualquer estouro, e não depende de unidade nenhuma. Quanto falta já está
// escrito ao lado, em minutos, pela própria demanda.
//
// ZERO SOBRE ZERO CONTINUA SENDO NADA: sem capacidade e sem demanda não existe
// ocupação para mostrar, e inventar 0% diria "folgado" sobre uma conta que não
// foi feita.
//
// Motor puro: sem banco, sem tela.
// =============================================================================

/** O que sai quando há demanda e não há capacidade nenhuma. */
export const INFINITA = Infinity;

export const ocupacaoInfinita = (v) =>
  v !== null && v !== undefined && !Number.isFinite(Number(v));

/**
 * A ocupação em PORCENTAGEM, a partir de dois totais já somados.
 *
 * Divisão de somas, sempre: quem chama soma os dois lados antes, e nunca faz a
 * média das ocupações de cada mês — somar médias não dá média, e o total tem
 * que bater com o indicador.
 */
export function ocupacaoDe(demanda, capacidade) {
  const d = Number(demanda ?? 0);
  const c = Number(capacidade ?? 0);
  if (!Number.isFinite(d) || !Number.isFinite(c)) return null;
  if (c > 0) return (d * 100) / c;
  return d > 0 ? INFINITA : null;
}

/**
 * A mesma regra para uma razão em FRAÇÃO, que é como a tabela dinâmica guarda
 * as dela (0,92 e não 92). Vale para ocupação, % do teto e OEE: denominador
 * zero com numerador positivo é infinito, e zero sobre zero não existe.
 */
export function razaoDe(cima, baixo) {
  const a = Number(cima ?? 0);
  const b = Number(baixo ?? 0);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (b !== 0) return a / b;
  return a > 0 ? INFINITA : null;
}

/**
 * "92,4%", "∞" ou "—".
 *
 * Com VÍRGULA, como todo número deste projeto. Até aqui o painel escrevia
 * "92.4%" ao lado de "3.793.659" na mesma linha — o milhar em português e o
 * decimal em inglês, na mesma tela. O slide já saía com vírgula, e era mais uma
 * diferença gratuita entre os dois.
 */
export function fmtOcupacao(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
    return '—';
  }
  if (ocupacaoInfinita(valor)) return '∞';
  return `${Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  })}%`;
}

/**
 * O que o ∞ quer dizer, escrito — para o `title` da célula e para o rodapé.
 *
 * O símbolo chama a atenção e não explica; esta frase é a explicação, e ela
 * cabe num title porque é curta.
 */
export const explicaInfinita = (demanda, unidade = 'min') =>
  `O plano pede ${Number(demanda ?? 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  })} ${unidade} e não há capacidade nenhuma calculada aqui: `
  + 'ou o centro não tem recurso cadastrado com este CC-CT, ou tem e ainda não '
  + 'foi recalculado.';
