'use client';

import { useRouter } from 'next/navigation';
import { COOKIE_TEMA, outroTema } from '../lib/tema';

// O botão de claro/escuro.
//
// Grava o cookie e manda o servidor repintar. Trocar a classe no cliente seria
// mais rápido de sentir, mas o próximo carregamento voltaria ao que o servidor
// acha — e ver a escolha se desfazer sozinha é pior que meio segundo de espera.
export default function BotaoTema({ tema }) {
  const router = useRouter();

  function troca() {
    const novo = outroTema(tema);
    // Um ano: a escolha de tema não é uma sessão, é um jeito de trabalhar.
    document.cookie =
      `${COOKIE_TEMA}=${novo}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <button type="button" className="lado-item lado-tema" onClick={troca}
            title={tema === 'escuro' ? 'Voltar ao modo claro' : 'Modo escuro'}>
      {tema === 'escuro' ? '☀' : '☾'}
      <span className="lado-tema-txt">
        {tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}
      </span>
    </button>
  );
}
