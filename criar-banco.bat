@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   Altair - Criar banco de dados
echo ==============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado nesta maquina.
    echo Baixe e instale em https://nodejs.org/ ^(versao LTS^) e rode este
    echo arquivo de novo.
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js encontrado.
echo.

if not exist "node_modules" (
    echo Instalando dependencias pela primeira vez ^(pode demorar alguns minutos^)...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERRO] Falha ao instalar dependencias. Veja a mensagem acima.
        pause
        exit /b 1
    )
    echo.
)

if not exist ".env" (
    echo Criando .env a partir do .env.example...
    copy ".env.example" ".env" >nul
    echo [OK] .env criado.
    echo.
    echo LEMBRETE: pro login com Google dos membros funcionar, ainda falta
    echo preencher GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
    echo no arquivo .env — mas isso NAO impede o banco de ser criado agora.
    echo.
)

echo Criando o banco de dados...
call npx tsx criar-banco.ts
if errorlevel 1 (
    echo.
    echo [ERRO] Algo deu errado ao criar o banco. Veja a mensagem acima.
    pause
    exit /b 1
)

echo.
echo Se voce for rodar com Docker ^(instalar.bat / iniciar-*.bat^), esse
echo banco criado aqui ja fica pronto em .\data\dashboard.db — o container
echo so precisa desse arquivo mapeado ^(o docker-compose.yml ja faz isso^).
echo.
pause
