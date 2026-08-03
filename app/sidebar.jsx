'use client';

import { useState } from 'react';
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

      <nav className={'lado' + (aberto ? ' lado-visivel' : '')}
           onClick={() => setAberto(false)}>
        <p className="lado-marca">Capacidade</p>

        <Link href="/" className={'lado-item lado-iniciar' + ativo('/')}>
          ☰ Iniciar
        </Link>
        <Link href="/painel" className={'lado-item' + ativo('/painel')}>
          Painel
        </Link>

        {GRUPOS.map((g) => {
          const expandido = abertos.has(g.nome);
          return (
            <div key={g.nome} className="lado-grupo">
              <button
                className="lado-cab"
                aria-expanded={expandido}
                // stopPropagation: o clique no cabeçalho expande, não fecha a
                // gaveta do celular como faz o clique num link.
                onClick={(e) => { e.stopPropagation(); alterna(g.nome); }}
              >
                <span className={'lado-seta' + (expandido ? ' lado-seta-baixo' : '')}>
                  ▸
                </span>
                {g.nome}
              </button>

              {expandido && (
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

        <span className="lado-versao" title="Commit que está rodando">{versao}</span>
      </nav>

      {/* Fundo escuro só existe no celular, para fechar a gaveta ao tocar fora. */}
      {aberto && <div className="lado-fundo" onClick={() => setAberto(false)} />}
    </>
  );
}
