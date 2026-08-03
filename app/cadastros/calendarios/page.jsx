import { Suspense } from 'react';
import {
  calendariosCadastro, diasDoCalendario,
  pesosDoCalendario, diasTrabalhadosPorMes, diasDoAno,
} from '../../../lib/calendario';
import { excecoesDoAno, areasDaPlanta, TIPOS } from '../../../lib/excecao';
import { plantasParaEscolha } from '../../../lib/estrutura';
import { DIAS } from '../../../lib/dias';
import { diasUteisPorMes, formataDiasUteis } from '../../../lib/dia-util';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import Cadastro from '../cadastro';
import Regras from './regras';
import DiasUteis from './dias-uteis';
import Importar from './importar';
import Ano from './ano';
import EditorExcecao from './excecao';

export const dynamic = 'force-dynamic';

function descreveDias(dias) {
  if (!dias) return 'nenhum dia';
  const n = dias.split(',').map(Number).sort((a, b) => a - b);
  if (n.length === 7) return 'todos os dias';
  const seguido = n.every((d, i) => i === 0 || d === n[i - 1] + 1);
  if (seguido && n.length > 2) return `${DIAS[n[0]]} a ${DIAS[n[n.length - 1]]}`;
  return n.map((d) => DIAS[d]).join(', ');
}

export default async function Page({ searchParams }) {
  let lista, plantas;
  try {
    [lista, plantas] = await Promise.all([
      calendariosCadastro(), plantasParaEscolha(),
    ]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  if (!plantas.length) {
    return (
      <>
        <div className="topo"><h1 className="titulo">Calendários</h1></div>
        <div className="aviso">
          <strong>Nenhuma planta ativa.</strong>
          <p style={{ margin: '8px 0 0' }}>
            Todo calendário pertence a uma planta. Cadastre a planta primeiro.
          </p>
        </div>
      </>
    );
  }

  const anoAtual = new Date().getFullYear();
  const ano = Number(searchParams?.ano ?? anoAtual);
  const itens = lista.map((c) => ({ ...c, resumo: descreveDias(c.dias) }));

  const pedido = Number(searchParams?.calendario);
  const cal = lista.find((c) => c.id === pedido) ?? lista[0] ?? null;

  const areasPlanta = cal ? await areasDaPlanta(cal.planta_id) : [];

  // Sem área escolhida a grade mostra todas ao mesmo tempo, como sempre foi.
  // Com uma área, só o que alcança ela — depois que a exceção passou a valer
  // por área, mostrar tudo junto dizia que um feriado da Confecção parava a
  // planta inteira.
  const areaPedida = Number(searchParams?.area);
  const area = areasPlanta.find((a) => a.id === areaPedida) ?? null;

  const [diasSemana, pesos, contagem, dias, excecoes] = cal
    ? await Promise.all([
        diasDoCalendario(cal.id),
        pesosDoCalendario(cal.id),
        diasTrabalhadosPorMes(cal.id, ano, area?.id ?? null),
        diasDoAno(cal.id, ano, area?.id ?? null),
        excecoesDoAno(cal.planta_id, ano),
      ])
    : [[], [], [], [], []];

  const uteis = cal ? diasUteisPorMes(contagem, pesos).map(formataDiasUteis) : null;

  // Data clicada na grade. A exceção vem do nível da PLANTA, não do calendário:
  // é preciso enxergar um feriado que existe e que este calendário não observa,
  // senão não haveria como passar a observá-lo.
  const pedida = String(searchParams?.data ?? '');
  const data = /^\d{4}-\d{2}-\d{2}$/.test(pedida) && pedida.startsWith(`${ano}-`)
    ? pedida : null;
  const excecao = data ? excecoes.find((e) => e.data === data) ?? null : null;

  // Exceção precisa das duas marcações para valer. Sem uma delas ela está
  // cadastrada, aparece na grade e não muda nada no cálculo — o tipo de coisa
  // que só se descobre conferindo número.
  const semAlcance = excecoes.filter((e) => !e.calendario_ids || !e.area_ids);

  // Calendários irmãos: a exceção é da planta e cada um decide se observa.
  const daPlanta = cal ? lista.filter((c) => c.planta_id === cal.planta_id) : [];

  const url = (d) => {
    const p = new URLSearchParams();
    if (cal) p.set('calendario', String(cal.id));
    p.set('ano', String(ano));
    if (area) p.set('area', String(area.id));
    if (d) p.set('data', d);
    return '?' + p.toString();
  };

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Calendários</h1>
        <Suspense>
          <Seletor campos={[
            ...(lista.length > 1 ? [{
              nome: 'calendario', rotulo: 'Calendário', tipo: 'select',
              valor: String(cal?.id ?? ''),
              opcoes: lista.map((c) => ({
                valor: String(c.id), rotulo: `${c.planta} · ${c.nome}`,
              })),
            }] : []),
            ...(areasPlanta.length > 0 ? [{
              nome: 'area', rotulo: 'Área', tipo: 'select',
              valor: String(area?.id ?? ''),
              opcoes: [
                { valor: '', rotulo: 'todas as áreas' },
                ...areasPlanta.map((a) => ({ valor: String(a.id), rotulo: a.nome })),
              ],
            }] : []),
            {
              nome: 'ano', rotulo: 'Ano', tipo: 'select', valor: String(ano),
              opcoes: [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2].map((a) => ({
                valor: String(a), rotulo: String(a),
              })),
            },
          ]} />
        </Suspense>
      </div>

      {cal && (
        <>
          <div className="painel">
            <div className="painel-topo">
              <h2>
                {cal.nome} · {cal.planta} · {ano}
                {area && <span className="foco"> · {area.nome}</span>}
              </h2>
              <span className="muted" style={{ fontSize: 12 }}>
                clique num dia para cadastrar feriado ou parada
              </span>
            </div>

            <Ano ano={ano} dias={dias} selecionada={data} href={url} uteis={uteis} />

            <p className="legenda">
              <span className="pino-leg dia-feriado" /> feriado
              <span className="pino-leg dia-parada_coletiva" /> parada coletiva
              <span className="pino-leg dia-extra" /> trabalha extraordinariamente
              <span className="pino-leg dia-parado" /> sem turno no dia da semana
            </p>

            <p className="rodape">
              Pintado é dia em que <strong>esta linha não produz</strong>. A mesma
              data aparece diferente em outro calendário — o rodízio trabalha
              domingo e pode trabalhar num feriado que o padrão observa.
              {area
                ? ` Mostrando só o que alcança ${area.nome}: feriado marcado ` +
                  `para outra área não aparece aqui, e não entra na contagem ` +
                  `de dias úteis abaixo.`
                : ' Sem área escolhida, aparece tudo que este calendário observa,' +
                  ' em qualquer área.'}
            </p>

            {semAlcance.length > 0 && (
              <div className="aviso" style={{ marginTop: 12 }}>
                <strong>
                  {semAlcance.length} exceção(ões) de {cal.planta} em {ano} não
                  alcançam ninguém.
                </strong>
                <p style={{ margin: '6px 0 0' }}>
                  Datas:{' '}
                  {semAlcance.map((e) => e.data.split('-').reverse().join('/')).join(', ')}.
                  {' '}O motor exige as duas marcações — a área do recurso e o
                  calendário dele. Faltando uma, a data está cadastrada e não
                  muda nada no cálculo. Clique no dia para completar.
                </p>
              </div>
            )}
          </div>

          {data && (
            <div className="painel">
              <h2>
                {data.split('-').reverse().join('/')}
                {excecao && <span className="foco"> · já cadastrado na planta</span>}
              </h2>
              <EditorExcecao
                key={`${data}:${excecao?.id ?? 'novo'}`}
                plantaId={cal.planta_id}
                data={data}
                excecao={excecao}
                tipos={TIPOS}
                calendarios={daPlanta}
                areas={areasPlanta}
              />
            </div>
          )}

          <div className="painel">
            <h2>Dias da semana em que trabalha</h2>
            <Regras key={cal.id} calendarioId={cal.id} dias={diasSemana} />
          </div>

          <div className="painel">
            <h2>
              Peso do dia útil · {cal.nome}
              {area && <span className="foco"> · {area.nome}</span>}
            </h2>
            <DiasUteis
              key={`${cal.id}:${ano}`}
              calendarioId={cal.id}
              contagem={contagem}
              pesos={pesos}
              ano={ano}
              nome={cal.nome}
              diasTrabalhados={diasSemana}
            />
          </div>
        </>
      )}

      <div className="painel">
        <h2>Todos os calendários</h2>
        <Cadastro
          rota="/api/cadastro/calendario"
          itens={itens}
          rotuloNovo="Criar calendário"
          vazio="Nenhum calendário cadastrado. Crie o primeiro abaixo."
          campos={[
            { nome: 'planta_id', rot: 'Planta', tipo: 'select', col: 'planta',
              soCriacao: true,
              opcoes: plantas.map((p) => ({ valor: p.id, rotulo: p.nome })) },
            { nome: 'codigo',   rot: 'Código',   placeholder: 'ex.: RODIZIO' },
            { nome: 'nome',     rot: 'Nome',     placeholder: 'ex.: Rodízio' },
            { nome: 'resumo',   rot: 'Dias',     soLeitura: true },
            { nome: 'recursos', rot: 'Recursos', soLeitura: true },
          ]}
        />
        <p className="rodape">
          Calendário seguido por algum recurso não pode ser apagado — o recurso
          ficaria sem regime e sumiria do cálculo em silêncio, porque o motor
          exige o vínculo. Mude os recursos de regime antes.
        </p>

        <Importar plantas={plantas} origens={lista} />
      </div>
    </>
  );
}
