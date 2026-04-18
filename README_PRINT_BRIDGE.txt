================================================================================
  RICE BOWL MONSTER - PRINT BRIDGE SETUP
================================================================================

PANDUAN SINGKAT SETUP AUTO-PRINT TANPA DIALOG
==============================================

LANGKAH 1: Install Node.js
---------------------------
1. Download dari: https://nodejs.org/
2. Install seperti aplikasi biasa
3. Buka Command Prompt, ketik: node --version
   Harus muncul versi (contoh: v18.17.0)


LANGKAH 2: Install Dependencies
--------------------------------
1. Buka Command Prompt di folder ini
2. Ketik: npm install
3. Tunggu sampai selesai


LANGKAH 3: Konfigurasi IP Printer
----------------------------------
1. Buka file: print-bridge.js
2. Cari bagian PRINTER_CONFIG (baris 23-29)
3. Ganti IP address sesuai printer Anda:
   
   'MAKANAN': '192.168.1.100',  <- Ganti dengan IP printer MAKANAN
   'MINUMAN': '192.168.1.101',  <- Ganti dengan IP printer MINUMAN
   'KASIR': '192.168.1.102',    <- Ganti dengan IP printer KASIR

4. Simpan file


LANGKAH 4: Jalankan Print Bridge
---------------------------------
Cara 1: Double klik file "start-print-bridge.bat"
Cara 2: Buka Command Prompt, ketik: npm start

Print bridge akan berjalan di: http://localhost:3000


LANGKAH 5: Test
---------------
1. Buka browser, kunjungi: http://localhost:3000/printers
2. Harus muncul konfigurasi printer
3. Buat pesanan baru dari web app
4. Struk harus otomatis tercetak tanpa dialog


AUTO-START SAAT WINDOWS BOOT
-----------------------------
1. Tekan Windows + R
2. Ketik: shell:startup
3. Copy file "start-print-bridge.bat" ke folder yang terbuka
4. Print bridge akan otomatis jalan saat Windows start


TROUBLESHOOTING
---------------
- Print bridge tidak jalan?
  → Pastikan Node.js sudah terinstall
  → Jalankan: npm install

- Printer tidak cetak?
  → Cek IP address printer sudah benar
  → Pastikan printer dan komputer di jaringan LAN yang sama
  → Test dengan: http://localhost:3000/test

- Struk format rusak?
  → Printer harus support ESC/POS command
  → Kebanyakan printer thermal sudah support


FILE PENTING
------------
- print-bridge.js        : Script utama print bridge
- package.json           : Dependencies Node.js
- start-print-bridge.bat : Script untuk menjalankan print bridge
- SETUP_PRINT_BRIDGE.md  : Panduan lengkap (lebih detail)


BANTUAN
-------
Baca file SETUP_PRINT_BRIDGE.md untuk panduan lengkap dengan screenshot
dan troubleshooting detail.

================================================================================

