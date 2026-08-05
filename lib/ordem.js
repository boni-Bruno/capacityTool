// Ordenação escolhida nas tabelas de cadastro.
//
// Ela precisa viver em dois lugares: no componente de tabela (cliente) e nos
// seletores de planta e área espalhados pelo app (servidor). Por isso a
// escolha vai para um COOKIE — localStorage não atravessa para o servidor, e
// sem isso a lista da tela e a do seletor discordariam.
//
// Sem imports: este arquivo é lido dos dois lados.

export const COOKIE = { planta: 'ordem-planta', area: 'ordem-area',
                        recurso: 'ordem-recurso' };

// "nome:asc" -> { campo: 'nome', desc: false }
export function leOrdem(texto, padrao = null) {
  const [campo, dir] = String(texto ?? '').split(':');
  if (!campo) return padrao;
  return { campo, desc: dir === 'desc' };
}

export const escreveOrdem = (o) =>
  o ? `${o.campo}:${o.desc ? 'desc' : 'asc'}` : '';

/**
 * Ordena uma cópia da lista. Número compara como número; o resto compara como
 * texto sem acento e sem caixa, senão "Área" cairia depois de "Zona".
 *
 * Empate desempata pelo id, para a ordem não dançar entre dois renders quando
 * duas linhas têm o mesmo valor no campo escolhido.
 */
export function ordenar(lista, ordem) {
  if (!ordem?.campo) return lista;

  const chave = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return v;
    const n = Number(v);
    if (v !== '' && Number.isFinite(n)) return n;
    return String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  };

  return [...lista].sort((a, b) => {
    const x = chave(a[ordem.campo]);
    const y = chave(b[ordem.campo]);
    let r = 0;
    if (typeof x === 'number' && typeof y === 'number') r = x - y;
    else r = String(x).localeCompare(String(y), 'pt-BR');
    if (r === 0) r = Number(a.id ?? 0) - Number(b.id ?? 0);
    return ordem.desc ? -r : r;
  });
}
