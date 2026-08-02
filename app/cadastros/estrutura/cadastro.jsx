'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Tabela + formulário para planta, área e recurso.
//
// Os três têm a mesma mecânica — listar, criar, editar em linha, excluir e
// reativar — e mudam só nos campos. Escrever três vezes seria três chances de
// o comportamento divergir sem ninguém notar, então a diferença vira dado:
// `campos` descreve o que aparece, o resto é igual.
export default function Cadastro({
  rota,            // endpoint da API
  itens,
  campos,          // [{ nome, rot, tipo, opcoes, placeholder, larg }]
  extras = {},     // enviado junto no criar (ex.: planta_id)
  paramSelecao,    // parâmetro da URL que esta lista alimenta
  selecionado = null,
  podeReativar = false,
  rotuloNovo = 'Novo',
  vazio = 'Nada cadastrado ainda.',
}) {
  const router = useRouter();
  const params = useSearchParams();

  const limpo = Object.fromEntries(campos.map((c) => [c.nome, c.padrao ?? '']));
  const [novo, setNovo] = useState(limpo);
  const [editando, setEditando] = useState(null);
  const [rascunho, setRascunho] = useState({});
  const [confirmando, setConfirmando] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  function selecionar(id) {
    if (!paramSelecao) return;
    const p = new URLSearchParams(params.toString());
    p.set(paramSelecao, String(id));
    // Trocar de nível de cima invalida a escolha dos de baixo.
    for (const abaixo of DEPENDENTES[paramSelecao] ?? []) p.delete(abaixo);
    router.push('?' + p.toString());
  }

  async function chamar(metodo, corpo, aoTerminar) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch(rota, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      router.refresh();
      aoTerminar?.(j);
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(false);
    }
  }

  const criar = () =>
    chamar('POST', { ...extras, ...novo }, () => setNovo(limpo));

  const salvar = (id) =>
    chamar('PATCH', { id, ...rascunho }, () => setEditando(null));

  const excluir = (id) =>
    chamar('DELETE', { id }, (j) => {
      setConfirmando(null);
      if (j.desativado) {
        setAviso(`Desativado em vez de apagado porque ${j.motivo}. ` +
                 `Continua na lista, em cinza, e dá para reativar.`);
      }
    });

  const podeCriar = campos
    .filter((c) => c.obrigatorio !== false)
    .every((c) => String(novo[c.nome] ?? '').trim());

  function celula(c, valor, onChange) {
    if (c.tipo === 'select') {
      return (
        <select value={valor ?? ''} onChange={onChange}>
          {c.opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>{o.rotulo}</option>
          ))}
        </select>
      );
    }
    return (
      <input type="text" value={valor ?? ''} onChange={onChange}
             placeholder={c.placeholder ?? ''} />
    );
  }

  return (
    <>
      {itens.length === 0 ? (
        <p className="muted">{vazio}</p>
      ) : (
        <div className="grade-rolagem">
          <table>
            <thead>
              <tr>
                {campos.map((c) => <th key={c.nome}>{c.rot}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => {
                const edit = editando === it.id;
                const inativo = it.ativo === false;

                return (
                  <tr key={it.id}
                      className={inativo ? 'linha-vazia'
                                 : it.id === selecionado ? 'linha-edit' : ''}>
                    {edit ? (
                      campos.map((c) => (
                        <td key={c.nome}>
                          {celula(c, rascunho[c.nome], (e) =>
                            setRascunho({ ...rascunho, [c.nome]: e.target.value }))}
                        </td>
                      ))
                    ) : (
                      campos.map((c, i) => (
                        <td key={c.nome}>
                          {i === 0 && paramSelecao ? (
                            <button className="link-linha"
                                    onClick={() => selecionar(it.id)}>
                              {mostra(c, it)}
                            </button>
                          ) : mostra(c, it)}
                          {i === 0 && inativo && (
                            <span className="selo padrao" style={{ marginLeft: 8 }}>
                              desativado
                            </span>
                          )}
                        </td>
                      ))
                    )}

                    <td className="acoes">
                      {edit ? (
                        <>
                          <button className="btn btn-primario btn-mini" disabled={ocupado}
                                  onClick={() => salvar(it.id)}>
                            {ocupado ? '…' : 'Salvar'}
                          </button>
                          <button className="btn btn-mini" disabled={ocupado}
                                  onClick={() => setEditando(null)}>Cancelar</button>
                        </>
                      ) : inativo && podeReativar ? (
                        <button className="btn btn-mini btn-primario" disabled={ocupado}
                                onClick={() => chamar('PUT', { id: it.id })}>
                          {ocupado ? '…' : 'Reativar'}
                        </button>
                      ) : confirmando === it.id ? (
                        <>
                          <span className="erro" style={{ margin: 0 }}>Excluir?</span>
                          <button className="btn btn-mini btn-perigo" disabled={ocupado}
                                  onClick={() => excluir(it.id)}>
                            {ocupado ? '…' : 'Excluir'}
                          </button>
                          <button className="btn btn-mini" disabled={ocupado}
                                  onClick={() => setConfirmando(null)}>Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-mini" onClick={() => {
                            setEditando(it.id);
                            setRascunho(Object.fromEntries(
                              campos.map((c) => [c.nome, it[c.nome] ?? ''])));
                            setErro(null);
                          }}>Editar</button>
                          <button className="btn btn-mini"
                                  onClick={() => { setConfirmando(it.id); setErro(null); }}>
                            Excluir
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="form-grade" style={{ marginTop: 16 }}>
        {campos.map((c) => (
          <label key={c.nome} className={'campo' + (c.larg === 'longo' ? ' campo-largo' : '')}>
            <span className="campo-rot">{c.rot}</span>
            {celula(c, novo[c.nome], (e) =>
              setNovo({ ...novo, [c.nome]: e.target.value }))}
          </label>
        ))}
        <div className="campo campo-check">
          <button className="btn btn-primario" disabled={ocupado || !podeCriar}
                  onClick={criar}>
            {ocupado ? 'Salvando…' : rotuloNovo}
          </button>
        </div>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {aviso && <div className="aviso" style={{ marginTop: 12 }}>{aviso}</div>}
    </>
  );
}

// Escolher uma planta diferente invalida a área escolhida, e assim por diante.
const DEPENDENTES = {
  planta: ['area', 'recurso'],
  area: ['recurso'],
};

function mostra(campo, item) {
  const v = item[campo.nome];
  if (campo.tipo === 'select') {
    return campo.opcoes.find((o) => String(o.valor) === String(v))?.rotulo ?? v;
  }
  return v;
}
