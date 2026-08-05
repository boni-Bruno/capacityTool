'use client';

import { useRouter, useSearchParams } from 'next/navigation';

// Filtros das telas de cadastro. O estado mora na URL, igual ao painel —
// assim recarregar a página ou compartilhar o link cai no mesmo lugar.
export default function Seletor({ campos }) {
  const router = useRouter();
  const params = useSearchParams();

  // `param` separa o nome do campo do parâmetro que ele escreve na URL: dois
  // campos podem apontar para o mesmo parâmetro. É o caso de Recurso e Código,
  // duas maneiras de escolher a mesma máquina — quem a conhece pelo patrimônio
  // não precisa saber o apelido dela.
  function muda(nome, valor) {
    const p = new URLSearchParams(params.toString());
    // Opção vazia ("todas as áreas") some da URL em vez de virar "area=":
    // parâmetro pendurado engana quem lê o endereço e quem depura.
    if (valor === '') p.delete(nome); else p.set(nome, valor);
    // Trocar de turno/recurso invalida a linha aberta para edição.
    router.push('?' + p.toString());
  }

  return (
    <div className="filtros">
      {campos.map((c) => (
        <label key={c.nome} className="campo">
          <span className="campo-rot">{c.rotulo}</span>
          {c.tipo === 'data' ? (
            <input
              type="date"
              value={c.valor}
              onChange={(e) => muda(c.param ?? c.nome, e.target.value)}
            />
          ) : (
            <select value={c.valor}
                    onChange={(e) => muda(c.param ?? c.nome, e.target.value)}>
              {c.opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>{o.rotulo}</option>
              ))}
            </select>
          )}
        </label>
      ))}
    </div>
  );
}
