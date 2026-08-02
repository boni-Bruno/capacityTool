'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS } from '../../../lib/dias';

const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

export default function EditorHorario({ turnoId, horarios, data }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(null);   // dia_semana em edição
  const [form, setForm] = useState({});
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  function abrir(h) {
    setErro(null);
    setAberto(h.dia_semana);
    setForm({
      hora_inicio: hhmm(h.hora_inicio) || '06:00',
      hora_fim: hhmm(h.hora_fim) || '14:00',
      a_partir_de: data,
    });
  }

  async function chamar(metodo, corpo) {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch('/api/cadastro/turno-horario', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setAberto(null);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setSalvando(false);
    }
  }

  const salvar = (dia) =>
    chamar('POST', { turno_id: turnoId, dia_semana: dia, ...form });

  const encerrar = (dia) =>
    chamar('DELETE', { turno_id: turnoId, dia_semana: dia, em: data });

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Início</th>
            <th>Fim</th>
            <th className="num">Bruto</th>
            <th>Vigente desde</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {horarios.map((h) => (
            <Linha
              key={h.dia_semana}
              h={h}
              aberto={aberto === h.dia_semana}
              form={form}
              setForm={setForm}
              salvando={salvando}
              onAbrir={() => abrir(h)}
              onCancelar={() => { setAberto(null); setErro(null); }}
              onSalvar={() => salvar(h.dia_semana)}
              onEncerrar={() => encerrar(h.dia_semana)}
            />
          ))}
        </tbody>
      </table>

      {erro && <p className="erro">{erro}</p>}

      <p className="rodape">
        Salvar não altera a linha atual: fecha a vigência dela na data escolhida
        e abre outra. O número de qualquer data anterior continua o mesmo.
      </p>
    </>
  );
}

function Linha({ h, aberto, form, setForm, salvando,
                 onAbrir, onCancelar, onSalvar, onEncerrar }) {
  const existe = h.horario_id !== null;
  const set = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  if (aberto) {
    return (
      <tr className="linha-edit">
        <td>{DIAS[h.dia_semana]}</td>
        <td><input type="time" value={form.hora_inicio} onChange={set('hora_inicio')} /></td>
        <td><input type="time" value={form.hora_fim} onChange={set('hora_fim')} /></td>
        <td className="num muted">calculado</td>
        <td>
          <input type="date" value={form.a_partir_de} onChange={set('a_partir_de')} />
        </td>
        <td className="acoes">
          <button className="btn btn-primario" onClick={onSalvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button className="btn" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={existe ? '' : 'linha-vazia'}>
      <td>{DIAS[h.dia_semana]}</td>
      <td>{existe ? hhmm(h.hora_inicio) : <span className="muted">não roda</span>}</td>
      <td>
        {existe ? hhmm(h.hora_fim) : ''}
        {h.cruza_meia_noite && <span className="selo vira"> vira o dia</span>}
      </td>
      <td className="num">{existe ? `${h.min_bruto} min` : ''}</td>
      <td className="muted">{h.vigente_desde ?? ''}</td>
      <td className="acoes">
        <button className="btn btn-mini" onClick={onAbrir}>
          {existe ? 'Alterar' : 'Definir'}
        </button>
        {existe && (
          <button className="btn btn-mini" onClick={onEncerrar} disabled={salvando}>
            Encerrar
          </button>
        )}
      </td>
    </tr>
  );
}
