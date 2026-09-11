import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUNAS, conferirCabecalho, leAtivo, leData, leTipo, linhasParaExportar,
  montarImportacao,
} from './recursos-formato.js';

const AREAS = [
  { id: 1, nome: 'Fiação', planta: 'Matriz' },
  { id: 2, nome: 'Confecção', planta: 'Matriz' },
  { id: 3, nome: 'Confecção', planta: 'Ibirama' },
];

const EXISTENTE = {
  id: 59, codigo: '748-002-3', cc: '748', ct: '002', patrimonio: '3',
  area_id: 1, planta: 'Matriz', area: 'Fiação',
  nome: 'Binadeira Metler', sub_area: 'Binadeiras', tipo_recurso: 'MAQUINA',
  qt_recursos: 1, equivalencia: '1.0000', inicio: null, fim: null, ativo: true,
};

const CAB = COLUNAS.map((c) => c.titulo);
const linha = (o) => COLUNAS.map((c) => (o[c.chave] === undefined ? null : o[c.chave]));
const base = {
  planta: 'Matriz', area: 'Fiação', nome: 'Binadeira Metler', sub_area: 'Binadeiras',
  tipo: 'máquina', cc: '748', ct: '002', patrimonio: '3', qt_recursos: 1,
  equivalencia: 1, inicio: '', fim: '', ativo: 'sim',
};

test('sim/não em qualquer grafia: caixa e acento não importam', () => {
  for (const v of ['não', 'Não', 'nao', 'Nao', 'NAO', 'n', 'N', 'false', 0, '0']) {
    assert.equal(leAtivo(v), false, `"${v}" devia ser não`);
  }
  for (const v of ['sim', 'SIM', 'Sim', 's', 'true', 1, '1', 'x', true]) {
    assert.equal(leAtivo(v), true, `"${v}" devia ser sim`);
  }
  assert.equal(leAtivo(''), null);
  assert.equal(leAtivo(null), null);
  assert.equal(leAtivo('talvez'), undefined);
});

test('tipo aceita máquina/pessoa sem acento e abreviado', () => {
  assert.equal(leTipo('Máquina'), 'MAQUINA');
  assert.equal(leTipo('maquina'), 'MAQUINA');
  assert.equal(leTipo('PESSOA'), 'PESSOA');
  assert.equal(leTipo('p'), 'PESSOA');
  assert.equal(leTipo(''), null);
  assert.equal(leTipo('robô'), undefined);
});

test('data nos três formatos: ISO, brasileiro e número do Excel', () => {
  assert.equal(leData('2027-07-01'), '2027-07-01');
  assert.equal(leData('1/7/2027'), '2027-07-01');
  assert.equal(leData('01/07/2027'), '2027-07-01');
  assert.equal(leData(46569), '2027-07-01');
  assert.equal(leData(''), '');
  assert.equal(leData(null), '');
  assert.equal(leData('julho'), undefined);
});

test('cabeçalho casa sem acento e em qualquer ordem; Código é opcional', () => {
  const r = conferirCabecalho(['area', 'PLANTA', 'nome', 'sub-area', 'tipo', 'cc', 'ct',
    'patrimonio', 'qtd', 'equivalencia', 'em operacao de', 'ate', 'ativo']);
  assert.deepEqual(r.faltando, []);
  assert.equal(r.indices.planta, 1);
  assert.equal(r.indices.area, 0);
  assert.equal(r.indices.codigo, undefined);

  const falta = conferirCabecalho(['Planta', 'Área', 'Nome']);
  assert.ok(falta.faltando.includes('CC'));
  assert.ok(falta.faltando.includes('Ativo'));
});

test('exportar sai na ordem das colunas, com sim/não e datas em texto', () => {
  const [l] = linhasParaExportar([{ ...EXISTENTE, inicio: '2027-07-01', ativo: false }]);
  assert.equal(l.length, COLUNAS.length);
  assert.equal(l[COLUNAS.findIndex((c) => c.chave === 'codigo')], '748-002-3');
  assert.equal(l[COLUNAS.findIndex((c) => c.chave === 'ct')], '002');
  assert.equal(l[COLUNAS.findIndex((c) => c.chave === 'inicio')], '2027-07-01');
  assert.equal(l[COLUNAS.findIndex((c) => c.chave === 'ativo')], 'não');
  assert.equal(l[COLUNAS.findIndex((c) => c.chave === 'tipo')], 'máquina');
});

test('trinca nova cria; trinca existente sem mudança é igual e não gera pedido', () => {
  const r = montarImportacao([
    CAB,
    linha({ ...base, patrimonio: '9', nome: 'Binadeira nova' }),
    linha(base),
  ], { areas: AREAS, existentes: [EXISTENTE] });
  assert.equal(r.criar.length, 1);
  assert.equal(r.criar[0].codigo, '748-002-9');
  assert.equal(r.criar[0].area_id, 1);
  assert.equal(r.criar[0].ativo, true);
  assert.equal(r.alterar.length, 0);
  assert.equal(r.iguais, 1);
  assert.deepEqual(r.erros, []);
});

test('zero à esquerda é preservado, e número digitado no lugar vira o que foi digitado', () => {
  const r = montarImportacao([
    CAB,
    linha({ ...base, ct: '002', patrimonio: '9' }),
    linha({ ...base, ct: 2, patrimonio: 10 }),
  ], { areas: AREAS, existentes: [] });
  assert.equal(r.criar[0].codigo, '748-002-9');
  assert.equal(r.criar[1].codigo, '748-2-10');
});

test('planta ou área desconhecida ignora a linha inteira e avisa', () => {
  const r = montarImportacao([
    CAB,
    linha({ ...base, planta: 'Blumenau', patrimonio: '9' }),
    linha({ ...base, area: 'Tinturaria', patrimonio: '10' }),
    linha({ ...base, planta: '', patrimonio: '11' }),
  ], { areas: AREAS, existentes: [] });
  assert.equal(r.criar.length, 0);
  assert.equal(r.ignoradas.length, 3);
  assert.match(r.ignoradas[0].motivo, /Blumenau/);
  assert.match(r.ignoradas[1].motivo, /Tinturaria.*Matriz/);
  assert.equal(r.ignoradas[0].linha, 2);
});

test('planta e área casam sem acento e sem caixa, e "Confecção" vai para a planta certa', () => {
  const r = montarImportacao([
    CAB,
    linha({ ...base, planta: 'IBIRAMA', area: 'confeccao', patrimonio: '9' }),
  ], { areas: AREAS, existentes: [] });
  assert.equal(r.criar[0].area_id, 3);
});

test('recurso existente com área diferente no arquivo é erro, não mudança', () => {
  const r = montarImportacao([
    CAB,
    linha({ ...base, area: 'Confecção' }),
  ], { areas: AREAS, existentes: [EXISTENTE] });
  assert.equal(r.alterar.length, 0);
  assert.equal(r.erros.length, 1);
  assert.match(r.erros[0].motivo, /não muda de área/);
});

test('mudança só no Ativo vira pedido só de ativo; mudança de campo vira alteração', () => {
  const r = montarImportacao([
    CAB,
    linha({ ...base, ativo: 'NAO' }),
  ], { areas: AREAS, existentes: [EXISTENTE] });
  assert.equal(r.alterar.length, 1);
  assert.equal(r.alterar[0].ativo, false);
  assert.equal(r.alterar[0].soAtivo, true);

  const s = montarImportacao([
    CAB,
    linha({ ...base, nome: 'Binadeira Metler 3' }),
  ], { areas: AREAS, existentes: [EXISTENTE] });
  assert.equal(s.alterar.length, 1);
  assert.equal(s.alterar[0].id, 59);
  assert.equal(s.alterar[0].ativo, null);
  assert.equal(s.alterar[0].soAtivo, false);
});

test('célula vazia em tipo, qtd, equivalência e ativo mantém o que o recurso já tem', () => {
  const r = montarImportacao([
    CAB,
    linha({ ...base, tipo: '', qt_recursos: null, equivalencia: null, ativo: '' }),
  ], { areas: AREAS, existentes: [{ ...EXISTENTE, tipo_recurso: 'PESSOA', qt_recursos: 4, ativo: false }] });
  assert.equal(r.iguais, 1);
  assert.equal(r.alterar.length, 0);
});

test('trinca repetida no arquivo é erro na segunda; obrigatórios faltando é erro', () => {
  const r = montarImportacao([
    CAB,
    linha({ ...base, patrimonio: '9' }),
    linha({ ...base, patrimonio: '9' }),
    linha({ ...base, patrimonio: '' }),
    linha({ ...base, patrimonio: '12', nome: '' }),
    linha({ ...base, patrimonio: '13', ativo: 'talvez' }),
    linha({ ...base, patrimonio: '14', qt_recursos: 1.5 }),
    linha({ ...base, patrimonio: '15', inicio: '2027-12-01', fim: '2027-01-01' }),
  ], { areas: AREAS, existentes: [] });
  assert.equal(r.criar.length, 1);
  assert.equal(r.erros.length, 6);
  assert.match(r.erros[0].motivo, /Patrimônio 9 são os mesmos da linha 2/);
  assert.match(r.erros[1].motivo, /obrigat/);
  assert.match(r.erros[2].motivo, /sem nome/);
  assert.match(r.erros[3].motivo, /sim ou não/);
  assert.match(r.erros[4].motivo, /inteiro/);
  assert.match(r.erros[5].motivo, /antes/);
});

test('linha em branco no meio da planilha é pulada sem erro', () => {
  const r = montarImportacao([
    CAB,
    COLUNAS.map(() => null),
    linha({ ...base, patrimonio: '9' }),
  ], { areas: AREAS, existentes: [] });
  assert.equal(r.criar.length, 1);
  assert.deepEqual(r.erros, []);
});

test('cabeçalho faltando coluna para tudo com o nome do que falta', () => {
  const r = montarImportacao([['Planta', 'Nome']], { areas: AREAS, existentes: [] });
  assert.equal(r.erros.length, 1);
  assert.match(r.erros[0].motivo, /CC/);
});
