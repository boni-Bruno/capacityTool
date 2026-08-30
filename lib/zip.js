// =============================================================================
// ZIP, LIDO E ESCRITO À MÃO
//
// Um .pptx é um ZIP de XML. Para preencher um slide de um modelo, é preciso
// abrir o arquivo, mexer num XML lá dentro e fechar de volta — e nenhuma das
// duas pontas existe no Node sem biblioteca.
//
// A regra deste projeto é não instalar nada, então o ZIP é escrito aqui, como o
// leitor de parquet em `lib/parquet.js`. A parte difícil — DEFLATE — o próprio
// runtime resolve: `DecompressionStream('deflate-raw')` e
// `CompressionStream('deflate-raw')` existem no navegador e no Node 18+, que é
// o mesmo par que o parquet já usa para GZIP.
//
// SÓ O QUE UM .PPTX PRECISA. Sem ZIP64, sem senha, sem múltiplos volumes: são
// coisas que o PowerPoint não gera e que aqui só serviriam para dar a impressão
// de completude. Arquivo que use qualquer uma delas é recusado pelo nome do
// motivo, e não lido pela metade.
// =============================================================================

const ASSINATURA = {
  LOCAL: 0x04034b50,
  CENTRAL: 0x02014b50,
  FIM: 0x06054b50,
};

// A tabela do CRC-32, montada uma vez. Sem ela cada byte custaria oito
// deslocamentos, e um .pptx tem alguns milhões deles.
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const erro = (msg) => { throw new Error(`ZIP: ${msg}`); };

async function passaPor(bytes, tipo) {
  const fluxo = new Blob([bytes]).stream().pipeThrough(new tipo('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

const infla = (b) => passaPor(b, DecompressionStream);
const desinfla = (b) => passaPor(b, CompressionStream);

/**
 * Abre um ZIP e devolve `Map<caminho, Uint8Array>`.
 *
 * Lê pelo DIRETÓRIO CENTRAL, e não varrendo os cabeçalhos locais do começo ao
 * fim. O central é a lista autoritativa do que existe no arquivo: quando os
 * dois discordam — e discordam, em ZIP remendado — quem tem razão é ele.
 */
export async function lerZip(entrada) {
  const b = entrada instanceof Uint8Array ? entrada : new Uint8Array(entrada);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);

  // O fim do diretório central é procurado de trás para frente porque ele pode
  // ter um comentário de tamanho livre depois. 64 KB é o teto desse comentário.
  let fim = -1;
  const limite = Math.max(0, b.length - 0xffff - 22);
  for (let i = b.length - 22; i >= limite; i -= 1) {
    if (v.getUint32(i, true) === ASSINATURA.FIM) { fim = i; break; }
  }
  if (fim < 0) erro('não achei o fim do diretório central — isto é um zip?');

  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  if (total === 0xffff || p === 0xffffffff) erro('ZIP64 não é lido aqui.');

  const arquivos = new Map();
  for (let i = 0; i < total; i += 1) {
    if (v.getUint32(p, true) !== ASSINATURA.CENTRAL) {
      erro('entrada do diretório central fora do lugar.');
    }
    const flags = v.getUint16(p + 8, true);
    const metodo = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nomeLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const comentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nomeLen));

    if (flags & 0x1) erro(`"${nome}" está com senha.`);
    if (metodo !== 0 && metodo !== 8) {
      erro(`"${nome}" usa o método ${metodo}; só leio guardado e deflate.`);
    }

    // O cabeçalho local repete nome e extra, e o extra dele costuma ter tamanho
    // diferente do central — por isso os dois são lidos de novo aqui.
    if (v.getUint32(local, true) !== ASSINATURA.LOCAL) {
      erro(`cabeçalho local de "${nome}" fora do lugar.`);
    }
    const nomeLocal = v.getUint16(local + 26, true);
    const extraLocal = v.getUint16(local + 28, true);
    const inicio = local + 30 + nomeLocal + extraLocal;
    const bruto = b.subarray(inicio, inicio + compSize);

    arquivos.set(nome, metodo === 0 ? bruto.slice() : await infla(bruto));
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return arquivos;
}

/**
 * Monta um ZIP a partir de `Map<caminho, Uint8Array | string>`.
 *
 * A ORDEM É PRESERVADA. Num .pptx isso não é estética: alguns leitores esperam
 * `[Content_Types].xml` primeiro, e o PowerPoint sempre o põe ali. Reordenar
 * daria um arquivo que abre num programa e não em outro.
 */
export async function escreveZip(arquivos) {
  const cod = new TextEncoder();
  const partes = [];
  const central = [];
  let deslocamento = 0;

  for (const [nome, conteudo] of arquivos) {
    const dados = typeof conteudo === 'string' ? cod.encode(conteudo)
      : (conteudo instanceof Uint8Array ? conteudo : new Uint8Array(conteudo));
    const nomeBytes = cod.encode(nome);
    const soma = crc32(dados);

    // Comprime só quando compensa. Abaixo de meio kilobyte o cabeçalho do
    // deflate come o que ele economiza, e guardado abre mais rápido.
    const comprimido = dados.length >= 512 ? await desinfla(dados) : null;
    const usa = comprimido && comprimido.length < dados.length;
    const corpo = usa ? comprimido : dados;
    const metodo = usa ? 8 : 0;

    const local = new Uint8Array(30 + nomeBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, ASSINATURA.LOCAL, true);
    lv.setUint16(4, 20, true);            // versão mínima para extrair
    lv.setUint16(6, 0x800, true);         // nome em UTF-8
    lv.setUint16(8, metodo, true);
    lv.setUint32(14, soma, true);
    lv.setUint32(18, corpo.length, true);
    lv.setUint32(22, dados.length, true);
    lv.setUint16(26, nomeBytes.length, true);
    local.set(nomeBytes, 30);

    partes.push(local, corpo);

    const cd = new Uint8Array(46 + nomeBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, ASSINATURA.CENTRAL, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x800, true);
    cv.setUint16(10, metodo, true);
    cv.setUint32(16, soma, true);
    cv.setUint32(20, corpo.length, true);
    cv.setUint32(24, dados.length, true);
    cv.setUint16(28, nomeBytes.length, true);
    cv.setUint32(42, deslocamento, true);
    cd.set(nomeBytes, 46);
    central.push(cd);

    deslocamento += local.length + corpo.length;
  }

  const tamanhoCentral = central.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22);
  const fv = new DataView(fim.buffer);
  fv.setUint32(0, ASSINATURA.FIM, true);
  fv.setUint16(8, arquivos.size, true);
  fv.setUint16(10, arquivos.size, true);
  fv.setUint32(12, tamanhoCentral, true);
  fv.setUint32(16, deslocamento, true);

  const todas = [...partes, ...central, fim];
  const total = todas.reduce((s, x) => s + x.length, 0);
  const saida = new Uint8Array(total);
  let i = 0;
  for (const parte of todas) { saida.set(parte, i); i += parte.length; }
  return saida;
}

export const texto = (bytes) => new TextDecoder().decode(bytes);
