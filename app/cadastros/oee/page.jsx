import { Suspense } from 'react';
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
import LoteOee from './lote';

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

  const pedido = Number(searchParams?.recurso);
  const recurso = listaRecursos.find((r) => r.id === pedido) ?? listaRecursos[0];

  const [faixas, origens] = await Promise.all([
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
      nome: 'origem', rotulo: 'Origem', tipo: 'select', valor: origem,
      opcoes: ORIGENS.map((o) => ({ valor: o, rotulo: rotuloOrigem(o) })),
    },
    {
      nome: 'ano', rotulo: 'Ano', tipo: 'select', valor: String(ano),
      opcoes: anos.map((a) => ({ valor: String(a), rotulo: String(a) })),
    },
  );

  const escopo = ct ? `CT ${cc ? `${cc}-` : ''}${ct}`
    : cc ? `CC ${cc}`
      : (rotuloArea(listaAreas.find((a) => a.id === areaId) ?? {}) ?? 'esta área');

  return (
    <>
      <div className="topo">
        <h1 className="titulo">OEE</h1>
        <Suspense><Seletor campos={campos} /></Suspense>
      </div>

      <div className="painel">
        <h2>
          {recurso.codigo}
          <span className="muted" style={{ fontWeight: 400 }}>
            {' '}{recurso.nome}
          </span>
          {' '}· OEE {rotuloOrigem(origem)} · {ano}
        </h2>

        <EditorOee
          key={`${recurso.id}:${origem}:${ano}`}
          recursoId={recurso.id}
          ano={ano}
          origem={origem}
          inicial={inicial}
        />

        {conflito.length > 0 && (
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
          branco faz o motor usar 100%, e a disponível sai igual à planejada:
          rodar o cálculo de uma origem sem OEE cadastrado dá um número crível
          e falso. Setup não entra como parada em lugar nenhum porque já está
          embutido aqui.
        </p>
      </div>

      {listaRecursos.length > 1 && (
        <LoteOee
          key={`${areaId}:${cc}:${ct}:${origem}:${ano}`}
          recursos={listaRecursos.map((r) => (
            { id: r.id, codigo: r.codigo, nome: r.nome }))}
          ano={ano}
          origem={origem}
          escopo={escopo}
        />
      )}
    </>
  );
}
