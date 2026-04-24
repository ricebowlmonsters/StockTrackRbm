# 📊 MATERI PRESENTASI & PENJELASAN LOGIKA SISTEM
**Aplikasi Kasir & Manajemen "BIG MONSTERS"**

*(Dokumen ini dirancang untuk bahan presentasi kepada Klien, Owner, atau Manajemen untuk memahami cara kerja teknis dan logika di balik fitur-fitur canggih aplikasi).*

---

## 1. LOGIKA ARSITEKTUR UTAMA (CLOUD POS + LOCAL BRIDGE)
**Penjelasan untuk Klien:** 
BIG MONSTERS bukan sekadar aplikasi kasir offline tradisional, melainkan sistem *Hybrid* (Cloud + Lokal). 

**Logika Sistem:**
* **Penyimpanan Cloud (Firebase):** Semua data master (Menu, Harga, Promo, Laporan Penjualan) disimpan di server Cloud milik Google (Firebase). Ini memungkinkan Owner melihat laporan secara *real-time* dari HP di rumah.
* **Penyimpanan Lokal (localStorage):** Jika tiba-tiba koneksi internet di toko terputus, aplikasi tidak akan mati. Aplikasi akan menyimpan data pesanan sementara di memori browser (cache/localStorage).
* **Sinkronisasi:** Begitu internet kembali menyala, sistem akan otomatis melakukan *push* (mengirim) data yang tertunda tersebut ke server Cloud.

---

## 2. FITUR UNGGULAN: AUTO-PRINT & SPLIT ORDER (TANPA DIALOG)
**Penjelasan untuk Klien:**
Pernah melihat kasir harus klik "Print" dan "OK" berkali-kali? Di BIG MONSTERS, itu dihilangkan. Sekali klik "Bayar", struk langsung keluar di 3 tempat berbeda secara bersamaan.

**Logika Sistem:**
1. **Trigger (Pemicu):** Kasir menekan tombol "Bayar" di aplikasi web.
2. **Pemisahan Data (Split Logic):** Aplikasi secara pintar membaca kategori item. Makanan dikelompokkan ke keranjang "Dapur", Minuman ke "Bar".
3. **Kirim ke Print Bridge:** Web app mengirimkan data JSON (paket data) ke program lokal bernama **Print Bridge** (berjalan di background komputer kasir port 3000).
4. **Eksekusi Direct-IP (Port 9100):** Print Bridge menerjemahkan data menjadi bahasa mesin (ESC/POS command) dan menembakkannya **langsung ke Alamat IP (IP Address)** masing-masing printer melalui kabel LAN/WiFi. 
   * *Hasil:* Tidak ada jendela *pop-up* browser yang mengganggu. Dapur langsung memasak, Bar langsung membuat minuman.

---

## 3. FITUR: SISTEM POIN & KLAIM VOUCHER (LOYALTY PROGRAM)
**Penjelasan untuk Klien:**
Setiap pelanggan bisa mendapatkan poin dari transaksinya yang nanti bisa ditukar dengan makanan gratis atau *merchandise*. Ini meningkatkan retensi pelanggan.

**Logika Sistem:**
1. **Perhitungan Poin Otomatis:** Sistem memiliki rumus baku, misalnya **Poin = Total Belanja / 100**. Jika belanja Rp 50.000, pelanggan otomatis mendapat 500 poin.
2. **Integrasi Scanner & API:** Kasir menyeken QR Code dari HP pelanggan. Aplikasi kasir akan menembak API (Application Programming Interface) ke sistem backend Google Apps Script.
3. **Validasi Klaim (Anti-Kecurangan):** Saat pelanggan menukar voucher, aplikasi membuat kode unik (contoh: `VCR_17031234_USER123`). Saat kasir menyeken kode itu, sistem mengecek ke *Database*: 
   * Apakah kode ini valid? 
   * Apakah kode ini *sudah pernah* dipakai?
   * Jika sudah dipakai, sistem menolak (Error). Jika belum, hadiah diberikan dan status kode di-update menjadi "Terklaim".

---

## 4. FITUR: RBM PRO (MANAJEMEN TOKO: PETTY CASH & INVENTARIS)
**Penjelasan untuk Klien:**
BIG MONSTERS tidak hanya mencatat uang masuk, tapi juga mengamankan uang keluar (Petty Cash/Kas Kecil) dan pergerakan stok barang.

**Logika Sistem:**
1. **Input Terstruktur:** Kasir/Manajer memasukkan data pengeluaran harian (misal: beli es batu, bayar galon).
2. **Penyimpanan Ganda (Double Backup):** 
   * Data utama dikirim ke Firebase untuk perhitungan laba/rugi *real-time*.
   * Data juga di-ekspor langsung ke **Google Sheets** (Spreadsheet). Logikanya: Aplikasi Web -> *Google Apps Script (Code.gs)* -> Menulis otomatis ke baris baru di Spreadsheet.
3. **Keuntungan bagi Akunting:** Tim akunting di pusat tidak perlu meminta laporan manual. Mereka cukup membuka Google Sheets yang terisi otomatis setiap hari.

---

## 5. FITUR: MODUL KEUANGAN (NERACA & LABA RUGI)
**Penjelasan untuk Klien:**
Aplikasi ini tidak hanya mencatat penjualan, tapi juga kesehatan finansial bisnis secara keseluruhan. Owner bisa melihat Laporan Laba Rugi dan posisi kas (Neraca) secara *real-time* tanpa perlu menunggu laporan akuntan di akhir bulan.

**Logika Sistem:**
1.  **Input Terpusat:** Disediakan halaman khusus untuk menginput semua transaksi uang masuk (selain dari POS) dan uang keluar (biaya operasional, pembelian bahan baku, gaji, dll).
2.  **Pengelompokan Otomatis (Smart Categorization):**
    *   Saat input pembelian "Daging Slice", sistem otomatis mengelompokkannya ke dalam **HPP (Harga Pokok Penjualan)**.
    *   Saat input "Bayar Gaji", sistem mengelompokkannya ke **Biaya Operasional**. Pengelompokan ini diatur sekali di halaman Setting.
3.  **Kalkulasi Laba Rugi Real-Time:** Halaman laporan akan otomatis menarik data dari 3 sumber:
    *   **Total Pendapatan** dari Aplikasi Kasir.
    *   **Total HPP** dari input pembelian bahan baku.
    *   **Total Biaya** dari input pengeluaran operasional.
    *   Sistem kemudian menghitung: `Laba Kotor = Pendapatan - HPP` dan `Laba Bersih = Laba Kotor - Biaya`.
4.  **Manajemen Stok (Stok Opname):** Sistem juga menghitung sisa stok barang secara otomatis.
    *   **Logika:** `Stok Akhir = Stok Awal + Total Pembelian - Total Pemakaian`.
    *   *Total Pemakaian* dihitung dengan cerdas berdasarkan resep menu yang terjual di kasir. Jika 1 "Hot Monsters Beef" terjual, sistem tahu itu mengurangi 100gr stok daging.

**Keuntungan:** Owner mendapatkan gambaran finansial yang akurat dan cepat, memungkinkan pengambilan keputusan yang lebih baik, seperti kapan harus restock barang atau strategi apa yang perlu dilakukan untuk menekan biaya.

---

## 5. FITUR: LAPORAN REAL-TIME & REKAPITULASI
**Penjelasan untuk Klien:**
Laporan pendapatan disajikan dalam bentuk grafik dan angka yang mudah dibaca, bisa diakses detik ini juga tanpa perlu menunggu kasir tutup buku (Close Sales).

**Logika Sistem:**
1. **Data Aggregation:** Saat Owner membuka halaman Laporan, aplikasi memanggil data dari Firebase dengan *query filter* (berdasarkan tanggal hari ini dan berdasarkan Outlet yang dipilih).
2. **Kalkulasi di Klien:** Browser (HP/Laptop Owner) langsung menghitung matematika dasar: menjumlahkan total pesanan berstatus "Selesai", memisahkan mana yang dibayar via QRIS, Tunai, atau EDC.
3. **Visualisasi Dinamis:** Data angka tersebut kemudian "disuapkan" (fed) ke dalam library *Chart* untuk digambar menjadi grafik pie atau batang secara otomatis.

---

## 6. FITUR: KEAMANAN & MANAJEMEN PENGGUNA (MULTI-ROLE)
**Penjelasan untuk Klien:**
Kasir tidak bisa melihat omset, dan koki tidak bisa mengubah harga. Setiap karyawan punya batasan akses.

**Logika Sistem:**
1. **Otorisasi (Role-Based Access Control):** Saat login, sistem membaca tipe akun dari database (Contoh: `role: 'owner'` atau `role: 'kasir'`).
2. **Conditional Rendering:** Jika yang login adalah 'kasir', logika pemrograman (JavaScript) akan secara otomatis menyembunyikan/menghapus tombol "Laporan Pendapatan" dan "Pengaturan Harga" dari layar mereka.
3. **Tercatat Detail:** Setiap pesanan atau pengeluaran kas kecil yang diinput akan selalu ditandai dengan `nama_kasir` dan `waktu_input` (Timestamp). Ini memastikan pelacakan yang akurat jika terjadi selisih uang.

---

**KESIMPULAN UNTUK KLIEN:**
Aplikasi BIG MONSTERS mengubah proses manual yang rawan salah menjadi otomatis, cepat, dan transparan. Logika arsitekturnya memastikan **Aplikasi Kasir tidak mudah down**, **Dapur lebih terorganisir**, dan **Owner bisa memantau dengan tenang dari mana saja.**