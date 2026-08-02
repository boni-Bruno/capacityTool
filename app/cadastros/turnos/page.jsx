import { Suspense } from 'react';
import {
  turnos, plantas, horariosDoTurno, intervalosDoTurno,
} from '../../../lib/cadastro';
import AvisoBanco from '../aviso-banco';
import Turnos from './turnos';
import EditorHorario from './editor';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  let lista, listaPlantas;
  try {
    [lista, listaPlantas] = await Promise.all([turnos(), plantas()]);
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

        {/* Quantas linhas a consulta devolveu, direto do servidor. Se aqui
            disser 3 e o banco tiver 4, o problema é consulta ou conexão; se
            disser 4 e a tabela acima mostrar 3, é a tela. */}
        <p className="rodape">
          {lista.length} turno{lista.length === 1 ? '' : 's'} ativo
          {lista.length === 1 ? '' : 's'} vindos do banco nesta requisição.
        </p>
      </div>

      {turno ? (
        <div className="painel">
          <h2>
            Horário de <code>{turno.codigo}</code> · {turno.nome}
          </h2>
          <EditorHorario turnoId={turno.id} horarios={horarios} />

          {intervalos.length > 0 && (
            <p className="rodape">
              Intervalos deste turno:{' '}
              {intervalos.map((i, n) => (
                <span key={i.id}>
                  {n > 0 && ' · '}
                  {i.descricao} {i.minutos} min
                  {!i.descontavel
                    ? ' (não desconta)'
                    : i.aplica_a === 'AMBOS' ? ' (máquina e pessoa)'
                    : ` (só ${i.aplica_a.toLowerCase()})`}
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
