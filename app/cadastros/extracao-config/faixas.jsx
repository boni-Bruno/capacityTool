'use client';

import { useEffect, useRef, useState } from 'react';
import { corDoTexto, rotuloFaixa, validaFaixas } from '../../../lib/faixa-cor';

// AS CORES DA OCUPAÇÃO, num pop-up.
//
// Fora da tela principal de propósito: é um cadastro que se mexe uma vez e se
// esquece, e cinco linhas de faixa entre a árvore do recorte e o botão de
// exportar competiriam com o que a tela faz todo dia.
//
// `<dialog>` do próprio navegador, e não uma div fingindo ser janela: ele já
// traz o fundo escurecido, o Esc que fecha, o foco preso dentro e a devolução
// do foco ao sair. Refazer isso à mão é refazer errado.
//
// A VALIDAÇÃO É A MESMA DA ROTA (`lib/faixa-cor.js`). Aqui ela existe para o
// erro aparecer antes de o botão ser clicado; lá ela existe porque é quem
// grava. Duas escritas da mesma regra divergiriam, e a que valeria seria a que
// ninguém está olhando.

const vazia = () => ({ pct_de: '', pct_ate: '', cor: '#2E7D32', rotulo: '' });

const paraTela = (f) => ({
  pct_de: f.pct_de === null || f.pct_de === undefined ? '' : String(f.pct_de),
  pct_ate: f.pct_ate === null || f.pct_ate === undefined ? '' : String(f.pct_ate),
  cor: f.cor ?? '#2E7D32',
  rotulo: f.rotulo ?? '',
});

export default function Faixas({ faixas: iniciais, onMudar }) {
  const dialogo = useRef(null);
  const [linhas, setLinhas] = useState(() => (iniciais ?? []).map(paraTela));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // O que a tela mostra fora do pop-up é o que está gravado, e não o rascunho:
  // fechar sem salvar não pode deixar a chamada com a régua que não valeu.
  const [gravadas, setGravadas] = useState(iniciais ?? []);

  useEffect(() => {
    setGravadas(iniciais ?? []);
  }, [iniciais]);

  function abrir() {
    setLinhas(gravadas.length ? gravadas.map(paraTela) : [vazia()]);
    setErro(null);
    dialogo.current?.showModal();
  }

  const troca = (i, campo, valor) => setLinhas((ls) =>
    ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  async function salvar() {
    const { faixas, erro: ruim } = validaFaixas(linhas);
    if (ruim) { setErro(ruim); return; }

    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch('/api/faixa-ocupacao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faixas }),
      });
      const tipo = r.headers.get('content-type') ?? '';
      if (!tipo.includes('application/json')) {
        throw new Error(`O servidor respondeu ${r.status} sem JSON.`);
      }
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);

      setGravadas(j.faixas);
      onMudar?.(j.faixas);
      dialogo.current?.close();
    } catch (ex) {
      setErro(ex.message ?? 'Não consegui gravar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-mini" onClick={abrir}>
        Cores da ocupação
      </button>

      {/* A régua atual à vista, sem abrir nada: é ela que explica por que um mês
          saiu vermelho no documento da semana passada. */}
      <span className="amostras">
        {gravadas.length === 0 && (
          <span className="muted">nenhuma faixa — a ocupação sai sem cor</span>
        )}
        {gravadas.map((f) => (
          <span key={`${f.pct_de}-${f.pct_ate}`} className="amostra"
                style={{ background: f.cor, color: corDoTexto(f.cor) }}>
            {f.rotulo || rotuloFaixa(f)}
          </span>
        ))}
      </span>

      <dialog ref={dialogo} className="pop">
        <h3>Cores da ocupação no documento</h3>
        <p className="rodape" style={{ margin: '0 0 12px' }}>
          A célula da ocupação sai pintada com a cor da faixa em que o mês cai.
          O intervalo é <strong>fechado no início e aberto no fim</strong>: 85 a
          100 e 100 a 115 se encostam sem se sobrepor, e 100% cai na segunda.
          Deixe o fim em branco para dizer &ldquo;daí em diante&rdquo;, e o
          início em branco para &ldquo;até aqui&rdquo;. Valor fora de toda faixa
          sai sem cor.
        </p>

        {erro && <p className="erro">{erro}</p>}

        <table className="tabela tabela-faixas">
          <thead>
            <tr>
              <th>De (%)</th><th>Até (%)</th><th>Cor</th><th>Nome</th><th />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              // A chave é a posição porque a linha não tem identidade nenhuma
              // até ser gravada — e é a posição que o usuário está editando.
              // eslint-disable-next-line react/no-array-index-key
              <tr key={i}>
                <td>
                  <input type="number" step="0.1" value={l.pct_de}
                         placeholder="−∞"
                         onChange={(e) => troca(i, 'pct_de', e.target.value)} />
                </td>
                <td>
                  <input type="number" step="0.1" value={l.pct_ate}
                         placeholder="∞"
                         onChange={(e) => troca(i, 'pct_ate', e.target.value)} />
                </td>
                <td>
                  <input type="color" value={l.cor}
                         onChange={(e) => troca(i, 'cor', e.target.value)} />
                </td>
                <td>
                  <input type="text" value={l.rotulo} maxLength={40}
                         placeholder="apertado"
                         onChange={(e) => troca(i, 'rotulo', e.target.value)} />
                </td>
                <td>
                  <button type="button" className="btn btn-mini"
                          onClick={() => setLinhas((ls) =>
                            ls.filter((_, j) => j !== i))}>
                    remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="acoes" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-mini"
                  onClick={() => setLinhas((ls) => [...ls, vazia()])}>
            + faixa
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" disabled={salvando}
                  onClick={() => dialogo.current?.close()}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primario" disabled={salvando}
                  onClick={salvar}>
            {salvando ? 'Gravando…' : 'Gravar'}
          </button>
        </div>
      </dialog>
    </>
  );
}
