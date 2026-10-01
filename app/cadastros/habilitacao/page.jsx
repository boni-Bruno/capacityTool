import { anosComRodada } from '../../../lib/db';
import { anosParaEscolha } from '../../../lib/anos';
import { versoes, progressoDaVersao, prontidaoBruta } from '../../../lib/versao-db';
import { PASSOS, progresso, versaoAberta } from '../../../lib/versao';
import { prontidaoDaPlanta } from '../../../lib/prontidao';
import { CENARIOS } from '../../../lib/origens';
import AvisoBanco from '../aviso-banco';
import Versoes from './versoes';
import { SomenteLeitura, exigeVer } from '../guarda';

export const metadata = { title: 'Habilitação de cenário/ano' };
export const dynamic = 'force-dynamic';

// =============================================================================
// HABILITAÇÃO DE CENÁRIO/ANO
//
// O orçamento é um CICLO, não um evento: começa em setembro, bate o martelo em
// novembro, e no meio são de 3 a 6 versões (migração 45). Esta tela é onde esse
// ciclo acontece:
//
//     sem versão --[Abrir]--> vN aberta --[Fechar]--> vN fechada
//                                  ^                       |
//                                  +-------[Abrir v(N+1)]--+
//
// Fechar tira a FOTOGRAFIA mensal — é o que torna "o que mudou da v3 para a v4"
// uma pergunta respondível. Sem ela, a rodada nova apaga a velha e a comparação
// não existe.
//
// O CHECKLIST DE PRONTIDÃO aparece para todo ano, aberto ou não. Ele nasceu de
// um caso concreto: 2028 tinha 6 exceções de calendário na Matriz contra 41 de
// 2027. Quem abrisse teria ~35 feriados virando dia útil e a capacidade sairia
// inflada sem erro, sem aviso e sem nada denunciando.
// =============================================================================

export default async function Page({ searchParams }) {
  const negado = await exigeVer('habilitacao');
  if (negado) return negado;

  let lista;
  let anos;
  try {
    [lista, anos] = await Promise.all([
      versoes(),
      anosComRodada().then((a) => anosParaEscolha(a)),
    ]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  // O ano em foco decide de qual ano o checklist é lido — ele é por ANO (os
  // feriados são de um ano) e por planta. Sem um escolhido, o primeiro sem
  // versão aberta em cenário nenhum, que é o que a pessoa veio abrir.
  const semVersao = anos.filter(
    (a) => !CENARIOS.some((c) => versaoAberta(lista, c.codigo, a)));
  const pedido = Number(searchParams?.ano);
  const anoFoco = anos.includes(pedido) ? pedido
    : (semVersao[0] ?? anos[anos.length - 1]);

  // O checklist e o progresso das versões abertas, em paralelo: são
  // independentes, e em série pagariam dois round trips (o driver do Neon faz
  // uma requisição por instrução).
  const abertas = CENARIOS
    .map((c) => versaoAberta(lista, c.codigo, anoFoco))
    .filter(Boolean);

  const [bruto, ...progressos] = await Promise.all([
    prontidaoBruta(anoFoco),
    ...abertas.map((v) => progressoDaVersao(v.id)),
  ]);

  const prontidao = bruto.map((p) => ({
    planta_id: p.planta_id,
    planta: p.planta,
    itens: prontidaoDaPlanta({
      calendarios: Number(p.calendarios),
      calendariosSemDia: Number(p.calendarios_sem_dia),
      excecoesDoAno: Number(p.excecoes_do_ano),
      excecoesDoAnoAnterior: Number(p.excecoes_do_ano_anterior),
      turnosAtivos: Number(p.turnos_ativos),
      turnosSemHorario: Number(p.turnos_sem_horario),
    }, anoFoco),
  }));

  // O progresso de cada versão aberta, resumido: quantas áreas terminaram.
  const resumo = {};
  abertas.forEach((v, i) => {
    const areas = progressos[i] ?? [];
    const prontas = areas.filter(
      (a) => progresso(v.passos_exigidos, a.feitos).completo).length;
    resumo[v.id] = { areas: areas.length, prontas };
  });

  return (
    <>
      <SomenteLeitura tela="habilitacao" />
      <div className="topo">
        <h1 className="titulo">Habilitação de cenário/ano</h1>
      </div>

      <Versoes
        versoes={lista.map((v) => ({
          id: v.id,
          origem: v.origem,
          ano: Number(v.ano),
          numero: v.numero,
          rotulo: v.rotulo,
          passos_exigidos: v.passos_exigidos,
          aberta_em: v.aberta_em,
          fechada_em: v.fechada_em,
          aberta_por_nome: v.aberta_por_nome,
          fechada_por_nome: v.fechada_por_nome,
          fotos: Number(v.fotos),
          observacao: v.observacao,
        }))}
        anos={anos}
        anoFoco={anoFoco}
        cenarios={CENARIOS}
        passos={PASSOS}
        prontidao={prontidao}
        resumo={resumo} />
    </>
  );
}
