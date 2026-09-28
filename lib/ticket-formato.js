// =============================================================================
// TICKETS — as listas e a validação, sem banco e sem tela
//
// O que um chamado aceita: sobre QUAL parte da ferramenta (produto), de que
// TIPO, um resumo de uma linha e a descrição. A lista de produtos sai de
// `TELAS` (lib/permissoes.js) — a mesma que monta o menu, a home e a grade de
// cargos —, então tela nova aparece no seletor sozinha. Uma lista própria aqui
// seria um segundo lugar para manter, e o primeiro esquecimento faria alguém
// abrir chamado de uma tela que o seletor não oferece.
//
// O produto é guardado como CÓDIGO, e a tela resolve o rótulo na leitura. Um
// código que não existe mais — tela renomeada, tela que saiu — aparece cru, e
// não some: ticket escondido é pior que ticket com rótulo feio.
//
// Motor puro: sem banco, sem tela.
// =============================================================================

import { TELAS } from './permissoes.js';

export const TUDO = 'tudo';

export const TIPOS = [
  { codigo: 'DUVIDA',   rotulo: 'Dúvida',
    pergunta: 'Qual é a sua dúvida?',
    dicaResumo: 'Ex: nova aba para calculo da lua',
    dicaDescricao: 'Ex: nova aba para eu informar o tamanho e a massa da lua '
      + 'para que seja calculado a aceleração da gravidade.' },
  { codigo: 'SUGESTAO', rotulo: 'Sugestão',
    pergunta: 'Qual é a sua sugestão?',
    dicaResumo: 'Ex: nova aba para calculo da lua',
    dicaDescricao: 'Ex: nova aba para eu informar o tamanho e a massa da lua '
      + 'para que seja calculado a aceleração da gravidade.' },
  // Para defeito a pergunta muda: "qual é a sua sugestão?" embaixo de um erro
  // faria a pessoa descrever a solução em vez do que aconteceu — e o que
  // conserta um defeito é o passo a passo, não a ideia.
  { codigo: 'BUG',      rotulo: 'Bug/erro',
    pergunta: 'O que aconteceu?',
    dicaResumo: 'Ex: a tela de OEE não salva o mês de março',
    dicaDescricao: 'Ex: entrei em OEE, escolhi a Tecelagem, digitei 80 em '
      + 'março e cliquei em Salvar — a tela disse "salvo", mas ao voltar o '
      + 'campo estava vazio de novo.' },
];

export const STATUS = [
  { codigo: 'ABERTO',   rotulo: 'Aberto',      cor: 'selo' },
  { codigo: 'ANALISE',  rotulo: 'Em análise',  cor: 'selo padrao' },
  { codigo: 'FEITO',    rotulo: 'Feito',       cor: 'selo ok' },
  { codigo: 'RECUSADO', rotulo: 'Não vamos fazer', cor: 'selo nao' },
];

export const TIPO_PADRAO = 'SUGESTAO';
export const STATUS_PADRAO = 'ABERTO';

/**
 * Os produtos do seletor, na ordem do menu: a ferramenta toda, depois cada
 * grupo (o grupo inteiro e as telas dele).
 *
 * `Ferramenta toda` vem primeiro e é o padrão porque é a resposta certa de
 * quem não sabe onde o problema mora — e obrigar a escolher a tela faria a
 * pessoa chutar uma, o que é pior que não saber.
 */
export function produtos() {
  const lista = [{ codigo: TUDO, rotulo: 'Ferramenta toda', grupo: null }];
  for (const grupo of [...new Set(TELAS.map((t) => t.grupo))]) {
    lista.push({ codigo: `g:${grupo}`, rotulo: `${grupo} — em geral`, grupo });
    for (const t of TELAS.filter((x) => x.grupo === grupo)) {
      lista.push({ codigo: t.codigo, rotulo: t.rotulo, grupo });
    }
  }
  return lista;
}

/** O rótulo de um código guardado. Código que não existe mais sai cru. */
export function rotuloDoProduto(codigo) {
  const c = String(codigo ?? '');
  if (!c || c === TUDO) return 'Ferramenta toda';
  if (c.startsWith('g:')) return `${c.slice(2)} — em geral`;
  return TELAS.find((t) => t.codigo === c)?.rotulo ?? c;
}

export const rotuloDoTipo = (codigo) =>
  TIPOS.find((t) => t.codigo === codigo)?.rotulo ?? String(codigo ?? '');

export const tipo = (codigo) =>
  TIPOS.find((t) => t.codigo === codigo) ?? TIPOS.find((t) => t.codigo === TIPO_PADRAO);

export const statusDe = (codigo) =>
  STATUS.find((s) => s.codigo === codigo) ?? { codigo, rotulo: String(codigo ?? ''), cor: 'selo' };

const ehProduto = (codigo) => produtos().some((p) => p.codigo === codigo);

/**
 * O que falta para o chamado poder ser aberto — lista vazia é ticket válido.
 *
 * Lista e não booleano, pela mesma razão da senha: "formulário inválido" faz a
 * pessoa tentar de novo no escuro.
 */
export function validaTicket({ produto, tipo: t, resumo, descricao } = {}) {
  const faltas = [];
  if (!ehProduto(produto ?? TUDO)) faltas.push('escolha o produto');
  if (!TIPOS.some((x) => x.codigo === t)) faltas.push('escolha o tipo');
  const r = String(resumo ?? '').trim();
  if (r.length < 5) faltas.push('escreva o resumo em uma linha');
  if (r.length > 160) faltas.push('o resumo passa de 160 caracteres');
  if (String(descricao ?? '').trim().length < 10) faltas.push('descreva com um pouco mais de detalhe');
  return faltas;
}

/**
 * QUEM PODE MEXER NUM CHAMADO.
 *
 * O dono edita o que escreveu — errar o resumo ou esquecer metade do passo a
 * passo é o normal de quem escreve com pressa, e obrigar a abrir um segundo
 * chamado só para corrigir o primeiro suja a fila. Mas ele só edita **enquanto
 * ninguém respondeu**: depois da resposta, editar a pergunta faria a resposta
 * parecer sem sentido para quem ler depois.
 *
 * Quem cuida da fila (`tickets.editar`) responde, muda o estado e apaga —
 * apagar é para o chamado duplicado e para o que foi aberto por engano, não
 * para calar quem reclamou; "Não vamos fazer" com o porquê continua sendo a
 * resposta certa para o que não vai acontecer.
 *
 * Funções puras, sem sessão: quem chama passa os fatos.
 */
export function podeEditarTicket(ticket, { souDono, cuidoDaFila }) {
  if (!ticket) return false;
  if (cuidoDaFila) return true;
  return Boolean(souDono) && !ticket.resposta;
}

export function motivoParaNaoEditar(ticket, { souDono, cuidoDaFila }) {
  if (podeEditarTicket(ticket, { souDono, cuidoDaFila })) return null;
  if (!souDono) return 'Só quem abriu o chamado pode editá-lo.';
  return 'Este chamado já foi respondido — editar agora deixaria a resposta sem sentido. Abra outro, ou fale com quem respondeu.';
}

/** Os campos limpos, prontos para gravar. Chame depois de `validaTicket`. */
export function limpaTicket({ produto, tipo: t, resumo, descricao } = {}) {
  return {
    produto: ehProduto(produto) ? produto : TUDO,
    tipo: TIPOS.some((x) => x.codigo === t) ? t : TIPO_PADRAO,
    resumo: String(resumo ?? '').trim().slice(0, 160),
    descricao: String(descricao ?? '').trim(),
  };
}
