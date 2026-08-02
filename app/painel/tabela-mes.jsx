import { MESES } from '../../lib/dias';

// Os números que o gráfico não mostra. Linhas = as três medidas, colunas =
// os meses, na mesma ordem das barras — dá para ler de cima para baixo o que
// se está vendo na barra daquele mês.
//
// Recebe os 12 meses já normalizados pela página, então a coluna existe mesmo
// no mês sem resultado, e a tabela nunca sai do passo com o gráfico.
export default function TabelaMes({ meses }) {
  const linhas = [
    { rot: 'Instalada',  campo: 'instalada',  classe: 'med-inst' },
    { rot: 'Planejada',  campo: 'planejada',  classe: 'med-plan' },
    { rot: 'Disponível', campo: 'disponivel', classe: 'med-disp' },
  ];

  const total = (campo) => meses.reduce((s, m) => s + Number(m[campo] ?? 0), 0);
  const fmt = (v) => Number(v ?? 0).toLocaleString('pt-BR');

  return (
    <div className="grade-rolagem">
      <table className="tabela-mes">
        <thead>
          <tr>
            <th>Horas</th>
            {MESES.slice(1).map((m) => <th key={m} className="num">{m}</th>)}
            <th className="num">ano</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.campo}>
              <td>
                <span className={'ponto-med ' + l.classe} />
                {l.rot}
              </td>
              {meses.map((m) => (
                <td key={m.mes} className="num">{fmt(m[l.campo])}</td>
              ))}
              <td className="num forte">{fmt(total(l.campo))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
