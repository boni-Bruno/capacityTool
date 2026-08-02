import { Suspense } from 'react';
import {
  plantasCadastro, areasDaPlanta, recursosDaArea,
} from '../../../lib/estrutura';
import AvisoBanco from '../aviso-banco';
import Cadastro from './cadastro';

export const dynamic = 'force-dynamic';

const TIPOS = [
  { valor: 'MAQUINA', rotulo: 'máquina' },
  { valor: 'PESSOA',  rotulo: 'pessoa' },
];

export default async function Page({ searchParams }) {
  let plantas;
  try {
    plantas = await plantasCadastro();
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  const plantaPedida = Number(searchParams?.planta);
  const planta = plantas.find((p) => p.id === plantaPedida)
              ?? plantas.find((p) => p.ativo)
              ?? plantas[0]
              ?? null;

  const areas = planta ? await areasDaPlanta(planta.id) : [];
  const areaPedida = Number(searchParams?.area);
  const area = areas.find((a) => a.id === areaPedida)
            ?? areas.find((a) => a.ativo)
            ?? areas[0]
            ?? null;

  const recursos = area ? await recursosDaArea(area.id) : [];

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Planta, área e recurso</h1>
      </div>

      <div className="painel">
        <div className="painel-topo">
          <h2>Plantas</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            clique numa planta para ver as áreas dela
          </span>
        </div>
        <Cadastro
          rota="/api/cadastro/planta"
          itens={plantas}
          selecionado={planta?.id ?? null}
          paramSelecao="planta"
          podeReativar
          rotuloNovo="Criar planta"
          vazio="Nenhuma planta cadastrada. Crie a primeira abaixo."
          campos={[
            { nome: 'codigo', rot: 'Código', placeholder: 'ex.: MATRIZ' },
            { nome: 'nome',   rot: 'Nome',   placeholder: 'ex.: Matriz' },
            { nome: 'timezone', rot: 'Fuso', placeholder: 'America/Sao_Paulo',
              padrao: 'America/Sao_Paulo', obrigatorio: false },
          ]}
        />
      </div>

      {planta && (
        <div className="painel">
          <div className="painel-topo">
            <h2>Áreas de {planta.nome}</h2>
            <span className="muted" style={{ fontSize: 12 }}>
              clique numa área para ver os recursos dela
            </span>
          </div>
          <Cadastro
            key={`area:${planta.id}`}
            rota="/api/cadastro/area"
            itens={areas}
            extras={{ planta_id: planta.id }}
            selecionado={area?.id ?? null}
            paramSelecao="area"
            podeReativar
            rotuloNovo="Criar área"
            vazio="Nenhuma área nesta planta. Crie a primeira abaixo."
            campos={[
              { nome: 'codigo', rot: 'Código', placeholder: 'ex.: CONFECCAO' },
              { nome: 'nome',   rot: 'Nome',   placeholder: 'ex.: Confecção' },
            ]}
          />
        </div>
      )}

      {area && (
        <div className="painel">
          <h2>Recursos de {area.nome}</h2>
          <Cadastro
            key={`recurso:${area.id}`}
            rota="/api/cadastro/recurso"
            itens={recursos}
            extras={{ area_id: area.id }}
            rotuloNovo="Criar recurso"
            vazio="Nenhum recurso nesta área. Crie o primeiro abaixo."
            campos={[
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
            CC, CT e Patrimônio identificam a máquina física na controladoria.
            A trinca é única dentro da planta — dois recursos com a mesma trinca
            passam a apontar para o mesmo equipamento, que é o caso de dois
            postos dividindo a mesma máquina.
            {' '}<strong>Tipo</strong> decide o intervalo de refeição: máquina
            não para para almoçar, pessoa para.
          </p>
        </div>
      )}
    </>
  );
}
