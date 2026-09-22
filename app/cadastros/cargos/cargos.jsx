'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// A tela de cargos: a lista à esquerda, o editor à direita.
//
// A grade é telas × ver/editar. Marcar EDITAR marca VER junto e desmarcar VER
// desmarca EDITAR — é a regra do motor (lib/permissoes.js, editar implica
// ver), e a tela só a reflete na hora, para ninguém gravar um cargo que
// grava sem enxergar e descobrir na primeira reclamação.

async function pede(metodo, corpo) {
  const r = await fetch('/api/cadastro/cargo', {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({ ok: false, erro: `Servidor respondeu ${r.status}.` }));
  if (!j.ok) throw new Error(j.erro ?? 'Falhou');
  return j;
}

const NOVO = 'novo';

export default function Cargos({ cargos, telas, avulsas }) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState(cargos[0]?.id ?? NOVO);
  const [nome, setNome] = useState(cargos[0]?.nome ?? '');
  const [marcadas, setMarcadas] = useState(() => new Set(cargos[0]?.permissoes ?? []));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const cargo = cargos.find((c) => c.id === escolhido) ?? null;
  const protegido = Boolean(cargo?.protegido);

  function escolhe(id) {
    const c = cargos.find((x) => x.id === id);
    setEscolhido(id);
    setNome(c?.nome ?? '');
    setMarcadas(new Set(c?.permissoes ?? []));
    setErro(null);
    setOk(null);
  }

  function alterna(codigo) {
    setMarcadas((s) => {
      const n = new Set(s);
      if (n.has(codigo)) {
        n.delete(codigo);
        if (codigo.endsWith('.ver')) n.delete(codigo.replace(/\.ver$/, '.editar'));
      } else {
        n.add(codigo);
        if (codigo.endsWith('.editar')) n.add(codigo.replace(/\.editar$/, '.ver'));
      }
      return n;
    });
    setOk(null);
  }

  function marcaGrupo(grupo, sufixo, ligar) {
    setMarcadas((s) => {
      const n = new Set(s);
      for (const t of telas.filter((x) => x.grupo === grupo)) {
        const c = `${t.codigo}.${sufixo}`;
        if (ligar) {
          n.add(c);
          if (sufixo === 'editar') n.add(`${t.codigo}.ver`);
        } else {
          n.delete(c);
          if (sufixo === 'ver') n.delete(`${t.codigo}.editar`);
        }
      }
      return n;
    });
    setOk(null);
  }

  async function salvar() {
    setOcupado(true);
    setErro(null);
    setOk(null);
    try {
      const corpo = { nome, permissoes: [...marcadas] };
      if (escolhido === NOVO) {
        const j = await pede('POST', corpo);
        setOk('Cargo criado.');
        setEscolhido(j.id);
      } else {
        await pede('PATCH', { id: escolhido, ...corpo });
        setOk('Salvo.');
      }
      router.refresh();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    if (!cargo) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Apagar o cargo "${cargo.nome}"?`)) return;
    setOcupado(true);
    setErro(null);
    try {
      await pede('DELETE', { id: cargo.id });
      escolhe(cargos.find((c) => c.id !== cargo.id)?.id ?? NOVO);
      router.refresh();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const grupos = [...new Set(telas.map((t) => t.grupo))];

  return (
    <div className="cargos">
      <div className="painel cargos-lista">
        <h2>Cargos</h2>
        <div className="chips" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {cargos.map((c) => (
            <button key={c.id} type="button"
                    className={`chip ${c.id === escolhido ? 'chip-on' : ''}`}
                    onClick={() => escolhe(c.id)}
                    style={{ textAlign: 'left' }}>
              {c.nome}
              <span className="muted">
                {' '}· {c.protegido ? 'tudo' : `${c.permissoes.length} permissões`}
                {' '}· {c.usuarios} usuário(s)
              </span>
            </button>
          ))}
          <button type="button" className={`chip chip-acao ${escolhido === NOVO ? 'chip-on' : ''}`}
                  onClick={() => escolhe(NOVO)}>
            + novo cargo
          </button>
        </div>
      </div>

      <div className="painel cargos-editor">
        <h2>{escolhido === NOVO ? 'Novo cargo' : cargo?.nome}</h2>
        <label className="campo" style={{ maxWidth: 360 }}>
          <span className="campo-rot">Nome</span>
          <input type="text" value={nome} onChange={(e) => { setNome(e.target.value); setOk(null); }}
                 placeholder="ex.: Planejador da Tecelagem" />
        </label>

        {protegido ? (
          <p className="rodape">
            Este cargo é <strong>protegido</strong>: tem todas as permissões,
            inclusive das telas que ainda vão existir, e não pode ser apagado.
            É a garantia de que sempre há alguém que pode tudo.
          </p>
        ) : (
          <div className="grade-rolagem">
            <table className="tabela-recursos tabela-cargo">
              <thead>
                <tr>
                  <th>Tela</th>
                  <th className="num">Ver</th>
                  <th className="num">Editar</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <GrupoDaGrade key={g} grupo={g}
                                telas={telas.filter((t) => t.grupo === g)}
                                marcadas={marcadas} alterna={alterna}
                                marcaGrupo={marcaGrupo} />
                ))}
                <tr className="pivot-total">
                  <td>Ações</td>
                  <td colSpan={2} />
                </tr>
                {avulsas.map((a) => (
                  <tr key={a.codigo}>
                    <td style={{ paddingLeft: 24 }}>{a.rotulo}</td>
                    <td className="num" colSpan={2}>
                      <input type="checkbox" checked={marcadas.has(a.codigo)}
                             onChange={() => alterna(a.codigo)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="acoes" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primario" onClick={salvar}
                  disabled={ocupado || !nome.trim()}>
            {ocupado ? 'Salvando…' : escolhido === NOVO ? 'Criar cargo' : 'Salvar'}
          </button>
          {cargo && !protegido && (
            <button type="button" className="btn btn-perigo" onClick={apagar} disabled={ocupado}>
              Apagar
            </button>
          )}
          {ok && <span className="muted">{ok}</span>}
          {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
        </div>

        <p className="rodape">
          <strong>Ver</strong> abre a tela e lê; <strong>editar</strong> grava.
          Marcar editar marca ver junto. <strong>Recalcular</strong> é à parte:
          ver o painel não é o mesmo que refazer a capacidade da fábrica. O que
          o cargo <em>não</em> marca some do menu e é recusado pelo servidor.
          Onde a pessoa pode mexer — planta, área — é do usuário, não do cargo.
        </p>
      </div>
    </div>
  );
}

function GrupoDaGrade({ grupo, telas, marcadas, alterna, marcaGrupo }) {
  const todasVer = telas.every((t) => marcadas.has(`${t.codigo}.ver`) || marcadas.has(`${t.codigo}.editar`));
  const todasEditar = telas.every((t) => marcadas.has(`${t.codigo}.editar`));
  return (
    <>
      <tr className="pivot-total">
        <td>{grupo}</td>
        <td className="num" title="todas as telas do grupo">
          <input type="checkbox" checked={todasVer}
                 onChange={() => marcaGrupo(grupo, 'ver', !todasVer)} />
        </td>
        <td className="num" title="todas as telas do grupo">
          <input type="checkbox" checked={todasEditar}
                 onChange={() => marcaGrupo(grupo, 'editar', !todasEditar)} />
        </td>
      </tr>
      {telas.map((t) => (
        <tr key={t.codigo}>
          <td style={{ paddingLeft: 24 }}>{t.rotulo}</td>
          <td className="num">
            <input type="checkbox"
                   checked={marcadas.has(`${t.codigo}.ver`) || marcadas.has(`${t.codigo}.editar`)}
                   onChange={() => alterna(`${t.codigo}.ver`)} />
          </td>
          <td className="num">
            <input type="checkbox" checked={marcadas.has(`${t.codigo}.editar`)}
                   onChange={() => alterna(`${t.codigo}.editar`)} />
          </td>
        </tr>
      ))}
    </>
  );
}
