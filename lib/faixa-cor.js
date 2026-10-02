// =============================================================================
// A COR DA OCUPAÇÃO
//
// Ler doze porcentagens e achar as que estouram é o que ninguém faz numa
// reunião. A cor faz o mês problemático saltar antes de alguém terminar de ler
// a linha — e qual cor para qual faixa é decisão de quem apresenta, não do
// sistema: numa fábrica 95% já é aperto, noutra 105% é normal porque o plano é
// agressivo de propósito.
//
// É a única cor do documento que não vem do tema do modelo. As do gráfico vêm,
// porque decoram; esta informa, e quem conhece a régua é quem escolhe.
//
// BURACO É RESPOSTA. Valor que não cai em faixa nenhuma sai sem cor, e isso é
// legítimo: obrigar a cobrir de zero a infinito forçaria a inventar uma cor
// para o que não interessa.
//
// Sem imports e sem banco.
// =============================================================================

const HEX = /^#[0-9A-Fa-f]{6}$/;

export const ehCor = (c) => HEX.test(String(c ?? ''));

/** "#abc" e "ABCDEF" viram "#AABBCC" e "#ABCDEF"; o resto vira nulo. */
export function normalizaCor(c) {
  let t = String(c ?? '').trim();
  if (!t) return null;
  if (t[0] !== '#') t = `#${t}`;
  // A forma curta existe no HTML e é o que alguém digita de cabeça; recusá-la
  // seria recusar por um detalhe que o navegador aceita em qualquer lugar.
  if (/^#[0-9A-Fa-f]{3}$/.test(t)) {
    t = `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  }
  return HEX.test(t) ? t.toUpperCase() : null;
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/**
 * A faixa que contém o valor, ou nulo.
 *
 * `[de, ate)` — fechado embaixo, aberto em cima: assim "85 a 100" e "100 a 115"
 * se encostam sem se sobrepor, e 100% cai na segunda, que é como se lê "de 100
 * em diante". Ponta nula é infinito daquele lado.
 */
export function faixaDe(faixas, valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
    return null;
  }
  const v = Number(valor);
  for (const f of faixas ?? []) {
    const de = num(f?.pct_de);
    const ate = num(f?.pct_ate);
    if ((de === null || v >= de) && (ate === null || v < ate)) return f;
  }
  return null;
}

export const corDaOcupacao = (faixas, valor) =>
  normalizaCor(faixaDe(faixas, valor)?.cor);

/**
 * A luminância relativa do sRGB — a conta das regras de acessibilidade.
 */
function luminancia(cor) {
  const c = normalizaCor(cor);
  if (!c) return null;
  const canal = (i) => {
    const v = parseInt(c.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

/** A razão de contraste entre duas cores — de 1 (iguais) a 21 (preto/branco). */
export function contrasteEntre(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// OS DOIS FUNDOS EM QUE A MESMA COR VAI CAIR.
//
// A régua é uma só desde que o painel da ocupação passou a pintar por ela, e
// isso tem um preço que a tela precisa dizer: um vermelho escuro que fica ótimo
// no slide branco quase some no painel escuro, e um amarelo claro faz o
// contrário. Sem os dois avisos, a escolha boa para um lugar estragaria o
// outro em silêncio.
export const FUNDO_SLIDE = '#FFFFFF';
export const FUNDO_PAINEL_ESCURO = '#1E2024';   // --card do tema escuro

/**
 * Quanto a cor contrasta com o branco do slide.
 *
 * A cor pinta o NÚMERO, e não o fundo da célula — foi assim que o Bruno pediu.
 * Isso deixa a legibilidade nas mãos de quem escolhe: amarelo claro sobre
 * branco some, e some num slide projetado, onde ninguém vai conferir.
 */
export const contrasteComBranco = (cor) => contrasteEntre(cor, FUNDO_SLIDE);

// 3:1 é o piso das regras de acessibilidade para texto grande. Abaixo disso a
// cor não é uma escolha de estilo, é um número que não se lê.
const fraca = (c) => c !== null && c < 3;

export const corFraca = (cor) => fraca(contrasteComBranco(cor));

/** A mesma pergunta do outro lado: ela se lê no painel em tema escuro? */
export const corFracaNoEscuro = (cor) =>
  fraca(contrasteEntre(cor, FUNDO_PAINEL_ESCURO));

/**
 * Como a tela pinta uma porcentagem de ocupação — classe e estilo prontos.
 *
 * Aqui, e não em cada tabela, porque são seis lugares que mostram ocupação (o
 * indicador, o mês a mês, a tabela por CT, a de atributo, a dinâmica e o
 * slide) e cada um tinha a sua cópia da régua `>100 vermelho, >=85 âmbar`.
 * Seis cópias de uma regra que agora é CADASTRADA seriam seis chances de o
 * painel discordar do documento — que foi exatamente a queixa que originou
 * isto.
 *
 * Sem faixa que contenha o valor, sai sem cor: buraco é resposta, e inventar
 * uma cor para o que ninguém classificou é dar significado a um vazio.
 */
export function estiloDaOcupacao(faixas, pct) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) {
    return { className: 'muted', style: undefined };
  }
  const cor = corDaOcupacao(faixas, pct);
  return cor
    ? { className: 'ocup-cor', style: { color: cor } }
    : { className: '', style: undefined };
}

/**
 * As faixas que vieram da tela, prontas para gravar — ou o motivo de não dar.
 *
 * A validação mora aqui e não na tela porque a rota também precisa dela: tela é
 * conveniência, e quem garante é quem grava. Sobreposição o banco também
 * recusa, mas descobrir isso por erro de constraint entrega ao usuário uma
 * frase em inglês sobre um índice gist.
 */
export function validaFaixas(entrada) {
  const limpas = [];
  for (const f of entrada ?? []) {
    const de = num(f?.pct_de);
    const ate = num(f?.pct_ate);
    const cor = normalizaCor(f?.cor);

    if (de === null && ate === null) continue;   // linha em branco: ignorada
    if (!cor) return { erro: 'Toda faixa precisa de uma cor.' };
    if (de !== null && !Number.isFinite(de)) return { erro: 'Início inválido.' };
    if (ate !== null && !Number.isFinite(ate)) return { erro: 'Fim inválido.' };
    if (de !== null && ate !== null && ate <= de) {
      return { erro: `A faixa de ${de}% a ${ate}% termina antes de começar.` };
    }
    limpas.push({
      pct_de: de, pct_ate: ate, cor,
      rotulo: String(f?.rotulo ?? '').trim().slice(0, 40) || null,
    });
  }

  // Ordenadas pelo início — nulo é menos infinito — para a conferência de
  // sobreposição ser uma passada só, e para a tela sair sempre na mesma ordem.
  limpas.sort((a, b) => (a.pct_de ?? -Infinity) - (b.pct_de ?? -Infinity));

  for (let i = 1; i < limpas.length; i++) {
    const anterior = limpas[i - 1];
    const atual = limpas[i];
    const fimAnterior = anterior.pct_ate ?? Infinity;
    const inicioAtual = atual.pct_de ?? -Infinity;
    if (inicioAtual < fimAnterior) {
      return {
        erro: 'Duas faixas cobrem o mesmo valor: '
          + `${rotuloFaixa(anterior)} e ${rotuloFaixa(atual)}. `
          + 'Uma porcentagem não pode ter duas cores.',
      };
    }
  }

  return { faixas: limpas };
}

/** "85% a 100%", "acima de 100%", "até 85%" — como a faixa se lê. */
export function rotuloFaixa(f) {
  const de = num(f?.pct_de);
  const ate = num(f?.pct_ate);
  if (de === null && ate === null) return 'qualquer valor';
  if (de === null) return `até ${ate}%`;
  if (ate === null) return `${de}% ou mais`;
  return `${de}% a ${ate}%`;
}
