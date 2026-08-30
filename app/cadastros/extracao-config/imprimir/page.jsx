import { capacidadeDoRecorte, configuracaoDoRecorte, areas } from '../../../../lib/db';
import { rotuloOrigem, ORIGENS } from '../../../../lib/origens';
import { rotuloArea } from '../../../../lib/dias';
import Imprime from './imprime';

export const dynamic = 'force-dynamic';

// A VERSÃO PARA PAPEL, que é como o PDF sai.
//
// Escrever PDF à mão daria fonte básica, acentuação limitada e nenhuma quebra
// de página — pior que o que o navegador entrega de graça, com o diálogo de
// salvar que a pessoa já conhece. Aqui a página é montada em HTML com regras de
// `@media print`, e o "Salvar como PDF" faz o resto.
//
// Fora do Shell de propósito: menu lateral não vai para o papel.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');

const lista = (t) => String(t ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export default async function Page({ searchParams }) {
  const areaIds = lista(searchParams?.areas).map(Number).filter(Number.isInteger);
  const ccs = lista(searchParams?.ccs);
  const ano = Number(searchParams?.ano) || new Date().getFullYear();
  const origem = ORIGENS.includes(searchParams?.origem)
    ? searchParams.origem : 'META';

  if (!areaIds.length) {
    return <p style={{ padding: '2rem' }}>Nenhuma área no recorte.</p>;
  }

  const [todasAreas, cadastro, capacidade] = await Promise.all([
    areas(),
    configuracaoDoRecorte(areaIds, ccs),
    capacidadeDoRecorte(areaIds, ccs, ano, origem),
  ]);

  const c = cadastro[0] ?? {};
  const k = capacidade[0] ?? {};
  const escolhidas = todasAreas.filter((a) => areaIds.includes(a.id));

  const secoes = [
    {
      titulo: 'Configuração',
      itens: [
        ['Recursos', fmt(c.recursos)],
        ['Postos (soma das quantidades)', fmt(c.postos)],
        ['Máquinas', fmt(c.maquinas)],
        ['Postos de pessoa', fmt(c.pessoas)],
        ['Centros de custo', fmt(c.ccs)],
        ['Centros de trabalho', fmt(c.cts)],
        ['Turnos em uso', fmt(c.turnos)],
        ['Calendários em uso', fmt(c.calendarios)],
        ['Faixas de OEE cadastradas', fmt(c.faixas_oee)],
        ['Paradas cadastradas', fmt(c.paradas)],
      ],
    },
    {
      titulo: `Capacidade de ${ano}`,
      itens: k.rodadas
        ? [
          ['Instalada', `${fmt(Math.round(k.instalada))} min`],
          ['Planejada', `${fmt(Math.round(k.planejada))} min`],
          ['Disponível', `${fmt(Math.round(k.disponivel))} min`],
          ['Disponível em horas', `${fmt(Math.round(k.disponivel / 60))} h`],
        ]
        : [['Sem cálculo para este recorte',
            'rode Recalcular tudo no painel']],
    },
  ];

  return (
    <Imprime>
      <h1>Configurações da capacidade</h1>
      <p className="sub">
        {ano} · OEE {rotuloOrigem(origem)} ·{' '}
        gerado em {new Date().toLocaleDateString('pt-BR')}
      </p>

      <h2>Recorte</h2>
      <ul>
        {escolhidas.map((a) => <li key={a.id}>{rotuloArea(a)}</li>)}
      </ul>
      {ccs.length > 0 && (
        <p className="sub">
          Centros de custo: {ccs.join(' · ')}
        </p>
      )}

      {secoes.map((s) => (
        <div key={s.titulo} className="bloco">
          <h2>{s.titulo}</h2>
          <table>
            <tbody>
              {s.itens.map(([rot, val]) => (
                <tr key={rot}>
                  <td>{rot}</td>
                  <td className="v">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <p className="nota">
        A capacidade vem da mesma rodada que o painel mostra — uma por área, ano
        e origem. Cadastro alterado depois dela só entra na conta ao Recalcular
        tudo.
      </p>
    </Imprime>
  );
}
