import { Fragment, Suspense } from 'react';
import { areas, anosComRodada } from '../../../lib/db';
import { anoEscolhido, anosParaEscolha } from '../../../lib/anos';
import { recursos } from '../../../lib/cadastro';
import { faixasOee, origensDoAno } from '../../../lib/oee';
import { ORIGENS, rotuloOrigem } from '../../../lib/origens';
import { inicioDoMes } from '../../../lib/faixas';
import { rotuloArea } from '../../../lib/dias';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import EditorOee from './editor';
import Ciente from '../ciente';

export const dynamic = 'force-dynamic';

// A lista de recursos vem ordenada por nome. O seletor de código precisa dela
// ordenada por código, senão procurar um patrimônio vira uma varredura.
const porCodigo = (lista) =>
  [...lista].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR'));

// 0.85500 guardado no banco vira "85,5" na tela.
const paraTela = (v) =>
  String(Number((Number(v) * 100).toFixed(3))).replace('.', ',');

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
  const origem = ORIGENS.includes(searchParams?.origem) ? searchParams.origem : 'META';
  const todosRecursos = await recursos(areaId);

  // CC e CT estreitam a lista antes de escolher a máquina — e o recorte é
  // também o alcance do lote: filtrar o CC 278 já é dizer "os nove CTs dele".
  // Uma segunda lista de recursos para o lote seria uma lista a manter em dia
  // com esta.
  const distintos = (lista, campo) =>
    [...new Set(lista.map((r) => r[campo]).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

  const ccs = distintos(todosRecursos, 'cc');
  const cc = ccs.includes(searchParams?.cc) ? searchParams.cc : null;
  const aposCc = cc ? todosRecursos.filter((r) => r.cc === cc) : todosRecursos;

  const cts = distintos(aposCc, 'ct');
  const ct = cts.includes(searchParams?.ct) ? searchParams.ct : null;
  const listaRecursos = ct ? aposCc.filter((r) => r.ct === ct) : aposCc;

  const todos = (rotulo) => ({ valor: '', rotulo });
  const campos = [
    {
      nome: 'area', rotulo: 'Área', tipo: 'select', valor: String(areaId),
      opcoes: listaAreas.map((a) => ({ valor: String(a.id), rotulo: rotuloArea(a) })),
    },
    {
      nome: 'cc', rotulo: 'CC', tipo: 'select', valor: cc ?? '',
      opcoes: [todos('todos'), ...ccs.map((v) => ({ valor: v, rotulo: v }))],
    },
    {
      nome: 'ct', rotulo: 'CT', tipo: 'select', valor: ct ?? '',
      opcoes: [todos('todos'), ...cts.map((v) => ({ valor: v, rotulo: v }))],
    },
  ];

  if (!listaRecursos.length) {
    return (
      <>
        <div className="topo">
          <h1 className="titulo">OEE</h1>
          <Suspense><Seletor campos={campos} /></Suspense>
        </div>
        <div className="aviso">
          <strong>
            {cc || ct
              ? 'Nenhum recurso com este CC e CT.'
              : 'Nenhum recurso nesta área.'}
          </strong>
        </div>
      </>
    );
  }

  // "todos" cadastra o mesmo OEE em toda a lista filtrada — o caso é "78% em
  // janeiro para os nove CTs do 278". A tabela então não é de ninguém: é o
  // molde, e nasce em branco.
  const emLote = searchParams?.recurso === 'todos' && listaRecursos.length > 1;

  const pedido = Number(searchParams?.recurso);
  const recurso = listaRecursos.find((r) => r.id === pedido) ?? listaRecursos[0];

  const [faixas, origens] = emLote
    ? [[], []]
    : await Promise.all([
      faixasOee(recurso.id, origem),
      origensDoAno(recurso.id, ano),
    ]);

  // Faixa -> mês. A tela grava mês inteiro, então basta ver quem cobre o
  // primeiro dia de cada um.
  const inicial = {};
  for (let mes = 1; mes <= 12; mes++) {
    const dia = inicioDoMes(ano, mes);
    const f = faixas.find((x) => x.inicio <= dia && (x.fim === null || x.fim > dia));
    inicial[mes] = f ? paraTela(f.valor) : '';
  }

  const conflito = origens.filter((o) => o.origem !== origem);

  // O "todos" vale como VALOR, e não como ausência: sem recurso na URL a tela
  // cai no primeiro da lista, que é o contrário do que "todos" quer dizer.
  const opcaoLote = { valor: 'todos', rotulo: 'todos os filtrados' };

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
      nome: 'origem', rotulo: 'Origem', tipo: 'select', valor: origem,
      opcoes: ORIGENS.map((o) => ({ valor: o, rotulo: rotuloOrigem(o) })),
    },
    {
      nome: 'ano', rotulo: 'Ano', tipo: 'select', valor: String(ano),
      opcoes: anos.map((a) => ({ valor: String(a), rotulo: String(a) })),
    },
  );

  // O CT já vem no formato CC-CT: repetir o CC aqui daria "CT 278-278-001".
  const escopo = ct ? `CT ${ct}`
    : cc ? `CC ${cc}`
      : (rotuloArea(listaAreas.find((a) => a.id === areaId) ?? {}) ?? 'esta área');

  // A PORTA DO LOTE, a mesma de Turnos do recurso. Aqui ela é ainda mais
  // necessária: o lote passou a REESCREVER o ano, e mês em branco deixou de ser
  // silêncio. Quem aprendeu a tela antiga precisa ser avisado da troca.
  const Porta = emLote ? Ciente : Fragment;
  const porta = emLote ? {
    titulo: `O que você preencher aqui vale para os ${listaRecursos.length} `
      + `recursos filtrados, e REESCREVE o ano de ${ano} de cada um.`,
    botao: 'OK, ciente — quero aplicar em lote',
    resumo: `Lote de ${listaRecursos.length} recursos · ${escopo} · o ano de `
      + `${ano} de cada um é reescrito por inteiro.`,
    aviso: (
      <>
        <p style={{ margin: '8px 0 0' }}>
          <strong>Mês em branco apaga</strong> o OEE daquele mês nos recursos do
          lote, e sem OEE cadastrado o motor usa 0% ali — a disponível daquele
          mês zera. Se você quer mexer só
          em janeiro, preencha janeiro <em>e</em> os outros onze com o que eles
          devem ter — ou aplique recurso a recurso.
        </p>
        <p style={{ margin: '6px 0 0' }}>
          A tabela começa em branco de propósito: herdar a de um recurso faria a
          tela propor, sem avisar, o OEE de uma máquina para as outras.
        </p>
        <p style={{ margin: '6px 0 0' }}>
          O alcance é o filtro de cima — estreite por CC ou CT antes. Quem entra
          fica listado abaixo da tabela, e dá para tirar um clicando nele.
        </p>
      </>
    ),
  } : {};

  return (
    <>
      <div className="topo">
        <h1 className="titulo">OEE</h1>
        <Suspense><Seletor campos={campos} /></Suspense>
      </div>

      <Porta key={`${emLote ? 'lote' : recurso.id}:${listaRecursos.length}:${ano}`}
             {...porta}>

      <div className="painel">
        <h2>
          {emLote ? (
            <>
              {listaRecursos.length} recursos
              <span className="muted" style={{ fontWeight: 400 }}>
                {' '}· {escopo}
              </span>
            </>
          ) : (
            <>
              {recurso.codigo}
              <span className="muted" style={{ fontWeight: 400 }}>
                {' '}{recurso.nome}
              </span>
            </>
          )}
          {' '}· OEE {rotuloOrigem(origem)} · {ano}
        </h2>

        <EditorOee
          key={`${emLote ? 'lote' : recurso.id}:${origem}:${ano}:${listaRecursos.length}`}
          recursoId={recurso.id}
          ano={ano}
          origem={origem}
          inicial={emLote ? {} : inicial}
          alvos={emLote
            ? listaRecursos.map((r) => (
              { id: r.id, codigo: r.codigo, nome: r.nome }))
            : null}
        />

        {!emLote && conflito.length > 0 && (
          <div className="aviso" style={{ marginTop: 14 }}>
            <strong>
              Este recurso também tem OEE {conflito.map((o) => rotuloOrigem(o.origem)).join(' e ')}
              {' '}em {ano}.
            </strong>
            <p style={{ margin: '6px 0 0' }}>
              Isso é normal e é o ponto: cada origem gera a sua rodada de
              cálculo, e no painel você troca entre elas para comparar. Uma não
              interfere na outra.
            </p>
          </div>
        )}

        <p className="rodape">
          O OEE multiplica a planejada para virar disponível — instalada e
          planejada são iguais nas duas origens, só a disponível muda. Mês em
          branco faz o motor usar <strong>0%</strong>, e a disponível daquele
          mês zera: o buraco aparece na tela em vez de virar um número crível e
          falso — recurso novo já nasce com 100% cadastrado justamente para que
          zero signifique sempre a mesma coisa. Setup não entra como parada em
          lugar nenhum porque já está embutido aqui.
        </p>
      </div>

      </Porta>
    </>
  );
}
