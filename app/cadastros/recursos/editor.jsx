'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Liga e desliga turnos de um recurso. Cada mudança abre ou fecha uma
// vigência em recurso_turno — nunca sobrescreve o vínculo anterior.
export default function EditorTurnos({ recursoId, turnos, data }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(null);   // turno_id em edição
  const [de, setDe] = useState(data);
  const [ate, setAte] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  function abrir(turnoId) {
    setAberto(turnoId);
    setDe(data);
    setAte('');
    setErro(null);
  }

  async function chamar(metodo, corpo) {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch('/api/cadastro/recurso-turno', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setAberto(null);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Turno</th>
            <th>Situação</th>
            <th>Desde</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {turnos.map((t) => {
            const ligado = t.vinculo_id !== null;
            const editando = aberto === t.turno_id;

            return (
              <tr key={t.turno_id} className={ligado ? '' : 'linha-vazia'}>
                <td>{t.codigo} — {t.nome}</td>
                <td>
                  <span className={'selo ' + (ligado ? 'rodizio' : 'padrao')}>
                    {ligado ? 'roda' : 'não roda'}
                  </span>
                </td>
                <td className="muted">{t.vigente_desde ?? ''}</td>
                <td className="acoes">
                  {editando ? (
                    <>
                      <label className="campo-inline">
                        <span className="campo-rot">{ligado ? 'encerrar em' : 'de'}</span>
                        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
                      </label>

                      {/* Fim só faz sentido ao ligar: encerrar já é o fim. */}
                      {!ligado && (
                        <label className="campo-inline">
                          <span className="campo-rot">até (opcional)</span>
                          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
                        </label>
                      )}

                      <button
                        className="btn btn-primario btn-mini"
                        disabled={salvando}
                        onClick={() =>
                          chamar(ligado ? 'DELETE' : 'POST',
                            ligado
                              ? { recurso_id: recursoId, turno_id: t.turno_id, em: de }
                              : { recurso_id: recursoId, turno_id: t.turno_id,
                                  a_partir_de: de, ate: ate || null })
                        }
                      >
                        {salvando ? '…' : 'Confirmar'}
                      </button>
                      <button
                        className="btn btn-mini"
                        onClick={() => { setAberto(null); setErro(null); }}
                        disabled={salvando}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-mini" onClick={() => abrir(t.turno_id)}>
                      {ligado ? 'Encerrar' : 'Vincular'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {erro && <p className="erro">{erro}</p>}

      <p className="rodape">
        Deixar <strong>até</strong> em branco liga o turno por tempo
        indeterminado. Preencher cria um período fechado — útil quando o turno
        roda só alguns meses do ano. O que já foi calculado antes da data de
        início não muda.
      </p>
    </>
  );
}
