'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { escreveZip, lerZip, texto } from '../../../lib/zip';
import {
  MARCA, acharSlideMarcado, clonaSlideMarcado, linhasDasSecoes, preencheSlide,
  slidesDo,
} from '../../../lib/pptx';
import {
  GRANULARIDADES, MEDIDAS, agrupa, secoesDoGrupo,
} from '../../../lib/documento';
import { iso, ultimoDiaDoMes } from '../../../lib/periodo';
import Arvore from './arvore';

// A tela da extração das configurações.
//
// O .PPTX É MONTADO NO NAVEGADOR. O modelo vem do banco em base64, é aberto
// aqui, tem o slide da marca clonado e preenchido, e é fechado de volta — tudo
// do lado do cliente. Fazer isso numa função serverless significaria
// descompactar, recompactar e devolver megabytes dentro de um limite de tempo
// que existe para consulta, não para manipulação de arquivo.
//
// O .PDF É A IMPRESSÃO DO NAVEGADOR. Escrever PDF à mão daria fonte básica,
// sem acento decente e sem quebra de página — pior que o que o próprio
// navegador entrega de graça, com o diálogo de salvar que a pessoa já conhece.
//
// AS ESCOLHAS MORAM EM ESTADO, e não na URL como no resto do projeto: a
// marcação da árvore é estado, e navegar remontaria o componente e apagaria o
// recorte que a pessoa montou clicando em vinte centros de custo.

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

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
               'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Um documento de trezentos slides não é documento: é uma espera longa seguida
// de um arquivo que ninguém abre. O número não impede, só avisa.
const MUITOS_SLIDES = 60;

// A mesma forma para as cinco escolhas: são todas a mesma pergunta — "qual
// destes?" — e responder a todas do mesmo jeito é o que dispensa aprender cada
// uma. Fora do componente porque, definida dentro, ela nasceria de novo a cada
// clique, e o React remontaria a barra inteira em vez de repintar um botão.
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

export default function Exportar({ linhas, modelo, ano: anoInicial, origem: origemInicial,
                                   anos, cargas, cargaCorrente }) {
  const router = useRouter();
  const [escolha, setEscolha] = useState({ areas: [], ccs: [], recursos: 0, folhas: 0 });
  const [ocupado, setOcupado] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  // O que sai, e como. O cenário nasce no corrente porque é o que a pessoa
  // esperaria ver sem escolher nada; nulo é uma escolha legítima — o documento
  // fala só de capacidade e não inventa uma demanda que ninguém pediu.
  const [ano, setAno] = useState(anoInicial);
  const [mesDe, setMesDe] = useState(1);
  const [mesAte, setMesAte] = useState(12);
  const [medida, setMedida] = useState('disponivel');
  const [origem, setOrigem] = useState(origemInicial);
  const [cargaId, setCargaId] = useState(cargaCorrente ?? null);
  const [granularidade, setGranularidade] = useState('RESUMO');

  const temEscolha = escolha.areas.length > 0;
  const carga = (cargas ?? []).find((c) => c.id === cargaId) ?? null;

  // Invertido vira intervalo válido em vez de intervalo vazio: quem escolheu
  // "de dezembro a março" quis março a dezembro, e uma tabela vazia sem
  // explicação é a pior resposta possível para um erro de clique.
  const de = iso(ano, Math.min(mesDe, mesAte), 1);
  const ate = iso(ano, Math.max(mesDe, mesAte),
                  ultimoDiaDoMes(ano, Math.max(mesDe, mesAte)));

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
    areas: escolha.areas, ccs: escolha.ccs, ano, de, ate, origem,
    carga: cargaId,
  });

  // As duas saídas montam o texto da mesma função: slide e papel dizendo
  // números diferentes da mesma seleção seria o defeito mais difícil de ver.
  const secoesPorSlide = (j) => agrupa(j.grupos, granularidade).map((g) =>
    secoesDoGrupo(g, {
      de: j.de ?? de, ate: j.ate ?? ate, medida, origem,
      cenario: carga?.cenario ?? null,
    }));

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

      const slides = secoesPorSlide(j);
      if (!slides.length) {
        throw new Error('O recorte não tem recurso nenhum — nada para contar.');
      }

      const dentro = await lerZip(bytesDeBase64(m.base64));
      // O slide da marca vira um por grupo. O original é o primeiro deles, e
      // por isso continua exatamente onde o modelo o pôs.
      const alvos = clonaSlideMarcado(dentro, slides.length);
      if (!alvos) {
        throw new Error('O modelo guardado perdeu a marca — importe de novo.');
      }

      alvos.forEach((nome, i) => {
        const { xml } = preencheSlide(texto(dentro.get(nome)),
                                      linhasDasSecoes(slides[i]));
        dentro.set(nome, new TextEncoder().encode(xml));
      });

      const saida = await escreveZip(dentro);
      baixar(new Blob([saida], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }), `configuracoes_${ano}.pptx`);
      setAviso(`${slides.length} slide(s) preenchido(s) a partir de `
        + `${alvos[0].split('/').pop()}.`);
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
      de,
      ate,
      origem,
      medida,
      grao: granularidade,
    });
    if (cargaId) p.set('carga', String(cargaId));
    window.open(`/cadastros/extracao-config/imprimir?${p}`, '_blank');
  }

  // Quantos slides vão sair: é o número que decide entre "exporta" e "escolhe
  // um recorte menor", e ele precisa aparecer ANTES do clique.
  // `folhas` e não `ccs.length`: a folha da árvore é a combinação área+CC, que
  // é exatamente o que vira um slide. Um CC presente em duas áreas conta uma
  // vez na lista de CCs e duas na contagem de slides.
  const quantos = granularidade === 'RESUMO' ? 1
    : granularidade === 'CC' ? escolha.folhas
    : null;

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
            fonte, tamanho e cor vêm do seu modelo, não daqui. Quando sai mais
            de um slide, o slide da marca é repetido e os outros passam
            intactos.
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
        <h2>Como sai</h2>

        <div className="linha-opcao">
          <span className="rotulo-opcao">Slides</span>
          <Grupo opcoes={GRANULARIDADES} valor={granularidade}
                 onEscolhe={setGranularidade} />
          <span className="muted">
            {granularidade === 'CT'
              ? 'um centro de trabalho em cada slide'
              : granularidade === 'CC'
                ? 'todos os CTs do centro de custo no mesmo slide'
                : 'o recorte inteiro somado num slide só'}
          </span>
        </div>

        <div className="linha-opcao">
          <span className="rotulo-opcao">Ano</span>
          <Grupo mini valor={ano} onEscolhe={setAno}
                 opcoes={(anos ?? []).map((a) => ({ valor: a, rotulo: String(a) }))} />
        </div>

        <div className="linha-opcao">
          <span className="rotulo-opcao">Período</span>
          <select value={mesDe}
                  onChange={(e) => setMesDe(Number(e.target.value))}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <span className="muted">até</span>
          <select value={mesAte}
                  onChange={(e) => setMesAte(Number(e.target.value))}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <span className="muted">
            {mesDe === 1 && mesAte === 12 ? 'o ano inteiro' : `de ${de} a ${ate}`}
          </span>
        </div>

        <div className="linha-opcao">
          <span className="rotulo-opcao">Capacidade</span>
          <Grupo opcoes={MEDIDAS} valor={medida} onEscolhe={setMedida} />
          <Grupo mini valor={origem} onEscolhe={setOrigem} opcoes={[
            { valor: 'META', rotulo: 'OEE meta' },
            { valor: 'SIMULADO', rotulo: 'OEE simulado' },
          ]} />
        </div>

        <div className="linha-opcao">
          <span className="rotulo-opcao">Demanda</span>
          <select value={cargaId ?? ''}
                  onChange={(e) => setCargaId(
                    e.target.value ? Number(e.target.value) : null)}>
            <option value="">sem demanda — só a capacidade</option>
            {(cargas ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.cenario}{c.corrente ? ' (no ar)' : ''}
              </option>
            ))}
          </select>
          <span className="muted">
            {carga ? 'a ocupação sai ao lado da capacidade'
              : 'sem cenário, o documento não fala de ocupação'}
          </span>
        </div>
      </div>

      <div className="painel">
        <h2>Exportar</h2>
        <p className="rodape" style={{ margin: '0 0 12px' }}>
          Cada slide leva a <strong>configuração</strong> do seu recorte —
          quantos recursos, turnos, calendários, faixas de OEE e paradas — e a
          <strong> capacidade</strong> que ela produz no período, lida da mesma
          rodada que o painel mostra.
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
              {quantos !== null && ` · ${fmt(quantos)} slide(s)`}
              {granularidade === 'CT' && ' · um slide por CT do recorte'}
            </span>
          )}
        </div>
        {temEscolha && quantos !== null && quantos > MUITOS_SLIDES && (
          <p className="rodape" style={{ color: 'var(--aviso-fg)' }}>
            São {fmt(quantos)} slides. Vai sair, mas leva um tempo e dá um
            arquivo grande — um recorte menor costuma ser o que se queria.
          </p>
        )}
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
