'use client';

import { useState } from 'react';

// A PORTA DO LOTE.
//
// Cadastrar em lote reescreve o ano de dezenas de recursos. O aviso disso não
// pode ser um cartaz ao lado do formulário: quem chega já vê a matriz, marca o
// que quer e clica — o texto fica no canto do olho e nunca é lido. Foi o que
// aconteceu na primeira versão.
//
// Então ele é uma PORTA: primeiro a explicação, sozinha na tela, e o formulário
// só existe depois do clique. Não é para atrapalhar quem já sabe — é um clique —
// mas é para que ninguém aplique em 48 recursos sem ter passado por aqui.
//
// E DEPOIS DE ABERTA A MENSAGEM SOME. Aviso que continua na tela depois de lido
// vira ruído, e ruído é o que treina a pessoa a não ler o próximo. Fica uma
// linha discreta com o que precisa continuar valendo.
export default function Ciente({ titulo, aviso, resumo, botao, children }) {
  const [aberto, setAberto] = useState(false);

  if (aberto) {
    return (
      <>
        {resumo && (
          <p className="rodape" style={{ marginTop: 0 }}>{resumo}</p>
        )}
        {children}
      </>
    );
  }

  return (
    <div className="aviso">
      <strong>{titulo}</strong>
      {aviso}
      <div className="acoes" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primario"
                onClick={() => setAberto(true)}>
          {botao ?? 'OK, ciente'}
        </button>
        <span className="muted">o formulário aparece depois disto</span>
      </div>
    </div>
  );
}
