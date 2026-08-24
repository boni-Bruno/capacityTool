// Os números que o gráfico não mostra. Linhas = as medidas, colunas = os
// mesmos pontos do gráfico, na mesma ordem — dá para ler de cima para baixo o
// que se está vendo na barra.
//
// Serve aos três níveis do drill-down. No de turno `mostrarInstalada` é falso:
// instalada é grão dia e não se reparte por turno.
import { detalhe, eFisica, formataUnidade, sufixoUnidade } from '../../lib/formato';
import { ROTULO, TOTAL } from './grade';

export default function TabelaMes({
  dados, mostrarInstalada = true, unidade = 'min',
  // `sufixo` pode dizer mais que a unidade — "m/dia útil". E `totais` chega de
  // fora quando somar as colunas daria a resposta errada: em capacidade por dia
  // útil o total é a capacidade cheia sobre os dias cheios, nunca a soma das
  // médias mensais.
  sufixo = null, totais = null,
}) {
  const suf = sufixo ?? sufixoUnidade(unidade);
  const linhas = [
    ...(mostrarInstalada
      ? [{ rot: 'Instalada', campo: 'instalada', classe: 'med-inst' }]
      : []),
    { rot: 'Planejada',  campo: 'planejada',  classe: 'med-plan' },
    // Disponível sai de planejada x OEE e quase nunca dá minuto redondo. A
    // fração existe no banco e importa para a soma fechar, mas numa grade de
    // 31 colunas ela é só ruído — aqui a célula arredonda e o title continua
    // trazendo o valor cheio.
    //
    // Só em TEMPO. Meio minuto não muda decisão nenhuma; meio metro de
    // tecelagem, num total de 150, é 0,3% — e arredondar ali fazia a linha do
    // total mostrar 150 ao lado do indicador dizendo 150,2, na mesma tela.
    { rot: 'Disponível', campo: 'disponivel', classe: 'med-disp', inteiro: true },
  ];

  // Os valores chegam em minutos; a célula mostra hora com uma casa e o
  // title traz a leitura exata em hora e minuto.
  const total = (campo) =>
    (totais ? Number(totais[campo] ?? 0)
            : dados.reduce((s, x) => s + Number(x[campo] ?? 0), 0));

  // Arredonda o total de verdade, e não a soma dos já arredondados: a coluna
  // total tem que bater com o indicador lá em cima.
  const arredonda = (campo) => campo.inteiro && !eFisica(unidade);
  const mostra = (v, l) => (arredonda(l) ? Math.round(Number(v ?? 0)) : v);

  if (!dados.length) return null;

  return (
    <>
      {/* Larguras fixas e iguais para os meses: é o que põe cada coluna embaixo
          da barra dela. Os cabeçalhos de mês vão centrados como no eixo do
          gráfico; os números seguem à direita, como número deve ir.
          A rolagem é do container lá fora, que leva o gráfico junto. */}
      <table className="tabela-mes tabela-grade">
        <thead>
          <tr>
            <th style={{ width: ROTULO }}>Capacidade ({suf})</th>
            {dados.map((x) => (
              <th key={x.rotulo} className="col-mes">{x.rotulo}</th>
            ))}
            <th className="num" style={{ width: TOTAL }}>total</th>
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
                  {formataUnidade(mostra(x[l.campo], l), unidade)}
                </td>
              ))}
              <td className="num forte" title={detalhe(total(l.campo), unidade)}>
                {formataUnidade(mostra(total(l.campo), l), unidade)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
