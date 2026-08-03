'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS } from '../../../lib/dias';

// Em que dias da semana esta linha trabalha.
//
// Era uma matriz dia x turno. A coluna do turno duplicava o turno_horario — se
// o turno não tem horário no dia, ele já não roda — e a duplicação fazia turno
// novo produzir zero em silêncio. Agora são sete caixas: o calendário diz o
// dia, o turno diz a hora, o recurso diz quais turnos faz.
export default function Regras({ calendarioId, dias }) {
  const router = useRouter();
  const [marcados, setMarcados] = useState(() => new Set(dias));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const sujo = useMemo(() => {
    if (marcados.size !== dias.length) return true;
    return dias.some((d) => !marcados.has(d));
  }, [marcados, dias]);

  function alterna(d) {
    setMarcados((s) => {
      const novo = new Set(s);
      if (novo.has(d)) novo.delete(d); else novo.add(d);
      return novo;
    });
    setOk(null);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      const r = await fetch('/api/cadastro/calendario-regra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendario_id: calendarioId,
          dias: [...marcados].sort((a, b) => a - b),
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setOk(`${j.dias} dia(s) por semana.`);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="acoes">
        {DIAS.map((rotulo, d) => (
          <label key={d} className={'caixa' + (marcados.has(d) ? ' caixa-on' : '')}>
            <input type="checkbox" checked={marcados.has(d)} onChange={() => alterna(d)} />
            <span>{rotulo}</span>
          </label>
        ))}
      </div>

      <div className="acoes" style={{ marginTop: 14 }}>
        <button className="btn btn-primario" onClick={salvar} disabled={!sujo || salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        {sujo && !salvando && <span className="muted">alterações não salvas</span>}
        {ok && <span className="muted">{ok}</span>}
        {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
      </div>

      <p className="rodape">
        Dia desmarcado não produz capacidade nenhuma nesta linha, em nenhum
        turno. Quais turnos rodam nos dias marcados vem do horário do turno
        (turno sem horário na terça não roda na terça) cruzado com os turnos que
        cada recurso faz.
      </p>
    </>
  );
}
