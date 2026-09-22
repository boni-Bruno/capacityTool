import Link from 'next/link';
import { sessaoAtual } from '../../lib/sessao';
import { podeEditar, podeVer } from '../../lib/permissoes';

// A GUARDA DAS PÁGINAS.
//
// O menu esconde o que a pessoa não pode ver; a página nega. Os dois são
// necessários: o endereço se cola, se guarda nos favoritos, se adivinha — e a
// tela que só confiasse no menu estaria aberta para quem soubesse o caminho.
//
// `exigeVer` devolve o aviso pronto (ou null): a página faz
// `const negado = await exigeVer('oee'); if (negado) return negado;` no topo,
// antes de qualquer consulta — sem acesso, sem custo.
export async function exigeVer(tela) {
  const s = await sessaoAtual();
  if (s && podeVer(s.perms, tela)) return null;
  return (
    <div className="aviso">
      <strong>Sem acesso a esta tela.</strong>
      <p style={{ margin: '8px 0 0' }}>
        {s?.tipo === 'nenhum'
          ? 'Você ainda não tem usuário nesta ferramenta — peça ao gestor de planejamento.'
          : 'Seu cargo não inclui esta tela. Se precisa dela, peça ao gestor de planejamento.'}
        {' '}<Link href="/">Voltar ao início</Link>
      </p>
    </div>
  );
}

/** A sessão pode editar esta tela? Para a página decidir o que oferecer. */
export async function podeEditarTela(tela) {
  const s = await sessaoAtual();
  return Boolean(s && podeEditar(s.perms, tela));
}

/**
 * O aviso de "somente leitura", para as telas de matriz e importação, que
 * têm botões demais para esconder um a um: o servidor recusa a gravação de
 * qualquer jeito, e a faixa avisa antes do clique.
 */
export async function SomenteLeitura({ tela }) {
  if (await podeEditarTela(tela)) return null;
  return (
    <p className="rodape somente-leitura">
      <strong>Somente leitura.</strong> Seu cargo vê esta tela, mas não grava
      nela — o que for salvo aqui será recusado.
    </p>
  );
}
