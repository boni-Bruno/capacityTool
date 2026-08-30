'use client';

import { useEffect } from 'react';

// Abre o diálogo de impressão sozinho.
//
// A aba foi aberta com esse propósito único; obrigar a um Ctrl+P depois seria
// pedir que a pessoa lembrasse por que a aba abriu. O botão fica para quem
// cancelou e mudou de ideia — e ele some no papel.
export default function Imprime({ children }) {
  useEffect(() => {
    // Depois da pintura: chamar print() antes disso imprime a página em branco
    // em alguns navegadores.
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="folha">
      <button type="button" className="btn btn-primario nao-imprime"
              onClick={() => window.print()}>
        Salvar como PDF
      </button>
      {children}
    </div>
  );
}
