// =============================================================================
// PERMISSÕES — o que cada tela pede, e o que um cargo tem
//
// A lista de telas mora AQUI, e não no banco (migração 38). Tela nova entra
// nesta lista e aparece na grade de cargos sozinha; numa tabela, o primeiro
// esquecimento faria a tela nascer invisível para todo cargo.
//
// Cada tela tem duas permissões, `<tela>.ver` e `<tela>.editar`, mais uma
// avulsa, `recalcular`. EDITAR IMPLICA VER: é regra do motor — `podeVer`
// aceita editar — e não da tela, para uma grade mal marcada não produzir um
// cargo que grava sem enxergar.
//
// O cargo protegido (Gestor de Planejamento) e a sessão mestre têm TUDO:
// `perms === '*'`. Não guardam lista, e por isso ganham as telas futuras sem
// que ninguém lembre de marcá-las.
//
// `ROTAS` diz que permissão cada rota de API pede. Um teste garante que TODA
// pasta de app/api está aqui: rota sem entrada é rota que ninguém decidiu se
// é leitura ou escrita, e o padrão nesse caso teria que ser "ninguém entra".
//
// Motor puro: sem banco, sem tela.
// =============================================================================

// A ordem é a do menu. `grupo` é o título do bloco na barra lateral e na home.
export const TELAS = [
  { codigo: 'painel',          rotulo: 'Painel da Capacidade',      grupo: 'Consultar',                   href: '/painel' },
  { codigo: 'ocupacao',        rotulo: 'Painel da Ocupação',        grupo: 'Consultar',                   href: '/ocupacao' },
  { codigo: 'plantas',         rotulo: 'Plantas',                   grupo: 'Estrutura da empresa',        href: '/cadastros/plantas' },
  { codigo: 'areas',           rotulo: 'Áreas',                     grupo: 'Estrutura da empresa',        href: '/cadastros/areas' },
  { codigo: 'recursos',        rotulo: 'Recursos',                  grupo: 'Estrutura da empresa',        href: '/cadastros/recursos' },
  { codigo: 'turnos',          rotulo: 'Turnos',                    grupo: 'Estrutura da empresa',        href: '/cadastros/turnos' },
  { codigo: 'calendarios',     rotulo: 'Calendários',               grupo: 'Estrutura da empresa',        href: '/cadastros/calendarios' },
  { codigo: 'turnos_recurso',  rotulo: 'Turnos do recurso',         grupo: 'Planejamento da capacidade',  href: '/cadastros/turnos-do-recurso' },
  { codigo: 'oee',             rotulo: 'OEE',                       grupo: 'Planejamento da capacidade',  href: '/cadastros/oee' },
  { codigo: 'paradas',         rotulo: 'Paradas',                   grupo: 'Planejamento da capacidade',  href: '/cadastros/paradas' },
  { codigo: 'demanda',         rotulo: 'Demanda',                   grupo: 'Conversão da capacidade',     href: '/cadastros/demanda' },
  { codigo: 'de_para',         rotulo: 'DE/PARA',                   grupo: 'Conversão da capacidade',     href: '/cadastros/de-para' },
  { codigo: 'mix',             rotulo: 'Ajuste de mix',             grupo: 'Conversão da capacidade',     href: '/cadastros/mix' },
  { codigo: 'extracao_ap',     rotulo: 'Extração para o AP',        grupo: 'Extração',                    href: '/cadastros/extracao-ap' },
  { codigo: 'extracao_config', rotulo: 'Extração das configurações', grupo: 'Extração',                   href: '/cadastros/extracao-config' },
  { codigo: 'simulador',       rotulo: 'Simulador de recursos',     grupo: 'Extração',                    href: '/cadastros/extracao-simulador' },
  { codigo: 'usuarios',        rotulo: 'Usuários',                  grupo: 'Acesso',                      href: '/cadastros/usuarios' },
  { codigo: 'cargos',          rotulo: 'Cargos',                    grupo: 'Acesso',                      href: '/cadastros/cargos' },
];

// As avulsas: ações que não são uma tela. Recalcular mora no painel, mas ver o
// painel não é o mesmo que refazer a capacidade da fábrica.
export const AVULSAS = [
  { codigo: 'recalcular', rotulo: 'Recalcular (tudo ou parcial)' },
];

export const TUDO = '*';

/** Todos os códigos que existem, na ordem da grade. */
export function todasAsPermissoes() {
  return [
    ...TELAS.flatMap((t) => [`${t.codigo}.ver`, `${t.codigo}.editar`]),
    ...AVULSAS.map((a) => a.codigo),
  ];
}

const conhecidas = new Set(todasAsPermissoes());

/**
 * Limpa uma lista vinda da tela ou do banco: só códigos conhecidos, sem
 * repetição, e com editar puxando ver. É o que se grava.
 */
export function normaliza(lista) {
  const s = new Set();
  for (const c of lista ?? []) {
    if (!conhecidas.has(c)) continue;
    s.add(c);
    if (c.endsWith('.editar')) s.add(c.replace(/\.editar$/, '.ver'));
  }
  return todasAsPermissoes().filter((c) => s.has(c));
}

const tem = (perms, codigo) =>
  perms === TUDO || (Array.isArray(perms) ? perms.includes(codigo)
    : perms instanceof Set ? perms.has(codigo) : false);

export function podeVer(perms, tela) {
  return tem(perms, `${tela}.ver`) || tem(perms, `${tela}.editar`);
}

export function podeEditar(perms, tela) {
  return tem(perms, `${tela}.editar`);
}

/** Uma permissão qualquer pelo código completo ('oee.editar', 'recalcular'). */
export function pode(perms, codigo) {
  if (tem(perms, codigo)) return true;
  // 'x.ver' é satisfeita por 'x.editar'.
  if (codigo.endsWith('.ver')) return tem(perms, codigo.replace(/\.ver$/, '.editar'));
  return false;
}

/** As telas que o menu mostra para este conjunto de permissões, na ordem. */
export function telasVisiveis(perms) {
  return TELAS.filter((t) => podeVer(perms, t.codigo));
}

/** As telas visíveis agrupadas como o menu desenha: [{ nome, itens }]. */
export function gruposDoMenu(perms) {
  const grupos = [];
  for (const t of telasVisiveis(perms)) {
    let g = grupos.find((x) => x.nome === t.grupo);
    if (!g) { g = { nome: t.grupo, itens: [] }; grupos.push(g); }
    g.itens.push({ href: t.href, rotulo: t.rotulo, codigo: t.codigo });
  }
  return grupos;
}

// -----------------------------------------------------------------------------
// ROTAS DE API → permissão exigida.
//
// A chave é a pasta debaixo de app/api. `ver` é leitura (extrações, simulador,
// a lista do pop-up de recalcular); o resto grava e pede `editar` da tela
// que o oferece. `entrar`, `sair` e `senha` são da própria sessão: qualquer
// pessoa autenticada (ou ninguém, no caso de entrar).
//
// Rota que lê e grava na mesma pasta leva um objeto por método: o GET do
// modelo de slide é o que monta o .pptx — quem só vê a extração precisa dele —
// e o POST é que troca o modelo.
// -----------------------------------------------------------------------------
export const ROTAS = {
  'entrar':                     null,
  'sair':                       null,
  'senha':                      null,
  'cadastro/planta':            'plantas.editar',
  'cadastro/area':              'areas.editar',
  'cadastro/recurso':           'recursos.editar',
  'cadastro/recurso-definitivo': 'recursos.editar',
  'cadastro/turno':             'turnos.editar',
  'cadastro/turno-horario':     'turnos.editar',
  'cadastro/calendario':        'calendarios.editar',
  'cadastro/calendario-copia':  'calendarios.editar',
  'cadastro/calendario-peso':   'calendarios.editar',
  'cadastro/calendario-regra':  'calendarios.editar',
  'cadastro/excecao':           'calendarios.editar',
  'cadastro/recurso-calendario': 'turnos_recurso.editar',
  'cadastro/recurso-turno':     'turnos_recurso.editar',
  'cadastro/oee':               'oee.editar',
  'cadastro/parada':            'paradas.editar',
  'cadastro/cargo':             'cargos.editar',
  'cadastro/usuario':           'usuarios.editar',
  'demanda':                    'demanda.editar',
  'demanda-origem':             'demanda.editar',
  'de-para':                    'de_para.editar',
  'mix':                        'mix.editar',
  'extracao':                   'extracao_ap.ver',
  'recursos-ap':                'extracao_ap.editar',
  'extracao-config':            'extracao_config.ver',
  'modelo-slide':               { GET: 'extracao_config.ver', '*': 'extracao_config.editar' },
  'faixa-ocupacao':             { GET: 'extracao_config.ver', '*': 'extracao_config.editar' },
  'simulador':                  'simulador.ver',
  'recalcular':                 { GET: 'painel.ver', '*': 'recalcular' },
};

/**
 * A permissão de uma rota e método. `null` é "só sessão"; `undefined` é rota
 * fora do mapa — e o teste de cobertura não deixa isso chegar ao ar.
 */
export function permissaoDaRota(pasta, metodo = 'POST') {
  const v = ROTAS[pasta];
  if (v === undefined || v === null || typeof v === 'string') return v;
  return v[metodo] ?? v['*'];
}
