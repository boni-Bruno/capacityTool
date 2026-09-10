# Como estas regras foram aprendidas

Esta pasta guarda o **porquê** das regras do projeto — o incidente, a data, o
que custou. Ela existe porque o CLAUDE.md diz, na abertura, que *"as regras
abaixo já foram aprendidas do jeito caro pelo menos uma vez"* — e não diz como.

Sem isso, quem chegar depois lê uma regra sem saber o que ela evita, e regra sem
motivo é a primeira coisa que alguém revoga achando que está simplificando.

Estava tudo na memória local do assistente, dentro do perfil do usuário
(`~/.claude/projects/…/memory/`), fora do repositório. **Não viajava no clone.**
Foi decisão do Bruno em 10/09/2026 trazer para cá: *"isso é do projeto e não de
nós dois"*.

## Os três arquivos que moram aqui

| arquivo | a regra |
|---|---|
| [nao-instalar-nada-local.md](nao-instalar-nada-local.md) | nada é instalado nem executado na máquina local |
| [roadmap-sempre-atualizado.md](roadmap-sempre-atualizado.md) | o ROADMAP anda junto do commit, sem pedir autorização |
| [documentacao-nos-dois-arquivos.md](documentacao-nos-dois-arquivos.md) | ROADMAP é o QUE, CLAUDE.md é o COMO |

## O que vai em cada lugar, para nada duplicar

Três arquivos falam de regra, e confundi-los estraga os três:

- **CLAUDE.md** — a regra **em vigor**, na forma mais curta que governa. É o que
  se lê de uma sentada antes de começar a trabalhar.
- **ROADMAP.md** — o que foi decidido **no produto** e por quê. Desenho, não
  processo.
- **memoria/** — como uma regra do CLAUDE.md **nasceu**: o dia, o erro, a
  reação. Nunca a regra em si.

A regra fica no CLAUDE.md e **não se repete aqui** — se repetir, as duas versões
divergem, e aí ninguém sabe qual vale. O que existe aqui é o que não cabe lá:
a história.

## Se você é um assistente lendo isto

Estes arquivos são a sua memória deste projeto, versionada de propósito para
não depender da máquina em que você está rodando. O índice local
(`MEMORY.md`, no perfil do usuário) aponta para cá.

Ao aprender uma regra nova pelo jeito caro, o arquivo novo vem para cá **no
mesmo commit** — mesma autorização permanente que vale para o ROADMAP e o
CLAUDE.md. E se a regra for daquelas que governam o trabalho, ela também entra
no CLAUDE.md, curta; aqui fica só a história.
