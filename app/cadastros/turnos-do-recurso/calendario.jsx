'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS } from '../../../lib/dias';

// Regime de dias do recurso. Fica junto da matriz de turnos porque é assim que
// quem cadastra pensa: "essa máquina trabalha em rodízio" é da mesma família
// de decisão que "essa máquina roda o 3º turno".
//
// Não virou coluna da matriz porque não é um turno: os regimes são exclusivos
// entre si, e o que eles definem é em que DIAS o recurso pode rodar, não uma
// jornada a mais.
export default function Calendario({ recursoId, opcoes }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const atual = opcoes.find((o) => o.atual);

  async function escolher(calendarioId) {
    if (String(calendarioId) === String(atual?.id)) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch('/api/cadastro/recurso-calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurso_id: recursoId, calendario_id: calendarioId }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setSalvando(false);
    }
  }

  if (!opcoes.length) {
    return <p className="muted">Nenhum calendário cadastrado nesta planta.</p>;
  }

  return (
    <>
      <div className="regimes">
        {opcoes.map((o) => (
          <button
            key={o.id}
            className={'regime' + (o.atual ? ' regime-ativo' : '')}
            disabled={salvando}
            onClick={() => escolher(o.id)}
          >
            <span className="regime-nome">{o.nome}</span>
            <span className="regime-dias">{descreveDias(o.dias)}</span>
          </button>
        ))}
      </div>

      {erro && <p className="erro">{erro}</p>}

      <p className="rodape">
        O regime define em que <strong>dias</strong> o recurso pode rodar.
        Rodízio inclui domingo — na empresa quem faz rodízio é a pessoa, com
        folgas em dias diferentes se cobrindo, e a máquina nunca para. Os turnos
        marcados abaixo só produzem capacidade nos dias que o regime permite.
      </p>
    </>
  );
}

// dias vem do banco como '0,1,2,3,4,5,6'. Vira "domingo a sábado" quando é
// uma sequência inteira, senão lista os dias.
function descreveDias(dias) {
  if (!dias) return 'nenhum dia configurado';

  const n = dias.split(',').map(Number).sort((a, b) => a - b);
  if (!n.length) return 'nenhum dia configurado';
  if (n.length === 7) return 'todos os dias';

  const sequencia = n.every((d, i) => i === 0 || d === n[i - 1] + 1);
  if (sequencia && n.length > 2) return `${DIAS[n[0]]} a ${DIAS[n[n.length - 1]]}`;
  return n.map((d) => DIAS[d]).join(', ');
}
