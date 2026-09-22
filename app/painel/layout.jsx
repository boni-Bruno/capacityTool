import Shell from '../shell';

// A casca sai da página e vira LAYOUT, como já é em /cadastros.
//
// Não é arrumação: é o que permite o loading.jsx desta pasta aparecer COM o
// menu. Fallback que inclui a casca teria de ler sessão e banco para se
// desenhar — e um esqueleto que consulta o banco não é esqueleto. Com a casca
// no layout, ela fica montada entre uma navegação e outra e só o miolo pisca.
export default function PainelLayout({ children }) {
  return <Shell>{children}</Shell>;
}
