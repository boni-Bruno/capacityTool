import Shell from '../shell';

// A casca mora no layout, e não na página: é o que faz o esqueleto do
// loading.jsx aparecer COM o menu em vez de numa tela branca (regra do
// CLAUDE.md).
export default function PlanejamentoLayout({ children }) {
  return <Shell>{children}</Shell>;
}
