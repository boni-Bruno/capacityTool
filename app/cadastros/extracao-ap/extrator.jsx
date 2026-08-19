'use client';

import { useMemo, useState } from 'react';

// Os filtros, a prévia e o botão de baixar.
//
// O fluxo é em dois passos de propósito: gerar mostra o total e as primeiras
// linhas ANTES de existir arquivo — extração conferida aqui custa um clique;
// conferida no AP, custa uma importação errada lá dentro.
//
// Os filtros estreitam em cascata, como em Turnos do recurso: planta limita
// área, que limita CC, e assim por diante. Cada um valida contra o que restou
// dos anteriores.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');

// Excel brasileiro: ponto e vírgula separa, e o número não leva separador de
// milhar. Minuto sai inteiro — a fração existe dentro do cálculo para a soma
// bater, mas um arquivo de integração não é lugar de 0,0004 min.
function montaCsv(linhas) {
  const corpo = linhas.map((l) =>
    `${l.ct};${l.periodo};${Math.round(Number(l.minutos))}`);
  return ['CT;Periodo;Minutos', ...corpo].join('\r\n');
}

export default function Extrator({ recursos, anos }) {
  const [filtro, setFiltro] = useState({});
  const [medida, setMedida] = useState('DISPONIVEL');
  const [de, setDe] = useState(`${anos[0]}-01`);
  const [ate, setAte] = useState(`${anos[anos.length - 1]}-12`);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);

  const muda = (chave, valor) => {
    setResultado(null);
    setFiltro((f) => {
      const novo = { ...f };
      if (valor) novo[chave] = valor; else delete novo[chave];
      // Cada nível derruba os de baixo: área é da planta, CC vive dentro da
      // área filtrada, e assim por diante — manter escolha órfã filtraria
      // para o vazio sem explicação.
      const ordem = ['planta', 'area', 'sub', 'cc', 'ct', 'pat', 'recurso'];
      for (const k of ordem.slice(ordem.indexOf(chave) + 1)) delete novo[k];
      return novo;
    });
  };

  // O funil: cada seletor lista o que existe depois dos filtros anteriores.
  const etapas = useMemo(() => {
    const passa = (r, ate_) => {
      if (filtro.planta && r.planta !== filtro.planta) return false;
      if (ate_ > 1 && filtro.area && r.area !== filtro.area) return false;
      if (ate_ > 2 && filtro.sub && r.sub_area !== filtro.sub) return false;
      if (ate_ > 3 && filtro.cc && r.cc !== filtro.cc) return false;
      if (ate_ > 4 && filtro.ct && r.ct !== filtro.ct) return false;
      if (ate_ > 5 && filtro.pat && r.patrimonio !== filtro.pat) return false;
      return true;
    };
    const distintos = (lista, campo) =>
      [...new Set(lista.map((r) => r[campo]).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

    const aposPlanta = recursos.filter((r) => passa(r, 1));
    const aposArea = aposPlanta.filter((r) => passa(r, 2));
    const aposSub = aposArea.filter((r) => passa(r, 3));
    const aposCc = aposSub.filter((r) => passa(r, 4));
    const aposCt = aposCc.filter((r) => passa(r, 5));
    const aposPat = aposCt.filter((r) => passa(r, 6));
    const selecionados = filtro.recurso
      ? aposPat.filter((r) => String(r.id) === filtro.recurso)
      : aposPat;

    return {
      plantas: distintos(recursos, 'planta'),
      areas: distintos(aposPlanta, 'area'),
      subs: distintos(aposArea, 'sub_area'),
      ccs: distintos(aposSub, 'cc'),
      cts: distintos(aposCc, 'ct'),
      pats: distintos(aposCt, 'patrimonio'),
      nomes: aposPat,
      selecionados,
    };
  }, [recursos, filtro]);

  const filtrando = Object.keys(filtro).length > 0;

  async function gerar() {
    setOcupado(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await fetch('/api/extracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medida,
          de: `${de}-01`,
          // O último dia do mês final, calculado aqui: dia 0 do mês seguinte.
          ate: ultimoDia(ate),
          recursos: filtrando
            ? (etapas.selecionados.map((r) => r.id).join(',') || '0')
            : null,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setResultado(j.linhas);
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(false);
    }
  }

  function baixar() {
    // BOM na frente para o Excel abrir como UTF-8 sem perguntar.
    const blob = new Blob(['﻿' + montaCsv(resultado)],
                          { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `capacidade_ap_${de}_${ate}_${medida.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const totalMin = resultado?.reduce((s, l) => s + Number(l.minutos), 0) ?? 0;
  const cts = resultado ? new Set(resultado.map((l) => l.ct)).size : 0;

  return (
    <>
      {erro && <p className="erro">{erro}</p>}

      <div className="painel">
        <h2>O que sai</h2>
        <p className="rodape" style={{ margin: '0 0 12px' }}>
          Três colunas — <code>CT;Periodo;Minutos</code> — condensadas por mês,
          com o período em <strong>AAAA.MM</strong>, o mesmo formato da base de
          demanda. Cada área e ano entram com a <strong>última rodada</strong>
          {' '}do OEE META, a mesma que o painel mostra.
        </p>

        <div className="filtros" style={{ marginBottom: 14 }}>
          <label className="campo">
            <span className="campo-rot">Medida</span>
            <select value={medida}
                    onChange={(e) => { setMedida(e.target.value); setResultado(null); }}>
              <option value="DISPONIVEL">Disponível (com OEE)</option>
              <option value="PLANEJADA">Planejada (sem OEE)</option>
              <option value="INSTALADA">Instalada (teto)</option>
            </select>
          </label>
          <label className="campo">
            <span className="campo-rot">De</span>
            <input type="month" value={de}
                   onChange={(e) => { setDe(e.target.value); setResultado(null); }} />
          </label>
          <label className="campo">
            <span className="campo-rot">Até</span>
            <input type="month" value={ate}
                   onChange={(e) => { setAte(e.target.value); setResultado(null); }} />
          </label>
        </div>

        <div className="filtros" style={{ marginBottom: 14 }}>
          <Sel rotulo="Planta" valor={filtro.planta}
               opcoes={etapas.plantas} muda={(v) => muda('planta', v)} />
          <Sel rotulo="Área" valor={filtro.area}
               opcoes={etapas.areas} muda={(v) => muda('area', v)} />
          <Sel rotulo="Sub-área" valor={filtro.sub}
               opcoes={etapas.subs} muda={(v) => muda('sub', v)} />
          <Sel rotulo="CC" valor={filtro.cc}
               opcoes={etapas.ccs} muda={(v) => muda('cc', v)} />
          <Sel rotulo="CT" valor={filtro.ct}
               opcoes={etapas.cts} muda={(v) => muda('ct', v)} />
          <Sel rotulo="Patrimônio" valor={filtro.pat}
               opcoes={etapas.pats} muda={(v) => muda('pat', v)} />
          <label className="campo">
            <span className="campo-rot">Recurso</span>
            <select value={filtro.recurso ?? ''}
                    onChange={(e) => muda('recurso', e.target.value)}>
              <option value="">todos</option>
              {etapas.nomes.map((r) => (
                <option key={r.id} value={String(r.id)}>{r.nome}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="rodape" style={{ margin: '0 0 12px' }}>
          {filtrando
            ? <><strong>{fmt(etapas.selecionados.length)}</strong> recursos no
                recorte atual.</>
            : <>Sem filtro: todas as plantas, {fmt(recursos.length)} recursos.</>}
        </p>

        <div className="acoes">
          <button type="button" className="btn btn-primario" disabled={ocupado}
                  onClick={gerar}>
            {ocupado ? 'Gerando…' : 'Gerar extração'}
          </button>
          {resultado?.length > 0 && (
            <button type="button" className="btn" onClick={baixar}>
              Baixar .csv ({fmt(resultado.length)} linhas)
            </button>
          )}
        </div>
      </div>

      {resultado && (
        <div className="painel">
          <h2>
            Prévia
            <span className="muted" style={{ fontWeight: 400 }}>
              {' '}· o arquivo inteiro, conferível antes de baixar
            </span>
          </h2>

          {!resultado.length ? (
            <p className="vazio">
              Nada no recorte: nenhum minuto calculado para esses filtros e
              período. Confira se o ano tem rodada e se o recorte não ficou
              estreito demais.
            </p>
          ) : (
            <>
              <div className="kpis">
                <div className="kpi">
                  <p className="rot">Linhas</p>
                  <p className="val">{fmt(resultado.length)}</p>
                  <p className="sub">{fmt(cts)} centros de trabalho</p>
                </div>
                <div className="kpi">
                  <p className="rot">Minutos</p>
                  <p className="val">{fmt(Math.round(totalMin))}</p>
                  <p className="sub">{fmt(Math.round(totalMin / 60))} horas</p>
                </div>
              </div>

              <div className="grade-rolagem">
                <table className="tabela-mes">
                  <thead>
                    <tr>
                      <th>CT</th>
                      <th>Período</th>
                      <th className="num">Minutos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.slice(0, 30).map((l) => (
                      <tr key={`${l.ct}|${l.periodo}`}>
                        <td><code>{l.ct}</code></td>
                        <td>{l.periodo}</td>
                        <td className="num">{fmt(Math.round(Number(l.minutos)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {resultado.length > 30 && (
                <p className="rodape">
                  Mostrando 30 de {fmt(resultado.length)} linhas — o arquivo
                  leva todas.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

function Sel({ rotulo, valor, opcoes, muda }) {
  return (
    <label className="campo">
      <span className="campo-rot">{rotulo}</span>
      <select value={valor ?? ''} onChange={(e) => muda(e.target.value)}>
        <option value="">todos</option>
        {opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

// 'AAAA-MM' -> o último dia daquele mês, 'AAAA-MM-DD'.
function ultimoDia(mes) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${mes}-${String(d).padStart(2, '0')}`;
}
