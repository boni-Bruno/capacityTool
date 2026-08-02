'use client';

import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { emHoras, horas, horasEMinutos } from '../../lib/formato';

// Um gráfico para os três níveis do drill-down: mês, dia e turno.
//
// Cada ponto pode trazer um `href`; clicar na coluna navega para lá. A função
// de navegação não pode vir do servidor como prop, então o que atravessa é a
// URL pronta em texto e o clique é resolvido aqui.
//
// `mostrarInstalada` é falso no nível de turno: instalada é grão dia, e
// repeti-la em cada barra de turno era o que inflava o total no Qlik antigo.
export default function Grafico({ dados, mostrarInstalada = true }) {
  const router = useRouter();

  // Os dados chegam em minutos, que é a moeda base do projeto. A barra precisa
  // de número, então vira hora fracionária aqui — sem arredondar, para o
  // tooltip poder reconstruir o minuto exato.
  const d = dados.map((x) => ({
    rotulo: x.rotulo,
    href: x.href ?? null,
    ...(mostrarInstalada ? { Instalada: emHoras(x.instalada) } : {}),
    Planejada: emHoras(x.planejada),
    Disponível: emHoras(x.disponivel),
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
                   ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k h'
                   : horas(v * 60) + ' h'} />
        <Tooltip
          cursor={{ fill: 'rgba(42,120,214,.06)' }}
          formatter={(v, n) => [
            `${horas(v * 60)} h  (${horasEMinutos(v * 60)})`, n,
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
