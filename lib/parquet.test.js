import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cursor, ErroParquet, lerParquet, plain, rleHibrido } from './parquet.js';

// As partes puras do leitor, com os bytes montados à mão. É onde mora o risco:
// um varint que estoura, um bit-packed que sai deslocado ou um nulo que some
// desalinham a coluna inteira e ninguém percebe olhando o total.

const b = (...n) => new Uint8Array(n);

// --- varint e zigzag -------------------------------------------------------

test('varint lê base 128, um byte e vários', () => {
  assert.equal(new Cursor(b(0x00)).varint(), 0);
  assert.equal(new Cursor(b(0x7f)).varint(), 127);
  assert.equal(new Cursor(b(0x80, 0x01)).varint(), 128);
  assert.equal(new Cursor(b(0xac, 0x02)).varint(), 300);
});

test('varint grande não estoura os 32 bits', () => {
  // 32 * 128^5 = 2^40. Com deslocamento em JS, que trabalha em 32 bits, isso
  // viraria zero — é o motivo de o varint acumular por multiplicação.
  const c = new Cursor(b(0x80, 0x80, 0x80, 0x80, 0x80, 0x20));
  assert.equal(c.varint(), 2 ** 40);
  assert.equal(new Cursor(b(0x80, 0x80, 0x80, 0x80, 0x80, 0x02)).varint(), 2 ** 36);
});

test('zigzag traz o sinal de volta', () => {
  assert.equal(new Cursor(b(0x00)).zigzag(), 0);
  assert.equal(new Cursor(b(0x01)).zigzag(), -1);
  assert.equal(new Cursor(b(0x02)).zigzag(), 1);
  assert.equal(new Cursor(b(0x03)).zigzag(), -2);
  assert.equal(new Cursor(b(0xac, 0x02)).zigzag(), 150);
});

// --- cabeçalho de campo ----------------------------------------------------

test('campos usam delta e param no zero', () => {
  // campo 1 tipo 5 (valor 1), campo 3 tipo 8 (delta 2, vazio), parada
  const c = new Cursor(b(0x15, 0x02, 0x28, 0x00, 0x00));
  const vistos = [];
  for (const [id, t] of c.campos()) {
    vistos.push([id, t]);
    if (t === 5) c.zigzag(); else c.bytes();
  }
  assert.deepEqual(vistos, [[1, 5], [3, 8]]);
});

test('delta zero significa id explícito em zigzag', () => {
  // 0x05 = delta 0, tipo 5 -> o id vem em seguida: 0x14 zigzag = 10
  const c = new Cursor(b(0x05, 0x14, 0x02, 0x00));
  const { value: [id, tipo] } = c.campos().next();
  assert.deepEqual([id, tipo], [10, 5]);
  assert.equal(c.zigzag(), 1);
});

// --- RLE / bit-packed ------------------------------------------------------

test('bloco repetido devolve o mesmo valor N vezes', () => {
  // header = 5<<1 = 10 (par -> repetido), largura 3 -> 1 byte de valor
  assert.deepEqual(rleHibrido(b(10, 6), 3, 5), [6, 6, 6, 6, 6]);
});

test('bloco empacotado desempacota 8 valores de 1 bit', () => {
  // header = (1<<1)|1 = 3 -> 1 grupo de 8; byte 0b10110001
  assert.deepEqual(rleHibrido(b(3, 0b10110001), 1, 8),
    [1, 0, 0, 0, 1, 1, 0, 1]);
});

test('bit-packed de 3 bits atravessa a fronteira do byte', () => {
  // 8 valores de 3 bits = 3 bytes. 0,1,2,3,4,5,6,7 empacotados:
  //   88 C6 FA  (little-endian, menos significativo primeiro)
  assert.deepEqual(rleHibrido(b(3, 0x88, 0xc6, 0xfa), 3, 8),
    [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('para no total pedido mesmo com bloco maior', () => {
  assert.deepEqual(rleHibrido(b(10, 6), 3, 2), [6, 6]);
});

test('blocos em sequência se somam', () => {
  const r = rleHibrido(b(4, 1, 4, 2), 8, 4);         // 2x valor 1, 2x valor 2
  assert.deepEqual(r, [1, 1, 2, 2]);
});

test('largura acima do que o leitor trata é recusada, não adivinhada', () => {
  assert.throws(() => rleHibrido(b(0), 32, 1), ErroParquet);
});

// --- PLAIN -----------------------------------------------------------------

test('PLAIN de double lê little-endian', () => {
  const buf = new Uint8Array(16);
  new DataView(buf.buffer).setFloat64(0, 1.5, true);
  new DataView(buf.buffer).setFloat64(8, -0.25, true);
  assert.deepEqual(plain(buf, 5, 2), [1.5, -0.25]);
});

test('PLAIN de byte array lê tamanho e utf-8', () => {
  const txt = new TextEncoder().encode('Orçamento');
  const buf = new Uint8Array(4 + txt.length);
  new DataView(buf.buffer).setUint32(0, txt.length, true);
  buf.set(txt, 4);
  assert.deepEqual(plain(buf, 6, 1), ['Orçamento']);
});

test('PLAIN de int32 respeita o sinal', () => {
  const buf = new Uint8Array(8);
  const dv = new DataView(buf.buffer);
  dv.setInt32(0, 20850, true);       // 2027-02-01 em dias desde a época
  dv.setInt32(4, -1, true);
  assert.deepEqual(plain(buf, 1, 2), [20850, -1]);
});

test('PLAIN de int64 vira Number, e o carimbo de extração cabe', () => {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigInt64(0, 1786787128000000n, true);
  assert.deepEqual(plain(buf, 2, 1), [1786787128000000]);
  assert.ok(1786787128000000 < Number.MAX_SAFE_INTEGER);
});

test('tipo não suportado é recusado com o nome dele', () => {
  assert.throws(() => plain(b(0), 3, 1), /INT96/);
});

// --- porta de entrada ------------------------------------------------------

test('arquivo sem a marca PAR1 é recusado de cara', async () => {
  await assert.rejects(() => lerParquet(new Uint8Array(20)), ErroParquet);
});

test('a mensagem de recusa diz que não é parquet', async () => {
  await assert.rejects(() => lerParquet(new Uint8Array(20)),
    /não é um arquivo parquet/);
});
