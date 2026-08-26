import { cookies } from 'next/headers';
import Sidebar from './sidebar';
import { COOKIE_TEMA, leTema } from '../lib/tema';

// Qual commit está de fato rodando. O Vercel preenche VERCEL_GIT_COMMIT_SHA no
// build; quando um build falha ele continua servindo o deploy anterior, e sem
// isso não há como saber daqui se a correção chegou a subir.
//
// Fica neste componente de servidor e desce como prop: variável de ambiente sem
// prefixo NEXT_PUBLIC_ não existe no bundle do cliente.
const versao = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);

export default function Nav() {
  const tema = leTema(cookies().get(COOKIE_TEMA)?.value);
  return <Sidebar versao={versao} tema={tema} />;
}
