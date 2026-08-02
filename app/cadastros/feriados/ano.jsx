import Link from 'next/link';
import { MESES } from '../../../lib/dias';

// O ano inteiro em doze grades. Serve para conferir de bate-pronto o que está
// cadastrado — que é diferente de olhar uma lista e tentar lembrar se falta
// algum feriado.
//
// As colunas são os dias da semana, com os brancos do começo do mês, para o
// domingo ficar sempre na mesma coluna: é assim que se enxerga um feriado que
// caiu num dia já parado.
const INICIAIS = ['d', 's', 't', 'q', 'q', 's', 's'];

const dd = (n) => String(n).padStart(2, '0');

export default function Ano({ ano, excecoes, selecionada, href, uteis }) {
  // data ISO -> exceção, para achar em O(1) na hora de pintar o dia.
  const porData = new Map(excecoes.map((e) => [e.data, e]));

  return (
    <div className="ano-grade">
      {MESES.slice(1).map((rotulo, i) => {
        const mes = i + 1;
        const dias = new Date(ano, mes, 0).getDate();
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
              {Array.from({ length: brancos }, (_, n) => (
                <span key={`b${n}`} />
              ))}
              {Array.from({ length: dias }, (_, n) => {
                const dia = n + 1;
                const data = `${ano}-${dd(mes)}-${dd(dia)}`;
                const ex = porData.get(data);
                const domingo = new Date(ano, mes - 1, dia).getDay() === 0;

                const classe = [
                  'dia',
                  ex ? (ex.dia_util ? 'dia-extra' : `dia-${ex.tipo.toLowerCase()}`) : '',
                  domingo && !ex ? 'dia-domingo' : '',
                  data === selecionada ? 'dia-aberto' : '',
                ].filter(Boolean).join(' ');

                return (
                  <Link key={dia} href={href(data)} className={classe}
                        title={ex ? `${ex.descricao ?? ex.tipo} — ${ex.calendarios ?? 'nenhum calendário'}` : data}>
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
