import { cookies } from 'next/headers';
import Sidebar from './sidebar';
import { COOKIE_TEMA, leTema } from '../lib/tema';
import { sessaoAtual } from '../lib/sessao';
import { gruposDoMenu } from '../lib/permissoes';

// Qual commit está de fato rodando. O Vercel preenche VERCEL_GIT_COMMIT_SHA no
// build; quando um build falha ele continua servindo o deploy anterior, e sem
// isso não há como saber daqui se a correção chegou a subir.
//
// Fica neste componente de servidor e desce como prop: variável de ambiente sem
// prefixo NEXT_PUBLIC_ não existe no bundle do cliente.
const versao = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);

// A sessão é lida AQUI, no servidor, e o menu desce já filtrado pelo que a
// pessoa pode ver. O cliente nunca recebe a lista inteira para esconder
// metade: o que ele não pode ver, ele não recebe.
export default async function Nav() {
  const tema = leTema(cookies().get(COOKIE_TEMA)?.value);
  const s = await sessaoAtual();
  const quem = s ? {
    tipo: s.tipo, nome: s.nome, login: s.login ?? null,
    cargo: s.tipo === 'nenhum' ? 'sem cadastro' : s.cargo,
  } : null;
  return <Sidebar versao={versao} tema={tema}
                  grupos={s ? gruposDoMenu(s.perms) : []} quem={quem} />;
}
