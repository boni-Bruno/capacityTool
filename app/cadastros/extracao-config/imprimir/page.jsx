import {
  areas, detalheDoRecorte, serieDoRecorte, turnosDoRecorte,
} from '../../../../lib/db';
import { cargas } from '../../../../lib/demanda';
import { ORIGENS, rotuloOrigem } from '../../../../lib/origens';
import { rotuloArea } from '../../../../lib/dias';
import { resolvePeriodo } from '../../../../lib/periodo';
import {
  GRANULARIDADES, agrupa, ehGranularidade, ehMedida, fmt, rotuloIntervalo,
  secoesDoGrupo, subtituloDoSlide, tituloDoSlide, visualDoGrupo,
} from '../../../../lib/documento';
import { colunas, geometriaDoGrafico } from '../../../../lib/visual';
import Imprime from './imprime';

export const dynamic = 'force-dynamic';

// A VERSÃO PARA PAPEL, que é como o PDF sai.
//
// Escrever PDF à mão daria fonte básica, acentuação limitada e nenhuma quebra
// de página — pior que o que o navegador entrega de graça, com o diálogo de
// salvar que a pessoa já conhece. Aqui a página é montada em HTML com regras de
// `@media print`, e o "Salvar como PDF" faz o resto.
//
// O TEXTO É O MESMO DO .PPTX, montado por `lib/documento.js`: um slide vira uma
// página, e as duas saídas nunca contam números diferentes da mesma seleção.
// Duas montagens do mesmo texto divergem na primeira mudança, e a divergência
// sai num documento que ninguém confere contra o outro.
//
// O GRÁFICO AQUI É SVG, e no slide é DrawingML — mas a GEOMETRIA é a mesma
// função. O que importa neste desenho é o alinhamento: o OEE de março tem que
// cair debaixo da barra de março. Duas contas de coluna batem hoje e param de
// bater na primeira mudança de margem, num defeito que só se vê no papel.
//
// Fora do Shell de propósito: menu lateral não vai para o papel.

// O desenho é em coordenadas próprias e o SVG estica para a largura da folha.
// A calha da esquerda vale 14% dos dois lados — do gráfico e da tabela — e é o
// que faz as colunas coincidirem.
const LARGURA = 1000;
const ALTURA = 260;
const CALHA = 140;

function Grafico({ visual }) {
  const g = geometriaDoGrafico({
    x: 0, y: 0, largura: LARGURA, altura: ALTURA,
    serie: visual.pontos, rotulo: CALHA,
  });
  const cols = colunas(0, LARGURA, visual.pontos.length, CALHA);

  return (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="desenho"
         preserveAspectRatio="none" role="img">
      <line x1={CALHA} y1={g.base} x2={LARGURA} y2={g.base}
            stroke="#c9c6bd" strokeWidth="1" />
      {g.barras.filter((b) => b.altura > 0).map((b) => (
        <g key={b.i}>
          <rect x={b.x} y={b.y} width={b.largura} height={b.altura} fill="#3f5d7d" />
          <text x={cols[b.i].centro} y={b.y - 5} textAnchor="middle"
                fontSize="13" fill="#57544d">{fmt(b.valor)}</text>
        </g>
      ))}
      {visual.rotuloDemanda && (
        <>
          <polyline fill="none" stroke="#c0552b" strokeWidth="2.5"
                    points={g.pontos.map((p) => `${p.x},${p.y}`).join(' ')} />
          {g.pontos.map((p) => (
            <circle key={p.i} cx={p.x} cy={p.y} r="4" fill="#c0552b" />
          ))}
        </>
      )}
    </svg>
  );
}

const lista = (t) => String(t ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export default async function Page({ searchParams }) {
  const areaIds = lista(searchParams?.areas).map(Number).filter(Number.isInteger);
  const ccs = lista(searchParams?.ccs);
  const ano = Number(searchParams?.ano) || new Date().getFullYear();
  const origem = ORIGENS.includes(searchParams?.origem)
    ? searchParams.origem : 'META';
  const medida = ehMedida(searchParams?.medida) ? searchParams.medida : 'disponivel';
  const grao = ehGranularidade(searchParams?.grao) ? searchParams.grao : 'RESUMO';
  const { de, ate } = resolvePeriodo(searchParams, ano);

  if (!areaIds.length) {
    return <p style={{ padding: '2rem' }}>Nenhuma área no recorte.</p>;
  }

  const cargaId = Number(searchParams?.carga) || null;
  const [todasAreas, listaCargas, detalhe, serie, turnos] = await Promise.all([
    areas(),
    cargas(),
    detalheDoRecorte(areaIds, ccs, ano, de, ate, origem, cargaId),
    serieDoRecorte(areaIds, ccs, ano, de, ate, origem, cargaId),
    turnosDoRecorte(areaIds, ccs, ano, de, ate),
  ]);

  const carga = listaCargas.find((c) => c.id === cargaId) ?? null;
  const escolhidas = todasAreas.filter((a) => areaIds.includes(a.id));
  const grupos = agrupa(detalhe, grao);

  return (
    <Imprime>
      <h1>Configurações da capacidade</h1>
      <p className="sub">
        {rotuloIntervalo(de, ate)} · OEE {rotuloOrigem(origem)} ·{' '}
        {GRANULARIDADES.find((g) => g.valor === grao).rotulo.toLowerCase()} ·{' '}
        gerado em {new Date().toLocaleDateString('pt-BR')}
      </p>

      <h2>Recorte</h2>
      <ul>
        {escolhidas.map((a) => <li key={a.id}>{rotuloArea(a)}</li>)}
      </ul>
      {ccs.length > 0 && (
        <p className="sub">Centros de custo: {ccs.join(' · ')}</p>
      )}
      {carga && <p className="sub">Cenário de demanda: {carga.cenario}</p>}

      {!grupos.length && (
        <p className="sub">
          O recorte não tem recurso nenhum — não há configuração para descrever.
        </p>
      )}

      {grupos.map((g, i) => {
        const opcoes = { de, ate, medida, origem, cenario: carga?.cenario ?? null };
        const visual = visualDoGrupo({
          grupo: g, granularidade: grao, serie, turnos,
          medida, cenario: carga?.cenario ?? null, de, ate, origem,
        });

        // Uma página por grupo, como um slide por grupo. A primeira segue o
        // cabeçalho: começar o documento com uma folha quase vazia seria
        // desperdiçar a página que mais se olha.
        return (
          <section key={g.chave} className={i > 0 ? 'pagina quebra' : 'pagina'}>
            {/* O mesmo par do slide: planta e área em cima, CC e CTs embaixo. */}
            <h2 className="titulo-grupo">{tituloDoSlide(g)}</h2>
            <p className="sub">{subtituloDoSlide(g)}</p>

            {!visual && secoesDoGrupo(g, opcoes).map((s) => (
              <div key={s.titulo} className="bloco">
                <h2>{s.titulo}</h2>
                <table>
                  <tbody>
                    {s.linhas.map((l, k) => (
                      <tr key={`${s.titulo}-${k}`}><td>{l}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {visual && (
              <div className="bloco visual">
                <p className="legenda">
                  <span className="chave cap" /> {visual.rotuloCapacidade}
                  {visual.rotuloDemanda && (
                    <>
                      {'  '}<span className="chave dem" /> {visual.rotuloDemanda}
                    </>
                  )}
                  {visual.rodape && <span className="quando">{visual.rodape}</span>}
                </p>
                <Grafico visual={visual} />
                <table className="grade">
                  <tbody>
                    {visual.linhas.map((l, k) => (
                      <tr key={`${l.rotulo}-${k}`}
                          className={l.cabecalho ? 'cabecalho' : ''}>
                        <th scope="row">{l.rotulo}</th>
                        {l.valores.map((v, c) => (
                          <td key={`${k}-${c}`}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      <p className="nota">
        A capacidade vem da mesma rodada que o painel mostra — uma por área, ano
        e origem. Cadastro alterado depois dela só entra na conta ao Recalcular
        tudo.
      </p>
    </Imprime>
  );
}
