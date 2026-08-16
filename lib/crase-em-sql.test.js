import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// CRASE DENTRO DE SQL
//
// As consultas moram em template literal, e template literal termina na
// primeira crase. Uma crase dentro de um comentário SQL fecha a consulta no
// meio e o resto do arquivo vira JavaScript inválido:
//
//     sql`select ...
//         -- `idx` e nao `i`: ...      <- aqui a consulta acabou
//         select ...`
//
// Isto já derrubou o build da Vercel duas vezes. E o pior: `node --check`
// PASSA no arquivo quebrado, porque um número par de crases rebalanceia o
// arquivo em algo que o parser do Node aceita e o do Next recusa. Ou seja, a
// verificação que eu usava não pegava — daí este teste existir.
//
// A regra é grosseira de propósito: nenhuma linha destes arquivos pode ter um
// comentário SQL (`--`) e uma crase. Não existe caso legítimo disso no projeto,
// e uma regra simples que nunca falha vale mais que uma sofisticada que às
// vezes passa.
// =============================================================================

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const PASTAS = ['lib', 'app'];
const EXTENSOES = ['.js', '.jsx'];

function arquivos(dir) {
  const achados = [];
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome.startsWith('.')) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) achados.push(...arquivos(caminho));
    // Arquivo de teste fica de fora: nenhum deles carrega consulta, e a
    // documentação DESTE aqui contém o padrão que ele procura — sem a exclusão
    // o teste reprova a si mesmo, que foi exatamente o que aconteceu.
    else if (!nome.endsWith('.test.js')
             && EXTENSOES.some((e) => nome.endsWith(e))) achados.push(caminho);
  }
  return achados;
}

test('nenhum comentário SQL carrega crase', () => {
  const culpados = [];

  for (const caminho of PASTAS.flatMap((p) => arquivos(join(RAIZ, p)))) {
    const linhas = readFileSync(caminho, 'utf8').split('\n');
    linhas.forEach((linha, i) => {
      const traco = linha.indexOf('--');
      if (traco === -1) return;
      if (linha.indexOf('`', traco) === -1) return;
      culpados.push(`${caminho.slice(RAIZ.length + 1)}:${i + 1}  ${linha.trim()}`);
    });
  }

  assert.deepEqual(culpados, [],
    'Crase em comentário SQL fecha o template literal e quebra o build:\n'
    + culpados.join('\n'));
});

test('o teste enxerga o defeito quando ele existe', () => {
  // Sem isto, um erro no varredor faria o teste passar para sempre sem olhar
  // nada — e um teste que nunca reprova não protege coisa nenhuma.
  const linha = '            -- `idx` e nao `i`: a lateral ja usa i';
  const traco = linha.indexOf('--');
  assert.notEqual(traco, -1);
  assert.notEqual(linha.indexOf('`', traco), -1);
});

test('varre arquivos de verdade, e não uma lista vazia', () => {
  const achados = PASTAS.flatMap((p) => arquivos(join(RAIZ, p)));
  assert.ok(achados.length > 20,
    `Só ${achados.length} arquivos varridos — o caminho da raiz deve estar errado.`);
  assert.ok(achados.some((a) => a.endsWith('db.js')));
});
