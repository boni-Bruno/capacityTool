import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS, TIPOS, TIPO_PADRAO, TUDO, limpaTicket, motivoParaNaoEditar,
  podeEditarTicket, produtos, rotuloDoProduto, rotuloDoTipo, statusDe, tipo,
  validaTicket,
} from './ticket-formato.js';
import { TELAS } from './permissoes.js';

const BOM = {
  produto: 'oee', tipo: 'BUG', resumo: 'A tela de OEE não salva março',
  descricao: 'Digitei 80 em março, cliquei em Salvar e o campo voltou vazio.',
};

test('a lista de produtos sai do menu: a ferramenta toda, cada grupo e cada tela', () => {
  const p = produtos();
  assert.equal(p[0].codigo, TUDO);
  assert.equal(p[0].rotulo, 'Ferramenta toda');
  const grupos = [...new Set(TELAS.map((t) => t.grupo))];
  // Cada tela entra uma vez, e cada grupo ganha o "em geral".
  assert.equal(p.length, 1 + grupos.length + TELAS.length);
  assert.ok(p.some((x) => x.codigo === 'g:Estrutura da empresa'));
  assert.ok(p.some((x) => x.codigo === 'painel' && x.rotulo === 'Painel da Capacidade'));
  // Sem repetição de código — é ele que vai para o banco.
  assert.equal(new Set(p.map((x) => x.codigo)).size, p.length);
});

test('o rótulo do produto resolve tela e grupo, e código que sumiu sai cru', () => {
  assert.equal(rotuloDoProduto('tudo'), 'Ferramenta toda');
  assert.equal(rotuloDoProduto(''), 'Ferramenta toda');
  assert.equal(rotuloDoProduto(null), 'Ferramenta toda');
  assert.equal(rotuloDoProduto('ocupacao'), 'Painel da Ocupação');
  assert.equal(rotuloDoProduto('g:Extração'), 'Extração — em geral');
  // Tela apagada um dia: o ticket continua legível em vez de sumir.
  assert.equal(rotuloDoProduto('tela_que_nao_existe_mais'), 'tela_que_nao_existe_mais');
});

test('cada tipo tem a sua pergunta e as suas dicas; defeito não pede sugestão', () => {
  assert.deepEqual(TIPOS.map((t) => t.codigo), ['DUVIDA', 'SUGESTAO', 'BUG']);
  assert.equal(rotuloDoTipo('BUG'), 'Bug/erro');
  assert.equal(rotuloDoTipo('xx'), 'xx');
  assert.equal(tipo('SUGESTAO').pergunta, 'Qual é a sua sugestão?');
  assert.equal(tipo('BUG').pergunta, 'O que aconteceu?');
  assert.match(tipo('SUGESTAO').dicaResumo, /calculo da lua/);
  assert.match(tipo('SUGESTAO').dicaDescricao, /aceleração da gravidade/);
  // Tipo desconhecido cai no padrão em vez de estourar a tela.
  assert.equal(tipo(undefined).codigo, TIPO_PADRAO);
});

test('o status desconhecido aparece cru, e os quatro conhecidos têm rótulo', () => {
  assert.deepEqual(STATUS.map((s) => s.codigo), ['ABERTO', 'ANALISE', 'FEITO', 'RECUSADO']);
  assert.equal(statusDe('FEITO').rotulo, 'Feito');
  assert.equal(statusDe('RECUSADO').rotulo, 'Não vamos fazer');
  assert.equal(statusDe('ZZZ').rotulo, 'ZZZ');
});

test('a validação diz o que falta, e nada quando está pronto', () => {
  assert.deepEqual(validaTicket(BOM), []);
  assert.deepEqual(validaTicket({}), [
    'escolha o tipo', 'escreva o resumo em uma linha',
    'descreva com um pouco mais de detalhe',
  ]);
  assert.deepEqual(validaTicket({ ...BOM, produto: 'inventado' }), ['escolha o produto']);
  assert.deepEqual(validaTicket({ ...BOM, resumo: ' oi ' }), ['escreva o resumo em uma linha']);
  assert.deepEqual(validaTicket({ ...BOM, resumo: 'x'.repeat(161) }),
                   ['o resumo passa de 160 caracteres']);
  assert.deepEqual(validaTicket({ ...BOM, descricao: 'curto' }),
                   ['descreva com um pouco mais de detalhe']);
  // Produto ausente é "ferramenta toda", que é o padrão — e não uma falta.
  assert.deepEqual(validaTicket({ ...BOM, produto: undefined }), []);
});

test('o dono edita até a resposta chegar; quem cuida da fila edita sempre', () => {
  const novo = { resposta: null };
  const respondido = { resposta: 'vamos fazer em outubro' };

  assert.ok(podeEditarTicket(novo, { souDono: true, cuidoDaFila: false }));
  assert.ok(!podeEditarTicket(novo, { souDono: false, cuidoDaFila: false }));
  // Respondido: o dono não mexe mais — a pergunta editada faria a resposta
  // parecer sem sentido para quem ler depois.
  assert.ok(!podeEditarTicket(respondido, { souDono: true, cuidoDaFila: false }));
  assert.ok(podeEditarTicket(respondido, { souDono: true, cuidoDaFila: true }));
  assert.ok(podeEditarTicket(respondido, { souDono: false, cuidoDaFila: true }));
  assert.ok(!podeEditarTicket(null, { souDono: true, cuidoDaFila: true }));

  assert.equal(motivoParaNaoEditar(novo, { souDono: true }), null);
  assert.match(motivoParaNaoEditar(novo, { souDono: false }), /Só quem abriu/);
  assert.match(motivoParaNaoEditar(respondido, { souDono: true }), /já foi respondido/);
});

test('limpar apara os espaços, corta o resumo e cai no padrão quando o valor é estranho', () => {
  const t = limpaTicket({ ...BOM, resumo: `  ${'x'.repeat(200)}  `, descricao: '  texto longo o bastante  ' });
  assert.equal(t.resumo.length, 160);
  assert.equal(t.descricao, 'texto longo o bastante');
  assert.equal(limpaTicket({}).produto, TUDO);
  assert.equal(limpaTicket({}).tipo, TIPO_PADRAO);
  assert.equal(limpaTicket({ produto: 'g:Acesso' }).produto, 'g:Acesso');
});
