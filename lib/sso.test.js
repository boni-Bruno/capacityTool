import { test } from 'node:test';
import assert from 'node:assert/strict';

import { caminhoInterno, temControle, escapaHtml } from './sso.js';

test('caminho interno legitimo passa inteiro', () => {
  assert.equal(caminhoInterno('/painel'), '/painel');
  assert.equal(caminhoInterno('/painel?ano=2026&area=3'), '/painel?ano=2026&area=3');
  assert.equal(caminhoInterno('/'), '/');
});

test('o que sai do site vira barra', () => {
  for (const ruim of [
    '//evil.com',            // a pegadinha: o navegador le como URL absoluta
    '/\\evil.com',           // a variante com barra invertida
    'https://evil.com',
    'http://evil.com',
    '//evil.com/painel',
    'javascript:alert(1)',
    'painel',
    '',
    null,
    undefined,
    42,
  ]) {
    assert.equal(caminhoInterno(ruim), '/', 'deveria recusar ' + JSON.stringify(ruim));
  }
});

test('caminho absurdamente longo vira barra', () => {
  assert.equal(caminhoInterno('/' + 'x'.repeat(600)), '/');
});

test('caractere de controle e barrado', () => {
  const CR = String.fromCharCode(13);
  const LF = String.fromCharCode(10);
  const NUL = String.fromCharCode(0);

  assert.equal(temControle('/painel'), false);
  assert.equal(temControle('/painel' + CR + LF), true);
  assert.equal(caminhoInterno('/painel' + CR + LF + 'Set-Cookie: x=1'), '/');
  assert.equal(caminhoInterno('/painel' + NUL), '/');
});

test('escapaHtml fecha as cinco entradas de injecao', () => {
  assert.equal(escapaHtml('<script>'), '&lt;script&gt;');
  assert.equal(escapaHtml('a & b'), 'a &amp; b');
  assert.equal(escapaHtml('"aspas"'), '&quot;aspas&quot;');
  assert.equal(escapaHtml("'simples'"), '&#39;simples&#39;');
  // O & primeiro, senao o escape de < seria escapado de novo e viraria &amp;lt;
  assert.equal(escapaHtml('&lt;'), '&amp;lt;');
});

test('o destino escapado nao consegue sair do atributo', () => {
  const ataque = '/painel?x="><script>alert(1)</script>';
  const saida = escapaHtml(caminhoInterno(ataque));
  assert.equal(saida.includes('<script>'), false);
  assert.equal(saida.includes('"'), false);
});
