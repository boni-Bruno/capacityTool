'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EnviarDemanda from '../cadastros/demanda/enviar';

// A base de demanda deste painel, e o recorte de datas.
//
// A CARGA É ESCOLHIDA AQUI e pode não ser a corrente. A corrente serve à
// conversão em metro e vale para todo o sistema; a ocupação pode querer
// comparar contra outro cenário sem trocar o que todo mundo vê.
//
// O upload é o MESMO da tela de Demanda, e importa para as mesmas tabelas: a
// estrutura do arquivo é idêntica, e uma segunda cópia do mesmo dado divergiria
// da primeira no mês seguinte. Fica recolhido porque importar é raro e
// comparar é o dia a dia.

export default function FiltrosOcupacao({ cargas, carga, periodo, ano }) {
  const router = useRouter();
  const params = useSearchParams();
  const [importar, setImportar] = useState(false);

  const muda = (mudancas) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === '' || v === null) p.delete(k); else p.set(k, v);
    }
    router.push(`?${p.toString()}`);
  };

  const limDe = `${ano}-01-01`;
  const limAte = `${ano}-12-31`;
  const recortado = periodo && !periodo.anoInteiro;

  return (
    <>
      <div className="filtros">
        <label className="campo">
          <span className="campo-rot">Base de demanda</span>
          <select value={carga ?? ''}
                  onChange={(e) => muda({ carga: e.target.value })}>
            {cargas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cenario}{c.corrente ? ' · no ar' : ''}
              </option>
            ))}
          </select>
        </label>

        {periodo && (
          <>
            <label className="campo-inline">
              <span className="campo-rot">De</span>
              <input type="date" value={periodo.de} min={limDe} max={limAte}
                     onChange={(e) => muda({ de: e.target.value })} />
            </label>
            <label className="campo-inline">
              <span className="campo-rot">Até</span>
              <input type="date" value={periodo.ate} min={limDe} max={limAte}
                     onChange={(e) => muda({ ate: e.target.value })} />
            </label>
            {recortado && (
              <button className="btn btn-mini"
                      onClick={() => muda({ de: '', ate: '' })}
                      title="Voltar ao ano inteiro">
                Ano todo
              </button>
            )}
          </>
        )}

        <button className="btn btn-mini" onClick={() => setImportar(!importar)}>
          {importar ? 'fechar' : 'importar base'}
        </button>
      </div>

      {importar && (
        <div style={{ flexBasis: '100%', marginTop: 12 }}>
          <EnviarDemanda recursosCadastrados={[]} />
          <p className="rodape">
            É o mesmo arquivo e as mesmas tabelas da tela de Demanda — importar
            aqui não cria uma segunda base. A carga nasce fora do ar; escolha-a
            no seletor acima para compará-la, ou marque-a como corrente na tela
            de Demanda para ela passar a valer também na conversão em metro.
          </p>
        </div>
      )}
    </>
  );
}
