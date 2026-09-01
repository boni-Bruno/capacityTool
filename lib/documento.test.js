import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agrupa, ocupacao, rotuloIntervalo, secoesDoGrupo, tituloDoGrupo,
  visualDoGrupo,
} from './documento.js';

// O documento é apresentado. Um número errado aqui não dá erro nenhum: sai um
// slide bonito com a conta trocada, e a conferência acontece na reunião.

const ct = (o) => ({
  ct: '278-001', planta: 'Matriz', area: 'Confecção', cc: '278',
  recursos: 'TEXPA 1', qtd_recursos: 1, postos: 2, maquinas: 1, pessoas: 0,
  turno_ids: [1, 2], calendario_ids: [7], faixas_oee: 12, paradas: 3,
  instalada: 1000, planejada: 800, disponivel: 600, demanda: 300,
  ...o,
});

const BASE = [
  ct({}),
  ct({ ct: '278-002', recursos: 'TEXPA 2', turno_ids: [2, 3], disponivel: 400,
       demanda: 500 }),
  ct({ ct: '401-009', cc: '401', recursos: 'CORTE', turno_ids: [1],
       calendario_ids: [7, 8], disponivel: 1000, demanda: 100 }),
];

// --- agrupar ---------------------------------------------------------------

test('um slide por CT devolve uma linha por CT, na ordem que veio', () => {
  const g = agrupa(BASE, 'CT');
  assert.deepEqual(g.map((x) => x.ct), ['278-001', '278-002', '401-009']);
});

test('um slide por CC junta os CTs do centro de custo', () => {
  const g = agrupa(BASE, 'CC');
  assert.equal(g.length, 2);
  assert.equal(g[0].cc, '278');
  assert.equal(g[0].cts, 2);
  assert.equal(g[0].disponivel, 1000);
  assert.equal(g[0].demanda, 800);
});

test('o resumo é um grupo só, com o recorte inteiro', () => {
  const g = agrupa(BASE, 'RESUMO');
  assert.equal(g.length, 1);
  assert.equal(g[0].cts, 3);
  assert.equal(g[0].ccs, 2);
  assert.equal(g[0].disponivel, 2000);
});

test('turnos são união de conjunto, e nunca soma de contagens', () => {
  // Dois CTs no mesmo turno somariam 2+2 e 1 = cinco turnos numa fábrica que
  // tem três. Quem lê o slide acha que a fábrica roda o dobro do que roda.
  const g = agrupa(BASE, 'RESUMO');
  assert.equal(g[0].turnos, 3);
  assert.equal(g[0].calendarios, 2);
  // No CC de dois CTs, o turno 2 é compartilhado: 1, 2 e 3.
  assert.equal(agrupa(BASE, 'CC')[0].turnos, 3);
});

test('faixas de OEE e paradas somam, porque são de cada recurso', () => {
  const g = agrupa(BASE, 'RESUMO');
  assert.equal(g[0].faixas_oee, 36);
  assert.equal(g[0].paradas, 9);
});

test('grupo que atravessa duas plantas mostra as duas', () => {
  // Legenda com só a primeira seria uma frase errada num slide apresentado.
  const g = agrupa([ct({}), ct({ ct: '900-001', planta: 'Filial' })], 'RESUMO');
  assert.equal(g[0].planta, 'Matriz · Filial');
});

test('recorte vazio não vira um slide em branco', () => {
  assert.deepEqual(agrupa([], 'CT'), []);
  assert.deepEqual(agrupa(null, 'RESUMO'), []);
});

// --- a ocupação ------------------------------------------------------------

test('a ocupação do grupo é soma sobre soma, e não média de ocupações', () => {
  // Média das ocupações daria (50 + 125) / 2 = 87,5%, que trata um CT que roda
  // muito e um que quase não roda como se pesassem o mesmo.
  const g = agrupa(BASE, 'CC')[0];
  assert.equal(ocupacao(g.demanda, g.disponivel), 80);
});

test('capacidade zero dá ocupação nula, e não zero por cento', () => {
  // 0% diria "sobra tudo" para um CT que não tem nada onde caber.
  assert.equal(ocupacao(500, 0), null);
});

// --- o texto ---------------------------------------------------------------

test('o título do CT leva o nome do recurso, que é como as pessoas o chamam', () => {
  assert.equal(tituloDoGrupo(agrupa(BASE, 'CT')[0]), 'CT 278-001 · TEXPA 1');
  assert.equal(tituloDoGrupo(agrupa(BASE, 'CC')[0]), 'CC 278 · Confecção');
  assert.equal(tituloDoGrupo(agrupa(BASE, 'RESUMO')[0]), 'Recorte completo');
});

test('a capacidade sai só na medida escolhida', () => {
  const s = secoesDoGrupo(agrupa(BASE, 'CT')[0],
    { de: '2026-01-01', ate: '2026-12-31', medida: 'planejada' });
  const texto = s.map((x) => x.linhas.join(' ')).join(' ');
  assert.ok(texto.includes('Planejada: 800 min'));
  assert.ok(!texto.includes('Disponível'));
  assert.ok(!texto.includes('Instalada'));
});

test('sem cenário escolhido, demanda e ocupação não aparecem', () => {
  // Uma linha "0 min" onde ninguém pediu demanda pareceria fábrica sem pedido.
  const s = secoesDoGrupo(agrupa(BASE, 'CT')[0],
    { de: '2026-01-01', ate: '2026-12-31' });
  const texto = JSON.stringify(s);
  assert.ok(!texto.includes('Demanda'));
  assert.ok(!texto.includes('Ocupação'));
});

test('com cenário, a ocupação vem ao lado da demanda', () => {
  const s = secoesDoGrupo(agrupa(BASE, 'CT')[0],
    { de: '2026-01-01', ate: '2026-12-31', cenario: 'S&OP maio' });
  const texto = s.map((x) => x.linhas.join(' ')).join(' ');
  assert.ok(texto.includes('Demanda S&OP maio: 300 min'));
  assert.ok(texto.includes('Ocupação: 50,0%'));
});

test('sem rodada, o slide diz isso em vez de mostrar zero', () => {
  // "0 min" faria alguém apresentar uma fábrica parada que na verdade só não
  // foi calculada.
  const g = agrupa([ct({ disponivel: 0 })], 'CT')[0];
  const texto = JSON.stringify(secoesDoGrupo(g, {
    de: '2026-01-01', ate: '2026-12-31',
  }));
  assert.ok(texto.includes('Recalcular tudo'));
  assert.ok(!texto.includes('0 min'));
});

// --- o visual e o totalizador ----------------------------------------------

const mes = (m, o) => ({
  ct: '278-001', planta: 'Matriz', area: 'Confecção', cc: '278', mes: m,
  planejada: 1000, disponivel: 750, demanda: 600, ...o,
});

const SERIE = [
  mes(1, {}),
  // Dezembro roda menos e rende pior: é o mês que separa a média ponderada da
  // média simples.
  mes(2, { planejada: 200, disponivel: 100, demanda: 150 }),
];

const TURNOS = [
  { ct: '278-001', planta: 'Matriz', area: 'Confecção', cc: '278',
    turno_id: 1, turno: '1º turno', mes: 1, qt: 6 },
  { ct: '278-001', planta: 'Matriz', area: 'Confecção', cc: '278',
    turno_id: 1, turno: '1º turno', mes: 2, qt: 6 },
];

// Os três turnos da planta. O recorte só usa o primeiro — os outros dois
// existem para o slide poder dizer que não rodam aqui.
const CADASTRADOS = [
  { id: 1, nome: '1º turno' },
  { id: 2, nome: '2º turno' },
  { id: 3, nome: '3º turno' },
];

const visual = (extra = {}) => visualDoGrupo({
  grupo: agrupa([ct({})], 'CT')[0], granularidade: 'CT',
  serie: SERIE, turnos: TURNOS, medida: 'disponivel', cenario: 'S&OP',
  de: '2026-01-01', ate: '2026-02-28', ...extra,
});

const linha = (v, rot) => v.linhas.find((l) => l.rotulo === rot);

test('capacidade e demanda totalizam somando', () => {
  const v = visual();
  assert.equal(v.total.capacidade, 850);
  assert.equal(v.total.demanda, 750);
  assert.equal(linha(v, 'Capacidade').total, '850');
  assert.equal(linha(v, 'Demanda').total, '750');
});

test('OEE e ocupação do ano são divisão de somas, e não média das colunas', () => {
  // Média simples do OEE daria (75 + 50) / 2 = 62,5%, dando o mesmo peso a um
  // mês cheio e a um de recesso — e o total deixaria de bater com a divisão que
  // a própria linha de capacidade mostra.
  const v = visual();
  assert.equal(linha(v, 'OEE').total, '70,8%');          // 850 / 1200
  assert.equal(linha(v, 'Ocupação').total, '88,2%');     // 750 / 850
  const mediaSimples = (75 + 50) / 2;
  assert.notEqual(Number(v.total.oee.toFixed(1)), mediaSimples);
});

test('turno não totaliza: é estado, não fluxo', () => {
  // Somar "6 recursos em janeiro" com "6 em fevereiro" daria doze numa fábrica
  // que tem seis.
  assert.equal(linha(visual(), '1º turno').total, '');
});

test('a ordem é a da leitura: o gráfico primeiro, a explicação depois', () => {
  assert.deepEqual(visual().linhas.map((l) => l.rotulo),
    ['', 'Capacidade', 'Demanda', 'Ocupação', 'OEE', '1º turno', 'Paradas']);
});

test('sem cenário não há linha de demanda nem de ocupação', () => {
  assert.deepEqual(visual({ cenario: null }).linhas.map((l) => l.rotulo),
    ['', 'Capacidade', 'OEE', '1º turno', 'Paradas']);
});

test('os minutos de parada saem do que o motor descontou', () => {
  // E não de uma soma da tabela `parada`: parada vale por turno, o intervalo
  // dela pode cair fora do calendário do recurso, e "dia inteiro" não é uma
  // quantidade de minutos. O slide mostraria um desconto que a barra não teve.
  const v = visualDoGrupo({
    grupo: agrupa([ct({})], 'CT')[0], granularidade: 'CT',
    serie: [mes(1, { parada: 480 }), mes(2, { parada: 120 })],
    turnos: [], medida: 'disponivel',
  });
  const l = linha(v, 'Paradas');
  assert.deepEqual(l.valores, ['480', '120']);
  assert.equal(l.total, '600');
});

test('todos os turnos cadastrados aparecem, e o que não roda diz N/A', () => {
  // Turno ausente da lista é indistinguível de turno zerado — e "o terceiro não
  // roda aqui" é resposta, que só existe se a linha estiver lá para dizê-la.
  const v = visual({ turnosCadastrados: CADASTRADOS });
  assert.deepEqual(v.linhas.slice(-4, -1).map((l) => l.rotulo),
    ['1º turno', '2º turno', '3º turno']);
  assert.deepEqual(linha(v, '1º turno').valores, ['6', '6']);
  assert.deepEqual(linha(v, '3º turno').valores, ['N/A', 'N/A']);
});

test('sem a lista de turnos, cai no que o recorte tem', () => {
  // Rede para quem chamar a função sem passar os cadastrados.
  const v = visual();
  assert.deepEqual(v.linhas.slice(-2, -1).map((l) => l.rotulo), ['1º turno']);
});

test('o grupo separa o que é conta do que é cadastro', () => {
  // Sem a separação, OEE e turno parecem saída do motor, e quem lê não sabe o
  // que pode mudar para o número mudar.
  const g = (rot) => linha(visual({ turnosCadastrados: CADASTRADOS }), rot).grupo;
  for (const r of ['Capacidade', 'Demanda', 'Ocupação']) {
    assert.equal(g(r), 'cálculo', `${r} é resultado`);
  }
  for (const r of ['OEE', '1º turno', 'Paradas']) {
    assert.equal(g(r), 'cadastros', `${r} é premissa`);
  }
  // O cabeçalho dos meses não é nem um nem outro: ele nomeia as colunas.
  assert.equal(visual().linhas[0].grupo, undefined);
});

test('o total só se chama "Ano" quando são doze meses', () => {
  // "Ano" sobre março a junho seria uma legenda mentindo num documento
  // apresentado.
  assert.equal(visual().linhas[0].total, 'Total');
  const ano = visualDoGrupo({
    grupo: agrupa([ct({})], 'CT')[0], granularidade: 'CT',
    serie: Array.from({ length: 12 }, (_, i) => mes(i + 1, {})),
    turnos: [], medida: 'disponivel', cenario: 'S&OP',
  });
  assert.equal(ano.linhas[0].total, 'Ano');
});

test('mês sem planejada dá OEE nulo, e não zero por cento', () => {
  // "0%" faria parecer um mês de rendimento nulo, quando não houve turno.
  const v = visualDoGrupo({
    grupo: agrupa([ct({})], 'CT')[0], granularidade: 'CT',
    serie: [mes(1, { planejada: 0, disponivel: 0, demanda: 0 })],
    turnos: [], medida: 'disponivel',
  });
  assert.equal(v.pontos[0].oee, null);
  assert.equal(linha(v, 'OEE').valores[0], '—');
});

test('o período por extenso diz "ano" quando é o ano inteiro', () => {
  assert.equal(rotuloIntervalo('2026-01-01', '2026-12-31'), 'ano de 2026');
  assert.equal(rotuloIntervalo('2026-03-01', '2026-06-30'),
               '01/03 a 30/06 de 2026');
  assert.equal(rotuloIntervalo('2026-03-05', '2026-03-05'), '05/03 de 2026');
});
