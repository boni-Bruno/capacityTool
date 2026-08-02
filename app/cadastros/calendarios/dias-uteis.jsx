'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS, MESES } from '../../../lib/dias';
import { PESO_PADRAO, diasUteisPorMes, formataDiasUteis, lePeso } from '../../../lib/dia-util';

// Peso de cada dia da semana e o resultado mês a mês.
//
// A contagem crua vem do servidor (quantos sábados o calendário trabalha em
// março, etc.) e o peso é aplicado aqui, ao vivo: mexer no peso do sábado
// mostra o efeito nos doze meses antes de salvar.
export default function DiasUteis({ calendarioId, contagem, pesos, ano }) {
  const router = useRouter();
  const [valores, setValores] = useState(() =>
    Object.fromEntries(pesos.map((p, d) => [d, String(p).replace('.', ',')])));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const lidos = useMemo(
    () => pesos.map((_, d) => lePeso(valores[d]) ?? 0),
    [valores, pesos]);

  const invalido = pesos.some((_, d) => lePeso(valores[d]) === null);

  const meses = useMemo(
    () => diasUteisPorMes(contagem, lidos), [contagem, lidos]);

  const total = meses.reduce((s, v) => s + v, 0);

  const sujo = pesos.some((p, d) => (lePeso(valores[d]) ?? 0) !== p);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      const r = await fetch('/api/cadastro/calendario-peso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendario_id: calendarioId,
          pesos: Object.fromEntries(lidos.map((p, d) => [d, p])),
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setOk('Pesos salvos.');
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setSalvando(false);
    }
  }

  function restaurar() {
    setValores(Object.fromEntries(
      PESO_PADRAO.map((p, d) => [d, String(p).replace('.', ',')])));
    setOk(null);
  }

  return (
    <>
      <div className="pesos">
        {DIAS.map((rotulo, dia) => (
          <label key={dia} className="campo">
            <span className="campo-rot">{rotulo}</span>
            <input
              type="text" inputMode="decimal"
              className={lePeso(valores[dia]) === null ? 'invalido' : ''}
              value={valores[dia] ?? ''}
              onChange={(e) => {
                setValores((v) => ({ ...v, [dia]: e.target.value }));
                setOk(null);
              }}
            />
          </label>
        ))}
      </div>

      <div className="acoes" style={{ marginTop: 12 }}>
        <button className="btn btn-primario" onClick={salvar}
                disabled={!sujo || invalido || salvando}>
          {salvando ? 'Salvando…' : 'Salvar pesos'}
        </button>
        <button className="btn" onClick={restaurar} disabled={salvando}>
          Voltar ao padrão
        </button>
        {invalido && <span className="erro" style={{ margin: 0 }}>Use um valor de 0 a 1.</span>}
        {sujo && !invalido && !salvando && <span className="muted">não salvo</span>}
        {ok && <span className="muted">{ok}</span>}
        {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
      </div>

      <div className="grade-rolagem" style={{ marginTop: 18 }}>
        <table className="tabela-mes">
          <thead>
            <tr>
              <th>Dias úteis em {ano}</th>
              {MESES.slice(1).map((m) => <th key={m} className="num">{m}</th>)}
              <th className="num">ano</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>trabalhados</td>
              {MESES.slice(1).map((m, i) => (
                <td key={m} className="num">{formataDiasUteis(meses[i + 1])}</td>
              ))}
              <td className="num forte">{formataDiasUteis(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="rodape">
        O peso só conta nos dias que este calendário trabalha: sábado sem turno
        na grade acima vale zero, não 0,5. Feriado cadastrado já sai da conta.
        Isto é indicador de leitura — a capacidade continua sendo calculada em
        minutos e não usa estes pesos.
      </p>
    </>
  );
}
