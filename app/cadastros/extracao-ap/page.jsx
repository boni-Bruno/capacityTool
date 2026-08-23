import { anosComRodada, recursosParaExtracao } from '../../../lib/db';
import { ctsSemQuantidadeAp, resumoRecursosAp } from '../../../lib/demanda';
import AvisoBanco from '../aviso-banco';
import Extrator from './extrator';
import ImportarAp from './importar-ap';

export const dynamic = 'force-dynamic';

// =============================================================================
// EXTRAÇÃO EM .CSV PARA O AP
//
// O caminho de volta: a capacidade calculada sai daqui no formato que o AP
// entende — CT no formato CC-CT e período AAAA.MM, o mesmo da base de demanda,
// porque é lá que os dois se encontram.
//
// A tela filtra ANTES de extrair, e mostra a prévia antes de baixar: arquivo
// gerado às cegas é conferido no destino, que é onde corrigir custa caro.
// =============================================================================

export default async function Page() {
  let recursos;
  let anos;
  let resumoAp;
  let semQuantidade;
  try {
    [recursos, anos, resumoAp, semQuantidade] = await Promise.all([
      recursosParaExtracao(), anosComRodada(),
      resumoRecursosAp(), ctsSemQuantidadeAp(),
    ]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Extração para o AP</h1>
      </div>

      <ImportarAp resumo={resumoAp} semQuantidade={semQuantidade} />

      {!anos.length ? (
        <div className="aviso">
          <strong>Nenhum cálculo rodado ainda.</strong>
          <p style={{ margin: '8px 0 0' }}>
            A extração lê o resultado do motor — sem rodada, não há o que
            extrair. Rode um cálculo no painel primeiro.
          </p>
        </div>
      ) : (
        <Extrator recursos={recursos} anos={anos.map(Number)} />
      )}
    </>
  );
}
