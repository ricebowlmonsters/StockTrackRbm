# Aplikasi Monitor Barang

Aplikasi web untuk monitoring barang dengan fitur lengkap untuk manajemen inventori, invoice, dan surat jalan.

## Fitur Utama

### 📊 Dashboard Monitor
- **Tabel Monitor**: Format tabel dengan kolom Nama, Satuan, Harga, Total, Status
- **Deretan Tanggal**: Setiap tanggal menampilkan kolom In, Out, Rusak, dan Total
- **Filter Bulanan**: Pilih bulan untuk melihat data spesifik
- **Data Real-time**: Update otomatis saat ada perubahan data

### 🗄️ Database Barang
- **Tab Terpisah**: 
  - **Barang Masuk**: Tanggal, Nama, Jumlah, Satuan, Harga, Total
  - **Barang Keluar**: Tanggal, Nama, Jumlah, Harga, Total
  - **Barang Rusak**: Tanggal, Nama, Jumlah, Foto
- **Upload Foto**: Untuk barang rusak dengan preview dan modal
- **Edit/Hapus**: Kelola data barang dengan mudah

### ➕ Input Barang
- **Jenis Transaksi**:
  - **Barang Masuk**: Input barang baru ke sistem
  - **Barang Keluar**: Pencatatan barang yang keluar
  - **Barang Rusak**: Pencatatan barang yang rusak
- **Data Lengkap**: Nama, jumlah, satuan, harga, deskripsi
- **Upload Foto**: Otomatis muncul untuk barang rusak
- **Kategori Barang**: Elektronik, Furniture, Alat Kantor, dll

### 🧾 Invoice
- **Otomatis**: Nomor invoice dan tanggal otomatis
- **Data Pelanggan**: Nama dan alamat pelanggan
- **Item Invoice**: Tambah item dengan jumlah dan harga
- **Total Otomatis**: Perhitungan total otomatis
- **Cetak**: Fitur cetak invoice yang rapi

### 🚚 Surat Jalan
- **Otomatis**: Nomor surat jalan dan tanggal otomatis
- **Data Pengiriman**: Alamat dan nama penerima
- **Item Pengiriman**: Daftar barang yang dikirim
- **Kondisi Barang**: Status kondisi barang
- **Cetak**: Fitur cetak surat jalan

## Cara Menjalankan

### 1. Install Dependencies
```bash
npm install
```

### 2. Jalankan Aplikasi
```bash
npm start
```
atau
```bash
npm run dev
```

### 3. Buka Browser
Buka browser dan akses: `http://localhost:3000`

## Struktur File

```
├── index.html          # Halaman utama (Welcome)
├── dashboard.html      # Halaman dashboard monitor
├── database.html       # Halaman database barang
├── input.html           # Halaman input barang
├── invoice.html        # Halaman invoice
├── surat-jalan.html   # Halaman surat jalan
├── styles.css         # Styling aplikasi
├── script.js          # JavaScript aplikasi
├── package.json       # Konfigurasi npm
└── README.md         # Dokumentasi
```

## Cara Penggunaan

### 1. Halaman Utama (index.html)
- Halaman welcome dengan overview fitur
- Navigasi ke semua halaman aplikasi
- Tampilan card untuk setiap fitur utama

### 2. Dashboard (dashboard.html)
- Pilih bulan untuk melihat data bulanan
- Tabel dengan format: Nama, Satuan, Harga, Total, Status
- Deretan tanggal dengan kolom In/Out/Rusak/Total
- Data real-time update otomatis

### 3. Database (database.html)
- Tab terpisah untuk Barang Masuk, Keluar, dan Rusak
- Format tabel berbeda untuk setiap jenis
- Upload foto untuk barang rusak
- Edit/hapus data barang

### 4. Input Barang (input.html)
- Form lengkap dengan satuan dan kategori
- Upload foto otomatis untuk barang rusak
- Validasi form dan penyimpanan data
- Clear form untuk input baru

### 5. Invoice (invoice.html)
- Generate nomor invoice otomatis
- Data pelanggan dan item invoice
- Perhitungan total otomatis
- Fitur cetak invoice

### 6. Surat Jalan (surat-jalan.html)
- Generate nomor surat jalan otomatis
- Data pengiriman dan penerima
- Item pengiriman dengan kondisi
- Fitur cetak surat jalan

## Teknologi yang Digunakan

- **HTML5**: Struktur aplikasi
- **CSS3**: Styling dan responsive design
- **JavaScript**: Logika aplikasi
- **Chart.js**: Grafik interaktif
- **Font Awesome**: Icons
- **Local Storage**: Penyimpanan data lokal

## Fitur Responsive

Aplikasi ini responsive dan dapat digunakan di:
- Desktop
- Tablet
- Mobile

## Data Storage

Data aplikasi ini disimpan dan dikelola menggunakan **Firebase (Cloud Firestore)** sebagai backend database.

- **Penyimpanan Terpusat**: Semua data (barang, invoice, aktivitas) disimpan di koleksi Firestore pada project Firebase.
- **Akses Real-time**: Firestore menyediakan update realtime dan API client yang memungkinkan aplikasi membaca/menulis data langsung dari browser.
- **Keamanan & Aturan**: Akses baca/tulis dikontrol oleh Firestore Security Rules; pastikan rules dan (opsional) Firebase Authentication dikonfigurasi saat produksi.

## Browser Support

Aplikasi mendukung browser modern:
- Chrome
- Firefox
- Safari
- Edge

## Kontribusi

Silakan lakukan fork dan pull request untuk pengembangan lebih lanjut.

## Lisensi

MIT License
