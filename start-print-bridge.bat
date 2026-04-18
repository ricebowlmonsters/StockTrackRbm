@echo off
echo ====================================
echo   Print Bridge - Rice Bowl Monster
echo ====================================
echo.
echo Memulai Print Bridge Server...
echo.

cd /d "%~dp0"

echo Memeriksa Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js tidak ditemukan!
    echo Silakan install Node.js dari https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Node.js ditemukan!
echo.

echo Memeriksa dependencies...
if not exist "node_modules" (
    echo Dependencies belum terinstall. Menginstall...
    call npm install
    echo.
)

echo.
echo Memulai Print Bridge Server...
echo Tekan Ctrl+C untuk menghentikan server
echo.
echo ====================================
echo.

node print-bridge.js

pause

