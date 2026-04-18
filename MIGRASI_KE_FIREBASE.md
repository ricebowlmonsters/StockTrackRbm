# Migrasi Penyimpanan ke Firebase

Dokumen ini memetakan **localStorage** dan **Google Sheets (Code.gs)** ke **Firebase Realtime Database** (dan Firebase Storage untuk file/foto) agar semua data disimpan di Firebase saja.

---

## 1. Pemetaan localStorage → Firebase

| Key localStorage | Isi | Path Firebase (baru) | Halaman yang pakai |
|------------------|-----|----------------------|---------------------|
| `rbm_user` | Objek user login (username, nama, role, outlet, phone, points) | `app_state/session` (atau tetap cache di localStorage untuk auth cepat) | login, index, kasir, orders, input-point, claim-vcr, settings |
| `rbm_users` | Array user untuk login (selain owner) | `app_state/users` | login.html |
| `rbm_outlets` | Array ID outlet | `customer_app_settings/outlets` (sudah ada) – simpan daftar ID di `app_state/outlet_ids` jika perlu | index, kasir, orders, manage-menu, laporan |
| `rbm_outlet_names` | Objek { [outletId]: nama } | Dari `customer_app_settings/outlets/{id}/name` | index, kasir, orders, laporan |
| `rbm_last_selected_outlet` | ID outlet terakhir | `app_state/last_selected_outlet` | kasir, orders |
| `rbm_db_connections` | Array koneksi DB (Firebase/Server) | `app_state/db_connections` | custom-ui, storage-viewer |
| `rbm_active_connection_index` | Index koneksi aktif | `app_state/active_connection_index` | custom-ui, storage-viewer |
| `rbm_settings` | Pengaturan umum toko | `app_state/settings` atau `customer_app_settings` | settings, kasir |
| `rbm_menu_categories` | Cache kategori menu | Sudah dari Firebase `categories` | manage-menu |
| `rbm_printer_groups`, `rbm_printer_config` | Printer & konfigurasi | `app_state/printer_groups`, `app_state/printer_config` | kasir, print-bridge |
| `rbm_payment_methods` | Metode pembayaran | `payment_methods` (root) – sudah dipakai report-transactions | kasir, report-transactions |
| `rbm_points_history`, `rbm_vouchers` | Riwayat poin & voucher (lokal) | `rbm_pro/points_history`, `rbm_pro/vouchers` atau koleksi terpisah per toko | app.js |
| `RBM_PENDING_*` | Data pending sync RBM Pro | `rbm_pro/pending/{type}` (PETTY_CASH, PEMBUKUAN, INVENTARIS, dll.) | temp.js, rbm-pro.js |
| `RBM_EMPLOYEES`, `RBM_STOK_ITEMS`, dll. | Data RBM Pro (fallback) | `rbm_pro/employees`, `rbm_pro/stok_items`, dll. | rbm-pro-storage.js |

**Rekomendasi sesi (rbm_user):**  
Tetap simpan ringkasan di localStorage untuk cek login cepat (offline); sync ke Firebase di `app_state/session` untuk multi-device. Saat buka app, baca dari Firebase jika online, fallback localStorage.

---

## 2. Pemetaan Google Sheets (Code.gs) → Firebase

Semua sheet memakai Spreadsheet ID: `1Sm7wORw3gFR2HcnzpMWNcRtJOz_hwpeG-xkCOy--VLA`.

| Sheet / Fungsi GAS | Path Firebase (baru) | Keterangan |
|--------------------|----------------------|------------|
| **Pety Cash** – getDataPettyCash, getDataPengajuanPettyCash, simpanTransaksiBatch, simpanDataPengajuanPC | `rbm_pro/petty_cash/transactions`, `rbm_pro/petty_cash/pengajuan` | Transaksi per tanggal; pengajuan PC kolom T,U,V |
| **Database** – simpanDataOnline (barang masuk/keluar/rusak/sisa) | `rbm_pro/database_barang` (sub-node: masuk, keluar, rusak, sisa) | Satu path dengan child by jenis |
| **Inventaris** – simpanDataInventaris | `rbm_pro/inventaris` (struktur: per tanggal, per nama barang) | Sesuai struktur sheet (tanggal = key, items = nama → jumlah) |
| **Rekonsiliasi** (Pembukuan) – simpanDataPembukuan | `rbm_pro/pembukuan` | Kas masuk, kas keluar, summary |
| **pengajuan** (Sheet) – simpanDataPengajuanTF | `rbm_pro/pengajuan_tf` | Detail: tanggal, suplier, tglNota, nominal, bank, foto URL |
| **Pengajuan** (Sheet) – simpanDataSudahTF | `rbm_pro/pengajuan_bukti_tf` | Bukti transfer (tanggal, foto URL) |
| **Bank** – getDataBankBySuplier | `rbm_pro/bank` (array atau object by nama suplier) | noRekening, namaPemilik |

**File/foto:**  
Di Code.gs, foto di-upload ke Google Drive. Di Firebase, simpan file ke **Firebase Storage** (mis. `rbm_pro_uploads/{type}/{id}`) dan simpan **URL** di Realtime Database.

---

## 3. Struktur Firebase Realtime Database (ringkas)

```
/
├── app_state/                    # Pengaturan & sesi (pengganti sebagian localStorage)
│   ├── session                   # rbm_user (opsional sync)
│   ├── users                     # rbm_users
│   ├── outlet_ids                # rbm_outlets (jika beda dari customer_app_settings)
│   ├── last_selected_outlet
│   ├── db_connections
│   ├── active_connection_index
│   ├── settings
│   ├── printer_groups
│   ├── printer_config
│   └── ...
├── customer_app_settings/        # Sudah ada
│   └── outlets/
├── payment_methods               # Sudah ada
├── categories                    # Sudah ada
├── rbm_pro/                      # Data RBM Pro (sudah dipakai RBMStorage)
│   ├── petty_cash/
│   │   ├── transactions          # Daftar transaksi (pengganti Sheet Pety Cash)
│   │   └── pengajuan              # Pengajuan petty cash
│   ├── database_barang/          # Barang masuk/keluar/rusak/sisa
│   ├── inventaris
│   ├── pembukuan
│   ├── pengajuan_tf
│   ├── pengajuan_bukti_tf
│   ├── bank                      # Daftar bank/suplier (noRekening, namaPemilik)
│   ├── pending/                  # RBM_PENDING_* (sync pending)
│   │   ├── PETTY_CASH
│   │   ├── PEMBUKUAN
│   │   └── INVENTARIS
│   ├── employees                 # RBM_EMPLOYEES
│   ├── stok_items                # RBM_STOK_ITEMS
│   ├── points_history            # (opsional, jika dari app.js)
│   └── vouchers                  # (opsional)
└── orders/, products/, rewards/, ...  # Tetap seperti sekarang
```

---

## 4. Langkah implementasi

1. **Siapkan Firebase:**  
   - Realtime Database: rules untuk `app_state`, `rbm_pro` (sesuai role/outlet jika perlu).  
   - Storage: rules untuk upload foto (path `rbm_pro_uploads/`).

2. **Modul `firebase-storage.js`:**  
   - Satu titik init Firebase (config dari `rbm_db_connections` atau default).  
   - API: `getAppState(key)`, `setAppState(key, value)` untuk pengganti localStorage (rbm_user, rbm_settings, dll.).  
   - API untuk data ex-Sheet: `getPettyCash(tglAwal, tglAkhir)`, `savePettyCashTransactions(data)`, `saveDatabaseBarang(dataList)`, `saveInventaris(dataList)`, `savePembukuan(data)`, `savePengajuanTF(data)`, `savePengajuanBuktiTF(data)`, `getBankBySuplier(nama)`.

3. **Ganti pemanggilan:**  
   - Di halaman yang pakai `localStorage.getItem('rbm_...')` / `setItem` → panggil `firebase-storage.js` (dengan fallback ke localStorage jika offline).  
   - Di rbm-pro.js / temp.js: ganti `google.script.run` / panggilan GAS ke fungsi di `firebase-storage.js` yang baca/tulis ke Firebase (dan Firebase Storage untuk foto).

4. **Poin & voucher (app.js):**  
   - Jika CONFIG.SCRIPT_URL dipakai untuk users/poin/voucher/claim: bisa pindah ke Firebase (users, points_history, vouchers, claim_codes) atau tetap hybrid sampai backend GAS diganti.

5. **Code.gs:**  
   - Setelah semua path di atas dilayani oleh Firebase dan firebase-storage.js, Code.gs tidak lagi dipanggil untuk Petty Cash, Database, Inventaris, Pembukuan, Pengajuan, Bank.  
   - Tetap bisa dipakai untuk export/backup ke Sheet opsional (read dari Firebase, tulis ke Sheet lewat GAS).

**Memuat script:** Di halaman yang pakai RBM Pro (Input Data / rbm-pro), sertakan setelah Firebase SDK:
```html
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>
<script src="firebase-storage.js"></script>
```
**rbm-pro.js** sudah memakai Firebase untuk Petty Cash (load & simpan) bila `FirebaseStorage.isReady()` true; bila tidak, fallback ke Google Script atau localStorage pending.

---

## 5. Ringkasan

- **localStorage** → digantikan oleh **Firebase Realtime Database** (`app_state/*`, `rbm_pro/*`, `payment_methods`, dll.) dengan optional cache localStorage untuk offline/sesi cepat.  
- **Google Sheets (Code.gs)** → digantikan oleh **Firebase** (Realtime DB + Storage untuk foto).  
- Satu modul **firebase-storage.js** menyediakan API untuk semua key dan data ex-Sheet agar halaman lain cukup ganti pemanggilan tanpa mengurus path Firebase secara tersebar.
