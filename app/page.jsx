import Link from 'next/link';
import Shell from './shell';

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

const ESTRUTURA = [
  {
    href: '/cadastros/plantas',
    titulo: 'Plantas',
    texto: 'As unidades fabris. Toda área pertence a uma planta.',
  },
  {
    href: '/cadastros/areas',
    titulo: 'Áreas',
    texto: 'Os setores de cada planta. A planta é escolhida na criação e não ' +
           'muda depois.',
  },
  {
    href: '/cadastros/recursos',
    titulo: 'Recursos',
    texto: 'As máquinas e postos. CC, CT e Patrimônio identificam o ' +
           'equipamento na controladoria.',
  },
  {
    href: '/cadastros/turnos',
    titulo: 'Turnos',
    texto: 'Criar e excluir turnos, e definir início e fim de cada um por dia ' +
           'da semana. Turno novo nasce com a semana zerada.',
  },
  {
    href: '/cadastros/calendarios',
    titulo: 'Calendários',
    texto: 'Os dias em que cada linha trabalha: turnos por dia da semana, ' +
           'feriados e paradas, e a contagem de dias úteis do ano.',
  },
];

const CADASTRAR = [
  {
    href: '/cadastros/turnos-do-recurso',
    titulo: 'Turnos do recurso',
    texto: 'Quais turnos cada recurso roda em cada mês, e o regime de dias ' +
           '(rodízio ou padrão).',
  },
  {
    href: '/cadastros/oee',
    titulo: 'OEE',
    texto: 'O rendimento que transforma capacidade planejada em disponível, ' +
           'mês a mês. Setup já está embutido aqui.',
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
    <Shell>
      <header className="menu-topo">
        <h1 className="menu-marca">Capacidade</h1>
        <p className="menu-sub">Planejamento de capacidade fabril</p>
      </header>

      <h2 className="menu-secao">Consultar</h2>
      <div className="menu-grade">
        {CONSULTAR.map((c) => <Cartao key={c.href} {...c} />)}
      </div>

      <h2 className="menu-secao">Estrutura</h2>
      <div className="menu-grade">
        {ESTRUTURA.map((c) => <Cartao key={c.href} {...c} />)}
      </div>

      <h2 className="menu-secao">Planejamento</h2>
      <div className="menu-grade">
        {CADASTRAR.map((c) => <Cartao key={c.href} {...c} />)}
      </div>

      <p className="rodape">
        Ainda não têm tela: tipos de parada e conversão de minutos para
        peças ou metros. Usuários com perfil e escopo por área entram quando a
        segunda pessoa começar a mexer.
      </p>
    </Shell>
  );
}
