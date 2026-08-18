import Link from 'next/link';
import {
  anosComMix, atributos, cargaCorrente, combinacoesPorMes, ctsCadastro,
  mixAjustes, taxasDoMix, todasAsRegras,
} from '../../../lib/demanda';
import { camposUsados } from '../../../lib/regras';
import AvisoBanco from '../aviso-banco';
import AjusteMix from './ajuste';

export const dynamic = 'force-dynamic';

// =============================================================================
// AJUSTE DE MIX DA CAPACIDADE
//
// O mix de um CT — quanto do tempo dele pertence a cada rótulo do DE/PARA — é
// calculado da carga de demanda, mês a mês. Esta tela é a camada manual por
// cima: onde existir mix cadastrado, ele ganha do calculado, e importar uma
// base nova nunca mexe nele.
//
// Ano e atributo vivem na URL porque trocá-los troca o que o servidor busca; o
// resto (filtros, o CT aberto) é estado da tela.
// =============================================================================

export default async function Page({ searchParams }) {
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

  const semBase = (
    <div className="painel">
      <p className="vazio">
        O mix se ajusta sobre o que a base diz — sem carga de demanda no ar e
        sem regra de DE/PARA, não há rótulo para repartir.
        {' '}<Link href="/cadastros/demanda">Importar uma carga</Link> e{' '}
        <Link href="/cadastros/de-para">criar as regras</Link> vêm antes.
      </p>
    </div>
  );

  if (!corrente || !attrs.length) {
    return (
      <>
        <div className="topo"><h1 className="titulo">Ajuste de mix</h1></div>
        {semBase}
      </>
    );
  }

  const atributo = attrs.some((a) => a.codigo === searchParams?.atributo)
    ? searchParams.atributo : attrs[0].codigo;

  const [combinacoes, cadastro, anosAjustados] = await Promise.all([
    combinacoesPorMes(corrente.id, camposUsados(regras)),
    ctsCadastro(),
    anosComMix(),
  ]);

  // Os anos vêm da demanda E dos ajustes já feitos: um ajuste de ano que saiu
  // da base continua acessível — sumir com ele esconderia cadastro vivo.
  const anos = [...new Set([
    ...combinacoes.map((c) => Number(String(c.mes).slice(0, 4))),
    ...anosAjustados,
  ])].sort();
  const ano = anos.includes(Number(searchParams?.ano))
    ? Number(searchParams.ano) : anos[0];

  const [ajustes, taxas] = await Promise.all([
    mixAjustes(atributo, ano), taxasDoMix(atributo),
  ]);

  return (
    <>
      <div className="topo">
        <h1 className="titulo">
          Ajuste de mix
          <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>
            {' '}· {corrente.cenario}
          </span>
        </h1>
      </div>

      <AjusteMix ano={ano} anos={anos} atributo={atributo} atributos={attrs}
                 regras={regras} combinacoes={combinacoes} cadastro={cadastro}
                 ajustes={ajustes} taxas={taxas} />
    </>
  );
}
