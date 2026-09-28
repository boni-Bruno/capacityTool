'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  STATUS, rotuloDoProduto, rotuloDoTipo, statusDe,
} from '../../../lib/ticket-formato';

// A fila de chamados.
//
// Uma linha por ticket; clicar abre o que foi escrito e a resposta. A
// descrição inteira em toda linha faria uma parede de texto em que o chamado
// de hoje não se acha — e o resumo existe justamente para essa lista.
//
// Quem responde (vejoTodos) tem, dentro da linha aberta, o estado e o campo de
// resposta. Quem abriu vê a resposta e o estado, que é o que ele veio saber.

const fmtData = (d) => (d ? new Date(d).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit',
}) : '—');

export default function Lista({ tickets, vejoTodos }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(null);
  const [filtro, setFiltro] = useState('ATIVOS');
  const [rascunho, setRascunho] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  // "Ativos" é o padrão: a fila é para trabalhar, e o que já foi fechado
  // enterraria o que está em aberto depois de algumas semanas.
  const visiveis = tickets.filter((t) => (
    filtro === 'TODOS' ? true
      : filtro === 'ATIVOS' ? (t.status === 'ABERTO' || t.status === 'ANALISE')
      : t.status === filtro));

  async function salva(t, mudanca) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/cadastro/ticket', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, ...mudanca }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.erro ?? `O servidor respondeu ${r.status}.`);
      router.refresh();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  if (!tickets.length) {
    return (
      <p className="vazio">
        Nenhum chamado ainda. Dúvida, sugestão ou algo que não funcionou:{' '}
        <strong>Criar ticket</strong>, aí em cima.
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
              return (
                <Fragment key={t.id}>
                  <tr className={abertoAqui ? 'linha-edit' : ''}
                      onClick={() => setAberto(abertoAqui ? null : t.id)}
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
                      <td colSpan={vejoTodos ? 7 : 6}>
                        <div className="ticket-corpo">
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

                          {vejoTodos && (
                            <div className="ticket-acoes">
                              <label className="campo" style={{ maxWidth: 220 }}>
                                <span className="campo-rot">Estado</span>
                                <select value={t.status} disabled={ocupado}
                                        onChange={(e) => salva(t, { status: e.target.value })}>
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
                                      onClick={() => salva(t, { resposta: rascunho[t.id] ?? '' })}>
                                {ocupado ? 'Salvando…' : 'Responder'}
                              </button>
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
        Clique numa linha para ler o chamado inteiro e a resposta.
        {vejoTodos
          ? ' Você vê os chamados de todo mundo porque o seu cargo responde por eles;'
            + ' mudar o estado vale na hora, e a resposta aparece para quem abriu.'
          : ' Você vê os seus chamados. Quem cuida do roadmap responde por aqui mesmo.'}
      </p>
    </>
  );
}
