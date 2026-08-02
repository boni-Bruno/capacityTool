import { Suspense } from 'react';
import { plantasParaEscolha } from '../../../lib/estrutura';
import { excecoesDoAno, calendariosDaPlanta, TIPOS } from '../../../lib/excecao';
import AvisoBanco from '../aviso-banco';
import Seletor from '../seletor';
import Ano from './ano';
import EditorExcecao from './editor';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  let plantas;
  try {
    plantas = await plantasParaEscolha();
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  if (!plantas.length) {
    return (
      <>
        <div className="topo"><h1 className="titulo">Feriados</h1></div>
        <div className="aviso">
          <strong>Nenhuma planta ativa.</strong>
          <p style={{ margin: '8px 0 0' }}>
            Feriado é cadastrado por planta — plantas em cidades diferentes têm
            feriados diferentes. Cadastre a planta primeiro.
          </p>
        </div>
      </>
    );
  }

  const plantaId = Number(searchParams?.planta ?? plantas[0].id);
  const planta = plantas.find((p) => p.id === plantaId) ?? plantas[0];
  const anoAtual = new Date().getFullYear();
  const ano = Number(searchParams?.ano ?? anoAtual);

  const [excecoes, calendarios] = await Promise.all([
    excecoesDoAno(planta.id, ano),
    calendariosDaPlanta(planta.id),
  ]);

  // Data escolhida na grade. Só aceita do ano aberto.
  const pedida = String(searchParams?.data ?? '');
  const data = /^\d{4}-\d{2}-\d{2}$/.test(pedida) && pedida.startsWith(`${ano}-`)
    ? pedida : null;
  const excecao = data ? excecoes.find((e) => e.data === data) ?? null : null;

  const url = (d) => {
    const p = new URLSearchParams();
    p.set('planta', String(planta.id));
    p.set('ano', String(ano));
    if (d) p.set('data', d);
    return '?' + p.toString();
  };

  const semCalendario = excecoes.filter((e) => !e.calendario_ids);

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Feriados e exceções</h1>
        <Suspense>
          <Seletor campos={[
            {
              nome: 'planta', rotulo: 'Planta', tipo: 'select',
              valor: String(planta.id),
              opcoes: plantas.map((p) => ({ valor: String(p.id), rotulo: p.nome })),
            },
            {
              nome: 'ano', rotulo: 'Ano', tipo: 'select', valor: String(ano),
              opcoes: [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2].map((a) => ({
                valor: String(a), rotulo: String(a),
              })),
            },
          ]} />
        </Suspense>
      </div>

      {calendarios.length === 0 ? (
        <div className="aviso">
          <strong>Esta planta não tem calendário.</strong>
          <p style={{ margin: '8px 0 0' }}>
            A exceção vale pelos calendários que a observam — sem calendário não
            há o que marcar. Cadastre em Estrutura › Calendários.
          </p>
        </div>
      ) : (
        <>
          <div className="painel">
            <div className="painel-topo">
              <h2>{planta.nome} · {ano}</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                clique num dia para cadastrar ou editar
              </span>
            </div>

            <Ano ano={ano} excecoes={excecoes} selecionada={data} href={url} />

            <p className="legenda">
              <span className="pino-leg dia-feriado" /> feriado
              <span className="pino-leg dia-parada_coletiva" /> parada coletiva
              <span className="pino-leg dia-extra" /> dia extraordinário
              <span className="pino-leg dia-domingo" /> domingo
            </p>
          </div>

          {data && (
            <div className="painel">
              <h2>
                {data.split('-').reverse().join('/')}
                {excecao && <span className="foco"> · já cadastrado</span>}
              </h2>
              <EditorExcecao
                key={`${data}:${excecao?.id ?? 'novo'}`}
                plantaId={planta.id}
                data={data}
                excecao={excecao}
                tipos={TIPOS}
                calendarios={calendarios}
              />
            </div>
          )}

          <div className="painel">
            <h2>Cadastrados em {ano} ({excecoes.length})</h2>
            {excecoes.length === 0 ? (
              <p className="muted">
                Nenhuma exceção neste ano. Sem feriado cadastrado, o motor trata
                todo dia do calendário como dia normal de trabalho.
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Calendários que observam</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {excecoes.map((e) => (
                    <tr key={e.id}>
                      <td>{e.data.split('-').reverse().join('/')}</td>
                      <td>
                        <span className={'selo ' + (e.dia_util ? 'rodizio' : 'padrao')}>
                          {TIPOS.find((t) => t.valor === e.tipo)?.rotulo ?? e.tipo}
                        </span>
                      </td>
                      <td>{e.descricao}</td>
                      <td className={e.calendarios ? '' : 'muted'}>
                        {e.calendarios ?? 'nenhum — não vale para ninguém'}
                      </td>
                      <td className="acoes">
                        <a className="btn btn-mini" href={url(e.data)}>Abrir</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {semCalendario.length > 0 && (
              <div className="aviso" style={{ marginTop: 12 }}>
                <strong>
                  {semCalendario.length} exceção(ões) sem calendário marcado.
                </strong>
                <p style={{ margin: '6px 0 0' }}>
                  O motor aplica a exceção pelo vínculo com o calendário. Sem
                  nenhum marcado, a data está cadastrada mas não muda nada no
                  cálculo.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
