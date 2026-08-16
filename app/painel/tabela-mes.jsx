// Os números que o gráfico não mostra. Linhas = as medidas, colunas = os
// mesmos pontos do gráfico, na mesma ordem — dá para ler de cima para baixo o
// que se está vendo na barra.
//
// Serve aos três níveis do drill-down. No de turno `mostrarInstalada` é falso:
// instalada é grão dia e não se reparte por turno.
import { detalhe, formataUnidade, sufixoUnidade } from '../../lib/formato';

export default function TabelaMes({ dados, mostrarInstalada = true, unidade = 'min' }) {
  const linhas = [
    ...(mostrarInstalada
      ? [{ rot: 'Instalada', campo: 'instalada', classe: 'med-inst' }]
      : []),
    { rot: 'Planejada',  campo: 'planejada',  classe: 'med-plan' },
    // Disponível sai de planejada x OEE e quase nunca dá minuto redondo. A
    // fração existe no banco e importa para a soma fechar, mas numa grade de
    // 31 colunas ela é só ruído — aqui a célula arredonda e o title continua
    // trazendo o valor cheio.
    { rot: 'Disponível', campo: 'disponivel', classe: 'med-disp', inteiro: true },
  ];

  // Os valores chegam em minutos; a célula mostra hora com uma casa e o
  // title traz a leitura exata em hora e minuto.
  const total = (campo) => dados.reduce((s, x) => s + Number(x[campo] ?? 0), 0);

  // Arredonda o total de verdade, e não a soma dos já arredondados: a coluna
  // total tem que bater com o indicador lá em cima.
  const mostra = (v, inteiro) => (inteiro ? Math.round(Number(v ?? 0)) : v);

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
                <td key={x.rotulo} className="num" title={detalhe(x[l.campo], unidade)}>
                  {formataUnidade(mostra(x[l.campo], l.inteiro), unidade)}
                </td>
              ))}
              <td className="num forte" title={detalhe(total(l.campo), unidade)}>
                {formataUnidade(mostra(total(l.campo), l.inteiro), unidade)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
