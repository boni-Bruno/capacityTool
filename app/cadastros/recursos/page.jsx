import { Suspense } from 'react';
import { areas } from '../../../lib/db';
import {
  recursos, turnosDoRecurso, gradeAnualTurnos, vigenciasDoRecurso,
} from '../../../lib/cadastro';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import EditorTurnos from './editor';
import Grade from './grade';
import Vigencias from './vigencias';

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

  // O recurso escolhido pode não pertencer à área selecionada — acontece ao
  // trocar de área com um recurso já na URL. Cai no primeiro da lista.
  const pedido = Number(searchParams?.recurso);
  const recurso = listaRecursos.find((r) => r.id === pedido) ?? listaRecursos[0];

  const [lista, grade, faixas] = await Promise.all([
    turnosDoRecurso(recurso.id, data),
    gradeAnualTurnos(recurso.id, ano),
    vigenciasDoRecurso(recurso.id),
  ]);

  campos.push(
    {
      nome: 'recurso', rotulo: 'Recurso', tipo: 'select', valor: String(recurso.id),
      opcoes: listaRecursos.map((r) => ({ valor: String(r.id), rotulo: r.nome })),
    },
    {
      nome: 'ano', rotulo: 'Ano da grade', tipo: 'select', valor: String(ano),
      opcoes: [anoAtual - 1, anoAtual, anoAtual + 1].map((a) => ({
        valor: String(a), rotulo: String(a),
      })),
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
        <Grade linhas={grade} ano={ano} />
        <p className="rodape">
          Ligar o turno aqui é necessário, mas não basta: o motor também exige
          que o calendário do recurso tenha esse turno naquele dia da semana
          (<code>calendario_regra</code>). Sem isso a linha sai com planejada
          zero. Regra de calendário ainda não tem tela — hoje é no banco.
        </p>
      </div>

      <div className="painel">
        <h2>Ligar e desligar · o que vale em {data}</h2>
        <EditorTurnos recursoId={recurso.id} turnos={lista} data={data} />
      </div>

      <div className="painel">
        <h2>Histórico de vigências</h2>
        <Vigencias linhas={faixas} />
      </div>
    </>
  );
}
