-- =============================================================================
-- FERRAMENTA DE CAPACIDADE — 28. O MODELO DE SLIDE
--
-- A extracao das configuracoes sai num .pptx com a cara da empresa: cores,
-- fontes, logotipo, ordem dos slides. Esse desenho e do Bruno, e o sistema nao
-- tem por que reinventa-lo — ele importa o modelo e escreve dentro dele.
--
-- UMA LINHA SO. O modelo e o padrao vigente, nao uma versao: importar um novo
-- substitui o anterior. Guardar historico de modelo daria uma lista onde
-- alguem escolheria errado, e modelo velho nao serve para apresentacao nenhuma.
--
-- O ARQUIVO INTEIRO FICA AQUI, em bytea. Ele precisa estar disponivel para
-- quem exportar, de qualquer maquina — no navegador de quem importou, so
-- serviria para essa pessoa. Um .pptx de modelo tem dezenas a centenas de
-- kilobytes; o limite aqui e o que o driver aguenta transportar em base64, e a
-- tela recusa acima de 4 MB pelo nome do motivo.
--
-- ONDE O CONTEUDO ENTRA: num slide qualquer do modelo, uma caixa de texto com
-- {{CAPACITY_TOOL}}. Marca em texto sobrevive a mover, renomear e reordenar
-- slides — posicao e titulo nao. Ver lib/pptx.js.
--
-- ORDEM: rode ANTES do deploy do codigo novo.
-- =============================================================================

create table if not exists modelo_slide (
    -- Trava de uma linha so: a chave e constante, entao a segunda insercao
    -- colide de proposito e vira update.
    id          boolean primary key default true check (id),
    arquivo     varchar(200) not null,
    conteudo    bytea        not null,
    -- O slide onde a marca foi encontrada na importacao, guardado so para a
    -- tela poder dizer qual e sem reabrir o zip.
    slide_marca varchar(80),
    slides      int          not null default 0,
    tamanho     int          not null default 0,
    criado_em   timestamptz  not null default now()
);

comment on table modelo_slide is
    'O modelo .pptx vigente da extracao. Uma linha so: importar substitui.';
