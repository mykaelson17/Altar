@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==============================================
echo   Gestao de Igreja - Instalacao
echo ==============================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERRO] O Docker Desktop nao esta instalado ou nao esta rodando.
    echo Baixe e instale em https://www.docker.com/products/docker-desktop/
    echo Depois abra o Docker Desktop, espere ficar "Running" e rode este
    echo arquivo de novo.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker encontrado e rodando.
echo.

if not exist ".env" (
    echo Criando .env a partir do .env.example...
    copy ".env.example" ".env" >nul

    echo Gerando SESSION_SECRET aleatorio...
    for /f "delims=" %%s in ('powershell -NoProfile -Command "-join ((48..57)+(97..122)|Get-Random -Count 48 ^|ForEach-Object{[char]$_})"') do set "GENSECRET=%%s"

    powershell -NoProfile -Command ^
      "(Get-Content '.env') -replace 'SESSION_SECRET=.*', 'SESSION_SECRET=!GENSECRET!' | Set-Content '.env'"

    echo [OK] .env criado e SESSION_SECRET gerado automaticamente.
    echo.
    echo IMPORTANTE: ainda falta preencher no .env:
    echo   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
    echo     (necessario pro login dos membros - veja o README.md)
    echo.
    notepad .env
) else (
    echo [OK] .env ja existe - mantendo como esta.
)
echo.

echo Construindo e subindo o container (primeira vez pode demorar alguns minutos)...
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo [ERRO] Algo deu errado ao subir o container. Veja a mensagem acima.
    echo Rode "docker compose logs" para mais detalhes.
    echo.
    pause
    exit /b 1
)

echo.
echo ==============================================
echo   Instalacao concluida!
echo.
echo   Painel administrativo: http://localhost:8083
echo   (ou http://SEU-IP-DA-REDE:8083 de outra maquina)
echo.
echo   Login inicial:  admin / admin123  (gestao da igreja)
echo   Login master:    master / master123  (suporte/licenca - guarde em segredo)
echo   (vai pedir para trocar a senha no primeiro acesso)
echo ==============================================
echo.
echo Primeiros passos recomendados:
echo   1. Entre com admin/admin123 e troque a senha (master/master123 tambem precisa trocar)
echo   2. Va em Congregacoes e cadastre a(s) congregacao(oes)
echo   3. Va em Usuarios e crie os logins da equipe pastoral
echo   4. Configure o login com Google (.env) para os membros acessarem
echo      o app pelo celular
echo.
pause
