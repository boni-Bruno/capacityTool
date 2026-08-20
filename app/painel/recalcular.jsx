'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ORIGENS, rotuloOrigem } from '../../lib/origens';
import { rotuloArea } from '../../lib/dias';

// =============================================================================
// RECALCULAR TUDO
//
// Uma pressão do botão refaz TODAS as rodadas: cada área, cada ano, cada origem
// de OEE. Antes ele recalculava só o que estava na tela, e manter a fábrica
// inteira atualizada exigia passear por área e ano um a um — o que garante que
// alguém esqueça uma combinação, e a extração leve número velho misturado com
// número novo sem nada denunciar.
//
// O LAÇO MORA NO NAVEGADOR, e não no servidor, pela mesma razão da importação
// de demanda: uma função serverless tem minuto contado, e trinta rodadas numa
// requisição só estouram o limite no meio, deixando metade calculada e nenhum
// aviso. Uma requisição por rodada é o mesmo caminho que já funciona hoje,
// repetido — e de quebra dá para mostrar em que passo está e parar no meio.
//
// Área sem recurso nenhum não entra: a rodada dela só produziria zero linhas,
// e o tempo é melhor gasto nas que têm o que calcular.
// =============================================================================

export default function RecalcularTudo({ areas, anos }) {
  const router = useRouter();
  const [estado, setEstado] = useState(null);   // null = parado
  const parar = useRef(false);

  // O plano completo, montado aqui para ser contável antes de começar: quem
  // clica precisa saber que são trinta rodadas e não uma.
  const plano = [];
  for (const area of areas.filter((a) => Number(a.recursos) > 0)) {
    for (const ano of anos) {
      for (const origem of ORIGENS) plano.push({ area, ano, origem });
    }
  }

  async function rodar() {
    parar.current = false;
    setEstado({ feitos: 0, total: plano.length, atual: plano[0], vazias: [],
                falhas: [], terminou: false });

    const vazias = [];
    const falhas = [];

    for (const [i, passo] of plano.entries()) {
      if (parar.current) break;
      setEstado((e) => ({ ...e, atual: passo, feitos: i }));

      try {
        const r = await fetch('/api/recalcular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            areaId: passo.area.id, ano: passo.ano, origem: passo.origem,
          }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.erro);
        // Rodada sem linha não é falha: é área cujos recursos não têm operação
        // ou turno naquele ano. Vai para uma lista à parte, e a tela conta as
        // duas coisas separadas — misturá-las mandaria caçar erro onde não há.
        if (!j.instalada) vazias.push(passo);
      } catch (e) {
        falhas.push({ passo, erro: e.message ?? 'falhou' });
      }
    }

    setEstado((e) => ({
      ...e, feitos: parar.current ? e.feitos : plano.length,
      vazias, falhas, terminou: true, interrompido: parar.current,
    }));
    router.refresh();
  }

  const rodando = estado && !estado.terminou;
  const pct = estado ? Math.round((estado.feitos * 100) / estado.total) : 0;

  return (
    <>
      <button className="btn" onClick={rodar} disabled={rodando}
              title={`Recalcular as ${plano.length} rodadas: cada área, cada `
                     + 'ano, meta e simulado'}>
        {rodando ? 'Calculando…' : 'Recalcular tudo'}
      </button>

      {rodando && (
        <button className="btn btn-mini" onClick={() => { parar.current = true; }}>
          parar
        </button>
      )}

      {estado && (
        <div className="recalc">
          <div className="recalc-barra">
            <div className="recalc-fita" style={{ width: `${pct}%` }} />
          </div>

          {!estado.terminou ? (
            <p className="recalc-txt">
              {estado.feitos + 1} de {estado.total} ·{' '}
              <strong>{rotuloArea(estado.atual.area)}</strong> {estado.atual.ano}
              {' '}· OEE {rotuloOrigem(estado.atual.origem)}
            </p>
          ) : (
            <p className="recalc-txt">
              {estado.interrompido
                ? `Parado em ${estado.feitos} de ${estado.total}.`
                : `${estado.total} rodadas atualizadas.`}
              {estado.vazias.length > 0
                && ` ${estado.vazias.length} sem linha nenhuma (área sem `
                   + 'recurso em operação naquele ano).'}
              {estado.falhas.length > 0 && (
                <span className="recalc-falha">
                  {' '}{estado.falhas.length} falharam:{' '}
                  {estado.falhas.slice(0, 3).map((f) =>
                    `${rotuloArea(f.passo.area)} ${f.passo.ano}`).join(', ')}
                  {estado.falhas.length > 3 && '…'}
                  {' — '}{estado.falhas[0].erro}
                </span>
              )}
              {' '}
              <button type="button" className="link-linha"
                      onClick={() => setEstado(null)}>
                fechar
              </button>
            </p>
          )}
        </div>
      )}
    </>
  );
}
