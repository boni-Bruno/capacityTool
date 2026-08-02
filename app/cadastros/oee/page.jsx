import { Suspense } from 'react';
import { areas } from '../../../lib/db';
import { recursos } from '../../../lib/cadastro';
import { faixasOee, origensDoAno, ORIGENS } from '../../../lib/oee';
import { inicioDoMes } from '../../../lib/faixas';
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
      opcoes: listaAreas.map((a) => ({ valor: String(a.id), rotulo: a.nome })),
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
      opcoes: ORIGENS.map((o) => ({ valor: o, rotulo: o.toLowerCase() })),
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
        <h2>{recurso.nome} · {origem.toLowerCase()} · {ano}</h2>

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
              Este recurso também tem OEE de origem{' '}
              {conflito.map((o) => o.origem.toLowerCase()).join(' e ')} em {ano}.
            </strong>
            <p style={{ margin: '6px 0 0' }}>
              O motor escolhe o OEE por vigência e turno, sem olhar a origem — com
              mais de uma valendo na mesma data, ele pega uma sem critério e o
              número do cálculo passa a depender de sorte. Deixe só uma origem
              cobrindo o período, ou apague a outra.
            </p>
          </div>
        )}

        <p className="rodape">
          O OEE multiplica a planejada para virar disponível. Setup não entra
          como parada em lugar nenhum porque já está embutido aqui — descontar
          de novo contaria a mesma perda duas vezes.
        </p>
      </div>
    </>
  );
}
