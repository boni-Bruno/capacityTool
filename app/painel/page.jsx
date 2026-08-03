import { Suspense } from 'react';
import Link from 'next/link';
import {
  ultimaExecucao, areas, porMes, porDia, porTurnoDoDia, tetoDoDia, porRecurso,
} from '../../lib/db';
import { MESES, DIAS, DIAS_CURTO } from '../../lib/dias';
import { horas, horasEMinutos } from '../../lib/formato';
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

  // Monta a URL preservando o que não está mudando. Passar null num campo o
  // remove — é assim que se sobe um nível do drill-down.
  const url = ({ recurso = recursoId, mes: m, dia: d } = {}) => {
    const p = new URLSearchParams();
    p.set('area', String(areaId));
    p.set('ano', String(ano));
    if (recurso !== null && recurso !== undefined) p.set('recurso', String(recurso));
    if (m !== null && m !== undefined) p.set('mes', String(m));
    if (d !== null && d !== undefined) p.set('dia', String(d));
    return '?' + p.toString();
  };

  // Nível do drill-down: ano > mês a mês > dia a dia > turno.
  const mesPedido = searchParams?.mes ? Number(searchParams.mes) : null;
  const mes = mesPedido >= 1 && mesPedido <= 12 ? mesPedido : null;
  const diaPedido = mes && searchParams?.dia ? Number(searchParams.dia) : null;
  const diasNoMes = mes ? new Date(ano, mes, 0).getDate() : 0;
  const dia = diaPedido >= 1 && diaPedido <= diasNoMes ? diaPedido : null;

  const dd = (n) => String(n).padStart(2, '0');
  const dataISO = mes && dia ? `${ano}-${dd(mes)}-${dd(dia)}` : null;

  let dados;
  let mostrarInstalada = true;
  let teto = null;

  if (dataISO) {
    // Turno: sem instalada nas barras. Ela é grão dia — repetir o teto em cada
    // turno era o que inflava o total no Qlik antigo. Vem separado, uma vez.
    const [linhas, tetoDia] = await Promise.all([
      porTurnoDoDia(exec.id, areaId, dataISO, recursoId),
      tetoDoDia(exec.id, areaId, dataISO, recursoId),
    ]);
    dados = linhas.map((l) => ({
      rotulo: l.nome,
      planejada: Number(l.planejada),
      disponivel: Number(l.disponivel),
    }));
    mostrarInstalada = false;
    teto = tetoDia;
  } else if (mes) {
    const linhas = await porDia(exec.id, areaId, ano, mes, recursoId);
    dados = Array.from({ length: diasNoMes }, (_, i) => {
      const achado = linhas.find((l) => Number(l.dia) === i + 1);
      // O dia da semana antes do número: é o que explica de bate-pronto por
      // que uma barra caiu — domingo e sábado saltam à vista sem precisar
      // conferir no calendário.
      const semana = DIAS_CURTO[new Date(ano, mes - 1, i + 1).getDay()];
      return {
        rotulo: `${semana} ${dd(i + 1)}`,
        instalada: Number(achado?.instalada ?? 0),
        planejada: Number(achado?.planejada ?? 0),
        disponivel: Number(achado?.disponivel ?? 0),
        href: url({ mes, dia: i + 1 }),
      };
    });
  } else {
    const linhas = await porMes(exec.id, areaId, ano, recursoId);
    dados = dozeMeses(linhas).map((m) => ({
      rotulo: MESES[m.mes],
      instalada: m.instalada,
      planejada: m.planejada,
      disponivel: m.disponivel,
      href: url({ mes: m.mes }),
    }));
  }

  // Os indicadores somam o que está no gráfico, então eles nunca discordam da
  // tabela logo abaixo. No nível de turno a instalada vem do teto do dia.
  const soma = (campo) => dados.reduce((s, x) => s + Number(x[campo] ?? 0), 0);
  const tot = {
    instalada: mostrarInstalada ? soma('instalada') : teto,
    planejada: soma('planejada'),
    disponivel: soma('disponivel'),
  };

  const oeeMedio = tot.planejada === 0
    ? null
    : (tot.disponivel * 100 / tot.planejada).toFixed(0);

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
          <p className="val" title={horasEMinutos(tot.instalada)}>
            {horas(tot.instalada)} h
          </p>
          <p className="sub">
            {mostrarInstalada ? 'teto físico 24/7' : 'teto do dia (não se reparte por turno)'}
          </p>
        </div>
        <div className="kpi">
          <p className="rot">Planejada</p>
          <p className="val" title={horasEMinutos(tot.planejada)}>
            {horas(tot.planejada)} h
          </p>
          <p className="sub">{pct(tot.planejada, tot.instalada)} do teto</p>
        </div>
        <div className="kpi">
          <p className="rot">Disponível</p>
          <p className="val" title={horasEMinutos(tot.disponivel)}>
            {horas(tot.disponivel)} h
          </p>
          <p className="sub">{oeeMedio ? `com OEE ${oeeMedio}%` : '—'}</p>
        </div>
      </div>

      <div className="painel">
        <div className="painel-topo">
          <h2>
            {dataISO ? 'Turno a turno' : mes ? 'Dia a dia' : 'Mês a mês'}
            {foco && <span className="foco"> · {foco.nome}</span>}
          </h2>

          <nav className="trilha">
            {/* Cada degrau volta um nível removendo o parâmetro. */}
            <Link href={url({ mes: null, dia: null })}
                  className={mes ? '' : 'trilha-atual'}>{ano}</Link>
            {mes && (
              <>
                <span className="trilha-sep">›</span>
                <Link href={url({ mes, dia: null })}
                      className={dia ? '' : 'trilha-atual'}>{MESES[mes]}</Link>
              </>
            )}
            {dia && (
              <>
                <span className="trilha-sep">›</span>
                <span className="trilha-atual">
                  dia {dd(dia)} ({DIAS[new Date(ano, mes - 1, dia).getDay()]})
                </span>
              </>
            )}
            {foco && (
              <Link className="btn btn-mini" style={{ marginLeft: 10 }}
                    href={url({ recurso: null })}>
                Ver a área toda
              </Link>
            )}
          </nav>
        </div>

        <Grafico dados={dados} mostrarInstalada={mostrarInstalada} />
        <TabelaMes dados={dados} mostrarInstalada={mostrarInstalada} />

        <p className="rodape">
          {dataISO
            ? `Teto do dia: ${horas(teto)} h. Instalada é grão dia — 24 h por dia, ` +
              `todo dia — e por isso não aparece repartida entre os turnos.`
            : 'Clique numa coluna para descer um nível.'}
        </p>
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
              <th className="num">Instalada (h)</th>
              <th className="num">Planejada (h)</th>
              <th className="num">Disponível (h)</th>
              <th className="num">% do teto</th>
            </tr>
          </thead>
          <tbody>
            {recursos.map((r) => (
              <tr key={r.codigo} className={foco?.id === r.id ? 'linha-edit' : ''}>
                <td>
                  <Link className="link-linha"
                        href={url({ recurso: r.id, mes: null, dia: null })}>
                    {r.nome}
                  </Link>
                </td>
                <td>
                  <span className={'selo ' + (r.calendario === 'RODIZIO' ? 'rodizio' : 'padrao')}>
                    {r.calendario ? r.calendario.toLowerCase() : '—'}
                  </span>
                </td>
                <td className="num" title={horasEMinutos(r.instalada)}>{horas(r.instalada)}</td>
                <td className="num" title={horasEMinutos(r.planejada)}>{horas(r.planejada)}</td>
                <td className="num" title={horasEMinutos(r.disponivel)}>{horas(r.disponivel)}</td>
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
