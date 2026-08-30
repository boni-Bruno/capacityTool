'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { escreveZip, lerZip, texto } from '../../../lib/zip';
import {
  MARCA, acharSlideMarcado, linhasDasSecoes, preencheSlide, slidesDo,
} from '../../../lib/pptx';
import Arvore from './arvore';

// A tela da extração das configurações.
//
// O .PPTX É MONTADO NO NAVEGADOR. O modelo vem do banco em base64, é aberto
// aqui, tem o slide da marca preenchido e é fechado de volta — tudo do lado do
// cliente. Fazer isso numa função serverless significaria descompactar,
// recompactar e devolver megabytes dentro de um limite de tempo que existe para
// consulta, não para manipulação de arquivo.
//
// O .PDF É A IMPRESSÃO DO NAVEGADOR. Escrever PDF à mão daria fonte básica,
// sem acento decente e sem quebra de página — pior que o que o próprio
// navegador entrega de graça, com o diálogo de salvar que a pessoa já conhece.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');
const bytesDeBase64 = (b64) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

function base64DeBytes(bytes) {
  // Em pedaços: `String.fromCharCode(...)` com um arquivo inteiro estoura a
  // pilha de argumentos, e o erro vem como "Maximum call stack size exceeded",
  // que não diz nada sobre o que aconteceu.
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(s);
}

// Meio megabyte de arquivo por requisição, que vira uns 700 KB de base64 — bem
// abaixo de qualquer teto de corpo. Os BYTES é que são fatiados, e cada pedaço
// é codificado por conta própria: cortar o base64 no meio de um grupo de quatro
// daria um arquivo corrompido que só o PowerPoint reclamaria.
const PEDACO = 512 * 1024;

/**
 * `fetch` que devolve JSON ou uma frase que se possa ler.
 *
 * Quando o corpo estoura o limite, o que volta é "Request Entity Too Large" em
 * texto puro — e `r.json()` sobre isso vira "Unexpected token 'R'", uma
 * mensagem sobre sintaxe para um problema de tamanho. Aqui o corpo só é lido
 * como JSON quando o servidor diz que é JSON.
 */
async function pede(url, corpo, metodo = 'POST') {
  const r = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

  const tipo = r.headers.get('content-type') ?? '';
  if (!tipo.includes('application/json')) {
    const bruto = (await r.text()).trim().slice(0, 120);
    if (r.status === 413) {
      throw new Error('O servidor recusou o envio por tamanho. '
        + 'Se isto apareceu com o modelo em pedaços, o pedaço está grande '
        + 'demais para este ambiente.');
    }
    throw new Error(`O servidor respondeu ${r.status} sem JSON: ${bruto || '(vazio)'}`);
  }

  const j = await r.json();
  if (!j.ok) throw new Error(j.erro);
  return j;
}

export default function Exportar({ linhas, modelo, ano, origem }) {
  const router = useRouter();
  const [escolha, setEscolha] = useState({ areas: [], ccs: [], recursos: 0 });
  const [ocupado, setOcupado] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  const temEscolha = escolha.areas.length > 0;

  // ---- o modelo -----------------------------------------------------------
  async function importar(e) {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;

    setOcupado('modelo');
    setErro(null);
    setAviso(null);
    try {
      const bytes = new Uint8Array(await arq.arrayBuffer());
      const dentro = await lerZip(bytes);

      const slides = slidesDo(dentro);
      if (!slides.length) {
        throw new Error('Este arquivo não tem slide nenhum. É mesmo um .pptx?');
      }
      // Conferir a marca ANTES de gravar: modelo sem ela é inútil, e descobrir
      // isso só na hora de exportar seria descobrir tarde.
      const marcado = acharSlideMarcado(dentro);
      if (!marcado) {
        throw new Error(`Nenhum dos ${slides.length} slides tem ${MARCA}. `
          + 'Ponha essa marca numa caixa de texto do slide que vai receber o '
          + 'conteúdo e importe de novo.');
      }

      // Abre, manda os pedaços, fecha. O cabeçalho vai primeiro para o banco
      // nunca ficar com bytes de um modelo e o nome de outro.
      await pede('/api/modelo-slide', {
        acao: 'abrir',
        arquivo: arq.name,
        slide_marca: marcado,
        slides: slides.length,
      });

      for (let i = 0; i < bytes.length; i += PEDACO) {
        setAviso(`Enviando… ${Math.round((i * 100) / bytes.length)}%`);
        await pede('/api/modelo-slide', {
          acao: 'parte',
          base64: base64DeBytes(bytes.subarray(i, i + PEDACO)),
        });
      }

      const fim = await pede('/api/modelo-slide', { acao: 'fechar' });
      setAviso(`Modelo guardado — ${fmt(Math.round(fim.tamanho / 1024))} KB. `
        + `A marca está no ${marcado.split('/').pop()}, de ${slides.length} slides.`);
      router.refresh();
    } catch (ex) {
      setErro(ex.message ?? 'Não consegui ler o modelo.');
    } finally {
      setOcupado(null);
    }
  }

  async function apagarModelo() {
    setOcupado('modelo');
    try {
      await pede('/api/modelo-slide', undefined, 'DELETE');
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  // ---- os números do recorte ----------------------------------------------
  const numeros = () => pede('/api/extracao-config', {
    areas: escolha.areas, ccs: escolha.ccs, ano, origem,
  });

  // As duas saídas montam o texto da mesma função: slide e papel dizendo
  // números diferentes da mesma seleção seria o defeito mais difícil de ver.
  const secoesDe = (j) => {
    const c = j.cadastro ?? {};
    const k = j.capacidade ?? {};
    return [
      {
        titulo: `Recorte · ${ano} · OEE ${origem === 'META' ? 'meta' : 'simulado'}`,
        linhas: [
          `${escolha.areas.length} área(s), ${escolha.ccs.length} centro(s) de custo`,
          `${fmt(c.recursos)} recursos · ${fmt(c.postos)} postos`,
        ],
      },
      {
        titulo: 'Configuração',
        linhas: [
          `${fmt(c.maquinas)} máquinas e ${fmt(c.pessoas)} postos de pessoa`,
          `${fmt(c.cts)} centros de trabalho em ${fmt(c.ccs)} centros de custo`,
          `${fmt(c.turnos)} turnos e ${fmt(c.calendarios)} calendários em uso`,
          `${fmt(c.faixas_oee)} faixas de OEE · ${fmt(c.paradas)} paradas cadastradas`,
        ],
      },
      {
        titulo: 'Capacidade do ano',
        linhas: k.rodadas
          ? [
            `Instalada: ${fmt(Math.round(k.instalada))} min`,
            `Planejada: ${fmt(Math.round(k.planejada))} min`,
            `Disponível: ${fmt(Math.round(k.disponivel))} min`,
          ]
          : ['Sem cálculo para este recorte — rode Recalcular tudo no painel.'],
      },
    ];
  };

  // ---- .pptx --------------------------------------------------------------
  async function exportarPptx() {
    setOcupado('pptx');
    setErro(null);
    setAviso(null);
    try {
      const [j, m] = await Promise.all([
        numeros(),
        pede('/api/modelo-slide', undefined, 'GET'),
      ]);

      const dentro = await lerZip(bytesDeBase64(m.base64));
      const alvo = acharSlideMarcado(dentro);
      if (!alvo) {
        throw new Error('O modelo guardado perdeu a marca — importe de novo.');
      }

      const { xml } = preencheSlide(texto(dentro.get(alvo)),
                                    linhasDasSecoes(secoesDe(j)));
      dentro.set(alvo, new TextEncoder().encode(xml));

      const saida = await escreveZip(dentro);
      baixar(new Blob([saida], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }), `configuracoes_${ano}.pptx`);
      setAviso(`Slide ${alvo.split('/').pop()} preenchido.`);
    } catch (ex) {
      setErro(ex.message ?? 'Falhou');
    } finally {
      setOcupado(null);
    }
  }

  function baixar(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- .pdf: a impressão do navegador -------------------------------------
  function exportarPdf() {
    const p = new URLSearchParams({
      areas: escolha.areas.join(','),
      ccs: escolha.ccs.join(','),
      ano: String(ano),
      origem,
    });
    window.open(`/cadastros/extracao-config/imprimir?${p}`, '_blank');
  }

  return (
    <>
      {erro && <p className="erro">{erro}</p>}
      {aviso && <p className="rodape" style={{ color: 'var(--teal-fg)' }}>{aviso}</p>}

      <div className="painel">
        <div className="painel-topo">
          <h2>Modelo de slide</h2>
          <div className="acoes">
            <label className="btn" style={{ display: 'inline-flex',
                                            alignItems: 'center' }}>
              {ocupado === 'modelo' ? 'Lendo…'
                : modelo ? 'Trocar modelo' : 'Importar modelo'}
              <input type="file" accept=".pptx" onChange={importar}
                     disabled={ocupado !== null} style={{ display: 'none' }} />
            </label>
            {modelo && (
              <button type="button" className="btn btn-mini" disabled={ocupado !== null}
                      onClick={apagarModelo}>
                apagar
              </button>
            )}
          </div>
        </div>

        {modelo ? (
          <p className="rodape" style={{ margin: 0 }}>
            <strong>{modelo.arquivo}</strong> · {modelo.slides} slides · a marca
            está no <code>{String(modelo.slide_marca).split('/').pop()}</code> ·
            importado em{' '}
            {new Date(modelo.criado_em).toLocaleDateString('pt-BR')}.
            {' '}O conteúdo entra ali com a formatação que a caixa já tem —
            fonte, tamanho e cor vêm do seu modelo, não daqui.
          </p>
        ) : (
          <p className="vazio">
            Sem modelo, o .pptx não sai. Monte a apresentação como ela deve ser,
            ponha <code>{MARCA}</code> numa caixa de texto do slide que vai
            receber o conteúdo, e importe aqui. Os outros slides passam
            intactos.
          </p>
        )}
      </div>

      <div className="painel">
        <h2>O que entra</h2>
        <p className="rodape" style={{ margin: '0 0 12px' }}>
          Marque planta, área ou centro de custo. Marcar um nível marca tudo
          abaixo dele; o mesmo botão desmarca quando já está tudo marcado.
        </p>
        <Arvore linhas={linhas} onMudar={setEscolha} />
      </div>

      <div className="painel">
        <h2>Exportar</h2>
        <p className="rodape" style={{ margin: '0 0 12px' }}>
          O documento leva duas seções: a <strong>configuração</strong> do
          recorte — quantos recursos, turnos, calendários, faixas de OEE e
          paradas — e a <strong>capacidade</strong> que ela produz no ano, lida
          da mesma rodada que o painel mostra.
        </p>
        <div className="acoes">
          <button type="button" className="btn btn-primario"
                  disabled={!temEscolha || !modelo || ocupado !== null}
                  onClick={exportarPptx}>
            {ocupado === 'pptx' ? 'Montando…' : 'Exportar .pptx'}
          </button>
          <button type="button" className="btn"
                  disabled={!temEscolha}
                  onClick={exportarPdf}>
            Exportar .pdf
          </button>
          {!temEscolha && <span className="muted">escolha ao menos uma área</span>}
          {temEscolha && !modelo && (
            <span className="muted">o .pptx precisa de um modelo importado</span>
          )}
          {temEscolha && (
            <span className="muted">
              {fmt(escolha.recursos)} recurso(s) no recorte
            </span>
          )}
        </div>
        <p className="rodape">
          O <strong>.pdf</strong> abre a versão para impressão numa aba nova, e
          você escolhe <em>Salvar como PDF</em> no diálogo — sai com fonte de
          verdade, acento certo e quebra de página. O <strong>.pptx</strong> é
          montado aqui no navegador, dentro do seu modelo.
        </p>
      </div>
    </>
  );
}
