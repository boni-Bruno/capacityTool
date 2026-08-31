'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const hoje = () => new Date().toISOString().slice(0, 10);

const vazio = () => ({
  recurso_id: '', tipo_parada_id: '', turno_id: '',
  data_inicio: hoje(), data_fim: hoje(),
  minutos: '', dia_inteiro: false, descricao: '',
});

// A mesma lista, ordenada por código. Quem cadastra parada costuma ter o
// patrimônio na mão — a ordem por nome não ajuda a achar.
const porCodigo = (lista) =>
  [...lista].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR'));

export default function EditorParadas({ recursos, tipos, turnos, paradas,
                                        filtrado = false }) {
  const router = useRouter();
  const [form, setForm] = useState(vazio);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const set = (c) => (e) =>
    setForm((f) => ({
      ...f,
      [c]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));

  async function chamar(metodo, corpo) {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch('/api/cadastro/parada', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      if (metodo === 'POST') setForm(vazio());
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setSalvando(false);
    }
  }

  const podeSalvar =
    form.recurso_id && form.tipo_parada_id &&
    (form.dia_inteiro || form.minutos !== '');

  return (
    <>
      <div className="painel">
        <h2>Nova parada</h2>

        <div className="form-grade">
          {/* Código primeiro: é a identidade da máquina na controladoria, e o
              nome vem em seguida para confirmar que é ela mesma. Os dois
              gravam o mesmo recurso_id, então mexer num acerta o outro. */}
          <label className="campo">
            <span className="campo-rot">Código</span>
            <select value={form.recurso_id} onChange={set('recurso_id')}>
              <option value="">selecione…</option>
              {porCodigo(recursos).map((r) => (
                <option key={r.id} value={r.id}>{r.codigo}</option>
              ))}
            </select>
          </label>

          <label className="campo">
            <span className="campo-rot">Recurso</span>
            <select value={form.recurso_id} onChange={set('recurso_id')}>
              <option value="">selecione…</option>
              {recursos.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </label>

          <label className="campo">
            <span className="campo-rot">Tipo</span>
            <select value={form.tipo_parada_id} onChange={set('tipo_parada_id')}>
              <option value="">selecione…</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>

          <label className="campo">
            <span className="campo-rot">Turno</span>
            <select value={form.turno_id} onChange={set('turno_id')}>
              <option value="">todos os turnos</option>
              {turnos.map((t) => <option key={t.id} value={t.id}>{t.codigo}</option>)}
            </select>
          </label>

          <label className="campo">
            <span className="campo-rot">De</span>
            <input type="date" value={form.data_inicio} onChange={set('data_inicio')} />
          </label>

          <label className="campo">
            <span className="campo-rot">Até</span>
            <input type="date" value={form.data_fim} onChange={set('data_fim')} />
          </label>

          <label className="campo">
            <span className="campo-rot">Minutos por turno</span>
            <input
              type="number" min="0" placeholder="ex.: 120"
              value={form.dia_inteiro ? '' : form.minutos}
              onChange={set('minutos')}
              disabled={form.dia_inteiro}
            />
          </label>

          <label className="campo campo-check">
            <input type="checkbox" checked={form.dia_inteiro} onChange={set('dia_inteiro')} />
            <span>Dia inteiro (zera o dia)</span>
          </label>

          <label className="campo campo-largo">
            <span className="campo-rot">Descrição</span>
            <input type="text" value={form.descricao} onChange={set('descricao')} />
          </label>
        </div>

        <div className="acoes" style={{ marginTop: 14 }}>
          <button
            className="btn btn-primario"
            disabled={!podeSalvar || salvando}
            onClick={() => chamar('POST', form)}
          >
            {salvando ? 'Salvando…' : 'Cadastrar parada'}
          </button>
          {erro && <span className="erro">{erro}</span>}
        </div>

        <p className="rodape">
          Minutos é sempre <strong>por turno</strong>. Parada que atinge a planta
          inteira não vai aqui — vai em <code>excecao</code>. E setup não entra:
          já está embutido no OEE.
        </p>
      </div>

      <div className="painel">
        <h2>Paradas do período</h2>
        {paradas.length === 0 ? (
          // Com filtro ativo, "nenhuma parada neste ano" seria mentira: elas
          // podem existir e estar fora do recorte. A frase precisa dizer onde
          // procurar, senão alguém cadastra a mesma parada duas vezes.
          <p className="muted">
            {filtrado
              ? 'Nenhuma parada neste recorte — limpe os filtros de CC, CT ou '
                + 'recurso para ver o ano inteiro da área.'
              : 'Nenhuma parada cadastrada neste ano.'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Recurso</th>
                <th>Tipo</th>
                <th>Turno</th>
                <th>Período</th>
                <th className="num">Minutos</th>
                <th>Descrição</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paradas.map((p) => (
                <tr key={p.id}>
                  <td className="muted">{p.recurso_codigo}</td>
                  <td>{p.recurso}</td>
                  <td>
                    <span className="ponto" style={{ background: p.cor ?? '#999' }} />
                    {p.tipo}
                    {!p.abate_planejada && (
                      <span className="selo padrao" style={{ marginLeft: 6 }}>
                        não abate
                      </span>
                    )}
                  </td>
                  <td>{p.turno ?? <span className="muted">todos</span>}</td>
                  <td className="muted">
                    {p.data_inicio === p.data_fim
                      ? p.data_inicio
                      : `${p.data_inicio} → ${p.data_fim}`}
                  </td>
                  <td className="num">
                    {p.dia_inteiro ? <span className="muted">dia inteiro</span> : p.minutos}
                  </td>
                  <td>{p.descricao}</td>
                  <td className="acoes">
                    <button
                      className="btn btn-mini"
                      disabled={salvando}
                      onClick={() => chamar('DELETE', { id: p.id })}
                    >
                      Apagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="rodape">
          Apagar remove a parada de verdade — ela não tem vigência. O número já
          calculado continua guardado na rodada anterior, então dá para comparar.
        </p>
      </div>
    </>
  );
}
