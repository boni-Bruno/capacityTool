'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Formulário do dia escolhido na grade do ano.
//
// Duas marcações, porque respondem coisas diferentes: a ÁREA diz onde o
// feriado vale — a Confecção para, a Tecelagem não — e o CALENDÁRIO diz qual
// regime para — o padrão para, o rodízio trabalha. O motor exige as duas.
//
// Tudo nasce marcado: o caso comum é o feriado valer em toda a planta, e quem
// não precisa diferenciar nunca mexe aqui.
export default function EditorExcecao({
  plantaId, data, excecao, tipos, calendarios, areas,
}) {
  const router = useRouter();

  const [tipo, setTipo] = useState(excecao?.tipo ?? 'FERIADO');
  const [descricao, setDescricao] = useState(excecao?.descricao ?? '');
  // Os dois eixos novos. Nascem no comportamento de sempre — zera o dia
  // inteiro — para quem só quer cadastrar um feriado não ter que decidir nada.
  const [afeta, setAfeta] = useState(excecao?.afeta_capacidade ?? true);
  const [impacto, setImpacto] = useState(
    String(excecao?.impacto_dia ?? 1).replace('.', ','));
  const [marcados, setMarcados] = useState(() => {
    if (excecao?.calendario_ids) {
      return new Set(excecao.calendario_ids.split(',').map(Number));
    }
    return new Set(calendarios.map((c) => c.id));
  });

  const [areasMarcadas, setAreasMarcadas] = useState(() => {
    if (excecao?.area_ids) return new Set(excecao.area_ids.split(',').map(Number));
    return new Set(areas.map((a) => a.id));
  });

  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  const vira = (setter) => (id) => setter((s) => {
    const novo = new Set(s);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });

  const alterna = vira(setMarcados);
  const alternaArea = vira(setAreasMarcadas);

  async function chamar(metodo, corpo) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/cadastro/excecao', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      router.refresh();
    } catch (e) {
      setErro(e.message ?? 'Falhou');
    } finally {
      setOcupado(false);
    }
  }

  const salvar = () => chamar(excecao ? 'PATCH' : 'POST', {
    ...(excecao ? { id: excecao.id } : { planta_id: plantaId, data }),
    tipo, descricao,
    afeta_capacidade: afeta,
    impacto_dia: impacto,
    calendarios: [...marcados],
    areas: [...areasMarcadas],
  });

  const oTipo = tipos.find((t) => t.valor === tipo);
  const nImpacto = Number(String(impacto).replace(',', '.'));
  // "Quanto do dia" só existe para a parada de apresentação. Quando a exceção
  // para os recursos, o motor zera o dia inteiro — dia_util é booleano — e
  // qualquer fração aqui seria um número que ninguém lê.
  const impactoOk = afeta
    || (Number.isFinite(nImpacto) && nImpacto > 0 && nImpacto <= 1);
  const inutil = !afeta && Number.isFinite(nImpacto) && nImpacto === 0;

  // Trocar para "para os recursos" devolve o campo ao dia inteiro, para a tela
  // nunca mostrar 0,5 ao lado de uma parada que vai parar o dia todo.
  function mudaEfeito(v) {
    const novo = v === 'sim';
    setAfeta(novo);
    if (novo) setImpacto('1');
  }

  return (
    <>
      <div className="form-grade">
        <label className="campo">
          <span className="campo-rot">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tipos.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo}</option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span className="campo-rot">Efeito</span>
          <select value={afeta ? 'sim' : 'nao'}
                  onChange={(e) => mudaEfeito(e.target.value)}>
            <option value="sim">Para os recursos</option>
            <option value="nao">Só apresentação</option>
          </select>
        </label>

        <label className="campo">
          <span className="campo-rot">Quanto do dia</span>
          <input type="text" inputMode="decimal"
                 value={afeta ? '1' : impacto}
                 disabled={afeta}
                 placeholder="0,5"
                 onFocus={(e) => e.target.select()}
                 onChange={(e) => setImpacto(e.target.value)}
                 title={afeta
                   ? 'Parada que atinge os recursos para o dia inteiro — o motor não tem meio termo.'
                   : '1 é o dia inteiro, 0,5 é meio dia'} />
        </label>

        <label className="campo campo-largo">
          <span className="campo-rot">Descrição</span>
          <input type="text" value={descricao} placeholder="ex.: Aniversário da cidade"
                 onChange={(e) => setDescricao(e.target.value)} />
        </label>
      </div>

      <p className="campo-rot" style={{ marginTop: 14 }}>
        Áreas em que vale
      </p>
      <div className="acoes" style={{ marginTop: 6 }}>
        {areas.map((a) => (
          <label key={a.id} className={'caixa' + (areasMarcadas.has(a.id) ? ' caixa-on' : '')}>
            <input type="checkbox" checked={areasMarcadas.has(a.id)}
                   onChange={() => alternaArea(a.id)} />
            <span>{a.nome}</span>
          </label>
        ))}
      </div>

      <p className="campo-rot" style={{ marginTop: 14 }}>
        Regimes que param
      </p>
      <div className="acoes" style={{ marginTop: 6 }}>
        {calendarios.map((c) => (
          <label key={c.id} className={'caixa' + (marcados.has(c.id) ? ' caixa-on' : '')}>
            <input type="checkbox" checked={marcados.has(c.id)}
                   onChange={() => alterna(c.id)} />
            <span>{c.nome}</span>
          </label>
        ))}
      </div>

      <p className="rodape">
        <strong>Efeito</strong> separa duas coisas que andavam juntas.
        {' '}<em>Para os recursos</em>{' '}
        {oTipo?.dia_util
          ? 'habilita um dia normalmente parado — é como se cadastra trabalho em feriado ou domingo.'
          : 'zera o dia nos calendários marcados; calendário desmarcado continua trabalhando normalmente nessa data.'}
        {' '}<em>Só apresentação</em> deixa a capacidade intacta: o dia produz
        igual, a parada aparece na grade do ano e entra na contagem de dias
        úteis. É para a parada que existe e precisa ser vista, mas que não tira
        máquina de operação.
      </p>
      <p className="rodape">
        <strong>Quanto do dia</strong> só vale para a parada de apresentação, e
        por isso fica travado no dia inteiro na outra opção: quando a exceção
        atinge os recursos, o motor zera o dia todo — não existe meio termo lá
        dentro. Meia parada de verdade, que tira minutos sem tirar o dia, se
        cadastra em <strong>Paradas</strong>, por recurso e em minutos.
        {' '}Na apresentação, <code>1</code> é o dia inteiro e <code>0,5</code>
        é meio dia. Num sábado que já vale 0,5, uma parada de dia inteiro zera o
        sábado — não desconta do dia seguinte.
      </p>

      <div className="acoes" style={{ marginTop: 12 }}>
        <button className="btn btn-primario" onClick={salvar}
                disabled={ocupado || marcados.size === 0
                          || areasMarcadas.size === 0 || !impactoOk || inutil}>
          {ocupado ? 'Salvando…' : excecao ? 'Salvar' : 'Cadastrar'}
        </button>
        {excecao && (
          <button className="btn btn-perigo" disabled={ocupado}
                  onClick={() => chamar('DELETE', { id: excecao.id })}>
            Excluir
          </button>
        )}
        {(marcados.size === 0 || areasMarcadas.size === 0) && (
          <span className="muted">
            marque ao menos uma área e um regime — sem os dois, a exceção não
            alcança ninguém
          </span>
        )}
        {!impactoOk && !inutil && (
          <span className="muted">
            &ldquo;quanto do dia&rdquo; tem que ser maior que 0 e no máximo 1
          </span>
        )}
        {inutil && (
          <span className="muted">
            só apresentação consumindo 0 do dia não faria nada — ou ela para os
            recursos, ou consome parte do dia
          </span>
        )}
        {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
      </div>
    </>
  );
}
