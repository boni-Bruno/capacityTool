'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

export default function Grafico({ dados }) {
  const d = dados.map((x) => ({
    mes: MESES[x.mes - 1],
    Instalada: Number(x.instalada),
    Planejada: Number(x.planejada),
    Disponível: Number(x.disponivel),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={d} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#e5e3dd" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6b6a65' }}
               axisLine={{ stroke: '#d8d6cf' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#6b6a65' }} axisLine={false} tickLine={false}
               tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
        <Tooltip
          formatter={(v, n) => [Number(v).toLocaleString('pt-BR') + ' h', n]}
          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e3dd' }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="Instalada"  fill="#c9c7c0" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Planejada"  fill="#2a78d6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Disponível" fill="#1baf7a" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
