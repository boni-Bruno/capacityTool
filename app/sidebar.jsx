'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Menu lateral com grupos expansíveis.
//
// Era uma barra horizontal, e com nove telas ela já quebrava em duas linhas.
// Na lateral cabe agrupado, e o grupo da tela aberta já vem expandido — quem
// está em Áreas quase sempre vai para Recursos em seguida.

const GRUPOS = [
  {
    nome: 'Estrutura',
    itens: [
      { href: '/cadastros/plantas',     rotulo: 'Plantas' },
      { href: '/cadastros/areas',       rotulo: 'Áreas' },
      { href: '/cadastros/recursos',    rotulo: 'Recursos' },
      { href: '/cadastros/calendarios', rotulo: 'Calendários' },
    ],
  },
  {
    nome: 'Planejamento',
    itens: [
      { href: '/cadastros/turnos',            rotulo: 'Turnos' },
      { href: '/cadastros/turnos-do-recurso', rotulo: 'Turnos do recurso' },
      { href: '/cadastros/oee',               rotulo: 'OEE' },
      { href: '/cadastros/paradas',           rotulo: 'Paradas' },
    ],
  },
];

export default function Sidebar({ versao }) {
  const caminho = usePathname();

  // O grupo da tela aberta nasce expandido; os outros, fechados.
  const [abertos, setAbertos] = useState(() =>
    new Set(GRUPOS.filter((g) => g.itens.some((i) => i.href === caminho))
                  .map((g) => g.nome)));
  const [aberto, setAberto] = useState(false);   // gaveta no celular

  // Retraído x expandido.
  //
  // A tela inicial nasce sempre expandida — ali o menu é o conteúdo. Nas
  // outras vale o que ficou guardado da última vez, e recolhido é o padrão
  // de quem ainda não escolheu: quem está trabalhando quer a largura.
  //
  // Começa expandido no primeiro render e o localStorage entra no efeito: ler
  // no useState daria HTML diferente no servidor e no cliente.
  const inicial = caminho === '/';
  const [expandido, setExpandido] = useState(true);

  useEffect(() => {
    if (inicial) { setExpandido(true); return; }
    setExpandido(localStorage.getItem('menu-expandido') !== 'nao');
  }, [inicial]);

  function alternaLargura() {
    setExpandido((v) => {
      const novo = !v;
      // A escolha vale para as telas de trabalho; a inicial ignora e abre.
      localStorage.setItem('menu-expandido', novo ? 'sim' : 'nao');
      return novo;
    });
  }

  const alterna = (nome) => setAbertos((s) => {
    const novo = new Set(s);
    if (novo.has(nome)) novo.delete(nome); else novo.add(nome);
    return novo;
  });

  const ativo = (href) => (caminho === href ? ' lado-ativo' : '');

  return (
    <>
      <button className="lado-abrir" onClick={() => setAberto((v) => !v)}
              aria-label="Menu">
        ☰
      </button>

      <nav className={'lado' + (aberto ? ' lado-visivel' : '')
                             + (expandido ? '' : ' lado-estreito')}
           onClick={() => setAberto(false)}>
        <div className="lado-topo">
          <p className="lado-marca">{expandido ? 'Capacidade' : ''}</p>
          <button
            className="lado-retrair"
            title={expandido ? 'Recolher menu' : 'Expandir menu'}
            aria-label={expandido ? 'Recolher menu' : 'Expandir menu'}
            onClick={(e) => { e.stopPropagation(); alternaLargura(); }}
          >
            {expandido ? '«' : '»'}
          </button>
        </div>

        <Link href="/" className={'lado-item lado-iniciar' + ativo('/')}
              title="Iniciar">
          {expandido ? '☰ Iniciar' : '☰'}
        </Link>
        <Link href="/painel" className={'lado-item' + ativo('/painel')}
              title="Painel">
          {expandido ? 'Painel' : '▤'}
        </Link>

        {expandido && GRUPOS.map((g) => {
          // Nome próprio: `expandido` acima é a largura do menu, este é o
          // grupo. Reaproveitar o nome escondia um do outro.
          const grupoAberto = abertos.has(g.nome);
          return (
            <div key={g.nome} className="lado-grupo">
              <button
                className="lado-cab"
                aria-expanded={grupoAberto}
                // stopPropagation: o clique no cabeçalho expande, não fecha a
                // gaveta do celular como faz o clique num link.
                onClick={(e) => { e.stopPropagation(); alterna(g.nome); }}
              >
                <span className={'lado-seta' + (grupoAberto ? ' lado-seta-baixo' : '')}>
                  ▸
                </span>
                {g.nome}
              </button>

              {grupoAberto && (
                <div className="lado-filhos">
                  {g.itens.map((i) => (
                    <Link key={i.href} href={i.href}
                          className={'lado-item' + ativo(i.href)}>
                      {i.rotulo}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {expandido && (
          <span className="lado-versao" title="Commit que está rodando">{versao}</span>
        )}
      </nav>

      {/* Fundo escuro só existe no celular, para fechar a gaveta ao tocar fora. */}
      {aberto && <div className="lado-fundo" onClick={() => setAberto(false)} />}
    </>
  );
}
