// A GRADE DE CADASTRO QUE EXPLICA A BARRA.
//
// O painel responde "quanto cabe". Esta grade responde "com o quê": o OEE, a
// quantidade de recursos em cada turno e os minutos de parada, mês a mês, nas
// MESMAS colunas do gráfico. É a leitura que o slide da extração das
// configurações já oferecia desde 03/09 — "a barra de março caiu porque o OEE
// caiu ou porque perdeu um turno?" — e que só existia dentro de um .pptx.
//
// A ENTRADA É UMA CONSULTA SÓ, no grão mês × turno (`cadastroPorMes`), e tudo
// aqui sai dela por soma. Pedir cada linha da grade ao banco pagaria a mesma
// varredura de meio milhão de linhas várias vezes pela mesma tela.
//
// A REGRA QUE DECIDE NÚMERO MORA AQUI, e não na tela, porque é a mesma de
// `visualDoGrupo` em lib/documento.js e as duas têm que dizer o mesmo: o slide
// e o painel lidos lado a lado numa reunião são o pior lugar para descobrir
// que o OEE de junho tem dois valores.
//
// O que elas compartilham, e por quê:
//
//   OEE = disponível ÷ planejada, DIVISÃO DE SOMAS. Não é a faixa cadastrada:
//   ler o cadastro daria um segundo número para a mesma coisa, e ele poderia
//   dizer 78% embaixo de uma barra calculada com 75% — a rodada é de ontem, o
//   cadastro é de hoje, e a tela não teria como avisar. O que está aqui é o
//   OEE que o motor de fato aplicou.
//
//   TURNO NÃO TOTALIZA. Somar "6 recursos em janeiro" com "6 em fevereiro"
//   daria doze recursos numa fábrica que tem seis. É estado, não fluxo.
//
//   TODOS OS TURNOS DA PLANTA, e não só os que o recorte usa. Turno ausente da
//   lista é indistinguível de turno que não roda ali, e "o 3º turno não existe
//   nesta área" é resposta — resposta que só existe se a linha estiver lá para
//   dizê-la.

const num = (v) => Number(v ?? 0);

/** Zero vira vazio na tela, e `null` é como esta camada diz "vazio". */
const ouNada = (n) => (n > 0 ? n : null);

/**
 * As linhas de cadastro de um recorte.
 *
 * @param linhas          [{ mes, turno_id, codigo, turno, planejada,
 *                        disponivel, parada, qt }] — o grão mês × turno que
 *                        `cadastroPorMes` devolve.
 * @param meses           os números dos meses, NA ORDEM DAS COLUNAS do gráfico.
 *                        Vêm da tela, e não do banco: mês sem linha no fato
 *                        precisa de uma coluna vazia, senão a grade teria onze
 *                        colunas embaixo de um gráfico de doze e nada
 *                        denunciaria o deslocamento.
 * @param turnosDaPlanta  [{ id, codigo, nome }] — os turnos ativos das plantas
 *                        do recorte, para a linha vazia existir.
 * @param origem          META ou SIMULADO, só para o rótulo do OEE.
 */
export function gradeDeCadastro({
  linhas = [], meses = [], turnosDaPlanta = [], origem = 'META',
} = {}) {
  const cols = meses.map(Number);
  const doMes = (m) => linhas.filter((l) => Number(l.mes) === m);
  const somaDe = (ls, campo) => ls.reduce((s, l) => s + num(l[campo]), 0);

  // A UNIÃO, e não só os ativos: turno desativado continua carimbado nas
  // rodadas que já rodaram com ele. Ficar de fora da lista apagaria da grade
  // justamente a explicação de por que a planejada caiu no mês em que ele saiu.
  const porId = new Map();
  for (const t of turnosDaPlanta) {
    porId.set(Number(t.id), { id: Number(t.id), codigo: t.codigo, nome: t.nome });
  }
  for (const l of linhas) {
    const id = Number(l.turno_id);
    if (!porId.has(id)) {
      porId.set(id, { id, codigo: l.codigo, nome: l.turno });
    }
  }

  // Pela ordem do código — 1º, 2º, 3º, rodízio —, que é a ordem em que a
  // fábrica fala dos turnos. Por nome, "1º Turno" e "2º Turno" só casam com ela
  // por sorte.
  const lista = [...porId.values()].sort(
    (a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR'));

  const planejada = somaDe(linhas, 'planejada');
  const disponivel = somaDe(linhas, 'disponivel');

  const linhasDeTurno = lista.map((t) => ({
    chave: `turno-${t.id}`,
    // O código antes do nome: é por ele que a grade está ordenada, e um rótulo
    // que não mostra o critério da ordem parece desordenado.
    rotulo: t.nome ? `${t.codigo} · ${t.nome}` : String(t.codigo),
    tipo: 'qt',
    valores: cols.map((m) => ouNada(
      somaDe(doMes(m).filter((l) => Number(l.turno_id) === t.id), 'qt'))),
    total: null,
    // Travessão e não vazio na coluna do ano: célula em branco ali parece um
    // total que faltou calcular, e turno não se totaliza.
    semTotal: true,
  }));

  return {
    linhas: [
      {
        chave: 'oee',
        // Com a origem no rótulo: "OEE 75%" não diz se é a meta ou o simulado,
        // e são duas conversas diferentes na mesma reunião.
        rotulo: `OEE (${origem === 'META' ? 'meta' : 'simulado'})`,
        tipo: 'pct',
        // Nulo e não zero quando não houve planejada: "0%" faria parecer um mês
        // de rendimento nulo, quando não houve turno nenhum para render.
        valores: cols.map((m) => {
          const ls = doMes(m);
          const p = somaDe(ls, 'planejada');
          return p > 0 ? (somaDe(ls, 'disponivel') * 100) / p : null;
        }),
        total: planejada > 0 ? (disponivel * 100) / planejada : null,
      },
      ...linhasDeTurno,
      {
        chave: 'parada',
        // "(minutos)" FIXO, mesmo com o painel em metro ou hora: parada é tempo
        // em que a máquina não rodou, e "300 metros de parada" não quer dizer
        // nada. A unidade escrita é o que impede alguém de somar esta linha com
        // a de capacidade quando as duas estão em escalas diferentes.
        rotulo: 'Paradas (minutos)',
        tipo: 'min',
        valores: cols.map((m) => somaDe(doMes(m), 'parada')),
        total: somaDe(linhas, 'parada'),
      },
    ],
    // Para a tela saber se a grade tem o que explicar: sem turno nenhum, o
    // recorte não chegou a ser cadastrado.
    temTurno: linhasDeTurno.some((l) => l.valores.some((v) => v !== null)),
  };
}
