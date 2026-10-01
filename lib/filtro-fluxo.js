// Dentro do fluxo guiado, a fábrica, o ano e o cenário são do FLUXO: quem os
// escolhe é o passo 0 e a versão aberta. Deixar o seletor interno oferecê-los
// seria oferecer uma escolha que a rota desfaz no próximo render — parece
// defeito, e é pior que não ter a opção.
export const DO_FLUXO = ['area', 'ano', 'cenario', 'origem'];
export const semOsDoFluxo = (campos, sp) =>
  (sp?.fluxo === '1' ? campos.filter((c) => !DO_FLUXO.includes(c.nome)) : campos);