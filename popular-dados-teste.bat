@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   Popular com dados de TESTE
echo ==============================================
echo.
echo Isso vai criar ~30 congregacoes, ~900 membros, historico
echo financeiro de 6 meses e cultos agendados — pra testar o
echo sistema como se ja estivesse em uso.
echo.
echo NAO use isso numa instancia que ja tem dados REAIS de uma
echo igreja — os dados de teste ficam misturados com os de verdade.
echo.
choice /C SN /M "Confirma que essa instancia esta vazia/e so pra teste"
if errorlevel 2 (
    echo Cancelado.
    pause
    exit /b 0
)

if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
)

echo.
echo Rodando o seed...
call npx tsx seed-demo-data.ts

echo.
pause
