// Ver app/cadastros/loading.jsx e app/painel/loading.jsx.
export default function Carregando() {
  return (
    <div className="esqueleto" aria-busy="true" aria-live="polite">
      <div className="esq-linha esq-titulo" />
      <div className="esq-kpis">
        <div className="esq-kpi" />
        <div className="esq-kpi" />
        <div className="esq-kpi" />
      </div>
      <div className="esq-grafico" />
      <div className="esq-bloco">
        <div className="esq-linha" style={{ width: '92%' }} />
        <div className="esq-linha" style={{ width: '86%' }} />
        <div className="esq-linha" style={{ width: '90%' }} />
      </div>
      <span className="esq-aviso">carregando a ocupação…</span>
    </div>
  );
}
