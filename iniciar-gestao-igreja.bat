@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   Gestao de Igreja - Iniciando...
echo ==============================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERRO] O Docker Desktop nao esta rodando.
    echo Abra o Docker Desktop, espere ficar "Running" e rode este arquivo de novo.
    echo.
    pause
    exit /b 1
)

docker compose up -d --build
if errorlevel 1 (
    echo.
    echo [ERRO] Algo deu errado ao subir o container. Veja a mensagem acima.
    echo.
    pause
    exit /b 1
)

echo.
echo ==============================================
echo   Gestao de Igreja rodando em segundo plano!
echo   Acesse em: http://localhost:8083
echo ==============================================
echo.
pause
