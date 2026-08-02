import { MESES } from '../../../lib/dias';

// Grade turno x mês do ano. Só leitura — serve para enxergar o padrão do ano
// antes de mexer; a edição continua sendo por data, logo abaixo.
//
// Mês parcial existe de propósito: um turno que liga no dia 15 não pode
// aparecer igual a um que rodou o mês inteiro.
export default function Grade({ linhas, ano }) {
  if (!linhas.length) {
    return <p className="muted">Nenhum turno ativo na planta.</p>;
  }

  // A consulta devolve turno x mês esparramado; aqui vira uma linha por turno.
  const porTurno = [];
  for (const l of linhas) {
    let t = porTurno.find((x) => x.turno_id === l.turno_id);
    if (!t) {
      t = { turno_id: l.turno_id, codigo: l.codigo, nome: l.nome, meses: {} };
      porTurno.push(t);
    }
    const dias = Number(l.dias_cobertos);
    const total = Number(l.dias_mes);
    t.meses[Number(l.mes)] =
      dias === 0 ? 'vazio' : dias >= total ? 'cheio' : 'parcial';
  }

  return (
    <div className="grade-rolagem">
      <table className="grade">
        <thead>
          <tr>
            <th>Turno</th>
            {MESES.slice(1).map((m) => <th key={m} className="grade-mes">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {porTurno.map((t) => (
            <tr key={t.turno_id}>
              <td className="grade-turno">{t.codigo}</td>
              {Array.from({ length: 12 }, (_, i) => {
                const estado = t.meses[i + 1] ?? 'vazio';
                return (
                  <td key={i} className="grade-cel">
                    <span
                      className={'pino pino-' + estado}
                      title={`${t.codigo} · ${MESES[i + 1]}/${ano} · ${
                        estado === 'cheio' ? 'roda o mês todo'
                        : estado === 'parcial' ? 'roda parte do mês'
                        : 'não roda'}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="legenda">
        <span className="pino pino-cheio" /> mês todo
        <span className="pino pino-parcial" /> parte do mês
        <span className="pino pino-vazio" /> não roda
      </p>
    </div>
  );
}
