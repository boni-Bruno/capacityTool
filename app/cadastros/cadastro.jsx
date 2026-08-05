'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { COOKIE, escreveOrdem, leOrdem, ordenar } from '../../lib/ordem';

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
  podeAtivar = false,
  rotuloNovo = 'Criar',
  vazio = 'Nada cadastrado ainda.',
  // Ligados onde a lista cresce. Em tela de duas linhas, esconder o
  // formulário atrás de um botão e pôr filtro por coluna só atrapalha.
  formularioSobDemanda = false,
  filtrarColunas = false,
  selecaoMultipla = false,
  // Qual chave de cookie guarda a ordenação desta tabela. Sem ela a tabela
  // ordena só na sessão; com ela, a escolha vale também nos seletores de
  // planta e área do resto do app.
  entidade = null,
  ordemInicial = null,
}) {
  const router = useRouter();

  // Coluna de contagem (quantas áreas, quantos recursos) aparece na tabela e
  // não entra no formulário — é resultado, não cadastro.
  const camposForm = campos.filter((c) => !c.soLeitura);
  const limpo = Object.fromEntries(camposForm.map((c) => [c.nome, c.padrao ?? '']));
  const [novo, setNovo] = useState(limpo);
  const [criando, setCriando] = useState(false);
  const [filtros, setFiltros] = useState({});
  const [escolhidos, setEscolhidos] = useState(() => new Set());
  // A coluna Ativo não vem de `campos` — ela é gerada pelo componente — então
  // o filtro dela precisa de uma chave própria, fora do espaço dos campos.
  const [soAtivos, setSoAtivos] = useState('');   // '' | 'sim' | 'nao'
  const [ordem, setOrdem] = useState(() => leOrdem(ordemInicial));
  const [lote, setLote] = useState(null);
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

  const criar = () => chamar('POST', novo, () => {
    setNovo(limpo);
    setCriando(false);
  });

  const salvar = (id) =>
    chamar('PATCH', { id, ...rascunho }, () => setEditando(null));

  const excluir = (id) =>
    chamar('DELETE', { id }, (j) => {
      setConfirmando(null);
      if (j.desativado) {
        setAviso(`Desativado em vez de apagado porque ${j.motivo}. ` +
                 `Continua na lista, em cinza — a coluna Ativo liga de volta.`);
      }
    });

  const podeCriar = camposForm
    .filter((c) => c.obrigatorio !== false)
    .every((c) => String(novo[c.nome] ?? '').trim());

  /**
   * Clique no cabeçalho: sobe, desce, e volta à ordem que veio do banco.
   *
   * O terceiro estado existe de propósito — sem ele não há como desfazer uma
   * ordenação, e a ordem do banco é a que agrupa por planta.
   */
  function ordenarPor(campo) {
    const proxima = !ordem || ordem.campo !== campo ? { campo, desc: false }
                  : ordem.desc ? null
                  : { campo, desc: true };
    setOrdem(proxima);
    if (!entidade) return;
    // Cookie e não localStorage: o servidor precisa ler isto para os seletores
    // de planta e área saírem na mesma ordem da tabela.
    document.cookie = COOKIE[entidade] + '=' + escreveOrdem(proxima)
                      + '; path=/; max-age=31536000; samesite=lax';
  }

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

  // Filtra pelo que está NA TELA, não pelo valor cru: quem digita "Confecção"
  // espera casar com o que lê, e a coluna de vínculo mostra o nome enquanto o
  // dado é um id. Sem acento e sem caixa, porque ninguém acerta "Confecção"
  // de primeira num campo de busca.
  const achata = (v) => String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const visiveis = !filtrarColunas ? itens : itens.filter((it) =>
    (soAtivos === ''
      || (soAtivos === 'sim' && it.ativo !== false)
      || (soAtivos === 'nao' && it.ativo === false)) &&
    campos.every((c) => {
      const busca = filtros[c.nome];
      if (!busca) return true;
      // Coluna de escolha casa exato: "só máquina" não pode trazer pessoa.
      if (c.tipo === 'select') return String(it[c.nome]) === String(busca);
      return achata(texto(c, it)).includes(achata(busca));
    }));

  const filtrando = Object.values(filtros).some(Boolean) || soAtivos !== '';

  // Ordena depois de filtrar: a ordem é de apresentação, o filtro é de
  // conteúdo, e inverter isso só faria trabalho à toa.
  const linhas = ordenar(visiveis, ordem);

  const marca = (id) => setEscolhidos((s) => {
    const novo = new Set(s);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });

  // "Todos" marca o que está VISÍVEL, não a tabela inteira: com filtro ativo,
  // selecionar tudo e apagar levaria junto linha que a pessoa não está vendo.
  const todosVisiveis = visiveis.length > 0
    && visiveis.every((it) => escolhidos.has(it.id));

  const marcaTodos = () => setEscolhidos(
    todosVisiveis ? new Set() : new Set(visiveis.map((it) => it.id)));

  /**
   * Exclui um a um, em sequência.
   *
   * Em sequência e não em paralelo porque cada exclusão pode desativar em vez
   * de apagar, e o resultado precisa ser contado — disparar tudo junto daria
   * um amontoado de respostas sem dizer o que aconteceu com o quê.
   */
  async function excluirLote() {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    const resumo = { apagados: 0, desativados: 0, falhas: [] };

    for (const id of escolhidos) {
      try {
        const r = await fetch(rota, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.erro);
        if (j.desativado) resumo.desativados++; else resumo.apagados++;
      } catch (e) {
        const nome = itens.find((x) => x.id === id)?.[campos[1]?.nome ?? 'nome'];
        resumo.falhas.push(`${nome ?? id}: ${e.message ?? 'falhou'}`);
      }
    }

    setEscolhidos(new Set());
    setLote(resumo);
    setOcupado(false);
    router.refresh();
  }

  // O formulário fica ACIMA da tabela quando entra sob demanda: com a lista
  // grande, um botão no rodapé desce junto e some da tela.
  const formulario = (
    <>
      {formularioSobDemanda && !criando && (
        <div className="acoes" style={{ marginBottom: 16 }}>
          <button className="btn btn-primario" onClick={() => setCriando(true)}>
            {rotuloNovo}
          </button>
        </div>
      )}

      {(!formularioSobDemanda || criando) && (
      <div className="form-grade"
           style={formularioSobDemanda ? { marginBottom: 20 } : { marginTop: 16 }}>
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
          {formularioSobDemanda && (
            <button className="btn" disabled={ocupado}
                    onClick={() => { setCriando(false); setNovo(limpo); setErro(null); }}>
              Cancelar
            </button>
          )}
        </div>
      </div>
      )}
    </>
  );

  return (
    <>
      {formularioSobDemanda && formulario}

      {selecaoMultipla && escolhidos.size > 0 && (
        <div className="acoes barra-lote">
          <strong>{escolhidos.size} selecionado(s)</strong>
          <button className="btn btn-mini btn-perigo" disabled={ocupado}
                  onClick={excluirLote}>
            {ocupado ? 'Excluindo…' : 'Excluir selecionados'}
          </button>
          <button className="btn btn-mini" disabled={ocupado}
                  onClick={() => setEscolhidos(new Set())}>
            Limpar seleção
          </button>
        </div>
      )}

      {lote && (
        <div className={'aviso' + (lote.falhas.length ? '' : ' aviso-ok')}
             style={{ marginBottom: 12 }}>
          <strong>
            {lote.apagados > 0 && `${lote.apagados} apagado(s). `}
            {lote.desativados > 0 && `${lote.desativados} desativado(s). `}
            {lote.falhas.length > 0 && `${lote.falhas.length} não deu.`}
            {lote.apagados + lote.desativados + lote.falhas.length === 0
              && 'Nada foi alterado.'}
          </strong>
          {lote.falhas.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {lote.falhas.map((f) => <li key={f}>{f}</li>)}
            </ul>
          )}
          <p style={{ margin: '6px 0 0' }}>
            <button className="link-linha" onClick={() => setLote(null)}>fechar</button>
          </p>
        </div>
      )}

      {itens.length === 0 ? (
        <p className="muted">{vazio}</p>
      ) : (
        <div className="grade-rolagem">
          <table>
            <thead>
              <tr>
                {selecaoMultipla && (
                  <th className="col-marca">
                    <input type="checkbox" checked={todosVisiveis}
                           onChange={marcaTodos}
                           title="Marcar ou desmarcar o que está visível" />
                  </th>
                )}
                {campos.map((c) => {
                  // Ordena pelo que está escrito na célula: na coluna de
                  // vínculo o dado é um id, e ordenar por id daria uma
                  // sequência que não corresponde a nada na tela.
                  const chave = c.col ?? c.nome;
                  return (
                    <th key={c.nome}>
                      <button className="th-ordem" onClick={() => ordenarPor(chave)}
                              title="Ordenar por esta coluna">
                        {c.rot}
                        <span className="th-seta">
                          {ordem?.campo === chave ? (ordem.desc ? '▼' : '▲') : '⇅'}
                        </span>
                      </button>
                    </th>
                  );
                })}
                {podeAtivar && <th className="col-marca">Ativo</th>}
                <th />
              </tr>
              {filtrarColunas && (
                <tr className="linha-filtro">
                  {selecaoMultipla && <th className="col-marca" />}
                  {campos.map((c) => (
                    <th key={c.nome}>
                      {c.tipo === 'select' ? (
                        <select value={filtros[c.nome] ?? ''}
                                onChange={(e) => setFiltros(
                                  { ...filtros, [c.nome]: e.target.value })}>
                          <option value="">todos</option>
                          {c.opcoes.map((o) => (
                            <option key={o.valor} value={o.valor}>{o.rotulo}</option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" placeholder="filtrar"
                               value={filtros[c.nome] ?? ''}
                               onChange={(e) => setFiltros(
                                 { ...filtros, [c.nome]: e.target.value })} />
                      )}
                    </th>
                  ))}
                  {podeAtivar && (
                    <th className="col-ativo-filtro">
                      <select value={soAtivos}
                              onChange={(e) => setSoAtivos(e.target.value)}>
                        <option value="">todos</option>
                        <option value="sim">ativos</option>
                        <option value="nao">inativos</option>
                      </select>
                    </th>
                  )}
                  <th className="acoes">
                    {filtrando && (
                      <button className="btn btn-mini"
                              onClick={() => { setFiltros({}); setSoAtivos(''); }}>
                        Limpar
                      </button>
                    )}
                  </th>
                </tr>
              )}
            </thead>
            <tbody>
              {linhas.map((it) => {
                const edit = editando === it.id;
                const inativo = it.ativo === false;

                return (
                  <tr key={it.id} className={inativo ? 'linha-vazia' : ''}>
                    {selecaoMultipla && (
                      <td className="col-marca">
                        <input type="checkbox" checked={escolhidos.has(it.id)}
                               onChange={() => marca(it.id)} />
                      </td>
                    )}
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

                    {podeAtivar && (
                      <td className="col-marca">
                        <input
                          type="checkbox"
                          checked={!inativo}
                          disabled={ocupado}
                          title={inativo ? 'Inativo — clique para ativar'
                                         : 'Ativo — clique para inativar'}
                          onChange={() =>
                            chamar('PUT', { id: it.id, ativo: inativo })}
                        />
                      </td>
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

          {linhas.length === 0 && (
            <p className="muted" style={{ marginTop: 12 }}>
              Nenhuma linha casa o filtro.{' '}
              <button className="link-linha"
                      onClick={() => { setFiltros({}); setSoAtivos(''); }}>
                Limpar filtros
              </button>
            </p>
          )}
        </div>
      )}

      {!formularioSobDemanda && formulario}

      {erro && <p className="erro">{erro}</p>}
      {aviso && <div className="aviso" style={{ marginTop: 12 }}>{aviso}</div>}
    </>
  );
}
