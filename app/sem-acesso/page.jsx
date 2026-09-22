import { sessaoAtual } from '../../lib/sessao';
import Sair from '../sair';

export const metadata = { title: 'Sem acesso' };
export const dynamic = 'force-dynamic';

// Quem veio do Hub e não está cadastrado aqui cai nesta página — com o
// próprio e-mail na tela, para saber exatamente o que pedir ao gestor.
export default async function SemAcesso() {
  const s = await sessaoAtual();
  return (
    <div className="entrar-tela">
      <div className="entrar-caixa">
        <h1>Sem acesso</h1>
        <p className="entrar-sub">
          {s?.email
            ? <>O e-mail <strong>{s.email}</strong> ainda não tem usuário nesta ferramenta.</>
            : 'Você ainda não tem usuário nesta ferramenta.'}
          {' '}Peça ao gestor de planejamento que cadastre você — com o cargo e as
          fábricas que você atende — e entre de novo pelo portal.
        </p>
        <Sair rotulo="Voltar para a entrada" />
      </div>
    </div>
  );
}
