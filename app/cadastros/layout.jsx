import Link from 'next/link';

export default function CadastrosLayout({ children }) {
  return (
    <div className="wrap">
      <nav className="nav">
        <Link href="/">← Painel</Link>
        <span className="nav-sep" />
        <Link href="/cadastros/turnos">Horários dos turnos</Link>
        <Link href="/cadastros/recursos">Turnos do recurso</Link>
        <Link href="/cadastros/paradas">Paradas planejadas</Link>
      </nav>
      {children}
    </div>
  );
}
