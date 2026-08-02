import Link from 'next/link';

// Navegação única, usada pelo painel e pelas telas de cadastro.
//
// Antes eram duas: uma inline no layout dos cadastros e um link solto no
// rodapé do painel. Duas listas de link significam duas chances de uma tela
// nova entrar em uma e faltar na outra.
const TELAS = [
  { href: '/painel',             rotulo: 'Painel' },
  { href: '/cadastros/turnos',   rotulo: 'Turnos' },
  { href: '/cadastros/recursos', rotulo: 'Turnos do recurso' },
  { href: '/cadastros/paradas',  rotulo: 'Paradas planejadas' },
];

// Qual commit está de fato rodando. O Vercel preenche VERCEL_GIT_COMMIT_SHA
// no build; quando um build falha ele continua servindo o deploy anterior, e
// sem isso não há como saber daqui se a correção chegou a subir.
const versao = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/">☰ Menu</Link>
      <span className="nav-sep" />
      {TELAS.map((t) => (
        <Link key={t.href} href={t.href}>{t.rotulo}</Link>
      ))}
      <span className="nav-versao" title="Commit que está rodando">{versao}</span>
    </nav>
  );
}
