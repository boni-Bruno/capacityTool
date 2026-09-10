---
name: roadmap-sempre-atualizado
description: "Manter o ROADMAP.md em dia sem precisar pedir — decisões novas entram, itens construídos saem"
metadata:
  type: feedback
---

O `ROADMAP.md` do capacityTool deve ser atualizado **sempre**, sem esperar
autorização a cada vez: decisão nova de desenho entra, item construído sai e
vira comentário no código ou no arquivo de migração.

**Why:** o arquivo é a memória entre conversas, e ele já ficou desatualizado uma
vez — as seções 1 e 2 descreviam como "não implementado" coisas que já tinham
subido. Roadmap que mente é pior que roadmap nenhum, porque alguém decide em
cima dele.

**How to apply:** ao fechar qualquer construção ou decisão, editar o
`ROADMAP.md` no mesmo commit em que a coisa acontece — não num commit separado
depois. A autorização é permanente e vale para mudanças de documentação; mexer
em código, schema ou comportamento continua exigindo pedido explícito. Ver
[[nao-instalar-nada-local]].
