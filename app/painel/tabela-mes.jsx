// Os números que o gráfico não mostra. Linhas = as medidas, colunas = os
// mesmos pontos do gráfico, na mesma ordem — dá para ler de cima para baixo o
// que se está vendo na barra.
//
// Serve aos três níveis do drill-down. No de turno `mostrarInstalada` é falso:
// instalada é grão dia e não se reparte por turno.
import { formataUnidade, horasEMinutos, sufixoUnidade } from '../../lib/formato';

export default function TabelaMes({ dados, mostrarInstalada = true, unidade = 'h' }) {
  const linhas = [
    ...(mostrarInstalada
      ? [{ rot: 'Instalada', campo: 'instalada', classe: 'med-inst' }]
      : []),
    { rot: 'Planejada',  campo: 'planejada',  classe: 'med-plan' },
    { rot: 'Disponível', campo: 'disponivel', classe: 'med-disp' },
  ];

  // Os valores chegam em minutos; a célula mostra hora com uma casa e o
  // title traz a leitura exata em hora e minuto.
  const total = (campo) => dados.reduce((s, x) => s + Number(x[campo] ?? 0), 0);

  if (!dados.length) return null;

  return (
    <div className="grade-rolagem">
      <table className="tabela-mes">
        <thead>
          <tr>
            <th>Capacidade ({sufixoUnidade(unidade)})</th>
            {dados.map((x) => <th key={x.rotulo} className="num">{x.rotulo}</th>)}
            <th className="num">total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.campo}>
              <td>
                <span className={'ponto-med ' + l.classe} />
                {l.rot}
              </td>
              {dados.map((x) => (
                <td key={x.rotulo} className="num" title={horasEMinutos(x[l.campo])}>
                  {formataUnidade(x[l.campo], unidade)}
                </td>
              ))}
              <td className="num forte" title={horasEMinutos(total(l.campo))}>
                {formataUnidade(total(l.campo), unidade)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
