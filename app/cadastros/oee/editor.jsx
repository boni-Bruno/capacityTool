'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MESES } from '../../../lib/dias';
import Alvos from '../alvos';

// Um mês por linha, o OEE na coluna. Mesma forma da matriz de turnos, para não
// ter duas gramáticas diferentes de "configurar o ano de um recurso".
//
// Salva em lote: a tela junta meses vizinhos com o mesmo valor numa faixa só
// antes de gravar, então o ano inteiro com 85% vira uma linha, não doze.
export default function EditorOee({
  recursoId, ano, origem, inicial, alvos = null,
}) {
  const router = useRouter();
  const [meses, setMeses] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [fora, setFora] = useState(() => new Set());

  // EM LOTE a tabela não é de ninguém: é o molde que vai para todos os recursos
  // do filtro, e ela nasce em branco pela mesma razão da matriz de turnos —
  // herdar a de um recurso faria a tela propor, sem avisar, o OEE de uma
  // máquina para as outras.
  const lote = Array.isArray(alvos);
  const dentro = lote ? alvos.filter((a) => !fora.has(a.id)) : [];

  const sujo = useMemo(
    () => MESES.slice(1).some((_, i) =>
      String(meses[i + 1] ?? '') !== String(inicial[i + 1] ?? '')),
    [meses, inicial]);

  function muda(mes, valor) {
    setMeses((m) => ({ ...m, [mes]: valor }));
    setOk(null);
  }

  // Preencher o ano todo a partir de um mês é o caso comum: o OEE costuma ser
  // uma meta única, não doze números diferentes.
  function repetir(mes) {
    const v = meses[mes];
    setMeses(Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [i + 1, v])));
    setOk(null);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      // O laço do lote mora no SERVIDOR, ao contrário do de turnos. Aqui cada
      // recurso é uma escrita curta — apagar as faixas do ano e regravá-las —,
      // não duas consultas e uma transação; e a rota já sabia fazer isso desde
      // que o "Aplicar em vários" existia.
      const corpo = lote
        ? { acao: 'lote', ano, origem, meses, recursos: dentro.map((a) => a.id) }
        : { recurso_id: recursoId, ano, origem, meses };

      const r = await fetch('/api/cadastro/oee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setOk(lote
        ? `Aplicado em ${j.recursos} recurso(s), ${j.meses} mês(es).`
        : j.faixas === 0
          ? 'Nenhum OEE cadastrado neste ano.'
          : `Salvo em ${j.faixas} faixa${j.faixas > 1 ? 's' : ''} de vigência.`);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <table className="tabela-oee">
        <thead>
          <tr>
            <th>Mês</th>
            <th>OEE</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {MESES.slice(1).map((rotulo, i) => {
            const mes = i + 1;
            return (
              <tr key={mes}>
                <td className="matriz-mes">{rotulo}</td>
                <td>
                  <div className="campo-pct">
                    <input
                      type="text" inputMode="decimal" placeholder="—"
                      value={meses[mes] ?? ''}
                      onChange={(e) => muda(mes, e.target.value)}
                    />
                    <span className="sufixo">%</span>
                  </div>
                </td>
                <td className="acoes">
                  {meses[mes] !== '' && meses[mes] !== undefined && (
                    <button className="btn btn-mini" onClick={() => repetir(mes)}
                            title="Repetir este valor em todos os meses">
                      repetir no ano
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {lote && (
        <Alvos alvos={alvos} fora={fora}
               onAlterna={(id) => {
                 setFora((f) => {
                   const novo = new Set(f);
                   if (novo.has(id)) novo.delete(id); else novo.add(id);
                   return novo;
                 });
                 setOk(null);
               }} />
      )}

      <div className="acoes" style={{ marginTop: 16 }}>
        <button className="btn btn-primario" onClick={salvar}
                disabled={!sujo || salvando || (lote && dentro.length === 0)}>
          {salvando
            ? (lote ? 'Aplicando…' : 'Salvando…')
            : (lote ? `Aplicar em ${dentro.length} recurso(s)` : 'Salvar')}
        </button>
        {sujo && !salvando && <span className="muted">alterações não salvas</span>}
        {lote && dentro.length === 0 && (
          <span className="muted">nenhum recurso no lote</span>
        )}
        {ok && <span className="muted">{ok}</span>}
        {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
      </div>

      <p className="rodape">
        Aceita <code>85</code>, <code>85,5</code> ou <code>0,855</code> — acima
        de 1 é lido como porcentagem. Mês em branco fica sem OEE cadastrado, e
        aí o motor usa 100% naquele período. Salvar aplica o ano de {ano}; o que
        estiver configurado em outros anos não é afetado.
      </p>
    </>
  );
}
