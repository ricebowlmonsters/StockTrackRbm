/**
 * Fungsi untuk memformat laporan kasir sesuai layout yang diminta.
 * Layout disesuaikan untuk printer thermal (lebar default 32 karakter).
 */
function generateLaporan(data) {
    const WIDTH = 32; // Ubah ke 40, 42, atau 48 jika printer lebih lebar
    const LINE = '-'.repeat(WIDTH);

    // Helper untuk format angka (Ribuan dipisah titik: 1.000.000)
    const fmt = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    // Helper untuk padding text agar rapi
    // align: 'left' | 'center' | 'right'
    const pad = (str, len, align = 'left') => {
        let s = String(str);
        if (s.length > len) s = s.substring(0, len); // Potong jika kepanjangan
        
        const spaces = len - s.length;
        if (align === 'left') return s + ' '.repeat(spaces);
        if (align === 'right') return ' '.repeat(spaces) + s;
        
        // Center
        const left = Math.floor(spaces / 2);
        const right = spaces - left;
        return ' '.repeat(left) + s + ' '.repeat(right);
    };

    // Fungsi membuat baris 3 kolom: TYPE (Kiri), QTY (Tengah), AMOUNT (Kanan)
    // Pengaturan lebar kolom: Type=14, Qty=5, Amount=13 (Total 32)
    const row = (type, qty, amount) => {
        const col1 = 14;
        const col2 = 5;
        const col3 = WIDTH - col1 - col2; // Sisa lebar
        
        return pad(type, col1, 'left') + 
               pad(qty, col2, 'center') + 
               pad(amount, col3, 'right');
    };

    // Fungsi header section dengan garis (contoh: -------Media-------)
    const sectionHeader = (title) => {
        const textLen = title.length;
        const dashLen = Math.max(0, WIDTH - textLen);
        const leftDash = Math.floor(dashLen / 2);
        const rightDash = dashLen - leftDash;
        return '-'.repeat(leftDash) + title + '-'.repeat(rightDash);
    };

    let out = [];

    // 1. HEADER UTAMA
    out.push(LINE);
    out.push(row("TYPE", "QTY", "AMOUNT"));
    out.push(LINE);

    // 2. ITEM SALES & DISC
    out.push(row("Item Sales", data.itemSales.qty, fmt(data.itemSales.amount)));
    out.push(row("Item Disc", data.itemDisc.qty, fmt(data.itemDisc.amount)));
    out.push(row("Bill Disc", data.billDisc.qty, fmt(data.billDisc.amount)));
    out.push(""); // Baris kosong

    // 3. NET SALES
    out.push(row("Net Sales", data.netSales.qty, fmt(data.netSales.amount)));

    // 4. MEDIA SECTION
    out.push(sectionHeader("Media"));
    data.media.forEach(m => {
        out.push(row(m.name, m.qty, fmt(m.amount)));
    });
    out.push("total"); // Placeholder sesuai request

    // 5. TAX SECTION
    out.push(sectionHeader("TAX"));
    out.push("PPN10%");
    out.push("JUMLAH PPN");

    // 6. FOOTER
    out.push(LINE);
    out.push("NET SELES JUMLAH");

    return out.join('\n');
}