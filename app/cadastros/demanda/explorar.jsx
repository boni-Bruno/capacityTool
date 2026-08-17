'use client';

import { useMemo, useState } from 'react';
import { classificar, rotulosDe, valoresDe } from '../../../lib/regras';
import OrigemDoIndice from './origem';

// O quadrante único de dados da tela de demanda.
//
// Eram quatro painéis empilhados — demanda sem capacidade, capacidade sem
// demanda, origem do índice e índice de conversão — e a tela virou um poço de
// rolagem. Ninguém olha os quatro ao mesmo tempo: cada um responde uma pergunta
// diferente, então eles viram MODOS de um quadrante só, escolhidos por botão.
//
// Os filtros valem para o modo aberto e sobrevivem à troca de modo: quem
// filtrou a planta Matriz e está olhando o índice quer a mesma Matriz ao trocar
// para os órfãos.
//
// O recorte por atributo (DE e PARA) olha a DEMANDA do CT: um CT passa se
// alguma linha dele casa com todos os recortes escolhidos. CT sem demanda
// nenhuma não tem como casar — com recorte de atributo ativo, ele sai. Isso é
// dito no rodapé quando acontece, porque um "sem demanda" que some sem aviso
// pareceria bug.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');

// As colunas da base que fazem sentido como filtro DE. `ct` e `area` ficam de
// fora: já são filtros próprios, com o nome deles.
const CAMPOS_DE = [
  { codigo: 'grupo_estoque',          nome: 'Grupo de estoque' },
  { codigo: 'nivel_estoque',          nome: 'Nível de estoque' },
  { codigo: 'linha_produto_agrupada', nome: 'Linha de produto' },
  { codigo: 'familia_tecelagem',      nome: 'Família de tecelagem' },
  { codigo: 'um',                     nome: 'UM' },
];

const MODOS = [
  { id: 'sem_cap', nome: 'Demanda sem capacidade' },
  { id: 'sem_dem', nome: 'Capacidade sem demanda' },
  { id: 'origem',  nome: 'De onde vem o índice' },
  { id: 'indice',  nome: 'Índice de conversão' },
];

export default function Explorar({ cargaId, semCap, semDem, indice, orfaos,
                                   doadores, comDemanda, combinacoes,
                                   atributos, regras, cadastro }) {
  const [modo, setModo] = useState('sem_cap');
  // Um objeto só para todos os recortes: planta, area, cc, ct, de:<campo>,
  // para:<atributo>. Vazio = sem recorte.
  const [filtro, setFiltro] = useState({});

  const muda = (chave, valor) => setFiltro((f) => {
    const novo = { ...f };
    if (valor) novo[chave] = valor; else delete novo[chave];
    // Trocar a planta derruba a área: área é da planta, e manter uma área de
    // outra planta filtraria tudo para o vazio sem explicação.
    if (chave === 'planta') delete novo.area;
    return novo;
  });

  // ---- o que o cadastro sabe de cada CT -----------------------------------
  const cad = useMemo(
    () => new Map(cadastro.map((c) => [c.ct, c])), [cadastro]);

  const plantas = useMemo(
    () => [...new Set(cadastro.map((c) => c.planta))].sort(), [cadastro]);
  const areasDaPlanta = useMemo(
    () => [...new Set(cadastro
      .filter((c) => !filtro.planta || c.planta === filtro.planta)
      .map((c) => c.area))].sort(), [cadastro, filtro.planta]);

  // Todos os CTs que a tela conhece, do cadastro e da base, para os seletores
  // de CC e CT não dependerem do modo aberto.
  const todosCts = useMemo(() => {
    const s = new Set(cadastro.map((c) => c.ct));
    for (const c of combinacoes) if (c.ct) s.add(c.ct);
    return [...s].sort();
  }, [cadastro, combinacoes]);
  const ccs = useMemo(
    () => [...new Set(todosCts.map((ct) => ct.split('-')[0]))].sort(), [todosCts]);

  // ---- a demanda de cada CT, já classificada pelo DE/PARA -----------------
  // Classificar uma vez e guardar: as combinações são ~mil e as regras poucas,
  // então isto é barato — e refazer a classificação a cada tecla de filtro
  // seria trabalho repetido sobre o mesmo dado.
  const porCt = useMemo(() => {
    const m = new Map();
    for (const c of combinacoes) {
      if (!c.ct) continue;
      if (!m.has(c.ct)) m.set(c.ct, []);
      m.get(c.ct).push(classificar(c, atributos, regras));
    }
    return m;
  }, [combinacoes, atributos, regras]);

  const filtrosDe = CAMPOS_DE.filter((f) => filtro[`de:${f.codigo}`]);
  const filtrosPara = atributos.filter((a) => filtro[`para:${a.codigo}`]);
  const temAtributo = filtrosDe.length > 0 || filtrosPara.length > 0;

  const passa = (ct) => {
    if (!ct) return false;
    const info = cad.get(ct);
    if (filtro.planta && info?.planta !== filtro.planta) return false;
    if (filtro.area && info?.area !== filtro.area) return false;
    if (filtro.cc && ct.split('-')[0] !== filtro.cc) return false;
    if (filtro.ct && ct !== filtro.ct) return false;

    if (temAtributo) {
      const linhas = porCt.get(ct);
      if (!linhas) return false;
      return linhas.some((v) =>
        filtrosDe.every((f) => v[f.codigo] === filtro[`de:${f.codigo}`])
        && filtrosPara.every((a) => v[a.codigo] === filtro[`para:${a.codigo}`]));
    }
    return true;
  };

  // Cada modo filtra a própria lista. useMemo não vale a pena aqui: são
  // centenas de linhas, e o filtro muda justamente quando tudo re-renderiza.
  const vSemCap = semCap.filter((x) => passa(x.ct));
  const vSemDem = semDem.filter((x) => passa(x.ct));
  const vOrfaos = orfaos.filter((x) => passa(x.ct));
  const vComDemanda = comDemanda.filter((x) => passa(x.ct));
  const vIndice = indice.filter((x) => passa(x.ct));

  const filtrando = Object.keys(filtro).length > 0;

  return (
    <div className="painel">
      <div className="chips">
        {MODOS.map((m) => (
          <button key={m.id} type="button"
                  className={`chip ${modo === m.id ? 'chip-on' : ''}`}
                  onClick={() => setModo(m.id)}>
            {m.nome}
            <span className="muted"> · {{
              sem_cap: fmt(vSemCap.length),
              sem_dem: fmt(vSemDem.length),
              origem: fmt(vOrfaos.length + vComDemanda.length),
              indice: fmt(vIndice.length),
            }[m.id]}</span>
          </button>
        ))}
      </div>

      <div className="filtros" style={{ marginBottom: 14 }}>
        <select value={filtro.planta ?? ''}
                onChange={(e) => muda('planta', e.target.value)}>
          <option value="">todas as plantas</option>
          {plantas.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={filtro.area ?? ''}
                onChange={(e) => muda('area', e.target.value)}>
          <option value="">todas as áreas</option>
          {areasDaPlanta.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <select value={filtro.cc ?? ''} onChange={(e) => muda('cc', e.target.value)}>
          <option value="">todo CC</option>
          {ccs.map((c) => <option key={c} value={c}>CC {c}</option>)}
        </select>

        <select value={filtro.ct ?? ''} onChange={(e) => muda('ct', e.target.value)}>
          <option value="">todo CT</option>
          {todosCts.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {CAMPOS_DE.map((f) => (
          <select key={f.codigo} value={filtro[`de:${f.codigo}`] ?? ''}
                  onChange={(e) => muda(`de:${f.codigo}`, e.target.value)}>
            <option value="">{f.nome}: todos</option>
            {valoresDe(combinacoes, f.codigo).map((v) => (
              <option key={v.valor} value={v.valor}>{v.valor}</option>
            ))}
          </select>
        ))}

        {atributos.map((a) => (
          <select key={a.codigo} value={filtro[`para:${a.codigo}`] ?? ''}
                  onChange={(e) => muda(`para:${a.codigo}`, e.target.value)}>
            <option value="">{a.nome}: todos</option>
            {rotulosDe(regras, a.codigo).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        ))}

        {filtrando && (
          <button type="button" className="btn btn-mini"
                  onClick={() => setFiltro({})}>
            limpar filtros
          </button>
        )}
      </div>

      {temAtributo && (modo === 'sem_dem' || modo === 'origem') && (
        <p className="rodape" style={{ margin: '0 0 12px' }}>
          O recorte por atributo olha a <strong>demanda</strong> de cada CT — e
          parte do que este modo mostra é justamente CT sem demanda própria, que
          não tem linha nenhuma para casar com o recorte. O que sumiu daqui não
          foi resolvido: só não tem como responder a esse filtro.
        </p>
      )}

      {modo === 'sem_cap' && <SemCapacidade itens={vSemCap} filtrando={filtrando} />}
      {modo === 'sem_dem' && <SemDemanda itens={vSemDem} filtrando={filtrando} />}
      {modo === 'origem' && (
        <OrigemDoIndice cargaId={cargaId} orfaos={vOrfaos}
                        doadores={doadores} comDemanda={vComDemanda} />
      )}
      {modo === 'indice' && <Indice itens={vIndice} filtrando={filtrando} />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Os modos. O conteúdo é o mesmo que os painéis antigos mostravam — a mudança é
// onde ele mora, não o que ele diz.
// -----------------------------------------------------------------------------

function Vazio({ filtrando }) {
  return (
    <p className="vazio">
      {filtrando
        ? 'Nada casa com os filtros escolhidos.'
        : 'Nada para mostrar aqui.'}
    </p>
  );
}

function SemCapacidade({ itens, filtrando }) {
  if (!itens.length) return <Vazio filtrando={filtrando} />;
  return (
    <>
      <div className="grade-rolagem">
        <table>
          <thead>
            <tr>
              <th>CT</th>
              <th className="num">Horas</th>
              <th className="num">Linhas</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((x) => (
              <tr key={x.ct}>
                <td><code>{x.ct}</code></td>
                <td className="num">{fmt(x.horas)}</td>
                <td className="num muted">{fmt(x.linhas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rodape">
        Ordenada por peso: é a fila do que falta cadastrar. Nada aqui é erro, e
        nada precisa ser reimportado — o vínculo é o <code>CC-CT</code> da
        máquina física e é resolvido na leitura, então cada recurso que você
        cadastrar faz a linha correspondente passar a valer sozinha.
      </p>
    </>
  );
}

function SemDemanda({ itens, filtrando }) {
  if (!itens.length) return <Vazio filtrando={filtrando} />;
  return (
    <>
      <div className="grade-rolagem">
        <table>
          <thead>
            <tr>
              <th>CT</th>
              <th className="num">Recursos</th>
              <th>Máquinas</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((x) => (
              <tr key={x.ct}>
                <td><code>{x.ct}</code></td>
                <td className="num">{fmt(x.recursos)}</td>
                <td className="muted">{x.maquinas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rodape">
        Máquina cadastrada que o plano não usa. Pode ser numeração a acertar, ou
        recurso que realmente não entra neste cenário — nenhum dos dois é
        defeito.
      </p>
    </>
  );
}

function Indice({ itens, filtrando }) {
  if (!itens.length) return <Vazio filtrando={filtrando} />;
  return (
    <>
      <p className="rodape" style={{ margin: '0 0 12px' }}>
        Quanto cada centro de trabalho produz por hora de capacidade, no plano
        desta carga. É a <strong>soma da quantidade dividida pela soma dos
        minutos</strong> — o mix entra ponderado sozinho, cada material pelo
        tempo que ele ocupa.
        {' '}Ponderar as taxas pela participação em quantidade, que é o erro
        natural, infla a capacidade: o produto lento come mais tempo do que a
        quantidade sugere.
      </p>

      <div className="grade-rolagem">
        <table>
          <thead>
            <tr>
              <th>CT</th>
              <th>Unidade</th>
              <th className="num">Demanda (h)</th>
              <th className="num">m/h de tecelagem</th>
              <th className="num">UM do material /h</th>
              <th className="num">Meses</th>
              <th>Recurso</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((x) => (
              <tr key={x.ct} className={x.tem_recurso ? '' : 'linha-vazia'}>
                <td><code>{x.ct}</code></td>
                <td>
                  <span className={'selo ' + (x.unidade === 'KG' ? 'padrao' : 'rodizio')}>
                    {x.unidade === 'KG' ? 'kg · fiação' : 'metro'}
                  </span>
                </td>
                <td className="num">{fmt(x.horas)}</td>
                <td className="num forte">{fmt(x.metros_por_hora)}</td>
                <td className="num muted">{fmt(x.qtd_por_hora)}</td>
                <td className="num muted">{fmt(x.meses)}</td>
                <td className="muted">
                  {x.tem_recurso ? 'cadastrado' : 'falta cadastrar'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="rodape">
        <strong>Conferência de sanidade:</strong> tear de felpudo fica na casa
        de 11 a 51 m/h. Número muito fora disso costuma ser CT com roteiro em
        outra unidade, não erro de conta.
        {' '}Linha em cinza é CT sem recurso cadastrado: o índice existe e está
        certo, só não tem em que capacidade se apoiar ainda.
        {' '}A coluna <strong>m/h de tecelagem</strong> é a régua comum da
        fábrica; a de <strong>UM do material</strong> conta peça, jogo ou metro
        de produto, e por isso não soma entre CTs diferentes.
      </p>
    </>
  );
}
