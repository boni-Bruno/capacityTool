'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { rotuloArea } from '../../lib/dias';
import { UNIDADES } from '../../lib/formato';

export default function Filtros({ areas, areaId, ano, anos, unidade }) {
  const router = useRouter();
  const params = useSearchParams();
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState(null);

  function muda(campo, valor) {
    const p = new URLSearchParams(params.toString());
    p.set(campo, valor);
    router.push('?' + p.toString());
  }

  async function recalcular() {
    setRodando(true);
    setErro(null);
    try {
      const r = await fetch('/api/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId, ano }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setRodando(false);
    }
  }

  return (
    <div className="filtros">
      <select value={areaId} onChange={(e) => muda('area', e.target.value)}>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>{rotuloArea(a)}</option>
        ))}
      </select>

      <select value={ano} onChange={(e) => muda('ano', e.target.value)}>
        {anos.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>

      {/* A unidade muda só a leitura: o dado trafega sempre em minutos. */}
      <select value={unidade} onChange={(e) => muda('unidade', e.target.value)}>
        {UNIDADES.map((u) => (
          <option key={u.valor} value={u.valor}>{u.rotulo}</option>
        ))}
      </select>

      <button className="btn" onClick={recalcular} disabled={rodando}>
        {rodando ? 'Calculando…' : 'Recalcular'}
      </button>

      {erro && (
        <span style={{ fontSize: 13, color: '#a32d2d', alignSelf: 'center' }}>
          {erro}
        </span>
      )}
    </div>
  );
}
