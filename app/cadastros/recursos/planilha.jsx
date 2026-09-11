'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { escreveXlsx, leXlsx } from '../../../lib/xlsx';
import {
  COLUNAS, linhasParaExportar, montarImportacao,
} from '../../../lib/recursos-formato';

// EXPORTAR E IMPORTAR A TABELA DE RECURSOS EM .XLSX
//
// O arquivo é montado e lido AQUI, no navegador, como o parquet e o pptx: o
// servidor não vê planilha nenhuma. O que sobe são pedidos de criar e alterar,
// um por linha, pelas mesmas rotas que a tela já usa — o laço mora no
// navegador pela razão de sempre: função serverless tem minuto contado, e
// trezentas linhas numa requisição só estouram no meio deixando metade gravada.
//
// A PRÉVIA VEM ANTES DE QUALQUER GRAVAÇÃO. O que a importação vai fazer sai de
// `montarImportacao` (lib/recursos-formato.js, puro e testado), e a pessoa vê
// quantas linhas criam, quantas alteram, quantas estão iguais e quais ficaram de
// fora — com o número da linha da planilha, para achar a célula no Excel.
//
// Linha que está no banco e não está no arquivo fica intocada: importar nunca
// apaga por omissão.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');

async function pede(url, metodo, corpo) {
  const r = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.erro);
  return j;
}

export default function Planilha({ itens, areas }) {
  const router = useRouter();
  const [plano, setPlano] = useState(null);      // a prévia
  const [nome, setNome] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [andamento, setAndamento] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);

  async function exportar() {
    setErro(null);
    try {
      const bytes = await escreveXlsx({
        aba: 'Recursos',
        colunas: COLUNAS,
        linhas: linhasParaExportar(itens),
      });
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `recursos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErro(e.message ?? 'Não consegui montar a planilha.');
    }
  }

  async function escolher(e) {
    const arq = e.target.files?.[0];
    e.target.value = '';                     // permite reescolher o mesmo
    if (!arq) return;

    setLendo(true);
    setErro(null);
    setPlano(null);
    setResultado(null);
    try {
      const { linhas } = await leXlsx(new Uint8Array(await arq.arrayBuffer()));
      setPlano(montarImportacao(linhas, { areas, existentes: itens }));
      setNome(arq.name);
    } catch (ex) {
      setErro(ex.message ?? 'Não consegui ler o arquivo.');
    } finally {
      setLendo(false);
    }
  }

  async function importar() {
    setGravando(true);
    setErro(null);
    const falhas = [];
    let criados = 0;
    let alterados = 0;
    const total = plano.criar.length + plano.alterar.length;
    let feitos = 0;

    // Um por requisição, e ERRO NUM RECURSO NÃO PARA O LAÇO: as outras linhas
    // são legítimas, e refazer tudo porque uma falhou criaria duplicadas. O
    // que falhou é dito no fim, com a linha e o código.
    for (const c of plano.criar) {
      setAndamento({ feitos: feitos += 1, total, codigo: c.codigo });
      try {
        const j = await pede('/api/cadastro/recurso', 'POST', c);
        // O recurso nasce ativo; "não" no arquivo é um segundo pedido.
        if (c.ativo === false) {
          await pede('/api/cadastro/recurso', 'PUT', { id: j.id, ativo: false });
        }
        criados += 1;
      } catch (ex) {
        falhas.push(`linha ${c.linha} (${c.codigo}): ${ex.message ?? 'falhou'}`);
      }
    }

    for (const a of plano.alterar) {
      setAndamento({ feitos: feitos += 1, total, codigo: a.codigo });
      try {
        if (!a.soAtivo) await pede('/api/cadastro/recurso', 'PATCH', a);
        if (a.ativo !== null) {
          await pede('/api/cadastro/recurso', 'PUT', { id: a.id, ativo: a.ativo });
        }
        alterados += 1;
      } catch (ex) {
        falhas.push(`linha ${a.linha} (${a.codigo}): ${ex.message ?? 'falhou'}`);
      }
    }

    setAndamento(null);
    setGravando(false);
    setPlano(null);
    setResultado({ criados, alterados, falhas });
    router.refresh();
  }

  const podeImportar = plano && (plano.criar.length + plano.alterar.length) > 0;

  return (
    <>
      <div className="acoes" style={{ marginBottom: 16 }}>
        <button type="button" className="btn" onClick={exportar}
                disabled={!itens?.length || gravando}>
          Exportar .xlsx
        </button>
        <label className="btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {lendo ? 'Lendo…' : 'Importar .xlsx'}
          <input type="file" accept=".xlsx" onChange={escolher}
                 disabled={lendo || gravando} style={{ display: 'none' }} />
        </label>
        <span className="muted" style={{ fontSize: 13 }}>
          a mesma tabela, com a planta ao lado da área · a chave é CC-CT-Patrimônio
        </span>
      </div>

      {erro && <p className="erro">{erro}</p>}

      {resultado && (
        <div className={'aviso' + (resultado.falhas.length ? '' : ' aviso-ok')}
             style={{ marginBottom: 16 }}>
          <strong>
            {fmt(resultado.criados)} criado(s), {fmt(resultado.alterados)} alterado(s).
            {resultado.falhas.length > 0 && ` ${fmt(resultado.falhas.length)} não entraram.`}
          </strong>
          {resultado.falhas.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {resultado.falhas.slice(0, 15).map((f) => <li key={f}>{f}</li>)}
              {resultado.falhas.length > 15 && <li>… e mais {resultado.falhas.length - 15}.</li>}
            </ul>
          )}
          <p style={{ margin: '6px 0 0' }}>
            Recurso novo ou alterado só entra no número ao{' '}
            <strong>Recalcular tudo</strong>.{' '}
            <button type="button" className="link-linha" onClick={() => setResultado(null)}>
              fechar
            </button>
          </p>
        </div>
      )}

      {plano && (
        <div className="painel-interno" style={{ marginBottom: 16 }}>
          <p className="campo-rot" style={{ marginBottom: 8 }}>
            Prévia de <strong>{nome}</strong> — nada foi gravado ainda
          </p>

          <div className="kpis">
            <div className="kpi">
              <p className="rot">Criar</p>
              <p className="val">{fmt(plano.criar.length)}</p>
              <p className="sub">trinca que não existe no cadastro</p>
            </div>
            <div className="kpi">
              <p className="rot">Alterar</p>
              <p className="val">{fmt(plano.alterar.length)}</p>
              <p className="sub">trinca existente com algo diferente</p>
            </div>
            <div className="kpi">
              <p className="rot">Iguais</p>
              <p className="val">{fmt(plano.iguais)}</p>
              <p className="sub">nada muda, nenhum pedido sai</p>
            </div>
            <div className="kpi">
              <p className="rot">Ficam de fora</p>
              <p className="val">{fmt(plano.ignoradas.length + plano.erros.length)}</p>
              <p className="sub">
                {fmt(plano.ignoradas.length)} planta/área desconhecida ·{' '}
                {fmt(plano.erros.length)} com erro
              </p>
            </div>
          </div>

          {(plano.ignoradas.length > 0 || plano.erros.length > 0) && (
            <div className="aviso" style={{ marginTop: 12 }}>
              <strong>Estas linhas não entram. O resto entra normalmente.</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {[...plano.ignoradas, ...plano.erros]
                  .sort((a, b) => a.linha - b.linha)
                  .slice(0, 20)
                  .map((x) => <li key={`${x.linha}:${x.motivo}`}>linha {x.linha}: {x.motivo}</li>)}
                {plano.ignoradas.length + plano.erros.length > 20 && (
                  <li>… e mais {plano.ignoradas.length + plano.erros.length - 20}.</li>
                )}
              </ul>
            </div>
          )}

          <div className="acoes" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primario" onClick={importar}
                    disabled={!podeImportar || gravando}>
              {gravando
                ? 'Gravando…'
                : `Importar ${fmt(plano.criar.length + plano.alterar.length)} linha(s)`}
            </button>
            <button type="button" className="btn" disabled={gravando}
                    onClick={() => setPlano(null)}>
              Descartar
            </button>
            {!podeImportar && !gravando && (
              <span className="muted">nada a criar nem a alterar</span>
            )}
            {andamento && (
              <span className="muted">
                {andamento.feitos} de {andamento.total} · {andamento.codigo}
              </span>
            )}
          </div>

          <p className="rodape">
            A chave é a trinca <strong>CC-CT-Patrimônio</strong>: trinca que
            existe altera nome, sub-área, tipo, quantidade, equivalência, janela
            de operação e ativo; trinca nova cria. Recurso que está no cadastro e
            não está no arquivo <strong>fica como está</strong> — importar nunca
            apaga. Recurso existente não muda de área por aqui. O que está
            escrito na célula é o que entra: CC, CT e Patrimônio saem como texto
            para o Excel não comer o zero à esquerda, e a coluna Código é só
            leitura — ela sai da trinca.
          </p>
        </div>
      )}
    </>
  );
}
