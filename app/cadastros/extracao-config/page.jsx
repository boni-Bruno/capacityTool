import {
  anosComRodada, arvoreDeConfiguracao, faixasDeOcupacao, resumoModeloSlide,
} from '../../../lib/db';
import { cargaCorrente, cargas } from '../../../lib/demanda';
import { anoEscolhido, anosParaEscolha } from '../../../lib/anos';
import { ORIGENS } from '../../../lib/origens';
import AvisoBanco from '../aviso-banco';
import Exportar from './exportar';

export const dynamic = 'force-dynamic';

// =============================================================================
// EXTRAÇÃO DAS CONFIGURAÇÕES
//
// Um documento que conta como a fábrica está configurada num recorte, e quanta
// capacidade essa configuração produz. Sai em .pptx dentro do modelo da empresa,
// ou em PDF pela impressão do navegador.
//
// O recorte é planta › área › CC, escolhido em árvore. A extração para o AP, ao
// lado, é outra coisa: lá saem os minutos por CT e mês para importar de volta;
// aqui sai um documento para alguém ler.
//
// AS ESCOLHAS DA EXTRAÇÃO NÃO VÃO PARA A URL, e é a única tela do projeto assim.
// A marcação da árvore mora em estado do React, e cada mudança de searchParams
// remonta o componente e apaga o recorte que a pessoa acabou de montar clicando
// em vinte centros de custo. Ano e origem continuam sendo LIDOS da URL para um
// link antigo continuar valendo; daí em diante quem manda é a tela.
// =============================================================================

export default async function Page({ searchParams }) {
  let linhas;
  let modelo;
  let anos;
  let listaCargas;
  let corrente;
  let faixas;
  try {
    [linhas, modelo, anos, listaCargas, corrente, faixas] = await Promise.all([
      arvoreDeConfiguracao(), resumoModeloSlide(), anosComRodada(),
      cargas(), cargaCorrente(), faixasDeOcupacao(),
    ]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  const lista = anosParaEscolha(anos);
  const ano = anoEscolhido(searchParams?.ano, lista);
  const origem = ORIGENS.includes(searchParams?.origem)
    ? searchParams.origem : 'META';

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Extração das configurações</h1>
      </div>

      {!linhas.length ? (
        <div className="aviso">
          <strong>Nenhum recurso cadastrado.</strong>
          <p style={{ margin: '8px 0 0' }}>
            O documento descreve como a fábrica está configurada — sem recurso,
            não há configuração para descrever.
          </p>
        </div>
      ) : (
        <Exportar linhas={linhas} modelo={modelo} ano={ano} origem={origem}
                  anos={lista} cargas={listaCargas} faixas={faixas}
                  cargaCorrente={corrente?.id ?? null} />
      )}
    </>
  );
}
