import { cookies } from 'next/headers';
import './globals.css';
import { COOKIE_TEMA, leTema } from '../lib/tema';

// Cada página exporta o próprio título e ele entra no lugar do %s: com três
// abas abertas, "Capacidade · Capacidade · Capacidade" não diz qual é qual.
export const metadata = {
  title: { template: '%s · Capacidade', default: 'Capacidade' },
  description: 'Planejamento de capacidade',
};

// O tema sai do cookie AQUI, no servidor, e vira atributo no <html>.
//
// Pintar no cliente faria o HTML sair claro e escurecer depois — e essa piscada
// branca é justamente o que incomoda quem escolheu o escuro. Ver lib/tema.js.
export default function RootLayout({ children }) {
  const tema = leTema(cookies().get(COOKIE_TEMA)?.value);

  return (
    <html lang="pt-BR" data-tema={tema}>
      <body>{children}</body>
    </html>
  );
}
