// A GRADE QUE ALINHA O GRÁFICO COM A TABELA.
//
// Os dois desenham as mesmas doze colunas e não nasciam em cima uma da outra:
// o gráfico começa depois do eixo Y, que tem largura fixa, e a tabela começa
// depois da coluna de rótulo, que crescia com o texto. Meio centímetro de
// diferença e janeiro do gráfico cai sobre fevereiro da tabela.
//
// Aqui as duas medidas viram número, num lugar só. O gráfico usa como margem, a
// tabela usa como largura de coluna — e é isso que faz janeiro cair embaixo de
// janeiro. Mexer numa sem a outra desalinha de novo, então elas moram juntas.
//
// Sem imports: é lido do servidor (tabela) e do cliente (gráfico).

/** A coluna de rótulo da tabela, e onde a área de plotagem começa. */
export const ROTULO = 150;

/** A coluna de total da tabela, e onde a área de plotagem termina. */
export const TOTAL = 104;

/** A largura reservada ao eixo Y do gráfico, dentro dos 150 do rótulo. */
export const EIXO = 54;

/**
 * A margem esquerda do gráfico.
 *
 * O recharts desenha o eixo Y DENTRO da área útil, logo depois da margem: a
 * plotagem começa em `margem + eixo`. Para ela começar exatamente onde a
 * primeira coluna de mês da tabela começa, a margem é o que sobra.
 */
export const MARGEM_ESQ = ROTULO - EIXO;

/**
  * A largura mínima da grade inteira.
  *
  * Doze colunas de largura igual precisam caber o maior número que a tabela
  * mostra — em minuto, coisa de "3.727.239,1". Abaixo disso a grade rola, e o
  * gráfico rola JUNTO, no mesmo container: se só a tabela rolasse, o
  * alinhamento se perderia no primeiro arrasto, que é justamente quando alguém
  * está conferindo coluna por coluna.
  */
export const LARGURA_MIN = 1180;
