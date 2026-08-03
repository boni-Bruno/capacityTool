'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { rotuloArea } from '../../lib/dias';
import { UNIDADES } from '../../lib/formato';

export default function Filtros({
  areas, areaId, ano, anos, unidade, subAreas = [], sub = null, tipo = null,
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState(null);

  function muda(campo, valor) {
    const p = new URLSearchParams(params.toString());
    if (valor === '') p.delete(campo); else p.set(campo, valor);

    // Trocar de filtro invalida o recurso clicado e o nível do drill-down:
    // o recurso pode não estar mais na seleção, e o dia aberto era do
    // conjunto antigo.
    if (campo === 'sub' || campo === 'tipo' || campo === 'area') {
      p.delete('recurso'); p.delete('mes'); p.delete('dia');
    }
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

      {subAreas.length > 0 && (
        <select value={sub ?? ''} onChange={(e) => muda('sub', e.target.value)}>
          <option value="">todas as sub-áreas</option>
          {subAreas.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      <select value={tipo ?? ''} onChange={(e) => muda('tipo', e.target.value)}>
        <option value="">máquina e pessoa</option>
        <option value="MAQUINA">só máquina</option>
        <option value="PESSOA">só pessoa</option>
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
