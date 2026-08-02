'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Tabela + formulário para planta, área e recurso.
//
// Os três têm a mesma mecânica — listar, criar, editar em linha, excluir e
// reativar — e mudam só nos campos. Escrever três vezes seria três chances de
// o comportamento divergir sem ninguém notar, então a diferença vira dado.
//
// Campo com `soCriacao` é o vínculo (planta da área, área do recurso): entra no
// formulário como escolha obrigatória e aparece na tabela como texto. Não é
// editável em linha porque mudar a planta de uma área move junto tudo que pende
// dela — é uma operação diferente de corrigir um nome.
export default function Cadastro({
  rota,
  itens,
  campos,          // [{ nome, rot, tipo, opcoes, placeholder, col, soCriacao, padrao }]
  podeReativar = false,
  rotuloNovo = 'Criar',
  vazio = 'Nada cadastrado ainda.',
}) {
  const router = useRouter();

  // Coluna de contagem (quantas áreas, quantos recursos) aparece na tabela e
  // não entra no formulário — é resultado, não cadastro.
  const camposForm = campos.filter((c) => !c.soLeitura);
  const limpo = Object.fromEntries(camposForm.map((c) => [c.nome, c.padrao ?? '']));
  const [novo, setNovo] = useState(limpo);
  const [editando, setEditando] = useState(null);
  const [rascunho, setRascunho] = useState({});
  const [confirmando, setConfirmando] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

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

  const criar = () => chamar('POST', novo, () => setNovo(limpo));

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

  const podeCriar = camposForm
    .filter((c) => c.obrigatorio !== false)
    .every((c) => String(novo[c.nome] ?? '').trim());

  function entrada(c, valor, onChange) {
    if (c.tipo === 'select') {
      return (
        <select value={valor ?? ''} onChange={onChange}>
          {/* Sem padrão, a primeira opção é vazia: a escolha tem que ser
              deliberada, e o botão de criar fica travado até acontecer. */}
          {c.padrao === undefined && <option value="">selecione…</option>}
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

  // Na tabela, o vínculo mostra o nome (`col`), não o id que vai no formulário.
  function texto(c, item) {
    if (c.col) return item[c.col];
    if (c.tipo === 'select') {
      return c.opcoes.find((o) => String(o.valor) === String(item[c.nome]))?.rotulo
             ?? item[c.nome];
    }
    return item[c.nome];
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
                  <tr key={it.id} className={inativo ? 'linha-vazia' : ''}>
                    {campos.map((c, i) => (
                      <td key={c.nome}>
                        {edit && !c.soCriacao && !c.soLeitura
                          ? entrada(c, rascunho[c.nome], (e) =>
                              setRascunho({ ...rascunho, [c.nome]: e.target.value }))
                          : texto(c, it)}
                        {i === 0 && inativo && (
                          <span className="selo padrao" style={{ marginLeft: 8 }}>
                            desativado
                          </span>
                        )}
                      </td>
                    ))}

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
        {camposForm.map((c) => (
          <label key={c.nome} className="campo">
            <span className="campo-rot">
              {c.rot}
              {c.soCriacao && <strong className="obrigatorio"> *</strong>}
            </span>
            {entrada(c, novo[c.nome], (e) =>
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
