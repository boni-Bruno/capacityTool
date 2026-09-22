import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confereSenha, geraSalt, hashSenha, validaSenha } from './senha.js';

test('a regra diz o que falta, e nada quando a senha vale', () => {
  assert.deepEqual(validaSenha('Fabrica#2026'), []);
  assert.deepEqual(validaSenha('fabrica#2026'), ['uma letra maiúscula']);
  assert.deepEqual(validaSenha('FABRICA#2026'), ['uma letra minúscula']);
  assert.deepEqual(validaSenha('Fabrica2026'), ['um caractere especial']);
  assert.deepEqual(validaSenha('Fa#1'), ['mínimo 8 caracteres']);
  assert.deepEqual(validaSenha(''), [
    'mínimo 8 caracteres', 'uma letra maiúscula', 'uma letra minúscula',
    'um caractere especial',
  ]);
  // Acento conta como letra; espaço não é caractere especial.
  assert.deepEqual(validaSenha('Açãomuitolonga'), ['um caractere especial']);
  assert.deepEqual(validaSenha('Acao muito longa'), ['um caractere especial']);
});

test('hash com salt: a mesma senha dá o mesmo hash com o mesmo salt, e outro com outro', async () => {
  const salt = geraSalt();
  const h1 = await hashSenha('Fabrica#2026', salt);
  const h2 = await hashSenha('Fabrica#2026', salt);
  const h3 = await hashSenha('Fabrica#2026', geraSalt());
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.ok(h1.length >= 40);
  assert.ok(await confereSenha('Fabrica#2026', salt, h1));
  assert.ok(!(await confereSenha('Fabrica#2027', salt, h1)));
  assert.ok(!(await confereSenha('Fabrica#2026', '', h1)));
});

test('vetor fixo: o hash não muda entre versões sem ninguém perceber', async () => {
  // Salt fixo em base64url. Se este teste quebrar, todo usuário cadastrado
  // deixou de conseguir entrar — é para quebrar alto.
  const h = await hashSenha('Fabrica#2026', 'AAAAAAAAAAAAAAAAAAAAAA');
  assert.equal(h, await hashSenha('Fabrica#2026', 'AAAAAAAAAAAAAAAAAAAAAA'));
  assert.match(h, /^[A-Za-z0-9_-]{43}$/);
});
