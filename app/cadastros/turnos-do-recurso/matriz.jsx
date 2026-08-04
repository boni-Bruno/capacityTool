'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MESES } from '../../../lib/dias';

// Matriz de flags: uma linha por mês, uma coluna por turno.
//
// Marca o que roda, clica Salvar. Por baixo isso vira daterange no banco —
// meses vizinhos colam numa faixa só — mas a tela não mostra vigência nenhuma:
// para planejar capacidade, o que importa é "roda ou não roda neste mês".

const chave = (turnoId, mes) => `${turnoId}:${mes}`;

export default function Matriz({ recursoId, ano, turnos, inicial, parciais }) {
  const router = useRouter();
  const [marcado, setMarcado] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  // Comparar com o estado inicial evita habilitar Salvar à toa e deixa claro
  // quando há alteração pendente — a tela salva em lote, não a cada clique.
  const sujo = useMemo(() => {
    const a = Object.keys(marcado).filter((k) => marcado[k]).sort();
    const b = Object.keys(inicial).filter((k) => inicial[k]).sort();
    return a.length !== b.length || a.some((k, i) => k !== b[i]);
  }, [marcado, inicial]);

  function alterna(turnoId, mes) {
    const k = chave(turnoId, mes);
    setMarcado((m) => ({ ...m, [k]: !m[k] }));
    setOk(null);
  }

  function alternaMes(mes) {
    const todos = turnos.every((t) => marcado[chave(t.turno_id, mes)]);
    setMarcado((m) => {
      const novo = { ...m };
      for (const t of turnos) novo[chave(t.turno_id, mes)] = !todos;
      return novo;
    });
    setOk(null);
  }

  // Quantos meses do ano estão marcados para o turno — decide se a caixa do
  // cabeçalho aparece cheia, vazia ou pela metade.
  const contaDoTurno = (turnoId) => {
    let n = 0;
    for (let mes = 1; mes <= 12; mes++) if (marcado[chave(turnoId, mes)]) n++;
    return n;
  };

  function alternaTurno(turnoId) {
    const todos = contaDoTurno(turnoId) === 12;
    setMarcado((m) => {
      const novo = { ...m };
      for (let mes = 1; mes <= 12; mes++) novo[chave(turnoId, mes)] = !todos;
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
        const meses = [];
        for (let mes = 1; mes <= 12; mes++) {
          if (marcado[chave(t.turno_id, mes)]) meses.push(mes);
        }
        marcados[t.turno_id] = meses;
      }

      const r = await fetch('/api/cadastro/recurso-turno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurso_id: recursoId, ano, marcados }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);

      setOk(j.turnosAlterados === 0
        ? 'Nada mudou.'
        : `${j.turnosAlterados} turno${j.turnosAlterados > 1 ? 's' : ''} atualizado${j.turnosAlterados > 1 ? 's' : ''}.`);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setSalvando(false);
    }
  }

  if (!turnos.length) return <p className="muted">Nenhum turno ativo na planta.</p>;

  return (
    <>
      <div className="grade-rolagem">
        <table className="matriz">
          <thead>
            <tr>
              <th>Mês</th>
              {turnos.map((t) => (
                <th key={t.turno_id} className="matriz-turno">
                  <span className="matriz-nome" title={`Código ${t.codigo}`}>
                    {t.nome}
                  </span>
                  {/* Marcar o ano inteiro num clique. Antes isso era o nome do
                      turno sendo clicável — funcionava e ninguém descobria,
                      porque cabeçalho não parece botão. */}
                  <label className="matriz-ano">
                    <input
                      type="checkbox"
                      checked={contaDoTurno(t.turno_id) === 12}
                      ref={(el) => {
                        if (el) {
                          const n = contaDoTurno(t.turno_id);
                          el.indeterminate = n > 0 && n < 12;
                        }
                      }}
                      onChange={() => alternaTurno(t.turno_id)}
                    />
                    <span>ano todo</span>
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MESES.slice(1).map((rotulo, i) => {
              const mes = i + 1;
              return (
                <tr key={mes}>
                  <td className="matriz-mes">
                    <button
                      className="matriz-cab"
                      onClick={() => alternaMes(mes)}
                      title="Marcar ou desmarcar todos os turnos deste mês"
                    >
                      {rotulo}
                    </button>
                  </td>
                  {turnos.map((t) => {
                    const k = chave(t.turno_id, mes);
                    return (
                      <td key={t.turno_id} className="matriz-cel">
                        <label className="matriz-flag">
                          <input
                            type="checkbox"
                            checked={Boolean(marcado[k])}
                            onChange={() => alterna(t.turno_id, mes)}
                          />
                          {parciais[k] && !sujo && (
                            <span className="matriz-parcial" title="Cadastro atual cobre só parte deste mês. Salvar passa a valer o mês inteiro.">
                              ½
                            </span>
                          )}
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
        <strong>ano todo</strong> marca ou desmarca os doze meses daquele turno
        de uma vez; a caixa fica pela metade quando só parte do ano está
        marcada. Clicar no nome do mês faz o mesmo com a linha. Salvar aplica o
        ano de {ano} — o que estiver configurado em outros anos não é afetado.
      </p>
    </>
  );
}
