// Fica em arquivo próprio, sem importar o driver do banco: as telas de
// cadastro são client components e puxariam lib/db.js junto para o bundle.
//
// A ordem é a do banco: dia_semana 0 = domingo ... 6 = sábado.
export const DIAS = [
  'domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado',
];

// Rótulo da área em qualquer seletor. Duas plantas podem ter área com o mesmo
// nome — "Confecção" aparecendo duas vezes na lista, sem como saber qual é
// qual, é erro esperando para acontecer.
export function rotuloArea(a) {
  return a.planta ? `${a.planta} · ${a.nome}` : a.nome;
}

// Índice 0 não é usado: os meses chegam do Postgres como 1..12.
export const MESES = [
  '', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];
