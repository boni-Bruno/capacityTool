import { Suspense } from 'react';
import { areas } from '../../../lib/db';
import { recursos, turnosDoRecurso } from '../../../lib/cadastro';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import EditorTurnos from './editor';

export const dynamic = 'force-dynamic';

const hoje = () => new Date().toISOString().slice(0, 10);

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
  const data = searchParams?.data ?? hoje();
  const listaRecursos = await recursos(areaId);

  const campos = [
    {
      nome: 'area', rotulo: 'Área', tipo: 'select', valor: String(areaId),
      opcoes: listaAreas.map((a) => ({ valor: String(a.id), rotulo: a.nome })),
    },
  ];

  if (!listaRecursos.length) {
    return (
      <>
        <div className="topo">
          <h1 className="titulo">Turnos do recurso</h1>
          <Suspense><Seletor campos={campos} /></Suspense>
        </div>
        <div className="aviso"><strong>Nenhum recurso nesta área.</strong></div>
      </>
    );
  }

  // O recurso escolhido pode não pertencer à área selecionada — acontece ao
  // trocar de área com um recurso já na URL. Cai no primeiro da lista.
  const pedido = Number(searchParams?.recurso);
  const recurso = listaRecursos.find((r) => r.id === pedido) ?? listaRecursos[0];

  const lista = await turnosDoRecurso(recurso.id, data);

  campos.push(
    {
      nome: 'recurso', rotulo: 'Recurso', tipo: 'select', valor: String(recurso.id),
      opcoes: listaRecursos.map((r) => ({ valor: String(r.id), rotulo: r.nome })),
    },
    { nome: 'data', rotulo: 'Vigente em', tipo: 'data', valor: data },
  );

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Turnos do recurso</h1>
        <Suspense><Seletor campos={campos} /></Suspense>
      </div>

      <div className="painel">
        <h2>
          {recurso.nome}
          <span className="selo padrao" style={{ marginLeft: 8 }}>
            {recurso.tipo_recurso.toLowerCase()}
          </span>
        </h2>
        <EditorTurnos recursoId={recurso.id} turnos={lista} data={data} />
        <p className="rodape">
          Recurso do tipo <strong>máquina</strong> não desconta intervalo de
          refeição; <strong>pessoa</strong> desconta. Isso muda os minutos de
          todos os turnos deste recurso.
        </p>
      </div>
    </>
  );
}
