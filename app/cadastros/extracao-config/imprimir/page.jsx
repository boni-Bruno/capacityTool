import { areas, detalheDoRecorte } from '../../../../lib/db';
import { cargas } from '../../../../lib/demanda';
import { ORIGENS, rotuloOrigem } from '../../../../lib/origens';
import { rotuloArea } from '../../../../lib/dias';
import { resolvePeriodo } from '../../../../lib/periodo';
import {
  GRANULARIDADES, agrupa, ehGranularidade, ehMedida, rotuloIntervalo,
  secoesDoGrupo,
} from '../../../../lib/documento';
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
// Fora do Shell de propósito: menu lateral não vai para o papel.

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
  const [todasAreas, listaCargas, detalhe] = await Promise.all([
    areas(),
    cargas(),
    detalheDoRecorte(areaIds, ccs, ano, de, ate, origem, cargaId),
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

      {grupos.map((g, i) => (
        // Uma página por grupo, como um slide por grupo. A primeira segue o
        // cabeçalho: começar o documento com uma folha quase vazia seria
        // desperdiçar a página que mais se olha.
        <section key={g.chave} className={i > 0 ? 'pagina quebra' : 'pagina'}>
          {secoesDoGrupo(g, {
            de, ate, medida, origem, cenario: carga?.cenario ?? null,
          }).map((s) => (
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
        </section>
      ))}

      <p className="nota">
        A capacidade vem da mesma rodada que o painel mostra — uma por área, ano
        e origem. Cadastro alterado depois dela só entra na conta ao Recalcular
        tudo.
      </p>
    </Imprime>
  );
}
