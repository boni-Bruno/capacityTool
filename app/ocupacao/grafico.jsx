'use client';

import { useRouter } from 'next/navigation';
import {
  Area, Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { detalhe, emUnidade, formataUnidade, sufixoUnidade } from '../../lib/formato';
import { EIXO, MARGEM_ESQ, TOTAL } from '../painel/grade';
import { coresDoTema } from '../painel/cores';

// A demanda em colunas, dentro da capacidade desenhada como área.
//
// A CAPACIDADE É O CONTINENTE e a demanda é o conteúdo: a área é o espaço que
// existe, e a coluna é o quanto dele foi pedido. Coluna que ultrapassa o teto
// da área é o que se procura nesta tela, e a leitura é imediata porque a
// pergunta virou geométrica — cabe dentro?
//
// UMA capacidade só, escolhida em cima. Três áreas empilhadas deixariam a
// pergunta deste painel competindo com a comparação entre as três capacidades,
// que é a pergunta do outro painel.
//
// A área e as colunas dividem o MESMO eixo de propósito. Dois eixos fariam a
// demanda cruzar a capacidade em qualquer lugar que a escala mandasse — e o
// cruzamento é justamente o que se está olhando.

const COR = {
  Instalada: '#c9c7c0',
  Planejada: '#2a78d6',
  Disponível: '#1baf7a',
};

export default function GraficoOcupacao({
  dados, medida = 'Disponível', unidade = 'min', sufixo = null,
  tema = 'claro',
}) {
  const suf = sufixo ?? sufixoUnidade(unidade);
  const cor = coresDoTema(tema);
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
        // As margens vêm da mesma grade da tabela logo abaixo: é isso que
        // faz janeiro cair embaixo de janeiro. Ver ../painel/grade.js.
        margin={{ top: 4, right: TOTAL, left: MARGEM_ESQ, bottom: 0 }}
        onClick={clicavel ? aoClicar : undefined}
        style={clicavel ? { cursor: 'pointer' } : undefined}
      >
        <CartesianGrid stroke={cor.grade} vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: cor.rotulo }}
               axisLine={{ stroke: cor.eixo }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: cor.rotulo }} axisLine={false}
               tickLine={false} width={EIXO}
               tickFormatter={(v) =>
                 (v >= 1000
                   ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k ${suf}`
                   : `${formataUnidade(desfaz(v), unidade)} ${suf}`)} />
        <Tooltip
          cursor={{ fill: cor.cursor }}
          formatter={(v, n) => [
            sufixo ? `${formataUnidade(desfaz(v), unidade)} ${suf}`
                   : detalhe(desfaz(v), unidade), n,
          ]}
          contentStyle={{ fontSize: 13, borderRadius: 8, background: cor.caixa,
                          border: `1px solid ${cor.borda}` }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

        {/* A área vem ANTES no eixo de empilhamento para ficar atrás: ela é o
            espaço, e a coluna precisa aparecer dentro dele. */}
        <Area type="monotone" dataKey={medida}
              stroke={COR[medida] ?? COR['Disponível']} strokeWidth={2}
              fill={COR[medida] ?? COR['Disponível']} fillOpacity={0.14}
              dot={{ r: 3, fill: COR[medida] ?? COR['Disponível'] }}
              activeDot={{ r: 5 }} />
        <Bar dataKey="Demanda" fill="#a32d2d" fillOpacity={0.85}
             radius={[3, 3, 0, 0]} maxBarSize={38} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
