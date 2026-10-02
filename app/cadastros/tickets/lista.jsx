'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  STATUS, TIPOS, TUDO, motivoParaNaoEditar, podeComentar, podeEditarTicket,
  rotuloDoProduto, rotuloDoTipo, statusDe, tipo as tipoDe, validaComentario,
  validaTicket,
} from '../../../lib/ticket-formato';

// A fila de chamados.
//
// Uma linha por ticket; clicar abre o que foi escrito e a resposta. A
// descrição inteira em toda linha faria uma parede de texto em que o chamado
// de hoje não se acha — e o resumo existe justamente para essa lista.
//
// DENTRO DA LINHA ABERTA, cada um vê o que pode fazer: o dono corrige o que
// escreveu enquanto ninguém respondeu, e quem cuida da fila responde, muda o
// estado e apaga. Quem decide isso é `podeEditarTicket`, o mesmo motor que o
// servidor usa — a tela esconde o botão, o servidor recusa o atalho.

const fmtData = (d) => (d ? new Date(d).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit',
}) : '—');

// `vejoTodos` diz que esta é a fila de todo mundo (muda a coluna de autor e o
// texto); `podeResponder` diz se esta sessão mexe nela. Eram a mesma coisa até
// 02/10/2026, e separá-las é o que permite ACOMPANHAR a fila sem respondê-la —
// um cargo legítimo, e que antes não tinha como existir.
export default function Lista({
  tickets, vejoTodos, produtos, podeResponder = vejoTodos,
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(null);
  const [filtro, setFiltro] = useState('ATIVOS');
  const [rascunho, setRascunho] = useState({});     // resposta, por ticket
  const [comentario, setComentario] = useState({}); // o que se está escrevendo
  const [edicao, setEdicao] = useState(null);       // { id, produto, tipo, resumo, descricao }
  const [confirma, setConfirma] = useState(null);   // id à espera de confirmação
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  // "Em aberto" é o padrão: a fila é para trabalhar, e o que já foi fechado
  // enterraria o que está esperando depois de algumas semanas.
  const visiveis = tickets.filter((t) => (
    filtro === 'TODOS' ? true
      : filtro === 'ATIVOS' ? (t.status === 'ABERTO' || t.status === 'ANALISE')
      : t.status === filtro));

  const grupos = [...new Set((produtos ?? []).filter((p) => p.grupo).map((p) => p.grupo))];

  async function chama(metodo, corpo, rota = '/api/cadastro/ticket') {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch(rota, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.erro ?? `O servidor respondeu ${r.status}.`);
      router.refresh();
      return true;
    } catch (e) {
      setErro(e.message);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function abreEdicao(t) {
    setEdicao({
      id: t.id, produto: t.produto, tipo: t.tipo,
      resumo: t.resumo, descricao: t.descricao,
    });
    setErro(null);
  }

  async function salvaEdicao() {
    if (await chama('PUT', edicao)) setEdicao(null);
  }

  async function comenta(t) {
    const texto = comentario[t.id] ?? '';
    if (validaComentario(texto).length) return;
    if (await chama('POST', { id: t.id, texto },
                    '/api/cadastro/ticket-comentario')) {
      setComentario({ ...comentario, [t.id]: '' });
    }
  }

  async function apaga(t) {
    if (await chama('DELETE', { id: t.id })) {
      setConfirma(null);
      if (aberto === t.id) setAberto(null);
    }
  }

  if (!tickets.length) {
    return (
      <p className="vazio">
        {vejoTodos
          ? 'Nenhum chamado aberto na ferramenta.'
          : (
            <>
              Você ainda não abriu nenhum chamado. Dúvida, sugestão ou algo que
              não funcionou: <strong>Abrir ticket</strong>, aí em cima.
            </>
          )}
      </p>
    );
  }

  return (
    <>
      {erro && <p className="erro">{erro}</p>}

      <div className="chips">
        {[['ATIVOS', 'Em aberto'], ['TODOS', 'Todos'],
          ...STATUS.map((s) => [s.codigo, s.rotulo])].map(([v, r]) => (
            <button key={v} type="button"
                    className={`chip ${filtro === v ? 'chip-on' : ''}`}
                    onClick={() => setFiltro(v)}>
              {r}
            </button>
        ))}
      </div>

      <div className="grade-rolagem">
        <table className="tabela-recursos">
          <thead>
            <tr>
              <th>#</th>
              <th>Quando</th>
              {vejoTodos && <th>Quem abriu</th>}
              <th>Produto</th>
              <th>Tipo</th>
              <th>Resumo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((t) => {
              const st = statusDe(t.status);
              const abertoAqui = aberto === t.id;
              const editando = edicao?.id === t.id;
              const posso = podeEditarTicket(t, { souDono: t.meu, cuidoDaFila: podeResponder });
              const colunas = vejoTodos ? 7 : 6;

              return (
                <Fragment key={t.id}>
                  <tr className={abertoAqui ? 'linha-edit' : ''}
                      onClick={() => { if (!editando) setAberto(abertoAqui ? null : t.id); }}
                      style={{ cursor: 'pointer' }}>
                    <td><code>{t.id}</code></td>
                    <td>{fmtData(t.criado_em)}</td>
                    {vejoTodos && (
                      <td>{t.autor}{t.meu && <span className="muted"> (você)</span>}</td>
                    )}
                    <td>{rotuloDoProduto(t.produto)}</td>
                    <td>{rotuloDoTipo(t.tipo)}</td>
                    <td>{t.resumo}</td>
                    <td><span className={st.cor}>{st.rotulo}</span></td>
                  </tr>

                  {abertoAqui && (
                    <tr className="linha-edit">
                      <td colSpan={colunas}>
                        <div className="ticket-corpo">
                          {editando ? (
                            <Edicao edicao={edicao} setEdicao={setEdicao} grupos={grupos}
                                    produtos={produtos} ocupado={ocupado}
                                    onSalvar={salvaEdicao} onCancelar={() => setEdicao(null)} />
                          ) : (
                            <>
                              <p className="ticket-texto">{t.descricao}</p>

                              {t.resposta && (
                                <div className="ticket-resposta">
                                  <strong>Resposta</strong>
                                  <span className="muted">
                                    {' '}· {t.respondido_por_nome ?? 'mestre'} ·{' '}
                                    {fmtData(t.respondido_em)}
                                  </span>
                                  <p className="ticket-texto">{t.resposta}</p>
                                </div>
                              )}
                              {!t.resposta && !vejoTodos && (
                                <p className="muted">Ainda sem resposta.</p>
                              )}

                              {/* O dono corrige o que escreveu. O aviso de por
                                  que não dá mais é melhor que o botão sumir
                                  sem explicação — e desde que o estado tranca
                                  o texto, ele é o que explica a trava. */}
                              {t.meu && (
                                <div className="acoes">
                                  {posso ? (
                                    <button type="button" className="btn btn-mini"
                                            disabled={ocupado} onClick={() => abreEdicao(t)}>
                                      Editar o chamado
                                    </button>
                                  ) : (
                                    <span className="muted">
                                      {motivoParaNaoEditar(t, {
                                        souDono: true, cuidoDaFila: podeResponder,
                                      })}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* A CONVERSA. Ela é o que sobrou de mutável
                                  depois que o texto do chamado passou a travar
                                  fora de "Aberto": acrescentar deixa rastro,
                                  reescrever apaga. Vale em qualquer estado,
                                  inclusive fechado — é assim que se diz "voltou
                                  a acontecer" sem abrir um chamado novo que
                                  perderia o histórico do primeiro. */}
                              <Conversa
                                comentarios={t.comentarios ?? []}
                                podeEscrever={podeComentar(t, {
                                  souDono: t.meu, cuidoDaFila: podeResponder,
                                })}
                                valor={comentario[t.id] ?? ''}
                                ocupado={ocupado}
                                onMuda={(v) => setComentario({ ...comentario, [t.id]: v })}
                                onEnviar={() => comenta(t)} />
                            </>
                          )}

                          {podeResponder && !editando && (
                            <div className="ticket-acoes">
                              <label className="campo" style={{ maxWidth: 220 }}>
                                <span className="campo-rot">Estado</span>
                                <select value={t.status} disabled={ocupado}
                                        onChange={(e) => chama('PATCH', { id: t.id, status: e.target.value })}>
                                  {STATUS.map((s) => (
                                    <option key={s.codigo} value={s.codigo}>{s.rotulo}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="campo">
                                <span className="campo-rot">Resposta</span>
                                <textarea rows={3} disabled={ocupado}
                                          value={rascunho[t.id] ?? t.resposta ?? ''}
                                          placeholder="o que vai ser feito, ou por que não vai"
                                          onChange={(e) => setRascunho(
                                            { ...rascunho, [t.id]: e.target.value })} />
                              </label>
                              <button type="button" className="btn btn-primario"
                                      disabled={ocupado
                                        || (rascunho[t.id] ?? t.resposta ?? '') === (t.resposta ?? '')}
                                      onClick={() => chama('PATCH',
                                        { id: t.id, resposta: rascunho[t.id] ?? '' })}>
                                {ocupado ? 'Salvando…' : 'Responder'}
                              </button>

                              {/* `posso` entra aqui também: desde 02/10/2026 o
                                  texto trava fora de "Aberto" para todo mundo,
                                  e quem cuida da fila não é exceção — é ele
                                  quem move o estado, e seria quem apagaria o
                                  rastro sem querer. */}
                              {!t.meu && posso && (
                                <button type="button" className="btn btn-mini"
                                        disabled={ocupado} onClick={() => abreEdicao(t)}>
                                  Editar
                                </button>
                              )}

                              {confirma === t.id ? (
                                <>
                                  <span className="erro" style={{ margin: 0 }}>Apagar de vez?</span>
                                  <button type="button" className="btn btn-mini btn-perigo"
                                          disabled={ocupado} onClick={() => apaga(t)}>
                                    {ocupado ? '…' : 'Apagar'}
                                  </button>
                                  <button type="button" className="btn btn-mini" disabled={ocupado}
                                          onClick={() => setConfirma(null)}>Cancelar</button>
                                </>
                              ) : (
                                <button type="button" className="btn btn-mini" disabled={ocupado}
                                        onClick={() => setConfirma(t.id)}>
                                  Apagar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!visiveis.length && (
              <tr><td colSpan={vejoTodos ? 7 : 6} className="vazio">
                Nenhum chamado neste filtro.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="rodape">
        Clique numa linha para ler o chamado inteiro e a resposta. Você corrige
        o que escreveu <strong>enquanto ninguém respondeu</strong> — depois da
        resposta, editar a pergunta deixaria a resposta sem sentido para quem
        ler depois.
        {vejoTodos && podeResponder
          ? ' Esta é a fila de todo mundo, e o seu cargo responde por ela:'
            + ' mudar o estado vale na hora, a resposta aparece para quem abriu, e'
            + ' apagar é para o chamado repetido ou aberto por engano — o que não vai'
            + ' ser feito se responde com "Não vamos fazer" e o porquê.'
          : vejoTodos
            ? ' Esta é a fila de todo mundo. O seu cargo acompanha, mas quem'
              + ' responde é quem tem editar nesta tela.'
            : ' Quem cuida do roadmap responde por aqui mesmo.'}
      </p>
    </>
  );
}

// A CONVERSA de um chamado: o que já foi dito, e a caixa de dizer mais.
//
// Comentário SÓ ACRESCENTA — não se edita e não se apaga, nem pelo autor. É o
// que torna a trava do texto suportável: quem quer corrigir algo depois de o
// chamado sair de "Aberto" acrescenta a correção, e as duas versões ficam
// visíveis, na ordem em que foram escritas.
function Conversa({ comentarios, podeEscrever, valor, ocupado, onMuda, onEnviar }) {
  const faltas = validaComentario(valor);

  if (!comentarios.length && !podeEscrever) return null;

  return (
    <div className="ticket-conversa">
      {comentarios.map((c) => (
        <div key={c.id} className="ticket-comentario">
          <span className="muted" style={{ fontSize: 12 }}>
            <strong>{c.autor_nome}</strong>
            {' · '}
            {new Date(c.criado_em).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: '2-digit',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
          <p className="ticket-texto" style={{ margin: '2px 0 0' }}>{c.texto}</p>
        </div>
      ))}

      {podeEscrever && (
        <div className="acoes" style={{ alignItems: 'flex-start' }}>
          <textarea rows={2} value={valor} disabled={ocupado}
                    style={{ flex: 1 }}
                    placeholder="acrescentar um comentário"
                    onChange={(e) => onMuda(e.target.value)} />
          <button type="button" className="btn btn-mini"
                  disabled={ocupado || faltas.length > 0}
                  onClick={onEnviar}>
            {ocupado ? 'Enviando…' : 'Comentar'}
          </button>
        </div>
      )}
    </div>
  );
}

// O formulário de correção, com os mesmos campos e as mesmas regras do de
// abrir — inclusive a pergunta que muda com o tipo.
function Edicao({ edicao, setEdicao, grupos, produtos, ocupado, onSalvar, onCancelar }) {
  const t = tipoDe(edicao.tipo);
  const faltas = validaTicket(edicao);
  const set = (campo, valor) => setEdicao({ ...edicao, [campo]: valor });

  return (
    <div className="ticket-edicao">
      <div className="linha-opcao" style={{ paddingTop: 0 }}>
        <span className="rotulo-opcao">Produto</span>
        <select value={edicao.produto} onChange={(e) => set('produto', e.target.value)}>
          <option value={TUDO}>Ferramenta toda</option>
          {grupos.map((g) => (
            <optgroup key={g} label={g}>
              {produtos.filter((p) => p.grupo === g).map((p) => (
                <option key={p.codigo} value={p.codigo}>{p.rotulo}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <nav className="modo">
          {TIPOS.map((x) => (
            <button key={x.codigo} type="button"
                    className={x.codigo === edicao.tipo ? 'modo-on' : ''}
                    onClick={() => set('tipo', x.codigo)}>
              {x.rotulo}
            </button>
          ))}
        </nav>
      </div>

      <label className="campo">
        <span className="campo-rot">Resumo em uma linha</span>
        <input type="text" value={edicao.resumo} maxLength={160}
               placeholder={t.dicaResumo}
               onChange={(e) => set('resumo', e.target.value)} />
      </label>

      <label className="campo">
        <span className="campo-rot">{t.pergunta}</span>
        <textarea rows={7} value={edicao.descricao} placeholder={t.dicaDescricao}
                  onChange={(e) => set('descricao', e.target.value)} />
      </label>

      <div className="acoes">
        <button type="button" className="btn btn-primario"
                disabled={ocupado || faltas.length > 0} onClick={onSalvar}>
          {ocupado ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="btn" disabled={ocupado} onClick={onCancelar}>
          Cancelar
        </button>
        {faltas.length > 0 && <span className="muted">falta: {faltas.join('; ')}</span>}
      </div>
    </div>
  );
}
