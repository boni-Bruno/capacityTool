'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MESES } from '../../../lib/dias';

// O mesmo OEE em vários recursos de uma vez.
//
// O caso é o CC: "78% em janeiro para os nove CTs do 278". Um a um são nove
// idas à mesma tela para digitar o mesmo número, e é assim que um deles fica
// de fora sem ninguém notar.
//
// MÊS EM BRANCO AQUI É SILÊNCIO, e não ordem de apagar — o contrário do editor
// de um recurso, que reescreve o ano. A diferença é de intenção: quem edita um
// recurso está dizendo como o ano dele é; quem aplica em lote está mexendo num
// mês e não quer saber dos outros. O painel diz isso em letra grande, porque
// duas leituras do mesmo branco só funcionam se a tela contar qual está valendo.
//
// O alcance é o filtro de cima. Estreitar por CC já é escolher o lote, e não
// existe uma segunda lista de recursos para manter em dia com a primeira.

export default function LoteOee({ recursos, ano, origem, escopo }) {
  const router = useRouter();
  const [meses, setMeses] = useState({});
  const [fora, setFora] = useState(() => new Set());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const alvos = recursos.filter((r) => !fora.has(r.id));
  const preenchidos = Object.entries(meses)
    .filter(([, v]) => String(v ?? '').trim() !== '');

  function muda(mes, valor) {
    setMeses((m) => ({ ...m, [mes]: valor }));
    setOk(null);
  }

  function alterna(id) {
    setFora((f) => {
      const novo = new Set(f);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
    setOk(null);
  }

  async function aplicar() {
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      const r = await fetch('/api/cadastro/oee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'lote', ano, origem,
          recursos: alvos.map((x) => x.id),
          meses: Object.fromEntries(preenchidos),
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setOk(`${j.meses} mês(es) aplicado(s) em ${j.recursos} recurso(s).`);
      setMeses({});
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="painel">
      <h2>
        Aplicar em vários
        <span className="muted" style={{ fontWeight: 400 }}>
          {' '}· {escopo} · OEE {origem === 'META' ? 'meta' : 'simulado'} · {ano}
        </span>
      </h2>

      <p className="rodape" style={{ margin: '0 0 12px' }}>
        Preencha só os meses que quer mudar: <strong>mês em branco aqui não
        apaga nada</strong> — ele fica como já está em cada recurso. É o
        contrário do editor de cima, que reescreve o ano inteiro do recurso
        aberto.
        {' '}Para trocar o alcance, use os filtros de <strong>CC</strong> e{' '}
        <strong>CT</strong> no topo da página.
      </p>

      <div className="lote-meses">
        {MESES.slice(1).map((rotulo, i) => {
          const mes = i + 1;
          return (
            <label key={mes} className="campo">
              <span className="campo-rot">{rotulo}</span>
              <div className="campo-pct">
                <input type="text" inputMode="decimal" placeholder="—"
                       value={meses[mes] ?? ''}
                       onChange={(e) => muda(mes, e.target.value)} />
                <span className="sufixo">%</span>
              </div>
            </label>
          );
        })}
      </div>

      {/* Quem entra no lote fica à vista e desmarcável. A lista é a prova do
          alcance: aplicar em nove CTs sem ver quais são os nove é o mesmo que
          aplicar no escuro. */}
      <p className="campo-rot" style={{ marginTop: 14 }}>
        {alvos.length} de {recursos.length} recursos
      </p>
      <div className="chips">
        {recursos.map((r) => (
          <button key={r.id} type="button"
                  className={`chip ${fora.has(r.id) ? '' : 'chip-on'}`}
                  onClick={() => alterna(r.id)}
                  title={fora.has(r.id) ? 'incluir no lote' : 'tirar do lote'}>
            {r.codigo}
            <span className="muted"> · {r.nome}</span>
          </button>
        ))}
      </div>

      <div className="acoes" style={{ marginTop: 16 }}>
        <button className="btn btn-primario" onClick={aplicar}
                disabled={salvando || !preenchidos.length || !alvos.length}>
          {salvando ? 'Aplicando…' : `Aplicar em ${alvos.length} recurso(s)`}
        </button>
        {!preenchidos.length && (
          <span className="muted">preencha ao menos um mês</span>
        )}
        {ok && <span className="muted">{ok}</span>}
        {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
      </div>
    </div>
  );
}
