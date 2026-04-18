@echo off
cls
echo ========================================
echo   CEK KESIAPAN PRINT BRIDGE
echo ========================================
echo.

echo [1] Cek Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo    [X] Node.js TIDAK TERINSTALL
    echo.
    echo    SOLUSI: Install Node.js dari https://nodejs.org
    echo.
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo    [OK] Node.js terinstall: %NODE_VERSION%
)
echo.

echo [2] Cek NPM...
npm --version >nul 2>&1
if errorlevel 1 (
    echo    [X] NPM TIDAK TERINSTALL
    echo.
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo    [OK] NPM terinstall: %NPM_VERSION%
)
echo.

echo [3] Cek dependencies...
if not exist "node_modules" (
    echo    [X] Dependencies BELUM TERINSTALL
    echo.
    echo    SOLUSI: Jalankan: npm install
    echo.
) else (
    echo    [OK] Dependencies sudah terinstall
)
echo.

echo [4] Cek file print-bridge.js...
if exist "print-bridge.js" (
    echo    [OK] File print-bridge.js ada
) else (
    echo    [X] File print-bridge.js TIDAK ADA
)
echo.

echo [5] Cek file package.json...
if exist "package.json" (
    echo    [OK] File package.json ada
) else (
    echo    [X] File package.json TIDAK ADA
)
echo.

echo ========================================
echo   KESIMPULAN
echo ========================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo [!] INSTALL NODE.JS TERLEBIH DAHULU
    echo     Download dari: https://nodejs.org
    echo.
) else (
    if not exist "node_modules" (
        echo [!] INSTALL DEPENDENCIES
        echo     Jalankan: npm install
        echo.
    ) else (
        echo [OK] SEMUA SIAP!
        echo.
        echo Langkah berikutnya:
        echo 1. Edit file print-bridge.js (setting IP printer)
        echo 2. Jalankan: start-print-bridge.bat
        echo.
    )
)

echo ========================================
pause

