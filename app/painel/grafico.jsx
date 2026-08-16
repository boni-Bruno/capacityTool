'use client';

import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import {
  detalhe, eFisica, emUnidade, formataUnidade, sufixoUnidade, eMinuto,
} from '../../lib/formato';

// Um gráfico para os três níveis do drill-down: mês, dia e turno.
//
// Cada ponto pode trazer um `href`; clicar na coluna navega para lá. A função
// de navegação não pode vir do servidor como prop, então o que atravessa é a
// URL pronta em texto e o clique é resolvido aqui.
//
// `mostrarInstalada` é falso no nível de turno: instalada é grão dia, e
// repeti-la em cada barra de turno era o que inflava o total no Qlik antigo.
export default function Grafico({ dados, mostrarInstalada = true, unidade = 'min' }) {
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
        margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
        onClick={clicavel ? aoClicar : undefined}
        style={clicavel ? { cursor: 'pointer' } : undefined}
      >
        <CartesianGrid stroke="#e5e3dd" vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: '#6b6a65' }}
               axisLine={{ stroke: '#d8d6cf' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#6b6a65' }} axisLine={false} tickLine={false}
               width={54}
               tickFormatter={(v) =>
                 v >= 1000
                   ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                     + 'k ' + sufixoUnidade(unidade)
                   : formataUnidade(desfaz(v), unidade) + ' ' + sufixoUnidade(unidade)} />
        <Tooltip
          cursor={{ fill: 'rgba(42,120,214,.06)' }}
          formatter={(v, n) => [
            // `detalhe` já sabe o que a leitura exata significa em cada
            // unidade: hora e minuto no tempo, o número cheio no metro. Não
            // existe "70 h 55 min" de metro de tecelagem.
            detalhe(desfaz(v), unidade), n,
          ]}
          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e3dd' }} />
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
