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

const CAMPO = { min: 'min', h: 'min', m: 'm', um: 'um' };

export default function TabelaAtributo({
  linhas, meses, unidade = 'min', atributo, semIndice = [],
}) {
  const suf = sufixoUnidade(unidade);
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

  const valor = (l, mes) => Number(l.meses.get(mes)?.[campo] ?? 0);
  const totalDa = (l) => meses.reduce((s, m) => s + valor(l, m.chave), 0);
  const totalDo = (mes) => linhas.reduce((s, l) => s + valor(l, mes), 0);
  const geral = linhas.reduce((s, l) => s + totalDa(l), 0);

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
