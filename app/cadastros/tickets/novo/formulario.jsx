'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TIPOS, TIPO_PADRAO, TUDO, tipo as tipoDe, validaTicket } from '../../../../lib/ticket-formato';

// O formulário do chamado.
//
// A PERGUNTA MUDA COM O TIPO: "qual é a sua sugestão?" embaixo de um defeito
// faria a pessoa descrever a solução em vez do que aconteceu, e o que conserta
// um defeito é o passo a passo. A dica dentro do campo muda junto.
//
// A validação de verdade é do servidor (lib/ticket-formato.js, o mesmo motor);
// aqui ela só evita o clique que voltaria com erro.

export default function Formulario({ produtos, podeEnviar }) {
  const router = useRouter();
  const [produto, setProduto] = useState(TUDO);
  const [tp, setTp] = useState(TIPO_PADRAO);
  const [resumo, setResumo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const t = tipoDe(tp);
  const faltas = validaTicket({ produto, tipo: tp, resumo, descricao });

  // Os produtos agrupados como o menu: o grupo vira <optgroup>, e a opção
  // "— em geral" de cada grupo fica dentro dele.
  const grupos = [...new Set(produtos.filter((p) => p.grupo).map((p) => p.grupo))];

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    setOk(null);
    try {
      const r = await fetch('/api/cadastro/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto, tipo: tp, resumo, descricao }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.erro ?? `O servidor respondeu ${r.status}.`);
      setOk(`Ticket #${j.id} aberto. Ele aparece em Meus tickets, e você vê ali quando for respondido.`);
      setProduto(TUDO);
      setTp(TIPO_PADRAO);
      setResumo('');
      setDescricao('');
      router.refresh();
    } catch (ex) {
      setErro(ex.message ?? 'Não deu para abrir o chamado.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="painel" onSubmit={enviar}>
      <div className="linha-opcao">
        <span className="rotulo-opcao">Produto</span>
        <select value={produto} onChange={(e) => setProduto(e.target.value)}>
          <option value={TUDO}>Ferramenta toda</option>
          {grupos.map((g) => (
            <optgroup key={g} label={g}>
              {produtos.filter((p) => p.grupo === g).map((p) => (
                <option key={p.codigo} value={p.codigo}>{p.rotulo}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="muted">a tela de que o chamado fala — na dúvida, deixe a ferramenta toda</span>
      </div>

      <div className="linha-opcao">
        <span className="rotulo-opcao">Tipo</span>
        <nav className="modo">
          {TIPOS.map((x) => (
            <button key={x.codigo} type="button"
                    className={x.codigo === tp ? 'modo-on' : ''}
                    onClick={() => { setTp(x.codigo); setOk(null); }}>
              {x.rotulo}
            </button>
          ))}
        </nav>
      </div>

      <label className="campo" style={{ marginTop: 6 }}>
        <span className="campo-rot">Resumo em uma linha</span>
        <input type="text" value={resumo} maxLength={160}
               placeholder={t.dicaResumo}
               onChange={(e) => { setResumo(e.target.value); setOk(null); }} />
      </label>

      <label className="campo" style={{ marginTop: 10 }}>
        <span className="campo-rot">{t.pergunta}</span>
        <textarea rows={7} value={descricao} placeholder={t.dicaDescricao}
                  onChange={(e) => { setDescricao(e.target.value); setOk(null); }} />
      </label>

      <div className="acoes" style={{ marginTop: 14 }}>
        <button type="submit" className="btn btn-primario"
                disabled={enviando || !podeEnviar || faltas.length > 0}>
          {enviando ? 'Enviando…' : 'Abrir ticket'}
        </button>
        {!podeEnviar && <span className="muted">seu cargo não abre chamados</span>}
        {podeEnviar && faltas.length > 0 && (
          <span className="muted">falta: {faltas.join('; ')}</span>
        )}
        {ok && <span className="muted" style={{ color: 'var(--teal-fg)' }}>{ok}</span>}
        {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
      </div>

      <p className="rodape">
        O chamado vai para quem cuida do roadmap da ferramenta. Quanto mais
        concreto o <strong>como reproduzir</strong> — a tela, a área, o mês, o
        que você clicou —, mais rápido ele vira conserto ou resposta. Acompanhe
        em <strong>Meus tickets</strong>.
      </p>
    </form>
  );
}
