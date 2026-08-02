import Link from 'next/link';
import { MESES } from '../../../lib/dias';

// O ano deste calendário: o que está pintado é dia que a linha NÃO produz.
//
// A mesma data aparece diferente em calendários diferentes, e é esse o ponto —
// domingo é parado no padrão e trabalhado no rodízio, feriado só pinta em quem
// o observa. A grade responde "quando essa linha para", não "o que eu cadastrei".
const INICIAIS = ['d', 's', 't', 'q', 'q', 's', 's'];
const dd = (n) => String(n).padStart(2, '0');

export default function Ano({ ano, dias, selecionada, href, uteis }) {
  const porData = new Map(dias.map((d) => [d.data, d]));

  return (
    <div className="ano-grade">
      {MESES.slice(1).map((rotulo, i) => {
        const mes = i + 1;
        const qtd = new Date(ano, mes, 0).getDate();
        const brancos = new Date(ano, mes - 1, 1).getDay();

        return (
          <div key={mes} className="mes-caixa">
            <p className="mes-nome">
              {rotulo}
              {uteis && (
                <span className="mes-uteis" title="dias úteis trabalhados no mês">
                  {' — '}{uteis[mes]}
                </span>
              )}
            </p>
            <div className="mes-grade">
              {INICIAIS.map((s, n) => (
                <span key={`c${n}`} className="mes-cab">{s}</span>
              ))}
              {Array.from({ length: brancos }, (_, n) => <span key={`b${n}`} />)}

              {Array.from({ length: qtd }, (_, n) => {
                const dia = n + 1;
                const data = `${ano}-${dd(mes)}-${dd(dia)}`;
                const d = porData.get(data);

                // Prioridade da cor, na mesma ordem em que o motor decide:
                // exceção primeiro, depois o padrão semanal.
                const classe = [
                  'dia',
                  d?.excecao_id
                    ? (d.excecao_util ? 'dia-extra' : `dia-${d.tipo.toLowerCase()}`)
                    : d?.trabalha === false ? 'dia-parado' : '',
                  data === selecionada ? 'dia-aberto' : '',
                ].filter(Boolean).join(' ');

                return (
                  <Link key={dia} href={href(data)} className={classe} title={titulo(d, data)}>
                    {dia}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function titulo(d, data) {
  if (!d) return data;
  if (d.excecao_id) {
    return `${data} — ${d.descricao ?? d.tipo}` +
           (d.excecao_util ? ' (trabalha)' : ' (parado)');
  }
  return d.trabalha ? data : `${data} — sem turno neste dia da semana`;
}
