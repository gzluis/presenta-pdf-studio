@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Genially to PDF - SERVIDOR

echo.
echo ===============================================
echo           GENIALLY TO PDF - SERVIDOR
 echo ===============================================
echo.
echo Carpeta: %CD%
echo Direccion: http://127.0.0.1:4177
echo.
echo Si la aplicacion funciona, deja abierta esta ventana.
echo Para detenerla, presiona Ctrl+C.
echo.

node server.js
set "CODIGO=%ERRORLEVEL%"

echo.
echo ------------------------------------------------
echo El servidor se ha detenido. Codigo de salida: %CODIGO%
echo Si la ventana muestra MODULE_NOT_FOUND:
echo   Ejecuta INSTALAR_WINDOWS.bat.
echo Si menciona sharp o archivos .node:
echo   Ejecuta: npm rebuild sharp
echo Si menciona EADDRINUSE:
echo   El puerto 4177 ya esta ocupado por otra aplicacion.
echo ------------------------------------------------
echo.
echo La consola se queda abierta para que puedas leer el error.
exit /b %CODIGO%
