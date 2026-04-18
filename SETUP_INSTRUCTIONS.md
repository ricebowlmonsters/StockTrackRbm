# Setup Instructions - Input Point & Klaim VCR App

## 1. Persiapan Google Sheets

### Buat Spreadsheet Baru
1. Buka [Google Sheets](https://sheets.google.com)
2. Buat spreadsheet baru dengan nama "Rice Bowl Monster - Users"
3. Copy Spreadsheet ID dari URL (contoh: `1LCtVFEpN9lT5LYCqbxo-RXF94YZPwuKm_TQbc6rxm68`)

### Setup Sheet Structure
Buat sheet dengan nama "Users" dan header berikut:
```
A: Nama
B: No Telepon  
C: Username
D: Password
E: Point
F: Point Ditukar
G: Nama Voucher/Merchandise
H: Riwayat Point
I: Riwayat Voucher
```

## 2. Setup Google Apps Script

### Buat Script Baru
1. Buka [Google Apps Script](https://script.google.com)
2. Buat project baru
3. Ganti nama project menjadi "Rice Bowl Monster API"

### Copy Script Code
1. Copy semua kode dari file `google-apps-script-enhanced.js`
2. Paste ke dalam editor Google Apps Script
3. Ganti `SPREADSHEET_ID` dengan ID spreadsheet Anda

### Deploy Script
1. Klik "Deploy" > "New deployment"
2. Pilih type "Web app"
3. Set execute as "Me"
4. Set access to "Anyone"
5. Klik "Deploy"
6. Copy URL deployment (akan digunakan di aplikasi)

## 3. Update Aplikasi

### Update Script URL
1. Buka file `app.js`
2. Ganti `SCRIPT_URL` dengan URL deployment Google Apps Script Anda
3. Simpan file

### Test Koneksi
1. Buka `demo.html` di browser
2. Setup demo user
3. Test generate QR code
4. Test add points dan claim voucher

## 4. Integrasi dengan Aplikasi Utama

### Tambahkan Link di Aplikasi Utama
Tambahkan link ke aplikasi input point di halaman utama:

```html
<a href="input-point-claim-app/index.html" class="feature-card">
  <div class="feature-icon">💰</div>
  <h3>Input Point & Klaim VCR</h3>
  <p>Scan QR code untuk input point dan klaim voucher</p>
</a>
```

### Update Navigation
Tambahkan menu di bottom navigation atau header aplikasi utama.

## 5. Testing

### Test Input Point
1. Buka `input-point.html`
2. Scan QR code point yang dihasilkan dari demo
3. Verifikasi point bertambah di database

### Test Klaim Voucher
1. Buka `claim-vcr.html`
2. Scan QR code voucher yang dihasilkan dari demo
3. Verifikasi voucher tersimpan di database

### Test Manual Input
1. Test input manual jika kamera tidak tersedia
2. Pastikan validasi format kode berfungsi

## 6. Production Deployment

### Upload ke Server
1. Upload semua file ke server web
2. Pastikan semua file dapat diakses via HTTPS
3. Test di berbagai device dan browser

### Security Considerations
1. Pastikan Google Apps Script hanya bisa diakses oleh aplikasi Anda
2. Implement rate limiting jika diperlukan
3. Validasi input di server side

## 7. Monitoring

### Log Monitoring
1. Monitor log di Google Apps Script
2. Check error rate dan performance
3. Monitor usage patterns

### Data Backup
1. Export data Google Sheets secara berkala
2. Backup script code
3. Document configuration

## 8. Troubleshooting

### Common Issues

#### QR Code Tidak Terdeteksi
- Pastikan pencahayaan cukup
- Pastikan QR code dalam kondisi baik
- Coba input manual sebagai alternatif

#### API Error
- Check Google Apps Script logs
- Verify spreadsheet permissions
- Check script URL configuration

#### Camera Access Denied
- Pastikan browser mengizinkan akses kamera
- Coba refresh halaman
- Gunakan input manual

### Debug Mode
Aktifkan debug mode di `app.js`:
```javascript
const DEBUG = true;
```

## 9. Maintenance

### Regular Updates
1. Update Google Apps Script jika ada bug fix
2. Monitor performance dan optimize jika diperlukan
3. Update dokumentasi jika ada perubahan

### Data Cleanup
1. Archive old points history
2. Clean up expired vouchers
3. Monitor storage usage

## 10. Support

### Documentation
- README.md - Dokumentasi lengkap
- SETUP_INSTRUCTIONS.md - Panduan setup
- google-apps-script-enhanced.js - Backend API

### Contact
Untuk pertanyaan teknis, hubungi tim development Rice Bowl Monster.

