import { Suspense } from 'react';
import Link from 'next/link';
import {
  ultimaExecucao, areas, arraysDeFatia, porMes, porDia, porTurnoDoDia,
  tetoDoDia, porRecurso, memoriaDoDia, anosComRodada,
} from '../../lib/db';
import { anoEscolhido, anosParaEscolha } from '../../lib/anos';
import {
  diaDaSemana, diasNoIntervalo, iso, mesesNoIntervalo, resolvePeriodo,
  rotuloPeriodo,
} from '../../lib/periodo';
import { MESES, DIAS, DIAS_CURTO, rotuloArea } from '../../lib/dias';
import { ORIGENS, rotuloOrigem } from '../../lib/origens';
import {
  detalhe, eFisica, formataUnidade, sufixoCampo, sufixoUnidade, UNIDADES,
} from '../../lib/formato';
import {
  atributos as atributosDePara, cargaCorrente, combinacoesPorMes, todasAsRegras,
} from '../../lib/demanda';
import { camposUsados, fatiasDoRotulo, rotulosDe } from '../../lib/regras';
import {
  calendariosDaArea, diasTrabalhadosPorMes, pesosDoCalendario,
} from '../../lib/calendario';
import { diasUteisPorMes, formataDiasUteis } from '../../lib/dia-util';
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

  // FILTRO POR ATRIBUTO DO DE/PARA
  //
  // A capacidade é do RECURSO e o atributo é da LINHA de demanda, então isto
  // não é um filtro comum: é um rateio. Ver o cabeçalho de lib/db.js.
  //
  // A lista de rótulos sai das REGRAS, que são poucas — nada é classificado
  // para montar o seletor. Só quando um rótulo é escolhido é que as combinações
  // por mês são lidas e classificadas, porque aí a conta é necessária.
  const [attrsDePara, regrasDePara] = carga
    ? await Promise.all([atributosDePara(), todasAsRegras()])
    : [[], []];

  const atributo = attrsDePara.some((a) => a.codigo === searchParams?.atributo)
    ? searchParams.atributo : null;
  const rotulosDoAtributo = atributo ? rotulosDe(regrasDePara, atributo) : [];
  const rotulo = rotulosDoAtributo.includes(searchParams?.rotulo)
    ? searchParams.rotulo : null;
  const filtrandoAtributo = Boolean(atributo && rotulo);
  const attrEscolhido = attrsDePara.find((a) => a.codigo === atributo);

  // CAPACIDADE POR DIA ÚTIL
  //
  // A contagem de dias úteis é por CALENDÁRIO, não por área — e uma área pode
  // ter máquina em rodízio e máquina em padrão ao mesmo tempo. Quando isso
  // acontece não existe "o dia útil da área", existem dois, e a tela oferece a
  // escolha em vez de decidir em silêncio.
  //
  // As paradas de apresentação já entram no divisor: `diasUteisPorMes` desconta
  // o impacto delas, que é justamente o que elas existem para fazer.
  const calendarios = await calendariosDaArea(areaId, `${ano}-12-31`);
  const calPedido = Number(searchParams?.cal);
  const cal = calendarios.find((c) => c.id === calPedido) ?? calendarios[0] ?? null;

  const porDiaUtil = searchParams?.dia_util === '1' && cal !== null;

  const uteis = cal
    ? diasUteisPorMes(
        await diasTrabalhadosPorMes(cal.id, ano, areaId),
        await pesosDoCalendario(cal.id))
    : null;

  const exec = await ultimaExecucao(areaId, ano, origem);

  // Sem rodada para esta área e ano, os filtros e o Recalcular continuam na
  // tela. Antes a página saía cedo e mandava rodar SQL no Neon — sem cálculo
  // não havia botão para criar o primeiro, o que é um beco sem saída.
  if (!exec) {
    return (
      <Shell>
        <div className="topo">
          <h1 className="titulo">
            Capacidade
            {area && (
              <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>
                {' '}· {rotuloArea(area)}
              </span>
            )}
          </h1>
          <Suspense>
            <FiltrosTopo areas={listaAreas} areaId={areaId} ano={ano} origem={origem} />
          </Suspense>
        </div>
        <div className="aviso">
          <strong>
            Nenhum cálculo do OEE {rotuloOrigem(origem)} para{' '}
            {area ? rotuloArea(area) : 'esta área'} em {ano}.
          </strong>
          <p style={{ margin: '8px 0 12px' }}>
            Clique em <strong>Recalcular</strong> aí em cima. O motor roda por
            área, ano e origem de OEE — cadastrar turno ou parada não recalcula
            sozinho, e a outra origem tem a rodada dela.
          </p>
          <Suspense>
            <FiltrosRecurso ano={ano} anos={anos} />
          </Suspense>
        </div>
      </Shell>
    );
  }

  // As combinações por mês só são lidas quando há um rótulo escolhido E há
  // rodada para mostrar. É a consulta cara desta página — sem filtro, ela não
  // acontece, e o painel abre exatamente como antes.
  const fatias = filtrandoAtributo
    ? fatiasDoRotulo(
        await combinacoesPorMes(carga.id, camposUsados(regrasDePara)),
        attrsDePara, regrasDePara, atributo, rotulo)
    : [];
  const fa = arraysDeFatia(fatias, filtrandoAtributo);

  // Clicar num recurso da tabela filtra os KPIs, o gráfico e a tabela mensal.
  // Sem recurso na URL, tudo mostra a área inteira.
  //
  // A lista de recursos vem antes do resto para validar o que veio na URL:
  // recurso de outra área faria as consultas voltarem vazias e a tela mostraria
  // zero em tudo, parecendo cálculo errado em vez de filtro inválido.
  const todos = await porRecurso(exec.id, areaId, periodo.de, periodo.ate,
                                carga?.id ?? null, fa);

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
    // Os dois entram por parâmetro para os botões de modo poderem ligar e
    // desligar sem perder o resto do recorte.
    diaUtil = porDiaUtil,
    calId = cal?.id ?? null,
    um = unidade,
    attr = atributo,
    rot = rotulo,
  } = {}) => {
    const p = new URLSearchParams();
    p.set('area', String(areaId));
    p.set('ano', String(ano));
    p.set('unidade', um);
    p.set('origem', origem);
    if (sub !== null) p.set('sub', sub);
    if (tipo !== null) p.set('tipo', tipo);
    if (recurso !== null && recurso !== undefined) p.set('recurso', String(recurso));
    if (diaUtil) p.set('dia_util', '1');
    if (calId && calendarios.length > 1) p.set('cal', String(calId));
    if (attr) p.set('atributo', attr);
    if (attr && rot) p.set('rotulo', rot);
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
      porTurnoDoDia(exec.id, areaId, dataISO, listaIds, carga?.id ?? null, fa),
      tetoDoDia(exec.id, areaId, dataISO, listaIds, fa),
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
                                carga?.id ?? null, fa);
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
                                carga?.id ?? null, fa);
    dados = serieDeMeses(linhas, mesesNoIntervalo(periodo.de, periodo.ate), cmp)
      .map((m) => {
        // Dividir por dia útil é decisão de LEITURA, feita o mais tarde
        // possível: o total lá embaixo continua saindo da capacidade cheia
        // dividida pelos dias cheios, e não da média das médias.
        const du = porDiaUtil ? Number(uteis?.[m.mes] ?? 0) : 1;
        const por = (v) => (porDiaUtil ? (du > 0 ? Number(v) / du : 0) : Number(v));
        return {
          // O asterisco avisa que a barra é de um mês cortado pelo recorte, e
          // não do mês inteiro — senão a comparação com os vizinhos engana.
          // O divisor entra no rótulo: sem ele, um mês render mais por dia
          // útil que o vizinho parece mistério, quando quase sempre é só o
          // feriado que ele tem e o outro não.
          rotulo: MESES[m.mes] + (m.parcial ? '*' : '')
                + (porDiaUtil ? ` (${formataDiasUteis(du)})` : ''),
          instalada: por(m.instalada),
          planejada: por(m.planejada),
          disponivel: por(m.disponivel),
          // O divisor viaja junto: é ele que permite o total certo e a
          // explicação de por que um mês rende mais que o vizinho.
          dias: du,
          bruto: { instalada: m.instalada, planejada: m.planejada,
                   disponivel: m.disponivel },
          href: url({ de: m.de, ate: m.ate }),
        };
      });
  }

  // Os indicadores somam o que está no gráfico, então eles nunca discordam da
  // tabela logo abaixo. No nível de turno a instalada vem do teto do dia.
  const soma = (campo) => dados.reduce((s, x) => s + Number(x[campo] ?? 0), 0);

  // Em capacidade por dia útil o total NÃO é a soma das colunas — somar médias
  // não dá média. É a capacidade cheia do período dividida pelos dias úteis do
  // período, que é a mesma regra de sempre: divisão de somas, nunca média de
  // divisões.
  const somaBruta = (campo) =>
    dados.reduce((t, x) => t + Number(x.bruto?.[campo] ?? 0), 0);
  const totalDias = dados.reduce((t, x) => t + Number(x.dias ?? 0), 0);
  const porDia = (campo) =>
    (totalDias > 0 ? somaBruta(campo) / totalDias : 0);
  // Em unidade física o gráfico já traz metros; para dizer "de X h de
  // capacidade" ainda é preciso o tempo, então ele vem da tabela por recurso,
  // que carrega as duas leituras lado a lado.
  const somaMin = (campo) =>
    visiveis.reduce((t, r) => t + Number(r[campo] ?? 0), 0);
  // Recurso cujo CT não está na carga converte para zero e baixa o total sem
  // dizer por quê. Em unidade física isso precisa aparecer.
  const semIndice = visiveis.filter((r) => !r.tem_demanda);
  const tot = porDiaUtil
    ? {
        instalada: mostrarInstalada ? porDia('instalada') : teto,
        planejada: porDia('planejada'),
        disponivel: porDia('disponivel'),
      }
    : {
        instalada: mostrarInstalada ? soma('instalada') : teto,
        planejada: soma('planejada'),
        disponivel: soma('disponivel'),
      };

  // O rótulo tem que dizer que o número é por dia útil: a capacidade de um mês
  // e a capacidade por dia útil são a mesma medida com uma ordem de grandeza de
  // diferença, e trocá-las passa despercebido.
  const sufixo = sufixoUnidade(unidade, porDiaUtil);
  const totais = porDiaUtil
    ? { instalada: porDia('instalada'), planejada: porDia('planejada'),
        disponivel: porDia('disponivel') }
    : null;

  const oeeMedio = tot.planejada === 0
    ? null
    : (tot.disponivel * 100 / tot.planejada).toFixed(0);

  return (
    <Shell>
      <div className="topo">
        <h1 className="titulo">
          Capacidade
          {/* A área no título, com a planta junto. Sem isso, trocar entre duas
              áreas de mesmo nome — Ibirama e Matriz têm as duas uma Confecção —
              não mudava nada visível quando as duas estavam sem rodada. */}
          {area && (
            <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>
              {' '}· {rotuloArea(area)}
            </span>
          )}
        </h1>
        <Suspense>
          <FiltrosTopo areas={listaAreas} areaId={areaId} ano={ano} origem={origem} />
        </Suspense>
      </div>

      <div className="kpis-linha">
        <div className="kpis">
        {/* Instalada só existe em tempo: ela é o teto de 24 h por dia, e não
            tem quantidade correspondente na demanda para virar metro. */}
        {!fisica && (
        <div className="kpi">
          <p className="rot">Instalada</p>
          <p className="val" title={detalhe(tot.instalada, unidade)}>
            {formataUnidade(tot.instalada, unidade)} {sufixo}
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
            {formataUnidade(tot.planejada, unidade)} {sufixo}
          </p>
          <p className="sub">
            {fisica ? `de ${formataUnidade(somaMin('planejada'), 'h')} h de capacidade`
                    : `${pct(tot.planejada, tot.instalada)} do teto`}
          </p>
        </div>
        <div className="kpi">
          <p className="rot">Disponível</p>
          <p className="val" title={detalhe(tot.disponivel, unidade)}>
            {formataUnidade(tot.disponivel, unidade)} {sufixo}
          </p>
          {/* O % do teto vem antes: é o número comparável entre recursos.
              O OEE explica de onde veio a diferença para a planejada. */}
          <p className="sub">
            {fisica ? '' : `${pct(tot.disponivel, tot.instalada)} do teto`}
            {oeeMedio && `${fisica ? '' : ' '}com OEE ${oeeMedio}%`}
          </p>
        </div>
      </div>

      {/* As duas trocas de leitura, uma embaixo da outra: em que unidade ler,
          e se o número é do mês inteiro ou de um dia útil. Nenhuma das duas é
          filtro — elas não mudam o que está sendo somado, mudam como o mesmo
          número é dito — e por isso ficam junto do número, e não lá embaixo
          entre os recortes. */}
      <div className="modo-caixa">
        <nav className="modo">
          {unidades.map((u) => (
            <Link key={u.valor} href={url({ um: u.valor })}
                  className={u.valor === unidade ? 'modo-on' : ''}>
              {u.curto}
            </Link>
          ))}
        </nav>

        {/* Só no nível de mês: dividir a capacidade de um dia pelos dias úteis
            do mês não significaria nada. */}
        {periodo.nivel === 'MES' && cal && (
          <>
          <nav className="modo">
            <Link href={url({ diaUtil: false })}
                  className={porDiaUtil ? '' : 'modo-on'}>Mês inteiro</Link>
            <Link href={url({ diaUtil: true })}
                  className={porDiaUtil ? 'modo-on' : ''}>Por dia útil</Link>
          </nav>
          {porDiaUtil && calendarios.length > 1 && (
            <p className="modo-regime">
              dias úteis de{' '}
              {calendarios.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ' · '}
                  <Link href={url({ diaUtil: true, calId: c.id })}
                        className={c.id === cal.id ? 'modo-regime-on' : ''}>
                    {c.codigo}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {porDiaUtil && calendarios.length === 1 && (
            <p className="modo-regime">dias úteis de {cal.codigo}</p>
          )}
          </>
        )}
      </div>
      </div>

      {/* O rateio precisa estar escrito onde o número está. Sem isto, "84 h"
          com filtro e "84 h" sem filtro têm a mesma cara e significam coisas
          diferentes — e a primeira é a que engana. */}
      {filtrandoAtributo && (
        <p className="rodape" style={{ marginTop: -8, marginBottom: '1.5rem' }}>
          Recorte por <strong>{attrEscolhido?.nome}</strong> ={' '}
          <strong>{rotulo}</strong>. A capacidade é do recurso e o atributo é da
          linha de demanda, então o que está somado não são os recursos inteiros:
          é a <strong>fatia</strong> de cada um que este rótulo ocupa —
          {' '}minutos do rótulo ÷ minutos do centro de trabalho, mês a mês. As
          fatias de um CT somam 1, então somar todos os rótulos devolve o total.
          {' '}Centro de trabalho sem nada deste rótulo fica de fora da conta e
          da tabela, e por isso {fatias.length === 0 ? 'nada aparece aqui' : 'a lista abaixo é menor'}.
          {fisica && ' A conversão usa a taxa deste rótulo, não a média do CT.'}
          {' '}<Link href={url({ attr: null, rot: null })}>Tirar o recorte</Link>.
        </p>
      )}

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
            {porDiaUtil && (
              <span className="muted" style={{ fontWeight: 400 }}>
                {' '}· por dia útil de {cal.codigo}
              </span>
            )}
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

        <Grafico dados={dados} mostrarInstalada={mostrarInstalada}
                 unidade={unidade} sufixo={sufixo} />
        <TabelaMes dados={dados} mostrarInstalada={mostrarInstalada}
                   unidade={unidade} sufixo={sufixo} totais={totais} />

        {porDiaUtil && (
          <p className="rodape">
            Cada barra é a capacidade do mês <strong>dividida pelos dias úteis
            daquele mês</strong> no calendário <strong>{cal.codigo}</strong>,
            contados para {rotuloArea(area)} — o mesmo número que aparece em
            Calendários, com o peso de cada dia da semana e o desconto das
            paradas de apresentação.
            {' '}Fevereiro rende mais por dia útil que um mês de 22 dias sem
            render mais no total: é para isso que esta leitura serve.
            {' '}O <strong>total</strong> não é a soma das colunas — somar médias
            não dá média. Ele é a capacidade cheia do período dividida pelos dias
            úteis do período.
            {calendarios.length > 1 && (
              <>
                {' '}Esta área tem recurso em mais de um regime
                ({calendarios.map((c) => c.codigo).join(' e ')}), então não
                existe um dia útil só — o seletor ao lado do ano escolhe qual
                divide.
              </>
            )}
          </p>
        )}

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
            // O teto é minuto, sempre. Em metro ele sairia como "1.440 m", que
            // é o número de minutos com o rótulo de outra unidade — então ali
            // ele aparece em hora, dito com todas as letras.
            ? (fisica
                ? `Teto do dia: ${formataUnidade(teto, 'h')} h de capacidade. `
                  + `O teto não é convertido: ele é o de 24 h por dia, e não tem `
                  + `quantidade correspondente na demanda. `
                  + `Turno que vira a meia-noite conta no dia em que termina.`
                : `Teto do dia: ${formataUnidade(teto, unidade)} ${sufixoUnidade(unidade)}. ` +
                  `Instalada é grão dia — 24 h por dia, ` +
                  `todo dia — e por isso não aparece repartida entre os turnos. ` +
                  `Turno que vira a meia-noite conta no dia em que termina: o da ` +
                  `noite anterior aparece aqui, inteiro.`)
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
            <FiltrosRecurso ano={ano} anos={anos} periodo={periodo}
                            subAreas={subAreas} sub={sub} tipo={tipo}
                            atributosDePara={attrsDePara} atributo={atributo}
                            rotulos={rotulosDoAtributo} rotulo={rotulo} />
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
