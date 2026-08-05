import { cookies } from 'next/headers';
import { COOKIE, leOrdem, ordenar } from './ordem';

// Aplica no servidor a ordenação que o usuário escolheu na tabela de cadastro.
//
// É o que faz o seletor de área do painel sair na mesma ordem da tabela de
// Áreas: sem isso, cada tela ordenaria do seu jeito e a mesma lista apareceria
// diferente em cada lugar.
export function ordenarComoNaTela(lista, entidade) {
  const guardada = cookies().get(COOKIE[entidade])?.value;
  return ordenar(lista, leOrdem(guardada));
}

// O valor cru do cookie, para a tabela abrir já com a seta na coluna certa.
// Sem isto o servidor entregaria a lista ordenada e o cabeçalho diria que não
// há ordenação nenhuma.
export function ordemGuardada(entidade) {
  return cookies().get(COOKIE[entidade])?.value ?? null;
}
