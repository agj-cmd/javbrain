@echo off
cd /d "%~dp0"
echo Building...
node build.js
echo.
echo Serving at http://127.0.0.1:8080
npx http-server docs -c-1