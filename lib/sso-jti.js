import { sql } from './db';

// Uso unico do token de SSO.
//
// A tabela mora AQUI, e nao no portal, de proposito: um callback
// ferramenta -> portal custaria um round-trip extra dentro do login E faria o
// portal fora do ar impedir a entrada aqui. Este insert resolve a mesma coisa no
// banco que esta ferramenta ja tem aberto.
//
// Chave primaria mais o do nothing e o que torna a corrida segura: duas
// requisicoes simultaneas com o mesmo jti, so uma volta com linha.

export async function queimaJti(jti, exp) {
  const [gravado] = await sql.transaction([
    sql`
      insert into sso_jti (jti, expira_em)
      values (${jti}, to_timestamp(${exp}))
      on conflict (jti) do nothing
      returning jti
    `,
    // A faxina vai no mesmo pacote porque este projeto nao tem cron, e tabela de
    // token sem faxina cresce para sempre. Uma hora de folga sobre a validade de
    // 90 s cobre qualquer desencontro de relogio.
    sql`delete from sso_jti where expira_em < now() - interval '1 hour'`,
  ]);

  return gravado.length > 0;
}
