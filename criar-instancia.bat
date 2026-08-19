@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==============================================
echo   Gestao de Igreja - Criar nova instancia (novo cliente)
echo ==============================================
echo.
echo Isso cria uma copia completa e independente do sistema, com nome e
echo porta proprios, sem nenhum dado (banco vazio do zero) - pronta pra
echo entregar pra uma nova igreja cliente.
echo.

set /p NOME="Nome da instancia (sem espacos/acentos, ex.: igreja-central): "
if "%NOME%"=="" (
    echo [ERRO] Nome nao pode ser vazio.
    pause
    exit /b 1
)

set /p PORTA="Porta que essa instancia vai usar (ex.: 8090): "
if "%PORTA%"=="" (
    echo [ERRO] Informe uma porta.
    pause
    exit /b 1
)

set DEST=instancias\%NOME%

if exist "%DEST%" (
    echo [ERRO] Ja existe uma instancia chamada "%NOME%" em "%DEST%".
    pause
    exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Docker nao encontrado. Instale o Docker Desktop antes de continuar.
    pause
    exit /b 1
)

echo.
echo Copiando arquivos para "%DEST%" (sem dados, sem node_modules)...
mkdir "%DEST%" >nul 2>&1
robocopy . "%DEST%" /E /XD node_modules .output .nitro data instancias .git /XF *.zip .env >nul

if not exist "%DEST%\Dockerfile" (
    echo [ERRO] A copia falhou - "%DEST%\Dockerfile" nao foi encontrado.
    pause
    exit /b 1
)

echo Gerando configuracao propria (.env, SESSION_SECRET, nome e porta do container)...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts-instancia.ps1" -Dest "%DEST%" -Nome "%NOME%" -Porta "%PORTA%"
if errorlevel 1 (
    echo [ERRO] Falha ao configurar a instancia. Veja a mensagem acima.
    pause
    exit /b 1
)

echo.
echo IMPORTANTE: essa igreja vai precisar do PROPRIO Client OAuth do Google
echo (nao reaproveite o de outra igreja) - edite "%DEST%\.env" e preencha
echo GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET antes de liberar pro cliente.
echo O redirect URI ja foi ajustado automaticamente pra porta %PORTA%.
echo.

echo ==============================================
echo   Instancia "%NOME%" criada em: %DEST%
echo   (vazia - sem nenhum dado, banco proprio do zero)
echo ==============================================
echo.

choice /C SN /M "Subir essa instancia agora"
if errorlevel 2 goto :fim

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERRO] O Docker Desktop nao esta rodando. Abra o Docker Desktop e,
    echo quando estiver pronto, entre na pasta "%DEST%" e rode
    echo "docker compose up -d --build".
    goto :fim
)

pushd "%DEST%"
docker compose up -d --build
popd

echo.
echo ==============================================
echo   Instancia "%NOME%" rodando!
echo   Acesse em: http://localhost:%PORTA%
echo   Login inicial:  admin / admin123  (gestao da igreja)
echo   Login master:    master / master123  (suporte/licenca - guarde em segredo)
echo ==============================================

:fim
echo.
pause
