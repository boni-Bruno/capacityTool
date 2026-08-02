import { recursosCadastro, areasParaEscolha } from '../../../lib/estrutura';
import AvisoBanco from '../aviso-banco';
import Cadastro from '../cadastro';

export const dynamic = 'force-dynamic';

const TIPOS = [
  { valor: 'MAQUINA', rotulo: 'máquina' },
  { valor: 'PESSOA',  rotulo: 'pessoa' },
];

export default async function Page() {
  let recursos, areas;
  try {
    [recursos, areas] = await Promise.all([recursosCadastro(), areasParaEscolha()]);
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

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Recursos</h1>
      </div>

      <div className="painel">
        <Cadastro
          rota="/api/cadastro/recurso"
          itens={recursos}
          rotuloNovo="Criar recurso"
          vazio="Nenhum recurso cadastrado. Crie o primeiro abaixo."
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
            { nome: 'tipo_recurso', rot: 'Tipo', tipo: 'select',
              opcoes: TIPOS, padrao: 'MAQUINA' },
            { nome: 'cc',         rot: 'CC',         placeholder: 'centro de custo' },
            { nome: 'ct',         rot: 'CT',         placeholder: 'centro de trabalho' },
            { nome: 'patrimonio', rot: 'Patrimônio', placeholder: 'nº do bem' },
          ]}
        />
        <p className="rodape">
          CC, CT e Patrimônio identificam a máquina física na controladoria. A
          trinca é única dentro da planta — dois recursos com a mesma trinca
          passam a apontar para o mesmo equipamento, que é o caso de dois postos
          dividindo a mesma máquina.
          {' '}<strong>Tipo</strong> decide o intervalo de refeição: máquina não
          para para almoçar, pessoa para.
        </p>
      </div>
    </>
  );
}
