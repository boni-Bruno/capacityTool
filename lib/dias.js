// Fica em arquivo próprio, sem importar o driver do banco: as telas de
// cadastro são client components e puxariam lib/db.js junto para o bundle.
//
// A ordem é a do banco: dia_semana 0 = domingo ... 6 = sábado.
export const DIAS = [
  'domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado',
];
