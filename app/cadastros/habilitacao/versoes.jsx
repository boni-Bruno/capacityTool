'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { piorEstado, podeAbrir } from '../../../lib/prontidao';
import { limpaPassos } from '../../../lib/versao';

// O ciclo de vida de um (cenário, ano): abrir, acompanhar, fechar, abrir a
// próxima. Ver o cabeçalho de page.jsx para o porquê de cada peça.

const quando = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

const SELO = { ok: 'ok', alerta: 'alerta', falta: 'falta' };

export default function Versoes({
  versoes, anos, anoFoco, cenarios, passos, prontidao, resumo,
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  // { origem, ano } enquanto o formulário de abertura está na tela.
  const [abrindo, setAbrindo] = useState(null);
  const [rascunho, setRascunho] = useState({ rotulo: '', passos: [] });
  const [fechando, setFechando] = useState(null);
  const [obs, setObs] = useState('');

  function trocaAno(ano) {
    const p = new URLSearchParams(params.toString());
    p.set('ano', ano);
    router.push('?' + p.toString());
  }

  async function chamar(metodo, corpo, aoTerminar) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch('/api/cadastro/versao', {
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

  // O estado do checklist do ano em foco, somando as plantas: o pior manda.
  const itensDoAno = prontidao.flatMap((p) => p.itens);
  const porta = podeAbrir(itensDoAno);

  function comecaAbertura(origem, ano, jaHouve) {
    setErro(null);
    setAbrindo({ origem, ano, jaHouve });
    // A v1 exige tudo: não há o que ter sido revisado antes. Da v2 em diante o
    // gestor escolhe, e começa sem nada marcado para a escolha ser consciente.
    setRascunho({
      rotulo: '',
      passos: jaHouve ? [] : passos.map((p) => p.codigo),
    });
  }

  function abrir() {
    const { origem, ano } = abrindo;
    if (!porta.permitido) return;
    if (porta.pedeConfirmacao) {
      // eslint-disable-next-line no-alert
      const ok = window.confirm(
        `O checklist de ${ano} está com alerta — provavelmente o calendário do `
        + 'ano ainda não foi lançado por inteiro, e cada feriado que falta vira '
        + 'um dia útil a mais.\n\nAbrir assim mesmo?');
      if (!ok) return;
    }
    chamar('POST', {
      origem, ano, rotulo: rascunho.rotulo, passos: rascunho.passos,
    }, (j) => {
      setAbrindo(null);
      setAviso(`v${j.numero} aberta. O planejamento já pode começar.`);
    });
  }

  function fechar() {
    chamar('PATCH', { id: fechando.id, observacao: obs }, (j) => {
      setFechando(null);
      setObs('');
      setAviso(`Versão fechada e fotografada: ${j.linhas} linha(s) de resultado `
        + 'guardadas. A partir de agora ninguém mexe neste cenário e ano.');
    });
  }

  const alterna = (c) => setRascunho((r) => ({
    ...r,
    passos: r.passos.includes(c)
      ? r.passos.filter((x) => x !== c) : [...r.passos, c],
  }));

  return (
    <>
      <div className="painel">
        <h2>
          Prontidão para {anoFoco}
          <span className={'selo ' + (SELO[piorEstado(itensDoAno)] ?? 'padrao')}
                style={{ marginLeft: 8 }}>
            {piorEstado(itensDoAno) === 'ok' ? 'pronto'
              : piorEstado(itensDoAno) === 'alerta' ? 'com alerta' : 'falta cadastro'}
          </span>
        </h2>

        <div className="acoes" style={{ marginBottom: 12 }}>
          <label className="campo">
            <span className="campo-rot">Ano</span>
            <select value={anoFoco} disabled={ocupado}
                    onChange={(e) => trocaAno(e.target.value)}>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>

        {prontidao.map((p) => (
          <div key={p.planta_id} style={{ marginBottom: 10 }}>
            <strong>{p.planta}</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {p.itens.map((i) => (
                <li key={i.chave} style={{ marginBottom: 2 }}>
                  <span className={'selo ' + (SELO[i.estado] ?? 'padrao')}>
                    {i.estado === 'ok' ? 'ok' : i.estado === 'alerta' ? 'alerta' : 'falta'}
                  </span>
                  {' '}{i.titulo}
                  {i.detalhe && (
                    <div className="muted" style={{ fontSize: 13 }}>
                      {i.detalhe}
                      {i.ondeResolver && (
                        <> <a href={i.ondeResolver}>Resolver →</a></>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="rodape">
          O checklist é por <strong>planta</strong> e vale para os dois cenários:
          turno, calendário e feriado não têm cenário. A regra do feriado é{' '}
          <strong>comparação com o ano anterior</strong>, e não um número fixo —
          não existe &ldquo;quantos feriados são o certo&rdquo;, mas um ano com
          muito menos que o anterior quase sempre é calendário que ainda não foi
          lançado. <strong>Falta</strong> desliga o botão de abrir;{' '}
          <strong>alerta</strong> deixa abrir confirmando.
        </p>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {aviso && <div className="aviso" style={{ marginBottom: 14 }}>{aviso}</div>}

      {cenarios.map((c) => {
        const doCenario = versoes.filter((v) => v.origem === c.codigo);
        const doAno = doCenario.filter((v) => v.ano === anoFoco);
        const aberta = doAno.find((v) => !v.fechada_em);
        const r = aberta ? resumo[aberta.id] : null;

        return (
          <div className="painel" key={c.codigo}>
            <h2>
              {c.rotulo} · {anoFoco}
              {aberta ? (
                <span className="selo rodizio" style={{ marginLeft: 8 }}>
                  v{aberta.numero} aberta
                </span>
              ) : (
                <span className="selo padrao" style={{ marginLeft: 8 }}>
                  {doAno.length ? `fechado na v${doAno[0].numero}` : 'não habilitado'}
                </span>
              )}
            </h2>

            {aberta && (
              <>
                <p style={{ margin: '0 0 10px' }}>
                  {aberta.rotulo && <><strong>{aberta.rotulo}</strong> · </>}
                  aberta em {quando(aberta.aberta_em)}
                  {aberta.aberta_por_nome && <> por {aberta.aberta_por_nome}</>}
                  {' '}· exige{' '}
                  {limpaPassos(aberta.passos_exigidos)
                    .map((cd) => passos.find((p) => p.codigo === cd)?.rotulo ?? cd)
                    .join(', ')}
                </p>
                {r && (
                  <p className="rodape" style={{ marginTop: 0 }}>
                    <strong>{r.prontas} de {r.areas} áreas</strong> concluíram
                    todas as etapas desta versão.
                  </p>
                )}
                <div className="acoes">
                  {/* O fluxo guiado ainda não existe — e um botão levando a
                      uma tela que não está no ar é pior que botão nenhum. Até
                      lá o cadastro é pelas telas do menu, como sempre foi. */}
                  <button type="button" className="btn btn-primario" disabled
                          title="O fluxo guiado entra na próxima entrega">
                    Iniciar planejamento (em construção)
                  </button>
                  <button type="button" className="btn" disabled={ocupado}
                          onClick={() => { setFechando(aberta); setObs(''); }}>
                    Fechar a v{aberta.numero}
                  </button>
                </div>
              </>
            )}

            {!aberta && (
              <div className="acoes">
                <button type="button" className="btn btn-primario"
                        disabled={ocupado || !porta.permitido}
                        title={porta.permitido
                          ? 'Abrir uma versão e liberar o cadastro deste ano'
                          : 'O checklist acima tem item em falta — resolva antes'}
                        onClick={() => comecaAbertura(c.codigo, anoFoco, doAno.length > 0)}>
                  {doAno.length ? `Abrir a v${doAno[0].numero + 1}` : 'Habilitar'}
                </button>
                {!porta.permitido && (
                  <span className="muted">
                    falta cadastro de planta — veja o checklist acima
                  </span>
                )}
              </div>
            )}

            {/* O HISTÓRICO. É ele que mostra que houve ciclo: três versões
                fechadas entre setembro e dezembro contam a história do
                orçamento melhor que qualquer registro à parte. */}
            {doAno.filter((v) => v.fechada_em).length > 0 && (
              <table style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Versão</th>
                    <th>Rótulo</th>
                    <th style={{ width: 110 }}>Fechada em</th>
                    <th style={{ width: 140 }}>Por</th>
                    <th className="num" style={{ width: 110 }}>Linhas da foto</th>
                  </tr>
                </thead>
                <tbody>
                  {doAno.filter((v) => v.fechada_em).map((v) => (
                    <tr key={v.id}>
                      <td><code>v{v.numero}</code></td>
                      <td>
                        {v.rotulo ?? <span className="muted">—</span>}
                        {v.observacao && (
                          <div className="muted" style={{ fontSize: 13 }}>
                            {v.observacao}
                          </div>
                        )}
                      </td>
                      <td className="muted">{quando(v.fechada_em)}</td>
                      <td className="muted">{v.fechada_por_nome ?? '—'}</td>
                      <td className="num">
                        {v.fotos
                          ? Number(v.fotos).toLocaleString('pt-BR')
                          : <span className="erro">sem foto</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* ABRIR: o rótulo e, da v2 em diante, quais etapas a versão exige. */}
      {abrindo && (
        <div className="painel">
          <h2>
            Abrir versão · {cenarios.find((c) => c.codigo === abrindo.origem)?.rotulo}
            {' '}{abrindo.ano}
          </h2>

          <label className="campo" style={{ maxWidth: 420 }}>
            <span className="campo-rot">Rótulo</span>
            <input type="text" value={rascunho.rotulo} disabled={ocupado}
                   placeholder="ex.: v2 — depois do corte da Renner"
                   onChange={(e) => setRascunho({ ...rascunho, rotulo: e.target.value })} />
          </label>

          <p className="rodape" style={{ marginBottom: 6 }}>
            {abrindo.jaHouve
              ? 'Quais etapas esta versão exige revisar? O que não for marcado já '
                + 'nasce concluído em todas as áreas — marque só o que mudou.'
              : 'A primeira versão exige todas as etapas: não há nada revisado '
                + 'antes dela para aproveitar.'}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {passos.map((p) => (
              <label key={p.codigo} className="campo-inline"
                     title={p.ajuda} style={{ minWidth: 180 }}>
                <input type="checkbox" disabled={ocupado}
                       checked={rascunho.passos.includes(p.codigo)}
                       onChange={() => alterna(p.codigo)} />
                <span className="campo-rot">{p.rotulo}</span>
              </label>
            ))}
          </div>

          <div className="acoes" style={{ marginTop: 14 }}>
            <button className="btn btn-primario" onClick={abrir}
                    disabled={ocupado || !rascunho.passos.length}>
              {ocupado ? 'Abrindo…' : 'Abrir versão'}
            </button>
            <button type="button" className="btn" disabled={ocupado}
                    onClick={() => setAbrindo(null)}>
              Cancelar
            </button>
            {!rascunho.passos.length && (
              <span className="muted">
                marque ao menos uma etapa — versão que não pede revisão de nada
                já nasceria fechada
              </span>
            )}
          </div>
        </div>
      )}

      {/* FECHAR: o aviso do que acontece, porque ele é irreversível na prática. */}
      {fechando && (
        <div className="painel">
          <h2>Fechar a v{fechando.numero}</h2>
          <div className="aviso">
            <strong>
              Fechar guarda a fotografia mensal e tranca o cadastro deste cenário
              e ano.
            </strong>
            <p style={{ margin: '6px 0 0' }}>
              A foto é o resultado por recurso e mês da rodada que está no ar. É
              ela que faz a comparação entre versões existir — depois do
              fechamento, recalcular não muda mais o número guardado aqui.
            </p>
            <p style={{ margin: '6px 0 0' }}>
              <strong>Recalcule antes se mexeu em algo há pouco</strong>: a foto
              sai da rodada, não do cadastro, e rodada velha vira foto velha.
            </p>
          </div>

          <label className="campo" style={{ maxWidth: 520, marginTop: 12 }}>
            <span className="campo-rot">Observação (opcional)</span>
            <input type="text" value={obs} disabled={ocupado}
                   placeholder="ex.: fechado na reunião de 12/11, com a Tecelagem pendente"
                   onChange={(e) => setObs(e.target.value)} />
          </label>

          <div className="acoes" style={{ marginTop: 12 }}>
            <button className="btn btn-perigo" onClick={fechar} disabled={ocupado}>
              {ocupado ? 'Fechando…' : 'Fechar e fotografar'}
            </button>
            <button type="button" className="btn" disabled={ocupado}
                    onClick={() => setFechando(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
