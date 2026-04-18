# Input Point & Klaim VCR App

Aplikasi web untuk input point dan klaim voucher (VCR) menggunakan scan QR code untuk Rice Bowl Monster.

## Fitur

### 1. Input Point
- Scan QR code untuk menambahkan point ke akun user
- Input manual jika scan QR tidak berfungsi
- Riwayat penambahan point
- Validasi format kode point

### 2. Klaim VCR (Voucher)
- Scan QR code voucher untuk mengklaim hadiah
- Input manual jika scan QR tidak berfungsi
- Riwayat voucher yang telah diklaim
- Validasi format kode voucher

## Format Kode

### Kode Point
```
POINT_<timestamp>_<user_id>_<amount>
```
Contoh: `POINT_1703123456789_USER123_100`

### Kode Voucher
```
VCR_<timestamp>_<voucher_id>_<user_id>
```
Contoh: `VCR_1703123456789_VOUCHER123_USER123`

## File Struktur

```
input-point-claim-app/
├── index.html          # Halaman utama navigasi
├── input-point.html    # Halaman input point
├── claim-vcr.html      # Halaman klaim voucher
├── styles.css          # Styling aplikasi
├── app.js             # Logika aplikasi utama
├── qr-scanner.js      # QR code scanner functionality
└── README.md          # Dokumentasi
```

## Teknologi yang Digunakan

- **HTML5** - Struktur halaman
- **CSS3** - Styling dan responsive design
- **JavaScript (ES6+)** - Logika aplikasi
- **QuaggaJS** - QR code scanning library
- **QR Server API** - Generate QR code images
- **Google Apps Script** - Backend API

## Cara Menggunakan

### 1. Input Point
1. Buka halaman `input-point.html`
2. Tekan tombol "Mulai Scan QR Code"
3. Izinkan akses kamera
4. Arahkan kamera ke QR code point
5. Konfirmasi penambahan point

### 2. Klaim Voucher
1. Buka halaman `claim-vcr.html`
2. Tekan tombol "Mulai Scan QR Code"
3. Izinkan akses kamera
4. Arahkan kamera ke QR code voucher
5. Konfirmasi klaim voucher

## API Endpoints

### Add Points
```javascript
POST /script.google.com/macros/s/.../exec
{
  "action": "addPoints",
  "phone": "081234567890",
  "amount": 100,
  "source": "qr_scan"
}
```

### Claim Voucher
```javascript
POST /script.google.com/macros/s/.../exec
{
  "action": "claimVoucher",
  "phone": "081234567890",
  "voucherCode": "VCR_1234567890_VOUCHER123_USER123"
}
```

## Local Storage

Aplikasi menggunakan localStorage untuk menyimpan:
- `rbm_user` - Data user yang login
- `rbm_points_history` - Riwayat penambahan point
- `rbm_vouchers` - Daftar voucher yang diklaim

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Requirements

- Akses kamera untuk scan QR code
- Koneksi internet untuk API calls
- Browser yang mendukung getUserMedia API

## Testing

### Generate Test QR Code
1. Buka halaman `claim-vcr.html`
2. Scroll ke bagian "Generate Test QR Code"
3. Masukkan ID voucher
4. Tekan "Generate Test QR"
5. Scan QR code yang dihasilkan untuk testing

## Troubleshooting

### Kamera Tidak Bisa Diakses
- Pastikan browser mengizinkan akses kamera
- Coba gunakan input manual sebagai alternatif
- Restart browser jika diperlukan

### QR Code Tidak Terdeteksi
- Pastikan QR code dalam kondisi baik
- Pastikan pencahayaan cukup
- Coba input manual dengan mengetik kode

### Error Koneksi
- Periksa koneksi internet
- Pastikan Google Apps Script API aktif
- Coba refresh halaman

## Development

### Menambah Fitur Baru
1. Edit file `app.js` untuk logika baru
2. Update `styles.css` untuk styling
3. Modifikasi HTML sesuai kebutuhan
4. Test di berbagai browser

### Customizing QR Scanner
Edit file `qr-scanner.js` untuk:
- Mengubah library scanner
- Menambah format kode baru
- Customize validasi

## Support

Untuk pertanyaan atau masalah teknis, hubungi tim development Rice Bowl Monster.

