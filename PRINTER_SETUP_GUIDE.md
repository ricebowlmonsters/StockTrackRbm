# Panduan Setup Printer Thermal via LAN - Auto Print

## Penjelasan: Native Print API vs Browser Print

### Apa itu Native Print API?
Native Print API adalah fitur yang memungkinkan aplikasi mencetak langsung ke printer **tanpa menampilkan dialog print**. Ini biasanya tersedia di:
- **Aplikasi Desktop** (Electron, desktop apps)
- **Aplikasi Mobile** (Android/iOS apps)

### Kenapa Browser Tidak Bisa Print Otomatis?
Browser (Chrome, Firefox, dll) **sengaja membatasi** auto-print karena alasan keamanan. Setiap kali print, browser akan menampilkan dialog untuk konfirmasi user.

### Solusi untuk Auto-Print Tanpa Dialog

---

## Opsi 1: Menggunakan Browser dengan Auto-Select Printer (RECOMMENDED)

### Cara 1: Chrome dengan Default Printer Setting
1. Buka **Chrome Settings** → **Advanced** → **Printing**
2. Set **Default printer** ke printer thermal Anda
3. Ketika auto-print aktif, Chrome akan langsung print ke default printer (user hanya perlu klik OK sekali)

### Cara 2: Chrome Kiosk Mode dengan Auto-Print
Jalankan aplikasi web dalam mode kiosk:
```bash
chrome.exe --kiosk --kiosk-printing http://localhost/your-app
```
Mode ini akan auto-print tanpa dialog (hanya untuk pertama kali, perlu konfirmasi default printer).

---

## Opsi 2: Menggunakan Electron App (Untuk Auto-Print Penuh)

### Apa itu Electron?
Electron adalah framework untuk membuat aplikasi desktop menggunakan HTML, CSS, dan JavaScript. Contoh aplikasi Electron: VS Code, WhatsApp Desktop, Slack.

### Keuntungan:
- ✅ Auto-print **benar-benar otomatis** tanpa dialog
- ✅ Akses langsung ke sistem operasi
- ✅ Bisa menggunakan library print khusus (seperti `node-printer`, `printer` npm)

### Kekurangan:
- ❌ Perlu pengetahuan programming lebih lanjut
- ❌ Perlu install Node.js
- ❌ Perlu build aplikasi desktop

### Quick Setup Electron (Jika tertarik):
1. Install Node.js
2. Buat folder project
3. Install Electron
4. Buat file `main.js` untuk handle print
5. Package menjadi aplikasi .exe

---

## Opsi 3: Print Server/Bridge (Paling Praktis untuk Printer LAN)

Karena printer Anda sudah terhubung via LAN, bisa menggunakan **print server script** sederhana.

### Cara Kerja:
1. Buat script kecil (Python/Node.js) yang listen request print
2. Web app kirim data print ke script via HTTP
3. Script langsung print ke printer via IP address

### Keuntungan:
- ✅ Tidak perlu Electron
- ✅ Auto-print benar-benar otomatis
- ✅ Bisa print langsung ke IP printer thermal

---

## Opsi 4: Menggunakan Service Print Langsung (Simple Script)

Buat file HTML sederhana yang bisa dipanggil untuk print langsung ke printer thermal via IP.

### Contoh: Print via IP Printer Thermal (Raw Socket)
Printer thermal biasanya support:
- **Port 9100** (RAW TCP/IP printing)
- **IPP** (Internet Printing Protocol)

---

## Rekomendasi untuk Kasus Anda

Karena Anda sudah punya printer thermal via LAN, saya rekomendasikan:

### Solusi Sederhana (Tanpa Programming):
1. **Set Default Printer** di Windows/OS ke printer thermal utama
2. Gunakan browser biasa, auto-print akan muncul dialog
3. Klik OK (hanya sekali, browser akan ingat pilihan)

### Solusi Menengah (Dengan Script):
1. Buat script Python sederhana untuk print via IP
2. Web app kirim request ke script
3. Script print langsung ke IP printer

### Solusi Lengkap (Electron App):
1. Buat aplikasi desktop dengan Electron
2. Integrasikan dengan library print
3. Auto-print tanpa dialog sama sekali

---

## Cara Menggunakan Saat Ini (Browser Mode)

Dengan setup saat ini, auto-print akan bekerja seperti ini:

1. ✅ Pesanan masuk → Sistem trigger print
2. ✅ Dialog print muncul
3. ✅ User pilih printer (atau gunakan default)
4. ✅ Klik Print
5. ✅ Struk tercetak

**Catatan:** Untuk pengalaman lebih baik, set default printer di Windows ke printer thermal Anda, maka hanya perlu klik OK di dialog print.

---

## Apakah Perlu Electron/Native App?

### Tidak Perlu Jika:
- ✅ Anda bisa menerima muncul dialog print sekali per sesi
- ✅ Tidak masalah klik OK untuk konfirmasi print
- ✅ Printer sudah jadi default printer di sistem

### Perlu Jika:
- ❌ Harus benar-benar otomatis tanpa interaksi user
- ❌ Tidak boleh ada dialog apapun
- ❌ Multiple printer harus dipilih otomatis berdasarkan kategori

---

## Next Steps

Jika Anda ingin benar-benar auto-print tanpa dialog, saya bisa bantu buat:
1. **Script Python sederhana** untuk print via IP printer thermal
2. **Atau panduan lengkap** setup Electron app (jika Anda ingin aplikasi desktop)

Silakan beri tahu preferensi Anda!

