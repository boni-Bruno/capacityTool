import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VIDA_SESSAO_S, emiteSessao, leSessao, segredoDaSessao,
} from './sessao-token.js';

const SEGREDO = await segredoDaSessao('senha-mestre-de-teste');

test('o segredo vem de APP_SENHA, e sem ela não há sessão', async () => {
  assert.ok(SEGREDO.length > 20);
  assert.equal(await segredoDaSessao(''), null);
  assert.notEqual(await segredoDaSessao('outra'), SEGREDO);
});

test('usuário, mestre e ninguém vão e voltam', async () => {
  const u = await leSessao(await emiteSessao(
    { tipo: 'usuario', id: 7, nome: 'Bruno', email: 'b@k.com' }, SEGREDO), SEGREDO);
  assert.deepEqual(u, { tipo: 'usuario', id: 7, nome: 'Bruno', email: 'b@k.com' });

  const m = await leSessao(await emiteSessao({ tipo: 'mestre' }, SEGREDO), SEGREDO);
  assert.equal(m.tipo, 'mestre');
  assert.equal(m.id, null);

  const n = await leSessao(await emiteSessao(
    { tipo: 'nenhum', email: 'x@k.com' }, SEGREDO), SEGREDO);
  assert.equal(n.tipo, 'nenhum');
  assert.equal(n.email, 'x@k.com');
});

test('assinatura errada, token expirado ou vazio dão null, sem exceção', async () => {
  const t = await emiteSessao({ tipo: 'mestre' }, SEGREDO, 1000);
  assert.equal(await leSessao(t, await segredoDaSessao('outra')), null);
  assert.equal(await leSessao(t, SEGREDO, 1000 + VIDA_SESSAO_S), null);
  assert.deepEqual(await leSessao(t, SEGREDO, 1000 + 60),
    { tipo: 'mestre', id: null, nome: 'mestre', email: null });
  assert.equal(await leSessao('', SEGREDO), null);
  assert.equal(await leSessao(null, SEGREDO), null);
  assert.equal(await leSessao(t, null), null);
  assert.equal(await leSessao('a.b.c', SEGREDO), null);
});

test('o cookie de hoje — o hash da senha — não passa como sessão', async () => {
  assert.equal(await leSessao('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', SEGREDO), null);
});
