# Buku Panduan Developer — Web App Kasir (Rice Bowl Monster)

**Versi:** 1.0  
**Tanggal:** Maret 2025  
**Tujuan:** Pegangan developer untuk memahami struktur, penyimpanan, dan logika aplikasi secara detail (jika lupa).

---

## Daftar Isi

1. [Ringkasan Aplikasi](#1-ringkasan-aplikasi)
2. [Struktur Proyek & File Penting](#2-struktur-proyek--file-penting)
3. [Penyimpanan (Storage) — Detail](#3-penyimpanan-storage--detail)
4. [Logika Bisnis Utama](#4-logika-bisnis-utama)
5. [Per Halaman / Fitur (Satu per Satu)](#5-per-halaman--fitur-satu-per-satu)
6. [Server & Backend](#6-server--backend)
7. [Konfigurasi & Environment](#7-konfigurasi--environment)
8. [Cara Menjalankan & Build](#8-cara-menjalankan--build)

---

## 1. Ringkasan Aplikasi

- **Nama:** Web App Kasir (Rice Bowl Monster / RBM)
- **Jenis:** Aplikasi kasir (POS), input poin, klaim voucher, laporan, dan modul RBM Pro (absensi, petty cash, inventaris, pembukuan, dll.).
- **Entry point:** `login.html` → setelah login redirect ke `index.html`.
- **Navigasi:** Bukan SPA; setiap menu adalah link langsung ke file HTML. Dashboard (`index.html`) memakai iframe untuk konten (default: `orders.html`).
- **Data:** Firebase Realtime Database (utama), localStorage (sesi & pengaturan), file JSON via server Node (opsional), Google Sheets via Google Apps Script.

---

## 2. Struktur Proyek & File Penting

### 2.1 Folder

- **Root:** Semua HTML, JS, CSS, dan konfigurasi di satu folder (tidak ada `src/` atau `public/` terpisah).
- **node_modules/:** Dependency Node (Express, body-parser, cors) untuk server.

### 2.2 File menurut peran

| Peran | File | Keterangan |
|--------|------|------------|
| **Entry / Auth** | `login.html` | Halaman login; simpan `rbm_user` ke localStorage, redirect ke `index.html`. |
| **Dashboard** | `index.html` | Sidebar + iframe; link ke semua halaman; logout hapus `rbm_user`. |
| **Konfigurasi** | `package.json` | Script `start` → `node print-bridge.js` (port 3000). Server DB: `server.js` (port 3001) dijalankan terpisah. |
| | `server-config.json` | Dibuat oleh `server.js` untuk menyimpan path file database. |
| **Core JS** | `app.js` | CONFIG (SCRIPT_URL GAS), AUTH, AppState, APIService (poin & voucher), inisialisasi per halaman. |
| | `custom-ui.js` | Modal/alert, **LocalDB** & **ServerDB** (adapter mirip Firebase), Firebase init, `ensureDefaultFirebaseConnection()`. |
| | `menu.js` | Data menu statis `RBM_MENU_DATA` (referensi); kasir & kelola menu pakai Firebase. |
| **Server Node** | `server.js` | Express port 3001: GET/POST `/db` baca/tulis file JSON (database.json). |
| | `print-bridge.js` | Express port 3000: endpoint `/print` untuk cetak ke printer thermal via LAN. |
| **Backend GAS** | `Code.gs` | Google Apps Script: doGet (Input Data), Petty Cash / Inventaris / Pembukuan / Pengajuan ke Google Sheet. |
| | `google-apps-script-enhanced.js` | Referensi API Web App GAS: doGet/doPost, action addPoints, claimVoucher, getMenu, dll. |
| **RBM Pro** | `rbm-pro.js` | Logika RBM Pro (outlet, absensi, petty cash, inventaris, pembukuan, dll.). |
| | `rbm-pro-storage.js` | Lapisan storage: Firebase atau fallback localStorage untuk key `RBM_*`. |
| | `rbm-laba-rugi.js` | Logika untuk modul Keuangan (Laba Rugi, Neraca, Stok). |
| | `temp.js` | Data pending sync ke GAS (petty cash, pembukuan, inventaris, karyawan); baca/tulis localStorage. |

### 2.3 File HTML utama (ringkas)

- **Utama:** `index.html`, `login.html`, `kasir.html`, `orders.html`, `manage-menu.html`, `input-point.html`, `claim-vcr.html`, `revenue-report.html`, `report-transactions.html`, `manage-rewards.html`, `customer-settings.html`, `customer-account-settings.html`, `settings.html`, `storage-viewer.html`, `promo-settings.html`, `qr_generator.html`, `admin-menu.html`, `report-category.html`, `report-menu.html`.
- **RBM Pro:** `rbm-absensi.html`, `rbm-absensi-gps.html`, `rbm-stok-barang.html`, `rbm-input-barang.html`, `rbm-input-petty-cash.html`, `rbm-lihat-petty-cash.html`, `rbm-input-keuangan.html`, `rbm-lihat-pembukuan.html`, `rbm-input-inventaris.html`, `rbm-lihat-inventaris.html`, `rbm-pengajuan.html`, dll.
- **Lain:** `global-chat-manager.html`, `ai-settings.html`, `storage-viewer.html`, `print-bridge-simple.html`.
- **Keuangan:** `rbm-laba-rugi-settings.html`, `rbm-laba-rugi-input.html`, `rbm-laba-rugi-report.html`.

---

## 3. Penyimpanan (Storage) — Detail

### 3.1 Di mana data disimpan

| Sumber | Kegunaan |
|--------|----------|
| **Firebase Realtime Database** | Orders, products, categories, promos, rewards, users, customer_app_settings, counters, pos_promos, global_chat, ai_responses, games, rbm_pro (subset). |
| **localStorage (browser)** | Sesi user, koneksi DB, outlet, pengaturan, pending sync, cache. |
| **File JSON (server.js)** | Satu file (path dari `server-config.json` atau default `database.json`) untuk mode "Server PC" via GET/POST `/db`. |
| **Google Sheets (Code.gs)** | Satu Spreadsheet ID untuk Petty Cash, Database barang, Inventaris, Rekonsiliasi/Pembukuan, Pengajuan, Bank. |
| **Google Apps Script Web App** | Sheet terpisah: users, poin, voucher, claim, menu; dipanggil dari front-end (URL di `app.js` → CONFIG.SCRIPT_URL). |

### 3.2 Key localStorage (penting)

| Key | Isi | Dipakai di |
|-----|-----|------------|
| `rbm_user` | Objek user login: `{ username, nama, role?, outlet?, phone?, points? }` | login, index, kasir, orders, input-point, claim-vcr, settings, dll. |
| `rbm_users` | Array user untuk login (selain owner): `[{ username, password, nama, ... }]` | login.html |
| `rbm_outlets` | Array ID outlet | index, kasir, orders, manage-menu, revenue-report, dll. |
| `rbm_outlet_names` | Objek `{ [outletId]: nama }` | index, kasir, orders, laporan |
| `rbm_last_selected_outlet` | ID outlet terakhir dipilih | kasir, orders |
| `rbm_db_connections` | Array koneksi DB (Firebase / Server) | custom-ui, storage-viewer |
| `rbm_active_connection_index` | Index koneksi aktif | custom-ui, storage-viewer |
| `rbm_settings` | Pengaturan umum toko | settings, kasir |
| `rbm_menu_categories` | Cache kategori menu (juga di Firebase) | manage-menu |
| `rbm_printer_groups`, `rbm_printer_config` | Kelompok printer & konfigurasi | kasir, print-bridge |
| `rbm_payment_methods` | Metode pembayaran | kasir, report-transactions |
| `rbm_points_history` | Riwayat poin (lokal) | app.js |
| `rbm_vouchers` | Voucher (lokal) | app.js |
| `RBM_PENDING_PETTY_CASH`, `RBM_PENDING_PEMBUKUAN`, `RBM_PENDING_INVENTARIS` | Data pending sync RBM Pro | temp.js, rbm-pro |
| `RBM_EMPLOYEES`, `RBM_STOK_ITEMS`, dll. | Data RBM Pro (fallback) | rbm-pro-storage.js |

### 3.3 Path Firebase (utama)

| Path | Isi |
|------|-----|
| `orders/{outletId}/{orderId}` | Pesanan: items, payment, status, date, details, promo. |
| `products/{outletId}/{productId}` | Produk per outlet. |
| `categories` | Kategori menu (array/object). |
| `counters/{outletId}` | Counter nomor order (increment transaksi). |
| `promos`, `pos_promos` | Promo dan penggunaan promo POS. |
| `rewards` | Daftar hadiah tukar poin. |
| `users` | User (jika dipakai). |
| `customer_app_settings` | Pengaturan aplikasi customer. |
| `global_chat`, `ai_responses`, `games` | Fitur tambahan. |
| `rbm_pro/...` | Data RBM Pro di Firebase. |
| `rbm_pro/laba_rugi_settings` | Konfigurasi untuk modul keuangan (akun bank, kategori biaya, item HPP). |
| `rbm_pro/transactions` | Semua catatan transaksi keuangan (uang masuk/keluar). |
| `rbm_pro/inventory/items` | Master data barang untuk stok (stok awal, stok saat ini). |
| `rbm_pro/inventory/movements` | Riwayat pergerakan stok (pembelian, pemakaian, penyesuaian). |
| `products/{outletId}/{productId}/recipe` | **(Baru)** Resep/BOM untuk setiap menu, untuk kalkulasi pemakaian stok. |

### 3.4 File yang mengelola baca/tulis

- **Firebase:** `custom-ui.js` (init, adapter), `kasir.html`, `orders.html`, `manage-menu.html`, `manage-rewards.html`, `promo-settings.html`, `revenue-report.html`, `report-transactions.html`, `report-category.html`, `rbm-pro-storage.js`, berbagai `rbm-*.html`.
- **localStorage:** `app.js` (user, points history, vouchers), `custom-ui.js` (koneksi, LocalDB), `temp.js` (pending RBM), `rbm-pro.js`, `rbm-pro-storage.js`, `login.html`, `index.html`, `settings.html`, dll.
- **File JSON (server):** Hanya `server.js` (GET/POST `/db`).
- **Google Sheet (tulis):** Hanya dari backend GAS `Code.gs`.
- **Poin & voucher (customer):** `app.js` + `input-point.html`, `claim-vcr.html` → panggil `CONFIG.SCRIPT_URL` (GAS); backend di `google-apps-script-enhanced.js`.

### 3.5 Adapter database di custom-ui.js

- **LocalDB:** Simpan di localStorage dengan key `rbm_off_<dbName>`. API mirip Firebase: `ref(path).once()`, `ref(path).set()`, `ref(path).push()`, `ref(path).update()`, `ref(path).remove()`.
- **ServerDB:** Baca/tulis ke server Node (GET/POST `/db`); path dijadikan key di objek JSON besar.
- **Firebase:** Dipakai saat koneksi aktif adalah Firebase; init lewat `ensureDefaultFirebaseConnection()`.

---

## 4. Logika Bisnis Utama

### 4.1 Login

1. User buka `login.html`, input username & password.
2. **Owner (hardcoded):** `burhan` / `160502` → simpan `rbm_user` dengan role `owner`, outlet `all`; panggil `ensureDefaultFirebaseConnection()`; redirect ke `index.html`.
3. **User lain:** Baca `rbm_users` dari localStorage; cocokkan username (case-insensitive) dan password; simpan ke `rbm_user`; panggil `ensureDefaultFirebaseConnection()`; redirect ke `index.html`.
4. Di `app.js` (DOMContentLoaded): jika tidak ada `rbm_user` dan halaman bukan `login.html`, redirect ke `login.html`.

### 4.2 Kasir (POS)

1. **kasir.html:** Init Firebase (atau adapter aktif), muat `categories` dan `products/{outletId}`.
2. Cart di memori (variabel JS); tambah/kurang item, ubah qty.
3. Saat bayar: hitung subtotal, diskon, pajak, total; pilih metode bayar; generate order ID lewat `counters/{outletId}` (increment); simpan order ke `orders/{outletId}/{orderId}` status "Sudah Dibayar"; update `pos_promos` jika ada promo; panggil print-bridge untuk struk; kosongkan cart; tampilkan modal kembalian jika tunai.
4. **Order ID:** Format `{prefix}-{nomor}` (mis. `ORD-0001`). Prefix per outlet dari Firebase/local; counter dari `counters/{outletId}`.

### 4.3 Menu

- **manage-menu.html:** Kategori dari Firebase `categories` (dan cache ke `rbm_menu_categories`). Produk dari Firebase `products/{outletId}`. CRUD kategori & produk ditulis ke Firebase; listener realtime memperbarui tampilan.
- **menu.js:** Hanya definisi statis `RBM_MENU_DATA`; tidak dipakai untuk simpan, hanya referensi.

### 4.4 Rewards / poin

- **Input poin (input-point.html):** Cari customer via GAS `CONFIG.SCRIPT_URL?phone=...`. Input nominal; **poin = nominal ÷ 100**. Submit lewat `APIService.addPoints(phone, nominal, points, source, operator, customerName)` → POST ke GAS action `addPoints`; GAS update sheet (kolom points) dan riwayat poin.
- **Klaim voucher (claim-vcr.html):** Validasi klaim/kode lewat POST ke GAS (`validateClaimVoucher`, `validateClaimCode`, `generateClaimCode`); data operator dari `rbm_user`.
- **Hadiah (manage-rewards.html):** Daftar hadiah dari Firebase `rewards`; tambah hadiah = push ke `rewards` (nama, point, type, foto, createdAt). Debet poin dan generate kode klaim di backend GAS (redeem/generateClaimCode).

### 4.5 Laporan

- **revenue-report.html:** Pilih outlet, rentang tanggal, optional kasir. Query `orders/{outlet}` dengan `orderByChild('date').startAt().endAt()`, filter status (Sudah Dibayar, Diproses, Selesai, dll.); hitung ringkasan (item sales, diskon, pajak, net, grand total) dan per metode bayar; chart & tabel; link "Lihat Transaksi" ke `report-transactions.html` dengan query string.
- **report-transactions.html:** List transaksi per order dari Firebase (filter tanggal, outlet, kasir); detail per pesanan; metode pembayaran bisa dari `rbm_payment_methods` di localStorage.

### 4.6 Integrasi Google Apps Script

- **Code.gs (repo):** doGet keluarkan HTML "Input Data". Fungsi yang menulis ke Sheet (ID spreadsheet tertentu): Petty Cash, Database barang, Inventaris, Rekonsiliasi/Pembukuan, Pengajuan, Bank.
- **google-apps-script-enhanced.js:** Spesifikasi Web App lain (URL di app.js). doGet: `action=getLocations`, `getMenuData`, atau `phone` untuk cari user. doPost: action `register`, `getUserData`, `addPoints`, `validateClaimCode`, `generateClaimCode`/`redeemReward`, `getMenuData`, `getMenuItems`, `getVoucherData`, `getMerchandiseData`. Sheet: users, menu, vouchers, merchandise, locations, Log Tukar Poin, POINT_HISTORY, claims.

---

## 5. Per Halaman / Fitur (Satu per Satu)

| Halaman | Tujuan | Data dipakai | Alur singkat |
|---------|--------|--------------|---------------|
| **login.html** | Autentikasi | `rbm_users`, akun owner hardcoded | Cek credential → set `rbm_user`, ensure Firebase → redirect ke index. |
| **index.html** | Dashboard & navigasi | `rbm_user`, `rbm_outlets`, `rbm_outlet_names` | Tampil nama & lokasi; sidebar link ke semua HTML; iframe default; logout hapus `rbm_user`. |
| **kasir.html** | POS | Firebase: categories, products, counters, orders, pos_promos; localStorage: outlet, user, printer | Pilih outlet, cart, bayar → generate ID, simpan order, cetak, kosongkan cart. |
| **orders.html** | Daftar pesanan | Firebase: orders/{outlet}; localStorage: outlet, user, printer | Pilih outlet, listener orders; ubah status (Diproses/Siap Diambil/Selesai), cetak ulang. |
| **manage-menu.html** | Kelola menu & kategori | Firebase: categories, products; localStorage: rbm_menu_categories, outlet | CRUD kategori & produk; listener value untuk refresh. |
| **input-point.html** | Input poin customer | GAS: cari user by phone, addPoints; localStorage: rbm_user | Cari no telepon → input nominal → poin = nominal/100 → POST addPoints. |
| **claim-vcr.html** | Validasi/klaim voucher | GAS: validateClaimVoucher, validateClaimCode, generateClaimCode; localStorage: rbm_user | Input data klaim/kode → POST ke GAS → tampil hasil. |
| **manage-rewards.html** | Kelola hadiah tukar poin | Firebase: rewards | Tambah hadiah push ke `rewards`; list dari listener. |
| **revenue-report.html** | Laporan pendapatan | Firebase: orders/{outlet} (filter date, status) | Query orders → total, per metode bayar, chart → link ke report-transactions. |
| **report-transactions.html** | Detail transaksi | Firebase: orders; localStorage: rbm_payment_methods | Filter tanggal/outlet/kasir, tabel transaksi, export/print. |
| **customer-settings.html** | Pengaturan web customer & outlet | Firebase: customer_app_settings, outlets; localStorage: outlet, names | Atur nama, logo, lokasi, radius; simpan ke Firebase & localStorage. |
| **customer-account-settings.html** | Pengaturan akun customer | Firebase / koneksi aktif; localStorage: rbm_user, rbm_db_connections | Kelola akun customer. |
| **settings.html** | Pengaturan umum | localStorage: rbm_settings, rbm_outlets, rbm_printer_groups, dll. | Simpan toko, outlet, printer, metode bayar. |
| **storage-viewer.html** | Lihat/backup/restore/hapus data | Firebase atau ServerDB (GET /db); localStorage: rbm_db_connections | Pilih koneksi, analisis node, backup/restore/hapus. |
| **promo-settings.html** | Promo & diskon | Firebase: promos (per outlet) | CRUD promo, listener realtime. |
| **qr_generator.html** | QR meja | (Riwayat/local jika ada) | Generate/tampil QR meja. |
| **admin-menu.html** | Admin menu (alternatif) | GAS: getMenu, update menu | Fetch getMenu; update via POST. |
| **report-category.html** | Laporan per kategori | Firebase: orders/{outlet} | Query orders by date, agregasi per kategori. |
| **RBM Pro (rbm-*.html)** | Absensi, reservasi, stok, petty cash, pembukuan, inventaris | Firebase `rbm_pro`, localStorage `RBM_*`, GAS Code.gs | Input/sync ke Firebase; pending ke localStorage; sinkron ke Sheet lewat Code.gs. |
| **print-bridge (print-bridge.js)** | Cetak struk | Konfigurasi IP printer | POST /print → socket ke printer (port 9100). |
| **Modul Keuangan (rbm-laba-rugi-*.html)** | Setting, Input, dan Laporan Keuangan/Stok | Firebase: `rbm_pro/laba_rugi_*`, `rbm_pro/transactions`, `rbm_pro/inventory`, `orders` | Mengelola seluruh siklus keuangan dari setup, input transaksi, hingga pelaporan laba rugi dan stok. |

---

## 6. Server & Backend

### 6.1 server.js (port 3001)

- **GET /db:** Baca seluruh isi file database JSON; kembalikan JSON.
- **POST /db:** Terima body JSON; tulis ke file database (merge atau replace sesuai implementasi).
- **GET /info:** Kembalikan `{ status, port, dbFile }`.
- Path file DB: dari `server-config.json`, atau argumen, atau default `database.json` di folder proyek.

### 6.2 print-bridge.js (port 3000)

- **POST /print:** Terima konten struk (plain text atau format thermal); kirim ke printer thermal via LAN (socket port 9100) sesuai konfigurasi (LOKASI_AKTIF / IP printer).

### 6.3 Google Apps Script

- **Code.gs:** Satu Spreadsheet ID untuk Petty Cash, Database, Inventaris, Pembukuan, Pengajuan, Bank.
- **Web App (SCRIPT_URL di app.js):** Sheet terpisah untuk users, poin, voucher, claim, menu; dipanggil dari front-end dengan action di body/query.

---

## 7. Konfigurasi & Environment

- **app.js:** `CONFIG.SCRIPT_URL` = URL deploy Google Apps Script Web App (untuk input poin & claim voucher).
- **AUTH.USERS (app.js):** Daftar user hardcoded untuk modul input point (RBMPONTI, RBMDARMO, dll.); login simpan ke `rbm_user`.
- **login.html:** Owner hardcoded `burhan` / `160502` (tidak disimpan di `rbm_users`).
- **server.js:** `CUSTOM_DB_PATH` = null atau path penuh ke file database; `server-config.json` menyimpan path yang dipilih.
- **Firebase:** Konfigurasi (apiKey, databaseURL, dll.) biasanya di custom-ui.js atau file inisialisasi Firebase; `ensureDefaultFirebaseConnection()` memastikan koneksi default.

---

## 8. Cara Menjalankan & Build

- **Print Bridge (cetak struk):** `npm start` → menjalankan `node print-bridge.js` (port 3000).
- **Server database (mode Server PC):** Jalankan terpisah `node server.js` (port 3001); optional: `node server.js "D:\Path\database.json"`.
- **Front-end:** Buka file HTML langsung (file://) atau lewat server statis; pastikan Firebase dan GAS URL sudah benar.
- **Tidak ada build step** untuk front-end (plain HTML/JS); proyek siap dipakai setelah dependency `npm install` untuk server.

---

## Lampiran: Quick Reference Key localStorage

```
rbm_user              → Sesi login
rbm_users             → Daftar user (login)
rbm_outlets           → Daftar ID outlet
rbm_outlet_names      → Nama per outlet
rbm_last_selected_outlet
rbm_db_connections    → Koneksi DB (Firebase/Server)
rbm_active_connection_index
rbm_settings          → Pengaturan umum
rbm_menu_categories   → Cache kategori menu
rbm_printer_groups, rbm_printer_config
rbm_payment_methods
rbm_points_history, rbm_vouchers
RBM_PENDING_*         → Pending sync RBM Pro
RBM_EMPLOYEES, RBM_STOK_ITEMS, dll.
```

---

*Dokumentasi ini dibuat dari penelusuran codebase untuk pegangan developer. Jika ada perubahan di struktur atau key, perbarui dokumen ini.*
