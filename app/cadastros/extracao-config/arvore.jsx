'use client';

import { useMemo, useState } from 'react';

// O DRILL-DOWN: planta › área › CC.
//
// Marcar uma planta marca as áreas dela; marcar uma área marca os CCs dela.
// A MARCA MORA NA FOLHA — no CC —, e os níveis de cima só mostram o que a
// folha diz. Guardar marcação em três níveis daria três verdades sobre a mesma
// escolha, e a primeira divergência seria invisível: a tela mostrando a planta
// marcada e a exportação levando metade dela.
//
// O botão de cada nível é um só e troca de nome: com tudo marcado ele
// desmarca. Dois botões lado a lado obrigam a ler qual é qual antes de clicar.

const chaveDo = (l) => `${l.area_id}|${l.cc}`;

export default function Arvore({ linhas, onMudar }) {
  const [marcados, setMarcados] = useState(() => new Set());
  const [abertas, setAbertas] = useState(() => new Set());

  // planta › área › CC, montada uma vez. A consulta já vem ordenada.
  const plantas = useMemo(() => {
    const m = new Map();
    for (const l of linhas) {
      if (!m.has(l.planta_id)) {
        m.set(l.planta_id, { id: l.planta_id, nome: l.planta, areas: new Map() });
      }
      const p = m.get(l.planta_id);
      if (!p.areas.has(l.area_id)) {
        p.areas.set(l.area_id, { id: l.area_id, nome: l.area, ccs: [] });
      }
      p.areas.get(l.area_id).ccs.push(l);
    }
    return [...m.values()].map((p) => ({ ...p, areas: [...p.areas.values()] }));
  }, [linhas]);

  function aplica(novo) {
    setMarcados(novo);
    // O que sai daqui é o que a exportação usa: as áreas alcançadas e os CCs
    // escolhidos, já resolvidos. A tela é quem sabe a árvore.
    const escolhidas = linhas.filter((l) => novo.has(chaveDo(l)));
    onMudar?.({
      areas: [...new Set(escolhidas.map((l) => l.area_id))],
      ccs: [...new Set(escolhidas.map((l) => l.cc))],
      recursos: escolhidas.reduce((s, l) => s + Number(l.recursos ?? 0), 0),
      folhas: escolhidas.length,
    });
  }

  const alterna = (chaves) => {
    const novo = new Set(marcados);
    const todas = chaves.every((k) => novo.has(k));
    for (const k of chaves) { if (todas) novo.delete(k); else novo.add(k); }
    aplica(novo);
  };

  const chavesDaArea = (a) => a.ccs.map(chaveDo);
  const chavesDaPlanta = (p) => p.areas.flatMap(chavesDaArea);
  const todas = linhas.map(chaveDo);

  const marcadoTudo = (chaves) =>
    chaves.length > 0 && chaves.every((k) => marcados.has(k));
  const marcadoParte = (chaves) =>
    chaves.some((k) => marcados.has(k)) && !marcadoTudo(chaves);

  const Botao = ({ chaves, rotulo }) => (
    <button type="button" className="btn btn-mini"
            onClick={() => alterna(chaves)}>
      {marcadoTudo(chaves) ? `desmarcar ${rotulo}` : `marcar ${rotulo}`}
    </button>
  );

  return (
    <div className="arvore">
      <div className="acoes" style={{ marginBottom: 12 }}>
        <Botao chaves={todas} rotulo="tudo" />
        <span className="muted" style={{ fontSize: 13 }}>
          {marcados.size
            ? `${marcados.size} de ${todas.length} combinações de área e CC`
            : 'nada escolhido — a exportação precisa de ao menos uma'}
        </span>
      </div>

      {plantas.map((p) => {
        const cp = chavesDaPlanta(p);
        return (
          <div key={p.id} className="arvore-planta">
            <div className="arvore-linha">
              <input type="checkbox" checked={marcadoTudo(cp)}
                     ref={(el) => { if (el) el.indeterminate = marcadoParte(cp); }}
                     onChange={() => alterna(cp)} />
              <strong>{p.nome}</strong>
              <span className="muted">
                {p.areas.length} área(s) · {cp.length} CC(s)
              </span>
              <Botao chaves={cp} rotulo="a planta" />
            </div>

            {p.areas.map((a) => {
              const ca = chavesDaArea(a);
              const aberta = abertas.has(a.id);
              return (
                <div key={a.id} className="arvore-area">
                  <div className="arvore-linha">
                    <input type="checkbox" checked={marcadoTudo(ca)}
                           ref={(el) => {
                             if (el) el.indeterminate = marcadoParte(ca);
                           }}
                           onChange={() => alterna(ca)} />
                    <button type="button" className="link-linha"
                            onClick={() => setAbertas((s) => {
                              const n = new Set(s);
                              if (n.has(a.id)) n.delete(a.id); else n.add(a.id);
                              return n;
                            })}>
                      {aberta ? '▾' : '▸'} {a.nome}
                    </button>
                    <span className="muted">{ca.length} CC(s)</span>
                    <Botao chaves={ca} rotulo="a área" />
                  </div>

                  {/* Os CCs ficam recolhidos: são o nível mais numeroso, e
                      quem escolhe a área inteira não precisa vê-los. */}
                  {aberta && (
                    <div className="arvore-ccs">
                      {a.ccs.map((l) => {
                        const k = chaveDo(l);
                        return (
                          <label key={k} className="filtro-item">
                            <input type="checkbox" checked={marcados.has(k)}
                                   onChange={() => alterna([k])} />
                            <span>
                              CC {l.cc}
                              <span className="muted"> · {l.recursos} recurso(s)</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
