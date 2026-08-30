import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, escreveZip, lerZip, texto } from './zip.js';

// Um .pptx é um ZIP, e escrever ZIP errado dá um arquivo que o PowerPoint
// recusa sem dizer onde. A ida e volta aqui é o que garante que o que sai daqui
// abre lá.

const bytes = (s) => new TextEncoder().encode(s);

test('o CRC-32 bate com o valor conhecido', () => {
  // "123456789" é o vetor de teste canônico do CRC-32; se a tabela estiver
  // errada, é aqui que aparece.
  assert.equal(crc32(bytes('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('ida e volta com um arquivo pequeno, que sai guardado', () => {
  return (async () => {
    const zip = await escreveZip(new Map([['a.xml', '<a>oi</a>']]));
    const lido = await lerZip(zip);
    assert.equal(texto(lido.get('a.xml')), '<a>oi</a>');
  })();
});

test('ida e volta com um arquivo grande, que sai comprimido', async () => {
  // Meio kilobyte é o limite onde a compressão passa a compensar; acima dela o
  // caminho é outro, e ele precisa do mesmo teste.
  const grande = '<p>capacidade</p>'.repeat(400);
  const zip = await escreveZip(new Map([['g.xml', grande]]));
  assert.ok(zip.length < grande.length, 'devia ter comprimido');
  const lido = await lerZip(zip);
  assert.equal(texto(lido.get('g.xml')), grande);
});

test('a ordem dos arquivos é preservada', async () => {
  // Num .pptx isto não é estética: alguns leitores esperam o
  // [Content_Types].xml primeiro.
  const entrada = new Map([
    ['[Content_Types].xml', '<t/>'],
    ['ppt/presentation.xml', '<p/>'],
    ['ppt/slides/slide1.xml', '<s/>'],
  ]);
  const lido = await lerZip(await escreveZip(entrada));
  assert.deepEqual([...lido.keys()], [...entrada.keys()]);
});

test('acento e caminho com barra sobrevivem à ida e volta', async () => {
  const entrada = new Map([['ppt/notas/observação.xml', '<a>ação · 90%</a>']]);
  const lido = await lerZip(await escreveZip(entrada));
  assert.equal(texto(lido.get('ppt/notas/observação.xml')), '<a>ação · 90%</a>');
});

test('bytes binários passam sem serem tocados', async () => {
  const bin = new Uint8Array([0, 255, 13, 10, 26, 137, 80, 78, 71]);
  const lido = await lerZip(await escreveZip(new Map([['m/i.png', bin]])));
  assert.deepEqual([...lido.get('m/i.png')], [...bin]);
});

test('arquivo vazio não quebra a conta dos deslocamentos', async () => {
  const lido = await lerZip(await escreveZip(new Map([
    ['vazio.txt', ''], ['depois.txt', 'existo'],
  ])));
  assert.equal(texto(lido.get('vazio.txt')), '');
  assert.equal(texto(lido.get('depois.txt')), 'existo');
});

test('o que não é zip é recusado pelo nome do motivo', async () => {
  await assert.rejects(() => lerZip(bytes('isto nao e um zip')),
    /não achei o fim do diretório central/);
});
