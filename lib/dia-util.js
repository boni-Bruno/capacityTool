// Contagem de dias úteis — parte pura, sem banco.
//
// Fica separada de lib/calendario.js porque a tela recalcula ao vivo enquanto
// o usuário mexe nos pesos, e componente de cliente não pode puxar o driver.
//
// Isto NÃO entra no cálculo de capacidade. Capacidade é minuto; dia útil é
// indicador de leitura, para comparar meses e conversar com a controladoria.

// domingo .. sábado
export const PESO_PADRAO = [0, 1, 1, 1, 1, 1, 0.5];

/**
 * `contagem` vem do banco como linhas { mes, dia_semana, impacto, dias },
 * contando só os dias que o calendário de fato trabalha. O peso entra aqui,
 * porque a tela recalcula ao vivo enquanto o usuário mexe nos pesos.
 *
 * `impacto` é quanto do dia uma parada consome: 0 no dia normal, 0,5 numa
 * parada de meio dia. Ele é descontado do peso e o resultado não desce de
 * zero — parada de dia inteiro num sábado que vale 0,5 zera o sábado, não
 * devolve -0,5 para comer o dia seguinte.
 *
 * O desconto acontece por DIA e não sobre o total do mês: por isso a consulta
 * agrupa também pelo impacto, em vez de somar tudo e descontar no fim.
 *
 * Devolve um vetor de 13 posições — a 0 não é usada, para o mês bater com o
 * índice.
 */
export function diasUteisPorMes(contagem, pesos = PESO_PADRAO) {
  const meses = Array.from({ length: 13 }, () => 0);
  for (const c of contagem ?? []) {
    const peso = Number(pesos[Number(c.dia_semana)] ?? 0);
    const impacto = Number(c.impacto ?? 0);
    meses[Number(c.mes)] += Number(c.dias) * Math.max(0, peso - impacto);
  }
  return meses;
}

// 21 -> "21,0"  ·  21.5 -> "21,5"
export function formataDiasUteis(v) {
  return Number(v ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// Aceita "0,5" e "0.5". Devolve null quando não dá para ler.
export function lePeso(entrada) {
  const t = String(entrada ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}
