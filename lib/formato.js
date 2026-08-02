// Exibição das quantidades de tempo.
//
// A moeda base do projeto é minuto inteiro; hora é só apresentação. As
// consultas devolvem minutos e a conversão acontece aqui — arredondar para
// hora no banco fazia uma parada de 30 min sumir antes de chegar na tela.

// 1032 -> "17,2" (uma casa, vírgula decimal)
export function horas(min) {
  return (Number(min ?? 0) / 60).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// 1032 -> "17,2 h"
export function textoHoras(min) {
  return horas(min) + ' h';
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

// Valor numérico para a altura da barra: hora com casa decimal, sem arredondar
// antes da hora — o gráfico precisa de número, não de texto.
export function emHoras(min) {
  return Number(min ?? 0) / 60;
}
