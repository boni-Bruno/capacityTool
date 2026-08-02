import { Suspense } from 'react';
import { turnos, horariosDoTurno, intervalosDoTurno, minutosEfetivos } from '../../../lib/cadastro';
import { DIAS } from '../../../lib/dias';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import EditorHorario from './editor';

export const dynamic = 'force-dynamic';

const hoje = () => new Date().toISOString().slice(0, 10);

export default async function Page({ searchParams }) {
  let lista;
  try {
    lista = await turnos();
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  if (!lista.length) {
    return (
      <div className="aviso">
        <strong>Nenhum turno cadastrado.</strong>
        <p style={{ margin: '8px 0 0' }}>
          Rode <code>02_seed.sql</code> ou cadastre um turno direto no banco —
          a tela de criar turno ainda não existe.
        </p>
      </div>
    );
  }

  const turnoId = Number(searchParams?.turno ?? lista[0].id);
  const data = searchParams?.data ?? hoje();
  const turno = lista.find((t) => t.id === turnoId) ?? lista[0];

  const [horarios, intervalos, efetivos] = await Promise.all([
    horariosDoTurno(turnoId, data),
    intervalosDoTurno(turnoId),
    minutosEfetivos(turnoId, data),
  ]);

  // vw_turno_minutos devolve uma linha por dia x tipo de recurso.
  // A tela mostra lado a lado porque a diferença entre as duas colunas é
  // exatamente o intervalo de refeição — e é a pergunta que sempre aparece.
  const porDia = DIAS.map((_, dia) => ({
    dia,
    maquina: efetivos.find((e) => e.dia_semana === dia && e.tipo_recurso === 'MAQUINA'),
    pessoa: efetivos.find((e) => e.dia_semana === dia && e.tipo_recurso === 'PESSOA'),
  }));

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Horários do turno</h1>
        <Suspense>
          <Seletor
            campos={[
              {
                nome: 'turno', rotulo: 'Turno', tipo: 'select', valor: String(turnoId),
                opcoes: lista.map((t) => ({ valor: String(t.id), rotulo: `${t.codigo} — ${t.nome}` })),
              },
              { nome: 'data', rotulo: 'Vigente em', tipo: 'data', valor: data },
            ]}
          />
        </Suspense>
      </div>

      <div className="painel">
        <h2>{turno.nome} · o que vale em {data}</h2>
        <EditorHorario turnoId={turnoId} horarios={horarios} data={data} />
      </div>

      <div className="painel">
        <h2>Intervalos</h2>
        {intervalos.length === 0 ? (
          <p className="muted">Nenhum intervalo cadastrado neste turno.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th className="num">Minutos</th>
                <th>Desconta de</th>
              </tr>
            </thead>
            <tbody>
              {intervalos.map((i) => (
                <tr key={i.id}>
                  <td>{i.descricao}</td>
                  <td className="num">{i.minutos}</td>
                  <td>
                    {!i.descontavel
                      ? <span className="muted">não desconta</span>
                      : i.aplica_a === 'AMBOS' ? 'máquina e pessoa'
                      : i.aplica_a.toLowerCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="rodape">
          Máquina não para para almoçar; posto de pessoa para. Quem decide é o
          <code> tipo_recurso</code> do recurso, não o turno.
        </p>
      </div>

      <div className="painel">
        <h2>Minutos que o motor enxerga</h2>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th className="num">Bruto</th>
              <th className="num">Máquina</th>
              <th className="num">Pessoa</th>
            </tr>
          </thead>
          <tbody>
            {porDia.map((l) => (
              <tr key={l.dia} className={l.maquina ? '' : 'linha-vazia'}>
                <td>{DIAS[l.dia]}</td>
                <td className="num">{l.maquina?.duracao_turno ?? <span className="muted">—</span>}</td>
                <td className="num">{l.maquina?.minutos ?? ''}</td>
                <td className="num">{l.pessoa?.minutos ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rodape">
          Isto é a <code>vw_turno_minutos</code> — o número que entra na
          planejada. Dia sem linha aqui não gera capacidade nenhuma.
        </p>
      </div>
    </>
  );
}
