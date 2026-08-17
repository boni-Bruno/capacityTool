import { sql } from '../../../lib/db';
import {
  cargas, cargaCorrente, resumoCarga, demandaSemCapacidade, capacidadeSemDemanda,
  indicePorCt, ctsOrfaos, ctsDoadores, ctsComDemanda,
} from '../../../lib/demanda';
import AvisoBanco from '../aviso-banco';
import EnviarDemanda from './enviar';
import Cargas from './cargas';
import OrigemDoIndice from './origem';

export const dynamic = 'force-dynamic';

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
  const [semCap, semDem, indice, orfaos, doadores, comDemanda] = corrente
    ? await Promise.all([
        demandaSemCapacidade(corrente.id), capacidadeSemDemanda(corrente.id),
        indicePorCt(corrente.id), ctsOrfaos(corrente.id),
        ctsDoadores(corrente.id), ctsComDemanda(corrente.id),
      ])
    : [[], [], [], [], [], []];

  const cobertura = resumo && Number(resumo.horas)
    ? (Number(resumo.casados.horas) * 100 / Number(resumo.horas)) : 0;

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Demanda</h1>
      </div>

      <EnviarDemanda recursosCadastrados={cts} />

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

          {semCap.length > 0 && (
            <>
              <p className="campo-rot" style={{ marginTop: 6 }}>
                Demanda sem capacidade — {fmt(semCap.length)} centros de trabalho
              </p>
              <div className="grade-rolagem">
                <table>
                  <thead>
                    <tr>
                      <th>CT</th>
                      <th className="num">Horas</th>
                      <th className="num">Linhas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semCap.map((x) => (
                      <tr key={x.ct}>
                        <td><code>{x.ct}</code></td>
                        <td className="num">{fmt(x.horas)}</td>
                        <td className="num muted">{fmt(x.linhas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="rodape">
                Ordenada por peso: é a fila do que falta cadastrar. Nada aqui é
                erro, e nada precisa ser reimportado — o vínculo é o{' '}
                <code>CC-CT</code> da máquina física e é resolvido na leitura,
                então cada recurso que você cadastrar faz a linha correspondente
                passar a valer sozinha.
              </p>
            </>
          )}

          {semDem.length > 0 && (
            <>
              <p className="campo-rot" style={{ marginTop: 14 }}>
                Capacidade sem demanda — {fmt(semDem.length)} centros de trabalho
              </p>
              <div className="grade-rolagem">
                <table>
                  <thead>
                    <tr>
                      <th>CT</th>
                      <th className="num">Recursos</th>
                      <th>Máquinas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semDem.map((x) => (
                      <tr key={x.ct}>
                        <td><code>{x.ct}</code></td>
                        <td className="num">{fmt(x.recursos)}</td>
                        <td className="muted">{x.maquinas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="rodape">
                Máquina cadastrada que o plano não usa. Pode ser numeração a
                acertar, ou recurso que realmente não entra neste cenário —
                nenhum dos dois é defeito.
              </p>
            </>
          )}

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
        <OrigemDoIndice cargaId={corrente.id} orfaos={orfaos}
                        doadores={doadores} comDemanda={comDemanda} />
      )}

      {indice.length > 0 && (
        <div className="painel">
          <h2>Índice de conversão</h2>
          <p className="rodape" style={{ margin: '0 0 12px' }}>
            Quanto cada centro de trabalho produz por hora de capacidade, no
            plano desta carga. É a <strong>soma da quantidade dividida pela soma
            dos minutos</strong> — o mix entra ponderado sozinho, cada material
            pelo tempo que ele ocupa.
            {' '}Ponderar as taxas pela participação em quantidade, que é o erro
            natural, infla a capacidade: o produto lento come mais tempo do que
            a quantidade sugere.
          </p>

          <div className="grade-rolagem">
            <table>
              <thead>
                <tr>
                  <th>CT</th>
                  <th>Unidade</th>
                  <th className="num">Demanda (h)</th>
                  <th className="num">m/h de tecelagem</th>
                  <th className="num">UM do material /h</th>
                  <th className="num">Meses</th>
                  <th>Recurso</th>
                </tr>
              </thead>
              <tbody>
                {indice.map((x) => (
                  <tr key={x.ct} className={x.tem_recurso ? '' : 'linha-vazia'}>
                    <td><code>{x.ct}</code></td>
                    <td>
                      <span className={'selo ' + (x.unidade === 'KG' ? 'padrao' : 'rodizio')}>
                        {x.unidade === 'KG' ? 'kg · fiação' : 'metro'}
                      </span>
                    </td>
                    <td className="num">{fmt(x.horas)}</td>
                    <td className="num forte">{fmt(x.metros_por_hora)}</td>
                    <td className="num muted">{fmt(x.qtd_por_hora)}</td>
                    <td className="num muted">{fmt(x.meses)}</td>
                    <td className="muted">
                      {x.tem_recurso ? 'cadastrado' : 'falta cadastrar'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rodape">
            <strong>Conferência de sanidade:</strong> tear de felpudo fica na
            casa de 11 a 51 m/h. Número muito fora disso costuma ser CT com
            roteiro em outra unidade, não erro de conta.
            {' '}Linha em cinza é CT sem recurso cadastrado: o índice existe e
            está certo, só não tem em que capacidade se apoiar ainda.
            {' '}A coluna <strong>m/h de tecelagem</strong> é a régua comum da
            fábrica; a de <strong>UM do material</strong> conta peça, jogo ou
            metro de produto, e por isso não soma entre CTs diferentes.
          </p>
        </div>
      )}

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
    </>
  );
}
