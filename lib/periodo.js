// =============================================================================
// O PERÍODO QUE O PAINEL MOSTRA
//
// Antes existiam dois parâmetros de recorte, `mes` e `dia`, e eles só eram
// escritos clicando numa barra do gráfico. Para ver de março a junho não havia
// caminho nenhum: ou o ano inteiro, ou um mês.
//
// Agora existe um recorte só — um intervalo de datas — e o nível de detalhe
// sai dele em vez de ser escolhido à parte:
//
//   intervalo com mais de um mês  -> mês a mês
//   intervalo dentro de um mês    -> dia a dia
//   um dia só                     -> turno a turno
//
// É a mesma escada do drill-down, então clicar numa barra continua funcionando:
// clicar em março passa a pedir 01/03 a 31/03, que cai sozinho no nível de dia.
//
// Datas em texto 'YYYY-MM-DD', que comparam cronologicamente com < e >. Sem
// objeto Date onde dá para evitar — fuso horário no meio de comparação de dia
// é fonte de erro que só aparece em produção.
//
// Sem imports: é chamado da página (servidor) e do teste.
// =============================================================================

const dd = (n) => String(n).padStart(2, '0');

export const iso = (ano, mes, dia) => `${ano}-${dd(mes)}-${dd(dia)}`;

// Dia 0 do mês seguinte é o último do mês pedido. Construído por partes, então
// não passa por fuso.
export const ultimoDiaDoMes = (ano, mes) => new Date(ano, mes, 0).getDate();

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const limpa = (v) => (typeof v === 'string' && ISO.test(v) ? v : null);

/**
 * Resolve o intervalo e o nível a partir do que veio na URL.
 *
 * Tudo é fechado dentro do ano escolhido: o seletor de ano é quem manda, e um
 * intervalo atravessando a virada faria a soma discordar do ano selecionado
 * logo ao lado.
 *
 * `mes` e `dia` continuam sendo lidos para não quebrar link antigo — eles são
 * traduzidos para intervalo e nunca mais aparecem.
 */
export function resolvePeriodo(params, ano) {
  const limDe = iso(ano, 1, 1);
  const limAte = iso(ano, 12, 31);

  let de = limpa(params?.de);
  let ate = limpa(params?.ate);

  if (!de && !ate) {
    const m = Number(params?.mes);
    if (Number.isInteger(m) && m >= 1 && m <= 12) {
      const d = Number(params?.dia);
      if (Number.isInteger(d) && d >= 1 && d <= ultimoDiaDoMes(ano, m)) {
        de = iso(ano, m, d);
        ate = de;
      } else {
        de = iso(ano, m, 1);
        ate = iso(ano, m, ultimoDiaDoMes(ano, m));
      }
    }
  }

  // Um lado só preenchido vale como "daqui em diante" ou "até aqui".
  de = de ?? limDe;
  ate = ate ?? limAte;
  if (de > ate) [de, ate] = [ate, de];
  if (de < limDe) de = limDe;
  if (ate > limAte) ate = limAte;

  const nivel = de === ate ? 'TURNO'
              : de.slice(0, 7) === ate.slice(0, 7) ? 'DIA'
              : 'MES';

  // O ano inteiro é o estado "sem recorte": a tela usa isso para saber se
  // mostra o botão de limpar e se a trilha tem degrau.
  const anoInteiro = de === limDe && ate === limAte;

  return { de, ate, nivel, anoInteiro };
}

// Os meses que o intervalo toca, com o pedaço de cada um que está dentro dele.
// Mês nas pontas costuma entrar cortado, e é de propósito: quem pediu 15/03 a
// 10/04 quer a soma daquilo, não do março inteiro.
export function mesesNoIntervalo(de, ate) {
  const ano = Number(de.slice(0, 4));
  const mesDe = Number(de.slice(5, 7));
  const mesAte = Number(ate.slice(5, 7));

  const saida = [];
  for (let m = mesDe; m <= mesAte; m++) {
    const ini = iso(ano, m, 1);
    const fim = iso(ano, m, ultimoDiaDoMes(ano, m));
    saida.push({
      ano,
      mes: m,
      de: ini < de ? de : ini,
      ate: fim > ate ? ate : fim,
      // Cortado quer dizer que a barra não representa o mês inteiro.
      parcial: ini < de || fim > ate,
    });
  }
  return saida;
}

// Todos os dias do intervalo, em ordem. Só é chamado no nível de dia, então o
// laço nunca passa de 31 voltas.
export function diasNoIntervalo(de, ate) {
  const ano = Number(de.slice(0, 4));
  const mes = Number(de.slice(5, 7));
  const saida = [];
  for (let d = Number(de.slice(8, 10)); d <= Number(ate.slice(8, 10)); d++) {
    saida.push(iso(ano, mes, d));
  }
  return saida;
}

// 0 = domingo, igual ao resto do projeto. Construído por partes para não
// passar por fuso: `new Date('2026-03-05')` seria interpretado como UTC e
// voltaria o dia anterior em qualquer fuso a oeste de Greenwich.
export function diaDaSemana(data) {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(a, m - 1, d).getDay();
}

// "01/03 a 10/04" — o rótulo do recorte na trilha.
export const rotuloPeriodo = (de, ate) =>
  (de === ate
    ? `${de.slice(8, 10)}/${de.slice(5, 7)}`
    : `${de.slice(8, 10)}/${de.slice(5, 7)} a ${ate.slice(8, 10)}/${ate.slice(5, 7)}`);
