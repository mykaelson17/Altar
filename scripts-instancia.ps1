param(
    [Parameter(Mandatory=$true)][string]$Dest,
    [Parameter(Mandatory=$true)][string]$Nome,
    [Parameter(Mandatory=$true)][string]$Porta
)

$ErrorActionPreference = "Stop"

# --- .env novo, com SESSION_SECRET proprio -------------------------------
$envExample = Join-Path $Dest ".env.example"
$envPath = Join-Path $Dest ".env"
Copy-Item $envExample $envPath -Force

$secret = -join ((48..57) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
(Get-Content $envPath) -replace 'SESSION_SECRET=.*', "SESSION_SECRET=$secret" | Set-Content $envPath

# Ajusta o GOOGLE_REDIRECT_URI pra porta certa dessa instancia
(Get-Content $envPath) -replace 'localhost:3000', "localhost:$Porta" | Set-Content $envPath

# --- docker-compose.yml: nome do servico/container/imagem e porta proprios
$composePath = Join-Path $Dest "docker-compose.yml"
$content = Get-Content $composePath -Raw
$content = $content -replace 'gestao-igreja:', ($Nome + ':')
$content = $content -replace 'container_name: gestao-igreja', ('container_name: ' + $Nome)
$content = $content -replace '"\d+:3000"', ('"' + $Porta + ':3000"')
Set-Content -Path $composePath -Value $content -NoNewline

Write-Host "OK - instancia '$Nome' configurada em '$Dest' (porta $Porta)"
