import { revalidatePath } from 'next/cache';

// As telas são `dynamic = 'force-dynamic'`, então o servidor sempre consulta o
// banco. O problema é o outro cache: o Router Cache do Next guarda no navegador
// o conteúdo das rotas já visitadas por ~30s. Sem invalidar, cadastrar um turno
// e navegar de volta mostra a lista velha — o registro está no banco e some da
// tela, que é o pior tipo de erro.
//
// Chamar isto na rota que grava marca as páginas como sujas, e a próxima
// navegação busca de novo em vez de servir o que estava guardado.
export function revalidarCadastros() {
  revalidatePath('/cadastros', 'layout');   // todas as telas de cadastro
  revalidatePath('/painel');                // os números dependem do cadastro
}
