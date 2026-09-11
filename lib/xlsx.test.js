import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  colunaParaIndice, dataDoExcel, escreveXlsx, indiceParaColuna, leXlsx,
} from './xlsx.js';
import { escreveZip, lerZip, texto } from './zip.js';

const COLUNAS = [
  { titulo: 'CC', texto: true },
  { titulo: 'Nome' },
  { titulo: 'Qtd' },
];

test('letra de coluna vai e volta, inclusive depois do Z', () => {
  assert.equal(colunaParaIndice('A'), 0);
  assert.equal(colunaParaIndice('Z'), 25);
  assert.equal(colunaParaIndice('AA'), 26);
  assert.equal(colunaParaIndice('AZ'), 51);
  for (const i of [0, 25, 26, 51, 52, 701, 702]) {
    assert.equal(colunaParaIndice(indiceParaColuna(i)), i);
  }
});

test('escreve e lê de volta: texto continua texto, número continua número', async () => {
  const bytes = await escreveXlsx({
    colunas: COLUNAS,
    linhas: [['001', 'Tear & cia <1>', 3], ['104', 'Rotativa "02"', 1.5]],
  });
  const { linhas } = await leXlsx(bytes);
  assert.deepEqual(linhas, [
    ['CC', 'Nome', 'Qtd'],
    ['001', 'Tear & cia <1>', 3],
    ['104', 'Rotativa "02"', 1.5],
  ]);
});

test('zero à esquerda sobrevive: a coluna de texto vai com formato @', async () => {
  const bytes = await escreveXlsx({ colunas: COLUNAS, linhas: [['001', 'x', 1]] });
  const dentro = await lerZip(bytes);
  const folha = texto(dentro.get('xl/worksheets/sheet1.xml'));
  // s="2" é o estilo de texto; a célula é inlineStr e não numérica.
  assert.match(folha, /<c r="A2" t="inlineStr" s="2"><is><t[^>]*>001<\/t><\/is><\/c>/);
  assert.match(folha, /<c r="C2"><v>1<\/v><\/c>/);
});

test('célula vazia sai como nulo, e linha vazia no fim é descartada', async () => {
  const bytes = await escreveXlsx({
    colunas: COLUNAS,
    linhas: [['001', null, 1], ['', '', ''], [null, null, null]],
  });
  const { linhas } = await leXlsx(bytes);
  assert.deepEqual(linhas, [['CC', 'Nome', 'Qtd'], ['001', null, 1]]);
});

// O Excel grava strings COMPARTILHADAS, não inline. Um arquivo montado à mão
// com essa forma garante que a leitura entende o que o Excel produz — e não só
// o que este módulo escreve.
async function xlsxDoExcel(folha, shared) {
  const a = new Map();
  a.set('[Content_Types].xml', '<Types/>');
  a.set('xl/workbook.xml',
    '<workbook><sheets><sheet name="Plan1" sheetId="1" r:id="rId7"/></sheets></workbook>');
  a.set('xl/_rels/workbook.xml.rels',
    '<Relationships>'
    + '<Relationship Id="rId1" Type="x/styles" Target="styles.xml"/>'
    + '<Relationship Id="rId7" Type="x/worksheet" Target="worksheets/sheet3.xml"/>'
    + '</Relationships>');
  if (shared) a.set('xl/sharedStrings.xml', shared);
  a.set('xl/worksheets/sheet3.xml', folha);
  return escreveZip(a);
}

test('lê a forma do Excel: strings compartilhadas, texto partido em runs, booleano, célula pulada', async () => {
  const shared = '<sst><si><t>CC</t></si>'
    + '<si><r><t>Bina</t></r><r><t xml:space="preserve">deira</t></r></si>'
    + '<si><t>n&amp;o</t></si></sst>';
  const folha = '<worksheet><sheetData>'
    + '<row r="1"><c r="A1" t="s"><v>0</v></c></row>'
    + '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2"><v>2.5</v></c>'
    + '<c r="D2" t="b"><v>1</v></c><c r="E2" t="s"><v>2</v></c></row>'
    + '<row r="4"><c r="A4" t="str"><v>f</v></c><c r="B4" t="e"><v>#N/A</v></c></row>'
    + '</sheetData></worksheet>';
  const { linhas } = await leXlsx(await xlsxDoExcel(folha, shared));
  assert.deepEqual(linhas, [
    ['CC', null, null, null, null],
    ['Binadeira', null, 2.5, true, 'n&o'],
    [null, null, null, null, null],
    ['f', null, null, null, null],
  ]);
});

test('a primeira aba vem do workbook e do .rels, não de sheet1.xml', async () => {
  const folha = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ok</t></is></c></row></sheetData></worksheet>';
  const { linhas } = await leXlsx(await xlsxDoExcel(folha, null));
  assert.deepEqual(linhas, [['ok']]);
});

test('arquivo sem workbook é recusado pelo nome do motivo', async () => {
  const bytes = await escreveZip(new Map([['x.txt', 'nada']]));
  await assert.rejects(() => leXlsx(bytes), /workbook/);
});

test('data do Excel: 1 é 31/12/1899, 45658 é 01/01/2025', () => {
  assert.equal(dataDoExcel(1), '1899-12-31');
  assert.equal(dataDoExcel(45658), '2025-01-01');
  assert.equal(dataDoExcel(46388), '2027-01-01');
  assert.equal(dataDoExcel('abc'), null);
});
