'use client';

import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import {
  detalhe, eFisica, emUnidade, formataUnidade, sufixoUnidade, eMinuto,
} from '../../lib/formato';
import { EIXO, MARGEM_ESQ, TOTAL } from './grade';
import { coresDoTema } from './cores';

// Um gráfico para os três níveis do drill-down: mês, dia e turno.
//
// Cada ponto pode trazer um `href`; clicar na coluna navega para lá. A função
// de navegação não pode vir do servidor como prop, então o que atravessa é a
// URL pronta em texto e o clique é resolvido aqui.
//
// `mostrarInstalada` é falso no nível de turno: instalada é grão dia, e
// repeti-la em cada barra de turno era o que inflava o total no Qlik antigo.
// `sufixo` chega pronto porque ele pode dizer mais que a unidade: em capacidade
// por dia útil vira "m/dia útil", e sem isso o gráfico mostraria uma ordem de
// grandeza a menos com o mesmo rótulo de antes.
export default function Grafico({
  dados, mostrarInstalada = true, unidade = 'min', sufixo = null,
  tema = 'claro',
}) {
  const suf = sufixo ?? sufixoUnidade(unidade);
  const cor = coresDoTema(tema);
  const router = useRouter();

  // A barra guarda o número já na unidade escolhida, e o rótulo precisa
  // desfazer essa conversão para formatar.
  //
  // Em HORA a barra guarda hora e o x60 recupera o minuto de origem. Em MINUTO
  // não há o que desfazer. Em unidade FÍSICA também não: metro não vira minuto,
  // e multiplicar por 60 ali imprimia 4.254,9 m onde a tabela — certa —
  // mostrava 70,9. Era o mesmo número lido de dois jeitos na mesma tela.
  const desfaz = (eMinuto(unidade) || eFisica(unidade))
    ? (v) => Number(v)
    : (v) => Number(v) * 60;

  const d = dados.map((x) => ({
    rotulo: x.rotulo,
    href: x.href ?? null,
    ...(mostrarInstalada ? { Instalada: emUnidade(x.instalada, unidade) } : {}),
    Planejada: emUnidade(x.planejada, unidade),
    Disponível: emUnidade(x.disponivel, unidade),
  }));

  const clicavel = d.some((x) => x.href);

  function aoClicar(estado) {
    const alvo = estado?.activePayload?.[0]?.payload?.href;
    if (alvo) router.push(alvo);
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={d}
        // As margens vêm da mesma grade da tabela logo abaixo: é isso que
        // faz janeiro cair embaixo de janeiro. Ver ./grade.js.
        margin={{ top: 4, right: TOTAL, left: MARGEM_ESQ, bottom: 0 }}
        onClick={clicavel ? aoClicar : undefined}
        style={clicavel ? { cursor: 'pointer' } : undefined}
      >
        <CartesianGrid stroke={cor.grade} vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: cor.rotulo }}
               axisLine={{ stroke: cor.eixo }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: cor.rotulo }} axisLine={false} tickLine={false}
               width={EIXO}
               tickFormatter={(v) =>
                 v >= 1000
                   ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                     + 'k ' + suf
                   : formataUnidade(desfaz(v), unidade) + ' ' + suf} />
        <Tooltip
          cursor={{ fill: cor.cursor }}
          formatter={(v, n) => [
            // `detalhe` já sabe o que a leitura exata significa em cada
            // unidade: hora e minuto no tempo, o número cheio no metro. Não
            // existe "70 h 55 min" de metro de tecelagem.
            // Em tempo, `detalhe` traz a leitura exata em hora e minuto, que
            // já carrega a unidade. Fora disso o número precisa do sufixo —
            // sobretudo em capacidade por dia útil, onde ele é a única coisa
            // que distingue 70,9 m de 70,9 m/dia útil.
            sufixo ? `${formataUnidade(desfaz(v), unidade)} ${suf}`
                   : detalhe(desfaz(v), unidade), n,
          ]}
          contentStyle={{ fontSize: 13, borderRadius: 8, background: cor.caixa,
                          border: `1px solid ${cor.borda}` }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {mostrarInstalada && (
          <Bar dataKey="Instalada" fill="#c9c7c0" radius={[3, 3, 0, 0]} />
        )}
        <Bar dataKey="Planejada"  fill="#2a78d6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Disponível" fill="#1baf7a" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
