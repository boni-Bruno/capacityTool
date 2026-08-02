import { Suspense } from 'react';
import { areas } from '../../../lib/db';
import { recursos, matrizTurnosDoAno } from '../../../lib/cadastro';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import Matriz from './matriz';

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
  const anoAtual = new Date().getFullYear();
  const ano = Number(searchParams?.ano ?? anoAtual);
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

  // O recurso da URL pode não ser da área selecionada — acontece ao trocar de
  // área com um recurso já escolhido. Cai no primeiro da lista.
  const pedido = Number(searchParams?.recurso);
  const recurso = listaRecursos.find((r) => r.id === pedido) ?? listaRecursos[0];

  const celulas = await matrizTurnosDoAno(recurso.id, ano);

  // A consulta vem esparramada em turno x mês; aqui vira a lista de turnos
  // (colunas) e dois mapas indexados por "turnoId:mes".
  const turnos = [];
  const inicial = {};
  const parciais = {};
  for (const c of celulas) {
    const turnoId = Number(c.turno_id);
    if (!turnos.some((t) => t.turno_id === turnoId)) {
      turnos.push({ turno_id: turnoId, codigo: c.codigo, nome: c.nome });
    }
    const dias = Number(c.dias_cobertos);
    const total = Number(c.dias_mes);
    const k = `${turnoId}:${Number(c.mes)}`;
    inicial[k] = dias > 0;
    parciais[k] = dias > 0 && dias < total;
  }

  campos.push(
    {
      nome: 'recurso', rotulo: 'Recurso', tipo: 'select', valor: String(recurso.id),
      opcoes: listaRecursos.map((r) => ({ valor: String(r.id), rotulo: r.nome })),
    },
    {
      nome: 'ano', rotulo: 'Ano', tipo: 'select', valor: String(ano),
      opcoes: [anoAtual - 1, anoAtual, anoAtual + 1].map((a) => ({
        valor: String(a), rotulo: String(a),
      })),
    },
  );

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Turnos do recurso</h1>
        <Suspense><Seletor campos={campos} /></Suspense>
      </div>

      <div className="painel">
        <h2>
          {recurso.nome} · {ano}
          <span className="selo padrao" style={{ marginLeft: 8 }}>
            {recurso.tipo_recurso.toLowerCase()}
          </span>
        </h2>

        <Matriz
          recursoId={recurso.id}
          ano={ano}
          turnos={turnos}
          inicial={inicial}
          parciais={parciais}
        />

        <p className="rodape">
          Marcar o turno aqui é necessário, mas não basta: o motor também exige
          que o calendário do recurso tenha esse turno naquele dia da semana
          (<code>calendario_regra</code>). Sem isso a linha sai com planejada
          zero. Regra de calendário ainda não tem tela — hoje é no banco.
        </p>
      </div>
    </>
  );
}
