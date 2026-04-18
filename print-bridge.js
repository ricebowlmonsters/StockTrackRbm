/**
 * PRINT BRIDGE SERVER
 * Aplikasi jembatan untuk menghubungkan Web App Kasir dengan Printer Thermal via LAN/WiFi.
 */

const express = require('express');
const bodyParser = require('body-parser');
const net = require('net');

const app = express();
const PORT = 3000;

// ==========================================
// KONFIGURASI IP PRINTER (SESUAIKAN DI SINI)
// ==========================================

// 1. PILIH LOKASI AKTIF (Ganti sesuai lokasi komputer ini berada)
const LOKASI_AKTIF = 'PUSAT'; 

// 2. DAFTAR IP PRINTER PER LOKASI
const DATA_LOKASI = {
    'PUSAT': {
        'PRINTER_UTAMA': '192.168.1.100' // Masukkan IP Printer Anda di sini
    },
    'CABANG_BARU': {
        'PRINTER_UTAMA': '192.168.0.200'
    }
};

// Load konfigurasi otomatis berdasarkan LOKASI_AKTIF
const PRINTER_CONFIG = DATA_LOKASI[LOKASI_AKTIF] || {};
// ==========================================

app.use(bodyParser.json());

// Tambahkan CORS agar browser bisa mengakses localhost:3000
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// 1. Cek Status Bridge
app.get('/', (req, res) => {
    // Tampilan Dashboard Sederhana untuk Test Print
    const printerOptions = Object.keys(PRINTER_CONFIG)
        .map(name => `<option value="${name}">${name} (${PRINTER_CONFIG[name]})</option>`)
        .join('');

    res.send(`
        <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center; background-color: #f4f4f9;">
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto;">
                <h2 style="color: #4C2A85;">🖨️ Print Bridge Dashboard</h2>
                <p>Lokasi Aktif: <strong>${LOKASI_AKTIF}</strong></p>
                <p style="color: green; font-weight: bold; background: #e6fffa; padding: 10px; border-radius: 5px;">✅ Server Berjalan Normal</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                
                <h3>Test Printer Manual</h3>
                <p style="color: #666; font-size: 14px;">Pilih printer dan klik tombol di bawah untuk memastikan kertas keluar.</p>
                
                <select id="pName" style="padding: 12px; width: 100%; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 5px;">
                    ${printerOptions}
                </select>
                
                <button onclick="testPrint()" style="width: 100%; padding: 12px; background: #4C2A85; color: white; border: none; cursor: pointer; border-radius: 5px; font-weight: bold; font-size: 16px;">
                    🖨️ TEST PRINT SEKARANG
                </button>
            </div>
            <script>
                function testPrint() {
                    const name = document.getElementById('pName').value;
                    const text = "TEST PRINT BERHASIL!\\n\\nRice Bowl Monster\\n------------------\\nKoneksi OK.\\n\\n\\n\\n";
                    fetch('/print', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ printerName: name, content: text })
                    })
                    .then(r => r.json())
                    .then(d => alert(d.status === 'success' ? '✅ Berhasil dikirim ke printer!' : '❌ Gagal: ' + d.message))
                    .catch(e => alert('Error: ' + e));
                }
            </script>
        </body>
        </html>
    `);
});

// 2. Ambil Daftar Printer
app.get('/printers', (req, res) => {
    res.json({ printers: PRINTER_CONFIG });
});

// [BARU] Endpoint agar Web App tahu Lokasi Aktif dari Pengaturan
app.get('/config', (req, res) => {
    res.json({ 
        location: LOKASI_AKTIF,
        printers: PRINTER_CONFIG
    });
});

// 3. Fungsi Utama: Cetak Struk
app.post('/print', (req, res) => {
    const { printerName, printerIP, content } = req.body;

    // [BARU] Jika printerIP dikirim dari Web App (kelompok printer), pakai langsung
    const printerIPToUse = printerIP && typeof printerIP === 'string' && printerIP.trim()
        ? printerIP.trim()
        : (PRINTER_CONFIG[printerName] || null);

    if (!printerIPToUse) {
        console.error(`❌ Printer tidak ditemukan: ${printerName || 'IP tidak diberikan'}.`);
        return res.status(400).json({ status: 'error', message: 'Printer tidak ditemukan. Set nama printer di konfigurasi atau kirim printerIP dari Pengaturan Kelompok Printer.' });
    }

    const label = printerName || printerIPToUse;
    console.log(`🖨️  Mencetak ke ${label} (${printerIPToUse})...`);

    // Membuka koneksi ke Printer Thermal (Port standar 9100)
    const client = new net.Socket();
    
    // Timeout koneksi 5 detik
    client.setTimeout(5000);

    client.connect(9100, printerIPToUse, () => {
        // Kirim perintah cetak (ESC/POS commands)
        if (Array.isArray(content)) {
             const buffer = Buffer.from(content);
             client.write(buffer);
        } else {
             client.write(content);
        }
        // Tutup koneksi setelah kirim
        client.end();
    });

    client.on('timeout', () => {
        console.error(`❌ Timeout koneksi ke printer ${label}`);
        client.destroy();
        if (!res.headersSent) res.status(500).json({ status: 'error', message: 'Koneksi printer timeout' });
    });

    client.on('error', (err) => {
        console.error(`❌ Gagal konek ke printer ${label}:`, err.message);
        if (!res.headersSent) res.status(500).json({ status: 'error', message: 'Gagal koneksi ke printer: ' + err.message });
    });

    client.on('close', () => {
        if (!res.headersSent) {
            res.json({ status: 'success', message: 'Perintah cetak dikirim.' });
        }
    });
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 PRINT BRIDGE BERJALAN DI: http://localhost:${PORT}`);
    console.log(`==================================================`);
    console.log(`Lokasi Aktif: ${LOKASI_AKTIF}`);
    console.log(`Daftar Printer:`);
    console.table(PRINTER_CONFIG);
    console.log(`\nSiap menerima perintah cetak dari Web App Kasir...`);
});