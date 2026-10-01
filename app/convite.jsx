import { versoes, progressoDaVersao } from '../lib/versao-db';
import { progresso } from '../lib/versao';
import { CENARIOS } from '../lib/origens';
import { areasDoEscopo } from './cadastros/guarda';

// A FAIXA DE CONVITE da home: "há uma versão aberta, falta tanto".
//
// ELA CONSULTA O BANCO, e a home não consulta de propósito (ver o comentário no
// topo de app/page.jsx: "se a DATABASE_URL cair, esta tela ainda abre e explica
// onde ir"). Por isso ela mora num componente à parte, renderizado dentro de um
// <Suspense> — e com o try/catch abaixo, que devolve nada em vez de propagar:
// uma landing page que falha porque o banco caiu falha justamente na hora em
// que alguém precisa dela para entender o que houve.
//
// Nada aqui é obrigatório para usar a ferramenta. É um atalho; sumir é aceitável.
export default async function Convite() {
  let lista;
  let areas;
  try {
    [lista, areas] = await Promise.all([versoes(), areasDoEscopo()]);
  } catch {
    return null;
  }

  const abertas = lista.filter((v) => !v.fechada_em);
  if (!abertas.length || !areas.length) return null;

  const permitidas = new Set(areas.map((a) => Number(a.id)));

  // Uma linha por versão aberta, com o que falta nas áreas DESTA pessoa: o
  // convite tem que falar do trabalho dela, não do da fábrica inteira.
  const linhas = [];
  for (const v of abertas) {
    // eslint-disable-next-line no-await-in-loop
    const porArea = await progressoDaVersao(v.id);
    const minhas = porArea.filter((a) => permitidas.has(Number(a.area_id)));
    if (!minhas.length) continue;

    const prontas = minhas.filter(
      (a) => progresso(v.passos_exigidos, a.feitos).completo).length;
    linhas.push({
      id: v.id,
      origem: v.origem,
      ano: Number(v.ano),
      numero: v.numero,
      rotulo: v.rotulo,
      prontas,
      total: minhas.length,
    });
  }

  if (!linhas.length) return null;

  return (
    <div className="convite">
      {linhas.map((l) => (
        <a key={l.id} className="convite-linha"
           href={`/planejamento?cenario=${l.origem}&ano=${l.ano}`}>
          <span>
            <strong>
              {CENARIOS.find((c) => c.codigo === l.origem)?.rotulo} {l.ano}
            </strong>
            {' '}· v{l.numero}{l.rotulo ? ` — ${l.rotulo}` : ''} em planejamento
            {' '}· <strong>{l.prontas} de {l.total}</strong>{' '}
            {l.total === 1 ? 'fábrica concluída' : 'fábricas concluídas'}
          </span>
          <span className="convite-ir">
            {l.prontas === l.total ? 'Revisar →' : 'Continuar o planejamento →'}
          </span>
        </a>
      ))}
    </div>
  );
}
