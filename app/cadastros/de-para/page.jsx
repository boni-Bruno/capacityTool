import Link from 'next/link';
import {
  atributos, cargaCorrente, combinacoesDaCarga, todasAsRegras,
} from '../../../lib/demanda';
import AvisoBanco from '../aviso-banco';
import Editor from './editor';

export const dynamic = 'force-dynamic';

// =============================================================================
// DE/PARA — A LÍNGUA DA EMPRESA SOBRE A LÍNGUA DA BASE
//
// A base traz o vocabulário do sistema de origem: LINHA DE PRODUTO AGRUPADA,
// FAMÍLIA DE TECELAGEM, códigos. Ninguém pede capacidade nessa língua. Esta tela
// é onde "TECIDO CRU FELPUDO com família 225" vira "Banho Jacquard", e onde os
// rótulos viram os cortes pelos quais o painel vai ser lido.
//
// AS COMBINAÇÕES VÃO INTEIRAS PARA O NAVEGADOR, de propósito. São pouco mais de
// mil — os seis atributos que as regras enxergam colapsam as 116 mil linhas 91
// vezes — e é isso que faz a prévia ser exata e instantânea em vez de uma
// amostra ou uma ida ao banco por tecla digitada.
//
// A conta que a prévia mostra é a mesma que o servidor vai fazer: o motor é o
// mesmo arquivo (`lib/regras.js`), puro dos dois lados. Duas implementações da
// mesma regra divergiriam, e a divergência apareceria como um número diferente
// do que a prévia prometeu.
// =============================================================================

export default async function Page() {
  let corrente;
  let attrs;
  let regras;
  try {
    [corrente, attrs, regras] = await Promise.all([
      cargaCorrente(), atributos(), todasAsRegras(),
    ]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  const combinacoes = corrente ? await combinacoesDaCarga(corrente.id) : [];

  return (
    <>
      <div className="topo">
        <h1 className="titulo">DE/PARA da demanda</h1>
      </div>

      {!corrente ? (
        <div className="painel">
          <p className="vazio">
            Nenhuma carga de demanda está no ar. As regras se escrevem lendo o
            que existe na base — sem ela, seria digitar valor no escuro, que é
            justamente como se cria regra que não pega nada.
            {' '}<Link href="/cadastros/demanda">Importar uma carga</Link>.
          </p>
        </div>
      ) : (
        <Editor cargaId={corrente.id} cenario={corrente.cenario}
                combinacoes={combinacoes} atributos={attrs} regras={regras} />
      )}
    </>
  );
}
