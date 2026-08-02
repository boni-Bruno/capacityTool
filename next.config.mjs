const nextConfig = {
  experimental: {
    // O Router Cache do Next guarda no navegador o conteúdo das rotas já
    // visitadas — por padrão 30s mesmo em página dynamic. Numa ferramenta de
    // cadastro isso aparece como registro que foi gravado no banco e não
    // aparece na tela, que é pior do que a tela ser um pouco mais lenta.
    //
    // Zero desliga esse cache para rotas dinâmicas: toda navegação busca de
    // novo. Todas as telas aqui são force-dynamic e consultam o Neon direto,
    // então não há nada a preservar.
    //
    // Isto é o que faltava: revalidatePath numa Route Handler limpa o cache do
    // servidor, mas não manda o sinal que invalida o do cliente — só Server
    // Action e router.refresh() fazem isso.
    // Só `dynamic`: as rotas estáticas aqui são o menu, que não tem dado.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
