import Link from 'next/link';
import { cadastroPorMes, turnosDasAreas } from '../../lib/db';
import { gradeDeCadastro } from '../../lib/grade-cadastro';
import { detalhe, formataUnidade } from '../../lib/formato';
import { ROTULO, TOTAL } from './grade';

// A GRADE DE CADASTRO, embaixo da de capacidade e nas MESMAS colunas.
//
// A tabela de cima diz quanto cabe; esta diz com o quê — o OEE que o motor
// aplicou, quantos recursos rodam em cada turno e quantos minutos de parada.
// É a leitura que o slide da extração das configurações já dava e que no
// painel faltava: a barra de março caiu porque o OEE caiu ou porque perdeu um
// turno?
//
// ELA MORA DENTRO DA MESMA `.grade-alinhada`, e isso é o ponto: as larguras
// vêm de ./grade.js, então a coluna de março daqui cai exatamente embaixo da
// barra de março. Numa tabela própria, fora da caixa de rolagem, a primeira
// rolagem horizontal já desalinharia as duas — justamente quando alguém está
// conferindo coluna por coluna.
//
// É UM COMPONENTE DE SERVIDOR ASSÍNCRONO, usado dentro de <Suspense>: são duas
// consultas a mais, e o painel não pode esperar por elas para desenhar o
// gráfico. O esqueleto abaixo segura o lugar enquanto elas voltam.

const fmtInt = (n) => Number(n ?? 0).toLocaleString('pt-BR');

function celula(linha, valor) {
  if (linha.tipo === 'pct') {
    // Sem casa decimal, como o indicador de OEE no alto do painel: os dois
    // falam do mesmo número, e discordar na vírgula é o bastante para alguém
    // achar que são contas diferentes.
    return valor === null ? '—' : `${Math.round(valor)}%`;
  }
  if (linha.tipo === 'qt') {
    // Vazio, e não "0" nem "N/A": com sete turnos cadastrados e dois em uso, a
    // grade viraria um campo de zeros e a linha que importa sumiria no meio. A
    // linha continua lá — é ela que diz "o 3º não roda aqui".
    return valor === null ? '' : fmtInt(valor);
  }
  return formataUnidade(valor, 'min');
}

export default async function Cadastros({
  execId, areaId, de, ate, recursos = null, colunas = [], origem = 'META',
  // Com recorte por atributo, o painel acima está RATEADO e esta grade não —
  // ver o rodapé.
  rateado = false,
}) {
  const [doBanco, daPlanta] = await Promise.all([
    cadastroPorMes(execId, areaId, de, ate, recursos),
    turnosDasAreas(areaId),
  ]);

  // Os meses saem das COLUNAS do gráfico, e não do que o banco devolveu: mês
  // sem linha no fato precisa de coluna vazia, senão a grade teria onze colunas
  // embaixo de um gráfico de doze e nada denunciaria o deslocamento.
  const { linhas } = gradeDeCadastro({
    linhas: doBanco,
    meses: colunas.map((c) => Number(c.mes)),
    turnosDaPlanta: daPlanta,
    origem,
  });

  // SÓ A TABELA. A explicação vai em `NotaCadastros`, fora da caixa de rolagem:
  // aqui dentro ela herdaria a largura mínima da grade e um parágrafo de texto
  // passaria a rolar na horizontal.
  return (
    <table className="tabela-mes tabela-grade tabela-cadastro">
      <thead>
        <tr>
          <th style={{ width: ROTULO }}>Cadastros</th>
          {colunas.map((c) => (
            <th key={c.rotulo} className="col-mes">{c.rotulo}</th>
          ))}
          <th className="num" style={{ width: TOTAL }}>total</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.chave} className={l.tipo === 'qt' ? 'cad-turno' : ''}>
            <td>{l.rotulo}</td>
            {l.valores.map((v, i) => (
              <td key={colunas[i]?.rotulo ?? i} className="num col-mes"
                  title={l.tipo === 'min' ? detalhe(v, 'min') : undefined}>
                {celula(l, v)}
              </td>
            ))}
            <td className="num forte"
                title={l.tipo === 'min' ? detalhe(l.total, 'min') : undefined}>
              {l.semTotal ? '–' : celula(l, l.total)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A explicação da grade, fora da caixa de rolagem. */
export function NotaCadastros({ rateado = false }) {
  return (
    <p className="rodape">
      O que produziu as barras acima, nas mesmas colunas. O{' '}
      <strong>OEE</strong> é o que o motor aplicou nesta rodada — disponível
      sobre planejada, divisão de somas —, e não a faixa cadastrada hoje: as
      duas divergem assim que alguém muda o cadastro sem{' '}
      <strong>Recalcular</strong>, e a grade estaria explicando a barra com um
      número que não a produziu. Cada <strong>turno</strong> mostra quantos
      recursos rodam nele naquele mês (máquinas, ou pessoas quando o recurso é
      PESSOA); turno não totaliza, porque somar os meses daria doze máquinas
      onde há seis, e célula vazia quer dizer que ele não roda neste recorte.
      As <strong>paradas</strong> são os minutos que o motor descontou — o que
      o dia valia depois do calendário menos o que sobrou como planejada —, e
      não a soma da tela de Paradas: parada vale por turno e pode cair fora do
      calendário do recurso. Para cadastrar,{' '}
      <Link href="/cadastros/oee">OEE</Link>,{' '}
      <Link href="/cadastros/turnos-do-recurso">Turnos do recurso</Link> e{' '}
      <Link href="/cadastros/paradas">Paradas</Link>.
      {rateado && (
        <>
          {' '}<strong>O recorte por atributo não vale aqui</strong>: ele
          reparte TEMPO entre rótulos, e máquina não se reparte — meia máquina
          no 1º turno não é uma leitura. Esta grade descreve os recursos
          inteiros da seleção.
        </>
      )}
    </p>
  );
}

/** O lugar guardado enquanto as consultas voltam. */
export function CadastrosCarregando() {
  return (
    <div className="esqueleto" aria-busy="true" style={{ padding: '10px 0 0' }}>
      <div className="esq-linha" style={{ width: '96%' }} />
      <div className="esq-linha" style={{ width: '96%' }} />
      <div className="esq-linha" style={{ width: '96%' }} />
      <span className="esq-aviso">carregando os cadastros…</span>
    </div>
  );
}
