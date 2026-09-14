'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AGREGACOES, achatar, chavesComFilhos, leAgregacao, leNiveis, montarPivot,
} from '../../lib/pivot';
import { MESES } from '../../lib/dias';
import { detalhe, formataUnidade } from '../../lib/formato';

// A TABELA DINÂMICA dos dois painéis.
//
// Recebe as linhas do grão (recurso × mês na capacidade, CT × mês na
// ocupação), os campos que podem virar nível, as medidas e as razões — e
// deixa a pessoa empilhar os níveis, abrir e fechar cada um, e escolher a
// agregação de cada medida. O número sai de lib/pivot.js; aqui só se desenha.
//
// NÍVEIS E AGREGAÇÕES MORAM NA URL (pv_n, pv_f_<medida>), como o resto do
// painel: o endereço descreve a tabela que está na tela. O que está ABERTO
// fica em estado: são dezenas de chaves que mudam a cada clique, e um
// endereço de duzentos caracteres para dizer "o CC 163 está aberto" não
// serve para colar em lugar nenhum.
//
// A RAZÃO NÃO SE AGREGA. Ocupação, % do teto e OEE são soma sobre soma do
// grupo, seja qual for a função escolhida para as medidas — o motor garante e
// o cabeçalho diz.

const fmtPct = (v) => (v === null || v === undefined ? '—'
  : `${(v * 100).toFixed(1)}%`);

// Vermelho quando estoura, âmbar quando aperta — as mesmas classes da tabela
// de ocupação, para a leitura ser a mesma nas duas.
const classeOcup = (v) => (v === null ? 'muted'
  : v > 1 ? 'ocup-estoura' : v >= 0.85 ? 'ocup-aperta' : '');

// O rótulo de um valor de nível. Mês chega como 'AAAA-MM-01'.
function rotuloDe(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return '(vazio)';
  if (campo === 'mes') {
    const m = Number(String(valor).slice(5, 7));
    return `${MESES[m] ?? valor}/${String(valor).slice(2, 4)}`;
  }
  return String(valor);
}

export default function Pivot({ linhas, campos, medidas, razoes, unidade,
                                padrao, prefixo = 'pv' }) {
  const router = useRouter();
  const params = useSearchParams();

  const niveis = leNiveis(params.get(`${prefixo}_n`),
                          campos.map((c) => c.campo), padrao);
  const fns = Object.fromEntries(medidas.map((m) =>
    [m.campo, leAgregacao(params.get(`${prefixo}_f_${m.campo}`))]));

  const [abertos, setAbertos] = useState(() => new Set());

  const raiz = useMemo(() => montarPivot(linhas, {
    niveis,
    medidas: medidas.map((m) => ({ campo: m.campo, fn: fns[m.campo] })),
    razoes: razoes.map((r) => ({ nome: r.nome, num: r.num, den: r.den })),
  }), [linhas, niveis.join(','), JSON.stringify(fns)]);

  const visiveis = achatar(raiz, abertos);

  function muda(chave, valor) {
    const p = new URLSearchParams(params.toString());
    if (valor === '' || valor === null) p.delete(chave); else p.set(chave, valor);
    router.replace('?' + p.toString(), { scroll: false });
  }

  // Clicar num campo que já é nível o tira; num que não é, põe no fim.
  // Trocar os níveis fecha tudo: as chaves antigas não existem mais na árvore.
  function alterna(campo) {
    const novos = niveis.includes(campo)
      ? niveis.filter((c) => c !== campo) : [...niveis, campo];
    setAbertos(new Set());
    muda(`${prefixo}_n`, novos.join(','));
  }

  function move(campo, delta) {
    const i = niveis.indexOf(campo);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= niveis.length) return;
    const novos = [...niveis];
    [novos[i], novos[j]] = [novos[j], novos[i]];
    setAbertos(new Set());
    muda(`${prefixo}_n`, novos.join(','));
  }

  function alternaAberto(chave) {
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(chave)) n.delete(chave); else n.add(chave);
      return n;
    });
  }

  const totalCol = 1 + medidas.length + razoes.length;

  return (
    <>
      <div className="pivot-config">
        <div className="pivot-bloco">
          <span className="rotulo-opcao">Agrupar por</span>
          <div className="chips" style={{ marginBottom: 0 }}>
            {campos.map((c) => {
              const pos = niveis.indexOf(c.campo);
              return (
                <button key={c.campo} type="button"
                        className={`chip ${pos >= 0 ? 'chip-on' : ''}`}
                        onClick={() => alterna(c.campo)}
                        title={pos >= 0 ? 'tirar deste agrupamento'
                                        : 'agrupar por este campo, abaixo dos já escolhidos'}>
                  {pos >= 0 && <span className="pivot-ordem">{pos + 1}</span>}
                  {c.rotulo}
                </button>
              );
            })}
          </div>
          {niveis.length > 0 && (
            <span className="muted pivot-caminho">
              {niveis.map((n, i) => {
                const c = campos.find((x) => x.campo === n);
                return (
                  <span key={n}>
                    {i > 0 && ' › '}
                    {c?.rotulo ?? n}
                    <button type="button" className="pivot-seta" title="subir"
                            disabled={i === 0} onClick={() => move(n, -1)}>◂</button>
                    <button type="button" className="pivot-seta" title="descer"
                            disabled={i === niveis.length - 1}
                            onClick={() => move(n, 1)}>▸</button>
                  </span>
                );
              })}
            </span>
          )}
        </div>

        <div className="pivot-bloco">
          <span className="rotulo-opcao">Agregação</span>
          {medidas.map((m) => (
            <label key={m.campo} className="pivot-fn">
              <span>{m.rotulo}</span>
              <select value={fns[m.campo]}
                      onChange={(e) => muda(`${prefixo}_f_${m.campo}`,
                                            e.target.value === 'soma' ? '' : e.target.value)}>
                {AGREGACOES.map((a) => (
                  <option key={a.valor} value={a.valor}>{a.rotulo}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="pivot-bloco acoes">
          <button type="button" className="btn btn-mini"
                  onClick={() => setAbertos(chavesComFilhos(raiz))}>
            abrir tudo
          </button>
          <button type="button" className="btn btn-mini"
                  onClick={() => setAbertos(new Set())}>
            fechar tudo
          </button>
        </div>
      </div>

      <div className="grade-rolagem">
        <table className="tabela-recursos tabela-pivot">
          <thead>
            <tr>
              <th>
                {niveis.length
                  ? niveis.map((n) => campos.find((c) => c.campo === n)?.rotulo ?? n).join(' › ')
                  : 'Total'}
              </th>
              {medidas.map((m) => (
                <th key={m.campo} className="num">
                  {m.rotulo}
                  {fns[m.campo] !== 'soma' && (
                    <span className="muted"> · {AGREGACOES.find((a) => a.valor === fns[m.campo])?.rotulo.toLowerCase()}</span>
                  )}
                </th>
              ))}
              {razoes.map((r) => (
                <th key={r.nome} className="num" title="sempre soma sobre soma do grupo">
                  {r.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map(({ no, profundidade, temFilhos, aberto }) => {
              const eRaiz = no.nivel < 0;
              const ehContagem = (campo) => fns[campo] === 'contagem';
              return (
                <tr key={no.chave || '__raiz'}
                    className={eRaiz ? 'pivot-total' : temFilhos ? 'pivot-grupo' : ''}>
                  <td style={{ paddingLeft: 10 + profundidade * 18 }}>
                    {temFilhos && !eRaiz ? (
                      <button type="button" className="pivot-toggle"
                              onClick={() => alternaAberto(no.chave)}>
                        {aberto ? '▾' : '▸'}
                      </button>
                    ) : (
                      <span className="pivot-toggle pivot-folha" />
                    )}
                    {eRaiz ? <strong>Total</strong> : rotuloDe(no.campo, no.valor)}
                    <span className="muted pivot-n"> {no.n}</span>
                  </td>
                  {medidas.map((m) => (
                    <td key={m.campo} className="num"
                        title={ehContagem(m.campo) ? '' : detalhe(no.medidas[m.campo] ?? 0, unidade)}>
                      {no.medidas[m.campo] === null ? '—'
                        : ehContagem(m.campo) ? no.medidas[m.campo]
                        : formataUnidade(no.medidas[m.campo], unidade)}
                    </td>
                  ))}
                  {razoes.map((r) => (
                    <td key={r.nome}
                        className={`num ${r.estilo === 'ocupacao' ? classeOcup(no.razoes[r.nome]) : ''}`}>
                      {fmtPct(no.razoes[r.nome])}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!linhas.length && (
              <tr><td colSpan={totalCol} className="vazio">Nada neste recorte.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
