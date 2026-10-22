@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Genially to PDF - Inicio

echo.
echo ==============================================
echo        GENIALLY TO PDF - INICIAR
 echo ==============================================
echo.

if not exist "server.js" (
  echo ERROR: No se encuentra server.js.
  echo Extrae TODO el ZIP a una carpeta antes de ejecutar el BAT.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro Node.js en el PATH.
  echo Comprueba que Node.js este instalado y abre una nueva consola.
  pause
  exit /b 1
)

if not exist "node_modules\express\package.json" (
  echo ERROR: No se encontraron las dependencias de Node.js.
  echo Ejecuta INSTALAR_WINDOWS.bat DESDE ESTA MISMA CARPETA.
  pause
  exit /b 1
)

if not exist "node_modules\playwright\package.json" (
  echo ERROR: No se encontro Playwright.
  echo Ejecuta INSTALAR_WINDOWS.bat DESDE ESTA MISMA CARPETA.
  pause
  exit /b 1
)

if not exist "SERVIDOR_WINDOWS.bat" (
  echo ERROR: Falta SERVIDOR_WINDOWS.bat.
  echo Comprueba que descomprimiste la version completa.
  pause
  exit /b 1
)

echo Se abrira una SEGUNDA ventana de consola.
echo Esa ventana permanecera abierta, incluso si hay errores.
echo No la cierres mientras utilices la aplicacion.
echo.

start "Genially to PDF - SERVIDOR" /D "%~dp0" "%ComSpec%" /k "SERVIDOR_WINDOWS.bat"
if errorlevel 1 (
  echo ERROR: No se pudo abrir la consola del servidor.
  pause
  exit /b 1
)

rem Espera unos segundos para que Node.js inicie antes de abrir el navegador.
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:4177"
echo Si no aparece el navegador, visita: http://127.0.0.1:4177
echo Ante un error, lee el mensaje de la ventana GENIALLY TO PDF - SERVIDOR.
echo.
exit /b 0
