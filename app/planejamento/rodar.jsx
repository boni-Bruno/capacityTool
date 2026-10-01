'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// O passo "Recalcular": UMA rodada, a desta área, ano e cenário.
//
// O laço do painel existe porque lá são dezenas de rodadas; aqui é uma, e o
// pop-up de filtros não faz sentido — a área, o ano e o cenário já foram
// escolhidos pelo fluxo. O que fica igual é a razão de a requisição ser uma só
// por rodada: função serverless tem minuto contado.
export default function Rodar({ areaId, ano, origem, ultima }) {
  const router = useRouter();
  const [estado, setEstado] = useState(null);   // null | 'rodando' | resultado
  const [erro, setErro] = useState(null);

  async function rodar() {
    setEstado('rodando');
    setErro(null);
    try {
      const r = await fetch('/api/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId, ano, origem }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setEstado(j);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
      setEstado(null);
    }
  }

  return (
    <div className="painel">
      <h2>Recalcular esta fábrica</h2>

      <p className="rodape" style={{ marginTop: 0 }}>
        O motor lê o cadastro que você acabou de revisar e grava a rodada desta
        área, deste ano e deste cenário. <strong>Nada do que foi cadastrado
        aparece no painel antes disto</strong> — cadastro não é cálculo.
        {ultima && <> A última rodada desta área foi em <strong>{ultima}</strong>.</>}
      </p>

      <div className="acoes">
        <button className="btn btn-primario" onClick={rodar}
                disabled={estado === 'rodando'}>
          {estado === 'rodando' ? 'Calculando…' : 'Recalcular'}
        </button>
        {estado && estado !== 'rodando' && (
          <span className="muted">
            {estado.fato || estado.instalada
              ? `pronto — ${Number(estado.fato ?? 0).toLocaleString('pt-BR')} `
                + 'linha(s) de capacidade gravadas'
              : 'a rodada não gerou linha nenhuma'}
          </span>
        )}
      </div>

      {estado && estado !== 'rodando' && !estado.fato && !estado.instalada && (
        <div className="aviso" style={{ marginTop: 12 }}>
          <strong>A rodada saiu vazia.</strong>
          <p style={{ margin: '6px 0 0' }}>
            Isso quer dizer que nenhum recurso desta área tem jornada neste
            cenário e ano — e é o esperado num cenário que ainda não foi
            cadastrado. Volte à etapa <strong>Jornada e regime</strong>.
          </p>
        </div>
      )}

      {erro && <p className="erro">{erro}</p>}
    </div>
  );
}
