// O QUE APARECE ENQUANTO A TELA CARREGA.
//
// Sem isto, clicar num item do menu não dava sinal nenhum: a tela ANTERIOR
// ficava parada até o servidor terminar — e as telas daqui consultam o banco
// a cada navegação (todas são force-dynamic, e o Router Cache está desligado
// de propósito em next.config.js). Dois segundos sem nada acontecendo se leem
// como travamento, não como espera.
//
// O esqueleto é MARKUP PURO: nada de sessão, nada de banco. Fallback que
// consulta o banco para se desenhar não é fallback — é mais uma espera antes
// da espera. Ele mora dentro do layout, então o menu continua montado e só o
// miolo pisca.
export default function Carregando() {
  return (
    <div className="esqueleto" aria-busy="true" aria-live="polite">
      <div className="esq-linha esq-titulo" />
      <div className="esq-barra" />
      <div className="esq-bloco">
        <div className="esq-linha" style={{ width: '38%' }} />
        <div className="esq-linha" style={{ width: '92%' }} />
        <div className="esq-linha" style={{ width: '84%' }} />
        <div className="esq-linha" style={{ width: '88%' }} />
        <div className="esq-linha" style={{ width: '70%' }} />
      </div>
      <span className="esq-aviso">carregando…</span>
    </div>
  );
}
