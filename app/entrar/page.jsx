import { redirect } from 'next/navigation';

import { enderecoDoHub, entradaLocalLigada } from '../../lib/hub';
import Formulario from './formulario';

// A tela de entrada existe, mas normalmente ninguém a vê.
//
// Desde 22/09/2026 a porta é o Hub S&OP: quem chega aqui sem sessão é mandado
// para lá pelo middleware, e quem digita /entrar na barra cai na mesma coisa.
// O formulário só aparece com ENTRADA_LOCAL=1 — a escotilha para o dia em que
// o Hub estiver fora do ar (ver lib/hub.js).
//
// A casca é server component porque a decisão lê variável de ambiente. O
// formulário continua cliente, em formulario.jsx.

export const dynamic = 'force-dynamic';

export default function Page() {
  if (!entradaLocalLigada()) {
    const hub = enderecoDoHub('/');
    // Sem HUB_URL não há para onde mandar, e aí o formulário é a única saída —
    // mesmo fail-safe do middleware, pelo mesmo motivo: um deploy sem a
    // variável não pode deixar o app inacessível.
    if (hub) redirect(hub);
  }

  return <Formulario />;
}
