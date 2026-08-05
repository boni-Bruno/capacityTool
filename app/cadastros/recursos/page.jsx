import {
  recursosCadastro, areasParaEscolha, recursosDesativados,
} from '../../../lib/estrutura';
import AvisoBanco from '../aviso-banco';
import Cadastro from '../cadastro';
import { ordemGuardada } from '../../../lib/ordem-servidor';
import Definitivo from './definitivo';

export const dynamic = 'force-dynamic';

const TIPOS = [
  { valor: 'MAQUINA', rotulo: 'máquina' },
  { valor: 'PESSOA',  rotulo: 'pessoa' },
];

export default async function Page() {
  let recursos, areas, desativados;
  try {
    [recursos, areas, desativados] = await Promise.all([
      recursosCadastro(), areasParaEscolha(), recursosDesativados(),
    ]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  if (!areas.length) {
    return (
      <>
        <div className="topo"><h1 className="titulo">Recursos</h1></div>
        <div className="aviso">
          <strong>Nenhuma área ativa.</strong>
          <p style={{ margin: '8px 0 0' }}>
            Todo recurso pertence a uma área. Cadastre a área primeiro.
          </p>
        </div>
      </>
    );
  }

  const semParametro = recursos.filter((r) => r.sem_parametro);

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Recursos</h1>
      </div>

      <div className="painel">
        <Cadastro
          rota="/api/cadastro/recurso"
          itens={recursos}
          rotuloNovo="Adicionar recurso"
          selecaoMultipla
          podeAtivar
          vazio="Nenhum recurso cadastrado. Crie o primeiro abaixo."
          formularioSobDemanda
          filtrarColunas
          entidade="recurso"
          ordemInicial={ordemGuardada('recurso')}
          campos={[
            { nome: 'area_id', rot: 'Área', tipo: 'select', col: 'area',
              soCriacao: true,
              // A planta aparece junto porque duas áreas de plantas diferentes
              // podem ter nomes parecidos.
              opcoes: areas.map((a) => ({
                valor: a.id, rotulo: `${a.planta} · ${a.nome}`,
              })) },
            // Montado a partir de CC-CT-Patrimônio, não digitado: é a
            // identidade da máquina na controladoria, e deixar a pessoa
            // escrever à mão só criaria divergência entre os dois cadastros.
            { nome: 'codigo', rot: 'Código', soLeitura: true },
            { nome: 'nome',   rot: 'Nome',   placeholder: 'ex.: Texturizadeira 01' },
            // Texto solto, sem tabela: serve para agrupar na leitura, não tem
            // regra própria. Opcional.
            { nome: 'sub_area', rot: 'Sub-área', obrigatorio: false,
              placeholder: 'opcional' },
            { nome: 'tipo_recurso', rot: 'Tipo', tipo: 'select',
              opcoes: TIPOS, padrao: 'MAQUINA' },
            { nome: 'cc',         rot: 'CC',         placeholder: 'centro de custo' },
            { nome: 'ct',         rot: 'CT',         placeholder: 'centro de trabalho' },
            { nome: 'patrimonio', rot: 'Patrimônio', placeholder: 'nº do bem' },
            // Entram direto na fórmula: instalada = 1440 x qt x equivalência.
            { nome: 'qt_recursos',  rot: 'Qtd',          padrao: '1' },
            { nome: 'equivalencia', rot: 'Equivalência', padrao: '1' },
          ]}
        />

        {semParametro.length > 0 && (
          <div className="aviso" style={{ marginTop: 12 }}>
            <strong>
              {semParametro.length === 1
                ? 'Um recurso está sem parâmetro de capacidade'
                : `${semParametro.length} recursos estão sem parâmetro de capacidade`}
              : {semParametro.map((r) => r.nome).join(', ')}.
            </strong>
            <p style={{ margin: '6px 0 0' }}>
              Recurso sem essa linha é invisível para o motor — nem a instalada
              sai. Foi um defeito do cadastro, já corrigido: clique em
              <strong> Editar</strong> e <strong>Salvar</strong> em cada um para
              gerar o parâmetro, depois recalcule.
            </p>
          </div>
        )}
        <p className="rodape">
          CC, CT e Patrimônio identificam a máquina física na controladoria, e
          o <strong>Código</strong> do recurso é a trinca concatenada — não se
          digita, sai dos três campos. Por isso a trinca não se repete entre
          recursos: dois recursos com a mesma trinca teriam o mesmo código.
          {' '}Clicar no título de qualquer coluna ordena a tabela por ela, e a
          ordem escolhida fica guardada.
          {' '}<strong>Tipo</strong> decide o intervalo de refeição: máquina não
          para para almoçar, pessoa para.
          {' '}<strong>Sub-área</strong> é texto livre e opcional — serve para
          agrupar na leitura e não tem cadastro nem regra própria.
        </p>
        <p className="rodape">
          <strong>Ativo</strong> tira e devolve o recurso ao planejamento sem
          apagar nada: desligado, ele para de gerar capacidade no próximo
          Recalcular e some das telas de turno, OEE e parada — útil quando o
          recurso existe e opera, mas não entra no plano do ano.
          {' '}<strong>Excluir</strong> apaga de vez o que nunca entrou num
          cálculo; o que já entrou é apenas desativado, porque as rodadas
          antigas precisam continuar explicáveis. Se foi criado por engano, o
          painel abaixo apaga de vez.
        </p>
      </div>

      <Definitivo itens={desativados} />
    </>
  );
}
