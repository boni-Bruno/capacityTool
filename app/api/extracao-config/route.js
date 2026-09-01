import { NextResponse } from 'next/server';
import {
  detalheDoRecorte, serieDoRecorte, turnosDoRecorte,
} from '../../../lib/db';
import { turnos as turnosCadastrados } from '../../../lib/cadastro';
import { resolvePeriodo } from '../../../lib/periodo';
import { mensagemDeErro } from '../../../lib/erros';
import { exigeSessao } from '../../../lib/sessao';

// Os números do recorte escolhido, para o .pptx e para a página de impressão.
//
// UMA CONSULTA SÓ, aberta por centro de trabalho. Os três níveis do documento
// saem dela em `lib/documento.js`: um slide por CT usa as linhas direto, um
// slide por CC soma as do centro de custo, e o resumo soma todas.
//
// Antes eram três consultas, uma por nível, e três lugares capazes de discordar
// em silêncio — o resumo e a soma dos slides pareceriam certos cada um sozinho,
// e ninguém confere um slide contra o outro num .pptx. É a mesma razão pela qual
// as duas saídas montam o texto na mesma função.
//
// Junto vêm a SÉRIE MENSAL e os TURNOS POR MÊS, que alimentam o gráfico e a
// grade alinhada embaixo dele. As três consultas partem do mesmo recorte e são
// agrupadas pela mesma chave (`chaveDoGrupo`) — cada uma com a sua regra de
// grupo seria o jeito de um slide de CC mostrar o gráfico de outro.
export async function POST(req) {
  try {
    await exigeSessao();
    const b = await req.json();

    const areas = (b.areas ?? []).map(Number).filter(Number.isInteger);
    if (!areas.length) throw new Error('Escolha ao menos uma área.');

    const ccs = (b.ccs ?? []).map((c) => String(c).trim()).filter(Boolean);
    const ano = Number(b.ano);
    if (!Number.isInteger(ano)) throw new Error('Ano inválido.');
    const origem = b.origem === 'SIMULADO' ? 'SIMULADO' : 'META';

    // O mesmo resolvedor do painel: fecha o intervalo dentro do ano escolhido,
    // porque um recorte atravessando a virada somaria fora do ano que o
    // documento diz no título.
    const { de, ate } = resolvePeriodo({ de: b.de, ate: b.ate }, ano);

    const carga = Number.isInteger(Number(b.carga)) && Number(b.carga) > 0
      ? Number(b.carga) : null;

    // Os turnos CADASTRADOS vêm junto, e não só os que o recorte usa: o
    // documento lista todos e marca "N/A" onde nada roda. Turno ausente da
    // lista é indistinguível de turno zerado.
    const [grupos, serie, turnos, cadastrados] = await Promise.all([
      detalheDoRecorte(areas, ccs, ano, de, ate, origem, carga),
      serieDoRecorte(areas, ccs, ano, de, ate, origem, carga),
      turnosDoRecorte(areas, ccs, ano, de, ate),
      turnosCadastrados(),
    ]);

    return NextResponse.json({
      ok: true, de, ate, grupos, serie, turnos, cadastrados,
    });
  } catch (e) {
    console.error('[extracao-config POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
