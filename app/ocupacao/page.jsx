import { Suspense } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  anosComRodada, areas, capacidadePorCtMes, demandaPorDiaDaArea,
  demandaPorMesDaArea, ocupacaoPorCt, porDia, porMes, porRecurso,
  ultimaExecucao,
} from '../../lib/db';
import { anoEscolhido, anosParaEscolha } from '../../lib/anos';
import {
  atributos as atributosDePara, cargas, cargaCorrente, combinacoesPorMes,
  mixAjustes, taxasDoMix, todasAsRegras,
} from '../../lib/demanda';
import {
  CAMPOS_BASE, camposUsados, capacidadePorAtributo, demandaPorAtributo,
  rotulosDe, valoresDe,
} from '../../lib/regras';
import {
  diaDaSemana, diasNoIntervalo, iso, mesesNoIntervalo, resolvePeriodo,
  rotuloPeriodo,
} from '../../lib/periodo';
import { DIAS_CURTO, MESES, rotuloArea } from '../../lib/dias';
import { leOrdem, ordenar } from '../../lib/ordem';
import { COOKIE_TEMA, leTema } from '../../lib/tema';
import { descreveFiltro, leFiltros, passaTodos } from '../../lib/filtro';
import { ORIGENS, rotuloOrigem } from '../../lib/origens';
import { detalhe, formataUnidade, sufixoUnidade } from '../../lib/formato';
import { FiltrosRecurso, FiltrosTopo, SeletorAno } from '../painel/filtros';
import GraficoOcupacao from './grafico';
import TabelaMesOcupacao from './tabela-mes';
import TabelaAtributoOcupacao from './tabela-atributo';
import FiltroColuna from '../painel/filtro-coluna';
import { LARGURA_MIN } from '../painel/grade';
import FiltrosOcupacao from './filtros';
import Shell from '../shell';

export const dynamic = 'force-dynamic';

// =============================================================================
// PAINEL DA OCUPAÇÃO
//
// O painel da capacidade responde "quanto cabe". Este responde "cabe?" — a
// capacidade contra a demanda que o plano pediu, no mesmo lugar.
//
// EM MINUTO E HORA, SÓ. A demanda da base é tempo de roteiro já explodido para
// a quantidade do plano; comparar minuto com minuto dispensa índice de
// conversão e não herda nenhuma das dúvidas dele. Metro e peça ficam no painel
// da capacidade, onde a pergunta é outra.
//
// NO GRÃO DO CENTRO DE TRABALHO. A capacidade é do recurso e a demanda é do CT;
// dois recursos no mesmo CT dividem uma demanda que não sabe deles, e não há
// critério no dado para repartir. Somar a capacidade dos recursos de um CT é
// uma conta que o dado sustenta — espalhar a demanda entre eles seria inventar.
//
// A BASE DE DEMANDA É ESCOLHIDA AQUI, e pode não ser a corrente: a carga que
// está no ar serve à conversão em metro, e a ocupação pode querer comparar
// contra outro cenário sem trocar o que todo mundo vê.
// =============================================================================

const MEDIDAS = [
  { valor: 'disponivel', rotulo: 'Disponível', dica: 'planejada × OEE' },
  { valor: 'planejada',  rotulo: 'Planejada',  dica: 'turnos menos paradas' },
  { valor: 'instalada',  rotulo: 'Instalada',  dica: 'teto de 24 h por dia' },
];

const num = (v) => Number(v ?? 0);

// A ocupação em si: quanto do que cabe já está pedido.
const ocupa = (dem, cap) => (num(cap) === 0 ? null : (num(dem) * 100) / num(cap));

const fmtPct = (v) => (v === null ? '—' : `${v.toFixed(1)}%`);

// Vermelho quando estoura, âmbar quando aperta. A cor é redundante com o
// número de propósito: numa tabela de cinquenta linhas, achar as que estouram
// lendo número por número é o que ninguém faz.
const classePct = (v) => (v === null ? 'muted'
  : v > 100 ? 'ocup-estoura'
    : v >= 85 ? 'ocup-aperta' : '');

export default async function Page({ searchParams }) {
  const tema = leTema(cookies().get(COOKIE_TEMA)?.value);
  let listaAreas;
  let listaCargas;
  try {
    [listaAreas, listaCargas] = await Promise.all([areas(), cargas()]);
  } catch (e) {
    return (
      <Shell>
        <div className="aviso">
          <strong>Não consegui falar com o banco.</strong>
          <p style={{ margin: '8px 0 0' }}>{e.message}</p>
        </div>
      </Shell>
    );
  }

  if (!listaAreas.length) {
    return (
      <Shell>
        <div className="aviso"><strong>Nenhuma área cadastrada.</strong></div>
      </Shell>
    );
  }

  const areaId = Number(searchParams?.area ?? listaAreas[0].id);
  const area = listaAreas.find((a) => a.id === areaId);
  const anos = anosParaEscolha(await anosComRodada());
  const ano = anoEscolhido(searchParams?.ano, anos);
  const periodo = resolvePeriodo(searchParams, ano);
  const origem = ORIGENS.includes(searchParams?.origem) ? searchParams.origem : 'META';

  const unidade = searchParams?.unidade === 'h' ? 'h' : 'min';
  const medida = MEDIDAS.some((m) => m.valor === searchParams?.medida)
    ? searchParams.medida : 'disponivel';
  const rotuloMedida = MEDIDAS.find((m) => m.valor === medida).rotulo;

  // A carga escolhida, com a corrente como ponto de partida — é a que a
  // empresa está usando, e trocar é uma decisão consciente.
  const corrente = await cargaCorrente();
  const cargaId = listaCargas.some((c) => String(c.id) === searchParams?.carga)
    ? Number(searchParams.carga) : (corrente?.id ?? null);
  const carga = listaCargas.find((c) => c.id === cargaId) ?? null;

  const exec = await ultimaExecucao(areaId, ano, origem);


  const topo = (
    <div className="topo">
      <h1 className="titulo">
        Painel da Ocupação
        {area && (
          <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>
            {' '}· {rotuloArea(area)}
          </span>
        )}
      </h1>
      <Suspense>
        <FiltrosTopo areas={listaAreas} areaId={areaId} ano={ano}
                     origem={origem} anos={anos} />
      </Suspense>
    </div>
  );

  if (!exec) {
    return (
      <Shell>
        {topo}
        <div className="aviso">
          <strong>
            Nenhum cálculo do OEE {rotuloOrigem(origem)} para{' '}
            {area ? rotuloArea(area) : 'esta área'} em {ano}.
          </strong>
          <p style={{ margin: '8px 0 12px' }}>
            A ocupação compara a capacidade calculada com a demanda. Sem rodada
            não há o primeiro lado da conta — clique em{' '}
            <strong>Recalcular tudo</strong> aí em cima.
          </p>
        </div>
      </Shell>
    );
  }

  if (!carga) {
    return (
      <Shell>
        {topo}
        <div className="aviso">
          <strong>Nenhuma base de demanda importada.</strong>
          <p style={{ margin: '8px 0 0' }}>
            Este painel compara a capacidade com o que o plano pede, e o segundo
            lado da conta vem da base de demanda.
            {' '}<Link href="/cadastros/demanda">Importar uma base</Link> — é o
            mesmo arquivo da conversão, e aqui ela entra em minuto, sem índice
            nenhum no meio.
          </p>
        </div>
      </Shell>
    );
  }

  // ---- QUEM ENTRA NA CONTA -------------------------------------------------
  //
  // O mesmo funil do painel da capacidade, e de propósito: são as mesmas
  // perguntas sobre os mesmos recursos, e duas gramáticas de filtro na mesma
  // ferramenta fariam a pessoa aprender duas vezes. Sub-área, tipo, CC e CT.
  const todos = await porRecurso(exec.id, areaId, periodo.de, periodo.ate);

  // Os mesmos filtros de coluna do painel da capacidade, pelo mesmo motor e
  // pelos mesmos parâmetros — ver lib/filtro.js.
  const CAMPOS_FILTRO = [
    { campo: 'planta',       rot: 'Planta' },
    { campo: 'area',         rot: 'Área' },
    { campo: 'cc',           rot: 'CC' },
    { campo: 'ct',           rot: 'CT' },
    { campo: 'codigo',       rot: 'Código' },
    { campo: 'nome',         rot: 'Recurso' },
    { campo: 'sub_area',     rot: 'Sub-área' },
    { campo: 'tipo_recurso', rot: 'Tipo' },
  ];
  const filtros = leFiltros(searchParams, CAMPOS_FILTRO.map((c) => c.campo));

  // AS OPÇÕES SAEM DO QUE SOBROU DOS OUTROS FILTROS.
  //
  // Escolher o CC 278 tem que deixar na lista de CT só os CTs dele — oferecer
  // os 123 e ter 9 que respondem é mandar procurar agulha. Cada campo se
  // pergunta sobre a lista já recortada pelos DEMAIS, e não por si mesmo:
  // incluir o próprio filtro deixaria de fora justamente os valores que a
  // pessoa precisa ver para desmarcar.
  //
  // Isso generaliza a cascata que existia só de CC para CT: agora filtrar a
  // sub-área também enxuga os CCs, e assim por diante, em qualquer ordem.
  const distintos = (lista, campo) =>
    [...new Set(lista.map((r) => r[campo]).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

  const opcoes = Object.fromEntries(CAMPOS_FILTRO.map((c) => {
    const outros = Object.fromEntries(
      Object.entries(filtros).filter(([k]) => k !== c.campo));
    return [c.campo, distintos(todos.filter((r) => passaTodos(r, outros)), c.campo)];
  }));

  const recursos = todos.filter((r) => passaTodos(r, filtros));

  const ativos = CAMPOS_FILTRO
    .filter((c) => filtros[c.campo])
    .map((c) => descreveFiltro(c.rot, filtros[c.campo]));
  // A ordem é a do funil como se pensa nele: do maior recorte para o menor,
  // e o tipo por último porque ele quase nunca é a primeira pergunta. Campo
  // filtrado por fora dessa lista entra depois — o recorte não pode ficar
  // escondido atrás de uma rolagem horizontal.
  const FIXOS = ['sub_area', 'cc', 'ct', 'nome', 'tipo_recurso'];
  const naBarra = [
    ...FIXOS.map((k) => CAMPOS_FILTRO.find((c) => c.campo === k)).filter(Boolean),
    ...CAMPOS_FILTRO.filter((c) => !FIXOS.includes(c.campo) && filtros[c.campo]),
  ];

  const filtrado = ativos.length > 0;
  // '0' quando nada casa: nenhum recurso tem id 0, então as consultas voltam
  // zeradas em vez de estourar no cast.
  const listaIds = !filtrado ? null
    : (recursos.length ? recursos.map((r) => r.id).join(',') : '0');

  // A URL descreve por inteiro o que está na tela: recorte, medida, unidade,
  // base e ordenação. Ela mora aqui embaixo porque fecha em cima do funil
  // acima — declarada antes dele, leria variáveis que ainda não existem.
  // O mesmo container de duas abas do painel da capacidade, com as medidas
  // deste: a de baixo é a MESMA ocupação, olhada por produto em vez de por
  // máquina — e um rótulo pode estourar em junho sem que nenhum centro estoure,
  // porque ele divide o mês com os outros.
  const [attrsDePara, regrasDePara] = await Promise.all([
    atributosDePara(), todasAsRegras(),
  ]);
  const atributosFiltro = [...attrsDePara, ...CAMPOS_BASE];
  const podeAtributo = atributosFiltro.length > 0;
  const aba = podeAtributo && searchParams?.aba === 'atributo' ? 'atributo' : 'ct';
  const attrTabela = aba === 'atributo'
    ? (atributosFiltro.some((a) => a.codigo === searchParams?.attr_tab)
        ? searchParams.attr_tab : atributosFiltro[0].codigo)
    : null;

  const url = ({
    de: d1 = periodo.de,
    ate: d2 = periodo.ate,
    med = medida,
    um = unidade,
    cg = cargaId,
    ordem: ord = searchParams?.ordem ?? null,
    abaSel = aba,
    attrTab = attrTabela,
  } = {}) => {
    const p = new URLSearchParams();
    p.set('area', String(areaId));
    p.set('ano', String(ano));
    p.set('origem', origem);
    if (med !== 'disponivel') p.set('medida', med);
    if (um !== 'min') p.set('unidade', um);
    if (cg) p.set('carga', String(cg));
    if (ord) p.set('ordem', ord);
    if (abaSel === 'atributo') p.set('aba', 'atributo');
    if (abaSel === 'atributo' && attrTab) p.set('attr_tab', attrTab);
    // Os filtros viajam como vieram: reescrevê-los aqui seria uma segunda
    // serialização, livre para divergir da de lib/filtro.js.
    for (const c of CAMPOS_FILTRO) {
      const bruto = searchParams?.[`f_${c.campo}`];
      if (filtros[c.campo] && bruto) p.set(`f_${c.campo}`, bruto);
    }
    const inteiro = d1 === iso(ano, 1, 1) && d2 === iso(ano, 12, 31);
    if (d1 && d2 && !inteiro) { p.set('de', d1); p.set('ate', d2); }
    return `?${p.toString()}`;
  };

  // ---- os números ---------------------------------------------------------
  const linhasCt = await ocupacaoPorCt(exec.id, areaId, periodo.de, periodo.ate,
                                       listaIds, cargaId);

  const nivelMes = periodo.nivel !== 'DIA' && periodo.nivel !== 'TURNO';
  let dados;

  if (nivelMes) {
    const [cap, dem] = await Promise.all([
      porMes(exec.id, areaId, periodo.de, periodo.ate, listaIds, null),
      demandaPorMesDaArea(cargaId, areaId, periodo.de, periodo.ate, listaIds),
    ]);
    dados = mesesNoIntervalo(periodo.de, periodo.ate).map((m) => {
      const c = cap.find((x) => Number(x.mes) === m.mes);
      const d = dem.find((x) => Number(x.mes) === m.mes);
      return {
        // O asterisco avisa que a barra é de um mês cortado pelo recorte —
        // sem ele, a comparação com os vizinhos engana.
        rotulo: MESES[m.mes] + (m.parcial ? '*' : ''),
        capacidade: num(c?.[medida]),
        demanda: num(d?.minutos),
        href: url({ de: m.de, ate: m.ate }),
      };
    });
  } else {
    const [cap, dem] = await Promise.all([
      porDia(exec.id, areaId, periodo.de, periodo.ate, listaIds, null),
      demandaPorDiaDaArea(cargaId, areaId, periodo.de, periodo.ate, listaIds),
    ]);
    // A demanda da base é MENSAL: ela vem carimbada no primeiro dia do mês.
    // Espalhar por dia útil seria inventar uma distribuição que o plano não
    // deu, então no nível de dia ela aparece onde está — e o rodapé avisa.
    dados = diasNoIntervalo(periodo.de, periodo.ate).map((data) => {
      const c = cap.find((x) => x.data === data);
      const d = dem.find((x) => x.mes_data === data);
      return {
        rotulo: `${DIAS_CURTO[diaDaSemana(data)]} ${data.slice(8)}`,
        capacidade: num(c?.[medida]),
        demanda: num(d?.minutos),
        href: null,
      };
    });
  }

  const totCap = dados.reduce((s, x) => s + x.capacidade, 0);
  const totDem = dados.reduce((s, x) => s + x.demanda, 0);
  const totOcup = ocupa(totDem, totCap);

  // Os meses que estouram são o que se procura aqui.
  const estouram = dados.filter((x) => {
    const o = ocupa(x.demanda, x.capacidade);
    return o !== null && o > 100;
  });

  const ordem = leOrdem(searchParams?.ordem, { campo: 'ct', desc: false });
  const comOcup = linhasCt.map((r) => ({
    ...r,
    capacidade: num(r[medida]),
    ocupacao: ocupa(r.demanda, r[medida]),
  }));
  const ordenados = ordenar(comOcup, ordem);

  // Só com a aba aberta: são duas consultas caras, e quem fica na tabela por
  // centro de trabalho não tem por que pagar por elas.
  let porAtributo = [];
  let mesesDaTabela = [];
  if (aba === 'atributo' && nivelMes) {
    const [capCt, combos, manuais, taxasMix] = await Promise.all([
      capacidadePorCtMes(exec.id, areaId, periodo.de, periodo.ate, listaIds,
                         medida),
      combinacoesPorMes(
        carga.id,
        [...new Set([...camposUsados(regrasDePara), attrTabela])]),
      mixAjustes(attrTabela, ano),
      taxasDoMix(attrTabela),
    ]);

    const ehBase = CAMPOS_BASE.some((c) => c.codigo === attrTabela);
    const rotulos = [
      ...(ehBase ? valoresDe(combos, attrTabela).map((v) => v.valor)
                 : rotulosDe(regrasDePara, attrTabela)),
      null,
    ];

    const cts = [...new Set(capCt.map((c) => c.ct))];
    const cap = capacidadePorAtributo(capCt, combos, attrsDePara, regrasDePara,
      attrTabela, rotulos, { ano, manuais, taxas: taxasMix });
    const dem = demandaPorAtributo(combos, attrsDePara, regrasDePara, attrTabela,
      cts);

    // Um rótulo entra se tiver capacidade OU demanda: o que só tem demanda é o
    // caso mais importante — plano pedindo de algo que ninguém produz aqui.
    const chaves = [...new Set([
      ...cap.linhas.map((l) => l.rotulo),
      ...dem.map((l) => l.rotulo),
    ])];
    porAtributo = chaves.map((rotulo) => ({
      rotulo,
      capacidade: new Map(
        [...(cap.linhas.find((l) => l.rotulo === rotulo)?.meses ?? new Map())]
          .map(([m, v]) => [m, v.min])),
      demanda: dem.find((l) => l.rotulo === rotulo)?.meses ?? new Map(),
    }));

    mesesDaTabela = mesesNoIntervalo(periodo.de, periodo.ate).map((m) => ({
      chave: iso(m.ano, m.mes, 1),
      rotulo: MESES[m.mes] + (m.parcial ? '*' : ''),
    }));
  }

  const colunas = [
    { chave: 'planta', rot: 'Planta', celula: (r) => r.planta || '—' },
    { chave: 'area', rot: 'Área', celula: (r) => r.area || '—' },
    { chave: 'cc', rot: 'CC', celula: (r) => <code>{r.cc}</code> },
    { chave: 'ct', rot: 'CT', celula: (r) => <code>{r.ct}</code> },
    { chave: 'recursos', rot: 'Recursos',
      celula: (r) => (r.recursos
        || <span className="muted">sem recurso cadastrado</span>) },
    { chave: 'capacidade', num: true, rot: `${rotuloMedida} (${sufixoUnidade(unidade)})`,
      celula: (r) => (
        <span title={detalhe(r.capacidade, unidade)}>
          {formataUnidade(r.capacidade, unidade)}
        </span>
      ) },
    { chave: 'demanda', num: true, rot: `Demanda (${sufixoUnidade(unidade)})`,
      celula: (r) => (
        <span title={detalhe(r.demanda, unidade)}>
          {formataUnidade(r.demanda, unidade)}
        </span>
      ) },
    { chave: 'ocupacao', num: true, rot: 'Ocupação',
      celula: (r) => (
        <span className={classePct(r.ocupacao)}>{fmtPct(r.ocupacao)}</span>
      ) },
  ];

  const semRecurso = comOcup.filter((r) => !r.recursos && r.demanda > 0);
  const semDemanda = comOcup.filter((r) => r.recursos && r.demanda === 0);

  return (
    <Shell>
      {topo}

      <div className="kpis-linha">
        <div className="kpis">
          <div className="kpi">
            <p className="rot">{rotuloMedida}</p>
            <p className="val" title={detalhe(totCap, unidade)}>
              {formataUnidade(totCap, unidade)} {sufixoUnidade(unidade)}
            </p>
            <p className="sub">
              {MEDIDAS.find((m) => m.valor === medida).dica} ·{' '}
              {rotuloPeriodo(periodo.de, periodo.ate)}
            </p>
          </div>
          <div className="kpi">
            <p className="rot">Demanda</p>
            <p className="val" title={detalhe(totDem, unidade)}>
              {formataUnidade(totDem, unidade)} {sufixoUnidade(unidade)}
            </p>
            <p className="sub">{carga.cenario}</p>
          </div>
          <div className="kpi">
            <p className="rot">Ocupação</p>
            <p className={`val ${classePct(totOcup)}`}>{fmtPct(totOcup)}</p>
            <p className="sub">
              {totOcup === null ? 'sem capacidade no período'
                : totOcup > 100
                  ? `falta ${formataUnidade(totDem - totCap, unidade)} `
                    + `${sufixoUnidade(unidade)}`
                  : `sobra ${formataUnidade(totCap - totDem, unidade)} `
                    + `${sufixoUnidade(unidade)}`}
            </p>
          </div>
        </div>

        <div className="modo-caixa">
          <Suspense>
            <SeletorAno ano={ano} anos={anos} />
          </Suspense>

          {/* A capacidade das barras. Uma só: a resposta deste painel é a
              distância entre a barra e a linha, e ela precisa estar sozinha. */}
          <nav className="modo">
            {MEDIDAS.map((m) => (
              <Link key={m.valor} href={url({ med: m.valor })}
                    className={m.valor === medida ? 'modo-on' : ''}>
                {m.rotulo}
              </Link>
            ))}
          </nav>

          <nav className="modo">
            {['min', 'h'].map((u) => (
              <Link key={u} href={url({ um: u })}
                    className={u === unidade ? 'modo-on' : ''}>
                {u === 'min' ? 'min' : 'horas'}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="painel">
        <div className="painel-topo">
          <h2>
            {nivelMes ? 'Mês a mês' : 'Dia a dia'}
            <span className="muted" style={{ fontWeight: 400 }}>
              {' '}· {rotuloMedida} contra a demanda
            </span>
          </h2>
          <Suspense>
            <FiltrosOcupacao cargas={listaCargas} carga={cargaId} />
          </Suspense>
        </div>

        {/* Gráfico e tabela na MESMA caixa de rolagem — ver ../painel/grade.js. */}
        <div className="grade-rolagem">
          <div className="grade-alinhada" style={{ minWidth: LARGURA_MIN }}>
            <GraficoOcupacao dados={dados} medida={rotuloMedida}
                             unidade={unidade} tema={tema} />
            <TabelaMesOcupacao dados={dados} medida={rotuloMedida}
                               unidade={unidade} />
          </div>
        </div>

        {estouram.length > 0 && (
          <div className="aviso" style={{ marginTop: 12 }}>
            <strong>
              {estouram.length} {nivelMes ? 'mês(es)' : 'dia(s)'} com demanda
              acima da capacidade {rotuloMedida.toLowerCase()}.
            </strong>
            <p style={{ margin: '6px 0 0' }}>
              {estouram.map((x) => x.rotulo).join(' · ')}
            </p>
          </div>
        )}

        <p className="rodape">
          A <strong>área</strong> é a capacidade{' '}
          <strong>{rotuloMedida.toLowerCase()}</strong> — o espaço que existe. A{' '}
          <strong>coluna</strong> é a demanda desta base, em tempo de roteiro já
          explodido para a quantidade do plano: <strong>não é conversão</strong>,
          é o minuto que o plano pede. Coluna que passa do teto da área é o que
          não cabe.
          {!nivelMes && (
            <>
              {' '}<strong>No dia a dia a demanda aparece toda no dia 1º</strong>:
              a base é mensal, e espalhá-la pelos dias inventaria uma
              distribuição que o plano não deu.
            </>
          )}
        </p>
      </div>

      <div className="painel">
        <div className="painel-topo">
          {/* Duas leituras da MESMA ocupação: por máquina e por produto. A aba
              é um Link e não estado de tela porque a segunda custa duas
              consultas — abrir tem que ser uma decisão, não um efeito. */}
          <div className="chips" style={{ marginBottom: 0 }}>
            <Link href={url({ abaSel: 'ct' })}
                  className={`chip ${aba === 'ct' ? 'chip-on' : ''}`}>
              Ocupação por centro de trabalho
            </Link>
            {podeAtributo && (
              <Link href={url({ abaSel: 'atributo' })}
                    className={`chip ${aba === 'atributo' ? 'chip-on' : ''}`}>
                Ocupação por atributo
              </Link>
            )}
          </div>
          <Suspense>
            <FiltrosRecurso ano={ano} periodo={periodo}
                            campos={naBarra} opcoes={opcoes} />
          </Suspense>
        </div>

        {aba === 'atributo' && (
          <div className="filtros" style={{ marginBottom: 12 }}>
            <nav className="modo modo-ano">
              {atributosFiltro.map((a) => (
                <Link key={a.codigo} href={url({ attrTab: a.codigo })}
                      className={a.codigo === attrTabela ? 'modo-on' : ''}>
                  {a.nome}
                </Link>
              ))}
            </nav>
          </div>
        )}
        {ativos.length > 0 && (
          <p className="filtro-resumo">
            Recortando por:
            {ativos.map((t) => <span key={t} className="filtro-selo">{t}</span>)}
          </p>
        )}
        <p className="rodape" style={{ margin: '0 0 1rem' }}>
          Estes filtros valem para os indicadores e o gráfico acima também. O{' '}
          <strong>▼</strong> ao lado do título da coluna filtra por aquele
          campo, com operador e vários valores.
        </p>

        {aba === 'ct' && (
          <p className="rodape" style={{ margin: '0 0 1rem' }}>
            A comparação é no grão do <strong>CT</strong>, e não do recurso: a
            capacidade é do recurso e a demanda é do centro de trabalho. Dois
            recursos no mesmo CT dividem uma demanda que não sabe deles, e o
            dado não tem por onde repartir.
            {' '}Clique num título de coluna para ordenar.
          </p>
        )}

        {aba === 'atributo' && (
          <p className="rodape" style={{ margin: '0 0 1rem' }}>
            A mesma ocupação, por produto em vez de por máquina — um rótulo pode
            estourar em junho sem que nenhum centro estoure, porque ele divide o
            mês com os outros. Cada célula traz a <strong>ocupação</strong> e,
            embaixo, demanda sobre {String(rotuloMedida).toLowerCase()}.
            {' '}A capacidade vem <strong>rateada</strong> pela fatia de tempo de
            cada rótulo; a demanda vem inteira, porque ela já é da linha e a
            linha já é classificada.
          </p>
        )}

        {aba === 'atributo' && !nivelMes && (
          <p className="vazio">
            A ocupação por atributo é mensal — a base de demanda vem carimbada
            no mês, e reparti-la por dia inventaria uma distribuição que o plano
            não deu. Volte ao ano inteiro para ver esta leitura.
          </p>
        )}

        {aba === 'atributo' && nivelMes && (
          <div className="grade-rolagem">
            <div className="grade-alinhada" style={{ minWidth: LARGURA_MIN }}>
              <TabelaAtributoOcupacao
                linhas={porAtributo}
                meses={mesesDaTabela}
                unidade={unidade}
                medida={rotuloMedida}
                atributo={atributosFiltro.find((a) => a.codigo === attrTabela)?.nome
                          ?? attrTabela} />
            </div>
          </div>
        )}

        {aba === 'ct' && (
        <div className="grade-rolagem">
          <table className="tabela-recursos">
            <thead>
              <tr>
                {colunas.map((c) => {
                  const atual = ordem?.campo === c.chave;
                  return (
                    <th key={c.chave}
                        className={`${c.num ? 'num' : ''}`
                                   + `${filtros[c.chave] ? ' th-filtrada' : ''}`}>
                      <Link className="th-ordem"
                            href={url({
                              ordem: `${c.chave}:${atual && !ordem.desc ? 'desc' : 'asc'}`,
                            })}>
                        {c.rot}
                        <span className="th-seta">
                          {atual ? (ordem.desc ? '▼' : '▲') : '⇅'}
                        </span>
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((r) => (
                <tr key={r.ct}>
                  {colunas.map((c) => (
                    <td key={c.chave} className={c.num ? 'num' : ''}>
                      {c.celula(r)}
                    </td>
                  ))}
                </tr>
              ))}
              {!ordenados.length && (
                <tr><td colSpan={colunas.length} className="vazio">
                  Nada nesta área e período.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}

        {aba === 'ct' && semRecurso.length > 0 && (
          <p className="rodape">
            <strong>{semRecurso.length} centro(s) com demanda e sem recurso
            cadastrado</strong> — o plano pede de uma máquina que este cadastro
            não tem, e a ocupação deles não é calculável.
            {' '}{semRecurso.slice(0, 8).map((r) => r.ct).join(' · ')}
            {semRecurso.length > 8 && ` … e mais ${semRecurso.length - 8}`}.
          </p>
        )}
        {aba === 'ct' && semDemanda.length > 0 && (
          <p className="rodape">
            {semDemanda.length} centro(s) com capacidade e sem demanda nesta
            base: ociosos no plano, ou máquina que este cenário não usa.
          </p>
        )}

        <p className="rodape">
          Rodada {exec.id} · OEE {rotuloOrigem(exec.origem)} · base{' '}
          {carga.cenario}. Cadastro alterado depois disso só entra na conta ao{' '}
          <strong>Recalcular tudo</strong>.
        </p>
      </div>
    </Shell>
  );
}
