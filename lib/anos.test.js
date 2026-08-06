import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anoEscolhido, anosParaEscolha } from './anos.js';

const em = (ano) => new Date(`${ano}-08-05T12:00:00Z`);

test('sem rodada nenhuma, oferece a janela em volta de hoje', () => {
  assert.deepEqual(anosParaEscolha([], em(2026)), [2025, 2026, 2027, 2028]);
});

test('ano com rodada não some da lista quando o tempo passa', () => {
  // Era o buraco: em 2028 a lista antiga ia de 2027 a 2029 e 2026 sumia,
  // com a rodada dele intacta no banco e sem caminho na tela.
  assert.deepEqual(
    anosParaEscolha([2026, 2027], em(2028)),
    [2026, 2027, 2028, 2029, 2030],
  );
});

test('rodada repetida ou em texto não duplica nem desordena', () => {
  assert.deepEqual(
    anosParaEscolha(['2026', 2026, '2024'], em(2026)),
    [2024, 2025, 2026, 2027, 2028],
  );
});

test('lixo na lista de rodadas é ignorado', () => {
  assert.deepEqual(
    anosParaEscolha([null, undefined, 'abc', 2030], em(2026)),
    [2025, 2026, 2027, 2028, 2030],
  );
});

test('ano da URL só vale se estiver na lista', () => {
  const anos = anosParaEscolha([], em(2026));
  assert.equal(anoEscolhido('2027', anos, em(2026)), 2027);
  assert.equal(anoEscolhido('2099', anos, em(2026)), 2026);
  assert.equal(anoEscolhido(undefined, anos, em(2026)), 2026);
  assert.equal(anoEscolhido('banana', anos, em(2026)), 2026);
});
