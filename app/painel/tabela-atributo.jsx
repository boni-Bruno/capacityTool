import { detalhe, formataUnidade, sufixoUnidade } from '../../lib/formato';
import { ROTULO, TOTAL } from './grade';

// A capacidade repartida entre os rótulos de um atributo, mês a mês.
//
// A tabela por recurso responde "quanto cabe em cada máquina". Esta responde
// "quanto cabe de cada coisa" — e as duas são a mesma capacidade, olhada por
// eixos diferentes.
//
// EM MINUTO A SOMA DOS RÓTULOS FECHA COM O TOTAL, porque as fatias de um CT
// somam 1. EM METRO E PEÇA ELA NÃO FECHA, e não deveria: cada rótulo converte
// a uma taxa própria, e é justamente essa diferença que a tabela existe para
// mostrar. Sem dizer isso, a linha de total pareceria erro de conta.
//
// POR DIA ÚTIL vale aqui como vale no resto do painel — a leitura é a mesma
// medida com uma ordem de grandeza de diferença, e uma tabela em mês inteiro no
// meio de uma tela em dia útil é o tipo de discordância que ninguém confere.
// Cada mês divide pelos dias úteis DELE; o total divide a soma bruta pela soma
// dos dias, nunca a média das médias.

const CAMPO = { min: 'min', h: 'min', m: 'm', um: 'um' };

export default function TabelaAtributo({
  linhas, meses, unidade = 'min', atributo, semIndice = [],
  porDiaUtil = false,
}) {
  const suf = sufixoUnidade(unidade, porDiaUtil);
  const campo = CAMPO[unidade] ?? 'min';

  if (!linhas.length) {
    return (
      <p className="vazio">
        Nenhum rótulo de <strong>{atributo}</strong> alcança os recursos desta
        seleção. Os recursos não têm demanda nesta carga, ou as regras do
        DE/PARA não classificam o que eles produzem.
      </p>
    );
  }

  // O número cheio do mês, antes de qualquer divisão.
  const bruto = (l, mes) => Number(l.meses.get(mes)?.[campo] ?? 0);
  const diasDe = (chave) =>
    Number(meses.find((m) => m.chave === chave)?.dias ?? 0);

  // O que a célula mostra: o mês inteiro, ou ele dividido pelos dias úteis
  // daquele mês.
  const valor = (l, chave) => {
    const v = bruto(l, chave);
    if (!porDiaUtil) return v;
    const d = diasDe(chave);
    return d > 0 ? v / d : 0;
  };

  const somaDias = meses.reduce((s, m) => s + Number(m.dias ?? 0), 0);

  // Divisão de somas, nunca média de divisões: somar médias não dá média.
  const totalDa = (l) => {
    const cheio = meses.reduce((s, m) => s + bruto(l, m.chave), 0);
    if (!porDiaUtil) return cheio;
    return somaDias > 0 ? cheio / somaDias : 0;
  };
  const totalDo = (chave) => linhas.reduce((s, l) => s + valor(l, chave), 0);
  const geral = porDiaUtil
    ? (somaDias > 0
        ? linhas.reduce((s, l) => s
            + meses.reduce((t, m) => t + bruto(l, m.chave), 0), 0) / somaDias
        : 0)
    : linhas.reduce((s, l) => s + totalDa(l), 0);

  // Do que pesa mais para o que pesa menos: numa lista de vinte rótulos, a
  // ordem alfabética esconde os três que respondem por metade da fábrica.
  const ordenadas = [...linhas].sort((a, b) => totalDa(b) - totalDa(a));

  return (
    <>
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
          {ordenadas.map((l) => (
            <tr key={l.rotulo ?? '__sem__'}>
              <td className={l.rotulo === null ? 'muted' : ''}>
                {l.rotulo === null ? 'sem rótulo' : l.rotulo}
              </td>
              {meses.map((m) => (
                <td key={m.chave} className="num col-mes"
                    title={detalhe(valor(l, m.chave), unidade)}>
                  {formataUnidade(valor(l, m.chave), unidade)}
                </td>
              ))}
              <td className="num forte" title={detalhe(totalDa(l), unidade)}>
                {formataUnidade(totalDa(l), unidade)}
              </td>
            </tr>
          ))}
          <tr className="forte">
            <td>total</td>
            {meses.map((m) => (
              <td key={m.chave} className="num col-mes"
                  title={detalhe(totalDo(m.chave), unidade)}>
                {formataUnidade(totalDo(m.chave), unidade)}
              </td>
            ))}
            <td className="num" title={detalhe(geral, unidade)}>
              {formataUnidade(geral, unidade)}
            </td>
          </tr>
        </tbody>
      </table>

      {semIndice.length > 0 && (
        <p className="rodape">
          <strong>{semIndice.length} centro(s) de trabalho sem índice</strong>{' '}
          nesta carga entram com zero na conversão — o tempo deles está aqui, o
          metro não. {semIndice.slice(0, 8).join(' · ')}
          {semIndice.length > 8 && ` … e mais ${semIndice.length - 8}`}.
        </p>
      )}
    </>
  );
}
