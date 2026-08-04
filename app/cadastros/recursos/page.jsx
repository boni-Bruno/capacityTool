import {
  recursosCadastro, areasParaEscolha, recursosDesativados,
} from '../../../lib/estrutura';
import AvisoBanco from '../aviso-banco';
import Cadastro from '../cadastro';
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
          podeReativar
          vazio="Nenhum recurso cadastrado. Crie o primeiro abaixo."
          formularioSobDemanda
          filtrarColunas
          campos={[
            { nome: 'area_id', rot: 'Área', tipo: 'select', col: 'area',
              soCriacao: true,
              // A planta aparece junto porque duas áreas de plantas diferentes
              // podem ter nomes parecidos.
              opcoes: areas.map((a) => ({
                valor: a.id, rotulo: `${a.planta} · ${a.nome}`,
              })) },
            { nome: 'codigo', rot: 'Código', placeholder: 'ex.: TEXPA-01' },
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
          CC, CT e Patrimônio identificam a máquina física na controladoria. A
          trinca é única dentro da planta — dois recursos com a mesma trinca
          passam a apontar para o mesmo equipamento, que é o caso de dois postos
          dividindo a mesma máquina.
          {' '}<strong>Tipo</strong> decide o intervalo de refeição: máquina não
          para para almoçar, pessoa para.
          {' '}<strong>Sub-área</strong> é texto livre e opcional — serve para
          agrupar na leitura e não tem cadastro nem regra própria.
        </p>
        <p className="rodape">
          <strong>Excluir</strong> apaga de vez o recurso que nunca entrou num
          cálculo. O que já entrou é <strong>desativado</strong>: sai do
          planejamento a partir do próximo Recalcular e some das telas de
          turno, OEE e parada, mas as rodadas antigas continuam explicáveis.
          Ele fica aqui em cinza, com Reativar — e se tiver sido criado por
          engano, dá para apagar de vez no painel abaixo.
        </p>
      </div>

      <Definitivo itens={desativados} />
    </>
  );
}
