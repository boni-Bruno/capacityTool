'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS } from '../../../lib/dias';

const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

// Horário do turno por dia da semana. Sem data em lugar nenhum: o cadastro
// guarda a configuração atual, não uma linha do tempo.
//
// Os minutos que o motor enxerga (máquina e pessoa) ficam na mesma tabela em
// vez de num painel separado — a diferença entre as duas colunas é o intervalo
// de refeição, e é a pergunta que sempre aparece olhando esta tela.
export default function EditorHorario({ turnoId, horarios }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(null);
  const [form, setForm] = useState({
    hora_inicio: '', hora_fim: '', intervalo_pessoa: '',
  });
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  function abrir(h) {
    setErro(null);
    setAberto(h.dia_semana);
    setForm({
      hora_inicio: hhmm(h.hora_inicio) || '06:00',
      hora_fim: hhmm(h.hora_fim) || '14:00',
      // Dia sem horário nasce com o intervalo do dia anterior configurado, se
      // houver: quem está definindo sábado quase sempre quer partir do que já
      // vale na semana e então zerar.
      intervalo_pessoa: String(h.min_intervalo ?? 0),
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

  const set = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Dia em que conta</th>
            <th>Início</th>
            <th>Fim</th>
            <th className="num">Bruto</th>
            <th className="num" title="Minutos descontados da pessoa neste dia">
              Intervalo
            </th>
            <th className="num">Máquina</th>
            <th className="num">Pessoa</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {horarios.map((h) => {
            const existe = h.horario_id !== null;

            if (aberto === h.dia_semana) {
              return (
                <tr key={h.dia_semana} className="linha-edit">
                  <td>{DIAS[h.dia_semana]}</td>
                  <td><input type="time" value={form.hora_inicio} onChange={set('hora_inicio')} /></td>
                  <td><input type="time" value={form.hora_fim} onChange={set('hora_fim')} /></td>
                  {/* Bruto vem do trigger; o intervalo é o único número que se
                      digita aqui, e ele fica sob a própria coluna. */}
                  <td className="num muted">—</td>
                  <td className="num">
                    <input
                      className="intervalo-min"
                      type="number" min="0" max="1439" step="1"
                      value={form.intervalo_pessoa}
                      onFocus={(e) => e.target.select()}
                      onChange={set('intervalo_pessoa')}
                      title="Minutos de refeição/pausa descontados da pessoa neste dia. 0 = sem desconto."
                    />
                  </td>
                  <td className="num muted" colSpan={2}>calculado pelo banco</td>
                  <td className="acoes">
                    <button
                      className="btn btn-primario btn-mini" disabled={salvando}
                      onClick={() => chamar('POST', {
                        turno_id: turnoId, dia_semana: h.dia_semana, ...form,
                        // Campo apagado é zero, não "não mexe": quem limpou o
                        // intervalo quer o dia sem desconto, e deixar '' faria
                        // o Salvar ignorar em silêncio.
                        intervalo_pessoa: form.intervalo_pessoa === ''
                          ? 0 : Number(form.intervalo_pessoa),
                      })}
                    >
                      {salvando ? '…' : 'Salvar'}
                    </button>
                    <button className="btn btn-mini" disabled={salvando}
                            onClick={() => { setAberto(null); setErro(null); }}>
                      Cancelar
                    </button>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={h.dia_semana} className={existe ? '' : 'linha-vazia'}>
                <td>{DIAS[h.dia_semana]}</td>
                <td>{existe ? hhmm(h.hora_inicio) : <span className="muted">não roda</span>}</td>
                <td>
                  {existe ? hhmm(h.hora_fim) : ''}
                  {h.cruza_meia_noite && (
                    <span className="selo vira" title="O turno entra na véspera e sai neste dia">
                      começa no dia anterior
                    </span>
                  )}
                </td>
                <td className="num">{existe ? h.min_bruto : ''}</td>
                <td className="num">
                  {!existe ? ''
                    : Number(h.min_intervalo) > 0
                      ? h.min_intervalo
                      : <span className="muted" title="Sem desconto neste dia">0</span>}
                </td>
                <td className="num">{existe ? h.min_maquina : ''}</td>
                <td className={'num' + (existe && Number(h.min_pessoa) <= 0 ? ' erro-cel' : '')}
                    title={existe && Number(h.min_pessoa) <= 0
                      ? 'O intervalo come o turno inteiro: a pessoa não produz nada neste dia.'
                      : undefined}>
                  {existe ? h.min_pessoa : ''}
                </td>
                <td className="acoes">
                  <button className="btn btn-mini" onClick={() => abrir(h)}>
                    {existe ? 'Alterar' : 'Definir'}
                  </button>
                  {existe && (
                    <button
                      className="btn btn-mini" disabled={salvando}
                      onClick={() => chamar('DELETE', {
                        turno_id: turnoId, dia_semana: h.dia_semana,
                      })}
                    >
                      Não roda
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {erro && <p className="erro">{erro}</p>}

      <div className="aviso" style={{ marginTop: 14 }}>
        <strong>O dia da linha é o dia em que o turno termina.</strong>
        <p style={{ margin: '6px 0 0' }}>
          Um turno de 22:00 às 05:00 cadastrado em <strong>terça</strong> entra
          na segunda à noite e sai na terça de manhã — e os 420 minutos contam
          na terça. É por isso que, com feriado na terça, ele não entra na
          segunda 22:00: aquela noite é a folga do feriado.
          {' '}Cadastre no dia em que o turno <strong>conta</strong>, não no dia
          em que ele começa.
        </p>
      </div>

      <p className="rodape">
        Máquina e pessoa diferem pelo <strong>intervalo</strong>: máquina não
        para para almoçar. Quem decide é o <code>tipo_recurso</code> do recurso,
        não o turno.
        {' '}O intervalo é <strong>por dia da semana</strong> — sábado de meio
        período pode ter 0 enquanto a semana tem 30, e mudar um dia não mexe nos
        outros. Grava junto com o horário, no mesmo Salvar.
        {' '}O banco recusa só duração fora de 1 a 1440 minutos; se o intervalo
        passar da duração do turno, a coluna Pessoa fica vermelha.
      </p>
    </>
  );
}
