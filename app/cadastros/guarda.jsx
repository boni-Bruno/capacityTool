import Link from 'next/link';
import { sessaoAtual } from '../../lib/sessao';
import { podeEditar, podeVer } from '../../lib/permissoes';
import { areas } from '../../lib/db';
import { alcancaPlanta, filtraPeloEscopo } from '../../lib/escopo';

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

/**
 * As áreas que a sessão alcança, na forma de `areas()` — para os seletores
 * de fábrica dos painéis e das telas de planejamento. Quem tem tudo recebe a
 * lista inteira; o resto, só o que o escopo cobre. "Todas as fábricas" nos
 * painéis é todas as PERMITIDAS.
 */
export async function areasDoEscopo() {
  const [s, lista] = await Promise.all([sessaoAtual(), areas()]);
  if (!s) return [];
  return filtraPeloEscopo(s.areas, lista);
}

/**
 * Recorta uma lista de cadastro pelo escopo. `campo` é a coluna com o id;
 * `tipo` 'area' compara com as áreas alcançadas, 'planta' com as plantas
 * VISÍVEIS — as que a pessoa tem inteiras OU de que alcança alguma área. Quem
 * tem só a Tecelagem vê os turnos da Matriz (são compartilhados, e ler ajuda a
 * entender o próprio número); editar é outra conversa, e a rota decide.
 */
export async function soDoEscopo(lista, campo, tipo = 'area') {
  const s = await sessaoAtual();
  if (!s) return [];
  if (s.areas === null) return lista;          // empresa inteira: passa tudo
  if (tipo === 'area') return filtraPeloEscopo(s.areas, lista, campo);
  // Daqui para baixo o escopo NÃO é a empresa inteira, então `s.plantas`
  // também é um Set — os dois vêm juntos de sessaoAtual.
  const todas = await areas();
  const visiveis = new Set([
    ...s.plantas,
    ...todas.filter((a) => s.areas.has(Number(a.id))).map((a) => Number(a.planta_id)),
  ]);
  return filtraPeloEscopo(visiveis, lista, campo);
}

/** As plantas em que a pessoa pode CRIAR coisa da planta: inteiras, ou tudo. */
export async function plantasEditaveis(lista) {
  const s = await sessaoAtual();
  if (!s) return [];
  return lista.filter((p) => alcancaPlanta(s.plantas, p.id));
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
