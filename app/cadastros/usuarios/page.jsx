import { cargos, usuarios } from '../../../lib/acesso';
import { areas } from '../../../lib/db';
import { plantasCadastro } from '../../../lib/estrutura';
import { sessaoAtual } from '../../../lib/sessao';
import { exigeVer } from '../guarda';
import AvisoBanco from '../aviso-banco';
import Usuarios from './usuarios';

export const metadata = { title: 'Usuários' };
export const dynamic = 'force-dynamic';

// =============================================================================
// USUÁRIOS
//
// Quem entra: login, nome, e-mail (é por ele que o Hub S&OP reconhece a
// pessoa), cargo e escopo — as plantas e áreas que a pessoa atende. Convidar
// é criar com uma senha inicial que a pessoa troca no primeiro acesso.
//
// Usuário não se apaga: desativa. Quem convidou e quando entrou é a história
// de quem mexeu na fábrica, e apagar a linha apagaria a resposta.
// =============================================================================

export default async function Page() {
  const negado = await exigeVer('usuarios');
  if (negado) return negado;

  let lista;
  let listaCargos;
  let listaAreas;
  let listaPlantas;
  try {
    [lista, listaCargos, listaAreas, listaPlantas] = await Promise.all([
      usuarios(), cargos(), areas(), plantasCadastro(),
    ]);
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }
  const s = await sessaoAtual();

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Usuários</h1>
      </div>
      <Usuarios usuarios={lista.map((u) => ({
                  ...u,
                  // json_agg volta parseado pelo driver; texto é a rede.
                  escopo: typeof u.escopo === 'string' ? JSON.parse(u.escopo) : (u.escopo ?? []),
                }))}
                cargos={listaCargos}
                plantas={listaPlantas.filter((p) => p.ativo !== false)
                  .map((p) => ({ id: p.id, nome: p.nome }))}
                areas={listaAreas.map((a) => ({ id: a.id, nome: a.nome, planta_id: a.planta_id }))}
                euId={s?.tipo === 'usuario' ? s.id : null} />
    </>
  );
}
