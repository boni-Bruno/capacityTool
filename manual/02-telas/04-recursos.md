# Recursos

**Menu:** Estrutura da empresa › Recursos. As máquinas e os postos de pessoas.

## Campos

| campo | o que é |
|---|---|
| **Área** | escolhida na criação, não muda depois |
| **Código** | só leitura: `CC-CT-Patrimônio` concatenado |
| **Nome** | livre, ex.: "Texturizadeira 01" |
| **Sub-área** | texto livre, opcional; só agrupa na leitura |
| **Tipo** | **MÁQUINA** ou **PESSOA** — ver abaixo |
| **CC / CT / Patrimônio** | a identidade na controladoria; a trinca não se repete |
| **Qtd** | quantas máquinas iguais este recurso representa (só máquina) |
| **Equivalência** | fator que multiplica a capacidade (1 = normal) |
| **Em operação de … até** | a janela em que a máquina existe |
| **Ativo** | recurso desativado sai das telas, mas fica na história |

## O que o Tipo decide

- **Intervalo de refeição**: máquina não para para almoçar; pessoa para.
- **Teto**: máquina tem instalada de 24 h × Qtd, todo dia. Pessoa não tem
  teto — a instalada é a planejada — e **não tem Qtd**: quantas pessoas
  trabalham é um número **por turno**, em Turnos do recurso.
- Trocar o tipo muda o "% do teto" no próximo Recalcular.

## Em operação de … até

Fora da janela o motor **não gera linha nenhuma, nem instalada**. Máquina que
chega em julho: `01/07` no primeiro campo, e ela some dos seis primeiros
meses. Máquina vendida: último dia no segundo campo. Os dois em branco =
sempre (o caso comum). Cadastre a máquina **antes** de ela chegar: com a
janela preenchida, turno e OEE podem ser configurados na frente sem sujar o
número de hoje.

## Exportar / Importar .xlsx

A tabela inteira vai para o Excel e volta, com a mesma estrutura. Regras da
volta:

- A chave é a trinca CC-CT-Patrimônio: trinca nova **cria**, existente
  **altera**, linha ausente do arquivo **fica intocada** (importar nunca apaga).
- Planta ou área que não existe → a linha é **ignorada e avisada**.
- Recurso existente **não muda de área** por aqui.
- Ativo aceita sim/não em qualquer grafia (maiúscula, acento).
- Pessoa vai com Qtd vazia e volta com Qtd 1.
- A prévia mostra o que vai criar, alterar, ignorar — confira antes de aplicar.

## Cuidados

- Excluir um recurso que já entrou em alguma rodada não apaga: **desativa**
  com a vigência fechada em hoje. Apagar de vez é pelo painel de desativados.
- O aviso *"recurso sem parâmetro de capacidade"* significa que a linha de
  Qtd/Equivalência não existe: **Editar › Salvar** no recurso cria a linha;
  depois recalcule.
- **Recurso novo não aparece em nada até Recalcular.**
