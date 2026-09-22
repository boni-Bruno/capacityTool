# Manual do capacityTool

Este manual é para **quem opera** a ferramenta de planejamento de capacidade:
cadastra a fábrica, importa a demanda, lê os painéis e tira as extrações. Ele
serve também para ser colado numa IA (Claude, ChatGPT…) junto com a sua
pergunta — por isso o arquivo `MANUAL.md`, na raiz do projeto, é a junção de
todas as partes num texto só.

O manual **não** explica como o sistema é construído; para isso existem o
`CLAUDE.md`, o `ROADMAP.md` e a pasta `memoria/`, que falam com quem desenvolve.

## Como ler

- **Está começando?** Leia `01-conceitos.md` inteiro — é curto — e depois o
  procedimento `POP-01`, que leva um recurso do cadastro até aparecer no painel.
- **Está numa tela e não entendeu um campo?** Abra o arquivo daquela tela em
  `02-telas/`.
- **Quer fazer algo do começo ao fim?** Os procedimentos (POPs) em
  `03-procedimentos/` têm sempre a mesma forma: quando usar · antes de começar
  · passos · como conferir que deu certo · o que costuma dar errado.
- **Deu um número estranho ou uma tela vazia?** `04-perguntas.md` lista os
  sintomas conhecidos, com a causa e o que fazer. É a parte que mais cresce.

## A regra que resume tudo

**A ferramenta não recalcula sozinha.** Cadastro muda o que *será* calculado;
o número que os painéis, as extrações e o simulador mostram é o da **última
rodada** do botão **Recalcular** (tudo ou parcial), no Painel da Capacidade.
Mudou cadastro, importou demanda, criou recurso: **recalcule antes de avaliar
qualquer coisa**. Se um número parece não ter reagido ao que você fez, é quase
sempre isso.

## Conteúdo

| parte | o que tem |
|---|---|
| `01-conceitos.md` | instalada, planejada, disponível, OEE, CC-CT, rodada, cenário, unidade, cargo e escopo |
| `02-telas/` | uma página por tela, na ordem do menu |
| `03-procedimentos/` | os POPs numerados |
| `04-perguntas.md` | pegadinhas: sintoma → causa → o que fazer |

## Como este manual cresce

Quem usa a ferramenta relata o tropeço ou o aprendizado numa frase; a entrada
é escrita no lugar certo — em geral em `04-perguntas.md` — e `MANUAL.md` é
regerado. Toda mudança de tela atualiza o manual **no mesmo commit** da
mudança, para ele nunca descrever uma tela que não existe mais.
