'use client';

import { useState } from 'react';
import { escreveXlsx } from '../../../lib/xlsx';
import { montarSimulador, resumoDoSimulador } from '../../../lib/simulador';
import Arvore from '../extracao-config/arvore';

// A tela do simulador de quantidade de recursos.
//
// O SERVIDOR SÓ ENTREGA NÚMEROS — por CT e mês, demanda, disponível e o que
// uma unidade entrega. A prévia por CT×ano é `resumoDoSimulador`, e o .xlsx é
// `montarSimulador` + `escreveXlsx`, os dois aqui no navegador. A prévia mostra
// com fator 1 o que a planilha mostrará ao abrir; a planilha é que aceita
// mexer no fator.
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
      const { abas } = montarSimulador(resultado.linhas, { fator: 1 });
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
          <span className="muted">o ano inteiro, mês a mês — o pico precisa dos doze</span>
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
              cenário <strong>{resultado.cenario}</strong> · fator de OEE 1,00
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
                    <th className="num">Disponível (min)</th>
                    <th className="num">Atuais</th>
                    <th className="num">Ocupação</th>
                    <th className="num">Necessárias (ano)</th>
                    <th className="num">Pico (mês)</th>
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
                      <td className="num">{fmt(Math.round(r.disponivel))}</td>
                      <td className="num">{r.atuais === null ? '—' : fmt2(r.atuais)}</td>
                      <td className="num">{r.ocupacao === null ? '—' : pct(r.ocupacao)}</td>
                      <td className="num forte">{r.necessarias === null ? '—' : fmt(r.necessarias)}</td>
                      <td className="num">{r.pico === null ? '—' : fmt(r.pico)}</td>
                      <td className="muted">{r.aviso ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="rodape">
          <strong>Atuais</strong> é disponível ÷ o que uma unidade entrega —
          sai fracionário quando os turnos têm quantidades diferentes.
          {' '}<strong>Necessárias</strong> é a demanda ÷ o que uma unidade
          entrega, arredondado para cima: quantas cabem a 100% de ocupação.
          {' '}<strong>Ano</strong> divide as somas dos doze meses;
          {' '}<strong>pico</strong> é o mês que mais pede. No .xlsx, cada CT
          sai mês a mês com uma linha de ano, e a aba <em>Por CC</em> soma
          os CTs. A única célula para editar é o <strong>fator de OEE</strong>
          {' '}(B1 da aba Por CT): 1 é o OEE cadastrado; 1,1 pergunta "e se
          cada unidade rendesse 10% a mais?" — ocupação e necessárias
          recalculam. O que você decidir se cadastra aqui como sempre:
          Qtd em <em>Recursos</em> para máquina, pessoas por turno em
          {' '}<em>Turnos do recurso</em>, e Recalcular.
        </p>
      </div>
    </>
  );
}
