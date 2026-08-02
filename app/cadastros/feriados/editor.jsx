'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Formulário do dia escolhido na grade do ano.
//
// Os calendários são caixas, não um select: o mesmo feriado pode parar a linha
// padrão e não parar a de rodízio, e é essa marcação que o motor lê. Sem
// nenhum marcado a exceção não vale para ninguém, então o salvar fica travado.
export default function EditorExcecao({ plantaId, data, excecao, tipos, calendarios }) {
  const router = useRouter();

  const [tipo, setTipo] = useState(excecao?.tipo ?? 'FERIADO');
  const [descricao, setDescricao] = useState(excecao?.descricao ?? '');
  const [marcados, setMarcados] = useState(() => {
    if (excecao?.calendario_ids) {
      return new Set(excecao.calendario_ids.split(',').map(Number));
    }
    // Feriado novo: todos os calendários observam, que é o caso comum.
    return new Set(calendarios.map((c) => c.id));
  });

  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  function alterna(id) {
    setMarcados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

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
    tipo, descricao, calendarios: [...marcados],
  });

  const oTipo = tipos.find((t) => t.valor === tipo);

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

        <label className="campo campo-largo">
          <span className="campo-rot">Descrição</span>
          <input type="text" value={descricao} placeholder="ex.: Aniversário da cidade"
                 onChange={(e) => setDescricao(e.target.value)} />
        </label>
      </div>

      <p className="campo-rot" style={{ marginTop: 14 }}>
        Calendários que observam
      </p>
      <div className="acoes" style={{ marginTop: 6 }}>
        {calendarios.map((c) => (
          <label key={c.id} className="caixa">
            <input type="checkbox" checked={marcados.has(c.id)}
                   onChange={() => alterna(c.id)} />
            <span>{c.nome}</span>
          </label>
        ))}
      </div>

      <p className="rodape">
        {oTipo?.dia_util
          ? 'Dia extraordinário habilita um dia normalmente parado — é como se cadastra trabalho em feriado ou domingo.'
          : 'Zera o dia nos calendários marcados. Calendário desmarcado continua trabalhando normalmente nessa data.'}
      </p>

      <div className="acoes" style={{ marginTop: 12 }}>
        <button className="btn btn-primario" onClick={salvar}
                disabled={ocupado || marcados.size === 0}>
          {ocupado ? 'Salvando…' : excecao ? 'Salvar' : 'Cadastrar'}
        </button>
        {excecao && (
          <button className="btn btn-perigo" disabled={ocupado}
                  onClick={() => chamar('DELETE', { id: excecao.id })}>
            Excluir
          </button>
        )}
        {marcados.size === 0 && (
          <span className="muted">marque ao menos um calendário</span>
        )}
        {erro && <span className="erro" style={{ margin: 0 }}>{erro}</span>}
      </div>
    </>
  );
}
