// As cores que o gráfico precisa em hexadecimal.
//
// O recharts pinta por ATRIBUTO do SVG — `stroke="..."`, `fill="..."` — e
// variável de CSS não resolve em atributo. Então a paleta do gráfico não pode
// sair do globals.css como o resto da tela: ela viaja por prop, do servidor,
// que é quem sabe o tema.
//
// Sem isto o modo escuro deixaria a grade clara riscando o fundo escuro e os
// rótulos do eixo ilegíveis — bem no meio da tela que mais se olha.
//
// Sem imports: é lido do servidor e do cliente.

const CLARO = {
  grade: '#e5e3dd',
  eixo: '#d8d6cf',
  rotulo: '#6b6a65',
  cursor: 'rgba(42,120,214,.06)',
  caixa: '#ffffff',
  borda: '#e5e3dd',
};

const ESCURO = {
  grade: '#33363d',
  eixo: '#3d414a',
  rotulo: '#9b9b96',
  cursor: 'rgba(79,149,234,.12)',
  caixa: '#1e2024',
  borda: '#33363d',
};

export const coresDoTema = (tema) => (tema === 'escuro' ? ESCURO : CLARO);
