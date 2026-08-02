# Ferramenta de Capacidade — tela 1

Painel da capacidade instalada, planejada e disponível: totais do ano,
quebra mensal e uma linha por recurso. Com senha de acesso e botão de
recalcular.

---

## Antes de começar

O banco no Neon precisa ter os três SQLs aplicados (`01_schema`, `02_seed`,
`03_motor`). O cálculo em si você roda pelo botão da tela, depois.

---

## Publicar — uns 10 minutos

### 1. Mandar para o GitHub

- github.com → **New repository** → dá um nome → **Create**
- Na tela seguinte, clique em **uploading an existing file**
- Arraste TODOS os arquivos e pastas desta pasta
- **Commit changes**

### 2. Ligar no Vercel

- vercel.com → **Add New → Project**
- Escolha o repositório que você acabou de criar
- **Não clique em Deploy ainda**

### 3. As duas variáveis

Ainda nessa tela, abra **Environment Variables** e adicione duas:

| Name | Value |
|---|---|
| `DATABASE_URL` | a connection string do Neon (o texto que começa com `postgresql://`) |
| `APP_SENHA` | uma senha que você inventa, para entrar no site |

A connection string está no painel do Neon, botão **Connect**.

### 4. Deploy

Clique em **Deploy** e espere. No fim ele te dá um endereço `.vercel.app`.
Abra, digite a senha do `APP_SENHA` e pronto.

---

## Sobre a senha

O Vercel só oferece proteção por senha nativa em planos caros, então a senha
está dentro do próprio app: quem não tiver o cookie certo é mandado para a
tela de login antes de ver qualquer coisa.

É **uma senha só, compartilhada**, sem usuários separados. Serve para manter
o painel fora do alcance de quem topar com o endereço. Não substitui login
de verdade — quando mais gente usar, e principalmente quando cada pessoa
precisar ver só a área dela, aí entra o sistema de usuários.

Se você esquecer de configurar o `APP_SENHA`, o site fica aberto sem dar
erro nenhum. Confira que ela está lá.

**Sobre o plano:** o Hobby do Vercel é gratuito mas de uso não-comercial.
Como isso é ferramenta de trabalho, em algum momento vai precisar do Pro.
Não impede nada agora — só não deixe para descobrir depois que a fábrica
inteira estiver usando.

---

## Usando

**Filtros** — área e ano, no topo da tela.

**Recalcular** — roda o motor para a área e o ano selecionados. Leva alguns
segundos. Cada rodada é gravada nova, sem apagar a anterior: dá para mudar
um OEE, recalcular e comparar com o número de antes.

O rodapé mostra qual rodada está na tela e quando ela foi calculada.

---

## Mexer em alguma coisa

| Arquivo | O que é |
|---|---|
| `app/page.jsx` | A tela: os três números, o gráfico, a tabela |
| `app/grafico.jsx` | Só o gráfico |
| `app/filtros.jsx` | Seletores e botão de recalcular |
| `app/entrar/page.jsx` | Tela de senha |
| `app/globals.css` | Cores e aparência (bloco `:root` no topo) |
| `lib/db.js` | As consultas ao banco |
| `middleware.js` | O porteiro que exige a senha |

Depois de alterar um arquivo no GitHub, o Vercel republica sozinho em uns
2 minutos.

---

## Se der errado

**Fica pedindo senha mesmo com a senha certa** — o `APP_SENHA` no Vercel
provavelmente ficou com um espaço sobrando no fim.

**"Não consegui falar com o banco"** — `DATABASE_URL` errada ou faltando.
Depois de mudar variável no Vercel é preciso republicar: Deployments → nos
três pontinhos do último → **Redeploy**.

**"Nenhum cálculo foi rodado ainda"** — clique em Recalcular.

**Tabela vazia** — o ano do filtro não é o mesmo que foi calculado.
