'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  OPERADORES, ehLista, ehTexto, escreveFiltro, leFiltro,
} from '../../lib/filtro';

// O botãozinho de filtro de uma coluna, e o painel que ele abre.
//
// O MESMO CONTROLE NOS DOIS LUGARES: no cabeçalho da coluna e na barra de cima.
// Os dois escrevem o mesmo parâmetro da URL (`f_<campo>`), então não existe
// "filtrei ali e aqui continua aberto" — é um estado só, visto de dois lugares.
//
// A LISTA DE VALORES vem do que existe na tela, não de um cadastro: filtrar por
// um valor que ninguém tem devolveria vazio sem explicar por quê. Quando são
// muitos, a busca dentro do painel resolve; a rolagem sozinha não.
//
// Só aplica ao fechar. Recortar a cada clique num painel de vinte caixas seria
// vinte idas ao servidor para chegar onde a pessoa queria de uma vez.

export default function FiltroColuna({
  campo, rotulo, valores = [], compacto = false,
}) {
  const router = useRouter();
  const params = useSearchParams();
  const chave = `f_${campo}`;

  const atual = leFiltro(params.get(chave));
  const [aberto, setAberto] = useState(false);
  const [op, setOp] = useState(atual?.op ?? 'in');
  const [marcados, setMarcados] = useState(() => new Set(atual?.valores ?? []));
  const [texto, setTexto] = useState(
    atual && ehTexto(atual.op) ? (atual.valores?.[0] ?? '') : '');
  const [busca, setBusca] = useState('');
  const caixa = useRef(null);

  // Reabrir tem que mostrar o que está valendo, e não o que ficou do rascunho
  // anterior: filtro que parece uma coisa e recorta outra é o pior defeito
  // possível numa barra de filtros.
  function abre() {
    const f = leFiltro(params.get(chave));
    setOp(f?.op ?? 'in');
    setMarcados(new Set(f && ehLista(f.op) ? f.valores : []));
    setTexto(f && ehTexto(f.op) ? (f.valores?.[0] ?? '') : '');
    setBusca('');
    setAberto(true);
  }

  function navega(valor) {
    const p = new URLSearchParams(params.toString());
    if (valor) p.set(chave, valor); else p.delete(chave);
    // Trocar o recorte pode tirar da seleção o recurso em foco, e o período
    // aberto era do conjunto antigo.
    p.delete('recurso');
    setAberto(false);
    router.push(`?${p.toString()}`);
  }

  function aplica() {
    if (op === 'vazio' || op === 'nvazio') return navega(`${op}:`);
    const vals = ehTexto(op) ? [texto.trim()].filter(Boolean) : [...marcados];
    if (!vals.length) return navega(null);
    return navega(escreveFiltro({ op, valores: vals }));
  }

  const visiveis = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const lista = b
      ? valores.filter((v) => String(v).toLowerCase().includes(b))
      : valores;
    return lista.slice(0, 300);
  }, [valores, busca]);

  const ligado = Boolean(atual);

  return (
    <span className="filtro-col" ref={caixa}>
      <button type="button"
              className={`filtro-btn ${ligado ? 'filtro-on' : ''}`}
              title={ligado ? `Filtrando ${rotulo}` : `Filtrar ${rotulo}`}
              onClick={() => (aberto ? setAberto(false) : abre())}>
        ▼
      </button>

      {aberto && (
        <>
          {/* A cortina fecha ao clicar fora sem prender o foco: o painel é uma
              escolha rápida, não um formulário. */}
          <span className="filtro-cortina" onClick={() => setAberto(false)} />

          <div className={`filtro-painel ${compacto ? 'filtro-painel-cima' : ''}`}>
            <p className="campo-rot" style={{ marginBottom: 6 }}>{rotulo}</p>

            <select value={op} onChange={(e) => setOp(e.target.value)}>
              {OPERADORES.map((o) => (
                <option key={o.codigo} value={o.codigo}>{o.nome}</option>
              ))}
            </select>

            {ehTexto(op) && (
              <input type="text" value={texto} autoFocus
                     placeholder="digite o trecho"
                     style={{ marginTop: 8, width: '100%' }}
                     onChange={(e) => setTexto(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && aplica()} />
            )}

            {ehLista(op) && (
              <>
                {valores.length > 8 && (
                  <input type="text" value={busca} placeholder="procurar…"
                         style={{ marginTop: 8, width: '100%' }}
                         onChange={(e) => setBusca(e.target.value)} />
                )}
                <div className="filtro-lista">
                  {visiveis.map((v) => (
                    <label key={v} className="filtro-item">
                      <input type="checkbox" checked={marcados.has(v)}
                             onChange={() => setMarcados((m) => {
                               const novo = new Set(m);
                               if (novo.has(v)) novo.delete(v); else novo.add(v);
                               return novo;
                             })} />
                      <span>{v}</span>
                    </label>
                  ))}
                  {!visiveis.length && (
                    <p className="muted" style={{ fontSize: 12, margin: 4 }}>
                      nada com esse texto
                    </p>
                  )}
                  {valores.length > 300 && !busca && (
                    <p className="muted" style={{ fontSize: 12, margin: 4 }}>
                      mostrando 300 de {valores.length} — use a busca
                    </p>
                  )}
                </div>
                <div className="acoes" style={{ marginTop: 6 }}>
                  <button type="button" className="btn btn-mini"
                          onClick={() => setMarcados(new Set(visiveis))}>
                    marcar visíveis
                  </button>
                  <button type="button" className="btn btn-mini"
                          onClick={() => setMarcados(new Set())}>
                    limpar
                  </button>
                </div>
              </>
            )}

            <div className="acoes" style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-mini btn-primario"
                      onClick={aplica}>
                Aplicar
              </button>
              {ligado && (
                <button type="button" className="btn btn-mini"
                        onClick={() => navega(null)}>
                  Tirar filtro
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </span>
  );
}
