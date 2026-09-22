'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGRAS, validaSenha } from '../../lib/senha';

// Trocar a própria senha — no primeiro acesso (obrigatório) e quando quiser.
//
// A regra aparece ANTES de digitar, com cada item riscando conforme a senha
// cumpre: é mais barato que devolver "falta uma maiúscula" depois do clique.
// A conferência de verdade é do servidor; aqui é só para não errar às cegas.
export default function TrocarSenha() {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [repete, setRepete] = useState('');
  const [erro, setErro] = useState(null);
  const [indo, setIndo] = useState(false);
  const router = useRouter();

  const faltas = validaSenha(nova);
  const pronta = nova.length > 0 && faltas.length === 0 && nova === repete && atual.length > 0;

  async function enviar(e) {
    e.preventDefault();
    setIndo(true);
    setErro(null);
    const r = await fetch('/api/senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atual, nova }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) {
      router.push('/');
      router.refresh();
    } else {
      setErro(j.erro ?? 'Não deu para trocar a senha.');
      setIndo(false);
    }
  }

  return (
    <div className="entrar-tela">
      <form className="entrar-caixa" onSubmit={enviar}>
        <h1>Nova senha</h1>
        <p className="entrar-sub">
          Digite a senha atual (a inicial, no primeiro acesso) e a nova.
        </p>
        <input type="password" value={atual} autoFocus autoComplete="current-password"
               onChange={(e) => setAtual(e.target.value)} placeholder="Senha atual" />
        <input type="password" value={nova} autoComplete="new-password"
               onChange={(e) => setNova(e.target.value)} placeholder="Senha nova" />
        <input type="password" value={repete} autoComplete="new-password"
               onChange={(e) => setRepete(e.target.value)} placeholder="Repita a nova" />
        <ul className="entrar-regras">
          {REGRAS.map((r) => (
            <li key={r.codigo} className={nova && !faltas.includes(r.texto) ? 'ok' : ''}>
              {r.texto}
            </li>
          ))}
          <li className={nova && nova === repete ? 'ok' : ''}>as duas iguais</li>
        </ul>
        {erro && <p className="entrar-erro">{erro}</p>}
        <button type="submit" disabled={indo || !pronta}>
          {indo ? 'Trocando…' : 'Trocar a senha'}
        </button>
      </form>
    </div>
  );
}
