'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MESES, descreveDias } from '../../../lib/dias';
import Alvos from '../alvos';

// Matriz de turnos: uma linha por mês, uma coluna por turno.
//
// A PRIMEIRA COLUNA É O REGIME DE DIAS, e ele também é por mês. Antes eram dois
// botões acima da tabela, valendo para sempre — o que quebrou quando apareceu a
// máquina que roda em três turnos até junho e em rodízio full time de julho em
// diante: o rodízio tem outros feriados, e o ano inteiro num regime só dava a
// capacidade errada na metade do ano.
//
// Ele é coluna e não uma tabela à parte porque a pergunta é a mesma — "o que
// vale em julho?" —, e a resposta tem que caber numa linha só de leitura.
//
// A célula guarda TEXTO — '' é "não trabalha", e um número é quantas máquinas
// ou pessoas rodam ali. Três modos, e a diferença é o que a célula pergunta:
//
//   MÁQUINA de uma só    caixa de marcar. "1 ou vazio" num campo numérico seria
//                        pior para o caso comum, que é a maioria das linhas.
//   MÁQUINA de várias    número de 1 até a Qtd do cadastro — o teto físico.
//                        Igual à Qtd grava "todas", e o turno acompanha se a
//                        quantidade mudar.
//   PESSOA               número livre, sempre. Não há teto de gente: a Qtd do
//                        cadastro não existe para pessoa (migração 36), e
//                        quantas trabalham é decidido AQUI, turno a turno. O
//                        número é gravado explícito — "todas" não quer dizer
//                        nada para pessoa.
//
// Por baixo isso vira daterange no banco, e meses vizinhos com a MESMA
// quantidade colam numa faixa só. A tela não mostra vigência nenhuma: para
// planejar capacidade, o que importa é "quantas rodam neste mês".

const chave = (turnoId, mes) => `${turnoId}:${mes}`;

// Quando o número é o total, o cadastro guarda "todas" (null no banco) em vez
// do número — assim o turno acompanha se a quantidade do recurso mudar.
const TODAS = 'todas';

export default function Matriz({
  recursoId, ano, turnos, inicial, parciais, qtRecurso = 1, alvos = null,
  pessoa = false, calendarios = [], calInicial = {},
}) {
  const router = useRouter();
  const [celulas, setCelulas] = useState(inicial);
  const [cal, setCal] = useState(calInicial);      // { mes: calendario_id }
  const [calAno, setCalAno] = useState('');        // o regime para os 12 meses
  const [anoTodo, setAnoTodo] = useState({});      // o número por turno, para os 12 meses
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [andamento, setAndamento] = useState(null);
  const [fora, setFora] = useState(() => new Set());

  // EM LOTE a matriz não é de ninguém: ela é o molde que vai para todos os
  // recursos do filtro. O lote é sempre de um tipo só — a tela filtra por
  // tipo antes de oferecer o lote — então máquina em lote grava "todas" (cada
  // uma resolve com a própria quantidade) e pessoa em lote grava o número
  // digitado, o mesmo em todos os postos.
  const lote = Array.isArray(alvos);
  // Tirar um do lote: o alcance vem do filtro, mas quase sempre tem uma máquina
  // que é exceção, e mandar a pessoa refazer o filtro por causa de uma só é
  // pedir que ela desista e faça tudo a mão.
  const dentro = lote ? alvos.filter((a) => !fora.has(a.id)) : [];

  // Caixa de marcar só para máquina de uma só (ou lote de máquinas). Pessoa e
  // máquina de várias pedem número.
  const simples = !pessoa && (lote || qtRecurso === 1);
  // O que "ligar" uma célula escreve nela, quando não é a pessoa digitando.
  const cheio = pessoa ? '1' : String(lote ? 1 : qtRecurso);

  // Comparar com o estado inicial evita habilitar Salvar à toa e deixa claro
  // quando há alteração pendente — a tela salva em lote, não a cada clique.
  const sujo = useMemo(() => {
    const chaves = new Set([...Object.keys(celulas), ...Object.keys(inicial)]);
    return [...chaves].some((k) => (celulas[k] ?? '') !== (inicial[k] ?? ''));
  }, [celulas, inicial]);

  // O QUE MUDOU NO REGIME, mês a mês. Só o que tem valor entra: deixar um mês
  // em branco NÃO é pedir para apagar o regime dele — não existe recurso sem
  // regime, e o motor some com o mês que ficar descoberto. Em branco é "não
  // mexer", e é isso que faz o lote poder mandar só o segundo semestre.
  const calPorMes = useMemo(() => {
    const saida = {};
    for (let mes = 1; mes <= 12; mes += 1) {
      const v = String(cal[mes] ?? '');
      if (v !== '' && v !== String(calInicial[mes] ?? '')) saida[mes] = Number(v);
    }
    return saida;
  }, [cal, calInicial]);

  const calSujo = Object.keys(calPorMes).length > 0;
  // Fora do lote, mês sem regime é anomalia e a tela diz — é capacidade zero
  // esperando para acontecer. No lote, branco é o normal: o molde só mexe no
  // que foi escolhido.
  const semRegime = lote ? [] : MESES.slice(1)
    .map((_, i) => i + 1).filter((mes) => !cal[mes]);

  const ligada = (k) => (celulas[k] ?? '') !== '';

  function poe(turnoId, mes, valor) {
    setCelulas((c) => ({ ...c, [chave(turnoId, mes)]: valor }));
    setOk(null);
  }

  function poeCal(mes, valor) {
    setCal((c) => ({ ...c, [mes]: valor }));
    setOk(null);
  }

  // O regime dos doze meses de uma vez. É o caso comum — o ano inteiro em
  // padrão —, e o mês a mês existe para a exceção.
  function aplicaCalAno(valor) {
    setCalAno(valor);
    if (valor === '') return;
    setCal(Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [i + 1, valor])));
    setOk(null);
  }

  function alterna(turnoId, mes) {
    poe(turnoId, mes, ligada(chave(turnoId, mes)) ? '' : cheio);
  }

  // Preencher o mês inteiro usa o total (máquina) ou 1 (pessoa): é um ponto
  // de partida, e ajustar uma célula depois é mais rápido do que preencher
  // todas.
  function alternaMes(mes) {
    const todos = turnos.every((t) => ligada(chave(t.turno_id, mes)));
    setCelulas((c) => {
      const novo = { ...c };
      for (const t of turnos) novo[chave(t.turno_id, mes)] = todos ? '' : cheio;
      return novo;
    });
    setOk(null);
  }

  // Quantos meses do ano estão ligados para o turno — decide se a caixa do
  // cabeçalho aparece cheia, vazia ou pela metade.
  const contaDoTurno = (turnoId) => {
    let n = 0;
    for (let mes = 1; mes <= 12; mes++) if (ligada(chave(turnoId, mes))) n++;
    return n;
  };

  function alternaTurno(turnoId) {
    const todos = contaDoTurno(turnoId) === 12;
    setCelulas((c) => {
      const novo = { ...c };
      for (let mes = 1; mes <= 12; mes++) novo[chave(turnoId, mes)] = todos ? '' : cheio;
      return novo;
    });
    setOk(null);
  }

  // O NÚMERO PARA O ANO TODO: a caixa no cabeçalho de cada turno, no modo
  // numérico. Digitou 12 e clicou a seta, os doze meses recebem 12; vazio
  // limpa. É o pedido do Bruno — um posto costuma ter a mesma lotação o ano
  // inteiro, e doze digitações por turno é onde uma sai errada.
  function aplicaAno(turnoId) {
    const v = String(anoTodo[turnoId] ?? '').trim();
    setCelulas((c) => {
      const novo = { ...c };
      for (let mes = 1; mes <= 12; mes++) novo[chave(turnoId, mes)] = v;
      return novo;
    });
    setOk(null);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      const marcados = {};
      for (const t of turnos) {
        const porMes = {};
        for (let mes = 1; mes <= 12; mes++) {
          const v = celulas[chave(t.turno_id, mes)] ?? '';
          if (v === '') continue;

          // Máquina em lote grava sempre TODAS: os recursos do lote têm
          // quantidades diferentes, e um número fixo seria demais para um e de
          // menos para outro. Cada um resolve com a quantidade dele.
          if (lote && !pessoa) { porMes[mes] = TODAS; continue; }

          const n = Number(v);
          if (!Number.isInteger(n) || n < 1) {
            throw new Error(
              `${t.nome}, ${MESES[mes]}: informe um número inteiro maior que zero, `
              + 'ou deixe vazio para não trabalhar.');
          }
          if (pessoa) { porMes[mes] = n; continue; }   // sem teto, sempre explícito

          if (n > qtRecurso) {
            throw new Error(
              `${t.nome}, ${MESES[mes]}: este recurso tem ${qtRecurso} máquina(s); `
              + `${n} não cabe.`);
          }
          porMes[mes] = n === qtRecurso ? TODAS : n;
        }
        marcados[t.turno_id] = porMes;
      }

      await gravaEm(marcados, calPorMes);
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setAndamento(null);
      setSalvando(false);
    }
  }

  // Grava o mesmo desenho de turnos no recurso ou em cada recurso do lote.
  //
  // O REGIME VAI JUNTO, na mesma volta e só quando mudou: são duas tabelas e
  // duas rotas, mas uma decisão só para quem cadastra — separar em dois botões
  // seria o jeito de alguém salvar a matriz e ir embora com o regime pela
  // metade.
  async function gravaEm(marcados, porMesCal) {
    const mexeNoRegime = porMesCal && Object.keys(porMesCal).length > 0;

    const grava = async (id) => {
      if (mexeNoRegime) {
        const c = await fetch('/api/cadastro/recurso-calendario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recurso_id: id, ano, por_mes: porMesCal }),
        });
        const jc = await c.json();
        if (!jc.ok) throw new Error(jc.erro);
      }

      const r = await fetch('/api/cadastro/recurso-turno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recurso_id: id, ano, marcados,
          // As colunas que esta tela mostrou. O servidor só reescreve estas:
          // turno que a tela não ofereceu não é apagado por omissão.
          escopo: turnos.map((t) => t.turno_id),
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      return j.turnosAlterados ?? 0;
    };

    if (!lote) {
      const n = await grava(recursoId);
      const dizTurnos = n === 0 ? null
        : `${n} turno${n > 1 ? 's' : ''} atualizado${n > 1 ? 's' : ''}.`;
      const dizRegime = mexeNoRegime
        ? `Regime atualizado em ${Object.keys(porMesCal).length} mês(es).` : null;
      setOk([dizTurnos, dizRegime].filter(Boolean).join(' ') || 'Nada mudou.');
    } else {
      // UM RECURSO POR REQUISIÇÃO, com o laço aqui no navegador — é o mesmo
      // caminho do Recalcular tudo e da importação, pela mesma razão: cada
      // recurso são duas consultas e uma transação, e quarenta deles numa
      // requisição só estouram o tempo da função no meio, deixando metade
      // gravada e nenhum aviso.
      let mexidos = 0;
      for (const [i, alvo] of dentro.entries()) {
        setAndamento({ feitos: i, total: dentro.length, nome: alvo.nome });
        // eslint-disable-next-line no-await-in-loop
        if (await grava(alvo.id) > 0) mexidos++;
      }
      setAndamento(null);
      setOk(`${dentro.length} recurso(s) percorrido(s), `
        + `${mexidos} com mudança de turno.`
        + (mexeNoRegime
          ? ` Regime aplicado em ${Object.keys(porMesCal).length} mês(es) de cada um.`
          : ''));
    }
    router.refresh();
  }

  // LIMPAR: apaga os turnos do ano nos recursos do lote (ou no recurso).
  //
  // Em lote a matriz nasce vazia, e vazia ela não tem o que salvar — então
  // quem cadastrou três turnos em doze máquinas e quer desfazer não tinha
  // como, a não ser máquina por máquina. Este botão manda a matriz vazia
  // direto, com confirmação, porque apaga cadastro de verdade.
  async function limpar() {
    const quem = lote ? `${dentro.length} recurso(s)` : 'este recurso';
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Apagar todos os turnos de ${ano} em ${quem}? `
                        + 'Os outros anos não mudam.')) return;
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      // O REGIME NÃO VAI JUNTO. "Limpar turnos" apaga jornada, e recurso sem
      // regime nenhum não existe: o motor casa o dia com o calendário por INNER
      // JOIN, então limpar o regime não zeraria a capacidade — faria o recurso
      // sumir do cálculo sem deixar rastro.
      const vazio = Object.fromEntries(turnos.map((t) => [t.turno_id, {}]));
      await gravaEm(vazio, null);
      setCelulas({});
      setAnoTodo({});
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setAndamento(null);
      setSalvando(false);
    }
  }

  // Sem turno não há matriz — e o regime de dias mora nela, então ele também
  // fica inalcançável. Dizer isso aqui evita a procura no lugar errado: o
  // conserto é cadastrar turno na planta, não mexer no recurso.
  if (!turnos.length) {
    return (
      <p className="muted">
        Nenhum turno ativo na planta — sem turno não há o que cadastrar aqui,
        nem o regime de dias.
      </p>
    );
  }

  const unidade = pessoa ? 'pessoas' : 'máquinas';

  return (
    <>
      {/* Quem entra no lote vem ANTES da matriz: escolher os quatro G6200 de
          dois turnos é o primeiro passo, e a lista embaixo do Aplicar era onde
          ninguém olhava. */}
      {lote && (
        <Alvos alvos={alvos} fora={fora}
               onDefine={(novo) => { setFora(novo); setOk(null); }}
               onAlterna={(id) => {
                 setFora((f) => {
                   const novo = new Set(f);
                   if (novo.has(id)) novo.delete(id); else novo.add(id);
                   return novo;
                 });
                 setOk(null);
               }} />
      )}

      <div className="grade-rolagem">
        <table className="matriz">
          <thead>
            <tr>
              <th>Mês</th>
              {calendarios.length > 0 && (
                <th className="matriz-turno matriz-regime">
                  <span className="matriz-nome" title="Em que dias o recurso pode rodar">
                    Regime de dias
                  </span>
                  <span className="matriz-ano">
                    <select
                      className="matriz-cal"
                      value={calAno}
                      title="Aplicar este regime aos 12 meses"
                      onChange={(e) => aplicaCalAno(e.target.value)}
                    >
                      <option value="">→ ano todo…</option>
                      {calendarios.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.nome}</option>
                      ))}
                    </select>
                  </span>
                </th>
              )}
              {turnos.map((t) => (
                <th key={t.turno_id} className="matriz-turno">
                  <span className="matriz-nome" title={`Código ${t.codigo}`}>
                    {t.nome}
                  </span>
                  {simples ? (
                    // Marcar o ano inteiro num clique. Antes isso era o nome do
                    // turno sendo clicável — funcionava e ninguém descobria,
                    // porque cabeçalho não parece botão.
                    <label className="matriz-ano">
                      <input
                        type="checkbox"
                        checked={contaDoTurno(t.turno_id) === 12}
                        ref={(el) => {
                          if (el) {
                            const n = contaDoTurno(t.turno_id);
                            el.indeterminate = n > 0 && n < 12;
                          }
                        }}
                        onChange={() => alternaTurno(t.turno_id)}
                      />
                      <span>ano todo</span>
                    </label>
                  ) : (
                    // O número para os doze meses, com a seta que aplica. Vazio
                    // aplicado limpa o ano — é o jeito de desligar um turno de
                    // uma vez no modo numérico.
                    <span className="matriz-ano">
                      <input
                        className="matriz-qt"
                        type="number" min="1" step="1" placeholder="—"
                        title={`${unidade} neste turno, nos 12 meses`}
                        value={anoTodo[t.turno_id] ?? ''}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setAnoTodo(
                          { ...anoTodo, [t.turno_id]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && aplicaAno(t.turno_id)}
                      />
                      <button type="button" className="btn btn-mini"
                              title="Aplicar aos 12 meses"
                              onClick={() => aplicaAno(t.turno_id)}>
                        → ano todo
                      </button>
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MESES.slice(1).map((rotulo, i) => {
              const mes = i + 1;
              return (
                <tr key={mes}>
                  <td className="matriz-mes">
                    <button
                      className="matriz-cab"
                      onClick={() => alternaMes(mes)}
                      title={simples
                        ? 'Marcar ou desmarcar todos os turnos deste mês'
                        : 'Preencher ou limpar todos os turnos deste mês'}
                    >
                      {rotulo}
                    </button>
                  </td>
                  {calendarios.length > 0 && (
                    <td className="matriz-cel matriz-regime">
                      <select
                        className={'matriz-cal' + (!cal[mes] ? ' matriz-cal-vazia' : '')}
                        value={String(cal[mes] ?? '')}
                        onChange={(e) => poeCal(mes, e.target.value)}
                        title={lote
                          ? 'Regime deste mês nos recursos do lote. Em branco não mexe no que cada um tem.'
                          : 'Em que dias o recurso pode rodar neste mês'}
                      >
                        <option value="">{lote ? '— não mexer —' : '— sem regime —'}</option>
                        {calendarios.map((c) => (
                          <option key={c.id} value={String(c.id)}>{c.nome}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {turnos.map((t) => {
                    const k = chave(t.turno_id, mes);
                    return (
                      <td key={t.turno_id} className="matriz-cel">
                        <label className="matriz-flag">
                          {simples ? (
                            <input
                              type="checkbox"
                              checked={ligada(k)}
                              onChange={() => alterna(t.turno_id, mes)}
                            />
                          ) : (
                            <input
                              className="matriz-qt"
                              type="number"
                              min="1"
                              max={pessoa ? undefined : qtRecurso}
                              step="1"
                              placeholder="—"
                              title={pessoa
                                ? 'Quantas pessoas trabalham neste turno. Vazio = não trabalha.'
                                : `Quantas das ${qtRecurso} máquinas rodam neste turno. Vazio = não trabalha.`}
                              value={celulas[k] ?? ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => poe(t.turno_id, mes, e.target.value)}
                            />
                          )}
                          {parciais[k] && !sujo && (
                            <span className="matriz-parcial" title="Cadastro atual cobre só parte deste mês. Salvar passa a valer o mês inteiro.">
                              ½
                            </span>
                          )}
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* A LEGENDA DOS REGIMES. A coluna oferece o nome, que é como a fábrica
          fala; a diferença entre eles é o domingo, e ela precisa estar escrita
          em algum lugar da tela. */}
      {calendarios.length > 0 && (
        <p className="rodape" style={{ marginTop: 10 }}>
          {calendarios.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ' · '}
              <strong>{c.nome}</strong>: {descreveDias(c.dias)}
            </span>
          ))}
        </p>
      )}

      {semRegime.length > 0 && (
        <div className="aviso" style={{ marginTop: 12 }}>
          <strong>
            Sem regime de dias em {semRegime.map((m) => MESES[m]).join(', ')}.
          </strong>
          <p style={{ margin: '6px 0 0' }}>
            Mês sem regime não produz capacidade nenhuma — o recurso some do
            cálculo naquele mês, sem zerar e sem avisar. Escolha o regime desses
            meses e salve.
          </p>
        </div>
      )}

      <div className="acoes" style={{ marginTop: 16 }}>
        <button className="btn btn-primario" onClick={salvar}
                disabled={(!sujo && !calSujo) || salvando
                          || (lote && dentro.length === 0)}>
          {salvando
            ? (lote ? 'Aplicando…' : 'Salvando…')
            : (lote ? `Aplicar em ${dentro.length} recurso(s)` : 'Salvar')}
        </button>
        <button type="button" className="btn" onClick={limpar}
                disabled={salvando || (lote && dentro.length === 0)}
                title={`Apagar todos os turnos de ${ano} ${lote ? 'nos recursos do lote' : 'neste recurso'}`}>
          {lote ? `Limpar turnos em ${dentro.length} recurso(s)` : 'Limpar turnos do ano'}
        </button>
        {lote && dentro.length === 0 && (
          <span className="muted">nenhum recurso no lote</span>
        )}
        {(sujo || calSujo) && !salvando && (
          <span className="muted">alterações não salvas</span>
        )}
        {/* O nome de quem está sendo gravado, e não só a barra: quarenta
            recursos levam quarenta requisições, e "Aplicando…" parado por meio
            minuto parece travado. */}
        {andamento && (
          <span className="muted">
            {andamento.feitos + 1} de {andamento.total} · {andamento.nome}
          </span>
        )}
        {ok && <span className="muted">{ok}</span>}
        {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
      </div>

      <p className="rodape">
        {simples ? (
          <>
            <strong>ano todo</strong> marca ou desmarca os doze meses daquele
            turno de uma vez; a caixa fica pela metade quando só parte do ano
            está marcada.
          </>
        ) : (
          <>
            A caixa no alto de cada turno e a seta <strong>→ ano todo</strong>{' '}
            preenchem os doze meses com aquele número de {unidade} — vazio
            aplicado limpa o ano. A célula é quantas {unidade} trabalham
            naquele turno naquele mês; vazio é não trabalha.
            {pessoa && ' Para pessoa não há teto: o número é livre, e é ele que vira a capacidade.'}
          </>
        )}
        {' '}Clicar no nome do mês {simples ? 'marca ou desmarca' : 'preenche ou limpa'} a
        linha. Salvar aplica o ano de {ano} — o que estiver configurado em outros
        anos não é afetado.
      </p>

      {calendarios.length > 0 && (
        <p className="rodape">
          O <strong>regime de dias</strong> diz em que dias o recurso pode rodar,
          e vale <strong>por mês</strong>: dá para trabalhar em turnos até junho
          e passar para rodízio em julho, que é quando o calendário muda de
          feriados. Ele é salvo pelo mesmo botão da matriz, e{' '}
          {lote
            ? 'mês deixado em branco não mexe no que cada recurso do lote já tem.'
            : `também só vale para ${ano} — em ${ano + 1} continua o que estava lá.`}
          {' '}Os turnos marcados acima só produzem capacidade nos dias que o
          regime permite.
        </p>
      )}
    </>
  );
}
