// =============================================================================
// ESCOPO — onde a pessoa atua
//
// O cargo diz O QUE a pessoa pode (lib/permissoes.js); o escopo diz ONDE.
// Cada usuário tem linhas de `usuario_escopo`: EMPRESA (tudo), PLANTA (a
// planta inteira) ou AREA (só aquela). A resolução para áreas acontece NA
// LEITURA, com a lista de áreas de hoje — é isso que faz uma área criada
// amanhã numa planta permitida entrar sozinha no escopo de quem tem a planta.
//
// ESCOPO VAZIO É ESCOPO, NÃO É "TUDO". Um usuário sem linha não vê fábrica
// nenhuma. O contrário — vazio valendo tudo — seria o defeito silencioso
// clássico: esquecer de marcar e a pessoa enxergar a empresa inteira.
//
// `null` como resultado é o único "tudo": vem de EMPRESA ou da sessão mestre.
//
// Motor puro: sem banco, sem tela.
// =============================================================================

export const NIVEIS = ['EMPRESA', 'PLANTA', 'AREA'];

const num = (v) => Number(v);

/**
 * As áreas que o escopo alcança: `null` para tudo, senão um Set de ids.
 * `areas` é a lista de hoje, cada uma com { id, planta_id }.
 */
export function areasPermitidas(escopo, areas) {
  const linhas = escopo ?? [];
  if (linhas.some((e) => e.nivel === 'EMPRESA')) return null;
  const plantas = new Set(linhas.filter((e) => e.nivel === 'PLANTA').map((e) => num(e.referencia_id)));
  const soltas = new Set(linhas.filter((e) => e.nivel === 'AREA').map((e) => num(e.referencia_id)));
  const s = new Set();
  for (const a of areas ?? []) {
    if (plantas.has(num(a.planta_id)) || soltas.has(num(a.id))) s.add(num(a.id));
  }
  return s;
}

/**
 * As plantas em que a pessoa pode mexer no que é DA PLANTA — turno,
 * calendário, a própria planta. Só EMPRESA e PLANTA contam: quem tem uma
 * área solta não decide o turno que as outras áreas da planta compartilham.
 */
export function plantasPermitidas(escopo) {
  const linhas = escopo ?? [];
  if (linhas.some((e) => e.nivel === 'EMPRESA')) return null;
  return new Set(linhas.filter((e) => e.nivel === 'PLANTA').map((e) => num(e.referencia_id)));
}

/** Uma área está no alcance? `permitidas` é o que areasPermitidas devolveu. */
export function alcancaArea(permitidas, areaId) {
  return permitidas === null || permitidas.has(num(areaId));
}

export function alcancaPlanta(permitidas, plantaId) {
  return permitidas === null || permitidas.has(num(plantaId));
}

/**
 * Recorta uma lista pelo que o escopo alcança. `permitidas` é o que
 * `areasPermitidas`/`plantasPermitidas` devolveram — e `null` ali é TUDO.
 *
 * ESTA FUNÇÃO EXISTE PARA NINGUÉM MAIS ESCREVER `permitidas ?? new Set()`.
 * O `??` dispara no null, e o null aqui quer dizer "tudo": a expressão
 * transforma silenciosamente tudo em nada. Foi exatamente isso que fez o
 * painel dizer "Nenhuma área cadastrada" para quem enxerga a empresa
 * inteira — inclusive para a senha mestre (22/09/2026).
 */
export function filtraPeloEscopo(permitidas, lista, campo = 'id') {
  if (permitidas === null) return lista ?? [];
  return (lista ?? []).filter((l) => permitidas.has(num(l?.[campo])));
}

/**
 * O escopo em uma frase, para a tabela de usuários:
 *   "empresa inteira" · "Matriz inteira" · "Ibirama › Confecção Cama"
 */
export function descreveEscopo(escopo, plantas, areas) {
  const linhas = escopo ?? [];
  if (!linhas.length) return 'nenhuma fábrica';
  if (linhas.some((e) => e.nivel === 'EMPRESA')) return 'empresa inteira';
  const nomePlanta = (id) => (plantas ?? []).find((p) => num(p.id) === num(id))?.nome ?? `planta ${id}`;
  const nomeArea = (id) => {
    const a = (areas ?? []).find((x) => num(x.id) === num(id));
    return a ? `${nomePlanta(a.planta_id)} › ${a.nome}` : `área ${id}`;
  };
  const partes = [
    ...linhas.filter((e) => e.nivel === 'PLANTA').map((e) => `${nomePlanta(e.referencia_id)} inteira`),
    ...linhas.filter((e) => e.nivel === 'AREA').map((e) => nomeArea(e.referencia_id)),
  ];
  return partes.join(' · ');
}

/**
 * Da marcação da tela para as linhas do banco.
 *
 * `marcado` é { empresa: bool, plantas: [ids], areas: [ids] }. Planta marcada
 * engole as áreas dela — guardar as duas coisas faria a área continuar
 * permitida depois de alguém tirar a planta. Empresa engole tudo.
 */
export function escopoDaTela(marcado, areas) {
  if (marcado?.empresa) return [{ nivel: 'EMPRESA', referencia_id: null }];
  const plantas = [...new Set((marcado?.plantas ?? []).map(num).filter(Number.isFinite))];
  const dasPlantas = new Set((areas ?? [])
    .filter((a) => plantas.includes(num(a.planta_id))).map((a) => num(a.id)));
  const soltas = [...new Set((marcado?.areas ?? []).map(num).filter(Number.isFinite))]
    .filter((id) => !dasPlantas.has(id));
  return [
    ...plantas.map((id) => ({ nivel: 'PLANTA', referencia_id: id })),
    ...soltas.map((id) => ({ nivel: 'AREA', referencia_id: id })),
  ];
}

/** O caminho de volta: linhas do banco → marcação da tela. */
export function marcacaoDoEscopo(escopo) {
  const linhas = escopo ?? [];
  return {
    empresa: linhas.some((e) => e.nivel === 'EMPRESA'),
    plantas: linhas.filter((e) => e.nivel === 'PLANTA').map((e) => num(e.referencia_id)),
    areas: linhas.filter((e) => e.nivel === 'AREA').map((e) => num(e.referencia_id)),
  };
}
