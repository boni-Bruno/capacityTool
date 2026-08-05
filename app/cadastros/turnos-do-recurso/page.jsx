import { Suspense } from 'react';
import { areas } from '../../../lib/db';
import {
  recursos, matrizTurnosDoAno, calendariosDoRecurso, turnosSobrepostos,
} from '../../../lib/cadastro';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import Matriz from './matriz';
import Calendario from './calendario';
import { rotuloArea, DIAS, MESES } from '../../../lib/dias';

export const dynamic = 'force-dynamic';

// A lista de recursos vem ordenada por nome. O seletor de código precisa dela
// ordenada por código, senão procurar um patrimônio vira uma varredura.
const porCodigo = (lista) =>
  [...lista].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR'));

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
      opcoes: listaAreas.map((a) => ({ valor: String(a.id), rotulo: rotuloArea(a) })),
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

  const [celulas, regimes, sobrepostos] = await Promise.all([
    matrizTurnosDoAno(recurso.id, ano),
    calendariosDoRecurso(recurso.id),
    turnosSobrepostos(recurso.id, ano, recurso.tipo_recurso),
  ]);

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
    // Código primeiro: é a identidade da máquina na controladoria, e o nome
    // vem em seguida para confirmar que é ela mesma. Os dois seletores fazem a
    // mesma escolha — a lista do código sai ordenada por código.
    {
      nome: 'codigo', param: 'recurso', rotulo: 'Código', tipo: 'select',
      valor: String(recurso.id),
      opcoes: porCodigo(listaRecursos).map((r) => ({
        valor: String(r.id), rotulo: r.codigo,
      })),
    },
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
          {recurso.codigo}
          <span className="muted" style={{ marginLeft: 8, fontWeight: 400 }}>
            {recurso.nome}
          </span>
          <span className="selo padrao" style={{ marginLeft: 8 }}>
            {recurso.tipo_recurso.toLowerCase()}
          </span>
        </h2>
        <Calendario key={recurso.id} recursoId={recurso.id} opcoes={regimes} />
      </div>

      <div className="painel">
        <h2>Turnos em {ano}</h2>

        {/* A key força o React a remontar a matriz ao trocar de recurso ou de
            ano. Sem ela o componente é reaproveitado na mesma posição da
            árvore e o useState(inicial) mantém os checkboxes do recurso
            anterior — a tela mostrava a configuração da máquina errada e ainda
            oferecia Salvar, o que gravaria a config de um recurso no outro. */}
        <Matriz
          key={`${recurso.id}:${ano}`}
          recursoId={recurso.id}
          ano={ano}
          turnos={turnos}
          inicial={inicial}
          parciais={parciais}
        />

        {sobrepostos.length > 0 && (
          <div className="aviso" style={{ marginTop: 14 }}>
            <strong>
              Turnos sobrepostos: em {sobrepostos.length} combinação(ões) de mês
              e dia da semana, os turnos marcados somam mais de 24 h.
            </strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {sobrepostos.slice(0, 8).map((x) => (
                <li key={`${x.mes}:${x.dia_semana}`}>
                  {MESES[Number(x.mes)]} · {DIAS[Number(x.dia_semana)]} —{' '}
                  <strong>{Number(x.minutos).toLocaleString('pt-BR')} min</strong>
                  {' '}de 1.440 possíveis
                </li>
              ))}
              {sobrepostos.length > 8 && <li>… e mais {sobrepostos.length - 8}.</li>}
            </ul>
            <p style={{ margin: '8px 0 0' }}>
              O motor soma turno a turno, então a planejada vai passar da
              instalada e o "% do teto" vai estourar 100%. Costuma ser um turno
              de 24 h marcado junto com os turnos que ele já cobre — desmarque
              os que sobram.
            </p>
          </div>
        )}

        <p className="rodape">
          Marcar o turno aqui é necessário, mas não basta. Para o recurso
          produzir num dia, dois portões precisam estar abertos:{' '}
          <strong>o turno tem horário naquele dia da semana</strong> (na tela de
          Turnos — sem horário, o dia nem gera linha) e{' '}
          <strong>o regime acima trabalha naquele dia</strong> (sem isso, a
          linha sai com planejada zero). Descendo até o dia no painel dá para
          ver qual dos dois fechou.
        </p>
      </div>
    </>
  );
}
