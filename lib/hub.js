// O PORTAL É A ÚNICA PORTA.
//
// Quem chega aqui sem sessão vai para o Hub S&OP, e não para uma tela de senha
// daqui. A senha de cada pessoa passa a existir num lugar só — foi isso que a
// decisão de 22/09/2026 comprou: nada a sincronizar entre dois bancos, um lugar
// para trocar, um lugar para bloquear.
//
// O que NÃO mudou: quem é a pessoa aqui dentro continua sendo decidido aqui. O
// Hub responde "pode entrar"; cargo, permissões e escopo saem do cadastro local
// (lib/acesso.js). Por isso o cadastro de usuários daqui continua existindo — o
// que saiu de cena foi só a senha dele.
//
// Motor puro: nenhum import. Roda no edge (middleware) e no node.

export const CHAVE_NO_HUB = 'capacidade';

/**
 * Para onde mandar quem chegou sem sessão.
 *
 * Devolve null quando HUB_URL não está definida — e aí quem chama cai para a
 * porta local. É fail-SAFE de propósito, ao contrário do resto: sem a variável,
 * um deploy deixaria o app inacessível e sem como entrar para arrumar.
 *
 * O `dest` leva a pessoa de volta à página que ela pediu, depois do login no
 * Hub. É o mecanismo que já existia no token de SSO e não estava sendo usado:
 * um link antigo nos favoritos passa a funcionar, com um desvio pelo portal.
 */
export function enderecoDoHub(caminho) {
  const base = String(process.env.HUB_URL ?? '').trim().replace(/\/+$/, '');
  if (!base.startsWith('https://')) return null;

  const url = base + '/ir/' + CHAVE_NO_HUB;
  const dest = destinoLimpo(caminho);
  return dest ? url + '?dest=' + encodeURIComponent(dest) : url;
}

/**
 * O caminho que vale a pena guardar para depois do login.
 *
 * Só caminho interno, e nunca a própria tela de entrada — voltar para ela
 * depois de entrar seria um laço. A barra dupla é a pegadinha: o navegador lê
 * "//evil.com" como URL absoluta, e este valor termina numa query que o Hub vai
 * devolver assinada.
 */
export function destinoLimpo(caminho) {
  const d = typeof caminho === 'string' ? caminho : '';
  if (!d.startsWith('/') || d.startsWith('//') || d.startsWith('/\\')) return '';
  if (d.length > 400) return '';
  if (d === '/' || d.startsWith('/entrar') || d.startsWith('/sso')) return '';
  for (let i = 0; i < d.length; i += 1) {
    const c = d.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return '';
  }
  return d;
}

/**
 * A porta local está aberta?
 *
 * Fechada por padrão: só o Hub entra. ENTRADA_LOCAL=1 reabre a tela de senha
 * como ESCOTILHA — para o dia em que o Hub estiver fora do ar e alguém precisar
 * entrar aqui assim mesmo. Ligar exige mexer na Vercel e redeployar, o que é a
 * fricção certa para uma segunda porta que existe só para emergência.
 */
export function entradaLocalLigada() {
  return String(process.env.ENTRADA_LOCAL ?? '').trim() === '1';
}
