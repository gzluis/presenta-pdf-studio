@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
 echo ERROR: Primero instala Node.js LTS desde https://nodejs.org/
 pause
 exit /b 1
)
echo.
echo =====================================
echo    GENIALLY TO PDF - INSTALACION
 echo =====================================
echo.
echo [1/2] Instalando dependencias...
call npm install
if errorlevel 1 goto :error
echo.
echo [2/2] Descargando navegador Chromium de Playwright...
call npx playwright install chromium
if errorlevel 1 goto :error
echo.
echo Instalacion completada.
echo Ejecuta INICIAR_WINDOWS.bat
pause
exit /b 0
:error
echo.
echo La instalacion no se completo. Comprueba internet y vuelve a intentar.
pause
exit /b 1
