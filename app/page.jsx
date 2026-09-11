import Link from 'next/link';
import Shell from './shell';

// Menu. É a porta de entrada do app, então não consulta o banco de propósito:
// se a DATABASE_URL cair, esta tela ainda abre e explica onde ir. Uma landing
// page que depende do banco falha justamente na hora em que você precisa dela.

const CONSULTAR = [
  {
    href: '/painel',
    titulo: 'Painel da Capacidade',
    texto: 'Quanto cabe: instalada, planejada e disponível por área e ano, em ' +
           'minuto, hora, metro ou peça. Gráfico mensal e tabela por recurso.',
  },
  {
    href: '/ocupacao',
    titulo: 'Painel da Ocupação',
    texto: 'Cabe? A capacidade contra a demanda do plano, em minuto — barras ' +
           'de capacidade com a demanda em linha por cima.',
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

const CONVERSAO = [
  {
    href: '/cadastros/demanda',
    titulo: 'Demanda',
    texto: 'A base orçada importada da controladoria. É ela que diz quanto de ' +
           'cada centro de trabalho o plano pede, e em que ritmo.',
  },
  {
    href: '/cadastros/de-para',
    titulo: 'DE/PARA',
    texto: 'A lingua da base traduzida para a da empresa: rotulos e ' +
           'agrupamentos por regra, com a previa de quanto cada uma pega.',
  },
  {
    href: '/cadastros/mix',
    titulo: 'Ajuste de mix',
    texto: 'O mix calculado da carga, ajustavel a mao por CT e mes. Onde ' +
           'existe ajuste, ele ganha da base — e importar nao mexe nele.',
  },
];

const EXTRACAO = [
  {
    href: '/cadastros/extracao-ap',
    titulo: 'Extração para o AP',
    texto: 'A capacidade calculada em .csv — CT, período AAAA.MM e minutos, ' +
           'condensada por mês, com prévia antes de baixar.',
  },
  {
    href: '/cadastros/extracao-config',
    titulo: 'Extração das configurações',
    texto: 'Como a fábrica está configurada num recorte, e quanta capacidade ' +
           'isso produz. Em .pptx dentro do seu modelo, ou em PDF.',
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

      <h2 className="menu-secao">Estrutura da empresa</h2>
      <div className="menu-grade">
        {ESTRUTURA.map((c) => <Cartao key={c.href} {...c} />)}
      </div>

      <h2 className="menu-secao">Planejamento da capacidade</h2>
      <div className="menu-grade">
        {CADASTRAR.map((c) => <Cartao key={c.href} {...c} />)}
      </div>

      <h2 className="menu-secao">Conversão da capacidade</h2>
      <div className="menu-grade">
        {CONVERSAO.map((c) => <Cartao key={c.href} {...c} />)}
      </div>

      <h2 className="menu-secao">Extração</h2>
      <div className="menu-grade">
        {EXTRACAO.map((c) => <Cartao key={c.href} {...c} />)}
      </div>

      <p className="rodape">
        Ainda não têm tela: tipos de parada. Usuários com perfil e escopo por
        área entram quando a segunda pessoa começar a mexer.
      </p>
    </Shell>
  );
}
