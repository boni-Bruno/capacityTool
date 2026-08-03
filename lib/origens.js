// Origens do OEE, em arquivo próprio e sem importar nada.
//
// Fica separado de lib/oee.js porque aquele puxa o driver do banco, e o filtro
// do painel é componente de cliente — importar de lá arrastaria o driver para
// o bundle do navegador.
//
// META é o que se persegue; SIMULADO é o cenário alternativo para comparar.
// Cada uma gera a sua rodada de cálculo, e nenhuma sobrescreve a outra.
export const ORIGENS = ['META', 'SIMULADO'];

export const rotuloOrigem = (o) => (o === 'META' ? 'meta' : 'simulado');
