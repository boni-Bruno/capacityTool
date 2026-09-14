import { anosComRodada, arvoreDeConfiguracao } from '../../../lib/db';
import { cargaCorrente, cargas } from '../../../lib/demanda';
import { anoEscolhido, anosParaEscolha } from '../../../lib/anos';
import { ORIGENS } from '../../../lib/origens';
import AvisoBanco from '../aviso-banco';
import Simulador from './simulador';

export const metadata = { title: 'Simulador de recursos' };
export const dynamic = 'force-dynamic';

// =============================================================================
// SIMULADOR DE QUANTIDADE DE RECURSOS
//
// "Quantas máquinas (ou pessoas) este CT precisaria para atender a demanda do
// cenário?" A resposta sai num .xlsx COM FÓRMULAS: o Bruno simula no Excel —
// muda o fator de OEE, testa um turno a mais — e cadastra o que decidir na
// aplicação pelo caminho de sempre. A ferramenta não simula na tela de
// propósito: capacidade se decide num lugar só, e o lugar é o cadastro.
//
// Mora no grupo Extração porque é isso que ela é: um recorte da rodada e da
// demanda indo para fora, no formato de quem vai mexer nele.
//
// AS ESCOLHAS NÃO VÃO PARA A URL, como na extração das configurações: a árvore
// de marcações é estado do React, e cada troca de searchParams a remontaria.
// Ano e origem ainda são LIDOS da URL para um link antigo continuar valendo.
// =============================================================================

export default async function Page({ searchParams }) {
  let linhas;
  let anos;
  let listaCargas;
  let corrente;
  try {
    [linhas, anos, listaCargas, corrente] = await Promise.all([
      arvoreDeConfiguracao(), anosComRodada(), cargas(), cargaCorrente(),
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
        <h1 className="titulo">Simulador de recursos</h1>
      </div>

      {!linhas.length ? (
        <div className="aviso">
          <strong>Nenhum recurso cadastrado.</strong>
          <p style={{ margin: '8px 0 0' }}>
            O simulador parte da capacidade calculada — sem recurso, não há
            capacidade para dimensionar.
          </p>
        </div>
      ) : (
        <Simulador linhas={linhas} ano={ano} origem={origem} anos={lista}
                   cargas={listaCargas} cargaCorrente={corrente?.id ?? null} />
      )}
    </>
  );
}
