'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// A tela de entrada: usuário e senha.
//
// Sem usuário, a senha é conferida contra a mestre (APP_SENHA) — é a rede para
// o gestor que esqueceu a própria senha, e o caminho para criar o primeiro
// usuário. A tela diz isso numa linha, e não esconde: quem tem a mestre já
// sabe que tem.
export default function Entrar() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [indo, setIndo] = useState(false);
  const router = useRouter();

  async function enviar(e) {
    e.preventDefault();
    setIndo(true);
    setErro(null);
    const r = await fetch('/api/entrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) {
      router.push(j.trocarSenha ? '/trocar-senha' : '/');
      router.refresh();
    } else {
      setErro(j.erro ?? 'Usuário ou senha incorretos.');
      setIndo(false);
    }
  }

  return (
    <div className="entrar-tela">
      <form className="entrar-caixa" onSubmit={enviar}>
        <h1>Capacidade</h1>
        <p className="entrar-sub">Entre com o seu usuário</p>
        <input
          type="text"
          value={login}
          autoFocus
          autoComplete="username"
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Usuário"
        />
        <input
          type="password"
          value={senha}
          autoComplete="current-password"
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
        />
        {erro && <p className="entrar-erro">{erro}</p>}
        <button type="submit" disabled={indo || !senha}>
          {indo ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="entrar-sub" style={{ marginTop: 14, fontSize: 12 }}>
          Sem usuário, a senha mestre entra. Fechar o navegador encerra a sessão.
        </p>
      </form>
    </div>
  );
}
