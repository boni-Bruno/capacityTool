'use client';

import { useState } from 'react';
import { escreveXlsx } from '../../../lib/xlsx';
import { montarSimulador, resumoDoSimulador } from '../../../lib/simulador';
import Arvore from '../extracao-config/arvore';

// A tela do simulador de quantidade de recursos.
//
// O SERVIDOR SÓ ENTREGA NÚMEROS — por CT e mês, demanda, planejada, disponível,
// dias úteis e unidades-dia da rodada. A prévia por CT×ano é
// `resumoDoSimulador`, e o .xlsx é `montarSimulador` + `escreveXlsx`, os dois
// aqui no navegador. A prévia mostra o que a planilha mostrará ao abrir; a
// planilha é que aceita mexer em unidades e OEE.
//
// AS ESCOLHAS MORAM EM ESTADO, como na extração das configurações: a marcação
// da árvore é estado, e navegar remontaria o componente e apagaria o recorte.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');
const fmt2 = (n) => Number(n ?? 0).toLocaleString('pt-BR',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => `${(Number(n ?? 0) * 100).toLocaleString('pt-BR',
  { maximumFractionDigits: 0 })}%`;

const UNIDADE = { MAQUINA: 'máquinas', PESSOA: 'pessoas', MISTO: 'misto' };

const Grupo = ({ opcoes, valor, onEscolhe, mini }) => (
  <nav className={mini ? 'modo modo-ano' : 'modo'}>
    {opcoes.map((o) => (
      <button key={o.valor} type="button" title={o.dica ?? ''}
              className={o.valor === valor ? 'modo-on' : ''}
              onClick={() => onEscolhe(o.valor)}>
        {o.rotulo}
      </button>
    ))}
  </nav>
);

async function pede(url, corpo) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const tipo = r.headers.get('content-type') ?? '';
  if (!tipo.includes('application/json')) {
    const bruto = (await r.text()).trim().slice(0, 120);
    throw new Error(`O servidor respondeu ${r.status} sem JSON: ${bruto || '(vazio)'}`);
  }
  const j = await r.json();
  if (!j.ok) throw new Error(j.erro);
  return j;
}

function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

const semAcento = (t) => String(t ?? '').normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

export default function Simulador({ linhas, ano: anoInicial, origem: origemInicial,
                                    anos, cargas, cargaCorrente }) {
  const [escolha, setEscolha] = useState({ areas: [], ccs: [], recursos: 0, folhas: 0 });
  const [ano, setAno] = useState(anoInicial);
  const [origem, setOrigem] = useState(origemInicial);
  const [cargaId, setCargaId] = useState(cargaCorrente ?? null);
  const [ocupado, setOcupado] = useState(null);
  const [erro, setErro] = useState(null);
  // O resultado guarda as linhas cruas E o recorte que as gerou: mudar ano,
  // cenário ou árvore depois de gerar deixa a prévia valendo para outra coisa,
  // e ela precisa dizer isso em vez de parecer atual.
  const [resultado, setResultado] = useState(null);

  const temEscolha = escolha.areas.length > 0;
  const carga = (cargas ?? []).find((c) => c.id === cargaId) ?? null;

  const recorte = JSON.stringify({ areas: escolha.areas, ccs: escolha.ccs, ano, origem, cargaId });
  const previaAtual = resultado && resultado.recorte === recorte;

  async function gerar() {
    setOcupado('gerar');
    setErro(null);
    try {
      const j = await pede('/api/simulador', {
        areas: escolha.areas, ccs: escolha.ccs, ano, origem, carga: cargaId,
      });
      if (!j.linhas.length) {
        throw new Error('O recorte não tem recurso nenhum — nada para dimensionar.');
      }
      setResultado({
        recorte, linhas: j.linhas, resumo: resumoDoSimulador(j.linhas),
        cenario: carga?.cenario ?? '', ano, origem,
      });
    } catch (ex) {
      setErro(ex.message ?? 'Falhou');
    } finally {
      setOcupado(null);
    }
  }

  async function baixarXlsx() {
    if (!resultado) return;
    setOcupado('xlsx');
    setErro(null);
    try {
      const { abas } = montarSimulador(resultado.linhas);
      const bytes = await escreveXlsx({ abas });
      baixar(new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }), `simulador_${resultado.ano}_${semAcento(resultado.cenario) || 'cenario'}.xlsx`);
    } catch (ex) {
      setErro(ex.message ?? 'Falhou');
    } finally {
      setOcupado(null);
    }
  }

  const resumo = resultado?.resumo ?? [];
  const comAviso = resumo.filter((r) => r.aviso).length;

  return (
    <>
      {erro && <p className="erro">{erro}</p>}

      <div className="painel">
        <h2>O que entra</h2>
        <p className="rodape" style={{ margin: '0 0 12px' }}>
          Marque planta, área ou centro de custo. Marcar um nível marca tudo
          abaixo dele; o mesmo botão desmarca quando já está tudo marcado.
        </p>
        <Arvore linhas={linhas} onMudar={setEscolha} />
      </div>

      <div className="painel">
        <h2>Contra o quê</h2>

        <div className="linha-opcao">
          <span className="rotulo-opcao">Ano</span>
          <Grupo mini valor={ano} onEscolhe={setAno}
                 opcoes={(anos ?? []).map((a) => ({ valor: a, rotulo: String(a) }))} />
          <span className="muted">o ano inteiro, mês a mês, com linha de ano por CT</span>
        </div>

        <div className="linha-opcao">
          <span className="rotulo-opcao">Capacidade</span>
          <Grupo mini valor={origem} onEscolhe={setOrigem} opcoes={[
            { valor: 'META', rotulo: 'OEE meta' },
            { valor: 'SIMULADO', rotulo: 'OEE simulado' },
          ]} />
          <span className="muted">a rodada de onde saem o disponível e o que uma unidade entrega</span>
        </div>

        <div className="linha-opcao">
          <span className="rotulo-opcao">Demanda</span>
          <select value={cargaId ?? ''}
                  onChange={(e) => setCargaId(
                    e.target.value ? Number(e.target.value) : null)}>
            <option value="">escolha o cenário</option>
            {(cargas ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.cenario}{c.corrente ? ' (no ar)' : ''}
              </option>
            ))}
          </select>
          <span className="muted">
            {carga ? 'a demanda em minutos por CT e mês deste cenário'
              : 'sem cenário não há o que dimensionar'}
          </span>
        </div>
      </div>

      <div className="painel">
        <h2>Simular</h2>
        <div className="acoes">
          <button type="button" className="btn btn-primario"
                  disabled={!temEscolha || !cargaId || ocupado !== null}
                  onClick={gerar}>
            {ocupado === 'gerar' ? 'Calculando…' : 'Gerar prévia'}
          </button>
          <button type="button" className="btn"
                  disabled={!previaAtual || ocupado !== null}
                  onClick={baixarXlsx}>
            {ocupado === 'xlsx' ? 'Montando…' : 'Baixar .xlsx'}
          </button>
          {!temEscolha && <span className="muted">escolha ao menos uma área</span>}
          {temEscolha && !cargaId && <span className="muted">escolha o cenário de demanda</span>}
          {temEscolha && cargaId && (
            <span className="muted">{fmt(escolha.recursos)} recurso(s) no recorte</span>
          )}
        </div>

        {resultado && !previaAtual && (
          <p className="rodape" style={{ color: 'var(--aviso-fg)' }}>
            O recorte mudou depois da prévia — gere de novo antes de baixar.
          </p>
        )}

        {resultado && (
          <>
            <p className="rodape" style={{ margin: '12px 0 8px' }}>
              <strong>{fmt(resumo.length)} CT(s)</strong> · {resultado.ano} ·
              {' '}OEE {resultado.origem === 'META' ? 'meta' : 'simulado'} ·
              cenário <strong>{resultado.cenario}</strong> · valores da rodada
              {comAviso > 0 && ` · ${fmt(comAviso)} com aviso`}
            </p>
            <div className="grade-rolagem">
              <table className="tabela-mes">
                <thead>
                  <tr>
                    <th>Planta</th>
                    <th>Área</th>
                    <th>CC</th>
                    <th>CT</th>
                    <th>Unidade</th>
                    <th className="num">Demanda (min)</th>
                    <th className="num">Dias úteis</th>
                    <th className="num">Min/unid./dia</th>
                    <th className="num">Unidades/dia</th>
                    <th className="num">OEE</th>
                    <th className="num">Disponível (min)</th>
                    <th className="num">Ocupação</th>
                    <th>Aviso</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.map((r) => (
                    <tr key={`${r.planta}|${r.area}|${r.ct}`}>
                      <td>{r.planta}</td>
                      <td>{r.area}</td>
                      <td><code>{r.cc}</code></td>
                      <td><code>{r.ct}</code></td>
                      <td className="muted">{UNIDADE[r.unidade] ?? r.unidade}</td>
                      <td className="num">{fmt(Math.round(r.demanda))}</td>
                      <td className="num">{fmt(r.diasUteis)}</td>
                      <td className="num">{r.minPorUnidadeDia === null ? '—' : fmt(Math.round(r.minPorUnidadeDia))}</td>
                      <td className="num forte">{r.unidades === null ? '—' : fmt2(r.unidades)}</td>
                      <td className="num">{r.oee === null ? '—' : pct(r.oee)}</td>
                      <td className="num">{fmt(Math.round(r.disponivel))}</td>
                      <td className="num forte">{r.ocupacao === null ? '—' : pct(r.ocupacao)}</td>
                      <td className="muted">{r.aviso ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="rodape">
          A planilha abre o disponível da rodada em quatro fatores, por CT e
          mês: <strong>unidades por dia</strong> (a soma dos turnos — 10 no 1º
          e 8 no 2º são 18) × <strong>minutos por unidade por dia</strong> (o
          turno líquido médio, já com intervalos e paradas) × <strong>dias
          úteis</strong> (os do motor, sem os de apresentação) ×
          {' '}<strong>OEE</strong>. Com os valores da rodada a fórmula devolve
          exatamente o disponível do painel. <strong>Unidades e OEE são as
          células de entrada</strong> (destacadas): mude e o disponível e a
          ocupação respondem. A linha de ano pondera pelos dias, e a aba
          {' '}<em>Por CC</em> soma os CTs. Como dividir as unidades entre os
          turnos é decisão sua na hora de cadastrar: Qtd em <em>Recursos</em>
          {' '}para máquina, pessoas por turno em <em>Turnos do recurso</em>,
          e Recalcular.
        </p>
      </div>
    </>
  );
}
