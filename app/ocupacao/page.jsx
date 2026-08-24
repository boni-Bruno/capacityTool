import { Suspense } from 'react';
import Link from 'next/link';
import {
  anosComRodada, areas, demandaPorDiaDaArea, demandaPorMesDaArea,
  ocupacaoPorCt, porDia, porMes, ultimaExecucao,
} from '../../lib/db';
import { anoEscolhido, anosParaEscolha } from '../../lib/anos';
import { cargas, cargaCorrente } from '../../lib/demanda';
import {
  diaDaSemana, diasNoIntervalo, iso, mesesNoIntervalo, resolvePeriodo,
  rotuloPeriodo,
} from '../../lib/periodo';
import { DIAS_CURTO, MESES, rotuloArea } from '../../lib/dias';
import { leOrdem, ordenar } from '../../lib/ordem';
import { ORIGENS, rotuloOrigem } from '../../lib/origens';
import { detalhe, formataUnidade, sufixoUnidade } from '../../lib/formato';
import { FiltrosTopo, SeletorAno } from '../painel/filtros';
import GraficoOcupacao from './grafico';
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

  const url = ({
    de: d1 = periodo.de,
    ate: d2 = periodo.ate,
    med = medida,
    um = unidade,
    cg = cargaId,
    ordem: ord = searchParams?.ordem ?? null,
  } = {}) => {
    const p = new URLSearchParams();
    p.set('area', String(areaId));
    p.set('ano', String(ano));
    p.set('origem', origem);
    if (med !== 'disponivel') p.set('medida', med);
    if (um !== 'min') p.set('unidade', um);
    if (cg) p.set('carga', String(cg));
    if (ord) p.set('ordem', ord);
    const inteiro = d1 === iso(ano, 1, 1) && d2 === iso(ano, 12, 31);
    if (d1 && d2 && !inteiro) { p.set('de', d1); p.set('ate', d2); }
    return `?${p.toString()}`;
  };

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

  // ---- os números ---------------------------------------------------------
  const linhasCt = await ocupacaoPorCt(exec.id, areaId, periodo.de, periodo.ate,
                                       null, cargaId);

  const nivelMes = periodo.nivel !== 'DIA' && periodo.nivel !== 'TURNO';
  let dados;

  if (nivelMes) {
    const [cap, dem] = await Promise.all([
      porMes(exec.id, areaId, periodo.de, periodo.ate, null, null),
      demandaPorMesDaArea(cargaId, areaId, periodo.de, periodo.ate),
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
      porDia(exec.id, areaId, periodo.de, periodo.ate, null, null),
      demandaPorDiaDaArea(cargaId, areaId, periodo.de, periodo.ate),
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
            <FiltrosOcupacao cargas={listaCargas} carga={cargaId}
                             periodo={periodo} ano={ano} />
          </Suspense>
        </div>

        <GraficoOcupacao dados={dados} medida={rotuloMedida} unidade={unidade} />

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
          A linha é a demanda desta base, em tempo de roteiro já explodido para
          a quantidade do plano — <strong>não é conversão</strong>, é o minuto
          que o plano pede. A barra é a capacidade{' '}
          <strong>{rotuloMedida.toLowerCase()}</strong>, e a distância entre as
          duas é a resposta.
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
        <h2>Por centro de trabalho</h2>
        <p className="rodape" style={{ margin: '0 0 1rem' }}>
          A comparação é no grão do <strong>CT</strong>, e não do recurso: a
          capacidade é do recurso e a demanda é do centro de trabalho. Dois
          recursos no mesmo CT dividem uma demanda que não sabe deles, e o dado
          não tem por onde repartir.
          {' '}Clique num título de coluna para ordenar.
        </p>

        <div className="grade-rolagem">
          <table className="tabela-recursos">
            <thead>
              <tr>
                {colunas.map((c) => {
                  const atual = ordem?.campo === c.chave;
                  return (
                    <th key={c.chave} className={c.num ? 'num' : ''}>
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

        {semRecurso.length > 0 && (
          <p className="rodape">
            <strong>{semRecurso.length} centro(s) com demanda e sem recurso
            cadastrado</strong> — o plano pede de uma máquina que este cadastro
            não tem, e a ocupação deles não é calculável.
            {' '}{semRecurso.slice(0, 8).map((r) => r.ct).join(' · ')}
            {semRecurso.length > 8 && ` … e mais ${semRecurso.length - 8}`}.
          </p>
        )}
        {semDemanda.length > 0 && (
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
