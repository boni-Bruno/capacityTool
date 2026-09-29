// Fica em arquivo próprio, sem importar o driver do banco: as telas de
// cadastro são client components e puxariam lib/db.js junto para o bundle.
//
// A ordem é a do banco: dia_semana 0 = domingo ... 6 = sábado.
export const DIAS = [
  'domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado',
];

// Mesma ordem do DIAS. Explícito em vez de cortar o nome completo em três
// letras: 'sábado' cortado vira 'sáb', mas depender disso quebra calado se
// alguém mexer nos nomes de cima.
export const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Rótulo da área em qualquer seletor. Duas plantas podem ter área com o mesmo
// nome — "Confecção" aparecendo duas vezes na lista, sem como saber qual é
// qual, é erro esperando para acontecer.
export function rotuloArea(a) {
  return a.planta ? `${a.planta} · ${a.nome}` : a.nome;
}

/**
 * Os dias de um calendário em uma linha: '0,1,2,3,4,5,6' vira "todos os dias",
 * '1,2,3,4,5,6' vira "segunda a sábado".
 *
 * A tela oferece o regime pelo NOME (Padrão, Rodízio), que é como a fábrica
 * fala; esta linha é a legenda que diz o que o nome quer dizer. Sem ela,
 * escolher entre dois rótulos é adivinhação — e a diferença entre eles é
 * justamente o domingo.
 */
export function descreveDias(dias) {
  if (!dias) return 'nenhum dia configurado';

  const n = String(dias).split(',').map(Number).sort((a, b) => a - b);
  if (!n.length) return 'nenhum dia configurado';
  if (n.length === 7) return 'todos os dias';

  const sequencia = n.every((d, i) => i === 0 || d === n[i - 1] + 1);
  if (sequencia && n.length > 2) return `${DIAS[n[0]]} a ${DIAS[n[n.length - 1]]}`;
  return n.map((d) => DIAS[d]).join(', ');
}

// Índice 0 não é usado: os meses chegam do Postgres como 1..12.
export const MESES = [
  '', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];
