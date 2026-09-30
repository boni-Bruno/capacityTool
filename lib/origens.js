// Os dois cenários de planejamento, em arquivo próprio e sem importar nada.
//
// Fica separado de lib/oee.js porque aquele puxa o driver do banco, e os filtros
// das telas são componentes de cliente — importar de lá arrastaria o driver para
// o bundle do navegador.
//
// OS CÓDIGOS SÃO META E SIMULADO; OS RÓTULOS SÃO ORÇAMENTO E SIMULAÇÃO. Eles
// nasceram significando "qual OEE usar" e passaram a significar "qual cenário"
// (migrações 41 e 42): turno, regime de dias e quantidade também vivem em dobro.
// Renomear o valor gravado reescreveria calculo_execucao, recurso_oee e toda URL
// já compartilhada, para ganhar nada — código e rótulo serem coisas diferentes
// já é a regra do projeto em TELAS.
//
// Os dois são ISOLADOS: não há herança, e corrigir um nunca mexe no outro. O
// Orçamento é o que chega das fábricas; a Simulação é o que se constrói aqui.
export const ORIGENS = ['META', 'SIMULADO'];

export const CENARIOS = [
  { codigo: 'META',     rotulo: 'Orçamento' },
  { codigo: 'SIMULADO', rotulo: 'Simulação' },
];

export const rotuloOrigem = (o) =>
  (CENARIOS.find((c) => c.codigo === o)?.rotulo ?? String(o ?? ''));

// O cenário pedido na URL, ou a Simulação. O padrão é ela de propósito: é onde
// está todo o cadastro construído até aqui, e cair no Orçamento vazio faria a
// tela parecer que o cadastro sumiu.
export const cenarioEscolhido = (v) =>
  (ORIGENS.includes(v) ? v : 'SIMULADO');
