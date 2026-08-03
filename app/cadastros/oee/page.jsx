import { Suspense } from 'react';
import { areas } from '../../../lib/db';
import { recursos } from '../../../lib/cadastro';
import { faixasOee, origensDoAno } from '../../../lib/oee';
import { ORIGENS, rotuloOrigem } from '../../../lib/origens';
import { inicioDoMes } from '../../../lib/faixas';
import { rotuloArea } from '../../../lib/dias';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import EditorOee from './editor';

export const dynamic = 'force-dynamic';

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
  const anoAtual = new Date().getFullYear();
  const ano = Number(searchParams?.ano ?? anoAtual);
  const origem = ORIGENS.includes(searchParams?.origem) ? searchParams.origem : 'META';
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
          <h1 className="titulo">OEE</h1>
          <Suspense><Seletor campos={campos} /></Suspense>
        </div>
        <div className="aviso"><strong>Nenhum recurso nesta área.</strong></div>
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
      opcoes: [anoAtual - 1, anoAtual, anoAtual + 1].map((a) => ({
        valor: String(a), rotulo: String(a),
      })),
    },
  );

  return (
    <>
      <div className="topo">
        <h1 className="titulo">OEE</h1>
        <Suspense><Seletor campos={campos} /></Suspense>
      </div>

      <div className="painel">
        <h2>{recurso.nome} · OEE {rotuloOrigem(origem)} · {ano}</h2>

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
    </>
  );
}
