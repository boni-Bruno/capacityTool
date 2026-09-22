import { cargos } from '../../../lib/acesso';
import { AVULSAS, TELAS } from '../../../lib/permissoes';
import { exigeVer } from '../guarda';
import AvisoBanco from '../aviso-banco';
import Cargos from './cargos';

export const metadata = { title: 'Cargos' };
export const dynamic = 'force-dynamic';

// =============================================================================
// CARGOS
//
// O que cada cargo pode: uma grade telas × ver/editar, mais Recalcular. O
// Gestor de Planejamento é protegido — tem tudo sem marcar nada — e por isso
// nem oferece a grade: a garantia de que sempre existe um cargo que pode
// tudo não pode depender de ninguém lembrar de marcar uma linha.
// =============================================================================

export default async function Page() {
  const negado = await exigeVer('cargos');
  if (negado) return negado;

  let lista;
  try {
    lista = await cargos();
  } catch (e) {
    return <AvisoBanco erro={e.message} />;
  }

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Cargos</h1>
      </div>
      <Cargos cargos={lista}
              telas={TELAS.map((t) => ({ codigo: t.codigo, rotulo: t.rotulo, grupo: t.grupo }))}
              avulsas={AVULSAS} />
    </>
  );
}
