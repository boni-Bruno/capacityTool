import { sql } from '../../../lib/db';
import {
  atributos, cargas, cargaCorrente, combinacoesDaCarga, ctsCadastro,
  ctsComDemanda, ctsDoadores, ctsOrfaos, capacidadeSemDemanda,
  demandaSemCapacidade, indicePorCt, resumoCarga, todasAsRegras,
} from '../../../lib/demanda';
import AvisoBanco from '../aviso-banco';
import EnviarDemanda from './enviar';
import Cargas from './cargas';
import Explorar from './explorar';

export const dynamic = 'force-dynamic';

// A ORDEM DA PÁGINA É A ORDEM DO TRABALHO: importar, decidir qual carga está no
// ar, conferir o que ela cobre — e só então explorar os dados. As quatro
// tabelas de dados moram num quadrante só, escolhidas por botão, porque
// empilhadas elas faziam a tela virar um poço de rolagem.

const fmt = (n) => Number(n ?? 0).toLocaleString('pt-BR');

// Os CC-CT que existem no cadastro, para a tela conferir o casamento antes de
// gravar. É a mesma regra do servidor — o vínculo é derivado da máquina física,
// sem tabela de-para.
async function ctsCadastrados() {
  const r = await sql`
    select distinct m.cc || '-' || m.ct as ct
      from recurso r
      join maquina_fisica m on m.id = r.maquina_fisica_id
     order by 1`;
  return r.map((x) => x.ct);
}

export default async function Page() {
  let lista;
  let corrente;
  let cts;
  try {
    [lista, corrente, cts] = await Promise.all([
      cargas(), cargaCorrente(), ctsCadastrados(),
    ]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  const resumo = corrente ? await resumoCarga(corrente.id) : null;
  const [semCap, semDem, indice, orfaos, doadores, comDemanda,
         combinacoes, attrs, regras, cadastro] = corrente
    ? await Promise.all([
        demandaSemCapacidade(corrente.id), capacidadeSemDemanda(corrente.id),
        indicePorCt(corrente.id), ctsOrfaos(corrente.id),
        ctsDoadores(corrente.id), ctsComDemanda(corrente.id),
        combinacoesDaCarga(corrente.id), atributos(), todasAsRegras(),
        ctsCadastro(),
      ])
    : [[], [], [], [], [], [], [], [], [], []];

  const cobertura = resumo && Number(resumo.horas)
    ? (Number(resumo.casados.horas) * 100 / Number(resumo.horas)) : 0;

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Demanda</h1>
      </div>

      <EnviarDemanda recursosCadastrados={cts} />

      <Cargas itens={lista} />

      {!corrente && lista.length > 0 && (
        <div className="aviso">
          <strong>Nenhuma carga no ar.</strong>
          <p style={{ margin: '8px 0 0' }}>
            Existem cargas importadas, mas nenhuma marcada. Marque uma na lista
            acima — é ela que o painel vai usar para converter capacidade.
          </p>
        </div>
      )}

      {corrente && resumo && (
        <div className="painel">
          <h2>
            Conferência da carga no ar
            <span className="muted" style={{ fontWeight: 400 }}>
              {' '}· {corrente.cenario}
            </span>
          </h2>

          <div className="kpis">
            <div className="kpi">
              <p className="rot">Demanda</p>
              <p className="val">{fmt(resumo.horas)} h</p>
              <p className="sub">
                {resumo.periodo_de} a {resumo.periodo_ate} · {fmt(resumo.total)} linhas
              </p>
            </div>
            <div className="kpi">
              <p className="rot">Com recurso cadastrado</p>
              <p className="val">{fmt(resumo.casados.horas)} h</p>
              <p className="sub">
                {cobertura.toFixed(1)}% da demanda · {fmt(resumo.casados.cts)} de{' '}
                {fmt(resumo.cts)} centros
              </p>
            </div>
            <div className="kpi">
              <p className="rot">Sem CT</p>
              <p className="val">{fmt(resumo.sem_ct)}</p>
              <p className="sub">comprado ou revenda, sem duração</p>
            </div>
          </div>

          {resumo.sem_tempo > 0 && (
            <p className="rodape">
              <strong>{fmt(resumo.sem_tempo)} linha(s) com quantidade e sem
              tempo de roteiro.</strong> Elas não conseguem virar capacidade
              convertida, porque a conversão sai de quantidade dividida por
              minutos.
            </p>
          )}
        </div>
      )}

      {corrente && (
        <Explorar cargaId={corrente.id} semCap={semCap} semDem={semDem}
                  indice={indice} orfaos={orfaos} doadores={doadores}
                  comDemanda={comDemanda} combinacoes={combinacoes}
                  atributos={attrs} regras={regras} cadastro={cadastro} />
      )}
    </>
  );
}
