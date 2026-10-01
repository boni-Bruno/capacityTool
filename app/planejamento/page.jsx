import { anomalias, contraAnoAnterior, progressoDaVersao, versoes } from '../../lib/versao-db';
import { PASSOS, limpaPassos, progresso, proximoPasso, versaoAberta } from '../../lib/versao';
import { CENARIOS, cenarioEscolhido } from '../../lib/origens';
import { formataUnidade } from '../../lib/formato';
import { exigeVer, areasDoEscopo } from '../cadastros/guarda';
import AvisoBanco from '../cadastros/aviso-banco';
import Etapas from './etapas';
import Rodar from './rodar';

// Os editores embutidos. SÃO AS PÁGINAS INTEIRAS, e não cópias das props delas:
// server component compõe, então o passo renderiza a tela que já existe, com as
// consultas, a guarda de permissão e o escopo dela. Copiar o prop-building
// seria um segundo lugar para manter em dia, e o primeiro esquecimento deixaria
// o fluxo mostrando uma tela diferente da do menu.
import RecursosPage from '../cadastros/recursos/page';
import TurnosDoRecursoPage from '../cadastros/turnos-do-recurso/page';
import OeePage from '../cadastros/oee/page';
import ParadasPage from '../cadastros/paradas/page';

export const metadata = { title: 'Planejar uma fábrica' };
export const dynamic = 'force-dynamic';

// =============================================================================
// O FLUXO GUIADO
//
// Cadastrar um cenário novo pelo menu é passear por dez telas, cada uma com seus
// seletores, sem nada garantindo que uma área foi revisada por inteiro. Aqui o
// cenário, o ano e a fábrica são escolhidos uma vez, e as etapas vêm na ordem da
// cadeia do motor: instalada → planejada → disponível → o número → a conferência.
//
// TUDO NA URL (?cenario=&ano=&area=&passo=), que é a convenção do projeto:
// recarregar cai no mesmo passo, e o endereço descreve por inteiro onde a pessoa
// está. É o que faz um desligamento no meio não perder o lugar.
// =============================================================================

const TITULO = {
  recursos: 'As máquinas e postos desta fábrica',
  jornada: 'Em que turnos e em que dias cada recurso roda',
  oee: 'O rendimento que vira capacidade disponível',
  paradas: 'As paradas planejadas do ano',
};

export default async function Page({ searchParams }) {
  const negado = await exigeVer('planejamento');
  if (negado) return negado;

  let lista;
  let areas;
  try {
    [lista, areas] = await Promise.all([versoes(), areasDoEscopo()]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  const cenario = cenarioEscolhido(searchParams?.cenario);
  const rotuloCenario = CENARIOS.find((c) => c.codigo === cenario)?.rotulo;

  // O ano tem que ter VERSÃO ABERTA: é ela que define o que está em
  // planejamento. Sem ela não há o que percorrer, e o fluxo diz isso em vez de
  // mostrar etapas que não gravam em lugar nenhum.
  const pedido = Number(searchParams?.ano);
  const abertas = lista.filter((v) => v.origem === cenario && !v.fechada_em);
  const ano = abertas.some((v) => Number(v.ano) === pedido)
    ? pedido : Number(abertas[0]?.ano);
  const versao = versaoAberta(lista, cenario, ano);

  const cabecalho = (
    <div className="topo">
      <h1 className="titulo">
        Planejar uma fábrica
        <span className="muted" style={{ marginLeft: 8, fontWeight: 400, fontSize: 15 }}>
          · {rotuloCenario} {Number.isFinite(ano) ? ano : ''}
          {versao && ` · v${versao.numero}`}
        </span>
      </h1>
    </div>
  );

  if (!versao) {
    return (
      <>
        {cabecalho}
        <div className="aviso">
          <strong>
            Não há versão aberta em {rotuloCenario} para planejar.
          </strong>
          <p style={{ margin: '8px 0 0' }}>
            O planejamento acontece dentro de uma versão: é ela que diz quais
            etapas precisam ser revisadas e guarda o que já foi. Peça ao gestor
            de planejamento para abrir uma em{' '}
            <a href="/cadastros/habilitacao">Habilitação de cenário/ano</a>.
          </p>
          <p style={{ margin: '8px 0 0' }}>
            {CENARIOS.filter((c) => c.codigo !== cenario).map((c) => (
              <a key={c.codigo} href={`/planejamento?cenario=${c.codigo}`}>
                Ver o cenário {c.rotulo} →
              </a>
            ))}
          </p>
        </div>
      </>
    );
  }

  const exigidos = limpaPassos(versao.passos_exigidos);
  const porArea = await progressoDaVersao(versao.id);
  // O escopo manda: quem atende duas áreas planeja duas, e não a fábrica toda.
  const permitidas = new Set(areas.map((a) => Number(a.id)));
  const minhas = porArea.filter((a) => permitidas.has(Number(a.area_id)));

  const areaPedida = Number(searchParams?.area);
  const area = minhas.find((a) => Number(a.area_id) === areaPedida) ?? null;

  // -------------------------------------------------------------------------
  // PASSO 0 — escolher a fábrica
  // -------------------------------------------------------------------------
  if (!area) {
    const prontas = minhas.filter(
      (a) => progresso(exigidos, a.feitos).completo).length;

    return (
      <>
        {cabecalho}

        <div className="painel">
          <h2>
            Escolha a fábrica
            <span className="muted" style={{ marginLeft: 8, fontWeight: 400 }}>
              · {prontas} de {minhas.length} concluídas
            </span>
          </h2>

          <div className="acoes" style={{ marginBottom: 14 }}>
            {CENARIOS.map((c) => (
              <a key={c.codigo}
                 className={'btn' + (c.codigo === cenario ? ' btn-primario' : '')}
                 href={`/planejamento?cenario=${c.codigo}`}>
                {c.rotulo}
              </a>
            ))}
            {abertas.length > 1 && abertas.map((v) => (
              <a key={v.id}
                 className={'btn btn-mini' + (Number(v.ano) === ano ? ' btn-primario' : '')}
                 href={`/planejamento?cenario=${cenario}&ano=${v.ano}`}>
                {v.ano}
              </a>
            ))}
          </div>

          {!minhas.length ? (
            <p className="muted">
              Nenhuma área no seu escopo. Peça ao gestor que inclua as fábricas
              que você atende no seu cadastro de usuário.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Planta</th>
                  <th>Área</th>
                  <th style={{ width: 240 }}>Etapas</th>
                  <th style={{ width: 160 }} />
                </tr>
              </thead>
              <tbody>
                {minhas.map((a) => {
                  const p = progresso(exigidos, a.feitos);
                  const prox = proximoPasso(exigidos, a.feitos);
                  return (
                    <tr key={a.area_id} className={p.completo ? 'linha-vazia' : ''}>
                      <td className="muted">{a.planta}</td>
                      <td>{a.area}</td>
                      <td>
                        <span className={'selo ' + (p.completo ? 'ok' : 'alerta')}>
                          {p.feitos} de {p.total}
                        </span>
                        {!p.completo && prox && (
                          <span className="muted" style={{ marginLeft: 8 }}>
                            falta {PASSOS.find((x) => x.codigo === prox)?.rotulo}
                          </span>
                        )}
                      </td>
                      <td className="acoes">
                        <a className={'btn btn-mini' + (p.completo ? '' : ' btn-primario')}
                           href={`/planejamento?cenario=${cenario}&ano=${ano}`
                                 + `&area=${a.area_id}&passo=${prox ?? exigidos[0]}`}>
                          {p.completo ? 'Revisar' : p.feitos ? 'Continuar' : 'Planejar'}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <p className="rodape">
            Esta versão exige{' '}
            <strong>
              {exigidos.map((c) => PASSOS.find((p) => p.codigo === c)?.rotulo).join(', ')}
            </strong>
            {versao.rotulo && <> — {versao.rotulo}</>}. Etapa que a versão não
            exige não aparece no fluxo e já conta como concluída: quem abriu a
            versão decidiu que ela não mudou.
          </p>
        </div>
      </>
    );
  }

  // -------------------------------------------------------------------------
  // PASSOS 1 a 6
  // -------------------------------------------------------------------------
  const feitos = Array.from(area.feitos ?? []);
  const pedidoPasso = String(searchParams?.passo ?? '');
  const passo = exigidos.includes(pedidoPasso)
    ? pedidoPasso : (proximoPasso(exigidos, feitos) ?? exigidos[0]);

  const restantes = exigidos.filter((c) => c !== passo && !feitos.includes(c));
  const ordem = exigidos.indexOf(passo);
  const proximo = exigidos.slice(ordem + 1).find((c) => c !== passo) ?? null;

  const base = `/planejamento?cenario=${cenario}&ano=${ano}&area=${area.area_id}`;

  // TODO O RESTO DA URL VAI JUNTO, e não só o que o fluxo decide.
  //
  // Os editores embutidos têm seletores próprios — CC, CT, patrimônio, código,
  // recurso, tipo — e eles escrevem na URL desta rota, porque é a que está no
  // navegador. Passando só area/ano/cenario, a página recebia `cc: undefined`
  // em toda navegação e voltava para "todos": o endereço mudava, a tela não.
  // Era o que acontecia ao escolher um CC aqui dentro.
  //
  // A ordem importa: espalha primeiro, sobrescreve depois. Fábrica, ano e
  // cenário são do FLUXO e não do editor — quem os escolhe é o passo 0 e a
  // versão aberta, e deixar o seletor interno mudá-los tiraria a pessoa da
  // fábrica que ela está planejando sem dizer nada.
  const sp = {
    ...searchParams,
    area: String(area.area_id),
    ano: String(ano),
    cenario,
    origem: cenario,
    // A marca que faz o editor esconder os seletores de fábrica, ano e cenário
    // (lib/filtro-fluxo.js): oferecer uma escolha que a rota desfaz no próximo
    // render parece defeito, e é pior que não ter a opção.
    fluxo: '1',
  };

  // O passo 6 precisa dos números; os outros não, e lê-los sempre seria pagar
  // duas consultas em toda etapa.
  const [achados, serie] = passo === 'conferir'
    ? await Promise.all([
      anomalias(area.area_id, ano, cenario),
      contraAnoAnterior(area.area_id, ano, cenario),
    ])
    : [[], []];

  const p = progresso(exigidos, feitos);

  return (
    <>
      <div className="topo">
        <h1 className="titulo">
          {area.planta} · {area.area}
          <span className="muted" style={{ marginLeft: 8, fontWeight: 400, fontSize: 15 }}>
            · {rotuloCenario} {ano} · v{versao.numero} · {p.feitos} de {p.total} etapas
          </span>
        </h1>
      </div>

      <Etapas passos={PASSOS} exigidos={exigidos} feitos={feitos} atual={passo}
              versaoId={versao.id} areaId={area.area_id}
              base={base} proximo={proximo} />

      {TITULO[passo] && (
        <p className="rodape" style={{ marginTop: 14, marginBottom: 0 }}>
          <strong>{PASSOS.find((x) => x.codigo === passo)?.rotulo}</strong> —
          {' '}{TITULO[passo]}.
          {passo === 'paradas' && (
            <> <strong>Parada não tem cenário</strong>: o que você cadastrar aqui
            vale no Orçamento e na Simulação igual.</>
          )}
          {passo === 'recursos' && (
            <> A máquina é <strong>estrutura da empresa</strong> e existe nos dois
            cenários — o que varia é o que se planeja fazer com ela.</>
          )}
        </p>
      )}

      {/* OS EDITORES. Cada um é a página do menu inteira, com o recorte desta
          fábrica já aplicado. */}
      {passo === 'recursos' && <RecursosPage />}
      {passo === 'jornada'  && <TurnosDoRecursoPage searchParams={sp} />}
      {passo === 'oee'      && <OeePage searchParams={sp} />}
      {passo === 'paradas'  && <ParadasPage searchParams={sp} />}

      {passo === 'recalcular' && (
        <Rodar areaId={area.area_id} ano={ano} origem={cenario} ultima={null} />
      )}

      {passo === 'conferir' && (
        <Conferir achados={achados} serie={serie} ano={ano} base={base} />
      )}

      {restantes.length > 0 && passo === 'conferir' && (
        <div className="aviso" style={{ marginTop: 14 }}>
          <strong>
            Ainda faltam {restantes.length} etapa(s) nesta fábrica:{' '}
            {restantes.map((c) => PASSOS.find((x) => x.codigo === c)?.rotulo).join(', ')}.
          </strong>
        </div>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// O PASSO 6
//
// Tudo aqui é cadastro que o motor ACEITA e que produz número errado em
// silêncio. Nenhum é erro de digitação — são ausências, e ausência não dá
// mensagem em lugar nenhum. Por isso a conferência é uma etapa, e não um aviso
// no canto de outra tela.
// -----------------------------------------------------------------------------

const EXPLICA = {
  sem_turno: {
    titulo: 'Sem jornada no ano',
    texto: 'Não rodam em mês nenhum: a planejada é zero e eles somem do painel '
      + 'como se não existissem.',
    passo: 'jornada',
  },
  sem_regime: {
    titulo: 'Sem regime de dias em algum mês',
    texto: 'Mês sem calendário não sai zerado — o recurso SOME do cálculo '
      + 'naquele mês, sem erro e sem aviso.',
    passo: 'jornada',
  },
  oee_cem: {
    titulo: 'OEE em 100% o ano todo',
    texto: 'Não é erro: 100% é o "ainda não medi" dito em voz alta. Mas uma '
      + 'área inteira assim quase sempre é cadastro que ficou para trás.',
    passo: 'oee',
  },
};

function Conferir({ achados, serie, ano, base }) {
  const porTipo = {};
  for (const a of achados) (porTipo[a.tipo] ??= []).push(a);

  const atual = serie.find((s) => Number(s.ano) === ano)?.planejada ?? 0;
  const anterior = serie.find((s) => Number(s.ano) === ano - 1)?.planejada ?? 0;
  const variacao = anterior ? ((atual - anterior) / anterior) * 100 : null;

  return (
    <>
      <div className="painel">
        <h2>Conferir</h2>

        {!achados.length ? (
          <p className="muted">
            Nenhuma anomalia de cadastro nesta área. Os recursos têm jornada,
            regime em todos os meses e OEE medido.
          </p>
        ) : Object.entries(porTipo).map(([tipo, itens]) => (
          <div key={tipo} style={{ marginBottom: 16 }}>
            <strong>
              {EXPLICA[tipo]?.titulo ?? tipo}
              <span className="selo alerta" style={{ marginLeft: 8 }}>
                {itens.length}
              </span>
            </strong>
            <p className="muted" style={{ margin: '4px 0 6px', fontSize: 13 }}>
              {EXPLICA[tipo]?.texto}
              {EXPLICA[tipo]?.passo && (
                <> <a href={`${base}&passo=${EXPLICA[tipo].passo}`}>
                  Voltar para a etapa que resolve →
                </a></>
              )}
            </p>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {itens.slice(0, 12).map((i) => (
                <span key={i.recurso_id}>
                  {i.codigo}
                  {i.detalhe && ` (${i.detalhe})`}
                  {' · '}
                </span>
              ))}
              {itens.length > 12 && `… e mais ${itens.length - 12}`}
            </p>
          </div>
        ))}
      </div>

      {/* A COMPARAÇÃO COM O ANO ANTERIOR não é anomalia — máquina nova é motivo
          legítimo para a capacidade saltar. Mas um salto grande merece ser visto
          antes de alguém levar o número para uma reunião. */}
      {anterior > 0 && (
        <div className="painel">
          <h2>Contra {ano - 1}</h2>
          <div className="kpis">
            <div className="kpi">
              <p className="rot">Planejada {ano - 1}</p>
              <p className="val">{formataUnidade(anterior, 'min')}</p>
            </div>
            <div className="kpi">
              <p className="rot">Planejada {ano}</p>
              <p className="val">{formataUnidade(atual, 'min')}</p>
            </div>
            <div className="kpi">
              <p className="rot">Variação</p>
              <p className="val">
                {variacao > 0 ? '+' : ''}{variacao.toFixed(1)}%
              </p>
              <p className="sub">
                {Math.abs(variacao) > 20
                  ? 'salto grande — vale conferir antes de fechar'
                  : 'dentro do esperado'}
              </p>
            </div>
          </div>
          <p className="rodape">
            Os dois números saem da rodada de cada ano, no mesmo cenário. Se{' '}
            {ano} ainda não foi recalculado depois do que você cadastrou, ele
            está velho — volte uma etapa.
          </p>
        </div>
      )}
    </>
  );
}
