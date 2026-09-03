import { sql } from './db';
import { recomporFaixasComValor } from './faixas';
import { ORIGENS } from './origens';

// OEE por recurso e mês.
//
// A tela trabalha no nível do recurso (turno_id null). O schema permite OEE
// específico de turno e o motor prefere ele quando existe, mas isso ainda não
// tem tela — quem precisar cadastra no banco.

export { ORIGENS } from './origens';

/**
 * Aceita "85", "85,5", "0,85" ou "85%".
 *
 * Acima de 1 é lido como porcentagem, de 0 a 1 como fração — então "1" é 100%,
 * não 1%. Guardado com 5 casas, que é a precisão da coluna, para o texto poder
 * ser comparado direto na hora de colar faixas vizinhas.
 */
export function fracaoOee(entrada) {
  const t = String(entrada ?? '').trim().replace('%', '').replace(',', '.');
  if (!t) return null;

  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`OEE inválido: "${entrada}".`);
  if (n < 0) throw new Error('OEE não pode ser negativo.');

  const f = n > 1 ? n / 100 : n;
  if (f > 1) throw new Error(`OEE não pode passar de 100% — recebi "${entrada}".`);
  return f.toFixed(5);
}

export async function faixasOee(recursoId, origem) {
  return sql`
    select lower(vigencia)::text as inicio,
           upper(vigencia)::text as fim,
           oee_pct::text         as valor
      from recurso_oee
     where recurso_id = ${Number(recursoId)}
       and origem     = ${origem}
       and turno_id is null
     order by lower(vigencia)`;
}

// Quais origens têm OEE cadastrado no ano. Serve para a tela dizer que o
// SIMULADO está vazio antes de alguém rodar um cálculo com ele e receber
// disponível igual à planejada — o motor usa 100% quando não acha OEE.
export async function origensDoAno(recursoId, ano) {
  return sql`
    select origem, count(*) as faixas
      from recurso_oee
     where recurso_id = ${Number(recursoId)}
       and turno_id is null
       and vigencia && daterange(make_date(${ano}, 1, 1),
                                 make_date(${ano} + 1, 1, 1))
     group by origem
     order by origem`;
}

export async function definirOeeDoAno(recursoId, ano, origem, porMes) {
  const r = Number(recursoId);
  if (!ORIGENS.includes(origem)) throw new Error('Origem inválida.');

  const normalizado = {};
  for (let mes = 1; mes <= 12; mes++) {
    const v = fracaoOee(porMes?.[mes] ?? porMes?.[String(mes)]);
    if (v !== null) normalizado[mes] = v;
  }

  const existentes = (await faixasOee(r, origem)).map((f) => ({
    inicio: f.inicio,
    fim: f.fim,
    valor: Number(f.valor).toFixed(5),
  }));

  const novas = recomporFaixasComValor(existentes, ano, normalizado);

  const passos = [
    sql`delete from recurso_oee
         where recurso_id = ${r} and origem = ${origem} and turno_id is null`,
  ];
  for (const f of novas) {
    passos.push(sql`
      insert into recurso_oee (recurso_id, origem, vigencia, oee_pct)
      values (${r}, ${origem},
              daterange(${f.inicio}::date, ${f.fim}::date),
              ${f.valor}::numeric)`);
  }

  await sql.transaction(passos);
  return { faixas: novas.length };
}

/**
 * O mesmo OEE em vários recursos de uma vez.
 *
 * O caso é o CC: "78% em janeiro para os nove CTs do 278". Cadastrar um a um
 * são nove idas à mesma tela para digitar o mesmo número, e é assim que um
 * deles fica de fora sem ninguém notar.
 *
 * MESCLA, NÃO SUBSTITUI — e é a diferença que importa. `definirOeeDoAno`
 * reescreve o ano inteiro, então mandar só janeiro por ali apagaria de
 * fevereiro a dezembro de todos os nove. Aqui os meses em branco são silêncio,
 * não ordem de apagar: cada recurso tem o ano lido, o que foi digitado entra
 * por cima, e o resto fica como estava.
 *
 * Um recurso por vez, em série. São dezenas, não milhares, e o driver do Neon
 * é uma requisição por instrução — disparar tudo junto só trocaria a espera
 * por contenção no banco.
 */
export async function aplicarOeeEmLote(recursoIds, ano, origem, porMes) {
  if (!ORIGENS.includes(origem)) throw new Error('Origem inválida.');

  const ids = [...new Set((recursoIds ?? []).map(Number))]
    .filter((x) => Number.isInteger(x) && x > 0);
  if (!ids.length) throw new Error('Escolha ao menos um recurso.');

  // Validar ANTES de tocar em qualquer recurso: um OEE inválido no meio do lote
  // deixaria metade aplicada e metade não.
  const aplicar = {};
  for (let mes = 1; mes <= 12; mes += 1) {
    const v = fracaoOee(porMes?.[mes] ?? porMes?.[String(mes)]);
    if (v !== null) aplicar[mes] = v;
  }
  if (!Object.keys(aplicar).length) {
    throw new Error('Nenhum mês preenchido — não há o que aplicar.');
  }

  // O ANO É REESCRITO, e não mesclado com o que cada recurso tinha. Antes o
  // lote fazia { ...atuais, ...aplicar }: mês em branco era silêncio, e o
  // cadastro de cada recurso sobrevivia. Era uma segunda regra para o mesmo
  // branco — o editor de um recurso sempre reescreveu o ano, e o lote de Turnos
  // também —, e três telas com duas leituras do mesmo campo em branco é uma a
  // mais do que dá para lembrar na hora de clicar.
  //
  // Em troca, o lote passou a poder LIMPAR um mês em massa, coisa que antes só
  // dava recurso a recurso. E a tela avisa em letra grande antes de abrir.
  let faixas = 0;
  for (const id of ids) {
    const r = await definirOeeDoAno(id, ano, origem, aplicar);
    faixas += r.faixas;
  }
  return { recursos: ids.length, meses: Object.keys(aplicar).length, faixas };
}
