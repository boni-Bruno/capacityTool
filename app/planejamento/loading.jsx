// O mesmo esqueleto dos cadastros, e pela mesma razão (ver
// app/cadastros/loading.jsx): markup puro, sem sessão e sem banco, dentro do
// layout para o menu continuar montado enquanto só o miolo pisca.
//
// Aqui ele importa mais que lá: cada passo do fluxo monta um editor inteiro no
// servidor, e sem o esqueleto a etapa anterior ficaria parada na tela dando a
// impressão de que o "Confirmei" não funcionou.
export default function Carregando() {
  return (
    <div className="esqueleto" aria-busy="true" aria-live="polite">
      <div className="esq-linha esq-titulo" />
      <div className="esq-barra" />
      <div className="esq-bloco">
        <div className="esq-linha" style={{ width: '46%' }} />
        <div className="esq-linha" style={{ width: '90%' }} />
        <div className="esq-linha" style={{ width: '86%' }} />
        <div className="esq-linha" style={{ width: '74%' }} />
      </div>
      <span className="esq-aviso">carregando a etapa…</span>
    </div>
  );
}
