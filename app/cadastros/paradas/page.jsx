import { Suspense } from 'react';
import { areas, anosComRodada } from '../../../lib/db';
import { anoEscolhido, anosParaEscolha } from '../../../lib/anos';
import { recursos, tiposParada, paradas, turnos } from '../../../lib/cadastro';
import { rotuloArea } from '../../../lib/dias';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import EditorParadas from './editor';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  let listaAreas;
  try {
    listaAreas = await areas();
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  if (!listaAreas.length) {
    return <div className="aviso"><strong>Nenhuma área cadastrada.</strong></div>;
  }

  const areaId = Number(searchParams?.area ?? listaAreas[0].id);
  // Mesma lista do painel: ano com rodada não some quando o tempo passa.
  const anos = anosParaEscolha(await anosComRodada());
  const ano = anoEscolhido(searchParams?.ano, anos);

  const [listaRecursos, tipos, listaTurnos, lista] = await Promise.all([
    recursos(areaId),
    tiposParada(),
    turnos(),
    paradas(areaId, ano),
  ]);

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Paradas planejadas</h1>
        <Suspense>
          <Seletor
            campos={[
              {
                nome: 'area', rotulo: 'Área', tipo: 'select', valor: String(areaId),
                opcoes: listaAreas.map((a) => ({ valor: String(a.id), rotulo: rotuloArea(a) })),
              },
              {
                nome: 'ano', rotulo: 'Ano', tipo: 'select', valor: String(ano),
                opcoes: anos.map((a) => ({ valor: String(a), rotulo: String(a) })),
              },
            ]}
          />
        </Suspense>
      </div>

      {/* key: o formulário guarda recurso_id. Trocar de área sem limpar
          deixaria selecionado um recurso que não é mais da área mostrada. */}
      <EditorParadas
        key={`${areaId}:${ano}`}
        recursos={listaRecursos}
        tipos={tipos}
        turnos={listaTurnos}
        paradas={lista}
      />
    </>
  );
}
