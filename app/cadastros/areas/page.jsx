import { areasCadastro, plantasParaEscolha } from '../../../lib/estrutura';
import AvisoBanco from '../aviso-banco';
import Cadastro from '../cadastro';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let areas, plantas;
  try {
    [areas, plantas] = await Promise.all([areasCadastro(), plantasParaEscolha()]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  if (!plantas.length) {
    return (
      <>
        <div className="topo"><h1 className="titulo">Áreas</h1></div>
        <div className="aviso">
          <strong>Nenhuma planta ativa.</strong>
          <p style={{ margin: '8px 0 0' }}>
            Toda área pertence a uma planta. Cadastre a planta primeiro.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Áreas</h1>
      </div>

      <div className="painel">
        <Cadastro
          rota="/api/cadastro/area"
          itens={areas}
          podeReativar
          rotuloNovo="Criar área"
          vazio="Nenhuma área cadastrada. Crie a primeira abaixo."
          campos={[
            // O vínculo é escolha explícita do formulário, não herança de uma
            // seleção feita em outro painel: dá para não reparar em qual planta
            // se está e cadastrar a área no lugar errado.
            { nome: 'planta_id', rot: 'Planta', tipo: 'select', col: 'planta',
              soCriacao: true,
              opcoes: plantas.map((p) => ({ valor: p.id, rotulo: p.nome })) },
            { nome: 'codigo',   rot: 'Código',   placeholder: 'ex.: CONFECCAO' },
            { nome: 'nome',     rot: 'Nome',     placeholder: 'ex.: Confecção' },
            { nome: 'recursos', rot: 'Recursos', soLeitura: true },
          ]}
        />
        <p className="rodape">
          A planta é definida na criação e não muda depois — mover uma área de
          planta levaria junto todos os recursos dela. Área que já tem recurso é
          desativada em vez de apagada.
        </p>
      </div>
    </>
  );
}
