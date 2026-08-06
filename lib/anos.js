// Quais anos o app oferece para escolher.
//
// Era `[anoAtual - 1, anoAtual, anoAtual + 1]`, ancorado no relógio. Isso erra
// dos dois lados: em 2028 o ano de 2026 sai da lista mesmo com a rodada dele
// guardada no banco — dado existe, sem caminho até ele — e um ano futuro entra
// na lista mesmo sem nada calculado.
//
// A lista passa a ser a união do que existe com o que dá para planejar: todo
// ano que já teve rodada, mais o ano corrente e uma janela em volta dele.
//
// Sem imports: é chamado das telas (servidor) e do teste.

// Quanto para trás e para frente a partir de hoje. Dois anos à frente porque
// em agosto já se planeja o ano seguinte, e às vezes o outro.
const ATRAS = 1;
const FRENTE = 2;

export function anosParaEscolha(anosComRodada = [], hoje = new Date()) {
  const atual = hoje.getFullYear();
  const anos = new Set();

  // Faixa plausível e não só "é inteiro": Number(null) é 0, e um zero na
  // lista viraria a opção "0" no seletor.
  for (const a of anosComRodada) {
    const n = Number(a);
    if (Number.isInteger(n) && n >= 1900 && n <= 9999) anos.add(n);
  }
  for (let a = atual - ATRAS; a <= atual + FRENTE; a++) anos.add(a);

  return [...anos].sort((a, b) => a - b);
}

// O ano pedido na URL, quando ele faz sentido. Ano fora da lista cai no
// corrente em vez de mostrar tela vazia sem explicar por quê.
export function anoEscolhido(pedido, anos, hoje = new Date()) {
  const n = Number(pedido);
  if (Number.isInteger(n) && anos.includes(n)) return n;
  const atual = hoje.getFullYear();
  return anos.includes(atual) ? atual : anos[anos.length - 1];
}
