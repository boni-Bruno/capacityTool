// Claro ou escuro.
//
// A escolha vai para um COOKIE, e não para o localStorage, porque quem pinta a
// tela é o servidor: com localStorage o HTML sairia claro e o JavaScript o
// escureceria depois, e essa piscada branca é justamente o que incomoda quem
// escolheu o escuro.
//
// O PADRÃO É CLARO, e não o do sistema. A ferramenta é lida em fábrica, em tela
// de mesa, quase sempre ao lado de uma planilha branca — seguir o sistema faria
// metade das pessoas abrir no escuro sem ter pedido.
//
// Sem imports: é lido do servidor (layout) e do cliente (o botão).

export const COOKIE_TEMA = 'tema';
export const TEMAS = ['claro', 'escuro'];

export const leTema = (valor) => (valor === 'escuro' ? 'escuro' : 'claro');

export const outroTema = (t) => (leTema(t) === 'escuro' ? 'claro' : 'escuro');
