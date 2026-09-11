// =============================================================================
// A PLANILHA DE RECURSOS: DA TELA PARA O .XLSX E DE VOLTA
//
// A tabela de Recursos sai para um .xlsx com as mesmas colunas e volta dele. É
// a fronteira onde cadastro se corrompe em silêncio — "001" virando 1, "Não"
// virando erro, planta escrita errada mandando quarenta máquinas para o lugar
// errado —, então ela é pura e testada, e a tela só mostra o que sai daqui.
//
// AS REGRAS, todas decisão do Bruno em 11/09/2026:
//
//   . a chave é a trinca CC-CT-Patrimônio, que é o Código do recurso. Trinca
//     que existe ALTERA; trinca nova CRIA;
//   . linha que está no banco e não está no arquivo fica INTOCADA. Importar
//     nunca apaga por omissão — a lição do `escopo` da matriz de turnos;
//   . planta ou área que não existem: a linha inteira é IGNORADA e a prévia
//     avisa. Criar planta por engano de digitação seria pior que não criar;
//   . recurso existente NÃO muda de área pelo arquivo — a tela também não
//     deixa, porque mover levaria turnos, OEE e paradas junto. Vira erro;
//   . Ativo é sim/não em qualquer caixa e com ou sem acento: "não", "Não",
//     "nao", "NAO" e "n" são a mesma resposta;
//   . o que está escrito na célula é o que entra, sem normalizar. Um CT "1"
//     onde se esperava "001" grava "1" — como na tela, digitar certo é de quem
//     digita, e a prévia mostra o que vai gravar.
//
// Sem banco. `existentes` e `areas` chegam prontos da página.
// =============================================================================

import { dataDoExcel } from './xlsx.js';

// A ordem da tabela na tela, mais a Planta na frente da Área — "Confecção"
// existe em Ibirama e na Matriz, e só o nome da área não diz qual.
export const COLUNAS = [
  { chave: 'planta',       titulo: 'Planta',         largura: 14 },
  { chave: 'area',         titulo: 'Área',           largura: 22 },
  { chave: 'codigo',       titulo: 'Código',         largura: 14, texto: true },
  { chave: 'nome',         titulo: 'Nome',           largura: 28 },
  { chave: 'sub_area',     titulo: 'Sub-área',       largura: 22 },
  { chave: 'tipo',         titulo: 'Tipo',           largura: 10 },
  { chave: 'cc',           titulo: 'CC',             largura: 8,  texto: true },
  { chave: 'ct',           titulo: 'CT',             largura: 8,  texto: true },
  { chave: 'patrimonio',   titulo: 'Patrimônio',     largura: 12, texto: true },
  { chave: 'qt_recursos',  titulo: 'Qtd',            largura: 6 },
  { chave: 'equivalencia', titulo: 'Equivalência',   largura: 12 },
  { chave: 'inicio',       titulo: 'Em operação de', largura: 15, texto: true },
  { chave: 'fim',          titulo: 'até',            largura: 15, texto: true },
  { chave: 'ativo',        titulo: 'Ativo',          largura: 8 },
];

// Sem acento, sem caixa, sem espaço nas pontas: é como se compara cabeçalho,
// planta, área e as palavras sim/não.
export const achata = (v) => String(v ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const textoDe = (v) => {
  if (v === null || v === undefined) return '';
  // Número que veio do Excel vira o texto que o Excel mostra: 748, não 748.0.
  // Zero à esquerda já se perdeu nesse caso, e a prévia mostra o que ficou.
  if (typeof v === 'number') return String(v);
  return String(v).trim();
};

// -----------------------------------------------------------------------------
// EXPORTAÇÃO
// -----------------------------------------------------------------------------

export const rotuloTipo = (t) => (t === 'PESSOA' ? 'pessoa' : 'máquina');

/** A tabela da tela na ordem das colunas do arquivo. */
export function linhasParaExportar(itens) {
  return (itens ?? []).map((r) => [
    r.planta ?? '',
    r.area ?? '',
    r.codigo ?? '',
    r.nome ?? '',
    r.sub_area ?? '',
    rotuloTipo(r.tipo_recurso),
    r.cc ?? '',
    r.ct ?? '',
    r.patrimonio ?? '',
    Number(r.qt_recursos ?? 1),
    Number(r.equivalencia ?? 1),
    r.inicio ? String(r.inicio).slice(0, 10) : '',
    r.fim ? String(r.fim).slice(0, 10) : '',
    r.ativo === false ? 'não' : 'sim',
  ]);
}

// -----------------------------------------------------------------------------
// LEITURA DAS CÉLULAS
// -----------------------------------------------------------------------------

const SIM = new Set(['sim', 's', 'true', 'verdadeiro', 'v', '1', 'x', 'ativo']);
const NAO = new Set(['nao', 'n', 'false', 'falso', 'f', '0', 'inativo']);

/** sim/não em qualquer grafia. Vazio devolve null: quem chama decide o padrão. */
export function leAtivo(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  const t = achata(v);
  if (t === '') return null;
  if (SIM.has(t)) return true;
  if (NAO.has(t)) return false;
  return undefined;   // não deu para entender
}

/** máquina/pessoa em qualquer grafia. Vazio devolve null. */
export function leTipo(v) {
  const t = achata(v);
  if (t === '') return null;
  if (t === 'maquina' || t === 'm') return 'MAQUINA';
  if (t === 'pessoa' || t === 'p') return 'PESSOA';
  return undefined;
}

/**
 * Data em 'AAAA-MM-DD', 'dd/mm/aaaa' ou o número do Excel. Vazio é '' — que é
 * "sem limite", o caso comum. Ilegível devolve undefined.
 */
export function leData(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return dataDoExcel(v) ?? undefined;
  const t = String(v).trim();
  if (t === '') return '';
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
}

/** Número com vírgula ou ponto. Vazio devolve null. */
export function leNumero(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const t = String(v).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

// -----------------------------------------------------------------------------
// O CABEÇALHO
// -----------------------------------------------------------------------------

/**
 * Onde está cada coluna, pelo título — sem acento e sem caixa, em qualquer
 * ordem. Coluna a mais é ignorada; a que falta é dita pelo nome.
 *
 * Código é opcional: ele é derivado da trinca e sai no arquivo só por
 * conveniência. Sem ele, nada muda.
 */
export function conferirCabecalho(linha) {
  const indices = {};
  const cab = (linha ?? []).map(achata);
  for (const c of COLUNAS) {
    const i = cab.indexOf(achata(c.titulo));
    if (i >= 0) indices[c.chave] = i;
  }
  const faltando = COLUNAS
    .filter((c) => c.chave !== 'codigo' && indices[c.chave] === undefined)
    .map((c) => c.titulo);
  return { indices, faltando };
}

// -----------------------------------------------------------------------------
// O PLANO DA IMPORTAÇÃO
// -----------------------------------------------------------------------------

const igual = (a, b) => textoDe(a) === textoDe(b);

/**
 * O que a importação vai fazer, linha a linha, ANTES de tocar no banco.
 *
 * `linhas` é a matriz do .xlsx com o cabeçalho na primeira. `areas` é a lista
 * de { id, nome, planta }. `existentes` é a tabela da tela: { id, codigo,
 * area_id, planta, area, nome, sub_area, tipo_recurso, qt_recursos,
 * equivalencia, inicio, fim, ativo }.
 *
 * Devolve:
 *   criar      linhas novas, prontas para o POST de recurso
 *   alterar    linhas existentes com algo diferente, prontas para o PATCH —
 *              e com `ativo` quando ele também mudou
 *   iguais     quantas linhas existentes não mudaram nada (não geram pedido)
 *   ignoradas  planta ou área desconhecida: a linha inteira fica de fora
 *   erros      dado que não dá para gravar
 *
 * Números de linha são os da planilha (o cabeçalho é a 1), para a pessoa
 * achar a célula no Excel.
 */
export function montarImportacao(linhas, { areas, existentes }) {
  const saida = { criar: [], alterar: [], iguais: 0, ignoradas: [], erros: [] };
  if (!linhas?.length) {
    saida.erros.push({ linha: 1, motivo: 'A planilha está vazia.' });
    return saida;
  }

  const { indices, faltando } = conferirCabecalho(linhas[0]);
  if (faltando.length) {
    saida.erros.push({
      linha: 1,
      motivo: `Faltam as colunas: ${faltando.join(', ')}. A primeira linha tem `
        + 'que ser o cabeçalho, com os títulos da tela.',
    });
    return saida;
  }

  const areaDe = new Map();
  for (const a of areas ?? []) {
    areaDe.set(`${achata(a.planta)}|${achata(a.nome)}`, a);
  }
  const plantas = new Set((areas ?? []).map((a) => achata(a.planta)));
  const porCodigo = new Map((existentes ?? []).map((r) => [r.codigo, r]));
  const vistas = new Map();   // trinca -> linha em que apareceu

  for (let i = 1; i < linhas.length; i += 1) {
    const l = linhas[i];
    const num = i + 1;
    const col = (chave) => (indices[chave] === undefined ? null : l[indices[chave]]);

    // Linha em branco no meio da planilha não é erro: é o Excel.
    if ((l ?? []).every((x) => x === null || x === undefined || String(x).trim() === '')) {
      continue;
    }

    const planta = textoDe(col('planta'));
    const area = textoDe(col('area'));
    if (!planta || !plantas.has(achata(planta))) {
      saida.ignoradas.push({
        linha: num,
        motivo: planta ? `planta "${planta}" não existe` : 'sem planta',
      });
      continue;
    }
    const alvo = areaDe.get(`${achata(planta)}|${achata(area)}`);
    if (!alvo) {
      saida.ignoradas.push({
        linha: num,
        motivo: area ? `área "${area}" não existe em ${planta}` : 'sem área',
      });
      continue;
    }

    const cc = textoDe(col('cc'));
    const ct = textoDe(col('ct'));
    const pat = textoDe(col('patrimonio'));
    if (!cc || !ct || !pat) {
      saida.erros.push({ linha: num, motivo: 'CC, CT e Patrimônio são obrigatórios.' });
      continue;
    }
    const codigo = `${cc}-${ct}-${pat}`;
    if (vistas.has(codigo)) {
      // Dito com todas as letras: a primeira pessoa a tropeçar aqui tinha
      // copiado a linha de cima e trocado o nome — e leu "trinca" sem saber
      // que era o patrimônio que precisava mudar.
      saida.erros.push({
        linha: num,
        motivo: `CC ${cc}, CT ${ct} e Patrimônio ${pat} são os mesmos da linha `
          + `${vistas.get(codigo)} — para o sistema é o mesmo recurso duas vezes. `
          + 'Recurso novo precisa de outro patrimônio (ou outro CT).',
      });
      continue;
    }
    vistas.set(codigo, num);

    const nome = textoDe(col('nome'));
    if (!nome) {
      saida.erros.push({ linha: num, motivo: `${codigo}: sem nome.` });
      continue;
    }

    const tipo = leTipo(col('tipo'));
    if (tipo === undefined) {
      saida.erros.push({
        linha: num,
        motivo: `${codigo}: tipo "${textoDe(col('tipo'))}" — use máquina ou pessoa.`,
      });
      continue;
    }
    const ativo = leAtivo(col('ativo'));
    if (ativo === undefined) {
      saida.erros.push({
        linha: num,
        motivo: `${codigo}: ativo "${textoDe(col('ativo'))}" — use sim ou não.`,
      });
      continue;
    }
    const qt = leNumero(col('qt_recursos'));
    if (qt === undefined || (qt !== null && (!Number.isInteger(qt) || qt < 0))) {
      saida.erros.push({ linha: num, motivo: `${codigo}: Qtd tem que ser inteiro ≥ 0.` });
      continue;
    }
    const eq = leNumero(col('equivalencia'));
    if (eq === undefined || (eq !== null && eq <= 0)) {
      saida.erros.push({ linha: num, motivo: `${codigo}: Equivalência tem que ser > 0.` });
      continue;
    }
    const inicio = leData(col('inicio'));
    const fim = leData(col('fim'));
    if (inicio === undefined || fim === undefined) {
      saida.erros.push({
        linha: num,
        motivo: `${codigo}: data ilegível — use AAAA-MM-DD ou dd/mm/aaaa.`,
      });
      continue;
    }
    if (inicio && fim && fim < inicio) {
      saida.erros.push({ linha: num, motivo: `${codigo}: "até" vem antes de "em operação de".` });
      continue;
    }

    const existente = porCodigo.get(codigo);
    const campos = {
      nome,
      sub_area: textoDe(col('sub_area')),
      tipo_recurso: tipo ?? existente?.tipo_recurso ?? 'MAQUINA',
      cc, ct, patrimonio: pat,
      qt_recursos: qt ?? Number(existente?.qt_recursos ?? 1),
      equivalencia: eq ?? Number(existente?.equivalencia ?? 1),
      inicio, fim,
    };
    const ativoFinal = ativo ?? (existente ? existente.ativo !== false : true);

    if (!existente) {
      saida.criar.push({ linha: num, codigo, area_id: alvo.id, ...campos, ativo: ativoFinal });
      continue;
    }

    if (Number(existente.area_id) !== Number(alvo.id)) {
      saida.erros.push({
        linha: num,
        motivo: `${codigo} está em ${existente.planta} · ${existente.area} e o arquivo `
          + `diz ${planta} · ${area}. Recurso não muda de área pela importação — `
          + 'mover levaria turnos, OEE e paradas junto.',
      });
      continue;
    }

    const mudouCampo = !igual(campos.nome, existente.nome)
      || !igual(campos.sub_area, existente.sub_area ?? '')
      || campos.tipo_recurso !== existente.tipo_recurso
      || Number(campos.qt_recursos) !== Number(existente.qt_recursos ?? 1)
      || Number(campos.equivalencia) !== Number(existente.equivalencia ?? 1)
      || !igual(campos.inicio, existente.inicio ? String(existente.inicio).slice(0, 10) : '')
      || !igual(campos.fim, existente.fim ? String(existente.fim).slice(0, 10) : '');
    const mudouAtivo = ativoFinal !== (existente.ativo !== false);

    if (!mudouCampo && !mudouAtivo) {
      saida.iguais += 1;
      continue;
    }
    saida.alterar.push({
      linha: num, codigo, id: existente.id, ...campos,
      ativo: mudouAtivo ? ativoFinal : null,
      soAtivo: !mudouCampo,
    });
  }

  return saida;
}
