// Exibição das quantidades de tempo.
//
// A moeda base do projeto é minuto inteiro; hora é só apresentação. As
// consultas devolvem minutos e a conversão acontece aqui — arredondar para
// hora no banco fazia uma parada de 30 min sumir antes de chegar na tela.

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

export const UNIDADES = [
  { valor: 'h',   rotulo: 'horas' },
  { valor: 'min', rotulo: 'minutos' },
];

export const eMinuto = (unidade) => unidade === 'min';

export const sufixoUnidade = (unidade) => (eMinuto(unidade) ? 'min' : 'h');

// Número para a altura da barra.
export function emUnidade(min, unidade) {
  return eMinuto(unidade) ? Number(min ?? 0) : emHoras(min);
}

// Texto para célula e indicador. Minuto é inteiro — casa decimal em minuto não
// significa nada, já que é a unidade base.
export function formataUnidade(min, unidade) {
  return eMinuto(unidade)
    ? Math.round(Number(min ?? 0)).toLocaleString('pt-BR')
    : horas(min);
}
