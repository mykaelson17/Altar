@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   Gestao de Igreja - Parando...
echo ==============================================
echo.

docker compose down

echo.
echo Container parado. Para subir de novo, use iniciar-gestao-igreja.bat
echo.
pause
