'use client';

import { useRouter } from 'next/navigation';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { detalhe, emUnidade, formataUnidade, sufixoUnidade } from '../../lib/formato';

// Barras de capacidade com a demanda por cima, em linha.
//
// UMA capacidade só nas barras, escolhida em cima. Três barras mais uma linha
// deixariam a pergunta deste painel — "cabe?" — competindo com a comparação
// entre as três capacidades, que é a pergunta do outro painel. Aqui a resposta
// é a distância entre a barra e a linha, e ela precisa estar sozinha.
//
// A linha e as barras dividem o MESMO eixo de propósito. Dois eixos fariam a
// demanda cruzar a capacidade em qualquer lugar que a escala mandasse — e o
// cruzamento é justamente o que se está olhando.

const COR = {
  Instalada: '#c9c7c0',
  Planejada: '#2a78d6',
  Disponível: '#1baf7a',
};

export default function GraficoOcupacao({
  dados, medida = 'Disponível', unidade = 'min', sufixo = null,
}) {
  const suf = sufixo ?? sufixoUnidade(unidade);
  const router = useRouter();

  // Em hora a barra guarda hora, e o x60 recupera o minuto de origem para
  // formatar. Em minuto não há o que desfazer. Este painel não tem unidade
  // física: a demanda é tempo de roteiro, e comparar minuto com minuto
  // dispensa índice de conversão.
  const desfaz = unidade === 'min' ? (v) => Number(v) : (v) => Number(v) * 60;

  const d = dados.map((x) => ({
    rotulo: x.rotulo,
    href: x.href ?? null,
    [medida]: emUnidade(x.capacidade, unidade),
    Demanda: emUnidade(x.demanda, unidade),
  }));

  const clicavel = d.some((x) => x.href);

  function aoClicar(estado) {
    const alvo = estado?.activePayload?.[0]?.payload?.href;
    if (alvo) router.push(alvo);
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={d}
        margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
        onClick={clicavel ? aoClicar : undefined}
        style={clicavel ? { cursor: 'pointer' } : undefined}
      >
        <CartesianGrid stroke="#e5e3dd" vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: '#6b6a65' }}
               axisLine={{ stroke: '#d8d6cf' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#6b6a65' }} axisLine={false}
               tickLine={false} width={54}
               tickFormatter={(v) =>
                 (v >= 1000
                   ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k ${suf}`
                   : `${formataUnidade(desfaz(v), unidade)} ${suf}`)} />
        <Tooltip
          cursor={{ fill: 'rgba(42,120,214,.06)' }}
          formatter={(v, n) => [
            sufixo ? `${formataUnidade(desfaz(v), unidade)} ${suf}`
                   : detalhe(desfaz(v), unidade), n,
          ]}
          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e3dd' }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

        <Bar dataKey={medida} fill={COR[medida] ?? COR['Disponível']}
             radius={[3, 3, 0, 0]} />
        {/* A demanda em linha, e não em barra: barra ao lado de barra convida
            a somar, e estas duas nunca se somam — uma é o que cabe, a outra é
            o que foi pedido. */}
        <Line type="monotone" dataKey="Demanda" stroke="#a32d2d" strokeWidth={2}
              dot={{ r: 3, fill: '#a32d2d' }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
