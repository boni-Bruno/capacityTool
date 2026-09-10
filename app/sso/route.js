import { NextResponse } from 'next/server';

import { token } from '../../lib/token';
import { assina, verifica } from '../../lib/jwt';
import { queimaJti } from '../../lib/sso-jti';
import { caminhoInterno, escapaHtml } from '../../lib/sso';

// PORTA DE ENTRADA VINDA DO HUB S&OP.
//
// E o arquivo mais exposto deste repositorio: fica FORA do middleware, e atingido
// sem cookie nenhum e esta aberto na internet. Por isso tudo aqui falha fechado,
// ao contrario de middleware.js e sessao.js, que abrem o app quando APP_SENHA e
// vazia — aquilo e conveniencia de maquina local, e aqui seria porta escancarada.
//
// O que esta rota NAO faz: inventar modelo de sessao. Ela confere o token do Hub
// e emite exatamente o mesmo cookie cap_sessao que /api/entrar emite. Do
// middleware e do exigeSessao() para baixo, nada muda e nada sabe que o Hub
// existe. E essa propriedade que mantem a mudanca pequena.
//
// A CONTRAPARTIDA, dita sem maquiagem: passa a haver DUAS credenciais de topo.
// Quem tem a APP_SENHA entra; quem tem o SSO_SEGREDO entra. Nao ha como fazer SSO
// sem criar essa equivalencia. O que ela nao faz e enfraquecer o que ja existe: o
// cookie e o mesmo, com os mesmos atributos, e as rotas de escrita mantem a mesma
// tranca.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUDIENCIA = 'capacidade';
const EMISSOR = 'hub-snop';

// 24 h, e nao os 30 dias de /api/entrar.
//
// Quem entra pelo Hub tem uma conta que pode ser bloqueada la; o cookie daqui e o
// mesmo valor para todo mundo e nao sabe de quem e, entao bloquear alguem so tem
// efeito de verdade quando o cookie vence. Trinta dias fariam a revogacao ser
// teorica. Quem entra pela senha continua com os 30 dias de sempre — la nao ha
// conta para revogar.
const VIDA_COOKIE = 60 * 60 * 24;

// Em GET o token viajaria na URL: historico do navegador, Referer same-origin e
// log de requisicao da Vercel, que guarda o path COM query. Recusar tambem impede
// que prefetch ou crawler queimem um jti valido.
export async function GET() {
  return new NextResponse('Entre pelo portal.', {
    status: 405,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function POST(req) {
  const segredo = process.env.SSO_SEGREDO;
  if (!segredo) {
    // O log aqui existe porque a falta dele ja custou caro uma vez: a primeira
    // entrada pelo Hub devolveu 401 em silencio, e descobrir o motivo exigiu
    // deduzir por eliminacao qual dos caminhos de recusa nao registra nada.
    // Dizer isto no log do servidor nao entrega nada a quem esta do outro lado —
    // a tela continua mostrando a mesma frase generica.
    console.error('SSO recusado: SSO_SEGREDO ausente neste ambiente.');
    return recusa('O SSO nao esta configurado neste ambiente.');
  }

  let bruto = '';
  try {
    const form = await req.formData();
    bruto = String(form.get('t') ?? '');
  } catch {
    return recusa('Requisicao invalida.');
  }

  const r = await verifica(bruto, segredo, { aud: AUDIENCIA, iss: EMISSOR });
  if (!r.ok) {
    // O motivo vai para o log e nao para a tela: dizer ao visitante se foi
    // assinatura ou validade e entregar de graca um oraculo de teste.
    console.error('SSO recusado:', r.motivo);
    return recusa('Link de acesso invalido ou vencido. Volte ao portal e tente de novo.');
  }

  // So agora o jti toca o banco. Antes de a assinatura conferir, ele e dado do
  // atacante, e grava-lo deixaria qualquer um encher a tabela de fora.
  if (!await queimaJti(r.claims.jti, r.claims.exp)) {
    return recusa('Este link ja foi usado. Volte ao portal e abra de novo.');
  }

  // O destino sai do token ASSINADO, nunca do formulario — do formulario seria um
  // redirecionamento aberto controlado por quem monta a requisicao.
  const res = paginaDeSalto(caminhoInterno(r.claims.dest));

  const senha = process.env.APP_SENHA;
  if (senha) {
    // Identico ao /api/entrar, com uma unica diferenca deliberada no maxAge.
    // Nada de SameSite=None: Lax e a unica defesa de CSRF que as rotas de escrita
    // tem hoje, e afrouxa-lo aqui abriria todas elas de uma vez.
    res.cookies.set('cap_sessao', await token(senha), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: VIDA_COOKIE,
    });

    // Cookie separado que NAO autentica: quem decide acesso continua sendo o
    // cap_sessao. Este so carimba QUEM e a pessoa, para a tela poder dizer o nome
    // dela e, mais adiante, para a auditoria por pessoa nascer sem migrar o
    // schema do dominio.
    //
    // Ele nao carrega papel. O Hub responde uma pergunta so — esta pessoa pode
    // abrir esta ferramenta? — e o papel DENTRO da Capacidade, quando existir, sai
    // do banco daqui e nao de um token assinado la fora. Papel vindo de fora seria
    // um vocabulario que o Hub teria de conhecer e manter sincronizado com cada
    // ferramenta, e nenhuma tela chegou a ler o valor que ele mandava.
    const agora = Math.floor(Date.now() / 1000);
    res.cookies.set('cap_usuario', await assina({
      iss: EMISSOR,
      aud: 'capacidade-identidade',
      sub: r.claims.sub,
      email: r.claims.email,
      nome: r.claims.nome,
      jti: r.claims.jti,
      iat: agora,
      exp: agora + VIDA_COOKIE,
    }, segredo), {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: VIDA_COOKIE,
    });
  }
  // Sem APP_SENHA o app e aberto de proposito (mesma regra do middleware). Nao da
  // para derivar cookie de senha que nao existe, e token(undefined) criaria um
  // valor que so esta rota reconheceria.

  return res;
}

function paginaDeSalto(destino) {
  // HTML 200 em vez de 302, de proposito.
  //
  // Num 302, a navegacao seguinte ainda e consequencia de um POST vindo de OUTRO
  // site. Se o navegador considerar a cadeia de redirecionamento ao avaliar o
  // SameSite — no Chrome isso e a flag CookieSameSiteConsidersRedirectChain, hoje
  // desligada, mas e uma flag que existe —, o cap_sessao recem-emitido nao
  // acompanharia o GET e a pessoa cairia em /entrar logo depois de logar.
  //
  // Saindo daqui por meta refresh, quem inicia a navegacao e este proprio
  // dominio: same-site em qualquer navegador, com qualquer politica de cadeia, e
  // sem depender de JavaScript.
  const alvo = escapaHtml(destino);
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Entrando...</title>'
    + '<meta http-equiv="refresh" content="0; url=' + alvo + '">'
    + '</head><body style="font-family:system-ui;padding:2rem">'
    + '<p>Entrando... <a href="' + alvo + '">continuar</a></p>'
    + '</body></html>';

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-robots-tag': 'noindex',
    },
  });
}

function recusa(mensagem) {
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
    + '<title>Acesso negado</title></head>'
    + '<body style="font-family:system-ui;padding:2rem">'
    + '<p>' + escapaHtml(mensagem) + '</p>'
    + '<p><a href="/entrar">Entrar com a senha</a></p>'
    + '</body></html>';

  return new NextResponse(html, {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
