import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  AVULSAS, ESCOPO_ROTAS, ROTAS, TELAS, TUDO, codigosDaRota, escopoDaRota,
  gruposDoMenu, normaliza, permissaoDaRota, pode, podeEditar, podeVer,
  telasVisiveis, todasAsPermissoes,
} from './permissoes.js';

test('cada tela dá duas permissões, e as avulsas uma', () => {
  const todas = todasAsPermissoes();
  assert.equal(todas.length, TELAS.length * 2 + AVULSAS.length);
  assert.ok(todas.includes('painel.ver'));
  assert.ok(todas.includes('usuarios.editar'));
  assert.ok(todas.includes('recalcular'));
  assert.equal(new Set(TELAS.map((t) => t.codigo)).size, TELAS.length);
});

test('editar implica ver; ver não implica editar; tudo é tudo', () => {
  assert.ok(podeVer(['oee.editar'], 'oee'));
  assert.ok(podeEditar(['oee.editar'], 'oee'));
  assert.ok(podeVer(['oee.ver'], 'oee'));
  assert.ok(!podeEditar(['oee.ver'], 'oee'));
  assert.ok(!podeVer(['oee.ver'], 'paradas'));
  assert.ok(podeVer(TUDO, 'cargos'));
  assert.ok(podeEditar(TUDO, 'cargos'));
  assert.ok(pode(TUDO, 'recalcular'));
  assert.ok(!pode(['painel.ver'], 'recalcular'));
  assert.ok(pode(['painel.editar'], 'painel.ver'));
  assert.ok(pode(new Set(['painel.ver']), 'painel.ver'));
  assert.ok(!podeVer(null, 'painel'));
});

test('normaliza descarta o desconhecido, puxa ver de editar e sai na ordem da grade', () => {
  assert.deepEqual(normaliza(['recalcular', 'oee.editar', 'xyz.ver', 'oee.editar']),
    ['oee.ver', 'oee.editar', 'recalcular']);
  assert.deepEqual(normaliza([]), []);
  assert.deepEqual(normaliza(null), []);
});

test('o menu só mostra o que a pessoa vê, agrupado na ordem das telas', () => {
  const g = gruposDoMenu(['ocupacao.ver', 'oee.editar']);
  assert.deepEqual(g.map((x) => x.nome), ['Consultar', 'Planejamento da capacidade']);
  assert.deepEqual(g[0].itens.map((i) => i.codigo), ['ocupacao']);
  assert.equal(gruposDoMenu(TUDO).length, 7);   // os cinco de sempre + Acesso + Roadmap
  assert.equal(telasVisiveis([]).length, 0);
});

test('a permissão da rota respeita o método quando a pasta lê e grava', () => {
  assert.equal(permissaoDaRota('cadastro/oee'), 'oee.editar');
  assert.equal(permissaoDaRota('modelo-slide', 'GET'), 'extracao_config.ver');
  assert.equal(permissaoDaRota('modelo-slide', 'POST'), 'extracao_config.editar');
  assert.equal(permissaoDaRota('modelo-slide', 'DELETE'), 'extracao_config.editar');
  assert.equal(permissaoDaRota('recalcular', 'POST'), 'recalcular');
  assert.equal(permissaoDaRota('entrar'), null);
  assert.equal(permissaoDaRota('nao-existe'), undefined);
  // Toda permissão citada no mapa existe de verdade.
  const todas = new Set(todasAsPermissoes());
  for (const v of Object.values(ROTAS)) {
    for (const c of codigosDaRota(v)) {
      assert.ok(todas.has(c), `permissão desconhecida no mapa: ${c}`);
    }
  }
});

test('uma rota pode aceitar QUALQUER UMA de duas permissões', () => {
  // O PUT do ticket é do dono corrigindo o que escreveu e do curador acertando
  // um chamado alheio — dois papéis legítimos para a mesma rota. Exigir os dois
  // ao mesmo tempo seria o contrário do que se quer.
  const put = permissaoDaRota('cadastro/ticket', 'PUT');
  assert.deepEqual(put, ['tickets.editar', 'tickets_gerenciar.editar']);
  assert.equal(permissaoDaRota('cadastro/ticket', 'POST'), 'tickets.editar');
  assert.equal(permissaoDaRota('cadastro/ticket', 'DELETE'),
               'tickets_gerenciar.editar');
  assert.equal(permissaoDaRota('cadastro/ticket', 'PATCH'),
               'tickets_gerenciar.editar');
});

test('abrir o proprio chamado NAO da a fila de todo mundo', () => {
  // A armadilha de 02/10/2026: marcar a linha inteira de Roadmap na grade de
  // cargos entregava a fila da ferramenta a um usuário convidado, porque
  // `tickets.editar` queria dizer "responder os de todos". Agora cada caixa
  // quer dizer o que o rótulo diz.
  const convidado = ['tickets.ver', 'tickets.editar'];
  assert.equal(podeVer(convidado, 'tickets'), true);
  assert.equal(podeEditar(convidado, 'tickets'), true);
  assert.equal(podeVer(convidado, 'tickets_gerenciar'), false);
  assert.equal(podeEditar(convidado, 'tickets_gerenciar'), false);
});

test('o escopo da rota respeita o método e sai sempre como lista', () => {
  assert.deepEqual(escopoDaRota('cadastro/recurso', 'POST'), [{ tipo: 'area', campo: 'area_id' }]);
  assert.deepEqual(escopoDaRota('cadastro/recurso', 'DELETE'), [{ tipo: 'areaDoRecurso', campo: 'id' }]);
  assert.equal(escopoDaRota('cadastro/oee', 'POST').length, 2);
  assert.deepEqual(escopoDaRota('demanda', 'POST'), []);
  assert.deepEqual(escopoDaRota('cadastro/planta', 'POST'), [{ tipo: 'empresa' }]);
  // Toda rota com escopo existe no mapa de permissões.
  for (const pasta of Object.keys(ESCOPO_ROTAS)) assert.ok(pasta in ROTAS, pasta);
});

// TODA ROTA DE API ESTÁ NO MAPA. Rota sem entrada é rota que ninguém decidiu
// se é leitura ou escrita — e o guarda recusa por padrão, então ela nasceria
// quebrada no ar. Este teste faz o esquecimento aparecer antes do commit.
test('toda pasta de app/api tem permissão decidida em ROTAS', () => {
  const raiz = join(process.cwd(), 'app', 'api');
  const pastas = [];
  const anda = (dir, prefixo) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (!statSync(caminho).isDirectory()) continue;
      const rel = prefixo ? `${prefixo}/${nome}` : nome;
      const filhos = readdirSync(caminho);
      if (filhos.includes('route.js')) pastas.push(rel);
      anda(caminho, rel);
    }
  };
  anda(raiz, '');
  assert.ok(pastas.length > 20, 'era para achar as rotas');
  const faltam = pastas.filter((p) => !(p in ROTAS));
  assert.deepEqual(faltam, [], `rotas sem permissão decidida: ${faltam.join(', ')}`);
});
