import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeDeCadastro } from './grade-cadastro.js';

// O grão que `cadastroPorMes` devolve: uma linha por mês e turno.
const linhas = [
  { mes: 1, turno_id: 1, codigo: '1', turno: '1º Turno',
    planejada: 600, disponivel: 480, parada: 120, qt: 6 },
  { mes: 1, turno_id: 3, codigo: '3', turno: '3º Turno',
    planejada: 400, disponivel: 320, parada: 0, qt: 4 },
  { mes: 2, turno_id: 1, codigo: '1', turno: '1º Turno',
    planejada: 500, disponivel: 250, parada: 0, qt: 6 },
];
const meses = [1, 2, 3];

const acha = (g, chave) => g.linhas.find((l) => l.chave === chave);

test('OEE e a soma do disponivel sobre a soma da planejada do mes', () => {
  const g = gradeDeCadastro({ linhas, meses });
  // Janeiro soma os dois turnos: 800 / 1.000 = 80%.
  assert.deepEqual(acha(g, 'oee').valores, [80, 50, null]);
});

test('o total do OEE e divisao de somas, nunca a media das colunas', () => {
  const g = gradeDeCadastro({ linhas, meses });
  // A média de 80 e 50 seria 65; a conta certa é 1.050 / 1.500 = 70%.
  assert.equal(acha(g, 'oee').total, 70);
});

test('mes sem planejada fica nulo, e nao zero', () => {
  // Zero diria "rendimento nulo"; o que houve foi mês sem turno nenhum. Março
  // não tem linha no fato e mesmo assim tem coluna — ela vem de `meses`.
  const g = gradeDeCadastro({ linhas, meses });
  assert.equal(acha(g, 'oee').valores[2], null);
  assert.equal(acha(g, 'oee').valores.length, 3);
});

test('sem linha nenhuma o OEE do periodo e nulo', () => {
  const g = gradeDeCadastro({ linhas: [], meses: [1] });
  assert.equal(acha(g, 'oee').total, null);
});

test('a parada soma os turnos e os meses', () => {
  const g = gradeDeCadastro({ linhas, meses });
  assert.deepEqual(acha(g, 'parada').valores, [120, 0, 0]);
  assert.equal(acha(g, 'parada').total, 120);
});

test('turno nao totaliza: somar os meses daria doze maquinas onde ha seis', () => {
  const g = gradeDeCadastro({ linhas, meses });
  const l = acha(g, 'turno-1');
  assert.equal(l.total, null);
  assert.equal(l.semTotal, true);
  assert.deepEqual(l.valores, [6, 6, null]);
});

test('as quantidades do mesmo turno somam entre os CTs do recorte', () => {
  const g = gradeDeCadastro({
    meses: [1],
    linhas: [
      { mes: 1, turno_id: 7, codigo: '1', turno: '1º', qt: 6 },
      { mes: 1, turno_id: 7, codigo: '1', turno: '1º', qt: 4 },
    ],
  });
  assert.deepEqual(acha(g, 'turno-7').valores, [10]);
});

test('turno que nao roda no mes fica vazio, e nao zero', () => {
  const g = gradeDeCadastro({ linhas, meses });
  // O 3º turno só aparece em janeiro — fevereiro e março ficam em branco, que
  // é o que se lê como "não roda".
  assert.deepEqual(acha(g, 'turno-3').valores, [4, null, null]);
});

test('turno cadastrado que nao roda no recorte aparece, vazio', () => {
  // É a resposta "o 5º turno não roda aqui", e ela só existe se a linha estiver
  // lá para dizê-la.
  const g = gradeDeCadastro({
    linhas: [], meses: [1],
    turnosDaPlanta: [{ id: 9, codigo: '5', nome: '5º Turno' }],
  });
  assert.deepEqual(acha(g, 'turno-9').valores, [null]);
  assert.equal(g.temTurno, false);
});

test('turno desativado que tem fato na rodada nao some da grade', () => {
  // Ele saiu da lista de ativos, mas continua carimbado na rodada — e é
  // justamente ele que explica a planejada do mês em que saiu.
  const g = gradeDeCadastro({
    meses: [1],
    linhas: [{ mes: 1, turno_id: 4, codigo: '2', turno: '2º Turno', qt: 3 }],
    turnosDaPlanta: [{ id: 9, codigo: '5', nome: '5º Turno' }],
  });
  assert.deepEqual(acha(g, 'turno-4').valores, [3]);
  assert.equal(g.temTurno, true);
});

test('a ordem e a do codigo, que e a ordem em que a fabrica fala dos turnos', () => {
  const g = gradeDeCadastro({
    linhas: [], meses: [1],
    turnosDaPlanta: [
      { id: 3, codigo: '3', nome: 'Terceiro' },
      { id: 1, codigo: '1', nome: 'Primeiro' },
      { id: 2, codigo: '2', nome: 'Segundo' },
    ],
  });
  assert.deepEqual(
    g.linhas.filter((l) => l.tipo === 'qt').map((l) => l.chave),
    ['turno-1', 'turno-2', 'turno-3']);
});

test('a ordem das colunas e a que a tela pediu, nao a do banco', () => {
  // O painel recorta de setembro a novembro; a grade tem que seguir isso.
  const g = gradeDeCadastro({ linhas, meses: [2, 1] });
  assert.deepEqual(acha(g, 'oee').valores, [50, 80]);
});

test('o rotulo do OEE diz de que cenario ele e', () => {
  assert.match(acha(gradeDeCadastro({ linhas, meses }), 'oee').rotulo, /meta/);
  assert.match(
    acha(gradeDeCadastro({ linhas, meses, origem: 'SIMULADO' }), 'oee').rotulo,
    /simulado/);
});

test('a parada fica sempre em minuto, dito no rotulo', () => {
  // O painel pode estar em hora ou em metro; "300 metros de parada" não quer
  // dizer nada, e sem a unidade escrita alguém soma esta linha com a de cima.
  assert.match(acha(gradeDeCadastro({ linhas, meses }), 'parada').rotulo,
               /minutos/);
});

test('sem meses nao sobra coluna nenhuma', () => {
  const g = gradeDeCadastro({});
  assert.deepEqual(acha(g, 'oee').valores, []);
  assert.equal(acha(g, 'parada').total, 0);
});
