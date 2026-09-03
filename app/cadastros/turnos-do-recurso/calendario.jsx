'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS } from '../../../lib/dias';

// Regime de dias do recurso. Fica junto da matriz de turnos porque é assim que
// quem cadastra pensa: "essa máquina trabalha em rodízio" é da mesma família
// de decisão que "essa máquina roda o 3º turno".
//
// Não virou coluna da matriz porque não é um turno: os regimes são exclusivos
// entre si, e o que eles definem é em que DIAS o recurso pode rodar, não uma
// jornada a mais.
export default function Calendario({ recursoId, opcoes, alvos = null }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [andamento, setAndamento] = useState(null);
  const [ok, setOk] = useState(null);

  // EM LOTE não existe "o atual": os 48 recursos podem estar em regimes
  // diferentes, e destacar o de um deles diria que todos estão nele. Nenhum
  // botão fica marcado, e o que se lê é "escolha o que passa a valer".
  const lote = Array.isArray(alvos);
  const atual = lote ? null : opcoes.find((o) => o.atual);

  const grava = async (recurso, calendarioId) => {
    const r = await fetch('/api/cadastro/recurso-calendario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recurso_id: recurso, calendario_id: calendarioId }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro);
  };

  async function escolher(calendarioId) {
    if (!lote && String(calendarioId) === String(atual?.id)) return;
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      if (!lote) {
        await grava(recursoId, calendarioId);
      } else {
        // Um por requisição, com o laço aqui: o mesmo caminho do resto do
        // projeto, e pela mesma razão — quarenta e oito numa requisição só
        // estouram o tempo da função no meio.
        for (const [i, a] of alvos.entries()) {
          setAndamento({ feitos: i, total: alvos.length, nome: a.nome });
          // eslint-disable-next-line no-await-in-loop
          await grava(a.id, calendarioId);
        }
        setOk(`Regime aplicado em ${alvos.length} recursos.`);
      }
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setAndamento(null);
      setSalvando(false);
    }
  }

  if (!opcoes.length) {
    return <p className="muted">Nenhum calendário cadastrado nesta planta.</p>;
  }

  return (
    <>
      <div className="regimes">
        {opcoes.map((o) => (
          <button
            key={o.id}
            className={'regime' + (!lote && o.atual ? ' regime-ativo' : '')}
            disabled={salvando}
            onClick={() => escolher(o.id)}
          >
            <span className="regime-nome">{o.nome}</span>
            <span className="regime-dias">{descreveDias(o.dias)}</span>
          </button>
        ))}
      </div>

      {(andamento || ok) && (
        <p className="rodape" style={{ marginTop: 8 }}>
          {andamento
            ? `${andamento.feitos + 1} de ${andamento.total} · ${andamento.nome}`
            : ok}
        </p>
      )}

      {erro && <p className="erro">{erro}</p>}

      <p className="rodape">
        {lote && (
          <>
            <strong>
              Clicar num regime aplica nos {alvos.length} recursos filtrados, na
              hora e sem confirmar de novo.
            </strong>
            {' '}Nenhum aparece marcado porque os recursos do lote podem estar em
            regimes diferentes — destacar o de um deles diria que todos estão
            nele.{' '}
          </>
        )}
        O regime define em que <strong>dias</strong> o recurso pode rodar.
        Rodízio inclui domingo — na empresa quem faz rodízio é a pessoa, com
        folgas em dias diferentes se cobrindo, e a máquina nunca para. Os turnos
        marcados abaixo só produzem capacidade nos dias que o regime permite.
      </p>
    </>
  );
}

// dias vem do banco como '0,1,2,3,4,5,6'. Vira "domingo a sábado" quando é
// uma sequência inteira, senão lista os dias.
function descreveDias(dias) {
  if (!dias) return 'nenhum dia configurado';

  const n = dias.split(',').map(Number).sort((a, b) => a - b);
  if (!n.length) return 'nenhum dia configurado';
  if (n.length === 7) return 'todos os dias';

  const sequencia = n.every((d, i) => i === 0 || d === n[i - 1] + 1);
  if (sequencia && n.length > 2) return `${DIAS[n[0]]} a ${DIAS[n[n.length - 1]]}`;
  return n.map((d) => DIAS[d]).join(', ');
}
