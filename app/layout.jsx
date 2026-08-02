import './globals.css';

export const metadata = {
  title: 'Capacidade',
  description: 'Planejamento de capacidade',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
