import { cache } from 'react';
import { cookies } from 'next/headers';
import { COOKIE_SESSAO, leSessao, segredoDaSessao } from './sessao-token';
import { escopoDe, permissoesDoCargo, usuarioPorId } from './acesso';
import { areas as todasAsAreas } from './db';
import { areasPermitidas, plantasPermitidas, alcancaArea, alcancaPlanta } from './escopo';
import { TUDO, pode } from './permissoes';

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

  const u = await usuarioPorId(quem.id);
  // Desativado depois de entrar: a sessão morre na próxima requisição, e não
  // no fim das 12 h — é o que "desativar" tem que significar.
  if (!u || !u.ativo) return null;

  const [perms, escopo, lista] = await Promise.all([
    permissoesDoCargo(u.cargo_id), escopoDe(u.id), todasAsAreas(),
  ]);
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
