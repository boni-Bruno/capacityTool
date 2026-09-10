import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

// jwt.js usa o crypto global de proposito: e o que existe no edge, onde o
// arquivo tambem precisa rodar. Em node antigo o global nao esta la, e esta
// guarda evita um teste que reprova por versao em vez de por defeito.
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
  assina, verifica, novoJti, derivaSegredo, VIDA_S,
  paraBase64Url, deBase64Url, iguaisEmTempoConstante,
} = await import('./jwt.js');

const SEGREDO = 'segredo-de-teste-nao-usar-em-producao';
const AGORA = 1700000000;

const claims = (extra = {}) => ({
  iss: 'hub-snop',
  aud: 'capacidade',
  sub: '42',
  email: 'jose@empresa.com',
  nome: 'Jose da Silva',
  dest: '/painel?ano=2026',
  jti: novoJti(),
  iat: AGORA,
  exp: AGORA + VIDA_S,
  ...extra,
});

const confere = (token, extra) => verifica(token, SEGREDO, {
  aud: 'capacidade', iss: 'hub-snop', agora: AGORA, ...extra,
});

test('token recem-emitido e aceito e devolve os claims', async () => {
  const r = await confere(await assina(claims(), SEGREDO));
  assert.equal(r.ok, true);
  assert.equal(r.claims.sub, '42');
  // dest e um claim que verifica() NAO inspeciona: o teste existe para provar que
  // um claim desconhecido do modulo atravessa a assinatura intacto. Era o papel
  // que ocupava este lugar, ate o Hub deixar de emiti-lo.
  assert.equal(r.claims.dest, '/painel?ano=2026');
  assert.equal(r.kid, 'v1');
});

test('nome com acento sobrevive a ida e a volta', async () => {
  // btoa(JSON.stringify(...)) lancaria aqui. E a razao de existir o TextEncoder.
  const nome = 'Jos' + String.fromCharCode(0x00E9) + ' Ant'
    + String.fromCharCode(0x00F4) + 'nio Gon' + String.fromCharCode(0x00E7) + 'alves';
  const r = await confere(await assina(claims({ nome }), SEGREDO));
  assert.equal(r.ok, true);
  assert.equal(r.claims.nome, nome);
});

test('um caractere trocado no payload derruba a assinatura', async () => {
  const t = await assina(claims(), SEGREDO);
  const [h, p, s] = t.split('.');
  const trocado = p.slice(0, -1) + (p.slice(-1) === 'A' ? 'B' : 'A');
  const r = await confere([h, trocado, s].join('.'));
  assert.equal(r.ok, false);
  // Pode cair em 'formato' se o ultimo caractere quebrar o JSON, mas nunca em ok.
  assert.ok(r.motivo === 'assinatura' || r.motivo === 'formato');
});

test('segredo diferente nao abre', async () => {
  const t = await assina(claims(), SEGREDO);
  const r = await verifica(t, 'outro-segredo', { agora: AGORA });
  assert.equal(r.motivo, 'assinatura');
});

test('sem segredo, recusa — nunca deixa passar', async () => {
  const t = await assina(claims(), SEGREDO);
  assert.equal((await verifica(t, '', { agora: AGORA })).motivo, 'sem-segredo');
  assert.equal((await verifica(t, undefined, { agora: AGORA })).motivo, 'sem-segredo');
  await assert.rejects(() => assina(claims(), ''), /Segredo de SSO ausente/);
});

test('alg: none e recusado', async () => {
  const seg = (o) => paraBase64Url(new TextEncoder().encode(JSON.stringify(o)));
  const forjado = seg({ alg: 'none', typ: 'JWT' }) + '.' + seg(claims()) + '.';
  const r = await confere(forjado);
  assert.equal(r.ok, false);
});

test('alg trocado para outro algoritmo e recusado antes de qualquer conta', async () => {
  const seg = (o) => paraBase64Url(new TextEncoder().encode(JSON.stringify(o)));
  const forjado = seg({ alg: 'HS512', typ: 'JWT' }) + '.' + seg(claims()) + '.QUJD';
  assert.equal((await confere(forjado)).motivo, 'alg');
});

test('token vencido e recusado, e o limite e o proprio exp', async () => {
  const t = await assina(claims(), SEGREDO);
  assert.equal((await confere(t, { agora: AGORA + VIDA_S - 1 })).ok, true);
  assert.equal((await confere(t, { agora: AGORA + VIDA_S })).motivo, 'expirado');
  assert.equal((await confere(t, { agora: AGORA + 3600 })).motivo, 'expirado');
});

test('token do futuro passa dentro da folga de relogio e falha fora dela', async () => {
  const perto = await assina(claims({ iat: AGORA + 30, exp: AGORA + 120 }), SEGREDO);
  assert.equal((await confere(perto)).ok, true);

  const longe = await assina(claims({ iat: AGORA + 300, exp: AGORA + 390 }), SEGREDO);
  assert.equal((await confere(longe)).motivo, 'futuro');
});

test('token de outra ferramenta nao vale aqui', async () => {
  // O teste que justifica o claim aud existir.
  const t = await assina(claims({ aud: 'pmp' }), SEGREDO);
  assert.equal((await confere(t)).motivo, 'aud');
});

test('emissor errado e recusado', async () => {
  const t = await assina(claims({ iss: 'outro-portal' }), SEGREDO);
  assert.equal((await confere(t)).motivo, 'iss');
});

test('claims obrigatorios ausentes sao recusados', async () => {
  const semSub = await assina({ ...claims(), sub: '' }, SEGREDO);
  assert.equal((await confere(semSub)).motivo, 'sub');

  const semJti = await assina({ ...claims(), jti: 'curto' }, SEGREDO);
  assert.equal((await confere(semJti)).motivo, 'jti');

  const semExp = await assina({ ...claims(), exp: 'amanha' }, SEGREDO);
  assert.equal((await confere(semExp)).motivo, 'expirado');
});

test('lixo nao derruba a funcao, so e recusado', async () => {
  const lixos = ['', 'a.b', 'a.b.c', '...', '..', null, 42, {}, [], 'x'.repeat(5000)];
  for (const lixo of lixos) {
    const r = await confere(lixo);
    assert.equal(r.ok, false, 'deveria recusar ' + JSON.stringify(lixo));
  }
});

test('base64url ida e volta preserva os bytes, sem padding e sem + nem /', () => {
  for (const tamanho of [0, 1, 2, 3, 16, 31, 32, 200]) {
    const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
    const texto = paraBase64Url(bytes);
    assert.match(texto, /^[A-Za-z0-9_-]*$/);
    assert.deepEqual(Array.from(deBase64Url(texto)), Array.from(bytes));
  }
});

test('jti e unico e cabe na coluna do banco', () => {
  const vistos = new Set();
  for (let i = 0; i < 1000; i += 1) {
    const j = novoJti();
    assert.ok(j.length >= 16 && j.length <= 64);
    assert.equal(vistos.has(j), false, 'jti repetido');
    vistos.add(j);
  }
});

test('segredo derivado e estavel e diferente por ferramenta', async () => {
  const a = await derivaSegredo('mestre', 'capacidade');
  assert.equal(a, await derivaSegredo('mestre', 'capacidade'));
  assert.notEqual(a, await derivaSegredo('mestre', 'pmp'));
  assert.notEqual(a, await derivaSegredo('outro-mestre', 'capacidade'));
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
});

test('uma ferramenta nao consegue forjar entrada em outra', async () => {
  // O teste que prova o valor de derivar o segredo por ferramenta: mesmo com o
  // proprio segredo em maos, a Capacity nao abre o PMP.
  const daCapacidade = await derivaSegredo('mestre', 'capacidade');
  const doPmp = await derivaSegredo('mestre', 'pmp');
  const forjado = await assina(claims({ aud: 'pmp' }), daCapacidade);
  const r = await verifica(forjado, doPmp, { aud: 'pmp', iss: 'hub-snop', agora: AGORA });
  assert.equal(r.motivo, 'assinatura');
});

test('comparacao em tempo constante acerta os casos obvios', () => {
  assert.equal(iguaisEmTempoConstante('abc', 'abc'), true);
  assert.equal(iguaisEmTempoConstante('abc', 'abd'), false);
  assert.equal(iguaisEmTempoConstante('abc', 'ab'), false);
  assert.equal(iguaisEmTempoConstante('', ''), true);
});
