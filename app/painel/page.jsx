import { Suspense } from 'react';
import Link from 'next/link';
import {
  ultimaExecucao, areas, porMes, porDia, porTurnoDoDia, tetoDoDia, porRecurso,
  memoriaDoDia, anosComRodada,
} from '../../lib/db';
import { anoEscolhido, anosParaEscolha } from '../../lib/anos';
import { MESES, DIAS, DIAS_CURTO } from '../../lib/dias';
import { ORIGENS, rotuloOrigem } from '../../lib/origens';
import {
  formataUnidade, horasEMinutos, sufixoUnidade, UNIDADES,
} from '../../lib/formato';
import Grafico from './grafico';
import { FiltrosTopo, FiltrosRecurso } from './filtros';
import TabelaMes from './tabela-mes';
import Memoria from './memoria';
import Shell from '../shell';

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
      <Shell>
        <h1 className="titulo">Capacidade</h1>
        <div className="aviso">
          <strong>Não consegui falar com o banco.</strong>
          <p style={{ margin: '8px 0 0' }}>
            Confira se a variável <code>DATABASE_URL</code> está preenchida
            com a connection string do Neon.
          </p>
        </div>
      </Shell>
    );
  }

  // Área e ano vêm antes da execução: a rodada é por área, então só dá para
  // saber qual delas mostrar depois de saber o que o usuário está olhando.
  const areaId = Number(searchParams?.area ?? listaAreas[0]?.id);
  // A lista sai do banco, não do relógio: ano com rodada guardada continua
  // acessível para sempre, e a janela em volta de hoje segue disponível para
  // planejar. Ver lib/anos.js.
  const anos = anosParaEscolha(await anosComRodada());
  const ano = anoEscolhido(searchParams?.ano, anos);
  const unidade = UNIDADES.some((u) => u.valor === searchParams?.unidade)
    ? searchParams.unidade : 'h';
  // META e SIMULADO são rodadas distintas; trocar aqui troca de rodada, não
  // recalcula. Default META, que é o cenário oficial.
  const origem = ORIGENS.includes(searchParams?.origem) ? searchParams.origem : 'META';
  const area = listaAreas.find((a) => a.id === areaId);

  const exec = await ultimaExecucao(areaId, ano, origem);

  // Sem rodada para esta área e ano, os filtros e o Recalcular continuam na
  // tela. Antes a página saía cedo e mandava rodar SQL no Neon — sem cálculo
  // não havia botão para criar o primeiro, o que é um beco sem saída.
  if (!exec) {
    return (
      <Shell>
        <div className="topo">
          <h1 className="titulo">Capacidade</h1>
          <Suspense>
            <FiltrosTopo areas={listaAreas} areaId={areaId} ano={ano} origem={origem} />
          </Suspense>
        </div>
        <div className="aviso">
          <strong>
            Nenhum cálculo do OEE {rotuloOrigem(origem)} para{' '}
            {area?.nome ?? 'esta área'} em {ano}.
          </strong>
          <p style={{ margin: '8px 0 12px' }}>
            Clique em <strong>Recalcular</strong> aí em cima. O motor roda por
            área, ano e origem de OEE — cadastrar turno ou parada não recalcula
            sozinho, e a outra origem tem a rodada dela.
          </p>
          <Suspense>
            <FiltrosRecurso ano={ano} anos={anos} unidade={unidade} />
          </Suspense>
        </div>
      </Shell>
    );
  }

  // Clicar num recurso da tabela filtra os KPIs, o gráfico e a tabela mensal.
  // Sem recurso na URL, tudo mostra a área inteira.
  //
  // A lista de recursos vem antes do resto para validar o que veio na URL:
  // recurso de outra área faria as consultas voltarem vazias e a tela mostraria
  // zero em tudo, parecendo cálculo errado em vez de filtro inválido.
  const todos = await porRecurso(exec.id, areaId, ano);

  // Os filtros do cabeçalho são atributos do recurso, e a lista de opções sai
  // do que existe nesta área — sem cadastro à parte de sub-área.
  const subAreas = [...new Set(todos.map((r) => r.sub_area).filter(Boolean))].sort();
  const sub = subAreas.includes(searchParams?.sub) ? searchParams.sub : null;
  const tipo = ['MAQUINA', 'PESSOA'].includes(searchParams?.tipo)
    ? searchParams.tipo : null;

  // Um lugar só decide quem entra: a tabela mostra exatamente os recursos que
  // alimentaram os indicadores e o gráfico.
  const recursos = todos.filter((r) =>
    (sub === null || r.sub_area === sub) &&
    (tipo === null || r.tipo_recurso === tipo));

  const pedido = searchParams?.recurso ? Number(searchParams.recurso) : null;
  const foco = recursos.find((r) => Number(r.id) === pedido) ?? null;

  // Clicar num recurso estreita ainda mais; sem clique, valem os filtros.
  const visiveis = foco ? [foco] : recursos;
  const filtrado = sub !== null || tipo !== null || foco !== null;
  // '0' quando nada casa o filtro: nenhum recurso tem id 0, então as consultas
  // voltam zeradas. String vazia estouraria no cast de string_to_array.
  const listaIds = !filtrado ? null
    : (visiveis.length ? visiveis.map((r) => r.id).join(',') : '0');

  // Monta a URL preservando o que não está mudando. Passar null num campo o
  // remove — é assim que se sobe um nível do drill-down.
  const url = ({ recurso = foco?.id ?? null, mes: m, dia: d } = {}) => {
    const p = new URLSearchParams();
    p.set('area', String(areaId));
    p.set('ano', String(ano));
    p.set('unidade', unidade);
    p.set('origem', origem);
    if (sub !== null) p.set('sub', sub);
    if (tipo !== null) p.set('tipo', tipo);
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
  let memoria = null;

  if (dataISO) {
    // Turno: sem instalada nas barras. Ela é grão dia — repetir o teto em cada
    // turno era o que inflava o total no Qlik antigo. Vem separado, uma vez.
    const [linhas, tetoDia] = await Promise.all([
      porTurnoDoDia(exec.id, areaId, dataISO, listaIds),
      tetoDoDia(exec.id, areaId, dataISO, listaIds),
    ]);
    dados = linhas.map((l) => ({
      rotulo: l.nome,
      planejada: Number(l.planejada),
      disponivel: Number(l.disponivel),
    }));
    mostrarInstalada = false;
    teto = tetoDia;

    // O memorial é por recurso: com a área inteira somada, "de quanto para
    // quanto" não teria sujeito. Só carrega quando há um recurso em foco.
    if (foco) memoria = await memoriaDoDia(exec.id, foco.id, dataISO);
  } else if (mes) {
    const linhas = await porDia(exec.id, areaId, ano, mes, listaIds);
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
    const linhas = await porMes(exec.id, areaId, ano, listaIds);
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
    <Shell>
      <div className="topo">
        <h1 className="titulo">Capacidade</h1>
        <Suspense>
          <FiltrosTopo areas={listaAreas} areaId={areaId} ano={ano} origem={origem} />
        </Suspense>
      </div>

      <div className="kpis">
        <div className="kpi">
          <p className="rot">Instalada</p>
          <p className="val" title={horasEMinutos(tot.instalada)}>
            {formataUnidade(tot.instalada, unidade)} {sufixoUnidade(unidade)}
          </p>
          <p className="sub">
            {mostrarInstalada ? 'teto físico 24/7' : 'teto do dia (não se reparte por turno)'}
          </p>
        </div>
        <div className="kpi">
          <p className="rot">Planejada</p>
          <p className="val" title={horasEMinutos(tot.planejada)}>
            {formataUnidade(tot.planejada, unidade)} {sufixoUnidade(unidade)}
          </p>
          <p className="sub">{pct(tot.planejada, tot.instalada)} do teto</p>
        </div>
        <div className="kpi">
          <p className="rot">Disponível</p>
          <p className="val" title={horasEMinutos(tot.disponivel)}>
            {formataUnidade(tot.disponivel, unidade)} {sufixoUnidade(unidade)}
          </p>
          {/* O % do teto vem antes: é o número comparável entre recursos.
              O OEE explica de onde veio a diferença para a planejada. */}
          <p className="sub">
            {pct(tot.disponivel, tot.instalada)} do teto
            {oeeMedio && ` com OEE ${oeeMedio}%`}
          </p>
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

        <Grafico dados={dados} mostrarInstalada={mostrarInstalada} unidade={unidade} />
        <TabelaMes dados={dados} mostrarInstalada={mostrarInstalada} unidade={unidade} />

        <p className="rodape">
          {dataISO
            ? `Teto do dia: ${formataUnidade(teto, unidade)} ${sufixoUnidade(unidade)}. ` +
              `Instalada é grão dia — 24 h por dia, ` +
              `todo dia — e por isso não aparece repartida entre os turnos. ` +
              `Turno que vira a meia-noite conta no dia em que termina: o da ` +
              `noite anterior aparece aqui, inteiro.`
            : 'Clique numa coluna para descer um nível.'}
        </p>
      </div>

      {dataISO && (
        <div className="painel">
          <div className="painel-topo">
            <h2>
              Por que deu esse número
              {foco && <span className="foco"> · {foco.nome}</span>}
            </h2>
            <span className="muted" style={{ fontSize: 12 }}>
              {foco
                ? 'cada linha mostra de quanto para quanto foi, e por quê'
                : 'escolha um recurso na tabela abaixo para ver o passo a passo'}
            </span>
          </div>
          {foco
            ? <Memoria linhas={memoria ?? []} unidade={unidade} />
            : <p className="muted">
                O memorial é por recurso — com a área inteira somada, "de quanto
                para quanto" não teria sujeito.
              </p>}
        </div>
      )}

      <div className="painel">
        <div className="painel-topo">
          <h2>Por recurso</h2>
          <Suspense>
            <FiltrosRecurso ano={ano} anos={anos} unidade={unidade}
                            subAreas={subAreas} sub={sub} tipo={tipo} />
          </Suspense>
        </div>
        <p className="rodape" style={{ margin: '0 0 1rem' }}>
          Estes filtros valem para os indicadores e o gráfico acima também.
          Clique num recurso para estreitar ainda mais.
        </p>
        <table>
          <thead>
            <tr>
              <th>Recurso</th>
              <th>Sub-área</th>
              <th>Calendário</th>
              <th className="num">Instalada ({sufixoUnidade(unidade)})</th>
              <th className="num">Planejada ({sufixoUnidade(unidade)})</th>
              <th className="num">Disponível ({sufixoUnidade(unidade)})</th>
              <th className="num">% do teto</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r) => (
              <tr key={r.codigo} className={foco?.id === r.id ? 'linha-edit' : ''}>
                <td>
                  <Link className="link-linha"
                        href={url({ recurso: r.id, mes: null, dia: null })}>
                    {r.nome}
                  </Link>
                </td>
                <td className={r.sub_area ? '' : 'muted'}>{r.sub_area || '—'}</td>
                <td>
                  <span className={'selo ' + (r.calendario === 'RODIZIO' ? 'rodizio' : 'padrao')}>
                    {r.calendario ? r.calendario.toLowerCase() : '—'}
                  </span>
                </td>
                <td className="num" title={horasEMinutos(r.instalada)}>{formataUnidade(r.instalada, unidade)}</td>
                <td className="num" title={horasEMinutos(r.planejada)}>{formataUnidade(r.planejada, unidade)}</td>
                <td className="num" title={horasEMinutos(r.disponivel)}>{formataUnidade(r.disponivel, unidade)}</td>
                <td className="num">
                  {r.pct_teto === null ? '—' : Number(r.pct_teto).toFixed(1) + '%'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="rodape">
          Rodada {exec.id} · OEE {rotuloOrigem(exec.origem)} · cenário{' '}
          {exec.cenario} · calculada em{' '}
          {new Date(exec.concluido_em).toLocaleString('pt-BR')}.
          {' '}Cadastro alterado depois disso só entra na conta ao
          {' '}<strong>Recalcular</strong>.
        </p>
      </div>
    </Shell>
  );
}
