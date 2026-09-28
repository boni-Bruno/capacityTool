import { produtos } from '../../../../lib/ticket-formato';
import { exigeVer, podeEditarTela } from '../../guarda';
import Formulario from './formulario';

export const metadata = { title: 'Criar ticket' };
export const dynamic = 'force-dynamic';

// =============================================================================
// CRIAR TICKET
//
// O canal de quem usa a ferramenta: dúvida, sugestão ou defeito, sobre a
// ferramenta toda ou sobre uma tela. Não consulta o banco para abrir — só a
// lista de produtos, que é código (lib/ticket-formato.js).
// =============================================================================

export default async function Page() {
  const negado = await exigeVer('ticket_novo');
  if (negado) return negado;

  return (
    <>
      <div className="topo">
        <h1 className="titulo">Criar ticket</h1>
      </div>
      <Formulario produtos={produtos()} podeEnviar={await podeEditarTela('ticket_novo')} />
    </>
  );
}
