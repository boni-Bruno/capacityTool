'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

// De onde cada CT sem demanda própria tira o índice de conversão.
//
// Fica aqui, e não no painel, porque é cadastro: o painel lê, esta tela decide.
// E fica colado na fila dos órfãos porque essa fila JÁ é a lista de trabalho —
// ver o problema e resolvê-lo na mesma linha.
//
// A taxa de cada doador aparece junto de propósito. A dispersão dentro de um
// mesmo CC chega a quatro vezes — no CC 401 os irmãos vão de 36,1 a 149,5 m/h —
// e escolher sem ver isso é escolher no escuro.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');
const dec = (n) => Number(n ?? 0).toLocaleString('pt-BR',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OrigemDoIndice({ cargaId, orfaos, doadores, comDemanda }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(null);
  const [erro, setErro] = useState(null);

  // Agrupa os doadores por CC para o seletor sair legível: o irmão do mesmo CC
  // é quase sempre a escolha certa, e ele precisa estar no topo.
  const porCc = useMemo(() => {
    const m = new Map();
    for (const d of doadores) {
      if (!m.has(d.cc)) m.set(d.cc, []);
      m.get(d.cc).push(d);
    }
    return m;
  }, [doadores]);

  async function chamar(metodo, corpo, chave) {
    setOcupado(chave);
    setErro(null);
    try {
      const r = await fetch('/api/demanda-origem', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(null);
    }
  }

  function escolher(ct, escolha) {
    if (escolha === '') return chamar('DELETE', { ct }, ct);
    if (escolha === 'NENHUM') return chamar('POST', { ct, tipo: 'NENHUM' }, ct);
    const [tipo, valor] = escolha.split(':');
    return chamar('POST', { ct, tipo, valor }, ct);
  }

  const valorAtual = (o) =>
    (!o.tipo ? '' : o.tipo === 'NENHUM' ? 'NENHUM' : `${o.tipo}:${o.valor}`);

  const pendentes = orfaos.filter((o) => !o.tipo).length;
  const ccsComOrfao = [...new Set(orfaos.filter((o) => !o.tipo && o.cc_irmaos > 0)
                                        .map((o) => o.cc))];

  if (!orfaos.length && !comDemanda.length) return null;

  return (
    <div className="painel">
      <h2>De onde vem o índice</h2>
      <p className="rodape" style={{ margin: '0 0 12px' }}>
        Qualquer centro de trabalho pode usar o mix de outro CT ou a média de um
        CC — não só os sem demanda própria. O caso clássico é a regra de fluxo:
        a prioridade manda a carga do orçamento para um irmão, mas quem produz é
        ele, então o mix que o descreve está na demanda do outro.
        {' '}<strong>Empresta o índice, nunca a demanda</strong>: o CT que herda
        continua com a carga que tem, senão a demanda da fábrica dobraria.
        {' '}E a regra ganha da demanda própria enquanto existir — herança
        descreve fluxo, e fluxo não muda de mês para mês.
      </p>

      {orfaos.length > 0 && (
        <>
          <p className="campo-rot">
            {fmt(orfaos.length)} centros de trabalho sem demanda própria
            {pendentes > 0 && ` · ${fmt(pendentes)} ainda sem decisão`}
          </p>

          {ccsComOrfao.length > 0 && (
            <div className="acoes" style={{ margin: '8px 0 12px' }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Aplicar a média do CC a todos os pendentes de:
              </span>
              {ccsComOrfao.map((cc) => (
                <button key={cc} className="btn btn-mini" disabled={ocupado !== null}
                        onClick={() => chamar('POST',
                          { acao: 'lote', carga_id: cargaId, cc }, `cc-${cc}`)}>
                  CC {cc}
                </button>
              ))}
            </div>
          )}

          <div className="grade-rolagem">
            <table>
              <thead>
                <tr>
                  <th>CT</th>
                  <th>Máquinas</th>
                  <th className="num">CC tem</th>
                  <th className="num">média do CC</th>
                  <th>De onde herda</th>
                </tr>
              </thead>
              <tbody>
                {orfaos.map((o) => (
                  <tr key={o.ct} className={o.tipo ? '' : 'linha-vazia'}>
                    <td><code>{o.ct}</code></td>
                    <td className="muted">{o.maquinas}</td>
                    <td className="num muted">
                      {o.cc_irmaos > 0
                        ? `${fmt(o.cc_irmaos)} CT · ${fmt(o.cc_horas)} h`
                        : '—'}
                    </td>
                    <td className="num">
                      {o.cc_irmaos > 0 ? `${dec(o.cc_metros_por_hora)} m/h` : '—'}
                    </td>
                    <td>
                      <select value={valorAtual(o)} disabled={ocupado !== null}
                              onChange={(e) => escolher(o.ct, e.target.value)}>
                        <option value="">sem decisão — converte para zero</option>
                        <option value="NENHUM">
                          não herda (decidido)
                        </option>
                        {o.cc_irmaos > 0 && (
                          <option value={`CC:${o.cc}`}>
                            média do CC {o.cc} — {dec(o.cc_metros_por_hora)} m/h
                          </option>
                        )}
                        {[...porCc.entries()].map(([cc, lista]) => (
                          <optgroup key={cc}
                                    label={cc === o.cc ? `CC ${cc} (mesmo CC)` : `CC ${cc}`}>
                            {lista.map((d) => (
                              <option key={d.ct} value={`CT:${d.ct}`}>
                                {d.ct} — {dec(d.metros_por_hora)}
                                {d.unidade === 'KG' ? ' kg/h' : ' m/h'}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rodape">
            A <strong>média do CC</strong> é conveniente e grosseira: ela esconde
            a dispersão entre os irmãos, que chega a quatro vezes. Sempre que der
            para apontar o CT irmão certo, aponte — a lista mostra a taxa de cada
            um justamente para essa escolha ser informada.
            {' '}O irmão pode ser de outro CC.
            {' '}<strong>Não herda (decidido)</strong> tira o CT da fila sem
            inventar número: é para a máquina que realmente não produz naquele
            cenário.
          </p>
        </>
      )}

      {comDemanda.length > 0 && (
        <>
          <p className="campo-rot" style={{ marginTop: 14 }}>
            {fmt(comDemanda.length)} centros de trabalho com demanda própria
            {comDemanda.some((x) => x.tipo)
              && ` · ${fmt(comDemanda.filter((x) => x.tipo).length)} usando mix de outro`}
          </p>
          <div className="grade-rolagem">
            <table>
              <thead>
                <tr>
                  <th>CT</th>
                  <th>Máquinas</th>
                  <th className="num">Demanda própria</th>
                  <th className="num">Taxa própria</th>
                  <th>Converte com</th>
                </tr>
              </thead>
              <tbody>
                {comDemanda.map((x) => (
                  <tr key={x.ct}>
                    <td><code>{x.ct}</code></td>
                    <td className="muted">{x.maquinas}</td>
                    <td className="num">{fmt(x.propria_horas)} h</td>
                    <td className="num">{dec(x.propria_metros_por_hora)} m/h</td>
                    <td>
                      {/* Voltar para "a própria" é apagar a regra, não gravar
                          uma: ausência de regra JÁ significa própria, e um
                          registro dizendo o default viraria fila de revisão
                          sem nada para revisar. */}
                      <select value={x.tipo && x.tipo !== 'NENHUM'
                                       ? `${x.tipo}:${x.valor}` : ''}
                              disabled={ocupado !== null}
                              onChange={(e) => (e.target.value === ''
                                ? chamar('DELETE', { ct: x.ct }, x.ct)
                                : escolher(x.ct, e.target.value))}>
                        <option value="">
                          a própria — {dec(x.propria_metros_por_hora)} m/h
                        </option>
                        <optgroup label={`média do CC`}>
                          <option value={`CC:${x.cc}`}>
                            CC {x.cc}
                          </option>
                        </optgroup>
                        {[...porCc.entries()].map(([cc, lista]) => (
                          <optgroup key={cc}
                                    label={cc === x.cc ? `CC ${cc} (mesmo CC)` : `CC ${cc}`}>
                            {lista.filter((d) => d.ct !== x.ct).map((d) => (
                              <option key={d.ct} value={`CT:${d.ct}`}>
                                {d.ct} — {dec(d.metros_por_hora)}
                                {d.unidade === 'KG' ? ' kg/h' : ' m/h'}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rodape">
            A taxa própria fica escrita na primeira opção de propósito: trocar o
            mix de casa pelo do vizinho é uma comparação, e ela se faz com os
            dois números à vista. Enquanto a regra existir, ela ganha da demanda
            própria — inclusive nos meses em que o CT tiver carga. Para voltar,
            escolha <strong>a própria</strong>.
          </p>
        </>
      )}

      {erro && <p className="erro">{erro}</p>}
    </div>
  );
}
