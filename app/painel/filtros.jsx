'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { rotuloArea } from '../../lib/dias';
import { ORIGENS, rotuloOrigem } from '../../lib/origens';

// Os filtros do painel moram em dois lugares.
//
// No topo fica o que define QUAL cálculo se está olhando: a área e a origem
// do OEE, porque a rodada é por área e por origem, e o botão que dispara uma
// nova. Trocar de origem troca de rodada — não recalcula nada.
//
// Os de recorte — ano, período, sub-área e tipo — ficam junto da tabela por
// recurso, que é onde se escolhe o que olhar. Todos vivem na URL, então
// continuam valendo para os indicadores e o gráfico lá em cima.
//
// A unidade NÃO está aqui, e a capacidade por dia útil também não. As duas não
// recortam nada: elas mudam como o mesmo número é dito. Por isso moram junto
// dos indicadores, no painel, onde o efeito delas é visível na hora.

// Um lugar só mexe na URL: campo vazio some do endereço em vez de virar
// "sub=", e trocar de recorte derruba o que dependia do recorte antigo.
function useMuda() {
  const router = useRouter();
  const params = useSearchParams();

  // Aceita um campo ou vários de uma vez. Vários numa chamada só importa: duas
  // chamadas seguidas leriam a mesma URL antiga, e a segunda desfaria a
  // primeira — foi o que aconteceu ao limpar o período, que mexe em De e Até
  // juntos.
  return function muda(campo, valor) {
    const mudancas = typeof campo === 'object' ? campo : { [campo]: valor };
    const p = new URLSearchParams(params.toString());

    for (const [k, v] of Object.entries(mudancas)) {
      if (v === '' || v === null) p.delete(k); else p.set(k, v);
    }
    const chaves = Object.keys(mudancas);

    // O recurso clicado pode não estar mais na seleção, e o recorte aberto era
    // do conjunto antigo — manter mostraria número de um período que sumiu.
    if (chaves.some((k) => ['sub', 'tipo', 'area', 'origem'].includes(k))) {
      p.delete('recurso'); p.delete('de'); p.delete('ate');
    }
    // Recortar por rótulo pode tirar da seleção justamente o recurso em foco:
    // CT sem nada daquele rótulo sai da tabela. O período continua valendo.
    if (chaves.some((k) => ['atributo', 'rotulo'].includes(k))) p.delete('recurso');
    // Trocar de ano invalida um recorte que era de outro ano.
    if (chaves.includes('ano')) { p.delete('de'); p.delete('ate'); }
    // O regime escolhido é da área; trocar de área invalida a escolha.
    if (chaves.includes('area')) p.delete('cal');

    router.push('?' + p.toString());
  };
}

export function FiltrosTopo({ areas, areaId, ano, origem }) {
  const router = useRouter();
  const muda = useMuda();
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState(null);
  const [vazia, setVazia] = useState(null);

  async function recalcular() {
    setRodando(true);
    setErro(null);
    setVazia(null);
    try {
      const r = await fetch('/api/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId, ano, origem }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);

      // Rodada sem linha nenhuma não é falha: é área sem recurso, ou recurso
      // sem turno marcado no ano. Antes isso caía na mesma tela de "nenhum
      // cálculo", que mandava clicar em Recalcular — o botão que a pessoa
      // acabara de clicar.
      if (!j.instalada) {
        setVazia(`Rodou e não gerou linha nenhuma para ${ano}. Nenhum recurso `
                 + 'ativo nesta área tem operação neste ano — confira a janela '
                 + '"Em operação de … até" no cadastro de Recursos.');
      } else if (!j.fato) {
        setVazia(`Rodou: teto calculado para ${ano}, mas nenhuma capacidade `
                 + 'planejada. Os recursos existem e nenhum tem turno marcado '
                 + 'neste ano — veja Turnos do recurso.');
      }
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setRodando(false);
    }
  }

  return (
    <div className="filtros">
      <select value={areaId} onChange={(e) => muda('area', e.target.value)}>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>{rotuloArea(a)}</option>
        ))}
      </select>

      {/* Muda de rodada, não recalcula: META e SIMULADO já estão calculadas
          e guardadas cada uma na sua. */}
      <select value={origem} onChange={(e) => muda('origem', e.target.value)}>
        {ORIGENS.map((o) => (
          <option key={o} value={o}>
            OEE {rotuloOrigem(o)}
          </option>
        ))}
      </select>

      <button className="btn" onClick={recalcular} disabled={rodando}
              title={`Recalcular o OEE ${rotuloOrigem(origem)} deste ano`}>
        {rodando ? 'Calculando…' : 'Recalcular'}
      </button>

      {erro && (
        <span style={{ fontSize: 13, color: '#a32d2d', alignSelf: 'center' }}>
          {erro}
        </span>
      )}

      {vazia && (
        <span style={{ fontSize: 13, color: '#6b4d0e', alignSelf: 'center',
                       maxWidth: 520 }}>
          {vazia}
        </span>
      )}
    </div>
  );
}

export function FiltrosRecurso({
  ano, anos, subAreas = [], sub = null, tipo = null, periodo = null,
  // O DE/PARA: atributos derivados e os rótulos do que está escolhido. Este é
  // filtro de verdade — ele muda o que está sendo somado, e não só como o
  // número é dito.
  atributosDePara = [], atributo = null, rotulos = [], rotulo = null,
}) {
  const muda = useMuda();

  // O recorte de datas é o mesmo estado do drill-down do gráfico: escolher
  // aqui é o atalho para o que antes só se alcançava clicando barra por barra.
  // Um intervalo dentro de um mês já cai no dia a dia sozinho.
  const limDe = `${ano}-01-01`;
  const limAte = `${ano}-12-31`;
  const recortado = periodo && !periodo.anoInteiro;

  const limpaPeriodo = () => muda({ de: '', ate: '' });

  return (
    <div className="filtros">
      <select value={ano} onChange={(e) => muda('ano', e.target.value)}>
        {anos.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>

      {periodo && (
        <>
          <label className="campo-inline">
            <span className="campo-rot">De</span>
            <input type="date" value={periodo.de} min={limDe} max={limAte}
                   onChange={(e) => muda('de', e.target.value)} />
          </label>
          <label className="campo-inline">
            <span className="campo-rot">Até</span>
            <input type="date" value={periodo.ate} min={limDe} max={limAte}
                   onChange={(e) => muda('ate', e.target.value)} />
          </label>
          {recortado && (
            <button className="btn btn-mini" onClick={limpaPeriodo}
                    title="Voltar ao ano inteiro">
              Ano todo
            </button>
          )}
        </>
      )}

      {subAreas.length > 0 && (
        <select value={sub ?? ''} onChange={(e) => muda('sub', e.target.value)}>
          <option value="">todas as sub-áreas</option>
          {subAreas.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      <select value={tipo ?? ''} onChange={(e) => muda('tipo', e.target.value)}>
        <option value="">máquina e pessoa</option>
        <option value="MAQUINA">só máquina</option>
        <option value="PESSOA">só pessoa</option>
      </select>

      {/* Trocar de atributo derruba o rótulo junto: rótulo de outro atributo
          não existe, e deixá-lo na URL mostraria a área inteira parecendo
          filtrada. */}
      {atributosDePara.length > 0 && (
        <select value={atributo ?? ''}
                onChange={(e) => muda({ atributo: e.target.value, rotulo: '' })}>
          <option value="">sem recorte por atributo</option>
          {atributosDePara.map((a) => (
            <option key={a.codigo} value={a.codigo}>por {a.nome}</option>
          ))}
        </select>
      )}

      {atributo && (
        <select value={rotulo ?? ''} onChange={(e) => muda('rotulo', e.target.value)}>
          <option value="">todos</option>
          {rotulos.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      )}

    </div>
  );
}
