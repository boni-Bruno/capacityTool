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
                //
                // Parada de apresentação é o caso à parte: ela tem exceção,
                // mas o dia produz. Pintá-la como feriado diria que a máquina
                // parou, que é justamente o contrário do que foi cadastrado —
                // então ela ganha uma marca própria, discreta.
                const soMostra = d?.excecao_id && d.afeta_capacidade === false;
                const classe = [
                  'dia',
                  soMostra ? 'dia-apresenta'
                    : d?.excecao_id
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

// Vírgula decimal: 0.5 na tela brasileira é 0,5.
const num = (v) => String(Number(v ?? 0)).replace('.', ',');

function titulo(d, data) {
  if (!d) return data;
  if (d.excecao_id) {
    const o = d.afeta_capacidade === false
      ? `produz normal, consome ${num(d.impacto_dia)} dia útil`
      : d.excecao_util ? 'trabalha' : 'parado';
    return `${data} — ${d.descricao ?? d.tipo} (${o})`;
  }
  return d.trabalha ? data : `${data} — sem turno neste dia da semana`;
}
