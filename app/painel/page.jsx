import { Suspense } from 'react';
import Link from 'next/link';
import {
  ultimaExecucao, areas, porMes, porDia, porTurnoDoDia, tetoDoDia, porRecurso,
  memoriaDoDia, anosComRodada,
} from '../../lib/db';
import { anoEscolhido, anosParaEscolha } from '../../lib/anos';
import {
  diaDaSemana, diasNoIntervalo, iso, mesesNoIntervalo, resolvePeriodo,
  rotuloPeriodo,
} from '../../lib/periodo';
import { MESES, DIAS, DIAS_CURTO } from '../../lib/dias';
import { ORIGENS, rotuloOrigem } from '../../lib/origens';
import {
  detalhe, eFisica, formataUnidade, sufixoCampo, sufixoUnidade, UNIDADES,
} from '../../lib/formato';
import { cargaCorrente } from '../../lib/demanda';
import Grafico from './grafico';
import { FiltrosTopo, FiltrosRecurso } from './filtros';
import TabelaMes from './tabela-mes';
import Memoria from './memoria';
import Shell from '../shell';

export const dynamic = 'force-dynamic';

// O gráfico pula mês sem resultado e a tabela ficaria fora do passo com ele.
// Completar os 12 aqui, uma vez, mantém os dois lendo a mesma coisa.
// Mês sem linha no banco vira zero em vez de sumir: buraco no meio da série
// esconde que aquele mês foi calculado e deu nada.
function serieDeMeses(linhas, meses, campo = '') {
  return meses.map((m) => {
    const achado = linhas.find((l) => Number(l.mes) === m.mes);
    return {
      ...m,
      instalada: Number(achado?.instalada ?? 0),
      planejada: Number(achado?.[`planejada${campo}`] ?? 0),
      disponivel: Number(achado?.[`disponivel${campo}`] ?? 0),
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
  // A carga de demanda que está no ar. É ela que dá o índice de conversão;
  // sem carga, a capacidade só existe em minuto e hora.
  const carga = await cargaCorrente();
  const anos = anosParaEscolha(await anosComRodada());
  const ano = anoEscolhido(searchParams?.ano, anos);
  // O recorte de datas vem antes de qualquer consulta: ele decide o que somar
  // e em que grão, inclusive na tabela por recurso. Ver lib/periodo.js.
  const periodo = resolvePeriodo(searchParams, ano);
  // Minuto é o default: é a moeda base do projeto e o número exato. Hora com
  // uma casa arredonda, e conferir uma parada de 30 min contra a calculadora
  // era a primeira coisa que alguém tentava fazer.
  // Sem carga de demanda não há como converter, então as unidades físicas nem
  // aparecem — melhor não oferecer do que oferecer e mostrar zero.
  const unidades = carga ? UNIDADES : UNIDADES.filter((u) => !eFisica(u.valor));
  const unidade = unidades.some((u) => u.valor === searchParams?.unidade)
    ? searchParams.unidade : 'min';
  const fisica = eFisica(unidade);
  // Qual coluna ler: '' para tempo, '_m' para metro, '_u' para UM do material.
  const cmp = sufixoCampo(unidade);
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
  const todos = await porRecurso(exec.id, areaId, periodo.de, periodo.ate,
                                carga?.id ?? null);

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

  // De que é feito o teto desta seleção. Máquina tem teto físico de 24 h por
  // dia; pessoa tem o turno escalado, e ali a instalada é a própria planejada.
  // O indicador precisa dizer qual dos dois está somando, senão "teto físico
  // 24/7" vira legenda errada numa seleção de pessoas.
  const composicao = !visiveis.length ? 'VAZIA'
    : visiveis.every((r) => r.tipo_recurso === 'PESSOA')  ? 'PESSOA'
    : visiveis.every((r) => r.tipo_recurso === 'MAQUINA') ? 'MAQUINA'
    : 'MISTA';
  const filtrado = sub !== null || tipo !== null || foco !== null;
  // '0' quando nada casa o filtro: nenhum recurso tem id 0, então as consultas
  // voltam zeradas. String vazia estouraria no cast de string_to_array.
  const listaIds = !filtrado ? null
    : (visiveis.length ? visiveis.map((r) => r.id).join(',') : '0');

  // Monta a URL preservando o que não está mudando. Passar null num campo o
  // remove — é assim que se sobe um nível do drill-down.
  // `de`/`ate` são o recorte; `periodo` não é passado nunca, serve só para
  // limpar. Um parâmetro só descreve o que se está vendo, e o nível de detalhe
  // sai do tamanho dele — ver lib/periodo.js.
  const url = ({
    recurso = foco?.id ?? null,
    de: d1 = periodo.de,
    ate: d2 = periodo.ate,
  } = {}) => {
    const p = new URLSearchParams();
    p.set('area', String(areaId));
    p.set('ano', String(ano));
    p.set('unidade', unidade);
    p.set('origem', origem);
    if (sub !== null) p.set('sub', sub);
    if (tipo !== null) p.set('tipo', tipo);
    if (recurso !== null && recurso !== undefined) p.set('recurso', String(recurso));
    // Ano inteiro é a ausência de recorte, e some do endereço: parâmetro que
    // repete o padrão só atrapalha quem lê a URL.
    const inteiro = d1 === iso(ano, 1, 1) && d2 === iso(ano, 12, 31);
    if (d1 && d2 && !inteiro) { p.set('de', d1); p.set('ate', d2); }
    return '?' + p.toString();
  };

  const dataISO = periodo.nivel === 'TURNO' ? periodo.de : null;

  let dados;
  // Instalada só existe em tempo. Ela é o teto físico — 24 h por dia — e não
  // tem quantidade correspondente na demanda para ser convertida.
  let mostrarInstalada = !fisica;
  let teto = null;
  let memoria = null;

  if (periodo.nivel === 'TURNO') {
    // Turno: sem instalada nas barras. Ela é grão dia — repetir o teto em cada
    // turno era o que inflava o total no Qlik antigo. Vem separado, uma vez.
    const [linhas, tetoDia] = await Promise.all([
      porTurnoDoDia(exec.id, areaId, dataISO, listaIds, carga?.id ?? null),
      tetoDoDia(exec.id, areaId, dataISO, listaIds),
    ]);
    dados = linhas.map((l) => ({
      rotulo: l.nome,
      planejada: Number(l[`planejada${cmp}`]),
      disponivel: Number(l[`disponivel${cmp}`]),
    }));
    mostrarInstalada = false;
    teto = tetoDia;

    // O memorial é por recurso: com a área inteira somada, "de quanto para
    // quanto" não teria sujeito. Só carrega quando há um recurso em foco.
    if (foco) memoria = await memoriaDoDia(exec.id, foco.id, dataISO);
  } else if (periodo.nivel === 'DIA') {
    const linhas = await porDia(exec.id, areaId, periodo.de, periodo.ate, listaIds,
                                carga?.id ?? null);
    dados = diasNoIntervalo(periodo.de, periodo.ate).map((data) => {
      const achado = linhas.find((l) => l.data === data);
      // O dia da semana antes do número: é o que explica de bate-pronto por
      // que uma barra caiu — domingo e sábado saltam à vista sem precisar
      // conferir no calendário.
      return {
        rotulo: `${DIAS_CURTO[diaDaSemana(data)]} ${data.slice(8)}`,
        instalada: Number(achado?.instalada ?? 0),
        planejada: Number(achado?.[`planejada${cmp}`] ?? 0),
        disponivel: Number(achado?.[`disponivel${cmp}`] ?? 0),
        href: url({ de: data, ate: data }),
      };
    });
  } else {
    const linhas = await porMes(exec.id, areaId, periodo.de, periodo.ate, listaIds,
                                carga?.id ?? null);
    dados = serieDeMeses(linhas, mesesNoIntervalo(periodo.de, periodo.ate), cmp)
      .map((m) => ({
        // O asterisco avisa que a barra é de um mês cortado pelo recorte, e
        // não do mês inteiro — senão a comparação com os vizinhos engana.
        rotulo: MESES[m.mes] + (m.parcial ? '*' : ''),
        instalada: m.instalada,
        planejada: m.planejada,
        disponivel: m.disponivel,
        href: url({ de: m.de, ate: m.ate }),
      }));
  }

  // Os indicadores somam o que está no gráfico, então eles nunca discordam da
  // tabela logo abaixo. No nível de turno a instalada vem do teto do dia.
  const soma = (campo) => dados.reduce((s, x) => s + Number(x[campo] ?? 0), 0);
  // Em unidade física o gráfico já traz metros; para dizer "de X h de
  // capacidade" ainda é preciso o tempo, então ele vem da tabela por recurso,
  // que carrega as duas leituras lado a lado.
  const somaMin = (campo) =>
    visiveis.reduce((t, r) => t + Number(r[campo] ?? 0), 0);
  // Recurso cujo CT não está na carga converte para zero e baixa o total sem
  // dizer por quê. Em unidade física isso precisa aparecer.
  const semIndice = visiveis.filter((r) => !r.tem_demanda);
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
        {/* Instalada só existe em tempo: ela é o teto de 24 h por dia, e não
            tem quantidade correspondente na demanda para virar metro. */}
        {!fisica && (
        <div className="kpi">
          <p className="rot">Instalada</p>
          <p className="val" title={detalhe(tot.instalada, unidade)}>
            {formataUnidade(tot.instalada, unidade)} {sufixoUnidade(unidade)}
          </p>
          {/* O teto de máquina é físico (24/7); o de pessoa é o turno
              escalado, e nesse caso ele é igual à planejada. Dizer "físico
              24/7" numa seleção de pessoas seria mentira. */}
          <p className="sub">
            {!mostrarInstalada ? 'teto do dia (não se reparte por turno)'
              : composicao === 'PESSOA' ? 'teto = turno escalado'
              : composicao === 'MISTA'  ? 'teto 24/7 na máquina, turno na pessoa'
              : 'teto físico 24/7'}
          </p>
        </div>
        )}
        <div className="kpi">
          <p className="rot">Planejada</p>
          <p className="val" title={detalhe(tot.planejada, unidade)}>
            {formataUnidade(tot.planejada, unidade)} {sufixoUnidade(unidade)}
          </p>
          <p className="sub">
            {fisica ? `de ${formataUnidade(somaMin('planejada'), 'h')} h de capacidade`
                    : `${pct(tot.planejada, tot.instalada)} do teto`}
          </p>
        </div>
        <div className="kpi">
          <p className="rot">Disponível</p>
          <p className="val" title={detalhe(tot.disponivel, unidade)}>
            {formataUnidade(tot.disponivel, unidade)} {sufixoUnidade(unidade)}
          </p>
          {/* O % do teto vem antes: é o número comparável entre recursos.
              O OEE explica de onde veio a diferença para a planejada. */}
          <p className="sub">
            {fisica ? '' : `${pct(tot.disponivel, tot.instalada)} do teto`}
            {oeeMedio && `${fisica ? '' : ' '}com OEE ${oeeMedio}%`}
          </p>
        </div>
      </div>

      {/* O que o "% do teto" quer dizer muda com o que está selecionado, e
          calado ele engana: 100% numa seleção de pessoas parece capacidade
          esgotada quando é só a definição do teto. */}
      {mostrarInstalada && composicao === 'PESSOA' && (
        <p className="rodape" style={{ marginTop: -8, marginBottom: '1.5rem' }}>
          Esta seleção é só de <strong>pessoas</strong>, e para pessoa o teto é
          o turno escalado — a instalada sai igual à planejada. Por isso a
          planejada marca 100% do teto, e o disponível sobre o teto é o próprio
          OEE. Não é capacidade esgotada: é que não existe teto físico de 24 h
          para pessoa. O efeito de feriado e parada continua dentro da
          planejada, no número absoluto.
        </p>
      )}
      {mostrarInstalada && composicao === 'MISTA' && (
        <p className="rodape" style={{ marginTop: -8, marginBottom: '1.5rem' }}>
          Esta seleção mistura <strong>máquina e pessoa</strong>, e os dois têm
          teto de natureza diferente: 24 h por dia na máquina, turno escalado na
          pessoa — onde a instalada é a própria planejada. A parcela de pessoas
          entra em cima e embaixo da razão e puxa o &ldquo;% do teto&rdquo; na
          direção de 100%. Para ler a ociosidade física limpa, use o filtro{' '}
          <strong>só máquina</strong> ao lado do ano.
        </p>
      )}

      <div className="painel">
        <div className="painel-topo">
          <h2>
            {periodo.nivel === 'TURNO' ? 'Turno a turno'
              : periodo.nivel === 'DIA' ? 'Dia a dia' : 'Mês a mês'}
            {foco && <span className="foco"> · {foco.nome}</span>}
          </h2>

          <nav className="trilha">
            {/* O ano é o estado sem recorte; o degrau seguinte é o intervalo
                que estiver valendo, venha ele do clique numa barra ou dos
                campos De/Até. */}
            <Link href={url({ de: null, ate: null })}
                  className={periodo.anoInteiro ? 'trilha-atual' : ''}>{ano}</Link>
            {!periodo.anoInteiro && (
              <>
                <span className="trilha-sep">›</span>
                <span className="trilha-atual">
                  {rotuloPeriodo(periodo.de, periodo.ate)}
                  {periodo.nivel === 'TURNO'
                    && ` (${DIAS[diaDaSemana(periodo.de)]})`}
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

        {fisica && (
          <p className="rodape">
            O índice de conversão é <strong>mensal</strong> — é o grão em que a
            demanda chega. Um dia isolado usa o índice do mês dele, o que supõe
            mix uniforme dentro do mês: dois dias do mesmo mês só diferem pelo
            tempo disponível, nunca pelo que se planejou produzir.
            {' '}Em <strong>metros de tecelagem</strong> os centros de fiação
            aparecem em kg, porque fio não tem metro de tecelagem.
          </p>
        )}

        <p className="rodape">
          {dataISO
            ? `Teto do dia: ${formataUnidade(teto, unidade)} ${sufixoUnidade(unidade)}. ` +
              `Instalada é grão dia — 24 h por dia, ` +
              `todo dia — e por isso não aparece repartida entre os turnos. ` +
              `Turno que vira a meia-noite conta no dia em que termina: o da ` +
              `noite anterior aparece aqui, inteiro.`
            : periodo.nivel === 'DIA'
              ? 'Clique numa coluna para ver os turnos daquele dia. Os campos '
                + 'De e Até, ao lado do ano, mudam o recorte sem passar por aqui.'
              : 'Clique numa coluna para descer ao dia a dia. Os campos De e '
                + 'Até, ao lado do ano, recortam qualquer intervalo direto — '
                + 'mês fora do recorte inteiro aparece com asterisco.'}
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
                ? (fisica
                    ? 'sempre em minutos: o memorial é a cadeia do cálculo, e ela acontece em tempo'
                    : 'cada linha mostra de quanto para quanto foi, e por quê')
                : 'escolha um recurso na tabela abaixo para ver o passo a passo'}
            </span>
          </div>
          {foco
            ? <Memoria linhas={memoria ?? []}
                       unidade={fisica ? 'min' : unidade} />
            : <p className="muted">
                O memorial é por recurso — com a área inteira somada, "de quanto
                para quanto" não teria sujeito.
              </p>}
        </div>
      )}

      {fisica && semIndice.length > 0 && (
        <div className="aviso" style={{ marginBottom: '1.5rem' }}>
          <strong>
            {semIndice.length} de {visiveis.length} recursos desta seleção não
            têm demanda nesta carga, e por isso convertem para zero.
          </strong>
          <p style={{ margin: '6px 0 0' }}>
            O total acima está mais baixo do que a capacidade real por causa
            disso — não é ociosidade, é ausência de índice. O vínculo é o{' '}
            <code>CC-CT</code> da máquina, e ele se resolve sozinho quando o CT
            aparecer na carga ou o cadastro do recurso for acertado.
          </p>
          <p style={{ margin: '6px 0 0' }} className="muted">
            {semIndice.slice(0, 10).map((r) => r.nome).join(' · ')}
            {semIndice.length > 10 && ` … e mais ${semIndice.length - 10}`}
          </p>
        </div>
      )}

      <div className="painel">
        <div className="painel-topo">
          <h2>Por recurso</h2>
          <Suspense>
            <FiltrosRecurso ano={ano} anos={anos} unidade={unidade}
                            unidades={unidades} periodo={periodo}
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
              {!fisica && <th className="num">Instalada ({sufixoUnidade(unidade)})</th>}
              <th className="num">Planejada ({sufixoUnidade(unidade)})</th>
              <th className="num">Disponível ({sufixoUnidade(unidade)})</th>
              {!fisica && <th className="num">% do teto</th>}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r) => (
              <tr key={r.codigo} className={foco?.id === r.id ? 'linha-edit' : ''}>
                <td>
                  <Link className="link-linha"
                        href={url({ recurso: r.id })}>
                    {r.nome}
                  </Link>
                </td>
                <td className={r.sub_area ? '' : 'muted'}>{r.sub_area || '—'}</td>
                <td>
                  <span className={'selo ' + (r.calendario === 'RODIZIO' ? 'rodizio' : 'padrao')}>
                    {r.calendario ? r.calendario.toLowerCase() : '—'}
                  </span>
                </td>
                {!fisica && (
                  <td className="num" title={detalhe(r.instalada, unidade)}>
                    {formataUnidade(r.instalada, unidade)}
                  </td>
                )}
                <td className="num" title={detalhe(r[`planejada${cmp}`], unidade)}>
                  {formataUnidade(r[`planejada${cmp}`], unidade)}
                </td>
                <td className={'num' + (fisica && !r.tem_demanda ? ' muted' : '')}
                    title={fisica && !r.tem_demanda
                      ? 'Sem demanda para este CT nesta carga — não há índice para converter.'
                      : detalhe(r[`disponivel${cmp}`], unidade)}>
                  {fisica && !r.tem_demanda
                    ? '—'
                    : formataUnidade(r[`disponivel${cmp}`], unidade)}
                </td>
                {!fisica && (
                  <td className="num">
                    {r.pct_teto === null ? '—' : Number(r.pct_teto).toFixed(1) + '%'}
                  </td>
                )}
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
