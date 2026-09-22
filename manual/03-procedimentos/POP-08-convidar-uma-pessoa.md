# POP-08 — Convidar uma pessoa para a ferramenta

## Quando usar

Alguém novo vai usar o app, ou alguém vai passar a fazer mais (ou menos).

## Antes de começar

- Você está com um usuário do cargo **Gestor de Planejamento** (ou com a
  senha mestre).
- Existe um **cargo** com o que a pessoa vai fazer. Se não existe: Acesso ›
  Cargos › *+ novo cargo*, nome, marque as telas (ver/editar) e Recalcular
  se for o caso. Cargos típicos: *Leitor* (só ver nos painéis), *Planejador
  da área* (editar planejamento, ver o resto), *Controladoria* (editar
  demanda e extrações).

## Passos

1. **Acesso › Usuários › Convidar**.
2. Usuário (login, minúsculo — `nome.sobrenome`), nome, **e-mail** (o do Hub,
   para entrar pelo portal), cargo.
3. **Senha inicial**: a lista de regras risca conforme cumpre.
4. **Onde atua**: empresa inteira, planta(s) inteira(s) ou áreas soltas.
5. **Convidar**. Passe a senha inicial para a pessoa por um canal seguro.

## Como conferir que deu certo

- A pessoa aparece na tabela com o cargo e o escopo descritos ("Matriz
  inteira · Ibirama › Confecção Cama") e *senha inicial* ao lado do último
  acesso.
- Ela entra, é levada a **trocar a senha**, e depois vê só o menu do cargo e
  só as fábricas do escopo. O *senha inicial* some da tabela.

## O que costuma dar errado

- **"Sem acesso a esta tela"** → o cargo não tem `ver` naquela tela.
- **"Esta área está fora do seu escopo"** ao salvar → o escopo não cobre a
  área; edite o usuário e marque a área ou a planta.
- **"O que é da planta pede a planta inteira"** → turno/calendário só quem
  tem a planta inteira, não uma área solta.
- **Entrou pelo Hub e caiu em "Sem acesso"** → o e-mail cadastrado é
  diferente do e-mail do Hub (ou está vazio). Edite o usuário.
- **Não consigo desativar o gestor** → é o último gestor ativo; dê o cargo a
  outra pessoa antes.
