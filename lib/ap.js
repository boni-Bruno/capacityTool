// =============================================================================
// A QUANTIDADE DE RECURSO DO AP
//
// O AP conta quantos recursos existem em cada centro de trabalho, e a extração
// precisa disso para dividir a capacidade e entregar o número POR RECURSO — que
// é como o outro sistema raciocina.
//
// O ARQUIVO TEM DOIS CAMPOS PARA A MESMA IDEIA: `QTMAQUINA` quando o centro é
// de máquina e `QTPESSOAS` quando é de gente. Quem decide qual vale é
// `INDICADORCALCULOCAPACIDADE` — 'M' ou 'P'. Aqui os dois viram UM campo só,
// porque para dividir a capacidade tanto faz se o recurso tem motor: o que
// importa é por quantos o tempo se reparte.
//
// O indicador em branco é o terceiro caso, e ele é maioria do que não conta:
// facção, agregado, serviço externo. Não tem máquina nem gente porque o AP não
// calcula capacidade ali. Fica com quantidade zero, e a extração deixa a coluna
// vazia em vez de dividir por zero.
//
// PURO E SEM BANCO, como lib/demanda-formato.js: é a fronteira onde dado se
// corrompe em silêncio, e ela se testa sem infraestrutura nenhuma.
// =============================================================================

// As colunas que a exportação do AP traz. Só as quatro primeiras são
// indispensáveis — o resto do arquivo é sobre eficiência e custo, que o
// capacity tool calcula por conta própria.
export const COLUNAS_AP = [
  'CENTROTRABALHO', 'INDICADORCALCULOCAPACIDADE', 'QTMAQUINA', 'QTPESSOAS',
];

const texto = (v) => {
  const t = String(v ?? '').trim();
  return t === '' ? null : t;
};

const inteiro = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

export function conferirColunasAp(nomes) {
  const tem = new Set(nomes ?? []);
  return COLUNAS_AP.filter((c) => !tem.has(c));
}

/**
 * A quantidade que vale para um centro de trabalho.
 *
 * O indicador manda. Um centro de pessoas com QTMAQUINA preenchido existe no
 * arquivo, e ler o campo errado ali daria um divisor plausível e errado — o
 * pior tipo, porque o resultado continua parecendo um número.
 */
export function quantidadeDo(linha) {
  const ind = texto(linha?.INDICADORCALCULOCAPACIDADE);
  if (ind === 'P') return inteiro(linha?.QTPESSOAS);
  if (ind === 'M') return inteiro(linha?.QTMAQUINA);
  return 0;
}

/**
 * Do arquivo para as linhas da tabela, condensado por centro de trabalho.
 *
 * O ARQUIVO REPETE CT. Um mesmo centro aparece em várias linhas quando ele tem
 * várias sequências de roteiro — 513-197 vem vinte vezes. As repetições
 * concordam na quantidade, e é isso que torna o condensamento seguro; quando
 * discordarem, a divergência vira problema e a carga para, porque escolher uma
 * delas em silêncio é decidir por conta própria qual capacidade o AP vai
 * receber.
 */
export function montarRecursosAp(linhas) {
  const problemas = [];
  const porCt = new Map();

  for (const [i, l] of (linhas ?? []).entries()) {
    const ct = texto(l.CENTROTRABALHO);
    if (!ct) {
      problemas.push(`Linha ${i + 1}: centro de trabalho vazio.`);
      continue;
    }
    const qtd = quantidadeDo(l);
    const ind = texto(l.INDICADORCALCULOCAPACIDADE) ?? '';

    const anterior = porCt.get(ct);
    if (!anterior) {
      porCt.set(ct, { ct, qtd, indicador: ind, descricao: texto(l.DESCRCENTROTRABALHO) });
    } else if (anterior.qtd !== qtd) {
      problemas.push(
        `${ct}: o arquivo traz quantidades diferentes para o mesmo centro `
        + `(${anterior.qtd} e ${qtd}). Corrija na origem — escolher uma delas `
        + 'aqui seria decidir por conta própria qual capacidade o AP recebe.');
    }
  }

  const itens = [...porCt.values()].sort((a, b) => a.ct.localeCompare(b.ct));
  const comQtd = itens.filter((x) => x.qtd > 0);

  return {
    problemas,
    itens,
    resumo: {
      linhas: (linhas ?? []).length,
      centros: itens.length,
      com_quantidade: comQtd.length,
      sem_quantidade: itens.length - comQtd.length,
      maquina: itens.filter((x) => x.indicador === 'M').length,
      pessoa: itens.filter((x) => x.indicador === 'P').length,
      total_recursos: comQtd.reduce((s, x) => s + x.qtd, 0),
    },
  };
}
