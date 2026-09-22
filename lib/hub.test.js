import { test } from 'node:test';
import assert from 'node:assert/strict';

import { enderecoDoHub, destinoLimpo, entradaLocalLigada } from './hub.js';

const comAmbiente = (vars, fn) => {
  const antes = { ...process.env };
  Object.assign(process.env, vars);
  try { fn(); } finally {
    for (const k of Object.keys(vars)) delete process.env[k];
    Object.assign(process.env, antes);
  }
};

test('sem HUB_URL, nao ha para onde mandar', () => {
  // Fail-safe, ao contrario do resto: sem a variavel, quem chama cai para a
  // porta local. Se isto devolvesse uma URL invalida, um deploy sem a variavel
  // deixaria o app inacessivel e sem como entrar para arrumar.
  comAmbiente({ HUB_URL: '' }, () => assert.equal(enderecoDoHub('/painel'), null));
  comAmbiente({ HUB_URL: 'nao-e-url' }, () => assert.equal(enderecoDoHub('/painel'), null));
  comAmbiente({ HUB_URL: 'http://hub-snop.vercel.app' }, () => {
    assert.equal(enderecoDoHub('/painel'), null, 'http nao serve: o token viaja nessa conexao');
  });
});

test('o endereco leva a ferramenta certa e carrega o destino', () => {
  comAmbiente({ HUB_URL: 'https://hub-snop.vercel.app' }, () => {
    assert.equal(
      enderecoDoHub('/painel'),
      'https://hub-snop.vercel.app/ir/capacidade?dest=%2Fpainel',
    );
    assert.equal(
      enderecoDoHub('/painel?ano=2026&area=3'),
      'https://hub-snop.vercel.app/ir/capacidade?dest=%2Fpainel%3Fano%3D2026%26area%3D3',
    );
    // Barra no fim da variavel nao pode virar // no caminho.
    assert.equal(enderecoDoHub('/'), 'https://hub-snop.vercel.app/ir/capacidade');
  });
  comAmbiente({ HUB_URL: 'https://hub-snop.vercel.app/' }, () => {
    assert.equal(enderecoDoHub('/'), 'https://hub-snop.vercel.app/ir/capacidade');
  });
});

test('destino guarda caminho interno e descarta o resto', () => {
  assert.equal(destinoLimpo('/painel'), '/painel');
  assert.equal(destinoLimpo('/cadastros/oee?a=1'), '/cadastros/oee?a=1');

  // A raiz nao precisa de dest: o Hub ja devolve na inicial.
  assert.equal(destinoLimpo('/'), '');
  // Voltar para a tela de entrada depois de entrar seria um laco.
  assert.equal(destinoLimpo('/entrar'), '');
  assert.equal(destinoLimpo('/sso'), '');

  for (const ruim of ['//evil.com', '/\\evil.com', 'https://evil.com', 'painel', '', null, 42]) {
    assert.equal(destinoLimpo(ruim), '', 'deveria descartar ' + JSON.stringify(ruim));
  }
  assert.equal(destinoLimpo('/' + 'x'.repeat(500)), '');
  assert.equal(destinoLimpo('/painel' + String.fromCharCode(13) + 'x'), '');
});

test('a porta local nasce fechada', () => {
  comAmbiente({ ENTRADA_LOCAL: '' }, () => assert.equal(entradaLocalLigada(), false));
  comAmbiente({ ENTRADA_LOCAL: '0' }, () => assert.equal(entradaLocalLigada(), false));
  comAmbiente({ ENTRADA_LOCAL: 'sim' }, () => assert.equal(entradaLocalLigada(), false));
  comAmbiente({ ENTRADA_LOCAL: '1' }, () => assert.equal(entradaLocalLigada(), true));
  comAmbiente({ ENTRADA_LOCAL: ' 1 ' }, () => assert.equal(entradaLocalLigada(), true));
});
