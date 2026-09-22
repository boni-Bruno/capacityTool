import Link from 'next/link';
import Shell from './shell';
import { sessaoAtual } from '../lib/sessao';
import { TUDO, gruposDoMenu } from '../lib/permissoes';

export const dynamic = 'force-dynamic';

// Menu. É a porta de entrada do app, então não consulta o banco de propósito:
// se a DATABASE_URL cair, esta tela ainda abre e explica onde ir. Uma landing
// page que depende do banco falha justamente na hora em que você precisa dela.

// O texto de cada cartão, pelo endereço. A ORDEM e os GRUPOS vêm de
// lib/permissoes.js — a mesma lista do menu lateral e da grade de cargos —
// e só entram os cartões que a pessoa pode ver.
const TEXTOS = {
  '/painel':
    'Quanto cabe: instalada, planejada e disponível por área e ano, em ' +
    'minuto, hora, metro ou peça. Gráfico mensal e tabela por recurso.',
  '/ocupacao':
    'Cabe? A capacidade contra a demanda do plano, em minuto — barras ' +
    'de capacidade com a demanda em linha por cima.',
  '/cadastros/plantas': 'As unidades fabris. Toda área pertence a uma planta.',
  '/cadastros/areas':
    'Os setores de cada planta. A planta é escolhida na criação e não ' +
    'muda depois.',
  '/cadastros/recursos':
    'As máquinas e postos. CC, CT e Patrimônio identificam o ' +
    'equipamento na controladoria.',
  '/cadastros/turnos':
    'Criar e excluir turnos, e definir início e fim de cada um por dia ' +
    'da semana. Turno novo nasce com a semana zerada.',
  '/cadastros/calendarios':
    'Os dias em que cada linha trabalha: turnos por dia da semana, ' +
    'feriados e paradas, e a contagem de dias úteis do ano.',
  '/cadastros/turnos-do-recurso':
    'Quais turnos cada recurso roda em cada mês, e o regime de dias ' +
    '(rodízio ou padrão).',
  '/cadastros/oee':
    'O rendimento que transforma capacidade planejada em disponível, ' +
    'mês a mês. Setup já está embutido aqui.',
  '/cadastros/paradas':
    'Preventiva, preditiva, férias coletivas, obra e inventário. ' +
    'Muda toda semana.',
  '/cadastros/demanda':
    'A base orçada importada da controladoria. É ela que diz quanto de ' +
    'cada centro de trabalho o plano pede, e em que ritmo.',
  '/cadastros/de-para':
    'A lingua da base traduzida para a da empresa: rotulos e ' +
    'agrupamentos por regra, com a previa de quanto cada uma pega.',
  '/cadastros/mix':
    'O mix calculado da carga, ajustavel a mao por CT e mes. Onde ' +
    'existe ajuste, ele ganha da base — e importar nao mexe nele.',
  '/cadastros/extracao-ap':
    'A capacidade calculada em .csv — CT, período AAAA.MM e minutos, ' +
    'condensada por mês, com prévia antes de baixar.',
  '/cadastros/extracao-config':
    'Como a fábrica está configurada num recorte, e quanta capacidade ' +
    'isso produz. Em .pptx dentro do seu modelo, ou em PDF.',
  '/cadastros/extracao-simulador':
    'O disponível de cada CT aberto em unidades por dia, minutos, dias ' +
    'úteis e OEE, contra a demanda de um cenário. Em .xlsx com fórmulas.',
  '/cadastros/usuarios':
    'Quem entra: login, cargo e as plantas e áreas que a pessoa atende. ' +
    'Convidar, redefinir senha, desativar.',
  '/cadastros/cargos':
    'O que cada cargo pode: ver ou editar, tela a tela, e recalcular.',
};
function Cartao({ href, titulo, texto }) {
  return (
    <Link href={href} className="menu-card">
      <span className="menu-card-tit">{titulo}</span>
      <span className="menu-card-txt">{texto}</span>
    </Link>
  );
}

export default async function Menu() {
  // A sessão decide quais cartões aparecem. Se o banco cair, esta tela ainda
  // abre — com tudo: os cartões levam a telas que vão avisar do banco, e uma
  // porta de entrada em branco não explicaria nada.
  let perms = TUDO;
  let tipo = null;
  try {
    const s = await sessaoAtual();
    if (s) { perms = s.perms; tipo = s.tipo; }
  } catch {
    perms = TUDO;
  }
  const grupos = gruposDoMenu(perms);

  return (
    <Shell>
      <header className="menu-topo">
        <h1 className="menu-marca">Capacidade</h1>
        <p className="menu-sub">Planejamento de capacidade fabril</p>
      </header>

      {grupos.map((g) => (
        <div key={g.nome}>
          <h2 className="menu-secao">{g.nome}</h2>
          <div className="menu-grade">
            {g.itens.map((i) => (
              <Cartao key={i.href} href={i.href} titulo={i.rotulo}
                      texto={TEXTOS[i.href] ?? ''} />
            ))}
          </div>
        </div>
      ))}

      {tipo === 'nenhum' && (
        <div className="aviso">
          <strong>Você ainda não tem usuário nesta ferramenta.</strong>
          <p style={{ margin: '8px 0 0' }}>
            Peça ao gestor de planejamento que cadastre você — com o cargo e
            as fábricas que você atende.
          </p>
        </div>
      )}
      {tipo !== 'nenhum' && !grupos.length && (
        <p className="vazio">Seu cargo não dá acesso a nenhuma tela ainda.</p>
      )}

      <p className="rodape">
        Ainda não têm tela: tipos de parada.
      </p>
    </Shell>
  );
}
