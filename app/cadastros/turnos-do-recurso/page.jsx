import { Fragment, Suspense } from 'react';
import { areas, anosComRodada } from '../../../lib/db';
import { anoEscolhido, anosParaEscolha } from '../../../lib/anos';
import {
  recursos, matrizTurnosDoAno, calendariosDoRecurso, turnosSobrepostos,
  turnosOferecidos,
} from '../../../lib/cadastro';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import Matriz from './matriz';
import Calendario from './calendario';
import Ciente from '../ciente';
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
  const todosRecursos = await recursos(areaId);

  // CC, CT e Patrimônio estreitam a lista antes de escolher a máquina — quem
  // trabalha com a controladoria procura por eles, não pelo apelido. Cada um
  // valida contra o que sobrou dos anteriores: um CT que não existe no CC
  // escolhido é ignorado em vez de filtrar a tela para o vazio.
  const distintos = (lista, campo) =>
    [...new Set(lista.map((r) => r[campo]).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

  const ccs = distintos(todosRecursos, 'cc');
  const cc = ccs.includes(searchParams?.cc) ? searchParams.cc : null;
  const aposCc = cc ? todosRecursos.filter((r) => r.cc === cc) : todosRecursos;

  const cts = distintos(aposCc, 'ct');
  const ct = cts.includes(searchParams?.ct) ? searchParams.ct : null;
  const aposCt = ct ? aposCc.filter((r) => r.ct === ct) : aposCc;

  const pats = distintos(aposCt, 'patrimonio');
  const pat = pats.includes(searchParams?.pat) ? searchParams.pat : null;
  const listaRecursos = pat
    ? aposCt.filter((r) => r.patrimonio === pat) : aposCt;

  const opcaoTodos = (rotulo) => ({ valor: '', rotulo });
  // O "todos" do recurso vale como VALOR, e não como ausência: sem recurso na
  // URL a tela cai no primeiro da lista, que é o comportamento de sempre e o
  // contrário do que "todos" quer dizer.
  const opcaoLote = { valor: 'todos', rotulo: 'todos os filtrados' };
  const campos = [
    {
      nome: 'area', rotulo: 'Área', tipo: 'select', valor: String(areaId),
      opcoes: listaAreas.map((a) => ({ valor: String(a.id), rotulo: rotuloArea(a) })),
    },
    {
      nome: 'cc', rotulo: 'CC', tipo: 'select', valor: cc ?? '',
      opcoes: [opcaoTodos('todos'),
               ...ccs.map((v) => ({ valor: v, rotulo: v }))],
    },
    {
      nome: 'ct', rotulo: 'CT', tipo: 'select', valor: ct ?? '',
      opcoes: [opcaoTodos('todos'),
               ...cts.map((v) => ({ valor: v, rotulo: v }))],
    },
    {
      nome: 'pat', rotulo: 'Patrimônio', tipo: 'select', valor: pat ?? '',
      opcoes: [opcaoTodos('todos'),
               ...pats.map((v) => ({ valor: v, rotulo: v }))],
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

  // "todos" cadastra o mesmo desenho de turnos em toda a lista filtrada — é o
  // caso de montar uma área inteira, em que ir de recurso em recurso garante
  // que um fique de fora sem ninguém notar. A matriz então não é de ninguém:
  // ela é o molde.
  const emLote = searchParams?.recurso === 'todos' && listaRecursos.length > 1;

  // O recurso da URL pode não ser da área selecionada — acontece ao trocar de
  // área com um recurso já escolhido. Cai no primeiro da lista.
  const pedido = Number(searchParams?.recurso);
  const recurso = listaRecursos.find((r) => r.id === pedido) ?? listaRecursos[0];

  // Em lote não se lê a matriz de ninguém: o molde nasce em branco, e o que
  // for marcado passa a valer para todos. Herdar do primeiro da lista faria a
  // tela propor, sem avisar, a configuração de uma máquina para as outras.
  //
  // AS COLUNAS, PORÉM, PRECISAM VIR DE ALGUM LUGAR. Elas saem da matriz do
  // recurso — é a consulta que sabe quais turnos ele tem —, e com a matriz
  // vazia a tela ficava sem coluna nenhuma e dizia "nenhum turno ativo na
  // planta", que é falso e manda procurar o defeito no cadastro de turnos. Em
  // lote as colunas são os turnos ATIVOS, que é a lista certa: o molde precisa
  // oferecer todos os turnos possíveis, e não os que uma máquina já usa.
  const [celulas, regimes, sobrepostos, ativos] = emLote
    ? [[], await calendariosDoRecurso(recurso.id), [],
       await turnosOferecidos(listaRecursos.map((r) => r.id))]
    : [...await Promise.all([
      matrizTurnosDoAno(recurso.id, ano),
      calendariosDoRecurso(recurso.id),
      turnosSobrepostos(recurso.id, ano, recurso.tipo_recurso),
    ]), []];

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
  // As colunas do lote saem da MESMA regra da tela de um recurso só
  // (`turnosOferecidos`), e é por isso que ela existe: quando as duas listas
  // divergiam, a coluna que a pessoa clicava não era a que ela lia. Faltando o
  // "2º Turno" no lote, clicar no segundo campo gravava o 3º.
  const turnos = emLote
    ? ativos.map((t) => ({ turno_id: Number(t.id), codigo: t.codigo, nome: t.nome }))
    : [];
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
      valor: emLote ? 'todos' : String(recurso.id),
      opcoes: [...(listaRecursos.length > 1 ? [opcaoLote] : []),
               ...porCodigo(listaRecursos).map((r) => ({
                 valor: String(r.id), rotulo: r.codigo,
               }))],
    },
    {
      nome: 'recurso', rotulo: 'Recurso', tipo: 'select',
      valor: emLote ? 'todos' : String(recurso.id),
      opcoes: [...(listaRecursos.length > 1 ? [opcaoLote] : []),
               ...listaRecursos.map((r) => ({
                 valor: String(r.id), rotulo: r.nome,
               }))],
    },
    {
      nome: 'ano', rotulo: 'Ano', tipo: 'select', valor: String(ano),
      opcoes: anos.map((a) => ({ valor: String(a), rotulo: String(a) })),
    },
  );

  // A PORTA DO LOTE. Em lote, o formulário só existe depois de a explicação ter
  // sido lida e fechada; fora dele, o `Fragment` não põe nada no caminho.
  //
  // Envolver em vez de duplicar a árvore: dois ramos com a mesma matriz dentro
  // seriam dois lugares para mexer na próxima mudança, e o segundo é o que
  // ninguém lembra de atualizar.
  const Porta = emLote ? Ciente : Fragment;
  const porta = emLote ? {
    titulo: `O que você fizer aqui vale para os ${listaRecursos.length} recursos `
      + `filtrados, e REESCREVE o ano de ${ano} de cada um.`,
    botao: 'OK, ciente — quero cadastrar em lote',
    resumo: `Lote de ${listaRecursos.length} recursos · o ano de ${ano} de cada `
      + 'um é reescrito por inteiro.',
    aviso: (
      <>
        <p style={{ margin: '8px 0 0' }}>
          A matriz começa em branco de propósito: herdar a de um recurso faria a
          tela propor, sem avisar, a configuração de uma máquina para as outras.
          Turno marcado grava <strong>todas as máquinas</strong> do recurso — os
          recursos do lote têm quantidades diferentes, e um número fixo seria
          demais para um e de menos para outro. Para pôr um número, escolha o
          recurso um a um.
        </p>
        <p style={{ margin: '6px 0 0' }}>
          O <strong>regime de dias</strong> também é aplicado em lote, e ali
          basta clicar: não há segunda confirmação.
        </p>
        <p style={{ margin: '6px 0 0' }}>
          Estreite antes por CC, CT ou patrimônio: o alcance é o filtro de cima,
          e ele está listado no fim da página.
        </p>
      </>
    ),
  } : {};

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Turnos do recurso</h1>
        <Suspense><Seletor campos={campos} /></Suspense>
      </div>

      {/* A key reabre a porta quando o alcance muda: passar de 48 recursos
          para 12 é outra decisão, e a ciência do lote anterior não vale para
          ela. */}
      <Porta key={`${emLote ? 'lote' : 'um'}:${listaRecursos.length}:${ano}`}
             {...porta}>

      {/* Fora do lote, o regime é do recurso escolhido. */}
      {!emLote && (
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
      )}

      {/* Em lote o regime vale para todos os filtrados, e clicar já aplica. */}
      {emLote && (
        <div className="painel">
          <h2>Regime de dias · nos {listaRecursos.length} recursos</h2>
          <Calendario
            key={`lote:${listaRecursos.length}`}
            recursoId={null}
            opcoes={regimes}
            alvos={listaRecursos.map((r) => ({ id: r.id, nome: r.nome }))}
          />
        </div>
      )}

      <div className="painel">
        <h2>
          Turnos em {ano}
          {emLote && (
            <span className="muted" style={{ marginLeft: 8, fontWeight: 400 }}>
              · {listaRecursos.length} recursos do filtro
            </span>
          )}
        </h2>

        {!emLote && qtRecurso > 1 && (
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
          key={`${emLote ? 'lote' : recurso.id}:${ano}:${listaRecursos.length}`}
          recursoId={recurso.id}
          ano={ano}
          qtRecurso={qtRecurso}
          turnos={turnos}
          inicial={inicial}
          parciais={parciais}
          alvos={emLote
            ? listaRecursos.map((r) => (
              { id: r.id, codigo: r.codigo, nome: r.nome }))
            : null}
        />

        {!emLote && sobrepostos.length > 0 && (
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

      </Porta>
    </>
  );
}
