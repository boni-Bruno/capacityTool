import Link from 'next/link';

// Navegação única, usada pelo painel e pelas telas de cadastro.
//
// Antes eram duas: uma inline no layout dos cadastros e um link solto no
// rodapé do painel. Duas listas de link significam duas chances de uma tela
// nova entrar em uma e faltar na outra.
const TELAS = [
  { href: '/painel',             rotulo: 'Painel' },
  { href: '/cadastros/turnos',   rotulo: 'Horários dos turnos' },
  { href: '/cadastros/recursos', rotulo: 'Turnos do recurso' },
  { href: '/cadastros/paradas',  rotulo: 'Paradas planejadas' },
];

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/">☰ Menu</Link>
      <span className="nav-sep" />
      {TELAS.map((t) => (
        <Link key={t.href} href={t.href}>{t.rotulo}</Link>
      ))}
    </nav>
  );
}
