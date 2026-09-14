# POP-06 — Cadastrar ou alterar recursos em massa pelo Excel

## Quando usar

Uma leva de recursos novos vinda de uma planilha da controladoria, ou uma
correção em muitos ao mesmo tempo (CC, nome, sub-área, ativo).

## Antes de começar

- Plantas e áreas de destino existem com o nome **exato** (a importação casa
  pelo nome).

## Passos

1. **Recursos › Exportar .xlsx**: baixa a tabela atual, com cabeçalho e
   estrutura fixos. CC, CT e Patrimônio saem como **texto** — o zero à
   esquerda sobrevive.
2. Edite no Excel: acrescente linhas (recursos novos) ou altere as existentes.
   Não mude o cabeçalho. Ativo aceita sim/não em qualquer grafia. Pessoa vai
   com Qtd vazia.
3. **Importar .xlsx**: a prévia diz quantas linhas vão **criar**, **alterar**,
   quantas estão **iguais** e quais foram **ignoradas** (e por quê). Confira.
4. Aplicar.
5. Turnos do recurso, OEE e **Recalcular** para os recursos novos (POP-01, a
   partir do passo 2).

## Como conferir que deu certo

- A tabela de Recursos tem as linhas novas com o Código montado.
- Nenhuma linha "ignorada" na prévia que você não esperava.

## O que costuma dar errado

- **Linha ignorada por planta/área desconhecida** → nome diferente do
  cadastro (espaço a mais, acento). Corrija no Excel e importe de novo.
- **"Trinca já existe"** → dois recursos com o mesmo CC-CT-Patrimônio; mude o
  patrimônio de um deles.
- **Recurso apareceu na área errada** → a área de um recurso existente **não
  muda** pela importação; só na criação.
- **Linha apagada no Excel não apagou o recurso** → importar nunca apaga;
  desative pela tela.
