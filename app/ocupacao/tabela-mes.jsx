// Os números que o gráfico não mostra: capacidade, demanda e a ocupação que
// sai da divisão das duas. Colunas na mesma ordem do gráfico, para dar para ler
// de cima para baixo o que se está vendo na barra.
//
// A OCUPAÇÃO DO TOTAL NÃO É A SOMA DAS OCUPAÇÕES, e nem a média delas: é a
// demanda do período inteiro sobre a capacidade do período inteiro. Somar
// porcentagem é o erro clássico desta tabela, e ele só apareceria conferindo
// contra o indicador lá em cima.
import { detalhe, formataUnidade, sufixoUnidade } from '../../lib/formato';
import { ROTULO, TOTAL } from '../painel/grade';

const classePct = (v) => (v === null ? 'muted'
  : v > 100 ? 'ocup-estoura'
    : v >= 85 ? 'ocup-aperta' : '');

const fmtPct = (v) => (v === null ? '—' : `${v.toFixed(1)}%`);

export default function TabelaMesOcupacao({ dados, medida, unidade = 'min' }) {
  if (!dados.length) return null;
  const suf = sufixoUnidade(unidade);

  const totCap = dados.reduce((s, x) => s + Number(x.capacidade ?? 0), 0);
  const totDem = dados.reduce((s, x) => s + Number(x.demanda ?? 0), 0);
  const ocupa = (d, c) => (Number(c) === 0 ? null : (Number(d) * 100) / Number(c));

  const linhas = [
    { rot: medida, campo: 'capacidade', classe: 'med-disp' },
    { rot: 'Demanda', campo: 'demanda', classe: 'med-dem' },
  ];

  return (
    <>
      {/* A mesma grade do gráfico logo acima — ver ../painel/grade.js. A
          rolagem é do container lá fora, que leva os dois juntos. */}
      <table className="tabela-mes tabela-grade">
        <thead>
          <tr>
            <th style={{ width: ROTULO }}>Ocupação ({suf})</th>
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
                <span className={`ponto-med ${l.classe}`} />
                {l.rot}
              </td>
              {dados.map((x) => (
                <td key={x.rotulo} className="num"
                    title={detalhe(x[l.campo], unidade)}>
                  {formataUnidade(Math.round(Number(x[l.campo] ?? 0)), unidade)}
                </td>
              ))}
              <td className="num forte"
                  title={detalhe(l.campo === 'demanda' ? totDem : totCap, unidade)}>
                {formataUnidade(
                  Math.round(l.campo === 'demanda' ? totDem : totCap), unidade)}
              </td>
            </tr>
          ))}

          <tr>
            <td>Ocupação</td>
            {dados.map((x) => {
              const o = ocupa(x.demanda, x.capacidade);
              return (
                <td key={x.rotulo} className={`num ${classePct(o)}`}>
                  {fmtPct(o)}
                </td>
              );
            })}
            <td className={`num forte ${classePct(ocupa(totDem, totCap))}`}>
              {fmtPct(ocupa(totDem, totCap))}
            </td>
          </tr>

          <tr className="muted">
            <td>Sobra</td>
            {dados.map((x) => (
              <td key={x.rotulo} className="num">
                {formataUnidade(
                  Math.round(Number(x.capacidade ?? 0) - Number(x.demanda ?? 0)),
                  unidade)}
              </td>
            ))}
            <td className="num">
              {formataUnidade(Math.round(totCap - totDem), unidade)}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
