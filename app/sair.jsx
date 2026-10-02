'use client';

import { useRouter } from 'next/navigation';

// O botão de sair: apaga o cookie e vai para a tela de despedida.
//
// NÃO VAI PARA `/entrar`, e isso é o conserto de 02/10/2026: `/entrar`
// redireciona para o Hub, o Hub ainda tem sessão e devolve a pessoa logada —
// clicar em Sair parecia recarregar a tela. `/saiu` não redireciona ninguém e
// explica que a sessão do portal continua aberta. Ver app/saiu/page.jsx.
export default function Sair({ rotulo = 'Sair', className = 'btn btn-mini' }) {
  const router = useRouter();
  async function sair() {
    await fetch('/api/sair', { method: 'POST' });
    // `replace`, e não `push`: o botão Voltar do navegador levaria de volta à
    // tela de dentro, que sem cookie manda para o Hub e entra de novo.
    router.replace('/saiu');
    router.refresh();
  }
  return (
    <button type="button" className={className} onClick={sair}>{rotulo}</button>
  );
}
