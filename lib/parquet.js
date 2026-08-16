// =============================================================================
// LEITOR DE PARQUET, SEM DEPENDÊNCIA
//
// A base de demanda vem em `.parquet` — 116 mil linhas em 1,2 MB, contra 6,4 MB
// do xlsx equivalente. Ler isso custa código, mas nenhuma biblioteca: parquet é
// um cabeçalho Thrift compact mais páginas comprimidas, e `DecompressionStream`
// existe tanto no navegador quanto no Node 18+. Uma implementação serve aos
// dois lados.
//
// COBERTURA DELIBERADAMENTE ESTREITA. Este leitor entende o que a exportação da
// empresa produz e nada além:
//
//   compressão   GZIP e sem compressão
//   encoding     PLAIN, PLAIN_DICTIONARY, RLE_DICTIONARY
//   tipos        BYTE_ARRAY (utf8), DOUBLE, INT32, INT64, FLOAT
//   estrutura    colunas planas, opcionais ou obrigatórias — sem lista, sem mapa
//
// Fora disso ele NÃO tenta adivinhar: recusa dizendo o que encontrou e o que
// esperava. Se a exportação um dia sair em SNAPPY ou ZSTD — padrões comuns do
// Arrow, e nenhum dos dois existe na biblioteca padrão de lugar nenhum —, uma
// carga recusada é muito melhor que uma carga lida errado em silêncio.
// =============================================================================

const MAGICA = 0x50415231;            // "PAR1", nas duas pontas do arquivo

export const TIPO = {
  0: 'BOOLEAN', 1: 'INT32', 2: 'INT64', 3: 'INT96',
  4: 'FLOAT', 5: 'DOUBLE', 6: 'BYTE_ARRAY', 7: 'FIXED_LEN_BYTE_ARRAY',
};
const CODEC = {
  0: 'sem compressão', 1: 'SNAPPY', 2: 'GZIP', 3: 'LZO',
  4: 'BROTLI', 5: 'LZ4', 6: 'ZSTD', 7: 'LZ4_RAW',
};
const ENCODING = {
  0: 'PLAIN', 2: 'PLAIN_DICTIONARY', 3: 'RLE', 4: 'BIT_PACKED',
  5: 'DELTA_BINARY_PACKED', 6: 'DELTA_LENGTH_BYTE_ARRAY',
  7: 'DELTA_BYTE_ARRAY', 8: 'RLE_DICTIONARY', 9: 'BYTE_STREAM_SPLIT',
};

class ErroParquet extends Error {}
const erro = (msg) => { throw new ErroParquet(msg); };

// -----------------------------------------------------------------------------
// THRIFT COMPACT
//
// O rodapé do parquet é um struct Thrift no protocolo compact. São três
// primitivas — varint, zigzag e o cabeçalho de campo com delta — e o resto é
// caminhar pela árvore pulando o que não interessa.
// -----------------------------------------------------------------------------

export class Cursor {
  constructor(bytes, i = 0) {
    this.b = bytes;
    this.i = i;
  }

  byte() {
    if (this.i >= this.b.length) erro('Arquivo termina no meio de um registro.');
    return this.b[this.i++];
  }

  // Base 128, sete bits por byte, o oitavo diz "tem mais". Acumula por
  // multiplicação e não por deslocamento: `<<` em JS trabalha em 32 bits e
  // silenciosamente estraga qualquer valor maior.
  varint() {
    let r = 0;
    let escala = 1;
    for (let n = 0; n < 10; n++) {
      const c = this.byte();
      r += (c & 0x7f) * escala;
      if (!(c & 0x80)) return r;
      escala *= 128;
    }
    return erro('Varint sem fim — o arquivo não parece um parquet válido.');
  }

  // Inteiro com sinal: o bit menos significativo carrega o sinal.
  zigzag() {
    const n = this.varint();
    const meio = Math.floor(n / 2);
    return (n % 2) ? -(meio + 1) : meio;
  }

  bytes() {
    const n = this.varint();
    const v = this.b.subarray(this.i, this.i + n);
    this.i += n;
    return v;
  }

  texto() {
    return new TextDecoder('utf-8').decode(this.bytes());
  }

  double() {
    const v = new DataView(this.b.buffer, this.b.byteOffset + this.i, 8)
      .getFloat64(0, true);
    this.i += 8;
    return v;
  }

  // Cabeçalho de lista: tamanho e tipo no mesmo byte, com escape para listas
  // grandes.
  cabecalhoLista() {
    const h = this.byte();
    const t = h & 0x0f;
    const n = (h >> 4) === 15 ? this.varint() : (h >> 4);
    return [n, t];
  }

  /**
   * Percorre os campos de um struct até o marcador de fim.
   *
   * O id do campo vem como DELTA em relação ao anterior — é o que torna o
   * protocolo compacto e o que obriga a percorrer os campos em ordem, mesmo os
   * que não interessam.
   */
  * campos() {
    let anterior = 0;
    for (;;) {
      const h = this.byte();
      if (h === 0) return;
      const tipo = h & 0x0f;
      const delta = h >> 4;
      const id = delta === 0 ? this.zigzag() : anterior + delta;
      anterior = id;
      yield [id, tipo];
    }
  }

  pula(tipo) {
    switch (tipo) {
      case 1: case 2: return;                       // booleano vem no cabeçalho
      case 3: this.byte(); return;
      case 4: case 5: case 6: this.zigzag(); return;
      case 7: this.double(); return;
      case 8: this.bytes(); return;
      case 9: case 10: {
        const [n, t] = this.cabecalhoLista();
        for (let k = 0; k < n; k++) this.pula(t);
        return;
      }
      case 11: {
        const n = this.varint();
        if (n) {
          const kv = this.byte();
          for (let k = 0; k < n; k++) { this.pula(kv >> 4); this.pula(kv & 0x0f); }
        }
        return;
      }
      case 12: {
        for (const [, t] of this.campos()) this.pula(t);
        return;
      }
      default: return erro(`Campo Thrift de tipo ${tipo}, que não sei pular.`);
    }
  }
}

// -----------------------------------------------------------------------------
// RLE / BIT-PACKED HÍBRIDO
//
// Os índices do dicionário e os níveis de definição usam o mesmo esquema: uma
// sequência de blocos, cada um precedido de um varint que diz se é uma repetição
// (valor único repetido N vezes) ou um empacotamento (grupos de 8 valores
// grudados bit a bit).
// -----------------------------------------------------------------------------

export function rleHibrido(dados, largura, quantos) {
  if (largura > 24) {
    erro(`Índice de dicionário de ${largura} bits, acima do que este leitor trata.`);
  }
  const saida = [];
  const c = new Cursor(dados);

  while (saida.length < quantos && c.i < dados.length) {
    const h = c.varint();

    if (h & 1) {                                    // empacotado
      const valores = (h >> 1) * 8;
      const precisa = Math.ceil((valores * largura) / 8);
      const fim = c.i + precisa;
      let acc = 0;
      let bits = 0;
      for (let k = 0; k < valores; k++) {
        while (bits < largura) {
          acc += (c.i < dados.length ? dados[c.i] : 0) * 2 ** bits;
          c.i++;
          bits += 8;
        }
        const mod = 2 ** largura;
        saida.push(acc % mod);
        acc = Math.floor(acc / mod);
        bits -= largura;
      }
      c.i = fim;                                    // sobra de bits é descartada
    } else {                                        // repetido
      const vezes = h >> 1;
      const nbytes = Math.ceil(largura / 8);
      let v = 0;
      for (let k = 0; k < nbytes; k++) v += (dados[c.i + k] ?? 0) * 2 ** (8 * k);
      c.i += nbytes;
      for (let k = 0; k < vezes && saida.length < quantos; k++) saida.push(v);
    }
  }
  return saida.length > quantos ? saida.slice(0, quantos) : saida;
}

// -----------------------------------------------------------------------------
// PLAIN
// -----------------------------------------------------------------------------

export function plain(dados, tipo, quantos) {
  const v = new Array(quantos);
  const dv = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  let i = 0;

  if (tipo === 6) {                                 // BYTE_ARRAY (utf8)
    const dec = new TextDecoder('utf-8');
    for (let k = 0; k < quantos; k++) {
      const n = dv.getUint32(i, true); i += 4;
      v[k] = dec.decode(dados.subarray(i, i + n)); i += n;
    }
  } else if (tipo === 5) {
    for (let k = 0; k < quantos; k++) { v[k] = dv.getFloat64(i, true); i += 8; }
  } else if (tipo === 4) {
    for (let k = 0; k < quantos; k++) { v[k] = dv.getFloat32(i, true); i += 4; }
  } else if (tipo === 1) {
    for (let k = 0; k < quantos; k++) { v[k] = dv.getInt32(i, true); i += 4; }
  } else if (tipo === 2) {
    // Number e não BigInt: o carimbo de extração em microssegundos cabe folgado
    // em 2^53, e BigInt contaminaria toda a aritmética depois.
    for (let k = 0; k < quantos; k++) { v[k] = Number(dv.getBigInt64(i, true)); i += 8; }
  } else {
    erro(`Coluna do tipo ${TIPO[tipo] ?? tipo}, que este leitor não lê.`);
  }
  return v;
}

// -----------------------------------------------------------------------------
// DESCOMPRESSÃO
// -----------------------------------------------------------------------------

async function descompacta(bytes, codec) {
  if (codec === 0) return bytes;
  if (codec !== 2) {
    erro(`Arquivo comprimido em ${CODEC[codec] ?? codec}. Este leitor só abre `
       + `GZIP — reexporte a base com essa compressão.`);
  }
  const fluxo = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

// -----------------------------------------------------------------------------
// METADADOS
// -----------------------------------------------------------------------------

function leElemento(c) {
  const e = {};
  for (const [id, t] of c.campos()) {
    if (id === 1) e.tipo = c.zigzag();
    else if (id === 3) e.repeticao = c.zigzag();
    else if (id === 4) e.nome = c.texto();
    else if (id === 5) e.filhos = c.zigzag();
    else if (id === 6) e.convertido = c.zigzag();
    else c.pula(t);
  }
  return e;
}

function leColunaMeta(c) {
  const m = { encodings: [], caminho: [] };
  for (const [id, t] of c.campos()) {
    if (id === 1) m.tipo = c.zigzag();
    else if (id === 2) {
      const [n] = c.cabecalhoLista();
      for (let k = 0; k < n; k++) m.encodings.push(c.zigzag());
    } else if (id === 3) {
      const [n] = c.cabecalhoLista();
      for (let k = 0; k < n; k++) m.caminho.push(c.texto());
    } else if (id === 4) m.codec = c.zigzag();
    else if (id === 5) m.valores = c.zigzag();
    else if (id === 9) m.dados = c.zigzag();
    else if (id === 11) m.dicionario = c.zigzag();
    else c.pula(t);
  }
  return m;
}

function leRodape(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12
      || dv.getUint32(0, false) !== MAGICA
      || dv.getUint32(bytes.length - 4, false) !== MAGICA) {
    erro('Isto não é um arquivo parquet: falta a marca PAR1 no começo ou no fim.');
  }
  const tam = dv.getUint32(bytes.length - 8, true);
  const c = new Cursor(bytes, bytes.length - 8 - tam);

  const esquema = [];
  const grupos = [];
  let linhas = 0;
  let criadoPor = null;

  for (const [id, t] of c.campos()) {
    if (id === 2) {
      const [n] = c.cabecalhoLista();
      for (let k = 0; k < n; k++) esquema.push(leElemento(c));
    } else if (id === 3) linhas = c.zigzag();
    else if (id === 4) {
      const [n] = c.cabecalhoLista();
      for (let k = 0; k < n; k++) {
        const g = { colunas: [] };
        for (const [id2, t2] of c.campos()) {
          if (id2 === 1) {
            const [nc] = c.cabecalhoLista();
            for (let j = 0; j < nc; j++) {
              let meta = null;
              for (const [id3, t3] of c.campos()) {
                if (id3 === 3) meta = leColunaMeta(c); else c.pula(t3);
              }
              g.colunas.push(meta);
            }
          } else if (id2 === 3) g.linhas = c.zigzag();
          else c.pula(t2);
        }
        grupos.push(g);
      }
    } else if (id === 6) criadoPor = c.texto();
    else c.pula(t);
  }

  // O primeiro elemento do esquema é a raiz e não é coluna.
  const colunas = esquema.filter((e) => e.tipo !== undefined);
  return { colunas, grupos, linhas, criadoPor };
}

// -----------------------------------------------------------------------------
// PÁGINAS
// -----------------------------------------------------------------------------

function leCabecalhoPagina(c) {
  const p = {};
  for (const [id, t] of c.campos()) {
    if (id === 1) p.tipo = c.zigzag();
    else if (id === 2) p.bruto = c.zigzag();
    else if (id === 3) p.comprimido = c.zigzag();
    else if (id === 5) {
      const d = {};
      for (const [i2, t2] of c.campos()) {
        if (i2 === 1) d.valores = c.zigzag();
        else if (i2 === 2) d.encoding = c.zigzag();
        else c.pula(t2);
      }
      p.dados = d;
    } else if (id === 7) {
      const d = {};
      for (const [i2, t2] of c.campos()) {
        if (i2 === 1) d.valores = c.zigzag();
        else if (i2 === 2) d.encoding = c.zigzag();
        else c.pula(t2);
      }
      p.dicionario = d;
    } else if (id === 8) {
      const d = {};
      for (const [i2, t2] of c.campos()) {
        if (i2 === 1) d.valores = c.zigzag();
        else if (i2 === 2) d.nulos = c.zigzag();
        else if (i2 === 4) d.encoding = c.zigzag();
        else if (i2 === 5) d.bytesDef = c.zigzag();
        else if (i2 === 6) d.bytesRep = c.zigzag();
        else c.pula(t2);
      }
      p.v2 = d;
    } else c.pula(t);
  }
  return p;
}

async function leChunk(bytes, meta) {
  const codec = meta.codec ?? 0;
  // O dicionário vem antes das páginas de dados quando existe.
  let pos = meta.dicionario && meta.dicionario < meta.dados
    ? meta.dicionario : meta.dados;

  let dicionario = null;
  const valores = [];

  while (valores.length < meta.valores) {
    const c = new Cursor(bytes, pos);
    const p = leCabecalhoPagina(c);
    const corpo = bytes.subarray(c.i, c.i + p.comprimido);
    pos = c.i + p.comprimido;

    if (p.tipo === 2) {                              // página de dicionário
      dicionario = plain(await descompacta(corpo, codec), meta.tipo,
                         p.dicionario.valores);
      continue;
    }

    let definicoes;
    let resto;
    let encoding;

    if (p.tipo === 3) {                              // DATA_PAGE_V2
      const h = p.v2;
      const nd = h.bytesDef ?? 0;
      const nr = h.bytesRep ?? 0;
      // Na v2 os níveis ficam FORA da parte comprimida.
      definicoes = nd
        ? rleHibrido(corpo.subarray(nr, nr + nd), 1, h.valores)
        : new Array(h.valores).fill(1);
      resto = await descompacta(corpo.subarray(nr + nd), codec);
      encoding = h.encoding;
    } else {                                         // DATA_PAGE v1
      const h = p.dados;
      const d = await descompacta(corpo, codec);
      const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
      const tamDef = dv.getUint32(0, true);
      definicoes = rleHibrido(d.subarray(4, 4 + tamDef), 1, h.valores);
      resto = d.subarray(4 + tamDef);
      encoding = h.encoding;
    }

    const preenchidos = definicoes.reduce((s, x) => s + (x === 1 ? 1 : 0), 0);
    let crus;

    if (encoding === 2 || encoding === 8) {
      if (!dicionario) erro('Página usa dicionário, mas ele não veio antes.');
      const largura = resto[0];
      const idx = rleHibrido(resto.subarray(1), largura, preenchidos);
      crus = idx.map((i) => dicionario[i]);
    } else if (encoding === 0) {
      crus = plain(resto, meta.tipo, preenchidos);
    } else {
      erro(`Coluna ${meta.caminho.join('.')} usa encoding `
         + `${ENCODING[encoding] ?? encoding}, que este leitor não lê.`);
    }

    let k = 0;
    for (const d of definicoes) valores.push(d === 1 ? crus[k++] : null);
  }

  return valores.length > meta.valores ? valores.slice(0, meta.valores) : valores;
}

// -----------------------------------------------------------------------------
// PORTA DE ENTRADA
// -----------------------------------------------------------------------------

/**
 * Lê o arquivo inteiro em memória, uma lista por coluna.
 *
 * 116 mil linhas por 15 colunas cabem folgado — as strings vêm do dicionário e
 * são compartilhadas, então o custo real é o de 1,7 milhão de referências.
 *
 * Devolve também `criadoPor`, que serve para o relatório da carga dizer de que
 * ferramenta o arquivo saiu.
 */
export async function lerParquet(entrada) {
  const bytes = entrada instanceof Uint8Array ? entrada : new Uint8Array(entrada);
  const { colunas, grupos, linhas, criadoPor } = leRodape(bytes);

  const dados = {};
  for (const col of colunas) dados[col.nome] = [];

  for (const g of grupos) {
    if (g.colunas.length !== colunas.length) {
      erro('Row group com número de colunas diferente do esquema.');
    }
    for (let i = 0; i < g.colunas.length; i++) {
      const parte = await leChunk(bytes, g.colunas[i]);
      const alvo = dados[colunas[i].nome];
      for (const v of parte) alvo.push(v);
    }
  }

  return {
    linhas,
    criadoPor,
    nomes: colunas.map((c) => c.nome),
    tipos: Object.fromEntries(colunas.map((c) => [c.nome, TIPO[c.tipo]])),
    colunas: dados,
  };
}

export { ErroParquet };
