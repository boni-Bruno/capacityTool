import { Suspense } from 'react';
import {
  turnosParaCadastro, plantas, horariosDoTurno, intervalosDoTurno,
} from '../../../lib/cadastro';
import { DIAS_CURTO } from '../../../lib/dias';
import AvisoBanco from '../aviso-banco';
import Turnos from './turnos';
import EditorHorario from './editor';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  let lista, listaPlantas;
  try {
    [lista, listaPlantas] = await Promise.all([turnosParaCadastro(), plantas()]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  if (!listaPlantas.length) {
    return (
      <div className="aviso">
        <strong>Nenhuma planta cadastrada.</strong>
        <p style={{ margin: '8px 0 0' }}>
          Turno pertence a uma planta. Rode <code>02_seed.sql</code> antes.
        </p>
      </div>
    );
  }

  const pedido = Number(searchParams?.turno);
  const turno = lista.find((t) => t.id === pedido) ?? lista[0] ?? null;

  const [horarios, intervalos] = turno
    ? await Promise.all([horariosDoTurno(turno.id), intervalosDoTurno(turno.id)])
    : [[], []];

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Turnos</h1>
      </div>

      <div className="painel">
        <h2>Turnos cadastrados</h2>
        <Suspense>
          <Turnos lista={lista} plantas={listaPlantas} selecionado={turno?.id ?? null} />
        </Suspense>

        <p className="rodape">
          {lista.length} turno{lista.length === 1 ? '' : 's'} no banco
          {lista.some((t) => !t.ativo) &&
            ` · ${lista.filter((t) => !t.ativo).length} desativado(s)`}
        </p>
      </div>

      {turno ? (
        <div className="painel">
          <h2>
            Horário de <code>{turno.codigo}</code> · {turno.nome}
          </h2>
          {/* key: trocar de turno tem que fechar a linha que estava aberta
              para edição, senão ela segue aberta com o horário do turno
              anterior. */}
          <EditorHorario key={turno.id} turnoId={turno.id} horarios={horarios} />

          {intervalos.length > 0 && (
            <p className="rodape">
              Intervalos deste turno:{' '}
              {intervalos.map((i, n) => (
                <span key={`${i.descricao}:${i.minutos}:${i.aplica_a}:${i.descontavel}`}>
                  {n > 0 && ' · '}
                  {i.descricao} {i.minutos} min
                  {/* O intervalo é por dia da semana. Sete dias é o caso comum
                      e não merece uma lista; menos que isso, sim — é
                      justamente o sábado diferente. */}
                  {i.dias === 7
                    ? ' (todo dia)'
                    : ` (${i.dias_semana.map((d) => DIAS_CURTO[Number(d)]).join(', ')})`}
                  {!i.descontavel
                    ? ' — não desconta'
                    : i.aplica_a === 'AMBOS' ? ' — máquina e pessoa'
                    : ` — só ${i.aplica_a.toLowerCase()}`}
                </span>
              ))}
            </p>
          )}
        </div>
      ) : (
        <div className="aviso">
          <strong>Nenhum turno cadastrado.</strong>
          <p style={{ margin: '8px 0 0' }}>
            Crie um acima. Ele nasce sem horário nenhum — os sete dias da semana
            ficam zerados para você preencher.
          </p>
        </div>
      )}
    </>
  );
}
