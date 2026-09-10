---
name: documentacao-nos-dois-arquivos
description: "ROADMAP.md em toda mudança; CLAUDE.md só quando muda regra, convenção, conceito ou estrutura — ele não é changelog"
metadata:
  type: feedback
---

Toda construção atualiza a documentação no mesmo commit, sem pedir autorização.
Mas os dois arquivos têm papéis diferentes:

- **ROADMAP.md** — o QUE. Passa por ele toda mudança. A seção "O QUE FALTA" é a
  única que descreve o futuro; o resto é registro do que já foi decidido.
- **CLAUDE.md** — o COMO. Só muda quando muda uma REGRA, uma CONVENÇÃO, um
  CONCEITO do domínio ou a estrutura de pastas.

**Why:** em 2026-08-30 o Bruno pediu "atualizar os dois sempre". Atualizar o
CLAUDE.md a cada tela o transformaria em changelog, e ele deixaria de ser lido
de uma sentada — um acordo de trabalho que ninguém lê não governa nada. Ele
existe porque o histórico de conversa não viaja entre máquinas, e o Bruno clona
o repositório em outro computador.

Na mesma conversa descobri duas seções do ROADMAP mentindo: o DE/PARA marcado
como "EM CONSTRUÇÃO" e uma seção pedindo o painel "cabe?" que já existia.

**How to apply:** tela nova vai só para o ROADMAP; convenção nova, motor puro
novo ou regra de trabalho nova vai para os dois. Ao fechar qualquer construção,
conferir se alguma seção do ROADMAP ficou mentindo — não basta acrescentar.
Ver [[roadmap-sempre-atualizado]] e [[nao-instalar-nada-local]].
