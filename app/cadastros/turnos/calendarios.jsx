'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS } from '../../../lib/dias';

// Em quais calendários o turno roda. Sem isso o motor devolve capacidade zero
// mesmo com o turno marcado no recurso, e nada na tela explicava por quê.
export default function Calendarios({ turnoId, calendarios }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  const faltando = calendarios.filter((c) => !c.dias_do_turno);

  async function incluir() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/cadastro/turno-calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turno_id: turnoId }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(false);
    }
  }

  if (!calendarios.length) return null;

  return (
    <>
      <p className="rodape" style={{ marginTop: 0 }}>
        {calendarios.map((c, i) => (
          <span key={c.id}>
            {i > 0 && ' · '}
            <strong>{c.nome}:</strong>{' '}
            {c.dias_do_turno ? descreveDias(c.dias_do_turno) : 'não roda'}
          </span>
        ))}
      </p>

      {faltando.length > 0 && (
        <div className="aviso" style={{ marginTop: 10 }}>
          <strong>
            Este turno não está em {faltando.map((c) => c.nome).join(' nem ')}.
          </strong>
          <p style={{ margin: '6px 0 10px' }}>
            Enquanto isso, ele sai com capacidade zero no cálculo, mesmo estando
            marcado no recurso.
          </p>
          <button className="btn btn-primario btn-mini" disabled={ocupado}
                  onClick={incluir}>
            {ocupado ? 'Incluindo…' : 'Incluir nos calendários'}
          </button>
          {erro && <p className="erro">{erro}</p>}
        </div>
      )}
    </>
  );
}

function descreveDias(dias) {
  const n = dias.split(',').map(Number).sort((a, b) => a - b);
  if (n.length === 7) return 'todos os dias';
  const seguido = n.every((d, i) => i === 0 || d === n[i - 1] + 1);
  if (seguido && n.length > 2) return `${DIAS[n[0]]} a ${DIAS[n[n.length - 1]]}`;
  return n.map((d) => DIAS[d]).join(', ');
}
