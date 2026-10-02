'use client';

import { useRef } from 'react';
import Formulario from './formulario';

// ABRIR TICKET, num pop-up dentro de Meus tickets.
//
// Até 02/10/2026 isto era uma tela própria no menu, e o resultado era abrir o
// chamado numa tela e esperar a resposta em outra — a mesma pessoa, no mesmo
// assunto, em dois lugares. Agora a lista e o formulário moram juntos: vejo os
// meus, abro um novo, corrijo o que escrevi.
//
// `<dialog>` do próprio navegador, como o das cores da ocupação: ele já traz o
// fundo escurecido, o Esc que fecha, o foco preso dentro e a devolução do foco
// ao sair. Refazer isso à mão é refazer errado.
//
// O botão aparece para quem PODE abrir. Quem só vê os seus chamados não leva um
// botão que o servidor vai recusar — e a lista continua ali, que é o que
// interessa a quem só acompanha.

export default function Abrir({ produtos, podeEnviar }) {
  const dialogo = useRef(null);

  if (!podeEnviar) return null;

  return (
    <>
      <button type="button" className="btn btn-primario"
              onClick={() => dialogo.current?.showModal()}>
        Abrir ticket
      </button>

      <dialog ref={dialogo} className="pop">
        <h3>Abrir um ticket</h3>
        <Formulario produtos={produtos} podeEnviar
                    // Fecha sozinho quando o chamado entra: a confirmação de
                    // verdade é a linha nova no topo da lista, atrás do pop-up,
                    // e deixá-lo aberto sobre ela esconderia o que ele fez.
                    aoEnviar={() => dialogo.current?.close()} />
        <div className="acoes" style={{ marginTop: 4 }}>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn"
                  onClick={() => dialogo.current?.close()}>
            Fechar
          </button>
        </div>
      </dialog>
    </>
  );
}
