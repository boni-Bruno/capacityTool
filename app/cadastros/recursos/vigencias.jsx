'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Histórico cru das faixas de recurso_turno, com a ação destrutiva.
//
// Apagar aqui é diferente de "Encerrar" na tabela de cima: encerrar fecha a
// vigência e o passado continua explicável; apagar some com a faixa. Serve só
// para desfazer cadastro errado, por isso pede confirmação e fica separado.
export default function Vigencias({ linhas }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(null);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function apagar(id) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/cadastro/vigencia', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabela: 'recurso_turno', id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setConfirmando(null);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(false);
    }
  }

  if (!linhas.length) {
    return <p className="muted">Este recurso nunca teve turno vinculado.</p>;
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Turno</th>
            <th>De</th>
            <th>Até</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id}>
              <td>{l.codigo} — {l.nome}</td>
              <td className="muted">{l.inicio}</td>
              <td className="muted">
                {l.fim ?? <span className="selo rodizio">em aberto</span>}
              </td>
              <td className="acoes">
                {confirmando === l.id ? (
                  <>
                    <span className="erro" style={{ margin: 0 }}>Apagar de vez?</span>
                    <button
                      className="btn btn-mini btn-perigo"
                      disabled={ocupado}
                      onClick={() => apagar(l.id)}
                    >
                      {ocupado ? '…' : 'Apagar'}
                    </button>
                    <button
                      className="btn btn-mini"
                      disabled={ocupado}
                      onClick={() => { setConfirmando(null); setErro(null); }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-mini"
                    onClick={() => { setConfirmando(l.id); setErro(null); }}
                  >
                    Apagar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {erro && <p className="erro">{erro}</p>}

      <p className="rodape">
        Apagar remove a faixa do cadastro — use só para desfazer engano. Para
        parar um turno de rodar sem perder o histórico, use <strong>Encerrar</strong>
        {' '}na tabela acima. A rodada de cálculo já gravada não muda, mas um
        recálculo daquelas datas passa a dar outro número.
      </p>
    </>
  );
}
