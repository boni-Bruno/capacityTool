import { Suspense } from 'react';
import { ultimaExecucao, areas, totais, porMes, porRecurso } from '../lib/db';
import Grafico from './grafico';
import Filtros from './filtros';

export const dynamic = 'force-dynamic';

const h = (min) => Math.round(Number(min) / 60).toLocaleString('pt-BR');
const pct = (a, b) => (Number(b) === 0 ? '—' : (Number(a) * 100 / Number(b)).toFixed(1) + '%');

export default async function Page({ searchParams }) {
  let exec, listaAreas;

  try {
    exec = await ultimaExecucao();
    listaAreas = await areas();
  } catch (e) {
    return (
      <div className="wrap">
        <h1 className="titulo">Capacidade</h1>
        <div className="aviso">
          <strong>Não consegui falar com o banco.</strong>
          <p style={{ margin: '8px 0 0' }}>
            Confira se a variável <code>DATABASE_URL</code> está preenchida
            com a connection string do Neon.
          </p>
        </div>
      </div>
    );
  }

  if (!exec) {
    return (
      <div className="wrap">
        <h1 className="titulo">Capacidade</h1>
        <div className="aviso">
          <strong>Nenhum cálculo foi rodado ainda.</strong>
          <p style={{ margin: '8px 0 0' }}>
            No SQL Editor do Neon, rode <code>fn_calcular_capacidade(...)</code> e
            recarregue esta página.
          </p>
        </div>
      </div>
    );
  }

  const anoExec = new Date(exec.periodo_inicio).getFullYear();
  const ano = Number(searchParams?.ano ?? anoExec);
  const areaId = Number(searchParams?.area ?? listaAreas[0]?.id);
  const anos = [anoExec - 1, anoExec, anoExec + 1];

  const [tot, meses, recursos] = await Promise.all([
    totais(exec.id, areaId, ano),
    porMes(exec.id, areaId, ano),
    porRecurso(exec.id, areaId, ano),
  ]);

  const oeeMedio = Number(tot.min_planejada) === 0
    ? null
    : (Number(tot.min_disponivel) * 100 / Number(tot.min_planejada)).toFixed(0);

  return (
    <div className="wrap">
      <div className="topo">
        <h1 className="titulo">Capacidade</h1>
        <Suspense>
          <Filtros areas={listaAreas} areaId={areaId} ano={ano} anos={anos} />
        </Suspense>
      </div>

      <div className="kpis">
        <div className="kpi">
          <p className="rot">Instalada</p>
          <p className="val">{h(tot.min_instalada)} h</p>
          <p className="sub">teto físico 24/7</p>
        </div>
        <div className="kpi">
          <p className="rot">Planejada</p>
          <p className="val">{h(tot.min_planejada)} h</p>
          <p className="sub">{pct(tot.min_planejada, tot.min_instalada)} do teto</p>
        </div>
        <div className="kpi">
          <p className="rot">Disponível</p>
          <p className="val">{h(tot.min_disponivel)} h</p>
          <p className="sub">{oeeMedio ? `com OEE ${oeeMedio}%` : '—'}</p>
        </div>
      </div>

      <div className="painel">
        <h2>Mês a mês</h2>
        <Grafico dados={meses} />
      </div>

      <div className="painel">
        <h2>Por recurso</h2>
        <table>
          <thead>
            <tr>
              <th>Recurso</th>
              <th>Calendário</th>
              <th className="num">Instalada</th>
              <th className="num">Planejada</th>
              <th className="num">Disponível</th>
              <th className="num">% do teto</th>
            </tr>
          </thead>
          <tbody>
            {recursos.map((r) => (
              <tr key={r.codigo}>
                <td>{r.nome}</td>
                <td>
                  <span className={'selo ' + (r.calendario === 'RODIZIO' ? 'rodizio' : 'padrao')}>
                    {r.calendario ? r.calendario.toLowerCase() : '—'}
                  </span>
                </td>
                <td className="num">{Number(r.instalada).toLocaleString('pt-BR')}</td>
                <td className="num">{Number(r.planejada).toLocaleString('pt-BR')}</td>
                <td className="num">{Number(r.disponivel).toLocaleString('pt-BR')}</td>
                <td className="num">
                  {r.pct_teto === null ? '—' : Number(r.pct_teto).toFixed(1) + '%'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="rodape">
          Rodada {exec.id} · cenário {exec.cenario} · calculada em{' '}
          {new Date(exec.concluido_em).toLocaleString('pt-BR')}
        </p>
      </div>
    </div>
  );
}
