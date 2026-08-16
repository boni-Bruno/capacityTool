// =============================================================================
// DO PARQUET PARA AS LINHAS DA CARGA
//
// A tradução entre o arquivo e o banco, e a conferência do que chegou. É a
// fronteira onde dado se corrompe em silêncio — coluna faltando, período num
// formato inesperado, data que não bate com o texto — então ela é pura e
// testada sem banco nenhum.
//
// Nada aqui adivinha. Arquivo que não tem o que precisa é recusado com o nome
// do que falta, porque uma carga recusada custa cinco minutos e uma carga lida
// errado custa um trimestre de número torto.
// =============================================================================

// As quinze colunas que a exportação produz. A ordem não importa; a presença
// sim.
export const COLUNAS = [
  'cenario', 'grupo_estoque', 'nivel_estoque', 'linha_produto_agrupada',
  'familia_produto', 'familia_tecelagem', 'tecido_base', 'um', 'ct',
  'periodo', 'periodo_data', 'producao_quantidade', 'producao_metros_kg',
  'duracao_minutos', 'data_extracao',
];

// Sem estas o arquivo não serve para nada. `cenario` e `data_extracao`
// identificam a carga; o resto é a linha.
const ESSENCIAIS = [
  'cenario', 'ct', 'um', 'periodo', 'periodo_data',
  'producao_quantidade', 'producao_metros_kg', 'duracao_minutos',
];

const PERIODO = /^\d{4}\.\d{2}$/;

/** Dia desde 1970-01-01 (o DATE do parquet) para 'AAAA-MM-DD'. */
export function dataDeDias(dias) {
  // Date.UTC e não `new Date(ms)` local: o mesmo número tem que dar o mesmo dia
  // em Blumenau e em qualquer outro fuso.
  return new Date(Date.UTC(1970, 0, 1 + Number(dias))).toISOString().slice(0, 10);
}

/** Microssegundos desde a época (o TIMESTAMP do parquet) para Date. */
export const dataDeMicros = (us) =>
  (Number.isFinite(Number(us)) ? new Date(Number(us) / 1000) : null);

const texto = (v) => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  // O xlsx antigo usava '-' como vazio. O parquet usa NULL, mas se um dia
  // voltar a vir assim, aqui é onde isso morre.
  return (t === '' || t === '-') ? null : t;
};

const numero = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : null;
};

export function conferirColunas(nomes) {
  const tem = new Set(nomes);
  return {
    faltando: ESSENCIAIS.filter((c) => !tem.has(c)),
    inesperadas: nomes.filter((c) => !COLUNAS.includes(c)),
  };
}

/**
 * Converte o parquet lido em linhas prontas para gravar, e num resumo do que
 * veio.
 *
 * `problemas` é a lista de coisas que impedem a carga. Vazia, a carga entra.
 * Não existe importação parcial: meia base é um mix errado em silêncio, que é
 * o pior desfecho possível numa ferramenta em que se confere na calculadora.
 */
export function montarCarga(lido) {
  const { colunas, nomes } = lido;
  const problemas = [];

  const { faltando, inesperadas } = conferirColunas(nomes ?? Object.keys(colunas));
  if (faltando.length) {
    problemas.push(`Faltam colunas no arquivo: ${faltando.join(', ')}.`);
    return { problemas, linhas: [], resumo: null };
  }

  const n = colunas.periodo.length;
  const linhas = new Array(n);

  const resumo = {
    total: n,
    semCt: 0,
    zeradas: 0,
    semTempoComQtd: 0,
    minutos: 0,
    cts: new Map(),        // ct -> minutos
    periodos: new Map(),   // 'AAAA.MM' -> minutos
    cenarios: new Set(),
    inesperadas,
  };

  let periodoRuim = 0;
  let dataDivergente = 0;
  let numeroRuim = 0;

  for (let i = 0; i < n; i++) {
    const periodo = texto(colunas.periodo[i]);
    if (!periodo || !PERIODO.test(periodo)) { periodoRuim++; continue; }

    const data = dataDeDias(colunas.periodo_data[i]);
    // O texto e a data têm que contar a mesma história. Se a origem um dia
    // deixar de ser tipada, `2026.10` vira `2026.1` e colide com janeiro —
    // esta conferência é o que pega isso na entrada.
    if (`${data.slice(0, 4)}.${data.slice(5, 7)}` !== periodo) { dataDivergente++; }

    const qtd = numero(colunas.producao_quantidade[i]);
    const mk = numero(colunas.producao_metros_kg[i]);
    const dur = numero(colunas.duracao_minutos[i]);
    if (qtd === null || mk === null || dur === null) { numeroRuim++; continue; }

    const ct = texto(colunas.ct[i]);

    linhas[i] = {
      grupo_estoque: texto(colunas.grupo_estoque?.[i]),
      nivel_estoque: texto(colunas.nivel_estoque?.[i]),
      linha_produto_agrupada: texto(colunas.linha_produto_agrupada?.[i]),
      familia_produto: texto(colunas.familia_produto?.[i]),
      familia_tecelagem: texto(colunas.familia_tecelagem?.[i]),
      tecido_base: texto(colunas.tecido_base?.[i]),
      um: texto(colunas.um[i]),
      ct,
      periodo,
      periodo_data: data,
      qtd,
      qtd_metros_kg: mk,
      duracao_min: dur,
    };

    if (!ct) resumo.semCt++;
    if (!qtd && !mk && !dur) resumo.zeradas++;
    if (!dur && (qtd || mk)) resumo.semTempoComQtd++;
    resumo.minutos += dur;
    if (ct && dur) resumo.cts.set(ct, (resumo.cts.get(ct) ?? 0) + dur);
    resumo.periodos.set(periodo, (resumo.periodos.get(periodo) ?? 0) + dur);
    const cen = texto(colunas.cenario[i]);
    if (cen) resumo.cenarios.add(cen);
  }

  if (periodoRuim) {
    problemas.push(
      `${periodoRuim} linha(s) com período fora do formato AAAA.MM. `
      + 'A importação não tenta adivinhar o mês.');
  }
  if (dataDivergente) {
    problemas.push(
      `${dataDivergente} linha(s) em que o período em texto e a data não `
      + 'contam a mesma história. O arquivo está inconsistente na origem.');
  }
  if (numeroRuim) {
    problemas.push(`${numeroRuim} linha(s) com quantidade ou duração ilegível.`);
  }
  if (!resumo.cenarios.size) {
    problemas.push('Nenhum cenário informado — a carga ficaria sem identidade.');
  }
  if (resumo.cenarios.size > 1) {
    problemas.push(
      `O arquivo mistura ${resumo.cenarios.size} cenários `
      + `(${[...resumo.cenarios].join(', ')}). Uma carga é um cenário.`);
  }

  return {
    problemas,
    linhas: problemas.length ? [] : linhas,
    resumo: problemas.length ? null : resumo,
  };
}
