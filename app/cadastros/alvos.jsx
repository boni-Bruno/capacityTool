'use client';

// QUEM ENTRA NO LOTE, à vista e desmarcável.
//
// O alcance vem do filtro do topo, e a lista é a prova disso: é olhando para
// ela que alguém percebe que sobrou um recurso de fora — ou que entrou um que
// não devia. Sem ela, "aplicar em 48" é um número em que se acredita.
//
// Tirar um do lote é clicar nele. Não existe "marcar todos" porque o padrão já
// é todos: o botão serviria para desfazer o que ninguém fez.
export default function Alvos({ alvos, fora, onAlterna }) {
  const dentro = alvos.filter((a) => !fora.has(a.id));

  return (
    <>
      <p className="rodape" style={{ margin: '10px 0 6px' }}>
        {dentro.length} de {alvos.length} recursos
        {fora.size > 0 && ' · clique para incluir de volta'}
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
