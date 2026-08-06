import { Suspense } from 'react';
import { areas, anosComRodada } from '../../../lib/db';
import { anoEscolhido, anosParaEscolha } from '../../../lib/anos';
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
  // Mesma lista do painel: ano com rodada não some quando o tempo passa.
  const anos = anosParaEscolha(await anosComRodada());
  const ano = anoEscolhido(searchParams?.ano, anos);
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

  // Quantas máquinas o recurso tem. É o teto de cada célula da matriz e o
  // valor que "todas" resolve.
  const qtRecurso = Math.max(1, Number(recurso.qt_recursos ?? 1));

  // A consulta vem esparramada em turno x mês; aqui vira a lista de turnos
  // (colunas) e dois mapas indexados por "turnoId:mes".
  //
  // A célula guarda TEXTO, não booleano: '' é não trabalha, e um número é
  // quantas máquinas rodam ali. Vigência com qt_recursos nulo quer dizer
  // "todas", e aparece como o número cheio — a tela mostra quantas rodam, não
  // um conceito.
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
    inicial[k] = dias > 0
      ? String(c.qt_recursos === null ? qtRecurso : Number(c.qt_recursos))
      : '';
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
      opcoes: anos.map((a) => ({ valor: String(a), rotulo: String(a) })),
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

        {qtRecurso > 1 && (
          <div className="aviso" style={{ marginBottom: 14 }}>
            <strong>
              Este recurso tem {qtRecurso} máquinas, então a célula pede um
              número — não uma marca.
            </strong>
            <p style={{ margin: '6px 0 0' }}>
              Digite quantas rodam naquele turno: dá para pôr {qtRecurso} no 1º
              e {qtRecurso - 1} no 2º e no 3º. Campo vazio é não trabalha, e o
              botão <strong>ano todo</strong> preenche os doze meses com{' '}
              {qtRecurso} de uma vez.
              {' '}Quando o número é igual a {qtRecurso}, o cadastro guarda
              &ldquo;todas&rdquo;: se um dia o recurso passar a ter{' '}
              {qtRecurso + 1}, esse turno acompanha sozinho.
            </p>
            <p style={{ margin: '6px 0 0' }}>
              O <strong>teto</strong> continua sendo as {qtRecurso} máquinas 24 h
              por dia — máquina parada no 3º turno continua existindo — então o
              &ldquo;% do teto&rdquo; no painel passa a mostrar a ociosidade que
              você planejou.
            </p>
          </div>
        )}

        {/* A key força o React a remontar a matriz ao trocar de recurso ou de
            ano. Sem ela o componente é reaproveitado na mesma posição da
            árvore e o useState(inicial) mantém os checkboxes do recurso
            anterior — a tela mostrava a configuração da máquina errada e ainda
            oferecia Salvar, o que gravaria a config de um recurso no outro. */}
        <Matriz
          key={`${recurso.id}:${ano}`}
          recursoId={recurso.id}
          ano={ano}
          qtRecurso={qtRecurso}
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
