import Nav from './nav';

// Casca das telas: menu à esquerda, conteúdo à direita.
//
// Fica fora do layout raiz porque /entrar não deve ter menu — quem não entrou
// não tem para onde navegar.
export default function Shell({ children }) {
  return (
    <div className="app">
      <Nav />
      <main className="conteudo">{children}</main>
    </div>
  );
}
