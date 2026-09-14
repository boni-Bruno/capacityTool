'use client';

// QUEM ENTRA NO LOTE, à vista e desmarcável.
//
// O alcance vem do filtro do topo, e a lista é a prova disso: é olhando para
// ela que alguém percebe que sobrou um recurso de fora — ou que entrou um que
// não devia. Sem ela, "aplicar em 48" é um número em que se acredita.
//
// Tirar um do lote é clicar nele. "nenhum" e "todos" existem para o caso que o
// Bruno trouxe: nove G6200 no mesmo CT, quatro com dois turnos e cinco com
// três. Sem "nenhum", escolher quatro é desmarcar cinco — e com quarenta na
// lista é desmarcar trinta e seis. O padrão continua sendo todos.
export default function Alvos({ alvos, fora, onAlterna, onDefine = null }) {
  const dentro = alvos.filter((a) => !fora.has(a.id));

  return (
    <>
      <p className="rodape" style={{ margin: '10px 0 6px' }}>
        <strong>{dentro.length} de {alvos.length}</strong> recursos no lote
        {fora.size > 0 ? ' · clique num apagado para incluir de volta' : ' · clique num para tirar'}
        {onDefine && (
          <>
            {' '}·{' '}
            <button type="button" className="link-linha"
                    onClick={() => onDefine(new Set())}>todos</button>
            {' '}·{' '}
            <button type="button" className="link-linha"
                    onClick={() => onDefine(new Set(alvos.map((a) => a.id)))}>nenhum</button>
          </>
        )}
      </p>
      <div className="chips">
        {alvos.map((a) => {
          const excluido = fora.has(a.id);
          return (
            <button
              key={a.id}
              type="button"
              className={`chip${excluido ? '' : ' chip-on'}`}
              title={excluido ? 'incluir no lote' : 'tirar do lote'}
              onClick={() => onAlterna(a.id)}
            >
              {a.codigo}
              {a.nome ? <span className="muted"> · {a.nome}</span> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}
