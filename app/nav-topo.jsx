import Link from 'next/link';

// Entrada para os cadastros, no topo do painel.
//
// Antes isto era um link no rodapé do último painel — que só aparecia quando
// já existia cálculo rodado. Sem execução no banco a página retorna antes e
// não havia como chegar nas telas de cadastro a não ser digitando a URL.
export default function NavTopo() {
  return (
    <nav className="nav">
      <Link href="/cadastros/turnos">Horários dos turnos</Link>
      <Link href="/cadastros/recursos">Turnos do recurso</Link>
      <Link href="/cadastros/paradas">Paradas planejadas</Link>
    </nav>
  );
}
