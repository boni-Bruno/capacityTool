'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ATRIBUTOS_ORIGEM, OPERADORES, podeSerCondicao, previa, valoresDe,
} from '../../../lib/regras';

// O editor de regras DE/PARA, com a prévia colada nele.
//
// UMA REGRA É UMA COISA SÓ: as condições e o que elas produzem. O atributo em
// que a regra escreve nasce junto dela, na própria tela — quem está escrevendo
// pensa em "isso aqui vira Banho Jacquard", não em "preciso primeiro declarar
// uma coluna".
//
// A PRÉVIA NÃO É ENFEITE. O modo de errar aqui é a regra pegar mais ou menos do
// que se imaginava, e isso não dá erro em lugar nenhum — vira um número torto no
// painel semanas depois. Por isso o contador anda a cada tecla, e por isso o
// valor da condição vem em lista, com o peso de cada um: valor digitado errado é
// regra que fica quieta.
//
// Roda inteiro no navegador sobre as combinações que a página mandou. Nenhuma
// ida ao banco até alguém clicar em gravar.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');
const horas = (min) => fmt(Math.round(Number(min ?? 0) / 60));

// O código que o servidor vai gerar para um atributo novo. Só serve para a
// prévia saber de quem está falando enquanto nada foi gravado.
const RASCUNHO = '__novo__';

// A chave existe só para o React: sem uma identidade estável, tirar uma
// condição de cima faz as de baixo trocarem de campo enquanto a pessoa digita.
let sequencia = 0;
const CONDICAO_NOVA = (bloco) => ({
  k: `n${(sequencia += 1)}`,
  bloco, atributo: 'linha_produto_agrupada', operador: '=', valor: '',
});

const REGRA_NOVA = (atributo, ordem) => ({
  id: null, atributo: atributo ?? '', para_novo: '', rotulo: '', ordem,
  ativa: true, observacao: '', condicoes: [CONDICAO_NOVA(1)],
});

export default function Editor({ cenario, combinacoes, atributos, regras }) {
  const router = useRouter();
  const [alvo, setAlvo] = useState(atributos[0]?.codigo ?? null);
  const [rascunho, setRascunho] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  const totalLinhas = useMemo(
    () => combinacoes.reduce((s, c) => s + Number(c.linhas ?? 0), 0), [combinacoes]);
  const totalMin = useMemo(
    () => combinacoes.reduce((s, c) => s + Number(c.minutos ?? 0), 0), [combinacoes]);

  // Em que atributo o rascunho escreve. Enquanto ele for um atributo novo, o
  // código ainda não existe — a prévia trabalha com um provisório.
  const alvoRascunho = rascunho
    ? (rascunho.atributo || RASCUNHO) : null;
  const alvoEfetivo = alvoRascunho ?? alvo;

  // O nível de um atributo novo é consequência de quem a regra lê, não uma
  // pergunta: quem usa um derivado de nível 2 só pode produzir nível 3.
  const nivelRascunho = useMemo(() => {
    if (!rascunho) return 1;
    let n = 0;
    for (const c of rascunho.condicoes) {
      const a = atributos.find((x) => x.codigo === c.atributo);
      if (a) n = Math.max(n, Number(a.nivel ?? 1));
    }
    return Math.min(9, n + 1);
  }, [rascunho, atributos]);

  const atributosAgora = useMemo(() => (
    alvoRascunho === RASCUNHO
      ? [...atributos, { codigo: RASCUNHO, nome: rascunho.para_novo || 'novo atributo',
                         nivel: nivelRascunho, ordem: 99 }]
      : atributos
  ), [atributos, alvoRascunho, rascunho, nivelRascunho]);

  // As regras que valem agora: as gravadas, com a que está sendo editada
  // substituída pelo rascunho. É o que faz o contador andar sem gravar nada.
  const regrasAgora = useMemo(() => {
    const doAlvo = regras.filter((r) => r.atributo === alvoEfetivo);
    if (!rascunho) return doAlvo;
    const draft = { ...rascunho, atributo: alvoEfetivo, id: rascunho.id ?? -1 };
    return rascunho.id
      ? doAlvo.map((r) => (r.id === rascunho.id ? draft : r))
      : [...doAlvo, draft];
  }, [regras, alvoEfetivo, rascunho]);

  const conta = useMemo(() => {
    if (!alvoEfetivo) return null;
    const outras = regras.filter((r) => r.atributo !== alvoEfetivo);
    return previa(combinacoes, atributosAgora, [...outras, ...regrasAgora], alvoEfetivo);
  }, [combinacoes, atributosAgora, regras, regrasAgora, alvoEfetivo]);

  const porId = useMemo(
    () => new Map((conta?.porRegra ?? []).map((p) => [p.id, p])), [conta]);

  // Quem pode ser condição: origem sempre, derivado só de nível menor. É o que
  // torna ciclo impossível, e vale já aqui — o servidor recusa o resto de novo.
  const condicionaveis = useMemo(() => {
    const derivados = atributos
      .filter((a) => a.codigo !== alvoEfetivo
                  && podeSerCondicao(a.codigo, alvoEfetivo ?? RASCUNHO, atributosAgora))
      .map((a) => ({ codigo: a.codigo, nome: `${a.nome} (DE/PARA)` }));
    return [...ATRIBUTOS_ORIGEM, ...derivados];
  }, [atributos, atributosAgora, alvoEfetivo]);

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

  const attrAtual = alvoRascunho === RASCUNHO
    ? { codigo: RASCUNHO, nome: rascunho.para_novo || 'novo atributo', nivel: nivelRascunho }
    : atributos.find((a) => a.codigo === alvoEfetivo);

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

      <div className="painel">
        <div className="chips">
          {atributos.map((a) => (
            <button key={a.codigo} type="button"
                    className={`chip ${a.codigo === alvoEfetivo ? 'chip-on' : ''}`}
                    onClick={() => { setAlvo(a.codigo); setRascunho(null); }}>
              {a.nome}
              <span className="muted"> · {a.regras} regras</span>
            </button>
          ))}
          <button type="button" className="chip chip-acao" disabled={!!rascunho}
                  onClick={() => setRascunho(REGRA_NOVA(alvo, proximaOrdem(regras, alvo)))}>
            + nova regra DE/PARA
          </button>
        </div>

        {!atributos.length && !rascunho && (
          <p className="vazio">
            Nenhuma regra ainda. Toda a demanda aparece no painel com o valor que
            veio da base — o que não está errado, só está na língua do sistema de
            origem.
          </p>
        )}

        {rascunho && (
          <FormRegra rascunho={rascunho} mexe={mexe} ocupado={ocupado}
                     atributos={atributos} condicionaveis={condicionaveis}
                     combinacoes={combinacoes} totalMin={totalMin}
                     nivel={nivelRascunho}
                     conta={porId.get(rascunho.id ?? -1)}
                     cancelar={() => setRascunho(null)}
                     gravar={async () => {
                       const j = await chamar('POST', rascunho);
                       if (j) { setAlvo(j.atributo); setRascunho(null); }
                     }} />
        )}
      </div>

      {/* --- as regras já gravadas do atributo aberto ----------------------- */}
      {attrAtual && conta && (
        <div className="painel">
          <div className="painel-topo">
            <h2>
              {attrAtual.nome}
              <span className="muted" style={{ fontWeight: 400 }}>
                {' '}· a primeira regra que casa ganha
              </span>
            </h2>
            {/* Atributo sem regra nenhuma classifica nada; apagá-lo não perde
                informação, e é a única forma de desfazer um criado por engano.
                Com regra ele não sai daqui: apagar em cascata seria apagar
                trabalho sem pedir. */}
            {!regrasAgora.length && attrAtual.codigo !== RASCUNHO && (
              <button type="button" className="btn btn-mini" disabled={ocupado}
                      onClick={() => {
                        if (confirm(`Apagar o atributo ${attrAtual.nome}?`)) {
                          setAlvo(null);
                          chamar('DELETE', { acao: 'atributo', codigo: attrAtual.codigo });
                        }
                      }}>
                apagar atributo
              </button>
            )}
          </div>

          <div className="grade-rolagem">
            <table className="tabela-mes">
              <thead>
                <tr>
                  <th style={{ width: '3rem' }}>#</th>
                  <th>SE</th>
                  <th>PARA</th>
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
                      <td className="muted">{descreve(r, atributos)}</td>
                      <td>
                        <strong>
                          {r.rotulo || <span className="muted">sem PARA</span>}
                        </strong>
                      </td>
                      <td className="num">{fmt(p.linhas)}</td>
                      <td className="num">{horas(p.minutos)}</td>
                      <td className="num">
                        {totalMin ? (p.minutos * 100 / totalMin).toFixed(1) : '0,0'}
                      </td>
                      <td className="acoes">
                        {r.id > 0 && !rascunho && (
                          <>
                            <button type="button" className="btn btn-mini"
                                    onClick={() => setRascunho({
                                      ...JSON.parse(JSON.stringify(r)), para_novo: '',
                                    })}>
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
                  <tr><td colSpan="7" className="vazio">
                    Nenhuma regra neste atributo — ele não classifica nada ainda.
                  </td></tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3">Sem regra — fica com o valor de origem</td>
                  <td className="num">{fmt(conta.semRegra.linhas)}</td>
                  <td className="num">{horas(conta.semRegra.minutos)}</td>
                  <td className="num">
                    {totalMin
                      ? (conta.semRegra.minutos * 100 / totalMin).toFixed(1) : '0,0'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Como o painel vai mostrar. Duas regras podem produzir o mesmo PARA
              de propósito — caminhos diferentes para o mesmo grupo. */}
          {conta.porRotulo.length > 1 && (
            <>
              <h3>Como vai aparecer no painel</h3>
              <table className="tabela-mes">
                <thead>
                  <tr>
                    <th>{attrAtual.nome}</th>
                    <th className="num">Linhas</th>
                    <th className="num">Horas</th>
                    <th className="num">%</th>
                  </tr>
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

const proximaOrdem = (regras, atributo) =>
  Math.max(0, ...regras.filter((r) => r.atributo === atributo)
                       .map((r) => Number(r.ordem ?? 0))) + 1;

// -----------------------------------------------------------------------------
// O FORMULÁRIO: SE ... E / OU ... PARA
// -----------------------------------------------------------------------------

function FormRegra({ rascunho, mexe, atributos, condicionaveis, combinacoes,
                     conta, totalMin, nivel, gravar, cancelar, ocupado }) {
  // Dentro do bloco tudo é E; blocos irmãos são OU. Sem parênteses e sem
  // precedência de operador — não há como escrever algo ambíguo.
  const blocos = [...new Set(rascunho.condicoes.map((c) => c.bloco))]
    .sort((a, b) => a - b);

  const addCondicao = (bloco) => mexe((r) => r.condicoes.push(CONDICAO_NOVA(bloco)));

  const completa = rascunho.condicoes.every(
    (c) => c.operador === 'VAZIO' || String(c.valor ?? '').trim());
  const temPara = String(rascunho.rotulo ?? '').trim()
    && (rascunho.atributo || String(rascunho.para_novo ?? '').trim());

  return (
    <div className="painel-interno">
      {blocos.map((b, i) => (
        <div key={b} className="bloco">
          <p className="bloco-rot">{i === 0 ? 'SE' : 'OU SE'}</p>

          {rascunho.condicoes.filter((c) => c.bloco === b).map((c, j) => {
            const idx = rascunho.condicoes.indexOf(c);
            return (
              <div key={c.id ?? c.k}>
                {j > 0 && <p className="cond-e">e</p>}
                <Condicao c={c} idx={idx} mexe={mexe}
                          condicionaveis={condicionaveis}
                          combinacoes={combinacoes}
                          podeApagar={rascunho.condicoes.length > 1} />
              </div>
            );
          })}
        </div>
      ))}

      {/* Os dois caminhos para a próxima condição, com o conectivo escrito no
          botão. Escolher "e" ou "ou" DEPOIS de escrever a condição é como se
          erra a lógica sem perceber. */}
      <div className="acoes">
        <button type="button" className="btn btn-mini"
                onClick={() => addCondicao(blocos.at(-1))}>
          + novo atributo <strong>e</strong>
        </button>
        <button type="button" className="btn btn-mini"
                onClick={() => addCondicao(Math.max(...blocos) + 1)}>
          + novo atributo <strong>ou</strong>
        </button>
      </div>

      {/* --- o PARA -------------------------------------------------------- */}
      <div className="bloco bloco-para">
        <p className="bloco-rot">PARA</p>
        <div className="linha-form">
          <label className="campo">
            <span className="campo-rot">Atributo — a coluna do painel</span>
            <select value={rascunho.atributo}
                    onChange={(e) => mexe((r) => {
                      r.atributo = e.target.value;
                      if (e.target.value) r.para_novo = '';
                    })}>
              <option value="">+ novo atributo…</option>
              {atributos.map((a) => (
                <option key={a.codigo} value={a.codigo}>{a.nome}</option>
              ))}
            </select>
          </label>

          {!rascunho.atributo && (
            <label className="campo">
              <span className="campo-rot">Nome do atributo novo</span>
              <input value={rascunho.para_novo} placeholder="Linha comercial"
                     onChange={(e) => mexe((r) => { r.para_novo = e.target.value; })} />
            </label>
          )}

          <label className="campo">
            <span className="campo-rot">Vira</span>
            <input value={rascunho.rotulo} placeholder="Banho Jacquard"
                   onChange={(e) => mexe((r) => { r.rotulo = e.target.value; })} />
          </label>

          <label className="campo" style={{ maxWidth: '5.5rem' }}>
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

        {!rascunho.atributo && rascunho.para_novo && nivel > 1 && (
          <p className="rodape">
            Esta regra lê outro DE/PARA, então <strong>{rascunho.para_novo}</strong>{' '}
            nasce no nível {nivel} — ele enxerga os de nível menor, e nenhum
            deles pode voltar a enxergá-lo. É o que impede regra circular.
          </p>
        )}
      </div>

      {/* O contador, que é a razão de a tela existir. Anda a cada tecla, e é a
          mesma conta que o servidor faria. */}
      <p className="previa">
        {completa ? (
          <>
            Esta regra pega <strong>{fmt(conta?.linhas ?? 0)} linhas</strong> e{' '}
            <strong>{horas(conta?.minutos ?? 0)} h</strong>
            {totalMin > 0
              && <> — {((conta?.minutos ?? 0) * 100 / totalMin).toFixed(1)}% da carga</>}
            {conta?.valores?.length > 0 && (
              <span className="muted">
                {' '}· {conta.valores.slice(0, 3).join('  |  ')}
                {conta.valores.length > 3 && '  …'}
              </span>
            )}
          </>
        ) : 'Escolha o valor de cada condição para ver quanto esta regra pega.'}
      </p>

      <div className="acoes">
        <button type="button" className="btn btn-primario" onClick={gravar}
                disabled={ocupado || !completa || !temPara}>
          {rascunho.id ? 'Gravar' : 'Criar regra'}
        </button>
        <button type="button" className="btn" onClick={cancelar}>Cancelar</button>
      </div>
    </div>
  );
}

/**
 * Uma condição: campo, operador, valor.
 *
 * O valor vem em lista com o peso de cada opção — escolher errado é o modo
 * clássico de a regra não pegar nada, e ele não dá erro em lugar nenhum. Só
 * "contém" e "começa com" ganham campo livre, porque eles pedem um pedaço, que
 * por definição não está na lista.
 */
function Condicao({ c, idx, mexe, condicionaveis, combinacoes, podeApagar }) {
  const valores = useMemo(
    () => valoresDe(combinacoes, c.atributo), [combinacoes, c.atributo]);
  const livre = c.operador === 'CONTEM' || c.operador === 'COMECA';

  return (
    <div className="linha-form">
      <label className="campo">
        <span className="campo-rot">Campo</span>
        <select value={c.atributo}
                onChange={(e) => mexe((r) => {
                  r.condicoes[idx].atributo = e.target.value;
                  r.condicoes[idx].valor = '';
                })}>
          {condicionaveis.map((a) => (
            <option key={a.codigo} value={a.codigo}>{a.nome}</option>
          ))}
        </select>
      </label>

      <label className="campo" style={{ maxWidth: '9rem' }}>
        <span className="campo-rot">É</span>
        <select value={c.operador}
                onChange={(e) => mexe((r) => {
                  r.condicoes[idx].operador = e.target.value;
                  if (e.target.value === 'VAZIO') r.condicoes[idx].valor = '';
                })}>
          {OPERADORES.map((o) => (
            <option key={o.codigo} value={o.codigo}>{o.nome}</option>
          ))}
        </select>
      </label>

      {c.operador !== 'VAZIO' && (
        <label className="campo campo-valor">
          <span className="campo-rot">
            Valor
            <span className="muted"> · {fmt(valores.length)} na base</span>
          </span>
          {livre ? (
            <input value={c.valor} placeholder="um pedaço do texto"
                   onChange={(e) => mexe((r) => {
                     r.condicoes[idx].valor = e.target.value;
                   })} />
          ) : (
            <select value={c.valor}
                    onChange={(e) => mexe((r) => {
                      r.condicoes[idx].valor = e.target.value;
                    })}>
              <option value="">— escolha —</option>
              {/* Valor que não está mais na base continua na lista: a regra é
                  de antes da carga, e sumir com ele esconderia o que ela faz. */}
              {c.valor && !valores.some((v) => v.valor === c.valor) && (
                <option value={c.valor}>{c.valor} (fora desta carga)</option>
              )}
              {valores.map((v) => (
                <option key={v.valor} value={v.valor}>
                  {v.valor} — {horas(v.minutos)} h
                </option>
              ))}
            </select>
          )}
        </label>
      )}

      <button type="button" className="btn btn-mini" disabled={!podeApagar}
              title="tirar esta condição"
              onClick={() => mexe((r) => { r.condicoes.splice(idx, 1); })}>
        ×
      </button>
    </div>
  );
}

// A regra em uma linha de texto, para a tabela dizer o que ela faz sem abrir.
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
