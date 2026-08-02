import { sql } from './db';
import { planejar, vigenteEm } from './vigencia-plano';

// =============================================================================
// CAMADA DE VIGÊNCIA
//
// recurso_parametro, recurso_turno, recurso_oee, recurso_calendario e
// turno_horario usam daterange + exclude using gist. O banco recusa
// fisicamente duas linhas valendo ao mesmo tempo.
//
// É isso que garante que o número do passado nunca mude sozinho. Por isso
// NADA aqui faz update de valor: mudar um parâmetro é fechar a vigência atual
// na data nova e abrir outra linha. Um update no lugar reescreveria o
// histórico — um mês já fechado passaria a dar outro número no recálculo.
//
// Toda tela de cadastro passa por aqui. Se cada uma resolvesse vigência do seu
// jeito, seriam N chances de corromper o passado.
//
// O driver Neon HTTP não expõe sql.query(texto, params) — só tagged template.
// Então cada tabela declara suas próprias consultas abaixo. Sai mais verboso e
// entra de graça a garantia de que nome de tabela nunca vem de fora.
// =============================================================================

// Cada entrada espelha o exclude constraint da tabela em 01_schema.sql.
// A chave aqui tem que ser exatamente as colunas "with =" do constraint.
const TABELAS = {
  // th_sem_sobreposicao (turno_id, dia_semana, vigencia)
  turno_horario: {
    rotulo: 'horário',
    chave: ['turno_id', 'dia_semana'],
    linhas: (k) => sql`
      select id,
             lower(vigencia)::text as inicio,
             upper(vigencia)::text as fim
        from turno_horario
       where turno_id = ${k.turno_id} and dia_semana = ${k.dia_semana}
       order by lower(vigencia)`,
    fechar: (id, data) => sql`
      update turno_horario
         set vigencia = daterange(lower(vigencia), ${data}::date)
       where id = ${id}`,
    apagar: (id) => sql`delete from turno_horario where id = ${id}`,
    // min_bruto e cruza_meia_noite são preenchidos pelo trigger
    // fn_turno_horario_calcula. Mandar valor aqui seria duplicar a regra.
    inserir: (k, data, ate, v) => sql`
      insert into turno_horario
             (turno_id, dia_semana, hora_inicio, hora_fim, vigencia)
      values (${k.turno_id}, ${k.dia_semana},
              ${v.hora_inicio}, ${v.hora_fim},
              daterange(${data}::date, ${ate}::date))`,
  },

};

// recurso_turno não está aqui: a tela dele é uma matriz de meses que reescreve
// o ano inteiro de uma vez, não um fechar-e-abrir por data. Essa operação mora
// em definirTurnosDoAno(), em lib/cadastro.js.

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Datas voltam do banco como texto 'YYYY-MM-DD' (o ::text nas consultas acima),
// então comparar com < e > já é comparar cronologicamente. Sem Date, sem fuso.
function exigeData(valor, campo) {
  if (!DATA_ISO.test(String(valor ?? ''))) {
    throw new Error(`${campo} precisa ser uma data no formato AAAA-MM-DD.`);
  }
  return String(valor);
}

function tabelaDe(nome) {
  const t = TABELAS[nome];
  if (!t) throw new Error(`Tabela sem vigência registrada: ${nome}`);
  return t;
}


/**
 * Fecha a vigência que está valendo e abre uma nova de `aPartirDe` até `ate`.
 * `ate` null (o caso comum) = vigência aberta, vale até alguém encerrar.
 *
 * Nunca sobrescreve valor de linha que já valeu: o passado fica intacto e o
 * recálculo de qualquer data anterior continua dando o mesmo número.
 *
 * Exceção deliberada: se a linha atual começa exatamente em `aPartirDe`, ela é
 * substituída em vez de fechada. Não é reescrita de histórico — é a correção
 * de um cadastro que ainda não cobriu nenhum período diferente. Fechar nesse
 * caso geraria um intervalo vazio, que o daterange rejeitaria.
 */
export async function abrirVigencia(tabela, chave, aPartirDe, valores, ate = null) {
  const t = tabelaDe(tabela);
  const data = exigeData(aPartirDe, 'A data de início');
  const fim = ate ? exigeData(ate, 'A data de fim') : null;

  if (fim !== null && fim <= data) {
    throw new Error('A data de fim tem que ser posterior à de início.');
  }

  for (const col of t.chave) {
    if (chave[col] === undefined || chave[col] === null || chave[col] === '') {
      throw new Error(`Faltou ${col} para identificar o ${t.rotulo}.`);
    }
  }

  const linhas = await t.linhas(chave);

  // Uma linha começando depois da data nova viraria buraco ou sobreposição.
  // O exclude constraint barraria de qualquer jeito, mas com mensagem do
  // Postgres. Prefiro explicar o que está no caminho.
  const plano = planejar(linhas, data, t.rotulo, fim);
  if (plano.erro) throw new Error(plano.erro);

  const passos = [];
  if (plano.acao === 'substituir') passos.push(t.apagar(plano.alvo.id));
  else if (plano.acao === 'fechar') passos.push(t.fechar(plano.alvo.id, data));

  passos.push(t.inserir(chave, data, fim, valores));

  await sql.transaction(passos);

  return { fechou: plano.acao === 'fechar', substituiu: plano.acao === 'substituir' };
}

/**
 * Encerra a vigência corrente em `em` sem abrir outra — o registro deixa de
 * valer a partir dessa data e o histórico anterior continua consultável.
 * É o "excluir" das telas: apagar a linha sumiria com o passado.
 */
export async function encerrarVigencia(tabela, chave, em) {
  const t = tabelaDe(tabela);
  const data = exigeData(em, 'A data de encerramento');

  const linhas = await t.linhas(chave);
  const atual = vigenteEm(linhas, data);

  if (!atual) throw new Error(`Não há ${t.rotulo} valendo em ${data}.`);

  // Começou na própria data de encerramento: nunca chegou a valer, some.
  if (atual.inicio === data) await sql.transaction([t.apagar(atual.id)]);
  else await sql.transaction([t.fechar(atual.id, data)]);

  return { apagou: atual.inicio === data };
}
