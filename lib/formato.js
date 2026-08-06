// Exibição das quantidades de tempo.
//
// A moeda base do projeto é o minuto; hora é só apresentação. As consultas
// devolvem minutos e a conversão acontece aqui — arredondar para hora no
// banco fazia uma parada de 30 min sumir antes de chegar na tela.
//
// O minuto admite fração: disponível = planejada x OEE quase nunca dá inteiro.
// O motor guarda a fração de propósito, para a soma do mês bater com a
// multiplicação. Arredondar é decisão daqui, e acontece uma vez só.

// 1032 -> "17,2" (uma casa, vírgula decimal). Interna: quem chama de fora
// usa formataUnidade, que respeita a unidade escolhida.
function horas(min) {
  return (Number(min ?? 0) / 60).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// 1032 -> "17 h 12 min" — a leitura exata, sem decimal para interpretar.
export function horasEMinutos(min) {
  const total = Math.round(Number(min ?? 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h.toLocaleString('pt-BR')} h`;
  return `${h.toLocaleString('pt-BR')} h ${m} min`;
}

// Valor numérico da barra em horas, sem arredondar antes da hora. Interna:
// de fora se usa emUnidade.
function emHoras(min) {
  return Number(min ?? 0) / 60;
}

// -----------------------------------------------------------------------------
// UNIDADE DE LEITURA
//
// O dado sempre trafega em minutos; a unidade é só como o painel mostra. Hora
// com uma casa é boa para comparar, minuto é o número exato — e é nele que se
// confere uma parada de 30 min que a hora arredondaria.
// -----------------------------------------------------------------------------

// Minuto primeiro: é o default do painel e a unidade base do dado.
export const UNIDADES = [
  { valor: 'min', rotulo: 'minutos' },
  { valor: 'h',   rotulo: 'horas' },
];

export const eMinuto = (unidade) => unidade === 'min';

export const sufixoUnidade = (unidade) => (eMinuto(unidade) ? 'min' : 'h');

// Número para a altura da barra.
export function emUnidade(min, unidade) {
  return eMinuto(unidade) ? Number(min ?? 0) : emHoras(min);
}

// Texto para célula e indicador.
//
// Em minutos a casa decimal só aparece quando existe: 29.430 continua inteiro,
// e 22.072,5 sai como 22.072,5. É justamente o número que a pessoa confere na
// calculadora — arredondar aqui reabriria a diferença que o motor deixou de
// ter.
export function formataUnidade(min, unidade) {
  return eMinuto(unidade)
    ? Number(min ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    : horas(min);
}
