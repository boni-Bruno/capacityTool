import Link from 'next/link';
import {
  enderecoDaHomeDoHub, enderecoDeSairDoHub, enderecoDoHub, entradaLocalLigada,
} from '../../lib/hub';

export const metadata = { title: 'Você saiu' };
export const dynamic = 'force-dynamic';

// =============================================================================
// A TELA DE DEPOIS DE SAIR.
//
// Ela existe porque o botão Sair parecia não funcionar: o cookie era apagado e
// a pessoa ia para `/entrar`, que redireciona ao Hub, que ainda tinha sessão
// viva e a devolvia logada. Em dois segundos, de volta à mesma tela. Relato do
// Bruno em 02/10/2026: *"clica em Sair, retorna para a aplicação"*.
//
// Não era defeito de cookie: era a porta de entrada funcionando perfeitamente a
// um passo da saída. Esta página quebra o automatismo — ela não redireciona
// ninguém, e diz o que aconteceu de verdade: você saiu DAQUI, e a sessão do
// portal continua de pé.
//
// FORA DO PORTEIRO (ver o matcher em middleware.js): sem sessão, o middleware
// mandaria esta página para o Hub, e a tela de "você saiu" seria o primeiro
// lugar a reentrar.
//
// Não mostra dado nenhum, de propósito: ela é vista justamente por quem acabou
// de deixar de ter sessão.
// =============================================================================

export default function Page() {
  // TRÊS SAÍDAS DIFERENTES, e confundi-las é fácil:
  //   `home`      o portal, e só ele — é o "voltar para o Hub";
  //   `sairDoHub` o logout de lá, quando o Hub expõe um e alguém o configurou;
  //   `voltar`    de novo PARA CÁ, pelo /ir/capacidade do portal.
  // O primeiro botão era `voltar` até 02/10/2026, e ele reentra na ferramenta —
  // o contrário do que alguém espera de uma tela de saída.
  const home = enderecoDaHomeDoHub();
  const sairDoHub = enderecoDeSairDoHub();
  const voltar = entradaLocalLigada() ? '/entrar' : (enderecoDoHub('/') ?? '/entrar');

  return (
    // A mesma casca da tela de senha, e com a mesma razão de ser: é uma página
    // sem menu, de quem não tem sessão. `max-width` maior porque aqui há texto
    // a ler, e não dois campos a preencher.
    <main className="entrar-tela">
      <div className="entrar-caixa" style={{ maxWidth: 460 }}>
        <h1 className="titulo" style={{ marginBottom: 6 }}>Você saiu</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          A sua sessão na <strong>Capacity Tool</strong> foi encerrada neste
          navegador.
        </p>

        {sairDoHub ? (
          <p className="rodape" style={{ marginTop: 14 }}>
            A sua identidade vem do <strong>Hub S&amp;OP</strong>, e a sessão
            dele continua aberta — por isso entrar de novo aqui não pede senha.
            Para sair de tudo, saia também do portal.
          </p>
        ) : (
          <p className="rodape" style={{ marginTop: 14 }}>
            A sua identidade vem do <strong>Hub S&amp;OP</strong>, e a sessão
            dele continua aberta: entrar de novo aqui não vai pedir senha. Para
            sair de tudo, saia pelo portal — é lá que a senha mora.
          </p>
        )}

        {/* Links normais, e não <Link>: todos saem deste app, e o roteador do
            Next não navega para fora. */}
        <div className="acoes" style={{ marginTop: 18, flexWrap: 'wrap' }}>
          {sairDoHub && (
            <a className="btn btn-primario" href={sairDoHub}>
              Sair também do Hub S&amp;OP
            </a>
          )}
          {home && (
            <a className={sairDoHub ? 'btn' : 'btn btn-primario'} href={home}>
              Voltar ao Hub S&amp;OP
            </a>
          )}
          <a className="btn" href={voltar}>Entrar de novo</a>
        </div>

        <p className="rodape" style={{ marginTop: 18 }}>
          Fechar o navegador também encerra a sessão daqui — ela não sobrevive
          ao fechamento, e o token vence em 12 h de qualquer jeito.
          {' '}<Link href="/">Ir para o início</Link>.
        </p>
      </div>
    </main>
  );
}
