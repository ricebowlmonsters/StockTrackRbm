# Build 14 RBM Pro HTML pages from Input Data lama.html
$ErrorActionPreference = "Stop"
$baseDir = "c:\Users\RUFINA\Documents\Koding\KASIR\wep app kasir"
$src = Join-Path $baseDir "Input Data lama.html"
$lines = Get-Content $src -Encoding UTF8

function Get-ViewHtml($start, $end) {
    $lines[($start-1)..($end-1)] -join "`n"
}

$modals = @'
<span class="watermark">RBM Pro 2.3</span>
<div id="imageModal" class="modal-overlay" onclick="closeImageModal()">
  <span class="modal-close">&times;</span>
  <img id="modalImage" class="modal-content">
</div>
<div id="gpsDetailModal" class="modal-overlay" style="display:none; align-items:center; justify-content:center;" onclick="closeGpsDetailModal()">
  <div class="modal-content" style="background:white; padding:24px; max-width:420px; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.15);" onclick="event.stopPropagation()">
    <span class="modal-close" onclick="closeGpsDetailModal()" style="color:#333; top:10px; right:14px; cursor:pointer;">&times;</span>
    <h3 id="gpsDetailModalTitle" style="margin:0 0 12px; font-size:18px;">Detail</h3>
    <div id="gpsDetailModalBody" style="font-size:14px; line-height:1.6; color:#334155;"></div>
    <p style="margin:12px 0 0; font-size:12px; color:#64748b;">Aturan: 10 menit telat = 1 jam (masuk ke Rekap Gaji)</p>
  </div>
</div>
<div id="jadwalModal" class="modal-overlay" style="display:none; align-items:flex-start; padding-top: 50px; overflow-y: auto;">
  <div class="modal-content" style="background:white; padding:20px; width:900px; max-width:95%; border-radius:8px; position: relative; height: auto; max-height: 90vh; display: flex; flex-direction: column;">
    <span class="modal-close" onclick="closeJadwalModal()" style="color: #333; top: 10px; right: 15px;">&times;</span>
    <h3 style="margin-top:0;">Preview & Print Jadwal</h3>
    <div style="display:flex; gap:10px; align-items:flex-end; margin-bottom:15px; flex-wrap: wrap;">
      <div><label style="font-size:12px; display:block; margin-bottom:4px;">Tanggal Mulai</label><input type="date" id="jadwal_preview_start" style="padding:8px;"></div>
      <div><label style="font-size:12px; display:block; margin-bottom:4px;">Tanggal Selesai</label><input type="date" id="jadwal_preview_end" style="padding:8px;"></div>
      <div style="flex-grow: 1; min-width: 200px;"><label style="font-size:12px; display:block; margin-bottom:4px;">Catatan Tambahan</label><input type="text" id="jadwal_notes" style="padding:8px; width: 100%; box-sizing: border-box;" placeholder="Ketik catatan..." oninput="updateJadwalPreview()"></div>
      <button class="btn btn-primary" onclick="updateJadwalPreview()" style="margin-bottom:0; width:auto;">Lihat Preview</button>
      <button class="btn btn-secondary" onclick="printJadwalPreview()" style="margin-bottom:0; width:auto; background: #0d6efd; color: white;">Print</button>
      <button class="btn btn-secondary" onclick="saveJadwalImage()" style="margin-bottom:0; width:auto; background: #198754; color: white;">Save JPG</button>
    </div>
    <div id="jadwalPreviewArea" style="flex: 1; overflow: auto; border: 1px solid #eee; padding: 10px;"><p style="text-align:center; color:#888;">Silakan pilih tanggal dan klik Lihat Preview</p></div>
  </div>
</div>
<div id="stokItemModal" class="modal-overlay" style="display:none;">
  <div class="modal-content" style="background:white; padding:20px; width:500px; max-width:95%; border-radius:8px; max-height: 80vh; overflow-y: auto;">
    <span class="modal-close" onclick="document.getElementById('stokItemModal').style.display='none'" style="color:#333; top:10px; right:15px; font-size:24px;">&times;</span>
    <h3 style="margin-top:0;">Kelola Item Stok</h3>
    <div style="display:flex; gap:10px; margin-bottom:15px; justify-content: flex-end;">
      <button class="btn-secondary" onclick="triggerStokImport()" style="font-size:12px; padding:5px 10px; background:#198754; color:white; border:none;">Import Excel</button>
      <button class="btn-secondary" onclick="exportStokItemsToExcel()" style="font-size:12px; padding:5px 10px; background:#0d6efd; color:white; border:none;">Export Excel</button>
      <input type="file" id="importStokInput" accept=".xlsx, .xls" style="display:none" onchange="processStokImport(this)">
    </div>
    <div style="margin-bottom: 15px; display: flex; gap: 8px; align-items: flex-end;">
      <div style="flex:2;"><label style="font-size:11px; display:block; margin-bottom:2px; color:#666;">Nama Item</label><input type="text" id="new_stok_name" placeholder="Contoh: Saus Vietnam" style="width:100%;"></div>
      <div style="flex:1;"><label style="font-size:11px; display:block; margin-bottom:2px; color:#666;">Satuan</label><input type="text" id="new_stok_unit" placeholder="Gr/Ml/Pcs" style="width:100%;"></div>
      <div style="flex:1;"><label style="font-size:11px; display:block; margin-bottom:2px; color:#666;">Qty per Porsi</label><input type="number" id="new_stok_qty_porsi" placeholder="70" style="width:100%;"></div>
      <button class="btn-primary" onclick="addStokItem()" style="width:auto; height:42px; margin-bottom:1px;">+</button>
    </div>
    <table class="data-table"><thead><tr><th>Nama</th><th>Satuan</th><th>Qty/Porsi</th><th>Aksi</th></tr></thead><tbody id="stok_item_tbody"></tbody></table>
    <div style="margin-top:10px; font-size:11px; color:#666;">* <b>Qty per Porsi</b>: Jumlah satuan yang dibutuhkan untuk 1 porsi.</div>
  </div>
</div>
<div id="memoModalOverlay" class="memo-modal-overlay" onclick="closeMemoPopup()">
  <div class="memo-modal" onclick="event.stopPropagation()"><div id="memoModalContent"></div><button class="memo-modal-close" onclick="closeMemoPopup()">Tutup</button></div>
</div>
<div id="editInventarisModal" class="modal-overlay" style="display:none;">
  <div class="modal-content" style="background:white; padding:24px; width:320px; max-width:90%; border-radius:12px; text-align:center; height: auto; overflow: visible;">
    <h3 style="margin-top:0;">Edit Inventaris</h3>
    <p id="editInvInfo" style="font-size:14px; color:#64748b; margin-bottom:20px; line-height: 1.5;"></p>
    <input type="hidden" id="editInvNama"><input type="hidden" id="editInvTanggal">
    <div style="margin-bottom:20px;"><label style="text-align:left; display:block; margin-bottom:8px; font-weight:600; font-size:13px;">Jumlah Baru</label><input type="number" id="editInvJumlah" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; font-size:16px;"></div>
    <div style="display:flex; gap:8px; justify-content:center;">
      <button class="btn btn-primary" onclick="saveEditInventaris()" style="margin-top:0; flex:1;">Simpan</button>
      <button class="btn btn-small-danger" onclick="deleteEditInventaris()" style="flex:1; font-size:14px;">Hapus</button>
      <button class="btn btn-secondary" onclick="closeEditInventaris()" style="flex:1;">Batal</button>
    </div>
  </div>
</div>
'@

$head = @'
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RBM Pro</title>
  <link rel="stylesheet" href="rbm-pro.css">
</head>
<body>
<header class="rbm-page-header">
  <a href="index.html" class="rbm-back-btn">&#8249;</a>
  <h1 class="rbm-page-title">PAGE_TITLE</h1>
</header>
<div class="rbm-content-wrap">
<section class="rbm-outlet-card">
  <label for="rbm-outlet-select" class="rbm-outlet-label">Pilih Outlet:</label>
  <select id="rbm-outlet-select" class="rbm-outlet-select"></select>
</section>
<script>
(function(){
  var u = JSON.parse(localStorage.getItem('rbm_user') || '{}');
  var outlets = JSON.parse(localStorage.getItem('rbm_outlets') || '[]');
  var names = JSON.parse(localStorage.getItem('rbm_outlet_names') || '{}');
  var sel = document.getElementById('rbm-outlet-select');
  if (sel) {
    sel.innerHTML = '';
    outlets.forEach(function(id) {
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = names[id] || (id.charAt(0).toUpperCase() + id.slice(1));
      sel.appendChild(opt);
    });
    if (u.role === 'manager' && u.outlet) {
      sel.value = u.outlet;
      sel.disabled = true;
    } else {
      var last = localStorage.getItem('rbm_last_selected_outlet');
      if (last && outlets.indexOf(last) >= 0) sel.value = last;
      else if (outlets.length) sel.value = outlets[0];
      sel.addEventListener('change', function() { localStorage.setItem('rbm_last_selected_outlet', sel.value); });
    }
  }
})();
</script>
<div class="app-layout">
  <main class="app-main" style="margin-left:0;">
'@

$foot = @'

  </main>
</div>
</div>
'@ + $modals + @'

<script>window.RBM_PAGE = 'PAGEID';</script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>
<script src="rbm-pro-storage.js"></script>
<script src="rbm-pro.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
</body>
</html>
'@

# (filename, pageId, startLine, endLine, pageTitle)
$pages = @(
    @("rbm-input-petty-cash.html", "input-petty-cash-view", 596, 621, "Input Petty Cash"),
    @("rbm-input-barang.html", "input-barang-view", 1167, 1194, "Barang"),
    @("rbm-input-keuangan.html", "input-keuangan-view", 1196, 1221, "Keuangan"),
    @("rbm-input-inventaris.html", "input-inventaris-view", 1223, 1240, "Inventaris"),
    @("rbm-pembukuan-keuangan.html", "pembukuan-keuangan-view", 1242, 1267, "Input Keuangan (Pembukuan)"),
    @("rbm-pengajuan.html", "pengajuan-view", 1269, 1288, "Pengajuan"),
    @("rbm-reservasi.html", "reservasi-view", 1291, 1368, "Reservasi"),
    @("rbm-absensi-gps.html", "absensi-gps-view", 1552, 1604, "Absensi GPS"),
    @("rbm-lihat-pembukuan.html", "lihat-pembukuan-view", 1069, 1125, "Pembukuan"),
    @("rbm-lihat-inventaris.html", "lihat-inventaris-view", 1128, 1165, "Lihat Inventaris"),
    @("rbm-rekap-absensi-gps.html", "rekap-absensi-gps-view", 1607, 1660, "Rekap Absensi GPS")
)

foreach ($p in $pages) {
    $outPath = Join-Path $baseDir $p[0]
    $pageId = $p[1]
    $pageTitle = $p[4]
    $content = Get-ViewHtml $p[2] $p[3]
    $content = $content -replace ' style="display:none;"', '' -replace ' style="display:none; max-width: 100%; overflow-x: hidden;"', ''
    $html = $head + "`n" + $content + "`n" + $foot -replace 'PAGEID', $pageId -replace 'PAGE_TITLE', $pageTitle
    [System.IO.File]::WriteAllText($outPath, $html, [System.Text.Encoding]::UTF8)
    Write-Host "Written $($p[0])"
}

# Multi-view pages: only first view visible on load (remove display:none from first view only)
$lihatPetty = (Get-ViewHtml 624 685) + "`n" + (Get-ViewHtml 688 745)
$lihatPetty = $lihatPetty -replace '(<div id="lihat-petty-cash-view" class="view-container") style="display:none;"', '$1'
$html = $head + "`n" + $lihatPetty + "`n" + $foot -replace 'PAGEID', 'lihat-petty-cash-view' -replace 'PAGE_TITLE', 'Lihat Petty Cash'
[System.IO.File]::WriteAllText((Join-Path $baseDir "rbm-lihat-petty-cash.html"), $html, [System.Text.Encoding]::UTF8)
Write-Host "Written rbm-lihat-petty-cash.html"

$absensi = (Get-ViewHtml 748 998) + "`n" + (Get-ViewHtml 1001 1066)
$absensi = $absensi -replace '(<div id="absensi-view" class="view-container") style="display:none; max-width: 100%; overflow-x: hidden;"', '$1'
$html = $head + "`n" + $absensi + "`n" + $foot -replace 'PAGEID', 'absensi-view' -replace 'PAGE_TITLE', 'Absensi & Jadwal'
[System.IO.File]::WriteAllText((Join-Path $baseDir "rbm-absensi.html"), $html, [System.Text.Encoding]::UTF8)
Write-Host "Written rbm-absensi.html"

$stok = (Get-ViewHtml 1371 1412) + "`n" + (Get-ViewHtml 1415 1453)
$stok = $stok -replace '(<div id="stok-barang-view" class="view-container") style="display:none;"', '$1'
$html = $head + "`n" + $stok + "`n" + $foot -replace 'PAGEID', 'stok-barang-view' -replace 'PAGE_TITLE', 'Stok Barang'
[System.IO.File]::WriteAllText((Join-Path $baseDir "rbm-stok-barang.html"), $html, [System.Text.Encoding]::UTF8)
Write-Host "Written rbm-stok-barang.html"

Write-Host "Done. 14 files created."
