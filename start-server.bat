@echo off
echo Memulai Server Database Kasir (Port 3001)...
cd /d "%~dp0"
:: %* mengizinkan passing argumen (misal drag & drop file database ke file ini)
node server.js %*
pause