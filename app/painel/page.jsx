import { Suspense } from 'react';
import Link from 'next/link';
import { ultimaExecucao, areas, totais, porMes, porRecurso } from '../../lib/db';
import Grafico from './grafico';
import Filtros from './filtros';
import TabelaMes from './tabela-mes';
import Nav from '../nav';

export const dynamic = 'force-dynamic';

// O gráfico pula mês sem resultado e a tabela ficaria fora do passo com ele.
// Completar os 12 aqui, uma vez, mantém os dois lendo a mesma coisa.
function dozeMeses(linhas) {
  return Array.from({ length: 12 }, (_, i) => {
    const achado = linhas.find((l) => Number(l.mes) === i + 1);
    return {
      mes: i + 1,
      instalada: Number(achado?.instalada ?? 0),
      planejada: Number(achado?.planejada ?? 0),
      disponivel: Number(achado?.disponivel ?? 0),
    };
  });
}

const h = (min) => Math.round(Number(min) / 60).toLocaleString('pt-BR');
const pct = (a, b) => (Number(b) === 0 ? '—' : (Number(a) * 100 / Number(b)).toFixed(1) + '%');

export default async function Page({ searchParams }) {
  let listaAreas;

  try {
    listaAreas = await areas();
  } catch (e) {
    return (
      <div className="wrap">
        <Nav />
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

  // Área e ano vêm antes da execução: a rodada é por área, então só dá para
  // saber qual delas mostrar depois de saber o que o usuário está olhando.
  const anoAtual = new Date().getFullYear();
  const areaId = Number(searchParams?.area ?? listaAreas[0]?.id);
  const ano = Number(searchParams?.ano ?? anoAtual);
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];
  const area = listaAreas.find((a) => a.id === areaId);

  const exec = await ultimaExecucao(areaId, ano);

  // Sem rodada para esta área e ano, os filtros e o Recalcular continuam na
  // tela. Antes a página saía cedo e mandava rodar SQL no Neon — sem cálculo
  // não havia botão para criar o primeiro, o que é um beco sem saída.
  if (!exec) {
    return (
      <div className="wrap">
        <Nav />
        <div className="topo">
          <h1 className="titulo">Capacidade</h1>
          <Suspense>
            <Filtros areas={listaAreas} areaId={areaId} ano={ano} anos={anos} />
          </Suspense>
        </div>
        <div className="aviso">
          <strong>
            Nenhum cálculo rodado para {area?.nome ?? 'esta área'} em {ano}.
          </strong>
          <p style={{ margin: '8px 0 0' }}>
            Clique em <strong>Recalcular</strong> aí em cima. O motor roda por
            área e por ano — cadastrar turno ou parada não recalcula sozinho.
          </p>
        </div>
      </div>
    );
  }

  // Clicar num recurso da tabela filtra os KPIs, o gráfico e a tabela mensal.
  // Sem recurso na URL, tudo mostra a área inteira.
  //
  // A lista de recursos vem antes do resto para validar o que veio na URL:
  // recurso de outra área faria as consultas voltarem vazias e a tela mostraria
  // zero em tudo, parecendo cálculo errado em vez de filtro inválido.
  const recursos = await porRecurso(exec.id, areaId, ano);
  const pedido = searchParams?.recurso ? Number(searchParams.recurso) : null;
  const foco = recursos.find((r) => Number(r.id) === pedido) ?? null;
  const recursoId = foco ? Number(foco.id) : null;

  const [tot, linhasMes] = await Promise.all([
    totais(exec.id, areaId, ano, recursoId),
    porMes(exec.id, areaId, ano, recursoId),
  ]);

  const meses = dozeMeses(linhasMes);

  const comRecurso = (id) => {
    const p = new URLSearchParams();
    p.set('area', String(areaId));
    p.set('ano', String(ano));
    if (id !== null) p.set('recurso', String(id));
    return '?' + p.toString();
  };

  const oeeMedio = Number(tot.min_planejada) === 0
    ? null
    : (Number(tot.min_disponivel) * 100 / Number(tot.min_planejada)).toFixed(0);

  return (
    <div className="wrap">
      <Nav />
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
        <div className="painel-topo">
          <h2>
            Mês a mês
            {foco && <span className="foco"> · {foco.nome}</span>}
          </h2>
          {foco && (
            <Link className="btn btn-mini" href={comRecurso(null)}>
              Ver a área toda
            </Link>
          )}
        </div>

        <Grafico dados={meses} />
        <TabelaMes meses={meses} />
      </div>

      <div className="painel">
        <div className="painel-topo">
          <h2>Por recurso</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            clique num recurso para filtrar o gráfico
          </span>
        </div>
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
              <tr key={r.codigo} className={foco?.id === r.id ? 'linha-edit' : ''}>
                <td>
                  <Link className="link-linha" href={comRecurso(r.id)}>
                    {r.nome}
                  </Link>
                </td>
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
          {new Date(exec.concluido_em).toLocaleString('pt-BR')}.
          {' '}Cadastro alterado depois disso só entra na conta ao
          {' '}<strong>Recalcular</strong>.
        </p>
      </div>
    </div>
  );
}
