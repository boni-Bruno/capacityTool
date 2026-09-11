// =============================================================================
// XLSX, LIDO E ESCRITO À MÃO
//
// Um .xlsx é um ZIP de XML — `lib/zip.js` já abre e fecha o ZIP, e o resto é
// texto. Sem biblioteca, como o parquet e o pptx: a regra do projeto é não
// instalar nada, e o que uma planilha de cadastro precisa cabe em pouca coisa.
//
// COBERTURA DELIBERADAMENTE ESTREITA. Uma aba, células de texto e número, sem
// fórmula, sem mesclagem, sem estilo além de "cabeçalho em negrito" e "esta
// coluna é texto". Na leitura, o que o Excel costuma gravar: strings
// compartilhadas, strings inline, números, booleanos. Fora disso a célula sai
// nula — e a camada de cima diz o que faltou em vez de adivinhar.
//
// TEXTO É TEXTO, e este é o ponto que justifica escrever XLSX em vez de CSV:
// CC, CT e Patrimônio saem como célula de texto com formato "@". Em CSV o
// Excel abre "001" como 1, e é a história dos zeros à esquerda do ROADMAP
// voltando por outra porta. Aqui a célula carrega o texto como ele é.
//
// Sem imports além do zip: roda no navegador e no node --test.
// =============================================================================

import { escreveZip, lerZip, texto } from './zip.js';

const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const desc = (t) => String(t ?? '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&');

/** "A" -> 0, "Z" -> 25, "AA" -> 26. */
export function colunaParaIndice(letras) {
  let n = 0;
  for (const c of String(letras).toUpperCase()) {
    n = n * 26 + (c.charCodeAt(0) - 64);
  }
  return n - 1;
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function indiceParaColuna(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// -----------------------------------------------------------------------------
// ESCRITA
// -----------------------------------------------------------------------------

// Os estilos: 0 normal, 1 negrito (cabeçalho), 2 texto (numFmtId 49 é "@").
// O estilo de texto na célula é o que faz o Excel manter "001" como texto
// quando alguém edita a célula — sem ele, a primeira edição vira número.
const ESTILOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill>'
  + '<fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="3">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>';

/**
 * Uma célula. Número vira célula numérica; o resto vira texto inline — sem
 * tabela de strings compartilhadas, que só economizaria bytes num arquivo de
 * algumas centenas de linhas.
 *
 * `textoFixo` força o formato "@" mesmo em coisa que parece número: é o caso
 * de CC, CT e Patrimônio.
 */
function celula(ref, valor, { negrito = false, textoFixo = false } = {}) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (!textoFixo && typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${ref}"${negrito ? ' s="1"' : ''}><v>${valor}</v></c>`;
  }
  const s = negrito ? ' s="1"' : textoFixo ? ' s="2"' : '';
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(valor)}</t></is></c>`;
}

/**
 * Monta um .xlsx de uma aba.
 *
 * `colunas` é a lista de { titulo, largura, texto } — `texto` marca a coluna
 * cujo conteúdo é sempre texto, número parecido ou não. `linhas` é uma lista
 * de listas, na ordem das colunas.
 */
export async function escreveXlsx({ aba = 'Planilha', colunas, linhas }) {
  const cols = colunas.map((c, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${Number(c.largura ?? 14)}" customWidth="1"/>`)
    .join('');

  const cab = colunas.map((c, i) =>
    celula(`${indiceParaColuna(i)}1`, c.titulo, { negrito: true })).join('');

  const corpo = linhas.map((l, r) => {
    const cells = colunas.map((c, i) =>
      celula(`${indiceParaColuna(i)}${r + 2}`, l[i], { textoFixo: Boolean(c.texto) }))
      .join('');
    return `<row r="${r + 2}">${cells}</row>`;
  }).join('');

  const folha = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<cols>${cols}</cols>`
    + `<sheetData><row r="1">${cab}</row>${corpo}</sheetData>`
    + '</worksheet>';

  const arquivos = new Map();
  // A ORDEM IMPORTA: [Content_Types].xml primeiro, como o Excel grava. Ver a
  // nota em escreveZip.
  arquivos.set('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>');
  arquivos.set('_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>');
  arquivos.set('xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + `<sheets><sheet name="${esc(aba)}" sheetId="1" r:id="rId1"/></sheets>`
    + '</workbook>');
  arquivos.set('xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>');
  arquivos.set('xl/styles.xml', ESTILOS);
  arquivos.set('xl/worksheets/sheet1.xml', folha);

  return escreveZip(arquivos);
}

// -----------------------------------------------------------------------------
// LEITURA
// -----------------------------------------------------------------------------

// O texto de um <si> ou <is>: junta todos os <t> de dentro, porque texto com
// formatação parcial vem partido em vários <r><t>.
const textoDe = (xml) =>
  [...String(xml).matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => desc(m[1])).join('');

function lerStringsCompartilhadas(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]));
}

/**
 * A primeira aba do arquivo, como matriz de valores.
 *
 * Devolve `{ linhas }`: lista de listas, uma por linha da planilha, com a
 * célula vazia como `null`. Célula de texto vira string; numérica vira number;
 * booleana vira boolean. Data do Excel é NÚMERO (dias desde 1899-12-30) — quem
 * sabe que a coluna é de data converte; aqui não dá para saber.
 *
 * Linhas totalmente vazias no fim são descartadas: o Excel grava linha em
 * branco onde alguém clicou.
 */
export async function leXlsx(entrada) {
  const arquivos = await lerZip(entrada);
  const pega = (nome) => (arquivos.has(nome) ? texto(arquivos.get(nome)) : null);

  const workbook = pega('xl/workbook.xml');
  if (!workbook) throw new Error('Isto não é um .xlsx: não tem xl/workbook.xml.');

  // A primeira aba é a que o workbook lista primeiro, e o caminho dela sai do
  // .rels — não de um nome adivinhado. Um arquivo salvo com abas reordenadas
  // guarda sheet3.xml como primeira, e sheet1.xml seria a errada.
  const rid = workbook.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const rels = pega('xl/_rels/workbook.xml.rels') ?? '';
  const alvo = rid
    ? rels.match(new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*\\bTarget="([^"]+)"`))?.[1]
      ?? rels.match(new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${rid}"`))?.[1]
    : null;
  const nomeFolha = alvo
    ? (alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`)
    : 'xl/worksheets/sheet1.xml';
  const folha = pega(nomeFolha);
  if (!folha) throw new Error('O .xlsx não tem a primeira aba onde o workbook diz.');

  const compartilhadas = lerStringsCompartilhadas(pega('xl/sharedStrings.xml'));

  const linhas = [];
  for (const m of folha.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const r = Number(m[1]) - 1;
    const valores = [];
    for (const c of m[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const interno = c[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) continue;
      const col = colunaParaIndice(ref);
      const tipo = attrs.match(/\bt="([^"]+)"/)?.[1] ?? 'n';
      const v = interno.match(/<v>([\s\S]*?)<\/v>/)?.[1];

      let valor = null;
      if (tipo === 's') valor = compartilhadas[Number(v)] ?? null;
      else if (tipo === 'inlineStr') valor = textoDe(interno);
      else if (tipo === 'str') valor = v === undefined ? null : desc(v);
      else if (tipo === 'b') valor = v === '1';
      else if (tipo === 'e') valor = null;
      else valor = v === undefined ? null : Number(v);

      if (typeof valor === 'string' && valor === '') valor = null;
      valores[col] = valor;
    }
    linhas[r] = valores;
  }

  // Buracos viram linhas vazias; linhas vazias no fim saem.
  for (let i = 0; i < linhas.length; i += 1) if (!linhas[i]) linhas[i] = [];
  while (linhas.length && linhas[linhas.length - 1].every((x) => x === null || x === undefined)) {
    linhas.pop();
  }
  // Toda linha com a mesma largura, para a camada de cima indexar por coluna
  // sem checar undefined.
  const largura = linhas.reduce((m, l) => Math.max(m, l.length), 0);
  return {
    linhas: linhas.map((l) => Array.from({ length: largura }, (_, i) => l[i] ?? null)),
  };
}

/** Dias desde 1899-12-30 (a data do Excel) para 'AAAA-MM-DD'. */
export function dataDoExcel(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
    .toISOString().slice(0, 10);
}
