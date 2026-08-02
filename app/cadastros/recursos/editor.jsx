'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Liga e desliga turnos de um recurso. Cada mudança abre ou fecha uma
// vigência em recurso_turno — nunca sobrescreve o vínculo anterior.
export default function EditorTurnos({ recursoId, turnos, data }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(null);   // turno_id em edição
  const [aPartirDe, setAPartirDe] = useState(data);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

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
                      <input
                        type="date"
                        value={aPartirDe}
                        onChange={(e) => setAPartirDe(e.target.value)}
                      />
                      <button
                        className="btn btn-primario btn-mini"
                        disabled={salvando}
                        onClick={() =>
                          chamar(ligado ? 'DELETE' : 'POST',
                            ligado
                              ? { recurso_id: recursoId, turno_id: t.turno_id, em: aPartirDe }
                              : { recurso_id: recursoId, turno_id: t.turno_id, a_partir_de: aPartirDe })
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
                    <button
                      className="btn btn-mini"
                      onClick={() => { setAberto(t.turno_id); setAPartirDe(data); setErro(null); }}
                    >
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
        A data é a partir de quando a mudança vale. O que já foi calculado
        antes dela não muda.
      </p>
    </>
  );
}
