'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MESES } from '../../../lib/dias';

// Matriz de turnos: uma linha por mês, uma coluna por turno.
//
// A célula guarda TEXTO — '' é "não trabalha", e um número é quantas máquinas
// do recurso rodam ali. Recurso de uma máquina só continua vendo caixinha de
// marcar: pedir "1 ou vazio" num campo numérico seria pior para o caso comum,
// que é a maioria esmagadora das linhas.
//
// Por baixo isso vira daterange no banco, e meses vizinhos com a MESMA
// quantidade colam numa faixa só. A tela não mostra vigência nenhuma: para
// planejar capacidade, o que importa é "quantas rodam neste mês".

const chave = (turnoId, mes) => `${turnoId}:${mes}`;

// Quando o número é o total, o cadastro guarda "todas" (null no banco) em vez
// do número — assim o turno acompanha se a quantidade do recurso mudar.
const TODAS = 'todas';

export default function Matriz({
  recursoId, ano, turnos, inicial, parciais, qtRecurso = 1,
}) {
  const router = useRouter();
  const [celulas, setCelulas] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  // Uma máquina só: a quantidade não tem o que dizer, e a caixa de marcar é
  // mais rápida e menos sujeita a erro de digitação.
  const simples = qtRecurso === 1;

  // Comparar com o estado inicial evita habilitar Salvar à toa e deixa claro
  // quando há alteração pendente — a tela salva em lote, não a cada clique.
  const sujo = useMemo(() => {
    const chaves = new Set([...Object.keys(celulas), ...Object.keys(inicial)]);
    return [...chaves].some((k) => (celulas[k] ?? '') !== (inicial[k] ?? ''));
  }, [celulas, inicial]);

  const ligada = (k) => (celulas[k] ?? '') !== '';

  function poe(turnoId, mes, valor) {
    setCelulas((c) => ({ ...c, [chave(turnoId, mes)]: valor }));
    setOk(null);
  }

  function alterna(turnoId, mes) {
    poe(turnoId, mes, ligada(chave(turnoId, mes)) ? '' : String(qtRecurso));
  }

  // Preencher em lote usa o total: é o que quase sempre se quer, e ajustar uma
  // célula depois é mais rápido do que preencher doze.
  function alternaMes(mes) {
    const todos = turnos.every((t) => ligada(chave(t.turno_id, mes)));
    setCelulas((c) => {
      const novo = { ...c };
      for (const t of turnos) {
        novo[chave(t.turno_id, mes)] = todos ? '' : String(qtRecurso);
      }
      return novo;
    });
    setOk(null);
  }

  // Quantos meses do ano estão ligados para o turno — decide se a caixa do
  // cabeçalho aparece cheia, vazia ou pela metade.
  const contaDoTurno = (turnoId) => {
    let n = 0;
    for (let mes = 1; mes <= 12; mes++) if (ligada(chave(turnoId, mes))) n++;
    return n;
  };

  function alternaTurno(turnoId) {
    const todos = contaDoTurno(turnoId) === 12;
    setCelulas((c) => {
      const novo = { ...c };
      for (let mes = 1; mes <= 12; mes++) {
        novo[chave(turnoId, mes)] = todos ? '' : String(qtRecurso);
      }
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
        const porMes = {};
        for (let mes = 1; mes <= 12; mes++) {
          const v = celulas[chave(t.turno_id, mes)] ?? '';
          if (v === '') continue;
          const n = Number(v);
          if (!Number.isInteger(n) || n < 1 || n > qtRecurso) {
            throw new Error(
              `${t.nome}, ${MESES[mes]}: informe um número inteiro de 1 a `
              + `${qtRecurso}, ou deixe vazio para não trabalhar.`);
          }
          porMes[mes] = n === qtRecurso ? TODAS : n;
        }
        marcados[t.turno_id] = porMes;
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
                      title={simples
                        ? 'Marcar ou desmarcar todos os turnos deste mês'
                        : 'Preencher ou limpar todos os turnos deste mês'}
                    >
                      {rotulo}
                    </button>
                  </td>
                  {turnos.map((t) => {
                    const k = chave(t.turno_id, mes);
                    return (
                      <td key={t.turno_id} className="matriz-cel">
                        <label className="matriz-flag">
                          {simples ? (
                            <input
                              type="checkbox"
                              checked={ligada(k)}
                              onChange={() => alterna(t.turno_id, mes)}
                            />
                          ) : (
                            <input
                              className="matriz-qt"
                              type="number"
                              min="1"
                              max={qtRecurso}
                              placeholder="—"
                              title={`Quantas das ${qtRecurso} máquinas rodam neste turno. Vazio = não trabalha.`}
                              value={celulas[k] ?? ''}
                              onChange={(e) => poe(t.turno_id, mes, e.target.value)}
                            />
                          )}
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
        <strong>ano todo</strong> {simples ? 'marca ou desmarca' : 'preenche ou limpa'}{' '}
        os doze meses daquele turno de uma vez; a caixa fica pela metade quando
        só parte do ano está {simples ? 'marcada' : 'preenchida'}. Clicar no
        nome do mês faz o mesmo com a linha. Salvar aplica o ano de {ano} — o
        que estiver configurado em outros anos não é afetado.
      </p>
    </>
  );
}
