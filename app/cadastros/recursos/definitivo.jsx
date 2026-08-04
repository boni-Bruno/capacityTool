'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Exclusão definitiva de recurso desativado.
//
// Fica num painel separado, longe do Excluir normal, porque faz outra coisa:
// aquele desativa, este apaga junto o rastro do recurso nas rodadas já
// calculadas. Um total que alguém já viu passa a somar menos.
//
// A confirmação diz quantas linhas somem em vez de perguntar "tem certeza?"
// no vazio — número torna a decisão informada.
export default function Definitivo({ itens }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [feito, setFeito] = useState(null);

  async function apagar(id) {
    setOcupado(true);
    setErro(null);
    setFeito(null);
    try {
      const r = await fetch('/api/cadastro/recurso-definitivo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setConfirmando(null);
      setFeito(
        `Recurso apagado. Saíram ${j.fato} linha(s) de cálculo, ` +
        `${j.instalada} de instalada e ${j.memoria} do memorial.`
      );
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(false);
    }
  }

  if (!itens.length) {
    return feito ? <p className="muted">{feito}</p> : null;
  }

  return (
    <div className="painel">
      <h2>Recursos desativados</h2>

      <table>
        <thead>
          <tr>
            <th>Recurso</th>
            <th>Área</th>
            <th className="num">Rodadas</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {itens.map((r) => (
            <tr key={r.id} className="linha-vazia">
              <td><code>{r.codigo}</code> {r.nome}</td>
              <td>{r.planta} · {r.area}</td>
              <td className="num">{r.rodadas}</td>
              <td className="acoes">
                {confirmando === r.id ? (
                  <>
                    <span className="erro" style={{ margin: 0 }}>
                      Apagar e remover de {r.rodadas} rodada(s)?
                    </span>
                    <button className="btn btn-mini btn-perigo" disabled={ocupado}
                            onClick={() => apagar(r.id)}>
                      {ocupado ? '…' : 'Apagar de vez'}
                    </button>
                    <button className="btn btn-mini" disabled={ocupado}
                            onClick={() => setConfirmando(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button className="btn btn-mini"
                          onClick={() => { setConfirmando(r.id); setErro(null); }}>
                    Excluir definitivamente
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {erro && <p className="erro">{erro}</p>}
      {feito && <p className="muted" style={{ marginTop: 10 }}>{feito}</p>}

      <p className="rodape">
        Isto apaga o recurso <strong>e as linhas dele nas rodadas já
        calculadas</strong> — os totais daquelas rodadas passam a somar menos,
        e não há como voltar. Use quando o recurso foi criado por engano. Para
        só tirar do planejamento mantendo o histórico, basta deixá-lo
        desativado.
      </p>
    </div>
  );
}
