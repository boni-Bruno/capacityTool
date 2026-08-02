// Mesmo aviso do painel: sem DATABASE_URL a tela não tem o que mostrar, e
// o motivo tem que aparecer em vez de a página quebrar em branco.
export default function AvisoBanco({ erro }) {
  return (
    <div className="aviso">
      <strong>Não consegui falar com o banco.</strong>
      <p style={{ margin: '8px 0 0' }}>
        Confira se <code>DATABASE_URL</code> está preenchida com a connection
        string do Neon.
      </p>
      {erro && (
        <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.75 }}>{erro}</p>
      )}
    </div>
  );
}
