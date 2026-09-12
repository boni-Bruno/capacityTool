'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ORIGENS, rotuloOrigem } from '../../lib/origens';
import { rotuloArea } from '../../lib/dias';

// =============================================================================
// RECALCULAR TUDO, E RECALCULAR PARCIAL
//
// Uma pressão de "tudo" refaz TODAS as rodadas: cada área, cada ano, cada
// origem de OEE. Antes ele recalculava só o que estava na tela, e manter a
// fábrica inteira atualizada exigia passear por área e ano um a um — o que
// garante que alguém esqueça uma combinação, e a extração leve número velho
// misturado com número novo sem nada denunciar.
//
// O PARCIAL escolhe recursos — planta, área, CC, CT, patrimônio, código,
// recurso — e ano e origem, tudo em "todos" por padrão. Quem trocou o turno de
// três máquinas não precisa de dois minutos de aba aberta; e é assim que o
// botão deixa de ser apertado e o painel envelhece. O motor entra na rodada
// que existe e regrava só aqueles recursos (migração 37); a rodada ganha a
// marca de "recursos recalculados em", que o rodapé mostra — uma rodada com
// idades misturadas tem que se declarar.
//
// O LAÇO MORA NO NAVEGADOR, e não no servidor, pela mesma razão da importação
// de demanda: uma função serverless tem minuto contado, e trinta rodadas numa
// requisição só estouram o limite no meio, deixando metade calculada e nenhum
// aviso. Uma requisição por rodada é o mesmo caminho que já funciona hoje,
// repetido — e de quebra dá para mostrar em que passo está e parar no meio.
//
// Área sem recurso nenhum não entra: a rodada dela só produziria zero linhas,
// e o tempo é melhor gasto nas que têm o que calcular.
// =============================================================================

const TODOS = '';

const distintos = (lista, campo) =>
  [...new Set(lista.map((r) => r[campo]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

// Fora do componente porque, definido dentro, ele nasceria de novo a cada
// render e o React remontaria o seletor em vez de repintá-lo.
const Sel = ({ rotulo, chave, opcoes, rotuloDe, valor, muda }) => (
  <label className="campo">
    <span className="campo-rot">{rotulo}</span>
    <select value={valor ?? TODOS} onChange={(e) => muda(chave, e.target.value)}>
      <option value={TODOS}>todos</option>
      {opcoes.map((o) => (
        <option key={String(o.valor ?? o)} value={String(o.valor ?? o)}>
          {rotuloDe ? rotuloDe(o) : String(o)}
        </option>
      ))}
    </select>
  </label>
);

export default function RecalcularTudo({ areas, anos }) {
  const router = useRouter();
  const [estado, setEstado] = useState(null);   // null = parado
  const parar = useRef(false);

  // ---- o pop-up do parcial ------------------------------------------------
  const dialogo = useRef(null);
  const [recursos, setRecursos] = useState(null);   // lidos ao abrir, uma vez
  const [carregando, setCarregando] = useState(false);
  const [erroLista, setErroLista] = useState(null);
  const [filtro, setFiltro] = useState({});

  // O plano completo do "tudo", montado aqui para ser contável antes de
  // começar: quem clica precisa saber que são quarenta e oito rodadas e não
  // uma.
  const planoTudo = [];
  for (const area of areas.filter((a) => Number(a.recursos) > 0)) {
    for (const ano of anos) {
      for (const origem of ORIGENS) planoTudo.push({ area, ano, origem, recursos: null });
    }
  }

  async function abrirParcial() {
    setErroLista(null);
    dialogo.current?.showModal();
    if (recursos) return;
    setCarregando(true);
    try {
      const r = await fetch('/api/recalcular');
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      setRecursos(j.recursos);
    } catch (e) {
      setErroLista(e.message ?? 'Não consegui ler a lista de recursos.');
    } finally {
      setCarregando(false);
    }
  }

  const muda = (chave, valor) => setFiltro((f) => {
    const novo = { ...f };
    if (valor) novo[chave] = valor; else delete novo[chave];
    // Cada nível derruba os de baixo: área é da planta, CC vive dentro da
    // área filtrada, e assim por diante — manter escolha órfã filtraria para
    // o vazio sem explicação. Ano e origem não estão na cascata.
    const ordem = ['planta', 'area', 'cc', 'ct', 'pat', 'codigo', 'recurso'];
    const i = ordem.indexOf(chave);
    if (i >= 0) for (const k of ordem.slice(i + 1)) delete novo[k];
    return novo;
  });

  // O funil: cada seletor lista o que existe depois dos filtros anteriores.
  // É o mesmo desenho da extração para o AP, e de propósito: uma gramática
  // só de "escolher recursos" na ferramenta inteira.
  const etapas = useMemo(() => {
    const lista = recursos ?? [];
    const passa = (r, ate) => {
      if (filtro.planta && r.planta !== filtro.planta) return false;
      if (ate > 1 && filtro.area && r.area !== filtro.area) return false;
      if (ate > 2 && filtro.cc && r.cc !== filtro.cc) return false;
      if (ate > 3 && filtro.ct && r.ct !== filtro.ct) return false;
      if (ate > 4 && filtro.pat && r.patrimonio !== filtro.pat) return false;
      if (ate > 5 && filtro.codigo && r.codigo !== filtro.codigo) return false;
      return true;
    };
    const aposPlanta = lista.filter((r) => passa(r, 1));
    const aposArea = aposPlanta.filter((r) => passa(r, 2));
    const aposCc = aposArea.filter((r) => passa(r, 3));
    const aposCt = aposCc.filter((r) => passa(r, 4));
    const aposPat = aposCt.filter((r) => passa(r, 5));
    const aposCodigo = aposPat.filter((r) => passa(r, 6));
    const selecionados = filtro.recurso
      ? aposCodigo.filter((r) => String(r.id) === filtro.recurso)
      : aposCodigo;
    return {
      plantas: distintos(lista, 'planta'),
      areas: distintos(aposPlanta, 'area'),
      ccs: distintos(aposArea, 'cc'),
      cts: distintos(aposCc, 'ct'),
      pats: distintos(aposCt, 'patrimonio'),
      codigos: distintos(aposPat, 'codigo'),
      nomes: aposCodigo,
      selecionados,
    };
  }, [recursos, filtro]);

  // O PLANO DO PARCIAL: os recursos escolhidos, agrupados por área, cruzados
  // com os anos e as origens pedidos. Área com TODOS os recursos escolhidos
  // vira rodada cheia — o motor faz a mesma coisa e a rodada volta a ter uma
  // idade só; parcial de área inteira seria "meio recalculado" sem motivo.
  const planoParcial = useMemo(() => {
    if (!recursos) return [];
    const totalPorArea = new Map();
    for (const r of recursos) {
      totalPorArea.set(r.area_id, (totalPorArea.get(r.area_id) ?? 0) + 1);
    }
    const porArea = new Map();
    for (const r of etapas.selecionados) {
      if (!porArea.has(r.area_id)) {
        porArea.set(r.area_id, { area: { id: r.area_id, nome: r.area, planta: r.planta }, ids: [] });
      }
      porArea.get(r.area_id).ids.push(r.id);
    }
    const anosPedidos = filtro.ano ? [Number(filtro.ano)] : anos;
    const origensPedidas = filtro.origem ? [filtro.origem] : ORIGENS;

    const plano = [];
    for (const { area, ids } of porArea.values()) {
      const cheia = ids.length === totalPorArea.get(area.id);
      for (const ano of anosPedidos) {
        for (const origem of origensPedidas) {
          plano.push({ area, ano, origem, recursos: cheia ? null : ids });
        }
      }
    }
    return plano;
  }, [recursos, etapas, filtro.ano, filtro.origem, anos]);

  async function rodar(plano) {
    parar.current = false;
    setEstado({ feitos: 0, total: plano.length, atual: plano[0], vazias: [],
                falhas: [], terminou: false });

    const vazias = [];
    const falhas = [];

    for (const [i, passo] of plano.entries()) {
      if (parar.current) break;
      setEstado((e) => ({ ...e, atual: passo, feitos: i }));

      try {
        const r = await fetch('/api/recalcular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            areaId: passo.area.id, ano: passo.ano, origem: passo.origem,
            recursos: passo.recursos,
          }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.erro);
        // Rodada sem linha não é falha: é área cujos recursos não têm operação
        // ou turno naquele ano. Vai para uma lista à parte, e a tela conta as
        // duas coisas separadas — misturá-las mandaria caçar erro onde não há.
        //
        // `instalada` conta faixas desde a migração 35, uma por recurso que
        // existia no período — continua sendo o sinal de "gerou alguma coisa".
        // O fato entra na conta por segurança: uma rodada que calculou turno
        // nunca é vazia, seja qual for a contagem de teto.
        if (!j.instalada && !j.fato) vazias.push(passo);
      } catch (e) {
        falhas.push({ passo, erro: e.message ?? 'falhou' });
      }
    }

    setEstado((e) => ({
      ...e, feitos: parar.current ? e.feitos : plano.length,
      vazias, falhas, terminou: true, interrompido: parar.current,
    }));
    router.refresh();
  }

  function rodarParcial() {
    dialogo.current?.close();
    rodar(planoParcial);
  }

  const rodando = estado && !estado.terminou;
  const pct = estado ? Math.round((estado.feitos * 100) / estado.total) : 0;
  const nSel = etapas.selecionados.length;
  const filtrando = Object.keys(filtro).length > 0;
  const sel = (chave) => ({ chave, valor: filtro[chave], muda });

  return (
    <>
      <button className="btn" onClick={() => rodar(planoTudo)} disabled={rodando}
              title={`Recalcular as ${planoTudo.length} rodadas: cada área, cada `
                     + 'ano, meta e simulado'}>
        {rodando ? 'Calculando…' : 'Recalcular tudo'}
      </button>
      <button className="btn" onClick={abrirParcial} disabled={rodando}
              title="Escolher quais recursos, anos e origens recalcular">
        Recalcular parcial…
      </button>

      {rodando && (
        <button className="btn btn-mini" onClick={() => { parar.current = true; }}>
          parar
        </button>
      )}

      {estado && (
        <div className="recalc">
          <div className="recalc-barra">
            <div className="recalc-fita" style={{ width: `${pct}%` }} />
          </div>

          {!estado.terminou ? (
            <p className="recalc-txt">
              {estado.feitos + 1} de {estado.total} ·{' '}
              <strong>{rotuloArea(estado.atual.area)}</strong> {estado.atual.ano}
              {' '}· OEE {rotuloOrigem(estado.atual.origem)}
              {estado.atual.recursos && ` · ${estado.atual.recursos.length} recurso(s)`}
            </p>
          ) : (
            <p className="recalc-txt">
              {estado.interrompido
                ? `Parado em ${estado.feitos} de ${estado.total}.`
                : `${estado.total} rodadas atualizadas.`}
              {estado.vazias.length > 0
                && ` ${estado.vazias.length} sem linha nenhuma (área sem `
                   + 'recurso em operação naquele ano).'}
              {estado.falhas.length > 0 && (
                <span className="recalc-falha">
                  {' '}{estado.falhas.length} falharam:{' '}
                  {estado.falhas.slice(0, 3).map((f) =>
                    `${rotuloArea(f.passo.area)} ${f.passo.ano}`).join(', ')}
                  {estado.falhas.length > 3 && '…'}
                  {' — '}{estado.falhas[0].erro}
                </span>
              )}
              {' '}
              <button type="button" className="link-linha"
                      onClick={() => setEstado(null)}>
                fechar
              </button>
            </p>
          )}
        </div>
      )}

      {/* O pop-up é um dialog do próprio navegador, como o das cores da
          ocupação: fundo escurecido, Esc que fecha e foco preso vêm de graça. */}
      <dialog ref={dialogo} className="pop">
        <h3>Recalcular parcial</h3>
        <p className="rodape" style={{ margin: '0 0 12px' }}>
          Escolha quais recursos, e para quais anos e origens. O motor entra na
          rodada que já existe e regrava só esses recursos; o resto da área não
          é tocado, e o rodapé do painel passa a dizer quando foi. Área escolhida
          por inteiro vira rodada cheia, como no Recalcular tudo.
        </p>

        {erroLista && <p className="erro">{erroLista}</p>}
        {carregando && <p className="muted">Lendo a lista de recursos…</p>}

        {recursos && (
          <>
            <div className="form-grade">
              <Sel rotulo="Planta" {...sel('planta')} opcoes={etapas.plantas} />
              <Sel rotulo="Área" {...sel('area')} opcoes={etapas.areas} />
              <Sel rotulo="CC" {...sel('cc')} opcoes={etapas.ccs} />
              <Sel rotulo="CT" {...sel('ct')} opcoes={etapas.cts} />
              <Sel rotulo="Patrimônio" {...sel('pat')} opcoes={etapas.pats} />
              <Sel rotulo="Código" {...sel('codigo')} opcoes={etapas.codigos} />
              <Sel rotulo="Recurso" {...sel('recurso')}
                   opcoes={etapas.nomes.map((r) => ({ valor: r.id, nome: r.nome }))}
                   rotuloDe={(o) => o.nome} />
              <Sel rotulo="Ano" {...sel('ano')} opcoes={anos} />
              <Sel rotulo="OEE" {...sel('origem')}
                   opcoes={ORIGENS.map((o) => ({ valor: o, nome: rotuloOrigem(o) }))}
                   rotuloDe={(o) => o.nome} />
            </div>

            <p className="rodape" style={{ margin: '12px 0' }}>
              {filtrando
                ? <><strong>{nSel}</strong> recurso(s) no recorte</>
                : <>Sem recorte: todos os {recursos.length} recursos — é o mesmo que Recalcular tudo</>}
              {' '}· <strong>{planoParcial.length}</strong> rodada(s)
              {planoParcial.some((p) => p.recursos) && ', parte delas parcial'}
            </p>

            <div className="acoes">
              <button type="button" className="btn btn-primario"
                      disabled={!planoParcial.length}
                      onClick={rodarParcial}>
                Recalcular {nSel} recurso(s) em {planoParcial.length} rodada(s)
              </button>
              <button type="button" className="btn"
                      onClick={() => dialogo.current?.close()}>
                Cancelar
              </button>
              {filtrando && (
                <button type="button" className="btn btn-mini"
                        onClick={() => setFiltro({})}>
                  limpar
                </button>
              )}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
