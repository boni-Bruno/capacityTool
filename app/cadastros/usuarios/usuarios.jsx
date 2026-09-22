'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGRAS, validaSenha } from '../../../lib/senha';
import { descreveEscopo, escopoDaTela, marcacaoDoEscopo } from '../../../lib/escopo';

// A tela de usuários: a tabela, e um formulário que serve para convidar e
// para editar. O escopo é uma árvore planta › área com "empresa inteira" no
// alto — marcar a planta é a planta inteira (área nova entra sozinha), marcar
// áreas soltas é só elas. A conversão para o banco é de lib/escopo.js.

async function pede(metodo, corpo) {
  const r = await fetch('/api/cadastro/usuario', {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({ ok: false, erro: `Servidor respondeu ${r.status}.` }));
  if (!j.ok) throw new Error(j.erro ?? 'Falhou');
  return j;
}

const VAZIO = {
  id: null, login: '', nome: '', email: '', senha: '', cargo_id: '',
  empresa: false, plantas: [], areas: [],
};

const fmtData = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '—');

export default function Usuarios({ usuarios, cargos, plantas, areas, euId }) {
  const router = useRouter();
  const [form, setForm] = useState(null);      // null = formulário fechado
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  function convidar() {
    setForm({ ...VAZIO, cargo_id: String(cargos.find((c) => !c.protegido)?.id ?? cargos[0]?.id ?? '') });
    setErro(null);
    setOk(null);
  }

  function editar(u) {
    const m = marcacaoDoEscopo(u.escopo);
    setForm({
      id: u.id, login: u.login, nome: u.nome, email: u.email ?? '', senha: '',
      cargo_id: String(u.cargo_id), empresa: m.empresa, plantas: m.plantas, areas: m.areas,
    });
    setErro(null);
    setOk(null);
  }

  // A árvore: marcar planta engole as áreas dela (some da lista de soltas);
  // desmarcar devolve nada — quem quer só duas áreas marca as duas.
  function alternaPlanta(id) {
    setForm((f) => {
      const tem = f.plantas.includes(id);
      return {
        ...f,
        plantas: tem ? f.plantas.filter((p) => p !== id) : [...f.plantas, id],
        areas: tem ? f.areas : f.areas.filter((a) => areas.find((x) => x.id === a)?.planta_id !== id),
      };
    });
  }
  function alternaArea(id) {
    setForm((f) => ({
      ...f,
      areas: f.areas.includes(id) ? f.areas.filter((a) => a !== id) : [...f.areas, id],
    }));
  }

  const faltas = form ? validaSenha(form.senha) : [];
  const novo = form && form.id === null;
  const senhaPronta = form && (form.senha === '' ? !novo : faltas.length === 0);
  const pronto = form && form.login.trim() && form.nome.trim() && form.cargo_id && senhaPronta;

  async function salvar() {
    setOcupado(true);
    setErro(null);
    setOk(null);
    try {
      const escopo = escopoDaTela(form, areas);
      const corpo = {
        nome: form.nome, email: form.email, cargo_id: Number(form.cargo_id), escopo,
      };
      if (novo) {
        await pede('POST', { ...corpo, login: form.login, senha: form.senha });
        setOk(`Usuário ${form.login.trim().toLowerCase()} convidado. Passe a senha inicial para a pessoa; ela troca no primeiro acesso.`);
      } else {
        await pede('PATCH', { id: form.id, ...corpo, senha: form.senha || undefined });
        setOk(form.senha ? 'Salvo, com a senha redefinida — a pessoa troca no próximo acesso.' : 'Salvo.');
      }
      setForm(null);
      router.refresh();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function ativa(u, ativo) {
    setOcupado(true);
    setErro(null);
    try {
      await pede('PUT', { id: u.id, ativo });
      router.refresh();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      {erro && <p className="erro">{erro}</p>}
      {ok && <p className="rodape" style={{ color: 'var(--teal-fg)' }}>{ok}</p>}

      {form && (
        <div className="painel">
          <h2>{novo ? 'Convidar' : `Editar ${form.login}`}</h2>
          <div className="form-grade">
            <label className="campo">
              <span className="campo-rot">Usuário (login)</span>
              <input type="text" value={form.login} disabled={!novo}
                     onChange={(e) => set('login', e.target.value)}
                     placeholder="ex.: maria.silva" autoComplete="off" />
            </label>
            <label className="campo">
              <span className="campo-rot">Nome</span>
              <input type="text" value={form.nome} onChange={(e) => set('nome', e.target.value)} />
            </label>
            <label className="campo">
              <span className="campo-rot">E-mail</span>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                     placeholder="para entrar pelo Hub S&OP" />
            </label>
            <label className="campo">
              <span className="campo-rot">Cargo</span>
              <select value={form.cargo_id} disabled={!novo && form.id === euId}
                      onChange={(e) => set('cargo_id', e.target.value)}>
                <option value="">selecione…</option>
                {cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label className="campo">
              <span className="campo-rot">{novo ? 'Senha inicial' : 'Nova senha (opcional)'}</span>
              <input type="password" value={form.senha} autoComplete="new-password"
                     onChange={(e) => set('senha', e.target.value)}
                     placeholder={novo ? 'a pessoa troca no primeiro acesso' : 'em branco mantém a atual'} />
            </label>
          </div>
          {(novo || form.senha) && (
            <ul className="entrar-regras" style={{ margin: '4px 0 12px' }}>
              {REGRAS.map((r) => (
                <li key={r.codigo} className={form.senha && !faltas.includes(r.texto) ? 'ok' : ''}>
                  {r.texto}
                </li>
              ))}
            </ul>
          )}

          <h3 style={{ margin: '12px 0 6px' }}>Onde atua</h3>
          <div className="escopo">
            <label className="escopo-item escopo-empresa">
              <input type="checkbox" checked={form.empresa}
                     onChange={(e) => set('empresa', e.target.checked)} />
              <strong>Empresa inteira</strong>
              <span className="muted"> — todas as plantas e áreas, inclusive as que vierem</span>
            </label>
            {!form.empresa && plantas.map((p) => {
              const daPlanta = areas.filter((a) => a.planta_id === p.id);
              const inteira = form.plantas.includes(p.id);
              return (
                <div key={p.id} className="escopo-planta">
                  <label className="escopo-item">
                    <input type="checkbox" checked={inteira} onChange={() => alternaPlanta(p.id)} />
                    <strong>{p.nome}</strong>
                    <span className="muted"> — planta inteira</span>
                  </label>
                  <div className="escopo-areas">
                    {daPlanta.map((a) => (
                      <label key={a.id} className={`escopo-item ${inteira ? 'muted' : ''}`}>
                        <input type="checkbox" disabled={inteira}
                               checked={inteira || form.areas.includes(a.id)}
                               onChange={() => alternaArea(a.id)} />
                        {a.nome}
                      </label>
                    ))}
                    {!daPlanta.length && <span className="muted">sem área ativa</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="rodape" style={{ margin: '6px 0 0' }}>
            Escopo: <strong>{descreveEscopo(escopoDaTela(form, areas), plantas, areas)}</strong>.
            {' '}Turno e calendário são da planta: quem tem só uma área não os edita.
          </p>

          <div className="acoes" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primario" onClick={salvar}
                    disabled={ocupado || !pronto}>
              {ocupado ? 'Salvando…' : novo ? 'Convidar' : 'Salvar'}
            </button>
            <button type="button" className="btn" onClick={() => setForm(null)} disabled={ocupado}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="painel">
        <div className="painel-topo">
          <h2>Quem entra</h2>
          {!form && (
            <div className="acoes">
              <button type="button" className="btn btn-primario" onClick={convidar}>
                Convidar
              </button>
            </div>
          )}
        </div>
        <div className="grade-rolagem">
          <table className="tabela-recursos">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Cargo</th>
                <th>Onde atua</th>
                <th>Último acesso</th>
                <th>Ativo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={u.ativo ? '' : 'muted'}>
                  <td><code>{u.login}</code>{u.id === euId && <span className="muted"> (você)</span>}</td>
                  <td>{u.nome}</td>
                  <td>{u.email || '—'}</td>
                  <td>{u.cargo}</td>
                  <td>{descreveEscopo(u.escopo, plantas, areas)}</td>
                  <td>
                    {fmtData(u.ultimo_acesso)}
                    {u.trocar_senha && <span className="muted"> · senha inicial</span>}
                  </td>
                  <td>
                    <input type="checkbox" checked={u.ativo} disabled={ocupado || u.id === euId}
                           onChange={(e) => ativa(u, e.target.checked)}
                           title={u.id === euId ? 'você não desativa a si mesmo' : ''} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-mini" onClick={() => editar(u)}
                            disabled={ocupado}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {!usuarios.length && (
                <tr><td colSpan={8} className="vazio">
                  Nenhum usuário ainda. Convide o primeiro — você, com o cargo
                  Gestor de Planejamento.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="rodape">
          Usuário não se apaga: desativa, e a história (quem convidou, último
          acesso) fica. <strong>Senha inicial</strong> quer dizer que a pessoa
          ainda não trocou a senha que recebeu. Quem entra pelo Hub S&OP é
          reconhecido pelo <strong>e-mail</strong>; sem e-mail cadastrado, só
          entra pela senha.
        </p>
      </div>
    </>
  );
}
