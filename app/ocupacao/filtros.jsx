'use client';

import { useRouter, useSearchParams } from 'next/navigation';

// A base de demanda deste painel.
//
// ELA PODE NÃO SER A CORRENTE. A carga que está no ar serve à conversão em
// metro e vale para todo o sistema; a ocupação pode querer comparar contra
// outro cenário sem trocar o que todo mundo vê.
//
// Importar é na tela de Demanda, e não aqui: é lá que a carga se confere antes
// de existir, e ter dois caminhos para a mesma importação faria a conferência
// virar opcional em um deles.

export default function FiltrosOcupacao({ cargas, carga }) {
  const router = useRouter();
  const params = useSearchParams();

  const muda = (valor) => {
    const p = new URLSearchParams(params.toString());
    if (valor) p.set('carga', valor); else p.delete('carga');
    router.push(`?${p.toString()}`);
  };

  return (
    <div className="filtros">
      <label className="campo">
        <span className="campo-rot">Base de demanda</span>
        <select value={carga ?? ''} onChange={(e) => muda(e.target.value)}>
          {cargas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.cenario}{c.corrente ? ' · no ar' : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
