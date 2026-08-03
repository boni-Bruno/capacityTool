'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { rotuloArea } from '../../lib/dias';
import { UNIDADES } from '../../lib/formato';
import { ORIGENS, rotuloOrigem } from '../../lib/origens';

// Os filtros do painel moram em dois lugares.
//
// No topo fica o que define QUAL cálculo se está olhando: a área e a origem
// do OEE, porque a rodada é por área e por origem, e o botão que dispara uma
// nova. Trocar de origem troca de rodada — não recalcula nada.
//
// Os de recorte — ano, sub-área, tipo e unidade — ficam junto da tabela por
// recurso, que é onde se escolhe o que olhar. Todos vivem na URL, então
// continuam valendo para os indicadores e o gráfico lá em cima.

// Um lugar só mexe na URL: campo vazio some do endereço em vez de virar
// "sub=", e trocar de recorte derruba o que dependia do recorte antigo.
function useMuda() {
  const router = useRouter();
  const params = useSearchParams();

  return function muda(campo, valor) {
    const p = new URLSearchParams(params.toString());
    if (valor === '') p.delete(campo); else p.set(campo, valor);

    // O recurso clicado pode não estar mais na seleção, e o dia aberto era do
    // conjunto antigo — manter mostraria número de um recorte que sumiu.
    if (campo === 'sub' || campo === 'tipo' || campo === 'area'
        || campo === 'origem') {
      p.delete('recurso'); p.delete('mes'); p.delete('dia');
    }
    router.push('?' + p.toString());
  };
}

export function FiltrosTopo({ areas, areaId, ano, origem }) {
  const router = useRouter();
  const muda = useMuda();
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState(null);

  async function recalcular() {
    setRodando(true);
    setErro(null);
    try {
      const r = await fetch('/api/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId, ano, origem }),
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

      {/* Muda de rodada, não recalcula: META e SIMULADO já estão calculadas
          e guardadas cada uma na sua. */}
      <select value={origem} onChange={(e) => muda('origem', e.target.value)}>
        {ORIGENS.map((o) => (
          <option key={o} value={o}>
            OEE {rotuloOrigem(o)}
          </option>
        ))}
      </select>

      <button className="btn" onClick={recalcular} disabled={rodando}
              title={`Recalcular o OEE ${rotuloOrigem(origem)} deste ano`}>
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

export function FiltrosRecurso({ ano, anos, unidade, subAreas = [], sub = null, tipo = null }) {
  const muda = useMuda();

  return (
    <div className="filtros">
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
    </div>
  );
}
