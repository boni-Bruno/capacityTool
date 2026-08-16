'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ATRIBUTOS_ORIGEM, OPERADORES, podeSerCondicao, previa, valoresDe,
} from '../../../lib/regras';

// O editor de regras, com a prévia colada nele.
//
// A prévia não é enfeite e não é opcional: o modo de errar aqui é a regra pegar
// mais ou menos do que se imaginava, e isso não dá erro em lugar nenhum — vira
// um número torto no painel semanas depois. Por isso o contador anda a cada
// tecla, e por isso os valores vêm em lista em vez de campo livre.
//
// Roda inteiro no navegador sobre as combinações que a página mandou. Nenhuma
// ida ao banco até alguém clicar em gravar.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');
const horas = (min) => fmt(Math.round(Number(min ?? 0) / 60));

const REGRA_NOVA = (atributo, ordem) => ({
  id: null, atributo, rotulo: '', ordem, ativa: true, observacao: '',
  condicoes: [{ bloco: 1, atributo: 'linha_produto_agrupada', operador: '=', valor: '' }],
});

export default function Editor({ cargaId, cenario, combinacoes, atributos, regras }) {
  const router = useRouter();
  const [alvo, setAlvo] = useState(atributos[0]?.codigo ?? null);
  const [rascunho, setRascunho] = useState(null);   // a regra sendo editada
  const [novoAttr, setNovoAttr] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  const totalLinhas = useMemo(
    () => combinacoes.reduce((s, c) => s + Number(c.linhas ?? 0), 0), [combinacoes]);
  const totalMin = useMemo(
    () => combinacoes.reduce((s, c) => s + Number(c.minutos ?? 0), 0), [combinacoes]);

  // O que vale para o atributo aberto: as regras gravadas, com a que está sendo
  // editada substituída pelo rascunho. É o que faz o contador andar enquanto se
  // digita, sem gravar nada.
  const regrasAgora = useMemo(() => {
    const doAlvo = regras.filter((r) => r.atributo === alvo);
    if (!rascunho || rascunho.atributo !== alvo) return doAlvo;
    if (!rascunho.id) return [...doAlvo, { ...rascunho, id: -1 }];
    return doAlvo.map((r) => (r.id === rascunho.id ? rascunho : r));
  }, [regras, alvo, rascunho]);

  const todasAgora = useMemo(
    () => [...regras.filter((r) => r.atributo !== alvo), ...regrasAgora],
    [regras, alvo, regrasAgora]);

  const conta = useMemo(() => {
    if (!alvo) return null;
    return previa(combinacoes, atributos, todasAgora, alvo);
  }, [combinacoes, atributos, todasAgora, alvo]);

  const porId = useMemo(
    () => new Map((conta?.porRegra ?? []).map((p) => [p.id, p])), [conta]);

  // Quem pode ser condição deste atributo: origem sempre, derivado só de nível
  // menor. É a regra que torna ciclo impossível, e ela vale já na tela.
  const condicionaveis = useMemo(() => {
    if (!alvo) return ATRIBUTOS_ORIGEM;
    const derivados = atributos
      .filter((a) => podeSerCondicao(a.codigo, alvo, atributos))
      .map((a) => ({ codigo: a.codigo, nome: `${a.nome} (nível ${a.nivel})` }));
    return [...ATRIBUTOS_ORIGEM, ...derivados];
  }, [atributos, alvo]);

  async function chamar(metodo, corpo) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/de-para', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      router.refresh();
      return j;
    } catch (e) {
      setErro(e.message ?? 'Falhou');
      return null;
    } finally {
      setOcupado(false);
    }
  }

  const mexe = (mut) => setRascunho((r) => {
    const novo = { ...r, condicoes: r.condicoes.map((c) => ({ ...c })) };
    mut(novo);
    return novo;
  });

  const attrAtual = atributos.find((a) => a.codigo === alvo);

  return (
    <>
      {erro && <p className="erro">{erro}</p>}

      <div className="painel">
        <div className="kpis">
          <div className="kpi">
            <p className="rot">Combinações</p>
            <p className="val">{fmt(combinacoes.length)}</p>
            <p className="sub">
              de {fmt(totalLinhas)} linhas · é sobre elas que a regra roda
            </p>
          </div>
          <div className="kpi">
            <p className="rot">Demanda da carga</p>
            <p className="val">{horas(totalMin)} h</p>
            <p className="sub">{cenario}</p>
          </div>
          {conta && (
            <div className="kpi">
              <p className="rot">Ainda sem regra</p>
              <p className="val">{horas(conta.semRegra.minutos)} h</p>
              <p className="sub">
                {fmt(conta.semRegra.linhas)} linhas ·{' '}
                {totalMin ? (conta.semRegra.minutos * 100 / totalMin).toFixed(1) : '0,0'}%
                {' '}da carga — elas continuam no painel, com o valor de origem
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- os atributos derivados ---------------------------------------- */}
      <div className="painel">
        <h2>Atributos</h2>
        <p className="rodape">
          Cada atributo é um corte pelo qual a capacidade vai poder ser lida. O{' '}
          <strong>nível</strong> diz quem enxerga quem: uma regra só usa como
          condição um atributo de origem ou um derivado de nível menor. É o que
          impede regra circular — não por detecção, mas por construção.
        </p>

        <div className="chips">
          {atributos.map((a) => (
            <button key={a.codigo} type="button"
                    className={`chip ${a.codigo === alvo ? 'chip-on' : ''}`}
                    onClick={() => { setAlvo(a.codigo); setRascunho(null); }}>
              {a.nome}
              <span className="muted"> · nível {a.nivel} · {a.regras} regras</span>
            </button>
          ))}
          <button type="button" className="chip"
                  onClick={() => setNovoAttr({ codigo: '', nome: '', nivel: 1, ordem: 1 })}>
            + novo atributo
          </button>
        </div>

        {novoAttr && (
          <form className="linha-form" onSubmit={async (e) => {
            e.preventDefault();
            const j = await chamar('POST', { acao: 'atributo', ...novoAttr });
            // Abre o atributo recém-criado: quem acabou de criar um corte quer
            // escrever a primeira regra dele, não voltar para uma lista.
            if (j) { setAlvo(j.codigo); setNovoAttr(null); }
          }}>
            <label className="campo">
              <span className="campo-rot">Nome</span>
              <input value={novoAttr.nome} required
                     placeholder="Linha comercial"
                     onChange={(e) => setNovoAttr({
                       ...novoAttr,
                       nome: e.target.value,
                       // O código acompanha o nome enquanto ninguém mexer nele:
                       // dois campos para digitar a mesma coisa é um a mais.
                       codigo: novoAttr.tocou ? novoAttr.codigo
                         : e.target.value.toLowerCase().normalize('NFD')
                             .replace(/[\u0300-\u036f]/g, '')
                             .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
                     })} />
            </label>
            <label className="campo">
              <span className="campo-rot">Código</span>
              <input value={novoAttr.codigo} required
                     onChange={(e) => setNovoAttr({
                       ...novoAttr, codigo: e.target.value, tocou: true })} />
            </label>
            <label className="campo">
              <span className="campo-rot">Nível</span>
              <input type="number" min="1" max="9" value={novoAttr.nivel}
                     onChange={(e) => setNovoAttr({
                       ...novoAttr, nivel: Number(e.target.value) })} />
            </label>
            <button type="submit" className="btn btn-primario"
                    disabled={ocupado}>Criar</button>
            <button type="button" className="btn"
                    onClick={() => setNovoAttr(null)}>Cancelar</button>
          </form>
        )}
      </div>

      {/* --- as regras do atributo aberto ----------------------------------- */}
      {attrAtual && conta && (
        <div className="painel">
          <h2>
            Regras de {attrAtual.nome}
            <span className="muted" style={{ fontWeight: 400 }}>
              {' '}· a primeira que casa ganha
            </span>
          </h2>

          <table className="tabela-mes">
            <thead>
              <tr>
                <th style={{ width: '3rem' }}>#</th>
                <th>Vira</th>
                <th>Quando</th>
                <th className="num">Linhas</th>
                <th className="num">Horas</th>
                <th className="num">%</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {regrasAgora.map((r) => {
                const p = porId.get(r.id) ?? { linhas: 0, minutos: 0 };
                return (
                  <tr key={r.id} className={r.ativa === false ? 'muted' : ''}>
                    <td>{r.ordem}</td>
                    <td><strong>{r.rotulo || <span className="muted">sem rótulo</span>}</strong></td>
                    <td className="muted">{descreve(r, atributos)}</td>
                    <td className="num">{fmt(p.linhas)}</td>
                    <td className="num">{horas(p.minutos)}</td>
                    <td className="num">
                      {totalMin ? (p.minutos * 100 / totalMin).toFixed(1) : '0,0'}
                    </td>
                    <td className="acoes">
                      {r.id > 0 && (
                        <>
                          <button type="button" className="btn btn-mini"
                                  onClick={() => setRascunho(JSON.parse(JSON.stringify(r)))}>
                            editar
                          </button>
                          <button type="button" className="btn btn-mini"
                                  disabled={ocupado}
                                  onClick={() => {
                                    if (confirm(`Apagar a regra ${r.rotulo}?`)) {
                                      chamar('DELETE', { id: r.id });
                                    }
                                  }}>
                            apagar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!regrasAgora.length && (
                <tr><td colSpan="7" className="muted">
                  Nenhuma regra ainda. Toda a demanda cai em &ldquo;sem
                  regra&rdquo; e continua aparecendo no painel com o valor de
                  origem.
                </td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3">Sem regra</td>
                <td className="num">{fmt(conta.semRegra.linhas)}</td>
                <td className="num">{horas(conta.semRegra.minutos)}</td>
                <td className="num">
                  {totalMin ? (conta.semRegra.minutos * 100 / totalMin).toFixed(1) : '0,0'}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>

          {!rascunho && (
            <button type="button" className="btn btn-primario"
                    onClick={() => setRascunho(
                      REGRA_NOVA(alvo, (regrasAgora.at(-1)?.ordem ?? 0) + 1))}>
              Nova regra
            </button>
          )}

          {rascunho && (
            <FormRegra rascunho={rascunho} mexe={mexe} ocupado={ocupado}
                       condicionaveis={condicionaveis} combinacoes={combinacoes}
                       conta={porId.get(rascunho.id ?? -1)} totalMin={totalMin}
                       cancelar={() => setRascunho(null)}
                       gravar={async () => {
                         const j = await chamar('POST', rascunho);
                         if (j) setRascunho(null);
                       }} />
          )}

          {/* Os rótulos somados, que é como o painel vai mostrar. Duas regras
              podem produzir o mesmo rótulo de propósito — caminhos diferentes
              para o mesmo grupo. */}
          {conta.porRotulo.length > 0 && (
            <>
              <h3>Como vai aparecer</h3>
              <table className="tabela-mes">
                <thead>
                  <tr><th>{attrAtual.nome}</th><th className="num">Linhas</th>
                      <th className="num">Horas</th><th className="num">%</th></tr>
                </thead>
                <tbody>
                  {conta.porRotulo.map((r) => (
                    <tr key={r.rotulo}>
                      <td>{r.rotulo}</td>
                      <td className="num">{fmt(r.linhas)}</td>
                      <td className="num">{horas(r.minutos)}</td>
                      <td className="num">
                        {totalMin ? (r.minutos * 100 / totalMin).toFixed(1) : '0,0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------

function FormRegra({ rascunho, mexe, condicionaveis, combinacoes, conta,
                     totalMin, gravar, cancelar, ocupado }) {
  // Os blocos, na ordem em que aparecem. Dentro do bloco tudo é E; entre blocos
  // é OU. Sem parênteses e sem precedência para ninguém errar.
  const blocos = [...new Set(rascunho.condicoes.map((c) => c.bloco))].sort((a, b) => a - b);
  const proximoBloco = Math.max(0, ...blocos) + 1;

  return (
    <div className="painel-interno">
      <div className="linha-form">
        <label className="campo">
          <span className="campo-rot">Vira</span>
          <input value={rascunho.rotulo} placeholder="Banho Jacquard" autoFocus
                 onChange={(e) => mexe((r) => { r.rotulo = e.target.value; })} />
        </label>
        <label className="campo" style={{ maxWidth: '6rem' }}>
          <span className="campo-rot">Ordem</span>
          <input type="number" min="1" value={rascunho.ordem}
                 onChange={(e) => mexe((r) => { r.ordem = Number(e.target.value); })} />
        </label>
        <label className="campo-inline">
          <input type="checkbox" checked={rascunho.ativa !== false}
                 onChange={(e) => mexe((r) => { r.ativa = e.target.checked; })} />
          <span className="campo-rot">ativa</span>
        </label>
      </div>

      {blocos.map((b, i) => (
        <div key={b} className="bloco">
          <p className="bloco-rot">{i === 0 ? 'SE' : 'OU SE'}</p>
          {rascunho.condicoes.filter((c) => c.bloco === b).map((c) => {
            const idx = rascunho.condicoes.indexOf(c);
            const valores = valoresDe(combinacoes, c.atributo);
            return (
              <div key={idx} className="linha-form">
                <select value={c.atributo}
                        onChange={(e) => mexe((r) => {
                          r.condicoes[idx].atributo = e.target.value;
                          r.condicoes[idx].valor = '';
                        })}>
                  {condicionaveis.map((a) => (
                    <option key={a.codigo} value={a.codigo}>{a.nome}</option>
                  ))}
                </select>

                <select value={c.operador}
                        onChange={(e) => mexe((r) => {
                          r.condicoes[idx].operador = e.target.value;
                        })}>
                  {OPERADORES.map((o) => (
                    <option key={o.codigo} value={o.codigo}>{o.nome}</option>
                  ))}
                </select>

                {c.operador !== 'VAZIO' && (
                  <>
                    {/* Lista e campo livre ao mesmo tempo: o valor certo está
                        quase sempre na lista, mas CONTEM quer um pedaço, que
                        por definição não está. */}
                    <input list={`vals-${idx}`} value={c.valor}
                           placeholder="valor"
                           onChange={(e) => mexe((r) => {
                             r.condicoes[idx].valor = e.target.value;
                           })} />
                    <datalist id={`vals-${idx}`}>
                      {valores.slice(0, 200).map((v) => (
                        <option key={v.valor} value={v.valor}>
                          {horas(v.minutos)} h
                        </option>
                      ))}
                    </datalist>
                  </>
                )}

                <button type="button" className="btn btn-mini"
                        disabled={rascunho.condicoes.length === 1}
                        onClick={() => mexe((r) => { r.condicoes.splice(idx, 1); })}>
                  ×
                </button>
              </div>
            );
          })}
          <button type="button" className="btn btn-mini"
                  onClick={() => mexe((r) => r.condicoes.push({
                    bloco: b, atributo: 'linha_produto_agrupada',
                    operador: '=', valor: '',
                  }))}>
            + E também
          </button>
        </div>
      ))}

      <button type="button" className="btn btn-mini"
              onClick={() => mexe((r) => r.condicoes.push({
                bloco: proximoBloco, atributo: 'linha_produto_agrupada',
                operador: '=', valor: '',
              }))}>
        + OU se
      </button>

      {/* O contador, que é a razão de a tela existir. Ele anda a cada tecla, e
          é exato: a mesma conta que o servidor faria. */}
      <p className="previa">
        Esta regra pega <strong>{fmt(conta?.linhas ?? 0)} linhas</strong> e{' '}
        <strong>{horas(conta?.minutos ?? 0)} h</strong>
        {totalMin > 0 && (
          <> — {((conta?.minutos ?? 0) * 100 / totalMin).toFixed(1)}% da carga</>
        )}
        {conta?.valores?.length > 0 && (
          <span className="muted"> · {conta.valores.slice(0, 4).join(' | ')}
            {conta.valores.length > 4 && ' …'}
          </span>
        )}
      </p>

      <div className="linha-form">
        <button type="button" className="btn btn-primario" onClick={gravar}
                disabled={ocupado || !rascunho.rotulo.trim()}>
          {rascunho.id ? 'Gravar' : 'Criar regra'}
        </button>
        <button type="button" className="btn" onClick={cancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// A regra em uma linha de texto, para a tabela mostrar o que ela faz sem abrir.
function descreve(regra, atributos) {
  const nome = (c) =>
    ATRIBUTOS_ORIGEM.find((a) => a.codigo === c)?.nome
    ?? atributos.find((a) => a.codigo === c)?.nome ?? c;
  const op = (c) => OPERADORES.find((o) => o.codigo === c)?.nome ?? c;

  const blocos = new Map();
  for (const c of regra.condicoes ?? []) {
    if (!blocos.has(c.bloco)) blocos.set(c.bloco, []);
    blocos.get(c.bloco).push(
      `${nome(c.atributo)} ${op(c.operador)}${c.valor ? ` ${c.valor}` : ''}`);
  }
  return [...blocos.values()].map((b) => b.join(' e ')).join('  ou  ');
}
