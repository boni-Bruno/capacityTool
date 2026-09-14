# Junta as partes do manual num MANUAL.md na raiz - o arquivo que se cola numa
# IA junto com a pergunta. So le e escreve texto; nao instala nem executa nada.
#
#   powershell -ExecutionPolicy Bypass -File manual\juntar.ps1
#
# A ordem e a dos nomes: 00, 01, 02-telas/*, 03-procedimentos/*, 04. Um titulo
# de nivel 1 por parte, e os titulos internos descem um nivel para o indice
# continuar fazendo sentido no arquivo unico.

$raiz = Split-Path -Parent $PSScriptRoot
$pasta = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

$partes = @()
$partes += Get-Item (Join-Path $pasta '00-indice.md')
$partes += Get-Item (Join-Path $pasta '01-conceitos.md')
$partes += Get-ChildItem (Join-Path $pasta '02-telas') -Filter *.md | Sort-Object Name
$partes += Get-ChildItem (Join-Path $pasta '03-procedimentos') -Filter *.md | Sort-Object Name
$partes += Get-Item (Join-Path $pasta '04-perguntas.md')

$sb = New-Object System.Text.StringBuilder
# So ASCII nas strings deste script: o PowerShell 5.1 le o .ps1 sem BOM como
# ANSI, e um travessao aqui viraria lixo no MANUAL.md.
[void]$sb.AppendLine('# capacityTool - Manual completo')
[void]$sb.AppendLine()
[void]$sb.AppendLine("Gerado em $(Get-Date -Format 'yyyy-MM-dd') a partir de manual/. Nao edite este arquivo; edite as partes e rode manual/juntar.ps1.")
[void]$sb.AppendLine()

foreach ($p in $partes) {
  $texto = [System.IO.File]::ReadAllText($p.FullName, $utf8)
  # Desce um nível cada título: "# X" vira "## X", "## Y" vira "### Y".
  $texto = [regex]::Replace($texto, '(?m)^(#{1,5}) ', '#$1 ')
  [void]$sb.AppendLine('---')
  [void]$sb.AppendLine()
  [void]$sb.Append($texto.TrimEnd())
  [void]$sb.AppendLine()
  [void]$sb.AppendLine()
}

[System.IO.File]::WriteAllText((Join-Path $raiz 'MANUAL.md'), $sb.ToString(), $utf8)
Write-Output "MANUAL.md gerado com $($partes.Count) partes."
