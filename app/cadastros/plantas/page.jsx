import { plantasCadastro } from '../../../lib/estrutura';
import AvisoBanco from '../aviso-banco';
import Cadastro from '../cadastro';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let plantas;
  try {
    plantas = await plantasCadastro();
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Plantas</h1>
      </div>

      <div className="painel">
        <Cadastro
          rota="/api/cadastro/planta"
          itens={plantas}
          podeAtivar
          rotuloNovo="Criar planta"
          selecaoMultipla
          vazio="Nenhuma planta cadastrada. Crie a primeira abaixo."
          campos={[
            { nome: 'codigo', rot: 'Código', placeholder: 'ex.: MATRIZ' },
            { nome: 'nome',   rot: 'Nome',   placeholder: 'ex.: Matriz' },
            { nome: 'areas',  rot: 'Áreas',  soLeitura: true },
          ]}
        />
        <p className="rodape">
          <strong>Ativo</strong> tira a planta de circulação sem apagar nada:
          desligada, ela não aparece mais para receber área ou calendário novo.
          {' '}<strong>Excluir</strong> apaga de vez a que não tem área nenhuma;
          a que tem é apenas desativada, porque apagar arrancaria a referência
          de tudo que pende dela.
        </p>
      </div>
    </>
  );
}
