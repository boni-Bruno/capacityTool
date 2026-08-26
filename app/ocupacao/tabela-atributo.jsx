import { detalhe, formataUnidade, sufixoUnidade } from '../../lib/formato';
import { ROTULO, TOTAL } from '../painel/grade';

// A ocupação repartida entre os rótulos de um atributo.
//
// A tabela por CT responde "que máquina está apertada". Esta responde "que
// PRODUTO está apertado" — e é outra pergunta: um rótulo pode estourar em
// junho sem que nenhum centro estoure, porque ele divide o mês com os outros.
//
// A CAPACIDADE VEM RATEADA pela fatia de tempo; A DEMANDA VEM INTEIRA, porque
// ela É da linha e a linha É classificada. Só a primeira precisa de rateio, e
// é bom que a tabela diga isso: são naturezas diferentes na mesma linha.

const classePct = (v) => (v === null ? 'muted'
  : v > 100 ? 'ocup-estoura'
    : v >= 85 ? 'ocup-aperta' : '');

const fmtPct = (v) => (v === null ? '—' : `${v.toFixed(1)}%`);
const num = (v) => Number(v ?? 0);

export default function TabelaAtributoOcupacao({
  linhas, meses, unidade = 'min', atributo, medida,
}) {
  const suf = sufixoUnidade(unidade);

  if (!linhas.length) {
    return (
      <p className="vazio">
        Nenhum rótulo de <strong>{atributo}</strong> alcança os centros desta
        seleção — eles não têm demanda nesta base, ou as regras do DE/PARA não
        classificam o que eles produzem.
      </p>
    );
  }

  const cap = (l, mes) => num(l.capacidade.get(mes));
  const dem = (l, mes) => num(l.demanda.get(mes));
  const somaCap = (l) => meses.reduce((s, m) => s + cap(l, m.chave), 0);
  const somaDem = (l) => meses.reduce((s, m) => s + dem(l, m.chave), 0);

  const ocupa = (d, c) => (c === 0 ? null : (d * 100) / c);

  // Do que pesa mais para o que pesa menos, pela demanda: é ela que faz a
  // pergunta deste painel — quem está pedindo mais.
  const ordenadas = [...linhas].sort((a, b) => somaDem(b) - somaDem(a));

  const totCap = linhas.reduce((s, l) => s + somaCap(l), 0);
  const totDem = linhas.reduce((s, l) => s + somaDem(l), 0);

  return (
    <table className="tabela-mes tabela-grade">
      <thead>
        <tr>
          <th style={{ width: ROTULO }}>{atributo} ({suf})</th>
          {meses.map((m) => (
            <th key={m.chave} className="col-mes">{m.rotulo}</th>
          ))}
          <th className="num" style={{ width: TOTAL }}>total</th>
        </tr>
      </thead>
      <tbody>
        {ordenadas.map((l) => {
          const nome = l.rotulo === null ? 'sem rótulo' : l.rotulo;
          return (
            <tr key={l.rotulo ?? '__sem__'} className="grupo-atributo">
              <td className={l.rotulo === null ? 'muted' : 'forte'}>{nome}</td>
              {meses.map((m) => {
                const o = ocupa(dem(l, m.chave), cap(l, m.chave));
                return (
                  <td key={m.chave} className={`num col-mes ${classePct(o)}`}
                      title={`${medida}: ${detalhe(cap(l, m.chave), unidade)}`
                             + ` · Demanda: ${detalhe(dem(l, m.chave), unidade)}`}>
                    <span className="ocup-num">{fmtPct(o)}</span>
                    <span className="ocup-det">
                      {formataUnidade(dem(l, m.chave), unidade)}
                      {' / '}
                      {formataUnidade(cap(l, m.chave), unidade)}
                    </span>
                  </td>
                );
              })}
              <td className={`num forte ${classePct(ocupa(somaDem(l), somaCap(l)))}`}>
                <span className="ocup-num">{fmtPct(ocupa(somaDem(l), somaCap(l)))}</span>
                <span className="ocup-det">
                  {formataUnidade(somaDem(l), unidade)}
                  {' / '}
                  {formataUnidade(somaCap(l), unidade)}
                </span>
              </td>
            </tr>
          );
        })}

        {/* O total não é a soma das ocupações e nem a média delas: é a demanda
            do período sobre a capacidade do período. Somar porcentagem é o erro
            clássico desta tabela. */}
        <tr className="forte">
          <td>total</td>
          {meses.map((m) => {
            const c = linhas.reduce((s, l) => s + cap(l, m.chave), 0);
            const d = linhas.reduce((s, l) => s + dem(l, m.chave), 0);
            return (
              <td key={m.chave} className={`num col-mes ${classePct(ocupa(d, c))}`}>
                {fmtPct(ocupa(d, c))}
              </td>
            );
          })}
          <td className={`num ${classePct(ocupa(totDem, totCap))}`}>
            {fmtPct(ocupa(totDem, totCap))}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
