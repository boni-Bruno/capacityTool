import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INFINITA, explicaInfinita, fmtOcupacao, ocupacaoDe, ocupacaoInfinita, razaoDe,
} from './ocupacao.js';

test('a ocupacao e demanda sobre capacidade, em porcentagem', () => {
  assert.equal(ocupacaoDe(50, 100), 50);
  assert.equal(ocupacaoDe(120, 100), 120);
  assert.equal(ocupacaoDe(0, 100), 0);
});

test('demanda sem capacidade nenhuma e infinita, e nao nada', () => {
  // Era o caso mais grave da tela saindo como travessão cinza: o plano pede de
  // um centro que não tem onde caber.
  assert.equal(ocupacaoDe(2653984, 0), INFINITA);
  assert.equal(ocupacaoInfinita(ocupacaoDe(10, 0)), true);
});

test('zero sobre zero continua sendo nada', () => {
  // 0% diria "folgado" sobre uma conta que não foi feita.
  assert.equal(ocupacaoDe(0, 0), null);
  assert.equal(ocupacaoDe(null, null), null);
});

test('o infinito nao depende da unidade, e um numero dependeria', () => {
  // Dividir por 1 daria demanda × 100: 265.398.400% em minutos e 4.423.307% nas
  // mesmas horas. A mesma situação com dois números é a armadilha que isto
  // existe para evitar.
  const emMinutos = ocupacaoDe(2653984, 0);
  const emHoras = ocupacaoDe(2653984 / 60, 0);
  assert.equal(emMinutos, emHoras);
});

test('a razao em fracao segue a mesma regra', () => {
  assert.equal(razaoDe(92, 100), 0.92);
  assert.equal(razaoDe(5, 0), INFINITA);
  assert.equal(razaoDe(0, 0), null);
  assert.equal(razaoDe(-3, 0), null);
});

test('o numero sai com virgula, como todo numero do projeto', () => {
  // "92.4%" ao lado de "3.793.659" é o milhar em português e o decimal em
  // inglês na mesma linha.
  assert.equal(fmtOcupacao(92.44), '92,4%');
  assert.equal(fmtOcupacao(100), '100,0%');
});

test('infinito sai como simbolo, e ausencia como travessao', () => {
  assert.equal(fmtOcupacao(INFINITA), '∞');
  assert.equal(fmtOcupacao(null), '—');
  assert.equal(fmtOcupacao(undefined), '—');
  assert.equal(fmtOcupacao(Number.NaN), '—');
});

test('a explicacao do infinito diz quanto se pede e o que conferir', () => {
  const t = explicaInfinita(2653984);
  assert.match(t, /2\.653\.984 min/);
  assert.match(t, /CC-CT/);
  assert.match(t, /recalculado/);
});
