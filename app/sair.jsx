'use client';

import { useRouter } from 'next/navigation';

// O botão de sair: apaga o cookie e volta para a entrada.
export default function Sair({ rotulo = 'Sair', className = 'btn btn-mini' }) {
  const router = useRouter();
  async function sair() {
    await fetch('/api/sair', { method: 'POST' });
    router.push('/entrar');
    router.refresh();
  }
  return (
    <button type="button" className={className} onClick={sair}>{rotulo}</button>
  );
}
