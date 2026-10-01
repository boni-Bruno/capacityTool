'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// A BARRA DE ETAPAS e o botão que confirma.
//
// Confirmar é ATO EXPLÍCITO, e não efeito de ter aberto a tela. Passar por uma
// etapa não é tê-la revisado — e é exatamente isso que este fluxo existe para
// garantir. Por isso o botão grava e só depois avança.
//
// E dá para DESMARCAR: quem percebeu que confirmou sem olhar precisa poder
// voltar atrás, senão a próxima pessoa confia num visto que ninguém deu.

export default function Etapas({
  passos, exigidos, feitos, atual, versaoId, areaId, base, proximo,
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  const feito = feitos.includes(atual);
  const naOrdem = passos.filter((p) => exigidos.includes(p.codigo));
  const i = naOrdem.findIndex((p) => p.codigo === atual);
  const anterior = i > 0 ? naOrdem[i - 1].codigo : null;

  const ir = (passo) => router.push(`${base}&passo=${passo}`);

  async function marcar(valor) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/cadastro/passo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versao_id: versaoId, area_id: areaId, passo: atual, feito: valor,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      router.refresh();
      // Avançar só ao confirmar. Desmarcar fica na etapa — quem desmarcou está
      // dizendo que vai olhar de novo.
      if (valor && proximo) ir(proximo);
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      {/* A TRILHA. Clicável de propósito: quem lembrou de algo da etapa 2 na 4
          volta sem perder o que já confirmou. */}
      <div className="trilha">
        {naOrdem.map((p, n) => {
          const pronto = feitos.includes(p.codigo);
          const aqui = p.codigo === atual;
          return (
            <button key={p.codigo} type="button" title={p.ajuda}
                    className={'trilha-passo'
                      + (aqui ? ' trilha-aqui' : '')
                      + (pronto ? ' trilha-pronto' : '')}
                    onClick={() => ir(p.codigo)}>
              <span className="trilha-n">{pronto ? '✓' : n + 1}</span>
              {p.rotulo}
            </button>
          );
        })}
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className="acoes" style={{ marginTop: 18 }}>
        {anterior && (
          <button type="button" className="btn" disabled={ocupado}
                  onClick={() => ir(anterior)}>
            ← Voltar
          </button>
        )}

        {!feito ? (
          <button type="button" className="btn btn-primario" disabled={ocupado}
                  onClick={() => marcar(true)}>
            {ocupado ? 'Gravando…'
              : proximo ? 'Confirmei esta etapa →' : 'Confirmei — concluir a área'}
          </button>
        ) : (
          <>
            <span className="selo ok">etapa confirmada</span>
            {proximo && (
              <button type="button" className="btn btn-primario"
                      onClick={() => ir(proximo)}>
                Próxima etapa →
              </button>
            )}
            <button type="button" className="btn btn-mini" disabled={ocupado}
                    title="Tirar a confirmação e revisar de novo"
                    onClick={() => marcar(false)}>
              desmarcar
            </button>
          </>
        )}

        <a className="btn btn-mini" href={base.split('&area=')[0]}>
          trocar de fábrica
        </a>
      </div>
    </>
  );
}
