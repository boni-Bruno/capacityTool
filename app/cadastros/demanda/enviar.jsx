'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { lerParquet } from '../../../lib/parquet';
import { dataDeMicros, montarCarga } from '../../../lib/demanda-formato';

// Importação da base de demanda.
//
// O arquivo NÃO sobe. Ele é lido aqui no navegador — parquet é zip de Thrift e
// `DecompressionStream` é nativo —, conferido, mostrado, e só então as linhas
// são enviadas em lotes.
//
// A ordem é de propósito: ver antes de gravar. Uma base de demanda errada não
// dá erro em lugar nenhum, ela só faz o painel mostrar outro número.

const LOTE = 2000;
const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');

export default function EnviarDemanda({ recursosCadastrados }) {
  const router = useRouter();
  const [lido, setLido] = useState(null);      // { nome, resumo, linhas, meta }
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [corrente, setCorrente] = useState(true);

  async function escolher(e) {
    const arq = e.target.files?.[0];
    e.target.value = '';                       // permite reescolher o mesmo
    if (!arq) return;

    setLendo(true);
    setErro(null);
    setLido(null);
    try {
      const bytes = new Uint8Array(await arq.arrayBuffer());
      const parquet = await lerParquet(bytes);
      const { problemas, linhas, resumo } = montarCarga(parquet);

      if (problemas.length) {
        setErro(problemas.join(' '));
        return;
      }
      setLido({
        nome: arq.name,
        tamanho: arq.size,
        linhas,
        resumo,
        cenario: [...resumo.cenarios][0],
        extraido: dataDeMicros(parquet.colunas.data_extracao?.[0]),
        criadoPor: parquet.criadoPor,
      });
    } catch (ex) {
      setErro(ex.message ?? 'Não consegui ler o arquivo.');
    } finally {
      setLendo(false);
    }
  }

  async function chamar(corpo) {
    const r = await fetch('/api/demanda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro);
    return j;
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);
    setProgresso(0);
    try {
      const { carga_id } = await chamar({
        acao: 'abrir',
        arquivo: lido.nome,
        cenario: lido.cenario,
        extraido_em: lido.extraido?.toISOString() ?? null,
        criado_por: lido.criadoPor,
      });

      const total = lido.linhas.length;
      for (let i = 0; i < total; i += LOTE) {
        await chamar({ acao: 'lote', carga_id, linhas: lido.linhas.slice(i, i + LOTE) });
        setProgresso(Math.min(i + LOTE, total));
      }

      await chamar({ acao: 'concluir', carga_id, corrente });
      setLido(null);
      router.refresh();
    } catch (ex) {
      // A carga fica no banco, incompleta e fora do ar. É de propósito: dá para
      // ver o que entrou antes de apagar, e ela não substitui a que está válida.
      setErro(`${ex.message ?? 'Falhou'} — a carga ficou incompleta e não entrou `
            + 'no ar. Apague-a na lista abaixo e tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  const r = lido?.resumo;
  // O casamento é conferido de novo no servidor depois de gravar; aqui é só
  // uma prévia, com o cadastro que a página trouxe.
  const semRecurso = r
    ? [...r.cts.keys()].filter((ct) => !recursosCadastrados.includes(ct))
    : [];
  const horasSemRecurso = semRecurso.reduce((s, ct) => s + r.cts.get(ct), 0) / 60;
  const horas = r ? r.minutos / 60 : 0;

  return (
    <div className="painel">
      <h2>Importar base de demanda</h2>

      <div className="acoes">
        <label className="btn btn-primario" style={{ cursor: 'pointer' }}>
          {lendo ? 'Lendo…' : 'Escolher arquivo .parquet'}
          <input type="file" accept=".parquet" onChange={escolher}
                 disabled={lendo || enviando} style={{ display: 'none' }} />
        </label>
        {lido && !enviando && (
          <button className="btn btn-mini" onClick={() => setLido(null)}>
            Descartar
          </button>
        )}
      </div>

      {erro && (
        <div className="aviso" style={{ marginTop: 14 }}>
          <strong>Não importei.</strong>
          <p style={{ margin: '6px 0 0' }}>{erro}</p>
        </div>
      )}

      {r && (
        <>
          <p className="rodape" style={{ marginTop: 14 }}>
            <strong>{lido.nome}</strong> · {fmt(Math.round(lido.tamanho / 1024))} KB
            {lido.criadoPor && <> · escrito por <code>{lido.criadoPor}</code></>}
            {lido.extraido && <> · extraído em {lido.extraido.toLocaleString('pt-BR')}</>}
          </p>

          <div className="kpis" style={{ marginTop: 4 }}>
            <div className="kpi">
              <p className="rot">Linhas</p>
              <p className="val">{fmt(r.total)}</p>
              <p className="sub">{fmt(r.periodos.size)} períodos</p>
            </div>
            <div className="kpi">
              <p className="rot">Demanda</p>
              <p className="val">{fmt(Math.round(horas))} h</p>
              <p className="sub">{r.periodos.size ? `${[...r.periodos.keys()].sort()[0]} a ${[...r.periodos.keys()].sort().at(-1)}` : ''}</p>
            </div>
            <div className="kpi">
              <p className="rot">Centros de trabalho</p>
              <p className="val">{fmt(r.cts.size)}</p>
              <p className="sub">
                {semRecurso.length
                  ? `${fmt(semRecurso.length)} sem recurso cadastrado`
                  : 'todos com recurso'}
              </p>
            </div>
          </div>

          <p className="rodape">
            Cenário <strong>{lido.cenario}</strong>.
            {' '}{fmt(r.semCt)} linhas sem CT — item comprado ou de revenda, que
            vem sem duração e entra na carga sem participar da conta.
            {' '}{fmt(r.zeradas)} linhas zeradas: elas dizem quais períodos o
            plano contempla.
            {r.semTempoComQtd > 0 && <>
              {' '}{fmt(r.semTempoComQtd)} com quantidade e sem tempo.
            </>}
            {r.inesperadas.length > 0 && <>
              {' '}Colunas a mais no arquivo, que serão ignoradas:{' '}
              <code>{r.inesperadas.join(', ')}</code>.
            </>}
          </p>

          {semRecurso.length > 0 && (
            <div className="aviso" style={{ marginTop: 4 }}>
              <strong>
                {fmt(semRecurso.length)} centros de trabalho com demanda e sem
                recurso cadastrado — {fmt(Math.round(horasSemRecurso))} h
              </strong>
              <p style={{ margin: '6px 0 0' }}>
                Isso não impede a importação e não é erro. A linha entra, fica
                marcada, e passa a valer sozinha no dia em que o recurso for
                cadastrado — o vínculo é o <code>CC-CT</code> da máquina, e ele
                é resolvido na leitura, não gravado na carga.
              </p>
              <p style={{ margin: '6px 0 0' }} className="muted">
                {semRecurso.slice(0, 12).join(' · ')}
                {semRecurso.length > 12 && ` … e mais ${semRecurso.length - 12}`}
              </p>
            </div>
          )}

          <label className="campo-inline" style={{ marginTop: 14 }}>
            <input type="checkbox" checked={corrente} disabled={enviando}
                   onChange={(e) => setCorrente(e.target.checked)} />
            <span className="campo-rot">
              Colocar no ar assim que terminar
            </span>
          </label>

          <div className="acoes" style={{ marginTop: 12 }}>
            <button className="btn btn-primario" onClick={enviar} disabled={enviando}>
              {enviando
                ? `Gravando ${fmt(progresso)} de ${fmt(r.total)}…`
                : `Importar ${fmt(r.total)} linhas`}
            </button>
            {enviando && (
              <span className="muted">
                em lotes de {fmt(LOTE)} — não feche a aba
              </span>
            )}
          </div>
        </>
      )}

      {!r && !erro && (
        <p className="rodape" style={{ marginTop: 10 }}>
          O arquivo é lido aqui no navegador e <strong>não sobe</strong> — o que
          sobe são as linhas já lidas, em lotes. Assim a conferência aparece
          antes de qualquer coisa ser gravada.
          {' '}Só <code>.parquet</code> com compressão GZIP; outra compressão é
          recusada com o nome do que veio, em vez de ser lida errado em silêncio.
        </p>
      )}
    </div>
  );
}
