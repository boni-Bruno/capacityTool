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
