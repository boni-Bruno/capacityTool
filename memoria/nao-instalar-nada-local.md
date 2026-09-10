---
name: nao-instalar-nada-local
description: "Nunca rodar npm install, dev server ou qualquer coisa que crie arquivos na máquina do usuário — o fluxo é commit no GitHub e deploy no Vercel"
metadata:
  type: feedback
---

Não rodar `npm install` (nem com `--package-lock-only`), `next dev`, `next build`
ou qualquer comando que crie/altere `node_modules/`, `.next/` ou instale pacote
na máquina do usuário. Isso vale mesmo para "só validar antes de subir".

**Why:** O fluxo de trabalho dele é commitar no GitHub e deixar o Vercel buildar.
A máquina local é só editor + git. Em 2026-08-02 eu rodei `npm install` sem
perguntar, depois subi um dev server e procurei Docker; quando ele mandou parar,
eu ainda propus `npm install --package-lock-only`. Ele ficou irritado — com razão,
porque a segunda tentativa veio depois de um "pode parar" explícito.

**How to apply:** Verificar código por leitura e raciocínio, não por execução.
Se algo só puder ser confirmado rodando, dizer explicitamente "isto não está
verificado" e deixar o Vercel ser o validador — não propor rodar local como
alternativa. Se um passo exigir mesmo a máquina dele (ex.: regerar
`package-lock.json`), entregar o comando pronto para ele executar, sem oferecer
para rodar em nome dele.
