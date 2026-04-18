## Target arsitektur (seperti Accurate)

Tujuan: **browser tidak pernah menarik semua transaksi**. Browser hanya meminta **JSON ringan** per halaman, dan **search/filter diproses di database**.

---

## 1) Contoh Endpoint JSON (server-side pagination + filter)

Contoh query params:

- `page`: nomor halaman (mulai 1)
- `limit`: 20–50
- `search`: kata kunci
- `dateFrom`, `dateTo`: filter tanggal
- `customerId` / `customerName`: filter customer

Contoh response:

```json
{
  "meta": { "page": 1, "limit": 20, "totalRows": 9321, "totalPages": 467 },
  "data": [
    { "id": 10021, "tanggal": "2026-03-01", "customer_name": "Andi", "total": 125000 }
  ]
}
```

---

## 2) SQL Pagination (LIMIT/OFFSET) + Filtering di DB (bukan di JS)

### Contoh (MySQL/PostgreSQL)

```sql
-- Input dari API:
-- :limit = 20..50
-- :offset = (page - 1) * limit
-- :q = kata kunci (opsional)
-- :date_from, :date_to = rentang tanggal (opsional)

SELECT
  t.id,
  t.tanggal,
  c.nama AS customer_name,
  t.total
FROM transaksi t
JOIN customer c ON c.id = t.customer_id
WHERE 1=1
  AND (:date_from IS NULL OR t.tanggal >= :date_from)
  AND (:date_to   IS NULL OR t.tanggal <= :date_to)
  AND (
    :q IS NULL
    OR c.nama ILIKE '%' || :q || '%'
    OR CAST(t.id AS TEXT) ILIKE '%' || :q || '%'
  )
ORDER BY t.tanggal DESC, t.id DESC
LIMIT :limit OFFSET :offset;
```

> Catatan: `ILIKE` untuk PostgreSQL. Untuk MySQL gunakan `LIKE` (dan atur collation).

### Hitung totalRows (untuk pagination UI)

```sql
SELECT COUNT(*)
FROM transaksi t
JOIN customer c ON c.id = t.customer_id
WHERE 1=1
  AND (:date_from IS NULL OR t.tanggal >= :date_from)
  AND (:date_to   IS NULL OR t.tanggal <= :date_to)
  AND (
    :q IS NULL
    OR c.nama ILIKE '%' || :q || '%'
    OR CAST(t.id AS TEXT) ILIKE '%' || :q || '%'
  );
```

---

## 3) Efficient Query: contoh index yang relevan

### Transaksi (umum)

```sql
-- Primary key otomatis index
-- (MySQL) biasanya: id BIGINT PRIMARY KEY AUTO_INCREMENT
-- (Postgres) biasanya: id BIGSERIAL PRIMARY KEY

-- Untuk filter + sort by tanggal (paling sering dipakai)
CREATE INDEX idx_transaksi_tanggal_id ON transaksi (tanggal DESC, id DESC);

-- Untuk filter per customer
CREATE INDEX idx_transaksi_customer_tanggal ON transaksi (customer_id, tanggal DESC, id DESC);
```

### Customer (search by nama)

PostgreSQL (pencarian LIKE/ILIKE lebih kencang dengan trigram):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_customer_nama_trgm ON customer USING gin (nama gin_trgm_ops);
```

MySQL (LIKE prefix cepat, contains `%kata%` terbatas; alternatif FULLTEXT):

```sql
CREATE INDEX idx_customer_nama ON customer (nama);

-- Jika mau pencarian teks lebih kuat:
-- CREATE FULLTEXT INDEX ft_customer_nama ON customer (nama);
```

---

## 4) Praktik wajib supaya tidak lambat

- **Jangan** `SELECT *` untuk tabel besar; pilih kolom yang dipakai UI.
- **Selalu** `ORDER BY` deterministik (mis. `tanggal DESC, id DESC`) agar paging stabil.
- **Search/filter** wajib di SQL (server), **bukan** `.filter()` di browser untuk dataset besar.
- Server kirim **JSON data mentah**, jangan render HTML tabel berulang-ulang di server.

