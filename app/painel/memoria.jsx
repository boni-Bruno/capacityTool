import { formataUnidade, sufixoUnidade, horasEMinutos } from '../../lib/formato';

// O passo a passo do cálculo, turno a turno.
//
// Cada linha diz de quanto para quanto foi e por quê. A cadeia começa na
// duração bruta do turno e termina na disponível — o que sobrou é o número
// que aparece no gráfico.
//
// Só as etapas que mudaram algo estão gravadas: etapa que não mexeu no número
// não explica nada. Por isso um dia normal tem duas ou três linhas, e um dia
// de feriado tem outras.
//
// DESLIGADO DESDE A MIGRAÇÃO 33, e esta tela é a única que sente. O motor
// parou de gravar o memorial porque ele custava 229 MB projetados — 44% do
// limite do banco — para explicar um recurso num dia. Nenhum número do painel
// vem daqui; a `capacidade_fato` é que responde "quanto", e ela continua
// inteira. O componente fica de pé porque a decisão é reversível: devolver o
// insert ao motor e recalcular traz o memorial de volta completo.
const ROTULO = {
  TURNO:      'Duração do turno',
  INTERVALO:  'Intervalo de refeição',
  QUANTIDADE: 'Quantidade e equivalência',
  CALENDARIO: 'Dia não útil',
  PARADA_DIA: 'Parada de dia inteiro',
  PARADA:     'Parada planejada',
  OEE:        'OEE',
};

export default function Memoria({ linhas, unidade }) {
  if (!linhas.length) {
    return (
      <p className="muted">
        O passo a passo não está sendo gravado. Ele custava 44% do espaço do
        banco para explicar um recurso num dia, e saiu para a fábrica inteira
        caber no cálculo — os números do painel não dependem dele. A cadeia é a
        de sempre: turno, intervalo, quantidade e equivalência, calendário,
        parada e OEE, nessa ordem.
      </p>
    );
  }

  // A consulta vem ordenada por turno e etapa; aqui vira um bloco por turno.
  const porTurno = [];
  for (const l of linhas) {
    let t = porTurno.find((x) => x.turno_id === l.turno_id);
    if (!t) { t = { turno_id: l.turno_id, turno: l.turno, passos: [] }; porTurno.push(t); }
    t.passos.push(l);
  }

  const n = (v) => formataUnidade(v, unidade);

  return (
    <div className="memorias">
      {porTurno.map((t) => (
        <div key={t.turno_id} className="memoria">
          <p className="memoria-turno">{t.turno}</p>
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                <th className="num">De</th>
                <th className="num">Variação</th>
                <th className="num">Para</th>
                <th>Por quê</th>
              </tr>
            </thead>
            <tbody>
              {t.passos.map((p) => (
                <tr key={p.ordem}>
                  <td>{ROTULO[p.etapa] ?? p.etapa}</td>
                  <td className="num muted">{n(p.antes)}</td>
                  <td className={'num ' + (Number(p.delta) < 0 ? 'delta-menos' : 'delta-mais')}
                      title={horasEMinutos(Math.abs(Number(p.delta)))}>
                    {Number(p.delta) > 0 ? '+' : ''}{n(p.delta)}
                  </td>
                  <td className="num forte" title={horasEMinutos(p.depois)}>
                    {n(p.depois)}
                  </td>
                  <td className="muted">{p.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rodape" style={{ marginTop: 8 }}>
            Última linha em <strong>{sufixoUnidade(unidade)}</strong> é a
            disponível deste turno.
          </p>
        </div>
      ))}
    </div>
  );
}
