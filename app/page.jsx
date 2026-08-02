import Link from 'next/link';

// Menu. É a porta de entrada do app, então não consulta o banco de propósito:
// se a DATABASE_URL cair, esta tela ainda abre e explica onde ir. Uma landing
// page que depende do banco falha justamente na hora em que você precisa dela.

const CONSULTAR = [
  {
    href: '/painel',
    titulo: 'Painel de capacidade',
    texto: 'Instalada, planejada e disponível por área e ano. Gráfico mensal, ' +
           'tabela por recurso e o botão de recalcular.',
  },
];

const CADASTRAR = [
  {
    href: '/cadastros/estrutura',
    titulo: 'Planta, área e recurso',
    texto: 'A estrutura física. Cada área pertence a uma planta, cada recurso ' +
           'a uma área. CC, CT e Patrimônio identificam a máquina.',
  },
  {
    href: '/cadastros/recursos',
    titulo: 'Turnos do recurso',
    texto: 'Quais turnos cada recurso roda, e a partir de quando. É o que o ' +
           'gestor de área mexe com mais frequência.',
  },
  {
    href: '/cadastros/turnos',
    titulo: 'Turnos',
    texto: 'Criar e excluir turnos, e definir início e fim de cada um por dia ' +
           'da semana. Turno novo nasce com a semana zerada.',
  },
  {
    href: '/cadastros/paradas',
    titulo: 'Paradas planejadas',
    texto: 'Preventiva, preditiva, férias coletivas, obra e inventário. ' +
           'Muda toda semana.',
  },
];

function Cartao({ href, titulo, texto }) {
  return (
    <Link href={href} className="menu-card">
      <span className="menu-card-tit">{titulo}</span>
      <span className="menu-card-txt">{texto}</span>
    </Link>
  );
}

export default function Menu() {
  return (
    <div className="wrap">
      <header className="menu-topo">
        <h1 className="menu-marca">Capacidade</h1>
        <p className="menu-sub">Planejamento de capacidade fabril</p>
      </header>

      <h2 className="menu-secao">Consultar</h2>
      <div className="menu-grade">
        {CONSULTAR.map((c) => <Cartao key={c.href} {...c} />)}
      </div>

      <h2 className="menu-secao">Cadastrar</h2>
      <div className="menu-grade">
        {CADASTRAR.map((c) => <Cartao key={c.href} {...c} />)}
      </div>

      <p className="rodape">
        Ainda não têm tela: calendários, OEE e feriados — hoje são cadastrados
        direto no banco. Usuários com perfil e escopo por área entram quando a
        segunda pessoa começar a mexer.
      </p>
    </div>
  );
}
