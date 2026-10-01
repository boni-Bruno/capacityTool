import { NextResponse } from 'next/server';
import { definirTurnosDoAno } from '../../../../lib/cadastro';
import { mensagemDeErro } from '../../../../lib/erros';
import { exigeRota } from '../../../../lib/sessao';
import { revalidarCadastros } from '../../../../lib/revalidar';
import { cenarioEscolhido } from '../../../../lib/origens';
import { exigeAnoAberto } from '../../../../lib/versao-db';

// Salva a matriz mês x turno de um recurso, um ano por vez.
//
// Corpo: { recurso_id, ano, marcados: { turnoId: { mes: 'todas' | n } } }
//
// O valor da célula é quantas máquinas do recurso rodam naquele turno naquele
// mês; 'todas' vira null no banco e faz o turno acompanhar a quantidade do
// recurso. Mês ausente = não trabalha.
//
// O ano inteiro vem da tela em cada salvamento — turno que não aparece em
// `marcados` fica desligado no ano. O que está configurado fora do ano é
// preservado pelo recomporFaixasComValor().
export async function POST(req) {
  try {
    await exigeRota(req);
    const b = await req.json();

    const recursoId = Number(b.recurso_id);
    const ano = Number(b.ano);
    if (!Number.isInteger(recursoId) || recursoId <= 0) {
      throw new Error('Recurso inválido.');
    }
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      throw new Error('Ano inválido.');
    }

    // O ano tem que estar em planejamento NESTE cenário (migração 45):
    // esconder o ano no seletor não impede um POST direto, e gravar num ano
    // fechado mudaria o cadastro sem mudar a fotografia já aprovada.
    const cenario = cenarioEscolhido(b.cenario);
    await exigeAnoAberto(cenario, ano);

    // `escopo`: os turnos que a TELA ofereceu. Só eles são reescritos — o que
    // ela não mostrou não pode ser apagado por omissão. Ver definirTurnosDoAno.
    const r = await definirTurnosDoAno(recursoId, ano, b.marcados ?? {}, b.escopo,
                                       cenario);
    revalidarCadastros();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[recurso-turno POST]', e);
    return NextResponse.json({ ok: false, erro: mensagemDeErro(e) },
                             { status: e.status ?? 400 });
  }
}
