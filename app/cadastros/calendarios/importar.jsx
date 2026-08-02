'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Copia um calendário de outra planta.
//
// Planta nova costuma repetir o desenho de uma existente e mudar só os
// feriados. Montar do zero é retrabalho — e é onde se esquece de marcar um dia
// e o cálculo sai errado sem avisar.
export default function Importar({ plantas, origens }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [feito, setFeito] = useState(null);

  const daOrigem = origens.find((o) => String(o.id) === String(origem));

  async function importar() {
    setOcupado(true);
    setErro(null);
    setFeito(null);
    try {
      const r = await fetch('/api/cadastro/calendario-copia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origem_id: origem, planta_destino_id: destino, codigo, nome,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);

      setFeito(
        `Calendário criado com ${j.regras} regra(s).` +
        (j.turnosCriados.length
          ? ` Turnos criados na planta de destino: ${j.turnosCriados.join(', ')} — ` +
            `com os horários e intervalos da origem.`
          : ' Todos os turnos já existiam no destino.')
      );
      setOrigem(''); setDestino(''); setCodigo(''); setNome('');
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(false);
    }
  }

  if (!aberto) {
    return (
      <div className="acoes" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => setAberto(true)}
                disabled={origens.length === 0 || plantas.length < 2}>
          Importar de outra planta
        </button>
        {plantas.length < 2 && (
          <span className="muted">é preciso ter mais de uma planta</span>
        )}
        {feito && <span className="muted">{feito}</span>}
      </div>
    );
  }

  return (
    <div className="painel" style={{ marginTop: 14, marginBottom: 0 }}>
      <h2>Importar calendário</h2>

      <div className="form-grade">
        <label className="campo">
          <span className="campo-rot">Copiar de</span>
          <select value={origem} onChange={(e) => {
            setOrigem(e.target.value);
            const o = origens.find((x) => String(x.id) === e.target.value);
            setCodigo(o?.codigo ?? '');
            setNome(o?.nome ?? '');
          }}>
            <option value="">selecione…</option>
            {origens.map((o) => (
              <option key={o.id} value={o.id}>{o.planta} · {o.nome}</option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span className="campo-rot">Para a planta</span>
          <select value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">selecione…</option>
            {plantas
              .filter((p) => !daOrigem || p.id !== daOrigem.planta_id)
              .map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>

        <label className="campo">
          <span className="campo-rot">Código no destino</span>
          <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </label>

        <label className="campo">
          <span className="campo-rot">Nome no destino</span>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
      </div>

      <p className="rodape">
        Turno é por planta, então as regras são casadas pelo <strong>código</strong>{' '}
        do turno. O que não existir no destino é criado com os horários e
        intervalos da origem — sem isso o calendário importado nasceria sem
        produzir capacidade nenhuma. Os feriados <strong>não</strong> vêm junto:
        eles são o que muda de cidade para cidade.
      </p>

      <div className="acoes" style={{ marginTop: 12 }}>
        <button className="btn btn-primario" onClick={importar}
                disabled={ocupado || !origem || !destino}>
          {ocupado ? 'Importando…' : 'Importar'}
        </button>
        <button className="btn" onClick={() => { setAberto(false); setErro(null); }}
                disabled={ocupado}>
          Cancelar
        </button>
        {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
      </div>
    </div>
  );
}
