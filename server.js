const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const os = require('os'); // [BARU] Untuk cek IP Address
const { exec } = require('child_process'); // [BARU] Untuk menjalankan perintah sistem
const crypto = require('crypto');

const app = express();
const PORT = 3001; // Port diubah ke 3001

// [KONFIGURASI] Ganti null dengan path lengkap jika ingin lokasi khusus
// Contoh Windows: "D:\\Data Kasir\\database.json" (Gunakan double backslash)
const CUSTOM_DB_PATH = null; 
const CONFIG_FILE = path.join(__dirname, 'server-config.json');

// Prioritas: 1. Config di atas, 2. Drag & Drop (Argumen), 3. Default folder ini
let currentDbFile = CUSTOM_DB_PATH || process.argv[2] || path.join(__dirname, 'database.json');

// [BARU] Cek apakah ada konfigurasi tersimpan (agar lokasi tidak reset saat restart)
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (savedConfig.dbPath) currentDbFile = savedConfig.dbPath;
    } catch (e) { console.error("Gagal memuat config:", e); }
}

// [SAFETY CHECK] Jika path yang dipilih adalah FOLDER, otomatis tambahkan 'database.json'
try {
    // Cek jika path ada dan berupa direktori
    if (fs.existsSync(currentDbFile) && fs.lstatSync(currentDbFile).isDirectory()) {
        console.log(`[INFO] Path yang dipilih adalah folder. Otomatis menambahkan filename.`);
        currentDbFile = path.join(currentDbFile, 'database.json');
    }
} catch(e) { console.error("Error checking path type:", e); }

app.use(cors());

// [BARU] Tambahkan ini untuk menyajikan file HTML, CSS, JS dari folder yang sama
app.use(express.static(__dirname));

// [BARU] Log setiap request agar terlihat di terminal
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

app.use(bodyParser.json({ limit: '50mb' })); // Limit besar untuk gambar

// ---------- Helpers ----------
function clampInt(n, min, max, fallback) {
    const v = Number.parseInt(n, 10);
    if (Number.isNaN(v)) return fallback;
    return Math.max(min, Math.min(max, v));
}

function normYyyyMmDd(s) {
    const v = (s == null ? '' : String(s)).trim();
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(v)) {
        const p = v.split('-');
        return p[0] + '-' + p[1].padStart(2, '0') + '-' + p[2].padStart(2, '0');
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
        const p = v.split('/');
        return p[2] + '-' + p[1].padStart(2, '0') + '-' + p[0].padStart(2, '0');
    }
    return v;
}

async function readDbJsonSafe() {
    return await dbCache.read();
}

// ---------- DB Cache & Atomic Write (performa tinggi untuk file JSON besar) ----------
const dbCache = (() => {
    let _cache = {};
    let _statSig = '';
    let _etag = '';
    let _writeTimer = null;
    let _writePromise = Promise.resolve();

    function _safeSigFromStat(st) {
        // cukup kuat untuk detect perubahan file tanpa hashing isi
        return String(st.size) + '|' + String(st.mtimeMs);
    }

    async function _computeEtagFromStat(st) {
        // weak etag: hash dari size + mtime; cukup untuk 304 client
        const sig = _safeSigFromStat(st);
        return 'W/"' + crypto.createHash('sha1').update(sig).digest('hex') + '"';
    }

    async function _loadIfChanged() {
        try {
            const st = await fs.promises.stat(currentDbFile);
            const sig = _safeSigFromStat(st);
            if (sig === _statSig && _cache && typeof _cache === 'object') return;
            const raw = await fs.promises.readFile(currentDbFile, 'utf8');
            _cache = JSON.parse(raw || '{}') || {};
            _statSig = sig;
            _etag = await _computeEtagFromStat(st);
        } catch (e) {
            _cache = {};
            _statSig = '';
            _etag = '';
        }
    }

    async function read() {
        await _loadIfChanged();
        return _cache || {};
    }

    function getEtag() {
        return _etag || '';
    }

    function _scheduleWrite() {
        if (_writeTimer) return;
        _writeTimer = setTimeout(() => {
            _writeTimer = null;
            _writePromise = _writePromise.then(async () => {
                const tmp = currentDbFile + '.tmp';
                const payload = JSON.stringify(_cache || {}, null, 2);
                await fs.promises.writeFile(tmp, payload, 'utf8');
                await fs.promises.rename(tmp, currentDbFile);
                const st = await fs.promises.stat(currentDbFile);
                _statSig = _safeSigFromStat(st);
                _etag = await _computeEtagFromStat(st);
            }).catch((e) => {
                console.error('DB write failed:', e);
            });
        }, 250);
    }

    function replaceAll(newObj) {
        _cache = (newObj && typeof newObj === 'object') ? newObj : {};
        _scheduleWrite();
    }

    function _ensurePath(pathStr) {
        const p = (pathStr || '').toString().trim().replace(/^\/+|\/+$/g, '');
        if (!p) return [];
        return p.split('/').filter(Boolean);
    }

    function getByPath(pathStr) {
        const parts = _ensurePath(pathStr);
        if (parts.length === 0) return _cache;
        let cur = _cache;
        for (const seg of parts) {
            if (!cur || typeof cur !== 'object' || !(seg in cur)) return null;
            cur = cur[seg];
        }
        return cur;
    }

    function setByPath(pathStr, value) {
        const parts = _ensurePath(pathStr);
        if (parts.length === 0) {
            replaceAll(value);
            return;
        }
        let cur = _cache;
        for (let i = 0; i < parts.length - 1; i++) {
            const seg = parts[i];
            if (!cur[seg] || typeof cur[seg] !== 'object') cur[seg] = {};
            cur = cur[seg];
        }
        cur[parts[parts.length - 1]] = value;
        _scheduleWrite();
    }

    function mergeByPath(pathStr, patchObj) {
        const existing = getByPath(pathStr);
        if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
            setByPath(pathStr, patchObj);
            return;
        }
        if (!patchObj || typeof patchObj !== 'object' || Array.isArray(patchObj)) {
            setByPath(pathStr, patchObj);
            return;
        }
        Object.keys(patchObj).forEach((k) => {
            existing[k] = patchObj[k];
        });
        _scheduleWrite();
    }

    function removeByPath(pathStr) {
        const parts = _ensurePath(pathStr);
        if (parts.length === 0) {
            replaceAll({});
            return;
        }
        let cur = _cache;
        for (let i = 0; i < parts.length - 1; i++) {
            const seg = parts[i];
            if (!cur || typeof cur !== 'object' || !(seg in cur)) return;
            cur = cur[seg];
        }
        if (cur && typeof cur === 'object') {
            delete cur[parts[parts.length - 1]];
            _scheduleWrite();
        }
    }

    async function flush() {
        await _writePromise;
    }

    return { read, replaceAll, getByPath, setByPath, mergeByPath, removeByPath, getEtag, flush };
})();

// Load DB awal jika belum ada
// [BARU] Buat folder secara otomatis jika belum ada (misal D:\Data Baru\)
const dbDir = path.dirname(currentDbFile);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

if (!fs.existsSync(currentDbFile)) {
    fs.writeFileSync(currentDbFile, JSON.stringify({}, null, 2));
}

// [BARU] Cek Info Server (Untuk memastikan lokasi file)
app.get('/info', (req, res) => {
    res.json({ 
        status: 'online', 
        port: PORT, 
        dbFile: currentDbFile 
    });
});

// ---------- API JSON: Server-side Pagination & Filtering ----------
// Catatan: Ini bekerja untuk data yang tersimpan di file JSON (currentDbFile).
// Untuk SQL (MySQL/Postgres), pola endpoint-nya sama; query-nya diganti LIMIT/OFFSET.

// ---------- Petty Cash Ledger Cache (hindari scan bertahun-tahun setiap request) ----------
// Masalah utama: untuk menghitung saldoAwal periode, server dulu mengiterasi semua transaksi sebelum `from`.
// Solusi: bangun ledger per-outlet (prefix saldo per tanggal) sekali per perubahan DB file (ETag).
const pettyCashLedgerCache = (() => {
    /** @type {Record<string, { etag: string, ledgers: Record<string, any> }>} */
    let state = { etag: '', ledgers: {} };

    function _getOutletNode(dbJson, outlet) {
        const root = (dbJson && dbJson.rbm_pro && dbJson.rbm_pro.petty_cash) ? dbJson.rbm_pro.petty_cash : {};
        if (!root || typeof root !== 'object') return {};
        const node = (root[outlet] && typeof root[outlet] === 'object') ? root[outlet] : {};
        return node && typeof node === 'object' ? node : {};
    }

    function _extractTransactionsArray(node) {
        if (!node || typeof node !== 'object') return [];
        if (Array.isArray(node.transactions)) return node.transactions;
        if (node.transactions && typeof node.transactions === 'object') return Object.values(node.transactions);
        return [];
    }

    function _buildLedgerForOutlet(outletNode) {
        const dateKeys = Object.keys(outletNode)
            .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
            .sort();

        /** prefixSaldoEnd[dateKey] = saldo setelah semua trx di dateKey */
        const prefixSaldoEnd = {};
        /** dayTotals[dateKey] = { debit, kredit } */
        const dayTotals = {};
        /** dayCounts[dateKey] = jumlah transaksi di tanggal tsb */
        const dayCounts = {};

        let saldo = 0;
        for (const dateKey of dateKeys) {
            const arr = _extractTransactionsArray(outletNode[dateKey]);
            let dayDebit = 0;
            let dayKredit = 0;
            for (const r of arr) {
                const debit = Number.parseFloat(r?.debit ?? r?.keluar ?? 0) || 0;
                const kredit = Number.parseFloat(r?.kredit ?? r?.masuk ?? 0) || 0;
                dayDebit += debit;
                dayKredit += kredit;
                // saldo: starting saldo + kredit - debit
                saldo = saldo - debit + kredit;
            }
            dayTotals[dateKey] = { debit: dayDebit, kredit: dayKredit };
            dayCounts[dateKey] = arr.length;
            prefixSaldoEnd[dateKey] = saldo;
        }

        return { dateKeys, prefixSaldoEnd, dayTotals, dayCounts };
    }

    function _getSaldoAwal(ledger, from) {
        if (!from) return 0;
        // cari date terakhir < from
        const keys = ledger.dateKeys;
        // binary search
        let lo = 0, hi = keys.length - 1, ansIdx = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (keys[mid] < from) { ansIdx = mid; lo = mid + 1; }
            else hi = mid - 1;
        }
        if (ansIdx < 0) return 0;
        return Number(ledger.prefixSaldoEnd[keys[ansIdx]] || 0) || 0;
    }

    return {
        getLedger: async (outlet) => {
            const etag = dbCache.getEtag() || '';
            if (etag && state.etag !== etag) {
                state = { etag, ledgers: {} };
            }
            if (state.ledgers[outlet]) return state.ledgers[outlet];
            const dbJson = await dbCache.read();
            const outletNode = _getOutletNode(dbJson, outlet);
            const ledger = _buildLedgerForOutlet(outletNode);
            state.ledgers[outlet] = ledger;
            return ledger;
        },
        getSaldoAwal: (ledger, from) => _getSaldoAwal(ledger, from),
        /** saldo akhir sampai tanggal `to` (inclusive). Jika to kosong -> saldo akhir terakhir. */
        getSaldoAtEndOf: (ledger, to) => {
            const keys = ledger.dateKeys || [];
            if (!keys.length) return 0;
            if (!to) return Number(ledger.prefixSaldoEnd[keys[keys.length - 1]] || 0) || 0;
            // date terakhir <= to
            let lo = 0, hi = keys.length - 1, ansIdx = -1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (keys[mid] <= to) { ansIdx = mid; lo = mid + 1; }
                else hi = mid - 1;
            }
            if (ansIdx < 0) return 0;
            return Number(ledger.prefixSaldoEnd[keys[ansIdx]] || 0) || 0;
        }
    };
})();

app.get('/api/petty-cash', async (req, res) => {
    try {
        const outlet = (req.query.outlet || 'default').toString().trim() || 'default';
        const from = normYyyyMmDd(req.query.from || '');
        const to = normYyyyMmDd(req.query.to || '');
        const search = (req.query.search || '').toString().trim().toLowerCase();
        const order = (req.query.order || req.query.sort || '').toString().trim().toLowerCase();
        const desc = (order === 'desc' || order === 'descending' || order === 'newest');

        const limit = clampInt(req.query.limit, 20, 50, 20);
        const page = clampInt(req.query.page, 1, 1_000_000, 1);
        const offset = (page - 1) * limit;

        const dbJson = await readDbJsonSafe();
        const root = (dbJson && dbJson.rbm_pro && dbJson.rbm_pro.petty_cash) ? dbJson.rbm_pro.petty_cash : {};
        const outletNode = (root && typeof root === 'object' && root[outlet] && typeof root[outlet] === 'object') ? root[outlet] : {};

        // Ledger cache: saldoAwal tanpa scan bertahun-tahun
        const ledger = await pettyCashLedgerCache.getLedger(outlet);
        const saldoAwal = pettyCashLedgerCache.getSaldoAwal(ledger, from);

        // Kumpulkan daftar tanggal (node per tanggal: YYYY-MM-DD)
        const dateKeys = ledger.dateKeys || Object.keys(outletNode)
            .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
            .sort();

        // ==== FAST PATH (tanpa search): summary & totalRows dihitung per-hari, bukan scan semua transaksi ====
        if (!search) {
            // hitung totalRows dari dayCounts, totalDebit/Kredit dari dayTotals (per-hari)
            let totalRows = 0;
            let totalDebit = 0;
            let totalKredit = 0;
            for (const dateKey of dateKeys) {
                if (from && dateKey < from) continue;
                if (to && dateKey > to) break;
                totalRows += Number(ledger.dayCounts?.[dateKey] || 0) || 0;
                const t = ledger.dayTotals?.[dateKey];
                if (t) {
                    totalDebit += Number(t.debit || 0) || 0;
                    totalKredit += Number(t.kredit || 0) || 0;
                }
            }

            // ambil slice rows (offset/limit) dengan scan minimal
            const rows = [];
            let runningSaldo = saldoAwal;
            let seen = 0;
            let emitted = 0;
            const offsetUsed = desc ? Math.max(0, totalRows - page * limit) : offset;

            for (const dateKey of dateKeys) {
                if (from && dateKey < from) continue;
                if (to && dateKey > to) break;
                const node = outletNode[dateKey];
                const arr = node && Array.isArray(node.transactions)
                    ? node.transactions
                    : (node && node.transactions && typeof node.transactions === 'object' ? Object.values(node.transactions) : []);

                for (let idx = 0; idx < arr.length; idx++) {
                    const r = arr[idx] || {};
                    const debit = Number.parseFloat(r.debit ?? r.keluar ?? 0) || 0;
                    const kredit = Number.parseFloat(r.kredit ?? r.masuk ?? 0) || 0;
                    runningSaldo = runningSaldo - debit + kredit;
                    seen++;
                    if (seen <= offsetUsed) continue;
                    if (emitted >= limit) break;
                    rows.push({
                        no: offsetUsed + emitted + 1,
                        tanggal: r.tanggalStr || r.tanggal || r.date || dateKey,
                        nama: (r.nama || '').toString(),
                        jumlah: r.jumlah,
                        satuan: r.satuan || '',
                        harga: r.harga,
                        debit: debit,
                        kredit: kredit,
                        saldo: runningSaldo,
                        _dateKey: dateKey,
                        _indexInDate: idx
                    });
                    emitted++;
                }
                if (emitted >= limit) break;
            }

            const saldoAkhir = pettyCashLedgerCache.getSaldoAtEndOf(ledger, to) || runningSaldo;
            const totalPages = Math.max(1, Math.ceil(totalRows / limit));
            if (desc && rows.length) {
                // tampilkan "terbaru dulu": kebalikan urutan, no ditetapkan ulang per page
                rows.reverse().forEach((r, i) => { r.no = i + 1; delete r._dateKey; delete r._indexInDate; });
            } else {
                // jangan bawa properti internal
                rows.forEach(r => { delete r._dateKey; delete r._indexInDate; });
            }
            res.json({
                meta: { page, limit, offset: offsetUsed, totalRows, totalPages },
                summary: { totalDebit, totalKredit, saldoAwal, saldoAkhir },
                data: rows
            });
            return;
        }

        // ==== SLOW PATH (search): perlu scan transaksi untuk LIKE filter ====
        let totalDebit = 0;
        let totalKredit = 0;
        let runningSaldo = saldoAwal;
        let totalMatchedRows = 0;
        let emitted = 0;
        const rows = [];

        // Jika desc+search, simpan dulu semua baris yang cocok supaya bisa ambil slice dari akhir.
        const allMatchedRows = desc && search ? [] : null;

        for (const dateKey of dateKeys) {
            if (from && dateKey < from) continue;
            if (to && dateKey > to) break;
            const node = outletNode[dateKey];
            const arr = node && Array.isArray(node.transactions)
                ? node.transactions
                : (node && node.transactions && typeof node.transactions === 'object' ? Object.values(node.transactions) : []);

            for (let idx = 0; idx < arr.length; idx++) {
                const r = arr[idx] || {};
                const nama = (r.nama || '').toString();
                const debit = Number.parseFloat(r.debit ?? r.keluar ?? 0) || 0;
                const kredit = Number.parseFloat(r.kredit ?? r.masuk ?? 0) || 0;
                totalDebit += debit;
                totalKredit += kredit;
                runningSaldo = runningSaldo - debit + kredit;

                if (search && !nama.toLowerCase().includes(search)) continue;
                totalMatchedRows++;
                const rowObj = {
                    no: totalMatchedRows, // nanti di-reassign kalau desc
                    tanggal: r.tanggalStr || r.tanggal || r.date || dateKey,
                    nama: nama,
                    jumlah: r.jumlah,
                    satuan: r.satuan || '',
                    harga: r.harga,
                    debit: debit,
                    kredit: kredit,
                    saldo: runningSaldo,
                    _dateKey: dateKey,
                    _indexInDate: idx
                };

                if (allMatchedRows) {
                    allMatchedRows.push(rowObj);
                } else {
                    if (totalMatchedRows <= offset) continue;
                    if (emitted >= limit) continue;
                    rows.push(rowObj);
                    emitted++;
                }
            }
        }

        let outRows = rows;
        let outTotalRows = totalMatchedRows;
        if (allMatchedRows) {
            const start = Math.max(0, totalMatchedRows - page * limit);
            const end = Math.max(0, totalMatchedRows - (page - 1) * limit);
            const pageRowsAsc = allMatchedRows.slice(start, end);
            outRows = pageRowsAsc.reverse().map((r, i) => {
                delete r._dateKey; delete r._indexInDate;
                return Object.assign({}, r, { no: i + 1 });
            });
        } else {
            outRows.forEach(r => { delete r._dateKey; delete r._indexInDate; });
        }

        const totalPages = Math.max(1, Math.ceil(outTotalRows / limit));
        res.json({
            meta: { page, limit, offset, totalRows: outTotalRows, totalPages },
            summary: { totalDebit, totalKredit, saldoAwal, saldoAkhir: runningSaldo },
            data: outRows
        });
    } catch (e) {
        res.status(500).json({ error: true, message: e.message || String(e) });
    }
});

app.get('/api/inventaris', async (req, res) => {
    try {
        const outlet = (req.query.outlet || '_default').toString().trim() || '_default';
        const from = normYyyyMmDd(req.query.from || '').replace(/-/g, '_');
        const to = normYyyyMmDd(req.query.to || '').replace(/-/g, '_');
        const search = (req.query.search || '').toString().trim().toLowerCase();

        const limit = clampInt(req.query.limit, 20, 50, 20);
        const page = clampInt(req.query.page, 1, 1_000_000, 1);
        const offset = (page - 1) * limit;

        const dbJson = await readDbJsonSafe();
        const datesRoot = dbJson?.rbm_pro?.inventaris?.[outlet]?.dates || {};
        const dateKeys = Object.keys(datesRoot)
            .filter(k => /^\d{4}_\d{2}_\d{2}$/.test(k))
            .sort();

        let totalRows = 0;
        let emitted = 0;
        const rows = [];

        for (const dateKey of dateKeys) {
            if (from && dateKey < from) continue;
            if (to && dateKey > to) break;
            const itemsObj = datesRoot[dateKey];
            if (!itemsObj || typeof itemsObj !== 'object') continue;
            const namaKeys = Object.keys(itemsObj);
            for (const nama of namaKeys) {
                const namaStr = (nama || '').toString();
                if (search && !namaStr.toLowerCase().includes(search)) continue;
                totalRows++;
                if (totalRows <= offset) continue;
                if (emitted >= limit) continue;
                rows.push({
                    tanggal: dateKey.replace(/_/g, '-'),
                    nama: namaStr,
                    jumlah: String(itemsObj[nama] ?? '')
                });
                emitted++;
            }
        }

        const totalPages = Math.max(1, Math.ceil(totalRows / limit));
        res.json({ meta: { page, limit, offset, totalRows, totalPages }, data: rows });
    } catch (e) {
        res.status(500).json({ error: true, message: e.message || String(e) });
    }
});

// Pembukuan: paging per tanggal (bukan per baris) supaya cepat & stabil
app.get('/api/pembukuan', async (req, res) => {
    try {
        const outlet = (req.query.outlet || '_default').toString().trim() || '_default';
        const from = normYyyyMmDd(req.query.from || '');
        const to = normYyyyMmDd(req.query.to || '');

        const daysPerPage = clampInt(req.query.daysPerPage || req.query.limit, 3, 15, 7);
        const page = clampInt(req.query.page, 1, 1_000_000, 1);
        const offsetDays = (page - 1) * daysPerPage;

        const dbJson = await readDbJsonSafe();
        const root = dbJson?.rbm_pro?.pembukuan || {};
        const outletNode = (root && typeof root === 'object' && root[outlet] && typeof root[outlet] === 'object') ? root[outlet] : {};

        const dateKeys = Object.keys(outletNode)
            .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
            .sort();

        let saldoAwal = 0;
        let totalCashMasuk = 0;
        let totalKasKeluar = 0;
        let totalSemuaMasuk = 0;
        
        for (const d of dateKeys) {
            const node = outletNode[d] || {};
            const kasMasuk = Array.isArray(node.kasMasuk) ? node.kasMasuk : [];
            const kasKeluar = Array.isArray(node.kasKeluar) ? node.kasKeluar : [];
            
            if (from && d < from) {
                for (const km of kasMasuk) {
                    if (km?.keterangan && String(km.keterangan).toUpperCase() === 'CASH') {
                        saldoAwal += parseFloat(km.fisik) || 0;
                    }
                }
                for (const kk of kasKeluar) {
                    saldoAwal -= parseFloat(kk.setor) || 0;
                }
            } else if ((!from || d >= from) && (!to || d <= to)) {
                for (const km of kasMasuk) {
                    let fVal = parseFloat(km.fisik) || 0;
                    let cVal = parseFloat(km.catatan) || 0;
                    totalSemuaMasuk += cVal;

                    if (km?.keterangan && String(km.keterangan).toUpperCase() === 'CASH') {
                        totalCashMasuk += parseFloat(km.fisik) || 0;
                    }
                }
                for (const kk of kasKeluar) {
                    totalKasKeluar += parseFloat(kk.setor) || 0;
                }
            }
        }

        const filteredDates = dateKeys.filter(d => (!from || d >= from) && (!to || d <= to));
        const totalDays = filteredDates.length;
        const totalPages = Math.max(1, Math.ceil(totalDays / daysPerPage));
        const pageDates = filteredDates.slice(offsetDays, offsetDays + daysPerPage);

        const days = pageDates.map(d => {
            const node = outletNode[d] || {};
            const kasMasuk = Array.isArray(node.kasMasuk) ? node.kasMasuk : [];
            const kasKeluar = Array.isArray(node.kasKeluar) ? node.kasKeluar : [];
            // Jangan kirim foto base64/url untuk list (biar ringan)
            const kasKeluarSlim = kasKeluar.map(k => ({ keterangan: k?.keterangan || '', setor: k?.setor || '', hasFoto: !!k?.foto }));
            const kasMasukSlim = kasMasuk.map(k => ({
                keterangan: k?.keterangan || '',
                catatan: k?.catatan || '',
                fisik: k?.fisik || '',
                vcr: k?.vcr || '',
                komentarFisik: k?.komentarFisik || '',
                komentarSelisih: k?.komentarSelisih || ''
            }));
            return { tanggal: d, kasMasuk: kasMasukSlim, kasKeluar: kasKeluarSlim };
        });

        res.json({
            meta: { page, daysPerPage, totalDays, totalPages },
            data: days,
            summary: { saldoAwal, totalCashMasuk, totalKasKeluar, saldoAkhir: saldoAwal + totalCashMasuk - totalKasKeluar, totalSemuaMasuk }
        });
    } catch (e) {
        res.status(500).json({ error: true, message: e.message || String(e) });
    }
});

// ---------- Admin: Purge Foto Petty Cash (Mode Server PC / file JSON) ----------
app.post('/api/petty-cash/purge-photos', async (req, res) => {
    try {
        const outlet = (req.query.outlet || 'default').toString().trim() || 'default';
        const from = normYyyyMmDd(req.query.from || '');
        const to = normYyyyMmDd(req.query.to || '');

        const dbJson = await readDbJsonSafe();
        const root = (dbJson && dbJson.rbm_pro && dbJson.rbm_pro.petty_cash) ? dbJson.rbm_pro.petty_cash : {};
        const outletNode = (root && typeof root === 'object' && root[outlet] && typeof root[outlet] === 'object') ? root[outlet] : null;
        if (!outletNode) return res.json({ success: true, updated: 0 });

        const dateKeys = Object.keys(outletNode)
            .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
            .sort();

        let updated = 0;
        for (const dateKey of dateKeys) {
            if (from && dateKey < from) continue;
            if (to && dateKey > to) break;
            const node = outletNode[dateKey];
            if (!node || typeof node !== 'object') continue;
            const tx = node.transactions;
            if (Array.isArray(tx)) {
                for (let i = 0; i < tx.length; i++) {
                    if (tx[i] && tx[i].foto) {
                        tx[i].foto = '';
                        updated++;
                    }
                }
            } else if (tx && typeof tx === 'object') {
                Object.keys(tx).forEach((k) => {
                    if (tx[k] && tx[k].foto) {
                        tx[k].foto = '';
                        updated++;
                    }
                });
            }
        }

        // tulis balik via cache
        dbCache.replaceAll(dbJson);
        await dbCache.flush();
        res.json({ success: true, updated });
    } catch (e) {
        res.status(500).json({ error: true, message: e.message || String(e) });
    }
});

// [BARU] Endpoint untuk membuka dialog "Save As" (Pilih Folder & Nama)
app.post('/admin/browse-save', (req, res) => {
    // Dapatkan folder saat ini agar dialog mulai dari sana
    let currentDir = path.dirname(path.resolve(currentDbFile));
    // [FIX] Escape single quotes untuk PowerShell agar path tidak error
    currentDir = currentDir.replace(/'/g, "''");

    // Script PowerShell untuk membuka dialog Save File Windows
    // [FIX] Menggunakan single quotes untuk string PowerShell dan flatten command
    const psCommand = `
        Add-Type -AssemblyName System.Windows.Forms;
        $FileBrowser = New-Object System.Windows.Forms.SaveFileDialog;
        $FileBrowser.Filter = 'JSON Database (*.json)|*.json|All Files (*.*)|*.*';
        $FileBrowser.Title = 'Pilih Lokasi Database Baru';
        $FileBrowser.FileName = 'database_baru.json';
        $FileBrowser.InitialDirectory = '${currentDir}';
        $result = $FileBrowser.ShowDialog();
        if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Host $FileBrowser.FileName }
    `.replace(/\n/g, ' ');

    // [FIX] Tambahkan -ApartmentState STA agar dialog muncul (Penting!)
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -ApartmentState STA -Command "${psCommand.replace(/"/g, '\\"')}"`, { timeout: 0 }, (error, stdout, stderr) => {
        const selectedPath = stdout ? stdout.trim() : '';
        if (selectedPath) {
            res.json({ status: 'success', path: selectedPath });
        } else {
            res.json({ status: 'cancelled' });
        }
    });
});

// [BARU] Endpoint untuk mengubah lokasi database dari UI
app.post('/admin/config', (req, res) => {
    const { dbPath } = req.body;
    if (!dbPath) return res.status(400).json({ status: 'error', message: 'Path tidak boleh kosong' });

    try {
        // [BARU] Cek jika user hanya memasukkan folder, tambahkan database.json
        let finalPath = dbPath;
        if (fs.existsSync(dbPath) && fs.lstatSync(dbPath).isDirectory()) {
            finalPath = path.join(dbPath, 'database.json');
        }

        // Buat folder jika belum ada
        const dir = path.dirname(finalPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Buat file database kosong jika belum ada
        if (!fs.existsSync(finalPath)) fs.writeFileSync(finalPath, '{}');

        // Update variabel global
        currentDbFile = finalPath;

        // Simpan ke file config agar permanen
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ dbPath: currentDbFile }, null, 2));

        console.log(`[CONFIG] Lokasi database diubah ke: ${currentDbFile}`);
        res.json({ status: 'success', dbPath: currentDbFile });
    } catch (e) {
        console.error("Gagal ubah lokasi:", e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// GET Data
app.get('/db', (req, res) => {
    (async () => {
        await dbCache.read();

        const etag = dbCache.getEtag();
        if (etag) res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'no-cache');
        if (etag && req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
        }

        // Mode cepat: ambil hanya sebagian data (hindari kirim DB penuh)
        // - /db?path=rbm_pro/petty_cash/default
        // - /db?paths=a,b,c  -> { a:..., b:..., c:... }
        const pathQ = (req.query.path || '').toString().trim();
        const pathsQ = (req.query.paths || '').toString().trim();

        if (pathsQ) {
            const parts = pathsQ.split(',').map(s => s.trim()).filter(Boolean);
            const out = {};
            for (const p of parts) out[p] = dbCache.getByPath(p);
            res.json(out);
            return;
        }
        if (pathQ) {
            res.json(dbCache.getByPath(pathQ));
            return;
        }

        // Default: return seluruh DB (compat lama)
        res.json(await dbCache.read());
    })().catch((err) => {
        res.status(500).json({ error: true, message: err?.message || String(err) });
    });
});

// SAVE Data
app.post('/db', (req, res) => {
    (async () => {
        const newData = req.body;
        await dbCache.read();
        dbCache.replaceAll(newData && typeof newData === 'object' ? newData : {});
        await dbCache.flush();
        res.json({ success: true });
    })().catch((err) => {
        res.status(500).json({ error: true, message: err?.message || String(err) });
    });
});

// SAVE sebagian data (per-path) — jauh lebih cepat dari baca/tulis DB penuh
// Body:
//  - { path: "a/b/c", value: <any>, mode?: "set"|"merge" }  (default set)
app.post('/db/path', (req, res) => {
    (async () => {
        const body = req.body || {};
        const p = (body.path || '').toString();
        const mode = (body.mode || 'set').toString();
        const value = body.value;
        await dbCache.read();
        if (!p) return res.status(400).json({ error: true, message: 'path wajib diisi' });
        if (mode === 'merge') dbCache.mergeByPath(p, value);
        else dbCache.setByPath(p, value);
        await dbCache.flush();
        res.json({ success: true });
    })().catch((err) => {
        res.status(500).json({ error: true, message: err?.message || String(err) });
    });
});

// DELETE sebagian data (per-path)
app.delete('/db/path', (req, res) => {
    (async () => {
        const p = (req.query.path || '').toString();
        await dbCache.read();
        if (!p) return res.status(400).json({ error: true, message: 'path wajib diisi' });
        dbCache.removeByPath(p);
        await dbCache.flush();
        res.json({ success: true });
    })().catch((err) => {
        res.status(500).json({ error: true, message: err?.message || String(err) });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server Database Lokal berjalan di http://localhost:${PORT}`);
    
    // [BARU] Tampilkan IP LAN untuk akses dari device lain
    const interfaces = os.networkInterfaces();
    let lanIp = 'localhost';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                lanIp = iface.address;
            }
        }
    }
    console.log(`📡 Akses dari HP/PC lain (Satu WiFi): http://${lanIp}:${PORT}/db`);
    console.log(`📂 Data tersimpan di: ${currentDbFile}`);
});
