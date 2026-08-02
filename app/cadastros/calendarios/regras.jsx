'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS } from '../../../lib/dias';

// Matriz dia da semana x turno. É literalmente o que o motor pergunta: neste
// calendário, neste dia, roda este turno?
//
// Mesma forma da matriz de turnos do recurso — dias em linha, turnos em coluna,
// marca e salva — para não ter duas gramáticas diferentes na mesma ferramenta.

const chave = (turnoId, dia) => `${turnoId}:${dia}`;

export default function Regras({ calendarioId, turnos, inicial }) {
  const router = useRouter();
  const [marcado, setMarcado] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const sujo = useMemo(() => {
    const a = Object.keys(marcado).filter((k) => marcado[k]).sort();
    const b = Object.keys(inicial).filter((k) => inicial[k]).sort();
    return a.length !== b.length || a.some((k, i) => k !== b[i]);
  }, [marcado, inicial]);

  const alterna = (turnoId, dia) => {
    setMarcado((m) => ({ ...m, [chave(turnoId, dia)]: !m[chave(turnoId, dia)] }));
    setOk(null);
  };

  function alternaDia(dia) {
    const todos = turnos.every((t) => marcado[chave(t.turno_id, dia)]);
    setMarcado((m) => {
      const novo = { ...m };
      for (const t of turnos) novo[chave(t.turno_id, dia)] = !todos;
      return novo;
    });
    setOk(null);
  }

  function alternaTurno(turnoId) {
    const todos = DIAS.every((_, d) => marcado[chave(turnoId, d)]);
    setMarcado((m) => {
      const novo = { ...m };
      for (let d = 0; d < 7; d++) novo[chave(turnoId, d)] = !todos;
      return novo;
    });
    setOk(null);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      const marcados = {};
      for (const t of turnos) {
        const dias = [];
        for (let d = 0; d < 7; d++) if (marcado[chave(t.turno_id, d)]) dias.push(d);
        marcados[t.turno_id] = dias;
      }

      const r = await fetch('/api/cadastro/calendario-regra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendario_id: calendarioId, marcados }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);

      setOk(j.turnosAlterados === 0 ? 'Nada mudou.'
        : `${j.turnosAlterados} turno(s) atualizado(s).`);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setSalvando(false);
    }
  }

  if (!turnos.length) {
    return (
      <p className="muted">
        Nenhum turno ativo nesta planta. Cadastre os turnos antes de montar o
        calendário.
      </p>
    );
  }

  return (
    <>
      <div className="grade-rolagem">
        <table className="matriz">
          <thead>
            <tr>
              <th>Dia</th>
              {turnos.map((t) => (
                <th key={t.turno_id} className="matriz-turno">
                  <button className="matriz-cab" onClick={() => alternaTurno(t.turno_id)}
                          title={`${t.codigo} — marcar ou desmarcar a semana toda`}>
                    {t.nome}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIAS.map((rotulo, dia) => (
              <tr key={dia}>
                <td className="matriz-mes">
                  <button className="matriz-cab" onClick={() => alternaDia(dia)}
                          title="Marcar ou desmarcar todos os turnos deste dia">
                    {rotulo}
                  </button>
                </td>
                {turnos.map((t) => (
                  <td key={t.turno_id} className="matriz-cel">
                    <input
                      type="checkbox"
                      checked={Boolean(marcado[chave(t.turno_id, dia)])}
                      onChange={() => alterna(t.turno_id, dia)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="acoes" style={{ marginTop: 16 }}>
        <button className="btn btn-primario" onClick={salvar} disabled={!sujo || salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        {sujo && !salvando && <span className="muted">alterações não salvas</span>}
        {ok && <span className="muted">{ok}</span>}
        {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
      </div>

      <p className="rodape">
        Dia desmarcado para um turno significa que o turno não roda naquele dia
        neste calendário — a capacidade sai zero, mesmo com o turno marcado no
        recurso. Clique no nome do dia ou do turno para marcar a linha ou a
        coluna inteira.
      </p>
    </>
  );
}
