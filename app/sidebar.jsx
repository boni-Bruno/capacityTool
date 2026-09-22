'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BotaoTema from './tema';
import Sair from './sair';

// Menu lateral com grupos expansíveis.
//
// Era uma barra horizontal, e com nove telas ela já quebrava em duas linhas.
// Na lateral cabe agrupado, e o grupo da tela aberta já vem expandido — quem
// está em Áreas quase sempre vai para Recursos em seguida.

// Os grupos e as telas vêm de lib/permissoes.js, filtrados pelo que a pessoa
// pode ver: menu e permissão nascem da mesma lista, e não de duas cópias que
// divergiriam na primeira tela nova. A home (app/page.jsx) lê a mesma lista.

export default function Sidebar({ versao, tema, grupos = [], quem = null }) {
  const caminho = usePathname();

  // Todos os grupos nascem abertos: com dois grupos e oito telas, tudo cabe
  // na altura da janela, e esconder metade só acrescentava um clique para
  // chegar em qualquer lugar.
  const [abertos, setAbertos] = useState(() => new Set(grupos.map((g) => g.nome)));
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

        {/* O único link fora de grupo, e ele é a saída para tudo: a tela
            inicial é o menu inteiro em cartões. Com o menu recolhido, é por
            aqui que se chega em qualquer lugar — os grupos só aparecem
            expandidos, e um atalho solto para uma tela só privilegiaria uma
            delas sem critério. */}
        <Link href="/" className={'lado-item lado-iniciar' + ativo('/')}
              title="Iniciar">
          {expandido ? '☰ Iniciar' : '☰'}
        </Link>

        {expandido && grupos.map((g) => {
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

        {/* Quem está na sessão, com o cargo, e a saída. Fica acima do tema:
            é o que se olha para saber se entrou com o usuário certo. */}
        {quem && expandido && (
          <div className="lado-quem" onClick={(e) => e.stopPropagation()}>
            <span className="lado-nome" title={quem.login ?? ''}>{quem.nome}</span>
            <span className="lado-cargo">{quem.cargo}</span>
            <span className="lado-acoes">
              {quem.tipo === 'usuario' && (
                <Link href="/trocar-senha" className="lado-mini">senha</Link>
              )}
              <Sair className="lado-mini lado-sair" />
            </span>
          </div>
        )}

        {/* O tema fica no rodapé do menu, longe do que se clica todo dia:
            é uma escolha que se faz uma vez. */}
        <div className="lado-rodape">
          <BotaoTema tema={tema} />
          {expandido && (
            <span className="lado-versao" title="Commit que está rodando">
              {versao}
            </span>
          )}
        </div>
      </nav>

      {/* Fundo escuro só existe no celular, para fechar a gaveta ao tocar fora. */}
      {aberto && <div className="lado-fundo" onClick={() => setAberto(false)} />}
    </>
  );
}
