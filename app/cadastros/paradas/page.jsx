import { Suspense } from 'react';
import { areas, anosComRodada } from '../../../lib/db';
import { anoEscolhido, anosParaEscolha } from '../../../lib/anos';
import { recursos, tiposParada, paradas, turnos } from '../../../lib/cadastro';
import { rotuloArea } from '../../../lib/dias';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import EditorParadas from './editor';

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
  // Mesma lista do painel: ano com rodada não some quando o tempo passa.
  const anos = anosParaEscolha(await anosComRodada());
  const ano = anoEscolhido(searchParams?.ano, anos);

  const [todosRecursos, tipos, listaTurnos, lista] = await Promise.all([
    recursos(areaId),
    tiposParada(),
    turnos(),
    paradas(areaId, ano),
  ]);

  // CC, CT e recurso estreitam a lista antes de escolher a máquina — quem
  // trabalha com a controladoria procura por eles, não pelo apelido. É a mesma
  // cascata de Turnos do recurso, e de propósito: são a mesma pergunta em duas
  // telas, e responder de jeitos diferentes obrigaria a aprender as duas.
  //
  // Cada nível valida contra o que sobrou dos anteriores: um CT que não existe
  // no CC escolhido é ignorado em vez de filtrar a tela para o vazio.
  const distintos = (l, campo) =>
    [...new Set(l.map((r) => r[campo]).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

  const ccs = distintos(todosRecursos, 'cc');
  const cc = ccs.includes(searchParams?.cc) ? searchParams.cc : null;
  const aposCc = cc ? todosRecursos.filter((r) => r.cc === cc) : todosRecursos;

  const cts = distintos(aposCc, 'ct');
  const ct = cts.includes(searchParams?.ct) ? searchParams.ct : null;
  const aposCt = ct ? aposCc.filter((r) => r.ct === ct) : aposCc;

  // O recurso é escolhido por id, e não por nome: dois recursos podem se chamar
  // igual, e aí o filtro pegaria os dois sem ninguém entender por quê.
  const pedido = Number(searchParams?.recurso);
  const recurso = aposCt.find((r) => r.id === pedido) ?? null;
  const listaRecursos = recurso ? [recurso] : aposCt;

  // A tabela de baixo obedece ao mesmo filtro do formulário. Mostrar o cadastro
  // estreitado e a lista inteira faria a tela dizer duas coisas ao mesmo tempo
  // — e a segunda é a que ninguém repara que não é a pedida.
  const ids = new Set(listaRecursos.map((r) => r.id));
  const listaFiltrada = lista.filter((p) => ids.has(Number(p.recurso_id)));
  const filtrado = Boolean(cc || ct || recurso);

  const opcaoTodos = (rotulo) => ({ valor: '', rotulo });
  const campos = [
    {
      nome: 'area', rotulo: 'Área', tipo: 'select', valor: String(areaId),
      opcoes: listaAreas.map((a) => ({ valor: String(a.id), rotulo: rotuloArea(a) })),
    },
    {
      nome: 'ano', rotulo: 'Ano', tipo: 'select', valor: String(ano),
      opcoes: anos.map((a) => ({ valor: String(a), rotulo: String(a) })),
    },
    {
      nome: 'cc', rotulo: 'CC', tipo: 'select', valor: cc ?? '',
      opcoes: [opcaoTodos('todos'), ...ccs.map((v) => ({ valor: v, rotulo: v }))],
    },
    {
      nome: 'ct', rotulo: 'CT', tipo: 'select', valor: ct ?? '',
      opcoes: [opcaoTodos('todos'), ...cts.map((v) => ({ valor: v, rotulo: v }))],
    },
    {
      nome: 'recurso', rotulo: 'Recurso', tipo: 'select',
      valor: recurso ? String(recurso.id) : '',
      opcoes: [opcaoTodos('todos'),
               ...aposCt.map((r) => ({ valor: String(r.id), rotulo: r.nome }))],
    },
  ];

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Paradas planejadas</h1>
        <Suspense>
          <Seletor campos={campos} />
        </Suspense>
      </div>

      {!todosRecursos.length && (
        // Dizer QUAL área está vazia, e não só "não tem recurso": a tela abre na
        // primeira da lista, que pode não ser a que a pessoa queria — e sem o
        // nome ela procura o defeito no lugar errado.
        <div className="aviso">
          <strong>
            Nenhum recurso na área{' '}
            {listaAreas.find((a) => a.id === areaId)?.nome ?? 'selecionada'}.
          </strong>
          <p style={{ margin: '8px 0 0' }}>
            Troque a área no seletor acima. Parada é sempre de um recurso, então
            sem recurso não há o que cadastrar aqui.
          </p>
        </div>
      )}

      {/* Formulário morto embaixo de um aviso que diz "não há nada aqui" é
          ruído: sem recurso na área, não existe parada para cadastrar nem para
          listar.

          key: o formulário guarda recurso_id. Trocar de área ou de filtro sem
          limpar deixaria selecionado um recurso que não está mais na lista. */}
      {todosRecursos.length > 0 && (
        <EditorParadas
          key={`${areaId}:${ano}:${cc ?? ''}:${ct ?? ''}:${recurso?.id ?? ''}`}
          recursos={listaRecursos}
          tipos={tipos}
          turnos={listaTurnos}
          paradas={listaFiltrada}
          filtrado={filtrado}
        />
      )}
    </>
  );
}
