import { Suspense } from 'react';
import { calendariosCadastro, regrasDoCalendario } from '../../../lib/calendario';
import { plantasParaEscolha } from '../../../lib/estrutura';
import { DIAS } from '../../../lib/dias';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import Cadastro from '../cadastro';
import Regras from './regras';

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

  // A lista já traz os dias resumidos; a tabela mostra texto, não o cru.
  const itens = lista.map((c) => ({ ...c, resumo: descreveDias(c.dias) }));

  const pedido = Number(searchParams?.calendario);
  const cal = lista.find((c) => c.id === pedido) ?? lista[0] ?? null;
  const turnos = cal ? await regrasDoCalendario(cal.id) : [];

  const inicial = {};
  for (const t of turnos) {
    for (const d of (t.dias ?? '').split(',').filter(Boolean)) {
      inicial[`${t.turno_id}:${Number(d)}`] = true;
    }
  }

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Calendários</h1>
        {lista.length > 1 && (
          <Suspense>
            <Seletor campos={[{
              nome: 'calendario', rotulo: 'Editando', tipo: 'select',
              valor: String(cal?.id ?? ''),
              opcoes: lista.map((c) => ({
                valor: String(c.id), rotulo: `${c.planta} · ${c.nome}`,
              })),
            }]} />
          </Suspense>
        )}
      </div>

      <div className="painel">
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
      </div>

      {cal && (
        <div className="painel">
          <h2>Dias de {cal.nome} · {cal.planta}</h2>
          <Regras key={cal.id} calendarioId={cal.id} turnos={turnos} inicial={inicial} />
        </div>
      )}
    </>
  );
}
