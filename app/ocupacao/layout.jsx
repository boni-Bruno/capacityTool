import Shell from '../shell';

// Ver app/painel/layout.jsx: a casca no layout é o que deixa o loading.jsx
// desta pasta aparecer com o menu já montado.
export default function OcupacaoLayout({ children }) {
  return <Shell>{children}</Shell>;
}
