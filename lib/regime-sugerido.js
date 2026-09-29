// =============================================================================
// O QUE O TURNO SUGERE COMO REGIME DE DIAS
//
// O regime é do RECURSO e é por mês — é ele que o motor lê. O turno só opina:
// o turno de rodízio aponta o calendário RODIZIO, e quando alguém o marca num
// mês cujo regime é outro, a tela oferece a troca em um clique.
//
// Por que opinar em vez de derivar. "Essa máquina passa a rodar em rodízio em
// julho" é UMA decisão na cabeça de quem cadastra, e virou duas na tela: marcar
// o turno e trocar o regime. A segunda é a que fica para trás. Mas derivar o
// regime do turno erraria o caso real — o mesmo turno pode existir numa planta
// que trabalha aos domingos e noutra que não, e há recurso com dois turnos
// marcados no mesmo mês apontando para calendários diferentes. Quando os dois
// discordam, quem decide é uma pessoa: aqui isso vira CONFLITO, que a tela
// mostra e não resolve sozinha.
//
// Puro de propósito: é a regra que decide o que a tela propõe, e propor a troca
// errada de regime muda número sem ninguém perceber.
// =============================================================================

/**
 * @param turnos  [{ turno_id, nome, calendario_sugerido_id }]
 * @param ligados { mes: [turnoId, ...] } — os turnos marcados em cada mês
 * @param cal     { mes: calendarioId } — o regime que está na tela agora
 *
 * @returns {{ aplicar: {mes: calendarioId}, conflitos: [{mes, turnos}] }}
 *   `aplicar` só traz mês em que há UMA sugestão e ela é diferente do que está
 *   lá: sugerir o que já vale seria um botão que não faz nada.
 */
export function sugestoesDoAno(turnos, ligados, cal) {
  const sugestaoDe = new Map();
  const nomeDe = new Map();
  for (const t of turnos ?? []) {
    const id = Number(t.turno_id);
    nomeDe.set(id, t.nome);
    if (t.calendario_sugerido_id) {
      sugestaoDe.set(id, Number(t.calendario_sugerido_id));
    }
  }

  const aplicar = {};
  const conflitos = [];

  for (let mes = 1; mes <= 12; mes += 1) {
    const marcados = (ligados?.[mes] ?? []).map(Number);
    const comSugestao = marcados.filter((id) => sugestaoDe.has(id));
    if (!comSugestao.length) continue;

    const distintas = [...new Set(comSugestao.map((id) => sugestaoDe.get(id)))];

    // DOIS TURNOS PUXANDO PARA LADOS DIFERENTES no mesmo mês. Escolher um
    // seria decidir no lugar de quem cadastra, e o critério ("o primeiro da
    // lista") não teria nada a ver com a fábrica.
    if (distintas.length > 1) {
      conflitos.push({
        mes,
        turnos: comSugestao.map((id) => nomeDe.get(id) ?? String(id)),
      });
      continue;
    }

    const sugerido = distintas[0];
    if (String(cal?.[mes] ?? '') !== String(sugerido)) aplicar[mes] = sugerido;
  }

  return { aplicar, conflitos };
}
