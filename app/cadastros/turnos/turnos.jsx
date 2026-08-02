'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Cadastro dos turnos: criar, renomear, excluir e escolher qual deles terá o
// horário editado abaixo.
//
// Código e descrição são campos separados de propósito — antes a tela mostrava
// "1 — 1º Turno" grudado e não dava para saber onde acabava um e começava o
// outro.
export default function Turnos({ lista, plantas, selecionado }) {
  const router = useRouter();
  const params = useSearchParams();

  const [novo, setNovo] = useState({ codigo: '', nome: '', planta_id: plantas[0]?.id ?? '' });
  const [editando, setEditando] = useState(null);
  const [rascunho, setRascunho] = useState({ codigo: '', nome: '' });
  const [confirmando, setConfirmando] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  function urlDoTurno(id) {
    const p = new URLSearchParams(params.toString());
    p.set('turno', id);
    return '?' + p.toString();
  }

  // Trocar de turno já existente: navegação normal, a lista não mudou.
  function escolher(id) {
    router.push(urlDoTurno(id));
  }

  // Depois de criar é diferente: a lista mudou e o turno novo precisa aparecer.
  // O Router Cache do Next é indexado por segmento de rota e não inclui os
  // searchParams na chave, então um push para "?turno=novo" pode servir o
  // segmento em cache — sem o registro recém-criado. Navegação de verdade
  // recarrega do servidor e não tem como errar.
  function abrirNovo(id) {
    window.location.assign(urlDoTurno(id));
  }

  async function chamar(metodo, corpo, aoTerminar) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch('/api/cadastro/turno', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      // refresh antes de qualquer push: disparar os dois no mesmo instante faz
      // a navegação vencer e o refresh se perder — a lista ficava sem o turno
      // recém-criado mesmo com ele já gravado no banco.
      router.refresh();
      aoTerminar?.(j);
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(false);
    }
  }

  const criar = () =>
    chamar('POST', novo, (j) => {
      setNovo({ codigo: '', nome: '', planta_id: novo.planta_id });
      abrirNovo(j.id);   // já abre o turno novo para cadastrar os dias
    });

  const salvarNome = (id) =>
    chamar('PATCH', { id, ...rascunho }, () => setEditando(null));

  const reativar = (id) => chamar('PUT', { id });

  const excluir = (id) =>
    chamar('DELETE', { id }, (j) => {
      setConfirmando(null);
      if (j.desativado) {
        setAviso(
          `Turno desativado em vez de apagado: já é usado em ${j.onde.join(', ')}. ` +
          `Apagar arrancaria a referência de números que já foram calculados. ` +
          `Ele continua na lista, em cinza, e dá para reativar quando quiser.`
        );
      }
    });

  return (
    <>
      <table>
        <thead>
          <tr>
            <th style={{ width: 90 }}>Código</th>
            <th>Descrição</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lista.map((t) => {
            const ativo = t.id === selecionado;
            const edit = editando === t.id;

            return (
              <tr
                key={t.id}
                className={
                  t.ativo === false ? 'linha-vazia' : ativo ? 'linha-edit' : ''
                }
              >
                {edit ? (
                  <>
                    <td>
                      <input
                        type="text" value={rascunho.codigo}
                        onChange={(e) => setRascunho({ ...rascunho, codigo: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text" value={rascunho.nome}
                        onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                      />
                    </td>
                    <td className="acoes">
                      <button className="btn btn-primario btn-mini" disabled={ocupado}
                              onClick={() => salvarNome(t.id)}>
                        {ocupado ? '…' : 'Salvar'}
                      </button>
                      <button className="btn btn-mini" disabled={ocupado}
                              onClick={() => setEditando(null)}>
                        Cancelar
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td><code>{t.codigo}</code></td>
                    <td>
                      <button className="link-linha" onClick={() => escolher(t.id)}>
                        {t.nome}
                      </button>
                      {t.ativo === false && (
                        <span className="selo padrao" style={{ marginLeft: 8 }}>desativado</span>
                      )}
                      {ativo && t.ativo !== false && (
                        <span className="selo rodizio" style={{ marginLeft: 8 }}>editando</span>
                      )}
                    </td>
                    <td className="acoes">
                      {confirmando === t.id ? (
                        <>
                          <span className="erro" style={{ margin: 0 }}>Excluir?</span>
                          <button className="btn btn-mini btn-perigo" disabled={ocupado}
                                  onClick={() => excluir(t.id)}>
                            {ocupado ? '…' : 'Excluir'}
                          </button>
                          <button className="btn btn-mini" disabled={ocupado}
                                  onClick={() => setConfirmando(null)}>
                            Cancelar
                          </button>
                        </>
                      ) : t.ativo === false ? (
                        // Desativado só volta pela reativação: apagar de vez
                        // não é opção, é justamente por estar em uso que ele
                        // foi desativado em vez de apagado.
                        <button className="btn btn-mini btn-primario" disabled={ocupado}
                                onClick={() => reativar(t.id)}>
                          {ocupado ? '…' : 'Reativar'}
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn btn-mini"
                            onClick={() => {
                              setEditando(t.id);
                              setRascunho({ codigo: t.codigo, nome: t.nome });
                              setErro(null);
                            }}
                          >
                            Renomear
                          </button>
                          <button className="btn btn-mini"
                                  onClick={() => { setConfirmando(t.id); setErro(null); }}>
                            Excluir
                          </button>
                        </>
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="form-grade" style={{ marginTop: 18 }}>
        <label className="campo">
          <span className="campo-rot">Código</span>
          <input
            type="text" placeholder="ex.: 4" value={novo.codigo}
            onChange={(e) => setNovo({ ...novo, codigo: e.target.value })}
          />
        </label>
        <label className="campo">
          <span className="campo-rot">Descrição</span>
          <input
            type="text" placeholder="ex.: 4º Turno" value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          />
        </label>
        {plantas.length > 1 && (
          <label className="campo">
            <span className="campo-rot">Planta</span>
            <select value={novo.planta_id}
                    onChange={(e) => setNovo({ ...novo, planta_id: e.target.value })}>
              {plantas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
        )}
        <div className="campo campo-check">
          <button className="btn btn-primario"
                  disabled={ocupado || !novo.codigo.trim() || !novo.nome.trim()}
                  onClick={criar}>
            {ocupado ? 'Criando…' : 'Criar turno'}
          </button>
        </div>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {aviso && <div className="aviso" style={{ marginTop: 12 }}>{aviso}</div>}
    </>
  );
}
