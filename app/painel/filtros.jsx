'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { rotuloArea } from '../../lib/dias';
import { ORIGENS, rotuloOrigem } from '../../lib/origens';
import RecalcularTudo from './recalcular';
import FiltroColuna from './filtro-coluna';

// Os filtros do painel moram em dois lugares.
//
// No topo fica o que define QUAL cálculo se está olhando: a área e a origem
// do OEE, porque a rodada é por área e por origem, e o botão que dispara uma
// nova. Trocar de origem troca de rodada — não recalcula nada.
//
// Os de recorte fino — período, sub-área e tipo — ficam junto da tabela por
// recurso, que é onde se escolhe o que olhar. Todos vivem na URL, então
// continuam valendo para os indicadores e o gráfico lá em cima.
//
// O ANO subiu para junto dos indicadores: ele é o recorte mais graúdo que
// existe, e tudo lá em cima fala dele. A unidade e a capacidade por dia útil
// estão do lado dele pelo motivo oposto — não recortam nada, mudam como o
// mesmo número é dito —, mas as três compartilham o mesmo lugar porque é onde
// o efeito delas é visível na hora.

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
    if (chaves.some((k) => ['area', 'origem'].includes(k))) {
      p.delete('recurso'); p.delete('de'); p.delete('ate');
    }
    // Recortar por rótulo pode tirar da seleção justamente o recurso em foco:
    // CT sem nada daquele rótulo sai da tabela. O período continua valendo.
    // Os filtros de coluna limpam o foco por conta própria, em FiltroColuna.
    if (chaves.some((k) => ['atributo', 'rotulo'].includes(k))) {
      p.delete('recurso');
    }
    // Trocar de ano invalida um recorte que era de outro ano.
    if (chaves.includes('ano')) { p.delete('de'); p.delete('ate'); }
    // O regime escolhido é da área; trocar de área invalida a escolha.
    if (chaves.includes('area')) p.delete('cal');

    router.push('?' + p.toString());
  };
}

export function FiltrosTopo({ areas, areaId, ano, origem, anos = [] }) {
  const muda = useMuda();

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

      <RecalcularTudo areas={areas} anos={anos} />
    </div>
  );
}

/**
 * O ano, sozinho.
 *
 * Ele estava entre os filtros da tabela de recursos, no fim da página, e é o
 * recorte mais graúdo que existe: tudo lá em cima — indicadores, gráfico,
 * unidade — fala do ano escolhido. Fica junto deles, acima da unidade.
 */
export function SeletorAno({ ano, anos = [] }) {
  const muda = useMuda();
  return (
    <nav className="modo modo-ano">
      {anos.map((a) => (
        <button key={a} type="button"
                className={Number(a) === Number(ano) ? 'modo-on' : ''}
                onClick={() => muda('ano', String(a))}>
          {a}
        </button>
      ))}
    </nav>
  );
}

export function FiltrosRecurso({
  ano, periodo = null,
  // Os campos que ganham o controle de operador e vários valores, com as
  // opções que existem na tela. Ver lib/filtro.js.
  campos = [], opcoes = {},
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

      {/* O mesmo controle do cabeçalho da coluna, e o mesmo parâmetro da URL:
          filtrar aqui acende o botão lá, e vice-versa. */}
      {campos.map((c) => (
        <span key={c.campo} className="filtro-campo">
          <span className="campo-rot">{c.rot}</span>
          <FiltroColuna campo={c.campo} rotulo={c.rot}
                        valores={opcoes[c.campo] ?? []} />
        </span>
      ))}

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
