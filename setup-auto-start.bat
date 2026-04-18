@echo off
title Setup Auto Start Server Kasir
echo ========================================================
echo   SETUP AUTO-START SERVER KASIR
echo ========================================================
echo.
echo Script ini akan membuat server otomatis berjalan
echo setiap kali komputer dinyalakan.
echo.

set "SCRIPT_DIR=%~dp0"
:: Hapus backslash terakhir jika ada
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "VBS_FILE=%SCRIPT_DIR%\start-background.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Server_Kasir_Otomatis.lnk"

echo 1. Mencari file server...
if not exist "%VBS_FILE%" (
    echo [ERROR] File start-background.vbs tidak ditemukan!
    echo Pastikan Anda menjalankan file ini dari folder aplikasi kasir.
    pause
    exit /b
)
echo    Ditemukan: %VBS_FILE%

echo.
echo 2. Mendaftarkan ke Startup Windows...

:: PowerShell script untuk membuat shortcut
set "PS_CMD=$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%VBS_FILE%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Description = 'Server Database Kasir (Auto Start)'; $s.Save()"

powershell -Command "%PS_CMD%"

echo.
echo ========================================================
echo   SUKSES! SELESAI.
echo ========================================================
echo.
echo Mulai sekarang, Server akan otomatis nyala sendiri saat komputer hidup.
echo Anda TIDAK PERLU klik start-server lagi nanti.
echo.
pause