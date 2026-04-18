@echo off
echo Mematikan Server Database & Print Bridge...
:: Perintah ini akan mematikan semua proses Node.js (Server & Print Bridge)
taskkill /F /IM node.exe /T
echo.
echo Server berhasil dimatikan.
timeout /t 3
