'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Entrar() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);
  const [indo, setIndo] = useState(false);
  const router = useRouter();

  async function enviar(e) {
    e.preventDefault();
    setIndo(true);
    setErro(false);
    const r = await fetch('/api/entrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha }),
    });
    if (r.ok) {
      router.push('/');
      router.refresh();
    } else {
      setErro(true);
      setIndo(false);
    }
  }

  return (
    <div className="entrar-tela">
      <form className="entrar-caixa" onSubmit={enviar}>
        <h1>Capacidade</h1>
        <p className="entrar-sub">Digite a senha para acessar</p>
        <input
          type="password"
          value={senha}
          autoFocus
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
        />
        {erro && <p className="entrar-erro">Senha incorreta.</p>}
        <button type="submit" disabled={indo || !senha}>
          {indo ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
