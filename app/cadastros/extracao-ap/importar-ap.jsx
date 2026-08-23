'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { lerParquet } from '../../../lib/parquet';
import { dataDeMicros } from '../../../lib/demanda-formato';
import { conferirColunasAp, montarRecursosAp } from '../../../lib/ap';

// A importação da quantidade de recurso do AP.
//
// O arquivo não sobe: é lido aqui no navegador e conferido antes de qualquer
// coisa ser gravada, como a carga de demanda. São 228 linhas, então vai tudo
// numa requisição — o lote da demanda existe por causa das 116 mil.
//
// Isto é um retrato do parque do AP, não uma versão de plano: importar
// substitui o que havia. Retrato velho de parque não serve para nada, e manter
// o antigo faria a extração dividir por recurso que já saiu de lá.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');
const quando = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

export default function ImportarAp({ resumo, semQuantidade }) {
  const router = useRouter();
  const [lido, setLido] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aberto, setAberto] = useState(false);

  async function escolher(e) {
    const arq = e.target.files?.[0];
    e.target.value = '';                     // permite reescolher o mesmo
    if (!arq) return;

    setLendo(true);
    setErro(null);
    setLido(null);
    try {
      const parquet = await lerParquet(new Uint8Array(await arq.arrayBuffer()));

      const faltando = conferirColunasAp(parquet.nomes);
      if (faltando.length) {
        throw new Error(`O arquivo não tem ${faltando.join(', ')}. `
          + 'Este é o parquet de recursos do AP, não o de demanda.');
      }

      // Do formato colunar do parquet para uma linha por registro.
      const linhas = [];
      for (let i = 0; i < parquet.linhas; i += 1) {
        linhas.push(Object.fromEntries(
          parquet.nomes.map((n) => [n, parquet.colunas[n][i]])));
      }

      const { problemas, itens, resumo: r } = montarRecursosAp(linhas);
      if (problemas.length) {
        setErro(problemas.slice(0, 3).join(' '));
        return;
      }
      setLido({
        nome: arq.name,
        itens,
        resumo: r,
        extraido: dataDeMicros(parquet.colunas.data_extracao?.[0]),
      });
    } catch (ex) {
      setErro(ex.message ?? 'Não consegui ler o arquivo.');
    } finally {
      setLendo(false);
    }
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch('/api/recursos-ap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linhas: lido.itens.map((x) => ({
            CENTROTRABALHO: x.ct,
            INDICADORCALCULOCAPACIDADE: x.indicador,
            // O condensamento já resolveu qual campo valia; o servidor refaz a
            // conta sobre o mesmo indicador e chega no mesmo lugar.
            QTMAQUINA: x.indicador === 'M' ? x.qtd : 0,
            QTPESSOAS: x.indicador === 'P' ? x.qtd : 0,
            DESCRCENTROTRABALHO: x.descricao,
          })),
          extraido_em: lido.extraido?.toISOString() ?? null,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setLido(null);
      router.refresh();
    } catch (ex) {
      setErro(ex.message ?? 'Falhou');
    } finally {
      setEnviando(false);
    }
  }

  const temBase = Number(resumo?.centros) > 0;

  return (
    <div className="painel">
      <div className="painel-topo">
        <h2>
          Quantidade de recurso do AP
          {temBase && (
            <span className="muted" style={{ fontWeight: 400 }}>
              {' '}· {fmt(resumo.centros)} centros · extraído em{' '}
              {quando(resumo.extraido_em)}
            </span>
          )}
        </h2>
        <div className="acoes">
          <label className="btn" style={{ display: 'inline-flex',
                                          alignItems: 'center' }}>
            {lendo ? 'Lendo…' : temBase ? 'Atualizar do AP' : 'Importar do AP'}
            <input type="file" accept=".parquet" onChange={escolher}
                   disabled={lendo || enviando}
                   style={{ display: 'none' }} />
          </label>
          {temBase && (
            <button type="button" className="btn btn-mini"
                    onClick={() => setAberto(!aberto)}>
              {aberto ? 'esconder' : 'conferir'}
            </button>
          )}
        </div>
      </div>

      {erro && <p className="erro">{erro}</p>}

      {!temBase && !lido && (
        <p className="vazio">
          Sem esta importação a extração sai só com os minutos totais. O arquivo
          é o <code>RecursosAP_CapacityTool.parquet</code>, exportado do AP — ele
          traz a quantidade em dois campos (máquina e pessoas), e aqui os dois
          viram um só, escolhido pelo indicador de cálculo de capacidade do
          próprio AP.
        </p>
      )}

      {/* A conferência antes de gravar. Quantidade errada não dá erro em lugar
          nenhum: entrega um número plausível, e o AP importa sem reclamar. */}
      {lido && (
        <>
          <div className="kpis">
            <div className="kpi">
              <p className="rot">Centros de trabalho</p>
              <p className="val">{fmt(lido.resumo.centros)}</p>
              <p className="sub">
                de {fmt(lido.resumo.linhas)} linhas · {lido.nome}
              </p>
            </div>
            <div className="kpi">
              <p className="rot">Com quantidade</p>
              <p className="val">{fmt(lido.resumo.com_quantidade)}</p>
              <p className="sub">
                {fmt(lido.resumo.maquina)} por máquina ·{' '}
                {fmt(lido.resumo.pessoa)} por pessoas
              </p>
            </div>
            <div className="kpi">
              <p className="rot">Recursos somados</p>
              <p className="val">{fmt(lido.resumo.total_recursos)}</p>
              <p className="sub">
                {fmt(lido.resumo.sem_quantidade)} centros sem quantidade —
                facção e serviço externo
              </p>
            </div>
          </div>

          <p className="rodape" style={{ margin: '0 0 12px' }}>
            Gravar <strong>substitui</strong> o que está guardado: isto é um
            retrato do parque do AP, e centro que saiu de lá tem que sair daqui.
            {' '}Extraído em {quando(lido.extraido)}.
          </p>

          <div className="acoes">
            <button type="button" className="btn btn-primario" disabled={enviando}
                    onClick={enviar}>
              {enviando ? 'Gravando…' : 'Gravar quantidades'}
            </button>
            <button type="button" className="btn" onClick={() => setLido(null)}>
              Descartar
            </button>
          </div>
        </>
      )}

      {temBase && !lido && (
        <div className="kpis">
          <div className="kpi">
            <p className="rot">Com quantidade</p>
            <p className="val">{fmt(resumo.com_quantidade)}</p>
            <p className="sub">
              de {fmt(resumo.centros)} centros · {fmt(resumo.total_recursos)}{' '}
              recursos somados
            </p>
          </div>
          <div className="kpi">
            <p className="rot">Cruzam com o cadastro</p>
            <p className="val">{fmt(resumo.com_recurso_cadastrado)}</p>
            <p className="sub">
              centros do AP que têm recurso aqui — são estes que a divisão
              alcança
            </p>
          </div>
          {semQuantidade.length > 0 && (
            <div className="kpi">
              <p className="rot">Sem divisor</p>
              <p className="val">{fmt(semQuantidade.length)}</p>
              <p className="sub">
                centros com capacidade calculada e sem quantidade no AP — saem
                com a coluna por recurso vazia
              </p>
            </div>
          )}
        </div>
      )}

      {aberto && temBase && semQuantidade.length > 0 && (
        <div className="grade-rolagem" style={{ marginTop: 12 }}>
          <table className="tabela-mes">
            <thead>
              <tr>
                <th>CT</th>
                <th>Recurso</th>
                <th>No arquivo do AP</th>
              </tr>
            </thead>
            <tbody>
              {semQuantidade.map((x) => (
                <tr key={x.ct}>
                  <td><code>{x.ct}</code></td>
                  <td className="muted">{x.recursos}</td>
                  <td className="muted">
                    {x.no_ap ? 'existe, com quantidade zero' : 'não veio'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
