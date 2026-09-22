# Usuários

**Menu:** Acesso › Usuários. Quem pode ver esta tela é quem tem o cargo com
`Usuários` marcado — normalmente só o Gestor de Planejamento.

## Para que serve

Convidar pessoas, dizer o **cargo** de cada uma (o que pode fazer) e o
**escopo** (onde: quais plantas e áreas), redefinir senha e desativar.

## Convidar

Botão **Convidar**: usuário (login, minúsculo, ex.: `maria.silva`), nome,
e-mail, cargo, **senha inicial** e o escopo. A senha segue a regra (mínimo 8,
maiúscula, minúscula, caractere especial) e a lista risca conforme cumpre.
Passe a senha inicial para a pessoa — **no primeiro acesso ela é obrigada a
trocar**.

O **e-mail** é o que reconhece quem entra pelo Hub S&OP: sem e-mail
cadastrado, a pessoa só entra pela senha.

## Onde atua (escopo)

- **Empresa inteira** — tudo, inclusive plantas e áreas criadas depois.
- **Planta inteira** — todas as áreas daquela planta, inclusive as futuras.
- **Áreas soltas** — só aquelas.

Sem nada marcado a pessoa não vê fábrica nenhuma. Turno e calendário são da
planta: quem tem só áreas soltas não os edita.

## Editar, redefinir, desativar

**Editar** troca nome, e-mail, cargo e escopo; a senha é opcional (em branco
mantém; preenchida redefine, e a pessoa troca no próximo acesso). O login não
muda. A caixa **Ativo** desativa: a pessoa não entra mais, mas a história
(quem convidou, último acesso) fica. Você não desativa a si mesmo, não tira o
próprio cargo, e o **último Gestor de Planejamento ativo** não sai do cargo.

## Cuidados

- Desativar ou trocar de cargo vale **na próxima tela** que a pessoa abrir —
  não é preciso esperar a sessão vencer.
- A senha mestre (`APP_SENHA`) continua entrando, sem usuário, com tudo. É a
  rede se o único gestor esquecer a senha.
