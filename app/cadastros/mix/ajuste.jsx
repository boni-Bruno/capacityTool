'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CAMPOS_BASE, mixDaBase, rotulosDe, valoresDe } from '../../../lib/regras';

// A tela do mix: a lista de CTs com os doze meses, e o editor de um CT.
//
// A lista mostra o mix VIGENTE — o ajustado onde existe, o da base onde não —
// e diz qual dos dois é. A divergência entre eles é visível de propósito: uma
// base nova pode dizer 60/40 onde o ajuste diz 90/10, e isso não pode ficar
// mudo.
//
// O editor pré-preenche com o que vale hoje: ninguém digita mix do zero,
// corrige o que a base diz. A soma não precisa dar 100 — o servidor normaliza
// proporcionalmente ao gravar, e a tela avisa disso ao lado do campo.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');
const pc = (n) => Number(n ?? 0).toLocaleString('pt-BR',
  { maximumFractionDigits: 1 });

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                     'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const SEM_ROTULO = '';

export default function AjusteMix({ ano, anos, atributo, atributos, regras,
                                    combinacoes, cadastro, ajustes, taxas }) {
  const router = useRouter();
  const params = useSearchParams();
  const [filtro, setFiltro] = useState({});
  const [aberto, setAberto] = useState(null);      // o CT em edição
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  const navega = (chave, valor) => {
    const p = new URLSearchParams(params.toString());
    p.set(chave, valor);
    setAberto(null);
    router.push('?' + p.toString());
  };

  // ---- o mix da base e o ajustado, indexados --------------------------------
  const base = useMemo(
    () => mixDaBase(combinacoes, atributos, regras, atributo, ano),
    [combinacoes, atributos, regras, atributo, ano]);

  // ct -> mes -> [{rotulo, pct}]
  const baseDe = useMemo(() => indexa(base), [base]);
  const ajusteDe = useMemo(
    () => indexa(ajustes.map((a) => ({ ...a, rotulo: a.rotulo ?? SEM_ROTULO }))),
    [ajustes]);

  const taxaDe = useMemo(
    () => new Map(taxas.map((t) => [t.ct, t])), [taxas]);

  const cad = useMemo(
    () => new Map(cadastro.map((c) => [c.ct, c])), [cadastro]);

  const ehOrigem = CAMPOS_BASE.some((c) => c.codigo === atributo);

  // Os rótulos possíveis do atributo: os das regras quando é DE/PARA, os
  // valores da própria coluna quando é campo da base — ali o valor JÁ é o
  // rótulo. Ajuste antigo com rótulo que sumiu continua na lista: cadastro
  // vivo não pode ficar invisível.
  const rotulos = useMemo(() => {
    const r = ehOrigem
      ? valoresDe(combinacoes, atributo).map((v) => v.valor)
      : rotulosDe(regras, atributo);
    for (const a of ajustes) {
      const rot = a.rotulo ?? SEM_ROTULO;
      if (rot !== SEM_ROTULO && !r.includes(rot)) r.push(rot);
    }
    return r;
  }, [ehOrigem, combinacoes, regras, atributo, ajustes]);

  // Todos os CTs: do cadastro e da base. CT sem demanda também entra — o mix
  // manual é justamente o que pode dar rótulo a ele.
  const cts = useMemo(() => {
    const s = new Set(cadastro.map((c) => c.ct));
    for (const b of base) s.add(b.ct);
    return [...s].sort();
  }, [cadastro, base]);

  const plantas = useMemo(
    () => [...new Set(cadastro.map((c) => c.planta))].sort(), [cadastro]);
  const areas = useMemo(
    () => [...new Set(cadastro
      .filter((c) => !filtro.planta || c.planta === filtro.planta)
      .map((c) => c.area))].sort(), [cadastro, filtro.planta]);
  const ccs = useMemo(
    () => [...new Set(cts.map((ct) => ct.split('-')[0]))].sort(), [cts]);

  const visiveis = cts.filter((ct) => {
    const info = cad.get(ct);
    if (filtro.planta && info?.planta !== filtro.planta) return false;
    if (filtro.area && info?.area !== filtro.area) return false;
    if (filtro.cc && ct.split('-')[0] !== filtro.cc) return false;
    return true;
  });

  async function chamar(metodo, corpo) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/mix', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      router.refresh();
      return true;
    } catch (e) {
      setErro(e.message ?? 'Falhou');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const attrNome = atributos.find((a) => a.codigo === atributo)?.nome
    ?? CAMPOS_BASE.find((c) => c.codigo === atributo)?.nome ?? atributo;

  return (
    <>
      {erro && <p className="erro">{erro}</p>}

      <div className="painel">
        <div className="filtros" style={{ marginBottom: 14 }}>
          <select value={ano} onChange={(e) => navega('ano', e.target.value)}>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={atributo}
                  onChange={(e) => navega('atributo', e.target.value)}>
            {atributos.length > 0 && (
              <optgroup label="Atributos DE/PARA">
                {atributos.map((a) => (
                  <option key={a.codigo} value={a.codigo}>{a.nome}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Campos da base">
              {CAMPOS_BASE.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.nome}</option>
              ))}
            </optgroup>
          </select>

          <select value={filtro.planta ?? ''}
                  onChange={(e) => setFiltro((f) => (
                    { ...f, planta: e.target.value || undefined, area: undefined }))}>
            <option value="">todas as plantas</option>
            {plantas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select value={filtro.area ?? ''}
                  onChange={(e) => setFiltro((f) => (
                    { ...f, area: e.target.value || undefined }))}>
            <option value="">todas as áreas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={filtro.cc ?? ''}
                  onChange={(e) => setFiltro((f) => (
                    { ...f, cc: e.target.value || undefined }))}>
            <option value="">todo CC</option>
            {ccs.map((c) => <option key={c} value={c}>CC {c}</option>)}
          </select>
        </div>

        <p className="rodape" style={{ margin: '0 0 12px' }}>
          Cada célula é o rótulo que mais ocupa o CT naquele mês, em % do tempo
          — <strong>{attrNome}</strong>, {ano}. Célula em destaque é mix{' '}
          <strong>ajustado à mão</strong>: ele ganha do calculado e nenhuma
          importação de base mexe nele. Clique no CT para ver e ajustar o mix
          inteiro.
        </p>

        <p className="rodape" style={{ margin: '0 0 12px' }}>
          <strong>O mix muda a capacidade em metro e em peça no painel.</strong>
          {' '}O índice de um CT é a média das taxas dos produtos dele, ponderada
          pelo tempo: um recurso metade em algo a 15 m/min e metade em algo a 5
          converte a 10; em 100% do primeiro, a 15. Ajustar aqui muda esse
          número lá — em minuto e hora nada muda, porque tempo é tempo.
        </p>

        <div className="grade-rolagem">
          <table className="tabela-mes">
            <thead>
              <tr>
                <th>CT</th>
                <th>Recurso</th>
                <th>Mix</th>
                {MESES_CURTO.map((m) => <th key={m} className="num">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((ct) => {
                const temAjuste = ajusteDe.has(ct);
                const temBase = baseDe.has(ct);
                return (
                  <tr key={ct} className={aberto === ct ? 'linha-aberta' : ''}>
                    <td>
                      <button type="button" className="link-linha"
                              onClick={() => setAberto(aberto === ct ? null : ct)}>
                        {ct}
                      </button>
                    </td>
                    <td className="muted">{cad.get(ct)?.recursos ?? '—'}</td>
                    <td>
                      {temAjuste
                        ? <span className="selo rodizio">ajustado</span>
                        : temBase
                          ? <span className="selo padrao">da base</span>
                          : <span className="muted">sem demanda</span>}
                    </td>
                    {MESES_CURTO.map((_, i) => {
                      const mes = i + 1;
                      const manual = ajusteDe.get(ct)?.get(mes);
                      const vigente = manual ?? baseDe.get(ct)?.get(mes);
                      return (
                        <td key={mes}
                            className={`num mix-cel ${manual ? 'mix-manual' : 'muted'}`}
                            title={descreveMix(vigente)}>
                          {resumeMix(vigente)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!visiveis.length && (
                <tr><td colSpan="15" className="vazio">
                  Nada casa com os filtros escolhidos.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {aberto && (
        <EditorMix key={`${aberto}|${ano}|${atributo}`}
                   ct={aberto} recurso={cad.get(aberto)?.recursos}
                   ano={ano} atributo={atributo} attrNome={attrNome}
                   rotulos={rotulos} ehOrigem={ehOrigem}
                   base={baseDe.get(aberto)}
                   ajuste={ajusteDe.get(aberto)} taxa={taxaDe.get(aberto)}
                   baseToda={base} ocupado={ocupado}
                   fechar={() => setAberto(null)} chamar={chamar} />
      )}
    </>
  );
}

// ct -> mes -> [{rotulo, pct}]
function indexa(linhas) {
  const m = new Map();
  for (const l of linhas) {
    if (!m.has(l.ct)) m.set(l.ct, new Map());
    const meses = m.get(l.ct);
    if (!meses.has(l.mes)) meses.set(l.mes, []);
    meses.get(l.mes).push(l);
  }
  return m;
}

const nome = (rotulo) => (rotulo === SEM_ROTULO ? 'sem rótulo' : rotulo);

// "B 62" — o rótulo dominante e a fatia dele, para a célula caber na tabela.
function resumeMix(linhas) {
  if (!linhas?.length) return '—';
  const total = linhas.reduce((s, l) => s + Number(l.pct), 0);
  if (!total) return '—';
  const top = [...linhas].sort((a, b) => b.pct - a.pct)[0];
  const letra = top.rotulo === SEM_ROTULO ? '∅' : String(top.rotulo)[0];
  return `${letra} ${Math.round(top.pct * 100 / total)}`;
}

function descreveMix(linhas) {
  if (!linhas?.length) return 'sem demanda neste mês';
  const total = linhas.reduce((s, l) => s + Number(l.pct), 0);
  return [...linhas].sort((a, b) => b.pct - a.pct)
    .map((l) => `${nome(l.rotulo)}: ${pc(l.pct * 100 / total)}%`)
    .join('  ·  ');
}

// -----------------------------------------------------------------------------
// O EDITOR DE UM CT: rótulos × 12 meses, em %.
// -----------------------------------------------------------------------------

function EditorMix({ ct, recurso, ano, atributo, attrNome, rotulos, ehOrigem,
                     base, ajuste, taxa, baseToda, ocupado, fechar, chamar }) {
  // O rascunho nasce do que vale hoje: o ajuste onde existe, a base onde não.
  // Uma casa decimal, porque mix é decisão de gestão e não medição — quem
  // ajusta pensa em 90/10, não em 89,7342/10,2658.
  const [valores, setValores] = useState(() => {
    const v = {};
    for (let mes = 1; mes <= 12; mes += 1) {
      const fonte = ajuste?.get(mes) ?? base?.get(mes);
      if (!fonte?.length) continue;
      const total = fonte.reduce((s, l) => s + Number(l.pct), 0);
      if (!total) continue;
      for (const l of fonte) {
        const rot = l.rotulo ?? SEM_ROTULO;
        if (!v[rot]) v[rot] = {};
        v[rot][mes] = String(Math.round(l.pct * 1000 / total) / 10);
      }
    }
    return v;
  });

  // Linhas adicionadas à mão: um valor que o CT não tem hoje, para poder
  // ganhar fatia dele.
  const [extras, setExtras] = useState([]);

  // As linhas do editor. No DE/PARA são todos os rótulos — a lista é curta e
  // ver o zero é informação. Num campo da base seriam centenas de valores,
  // quase todos alheios a este CT: entram só os que o CT tem, os já ajustados
  // e os adicionados à mão; o resto fica no seletor de adicionar.
  const linhas = useMemo(() => {
    const s = new Set([
      ...(ehOrigem ? [] : rotulos),
      ...Object.keys(valores).filter((r) => r !== SEM_ROTULO),
      ...extras,
    ]);
    return [...s, SEM_ROTULO];
  }, [ehOrigem, rotulos, valores, extras]);

  const foraDaLista = rotulos.filter((r) => !linhas.includes(r));

  const muda = (rot, mes, valor) => setValores((v) => ({
    ...v, [rot]: { ...v[rot], [mes]: valor },
  }));

  // "Aplicar ao ano": o valor digitado na coluna Ano replica nos 12 meses.
  const [anoTodo, setAnoTodo] = useState({});
  const aplica = (rot) => {
    const valor = anoTodo[rot];
    if (valor === undefined || valor === '') return;
    setValores((v) => ({
      ...v,
      [rot]: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i + 1, valor])),
    }));
  };

  const somaDoMes = (mes) => linhas.reduce(
    (s, rot) => s + (Number(valores[rot]?.[mes]) || 0), 0);

  // Rótulo que o CT não produz na base do ano: precisa de taxa apontada para
  // converter em metros. A lista de doadores sai da própria base.
  const semTaxa = linhas.filter((rot) => rot !== SEM_ROTULO
    && !baseToda.some((b) => b.ct === ct && b.rotulo === rot && b.metros > 0)
    && Object.values(valores[rot] ?? {}).some((x) => Number(x) > 0));

  const doadores = useMemo(() => {
    const porCt = new Map();
    for (const b of baseToda) {
      if (!b.metros) continue;
      const t = porCt.get(b.ct) ?? { minutos: 0, metros: 0 };
      t.minutos += b.minutos; t.metros += b.metros;
      porCt.set(b.ct, t);
    }
    return [...porCt.entries()]
      .map(([c, t]) => ({ ct: c, taxa: (t.metros / t.minutos) * 60 }))
      .sort((a, b) => a.ct.localeCompare(b.ct));
  }, [baseToda]);

  const gravar = async () => {
    const corpo = [];
    for (const rot of linhas) {
      for (let mes = 1; mes <= 12; mes += 1) {
        const pct = Number(valores[rot]?.[mes]);
        if (pct > 0) {
          corpo.push({ mes, rotulo: rot === SEM_ROTULO ? null : rot, pct });
        }
      }
    }
    const ok = await chamar('POST', { ct, ano, atributo, linhas: corpo });
    if (ok) fechar();
  };

  return (
    <div className="painel">
      <div className="painel-topo">
        <h2>
          Mix de <code>{ct}</code>
          {recurso && <span> · {recurso}</span>}
          <span className="muted" style={{ fontWeight: 400 }}>
            {' '}· {attrNome} · {ano}
          </span>
        </h2>
        {ajuste && (
          <button type="button" className="btn btn-mini" disabled={ocupado}
                  onClick={async () => {
                    const ok = await chamar('DELETE', { ct, ano, atributo });
                    if (ok) fechar();
                  }}>
            usar o da base
          </button>
        )}
      </div>

      <div className="grade-rolagem">
        <table className="tabela-mes">
          <thead>
            <tr>
              <th>{attrNome}</th>
              <th className="num">Ano</th>
              <th />
              {MESES_CURTO.map((m) => <th key={m} className="num">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {linhas.map((rot) => (
              <tr key={rot} className={rot === SEM_ROTULO ? 'muted' : ''}>
                <td>{nome(rot)}</td>
                <td>
                  <input className="mix-input" inputMode="decimal"
                         value={anoTodo[rot] ?? ''}
                         onChange={(e) => setAnoTodo(
                           { ...anoTodo, [rot]: e.target.value })} />
                </td>
                <td>
                  <button type="button" className="btn btn-mini"
                          title="aplicar aos 12 meses"
                          onClick={() => aplica(rot)}>
                    →
                  </button>
                </td>
                {MESES_CURTO.map((_, i) => (
                  <td key={i} className="num">
                    <input className="mix-input" inputMode="decimal"
                           value={valores[rot]?.[i + 1] ?? ''}
                           onChange={(e) => muda(rot, i + 1, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="muted">
              <td>soma</td>
              <td colSpan="2" />
              {MESES_CURTO.map((_, i) => {
                const soma = somaDoMes(i + 1);
                return (
                  <td key={i} className="num">
                    {soma ? pc(soma) : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {foraDaLista.length > 0 && (
        <div className="acoes" style={{ marginTop: 8 }}>
          <select value="" onChange={(e) => {
                    if (e.target.value) setExtras([...extras, e.target.value]);
                  }}>
            <option value="">+ adicionar {attrNome.toLowerCase()}…</option>
            {foraDaLista.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      <p className="rodape">
        A soma não precisa dar 100: ao gravar, cada mês é{' '}
        <strong>normalizado proporcionalmente</strong> — 30/30 vira 50/50. Mês
        com tudo zerado volta a usar o mix da base. A linha{' '}
        <strong>sem rótulo</strong> é a demanda que nenhuma regra do DE/PARA
        classifica; ela entra no mix como as outras, senão os percentuais
        mentiriam.
      </p>

      {semTaxa.length > 0 && (
        <div className="aviso" style={{ margin: '12px 0' }}>
          <strong>
            {ct} não produz {semTaxa.map(nome).join(', ')} na base de {ano}.
          </strong>
          <p style={{ margin: '8px 0' }}>
            O tempo eu sei ratear, mas converter em metros precisa de uma taxa —
            e a deste rótulo neste CT não existe. Aponte de onde ela vem; sem
            apontar, a conversão dessa fatia usa a taxa média do próprio CT.
          </p>
          <div className="acoes">
            <select value={taxa ? `${taxa.tipo}:${taxa.valor}` : ''}
                    disabled={ocupado}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        chamar('DELETE', { acao: 'taxa', ct, atributo });
                      } else {
                        const [tipo, valor] = e.target.value.split(':');
                        chamar('POST', { acao: 'taxa', ct, atributo, tipo, valor });
                      }
                    }}>
              <option value="">sem apontamento</option>
              {[...new Set(doadores.map((d) => d.ct.split('-')[0]))].map((cc) => (
                <option key={cc} value={`CC:${cc}`}>média do CC {cc}</option>
              ))}
              {doadores.filter((d) => d.ct !== ct).map((d) => (
                <option key={d.ct} value={`CT:${d.ct}`}>
                  {d.ct} — {pc(d.taxa)} m/h
                </option>
              ))}
            </select>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>
            O doador empresta a taxa <strong>dele para o rótulo em questão</strong>,
            não a média geral — um tear que faz Mesa devagar e Banho rápido doa
            cada taxa à sua fatia.
          </p>
        </div>
      )}

      <div className="acoes">
        <button type="button" className="btn btn-primario" disabled={ocupado}
                onClick={gravar}>
          Gravar mix ajustado
        </button>
        <button type="button" className="btn" onClick={fechar}>Fechar</button>
      </div>
    </div>
  );
}
