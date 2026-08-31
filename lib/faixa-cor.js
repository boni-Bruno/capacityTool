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
 * Quanto a cor contrasta com o branco do slide.
 *
 * A cor pinta o NÚMERO, e não o fundo da célula — foi assim que o Bruno pediu.
 * Isso deixa a legibilidade nas mãos de quem escolhe: amarelo claro sobre
 * branco some, e some num slide projetado, onde ninguém vai conferir. A conta é
 * a razão de contraste do sRGB, a mesma das regras de acessibilidade; a tela
 * usa isto para avisar antes de gravar, em vez de deixar descobrir na reunião.
 */
export function contrasteComBranco(cor) {
  const c = normalizaCor(cor);
  if (!c) return null;
  const canal = (i) => {
    const v = parseInt(c.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luz = 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
  return 1.05 / (luz + 0.05);
}

// 3:1 é o piso das regras de acessibilidade para texto grande. Abaixo disso a
// cor não é uma escolha de estilo, é um número que não se lê.
export const corFraca = (cor) => {
  const c = contrasteComBranco(cor);
  return c !== null && c < 3;
};

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
