'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// As cargas já importadas. Uma está no ar; as outras ficam guardadas.
//
// Importar não troca o que todo mundo está vendo — trocar é um ato à parte,
// pela mesma razão de o Recalcular ser um botão: número que muda sozinho não
// tem a quem perguntar.
const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');
const quando = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '—');

export default function Cargas({ itens }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  // O rascunho da observação, por carga. Ele começa do que está gravado e só
  // sobe quando o campo perde o foco: gravar a cada tecla seriam vinte
  // requisições para escrever uma frase.
  const [notas, setNotas] = useState(() =>
    Object.fromEntries(itens.map((c) => [c.id, c.observacao ?? ''])));

  // Depois de importar ou apagar uma carga, a lista chega nova do servidor e o
  // rascunho precisa acompanhar — senão a anotação some da tela sem ter sido
  // apagada de lugar nenhum.
  useEffect(() => {
    setNotas(Object.fromEntries(itens.map((c) => [c.id, c.observacao ?? ''])));
  }, [itens]);

  async function anotar(carga) {
    const texto = notas[carga.id] ?? '';
    if (texto.trim() === (carga.observacao ?? '').trim()) return;
    setErro(null);
    try {
      const r = await fetch('/api/demanda', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'observacao', id: carga.id, observacao: texto }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Não consegui gravar a observação.');
    }
  }

  async function chamar(metodo, corpo) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/demanda', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setConfirmando(null);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(false);
    }
  }

  if (!itens.length) {
    return (
      <div className="painel">
        <h2>Cargas</h2>
        <p className="muted">
          Nenhuma base importada ainda. A primeira carga é a que vai dizer
          quantos centros de trabalho já têm recurso cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="painel">
      <h2>Cargas</h2>

      <div className="grade-rolagem">
        <table>
          <thead>
            <tr>
              <th className="col-marca">No ar</th>
              <th>Cenário</th>
              <th className="col-obs">Observação</th>
              <th>Arquivo</th>
              <th className="num">Linhas</th>
              <th className="num">Horas</th>
              <th className="num">Períodos</th>
              <th>Extraída em</th>
              <th>Importada em</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((c) => (
              <tr key={c.id} className={c.corrente ? '' : 'linha-vazia'}>
                <td className="col-marca">
                  <input type="checkbox" checked={c.corrente} disabled={ocupado}
                         title={c.corrente ? 'É esta que o painel usa'
                                           : 'Colocar esta no ar'}
                         onChange={() => !c.corrente && chamar('PUT', { id: c.id })} />
                </td>
                <td>{c.cenario}</td>
                <td className="col-obs">
                  {/* Grava ao sair do campo, e não a cada tecla: uma frase
                      viraria vinte requisições, e a última chegaria fora de
                      ordem tão fácil quanto na ordem. */}
                  <input type="text" value={notas[c.id] ?? ''} maxLength={400}
                         placeholder="o que este cenário tem de diferente"
                         disabled={ocupado}
                         onChange={(e) => setNotas((n) =>
                           ({ ...n, [c.id]: e.target.value }))}
                         onBlur={() => anotar(c)}
                         onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
                </td>
                <td className="muted">{c.arquivo}</td>
                <td className="num">{fmt(c.linhas)}</td>
                <td className="num">{fmt(c.horas)}</td>
                <td className="num">{fmt(c.periodos)}</td>
                <td className="muted">{quando(c.extraido_em)}</td>
                <td className="muted">{quando(c.criado_em)}</td>
                <td className="acoes">
                  {confirmando === c.id ? (
                    <>
                      <button className="btn btn-perigo btn-mini" disabled={ocupado}
                              onClick={() => chamar('DELETE', { id: c.id })}>
                        Apagar mesmo
                      </button>
                      <button className="btn btn-mini" disabled={ocupado}
                              onClick={() => setConfirmando(null)}>
                        Não
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-mini" disabled={ocupado || c.corrente}
                            title={c.corrente
                              ? 'Ponha outra no ar antes de apagar esta'
                              : 'Apagar esta carga'}
                            onClick={() => setConfirmando(c.id)}>
                      Apagar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <p className="rodape">
        A carga <strong>no ar</strong> é a que o painel usa. Importar uma nova
        não troca sozinho — marcar aqui é que troca, e é de propósito: o número
        que alguém está olhando não deveria mudar porque outra pessoa importou
        um arquivo.
        {' '}Carga antiga fica guardada e explica por que o número de um mês
        fechado era outro. A que está no ar não pode ser apagada.
        {' '}A <strong>observação</strong> é o que distingue duas cargas com o
        mesmo nome daqui a um mês — &ldquo;sem o pedido da Renner&rdquo;,
        &ldquo;reprocesso do ciclo anterior&rdquo;. Ela grava ao sair do campo.
      </p>
    </div>
  );
}
