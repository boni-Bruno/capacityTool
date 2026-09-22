import { cache } from 'react';
import { cookies } from 'next/headers';
import { COOKIE_SESSAO, leSessao, segredoDaSessao } from './sessao-token';
import { sessaoDoUsuario } from './acesso';
import { areas as todasAsAreas, sql } from './db';
import { areasPermitidas, plantasPermitidas, alcancaArea, alcancaPlanta } from './escopo';
import { TUDO, escopoDaRota, permissaoDaRota, pode } from './permissoes';

// QUEM ESTÁ NA SESSÃO — e o que pode, e onde.
//
// O cookie carrega só a identidade (lib/sessao-token.js). Permissões e escopo
// saem do banco a cada requisição, para trocar o cargo de alguém valer na
// próxima tela — e `cache` do React faz isso custar uma leitura por
// requisição, por mais componentes que perguntem.
//
// Segunda tranca, dentro da rota: o middleware.js já barra quem não tem
// sessão, mas a versão do Next usada aqui (14.2.15) tem o GHSA-f82v-jwr5-mffw
// — dá para pular o middleware inteiro mandando um header. Quem escreve
// confere por conta própria, e agora confere também a permissão e o escopo.
//
// Sem APP_SENHA o app é aberto de propósito (mesma regra do middleware), para
// não travar quem está rodando local: a sessão vira mestre.

const MESTRE = {
  tipo: 'mestre', id: null, nome: 'mestre', email: null,
  cargo: 'acesso mestre', perms: TUDO, escopo: [{ nivel: 'EMPRESA' }],
  areas: null, plantas: null, trocarSenha: false,
};

export const sessaoAtual = cache(async () => {
  const senha = process.env.APP_SENHA;
  if (!senha) return MESTRE;

  const bruto = cookies().get(COOKIE_SESSAO)?.value;
  const quem = await leSessao(bruto, await segredoDaSessao(senha));
  if (!quem) return null;
  if (quem.tipo === 'mestre') return MESTRE;
  if (quem.tipo === 'nenhum') {
    return { ...quem, cargo: null, perms: [], escopo: [], areas: new Set(),
             plantas: new Set(), trocarSenha: false };
  }

  // UMA consulta para usuário, cargo, permissões e escopo, e ela vai JUNTO
  // com a lista de áreas — que a tela também vai pedir e recebe do mesmo
  // `cache`. Eram quatro consultas em duas ondas; viraram duas numa onda só.
  const [u, lista] = await Promise.all([sessaoDoUsuario(quem.id), todasAsAreas()]);
  // Desativado depois de entrar: a sessão morre na próxima requisição, e não
  // no fim das 12 h — é o que "desativar" tem que significar.
  if (!u || !u.ativo) return null;

  // O cargo protegido tem tudo, inclusive as telas que ainda não existem —
  // por isso '*' e não uma lista.
  const perms = u.protegido ? TUDO : (u.permissoes ?? []);
  const escopo = typeof u.escopo === 'string' ? JSON.parse(u.escopo) : (u.escopo ?? []);
  return {
    tipo: 'usuario', id: u.id, login: u.login, nome: u.nome, email: u.email,
    cargo: u.cargo, perms, escopo,
    areas: areasPermitidas(escopo, lista),
    plantas: plantasPermitidas(escopo),
    trocarSenha: Boolean(u.trocar_senha),
  };
});

const falha = (msg, status) => {
  const e = new Error(msg);
  e.status = status;
  return e;
};

/** Há alguém na sessão. Devolve a sessão; lança 401 se não há. */
export async function exigeSessao() {
  const s = await sessaoAtual();
  if (!s) throw falha('Sessão expirada. Entre de novo.', 401);
  return s;
}

/**
 * A guarda de uma rota de API, pela URL e pelo método: a permissão vem de
 * ROTAS (lib/permissoes.js), e a rota não precisa saber o próprio nome.
 * Rota fora do mapa é recusada — o teste de cobertura impede isso de chegar
 * ao ar, e aqui é a rede caso chegue.
 */
export async function exigeRota(req) {
  const caminho = new URL(req.url).pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const codigo = permissaoDaRota(caminho, req.method);
  if (codigo === undefined) throw falha('Rota sem permissão decidida.', 403);
  const s = await exigePermissao(codigo);

  // O ESCOPO, pelo corpo. Lido de uma cópia: a rota ainda vai ler o dela. A
  // sessão com tudo (mestre, EMPRESA) não paga a busca.
  const exigencias = escopoDaRota(caminho, req.method);
  if (!exigencias.length || (s.areas === null && s.plantas === null)) return s;
  const corpo = await req.clone().json().catch(() => ({}));
  for (const ex of exigencias) {
    const valor = ex.campo ? corpo?.[ex.campo] : null;
    // Campo ausente no corpo é caso da rota recusar por validação, não de
    // escopo: só se confere o que veio. A exceção é 'empresa', que não lê nada.
    if (ex.tipo !== 'empresa' && (valor === undefined || valor === null || valor === '')) continue;
    await confereEscopo(s, ex.tipo, valor);
  }
  return s;
}

// Resolve o valor do corpo para área(s) ou planta(s) e confere com a sessão.
async function confereEscopo(s, tipo, valor) {
  const ids = (Array.isArray(valor) ? valor : [valor]).map(Number).filter(Number.isInteger);
  const foraDaArea = () => falha('Esta área está fora do seu escopo.', 403);
  const foraDaPlanta = () =>
    falha('Esta planta está fora do seu escopo — o que é da planta pede a planta inteira.', 403);

  const areasDe = async (linhas) => {
    for (const l of linhas) if (!alcancaArea(s.areas, l.area_id)) throw foraDaArea();
  };
  const plantasDe = async (linhas) => {
    for (const l of linhas) if (!alcancaPlanta(s.plantas, l.planta_id)) throw foraDaPlanta();
  };

  switch (tipo) {
    case 'empresa':
      if (s.areas !== null) throw falha('Só quem tem a empresa inteira faz isso.', 403);
      return;
    case 'area':
      for (const id of ids) if (!alcancaArea(s.areas, id)) throw foraDaArea();
      return;
    case 'planta':
      for (const id of ids) if (!alcancaPlanta(s.plantas, id)) throw foraDaPlanta();
      return;
    case 'areaDoRecurso':
    case 'areasDosRecursos':
      return areasDe(await sql`
        select area_id from recurso where id = any(${ids}::int[])`);
    case 'areaDaParada':
      return areasDe(await sql`
        select r.area_id from parada p join recurso r on r.id = p.recurso_id
         where p.id = any(${ids}::int[])`);
    case 'plantaDaArea':
      return plantasDe(await sql`select planta_id from area where id = any(${ids}::int[])`);
    case 'plantaDoTurno':
      return plantasDe(await sql`select planta_id from turno where id = any(${ids}::int[])`);
    case 'plantaDoCalendario':
      return plantasDe(await sql`select planta_id from calendario where id = any(${ids}::int[])`);
    case 'plantaDaExcecao':
      return plantasDe(await sql`select planta_id from excecao where id = any(${ids}::int[])`);
    default:
      throw falha(`Escopo desconhecido: ${tipo}.`, 403);
  }
}

/** A sessão tem esta permissão ('oee.editar', 'recalcular'). Lança 403. */
export async function exigePermissao(codigo) {
  const s = await exigeSessao();
  if (codigo && !pode(s.perms, codigo)) {
    throw falha('Seu cargo não permite esta ação.', 403);
  }
  return s;
}

/** A área está no escopo da sessão. Lança 403. */
export async function exigeArea(areaId) {
  const s = await exigeSessao();
  if (!alcancaArea(s.areas, areaId)) {
    throw falha('Esta área está fora do seu escopo.', 403);
  }
  return s;
}

/** A planta está no escopo — inteira, não só uma área dela. Lança 403. */
export async function exigePlanta(plantaId) {
  const s = await exigeSessao();
  if (!alcancaPlanta(s.plantas, plantaId)) {
    throw falha('Esta planta está fora do seu escopo — o que é da planta pede a planta inteira.', 403);
  }
  return s;
}
