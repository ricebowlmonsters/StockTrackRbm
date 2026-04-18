# 🖨️ Panduan Setup Print Bridge - Auto Print Tanpa Dialog

## Ringkasan
Print Bridge adalah script kecil yang berjalan di background untuk menerima request print dari web app dan langsung print ke printer thermal via IP address (LAN), **tanpa muncul dialog print**.

---

## 📋 Prasyarat

1. **Printer thermal sudah terhubung via LAN** ✅
2. **Tahu IP address setiap printer** (cek di pengaturan printer atau print test page)
3. **Komputer kasir terhubung ke jaringan LAN yang sama dengan printer**

---

## 🚀 Langkah Setup

### Langkah 1: Install Node.js

1. Download Node.js:
   - Buka: https://nodejs.org/
   - Download versi **LTS** (Long Term Support) - yang direkomendasikan
   - Pilih Windows Installer (.msi)

2. Install Node.js:
   - Double klik file installer yang sudah didownload
   - Ikuti wizard instalasi (Next, Next, Install)
   - Biarkan semua opsi default
   - Tunggu sampai selesai

3. Verifikasi instalasi:
   - Buka **Command Prompt** (Tekan `Windows + R`, ketik `cmd`, Enter)
   - Ketik: `node --version`
   - Harus muncul versi (contoh: `v18.17.0`)
   - Ketik: `npm --version`
   - Harus muncul versi (contoh: `9.6.7`)

   ✅ Jika sudah muncul versi, Node.js sudah terinstall!

---

### Langkah 2: Setup Print Bridge

1. **Buka Command Prompt di folder aplikasi kasir:**
   - Tekan `Windows + E` untuk buka File Explorer
   - Masuk ke folder: `C:\Users\RUFINA\Documents\Procejet kasir\wep app kasir`
   - Di address bar, ketik: `cmd` dan tekan Enter
   - Command Prompt akan terbuka di folder tersebut

2. **Install dependencies:**
   ```bash
   npm install
   ```
   - Tunggu sampai selesai (biasanya 10-30 detik)
   - Akan muncul folder `node_modules` (ini normal)

---

### Langkah 3: Konfigurasi IP Printer

1. **Buka file `print-bridge.js`** dengan Notepad atau text editor

2. **Cari bagian ini** (sekitar baris 23-29):
   ```javascript
   const PRINTER_CONFIG = {
       'MAKANAN': '192.168.1.100',  // ⚠️ GANTI: IP printer MAKANAN
       'MINUMAN': '192.168.1.101',  // ⚠️ GANTI: IP printer MINUMAN
       'KASIR': '192.168.1.102',    // ⚠️ GANTI: IP printer KASIR
   };
   ```

3. **Ganti IP address** sesuai IP printer Anda:
   - Contoh jika printer MAKANAN di IP `192.168.0.50`:
     ```javascript
     'MAKANAN': '192.168.0.50',
     ```
   - Lakukan hal yang sama untuk MINUMAN dan KASIR

4. **Simpan file** (Ctrl + S)

> **💡 Cara cek IP printer:**
> - Print test page dari printer (biasanya ada tombol di printer)
> - Atau cek di pengaturan printer via web browser: `http://[IP_PRINTER]`
> - Atau lihat di Windows: Settings → Devices → Printers → Klik kanan printer → Printer properties → Ports (lihat IP di port yang aktif)

---

### Langkah 4: Test Print Bridge

1. **Jalankan print bridge:**
   ```bash
   npm start
   ```
   Atau:
   ```bash
   node print-bridge.js
   ```

2. **Anda akan melihat:**
   ```
   🚀 Print Bridge Server running on http://localhost:3000

   Printer Configuration:
     MAKANAN: 192.168.1.100
     MINUMAN: 192.168.1.101
     KASIR: 192.168.1.102

   Endpoints:
     POST http://localhost:3000/print - Print struk
     POST http://localhost:3000/test - Test printer
     GET  http://localhost:3000/printers - Lihat config
   ```

3. **Test koneksi printer** (di Command Prompt baru):
   ```bash
   curl -X POST http://localhost:3000/test -H "Content-Type: application/json" -d "{\"printerIp\":\"192.168.1.100\"}"
   ```
   (Ganti `192.168.1.100` dengan IP printer MAKANAN Anda)

   Atau test via browser:
   - Buka: http://localhost:3000/printers
   - Akan muncul konfigurasi printer

4. **Jika berhasil:**
   - ✅ Printer akan mencetak struk test
   - ✅ Command Prompt akan menunjukkan "✅ Data sent to printer"

5. **Jika gagal:**
   - ❌ Cek IP address printer sudah benar
   - ❌ Pastikan printer dan komputer kasir di jaringan LAN yang sama
   - ❌ Cek firewall Windows (bisa blokir koneksi)

> **⚠️ Jangan tutup Command Prompt ini!** Biarkan print bridge tetap berjalan.

---

### Langkah 5: Integrasi dengan Web App

Web app sudah disiapkan untuk menggunakan print bridge. Pastikan:

1. **Print bridge sudah berjalan** (lihat Langkah 4)

2. **Update file `orders.html`** (sudah disiapkan, tapi perlu dicek):
   - Pastikan ada kode untuk kirim request ke print bridge
   - URL: `http://localhost:3000/print`

3. **Test dari web app:**
   - Buka aplikasi kasir di browser
   - Buat pesanan baru (atau trigger print manual)
   - Struk harus otomatis tercetak tanpa dialog

---

### Langkah 6: Jalankan Print Bridge Otomatis saat Windows Start

Agar print bridge otomatis jalan saat komputer restart:

1. **Buat file batch:**
   - Buat file baru di folder aplikasi kasir
   - Nama: `start-print-bridge.bat`
   - Isi:
     ```batch
     @echo off
     cd /d "C:\Users\RUFINA\Documents\Procejet kasir\wep app kasir"
     node print-bridge.js
     pause
     ```

2. **Tambahkan ke Windows Startup:**
   - Tekan `Windows + R`
   - Ketik: `shell:startup`
   - Enter
   - Copy file `start-print-bridge.bat` ke folder yang terbuka
   - Sekarang print bridge akan otomatis jalan saat Windows start

---

## 🔧 Troubleshooting

### Print Bridge tidak bisa start
- **Error: Cannot find module 'express'**
  - Solusi: Jalankan `npm install` lagi di folder aplikasi kasir

### Printer tidak mencetak
- **Cek IP address printer sudah benar**
- **Test dengan tombol Test di Settings web app**
- **Cek printer dan komputer di jaringan yang sama**
- **Cek firewall Windows** (bisa blokir port 9100)

### Struk tercetak tapi format rusak
- Printer thermal biasanya support ESC/POS
- Jika format masih aneh, mungkin perlu adjust konversi HTML ke ESC/POS di `print-bridge.js`

### Print bridge berhenti mendadak
- Cek Command Prompt untuk error message
- Restart print bridge dengan `npm start`
- Jika sering crash, cek log error di console

---

## 📞 Bantuan

Jika masih ada masalah:
1. Cek Command Prompt untuk error message
2. Pastikan semua langkah sudah diikuti
3. Test koneksi printer dulu dengan tombol Test di Settings

---

## ✅ Checklist Setup

- [ ] Node.js sudah terinstall (`node --version` berhasil)
- [ ] Dependencies sudah terinstall (`npm install` berhasil)
- [ ] IP printer sudah dikonfigurasi di `print-bridge.js`
- [ ] Print bridge bisa start (`npm start` berhasil)
- [ ] Test print berhasil (printer mencetak struk test)
- [ ] Web app sudah terintegrasi dengan print bridge
- [ ] Auto-print bekerja dari web app (tanpa dialog)

**Selamat! Auto-print tanpa dialog sudah siap digunakan! 🎉**

