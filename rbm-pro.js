(function() {
  // --- GLOBAL LOADING SCREEN ---
  (function injectLoader() {
      if (typeof document === 'undefined') return;
      var style = document.createElement('style');
      style.innerHTML = '#rbm-global-loader{position:fixed;top:0;left:0;width:100%;height:100%;background:#f8fafc;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.4s ease;}.rbm-global-spinner{width:48px;height:48px;border:4px solid #e2e8f0;border-top-color:#4C2A85;border-radius:50%;animation:rbm-global-spin 1s linear infinite;}.rbm-global-text{margin-top:16px;font-family:"Segoe UI",sans-serif;font-size:14px;color:#475569;font-weight:600;letter-spacing:0.5px;}@keyframes rbm-global-spin{to{transform:rotate(360deg);}}';
      document.head.appendChild(style);
      var loader = document.createElement('div');
      loader.id = 'rbm-global-loader';
      loader.innerHTML = '<div class="rbm-global-spinner"></div><div class="rbm-global-text">Memuat Sistem...</div>';
      var insert = function() { document.body.appendChild(loader); };
      if (document.body) insert();
      else document.addEventListener('DOMContentLoaded', insert);
  })();
  window.hideGlobalLoader = function() {
      var loader = document.getElementById('rbm-global-loader');
      if (loader) { loader.style.opacity = '0'; setTimeout(function() { loader.style.display = 'none'; }, 400); }
  };

  if (!window.RBMStorage) {
    window.RBMStorage = { getItem: function(k) { return localStorage.getItem(k); }, setItem: function(k, v) { localStorage.setItem(k, v); }, ready: function() { return Promise.resolve(); } };
  }
  let _cachedOwnerCheck = null;
  // Hanya Owner yang boleh menghapus/mengedit data yang sudah masuk; Manager hanya lihat & input baru
  window.rbmOnlyOwnerCanEditDelete = function() {
    if (_cachedOwnerCheck !== null) return _cachedOwnerCheck;
    try {
      var u = JSON.parse(localStorage.getItem('rbm_user') || '{}');
      var role = (u.role || '').toString().toLowerCase();
      _cachedOwnerCheck = (role === 'owner' || role === 'developer' || (u.username || '').toLowerCase() === 'burhan');
      return _cachedOwnerCheck;
    } catch(e) { return false; }
  };
  function setVal(id, val) { var e = document.getElementById(id); if (e) e.value = val; }
  function setPersistedVal(id, val) { 
      var e = document.getElementById(id); 
      if (e) { 
          var saved = sessionStorage.getItem('rbm_saved_date_' + id); 
          e.value = saved ? saved : val; 
          if (!e._rbmPersistBound) { 
              e.addEventListener('change', function() { sessionStorage.setItem('rbm_saved_date_' + id, this.value); }); 
              e._rbmPersistBound = true; 
          } 
      } 
  }
  function getRbmOutlet() {
    var s = document.getElementById('rbm-outlet-select');
    if (s && s.value) return s.value;
    try {
      var u = JSON.parse(localStorage.getItem('rbm_user') || '{}');
      if (u && u.outlet) return String(u.outlet);
    } catch (e) {}
    try {
      var last = localStorage.getItem('rbm_last_selected_outlet');
      if (last) return last;
    } catch (e2) {}
    return '';
  }
  window.getRbmOutlet = getRbmOutlet;
  function getRbmStorageKey(baseKey) { var o = getRbmOutlet(); return o ? baseKey + '_' + o : baseKey; }
  window.getRbmStorageKey = getRbmStorageKey;
  // [PERFORMA] Jangan tunggu window.load (yang menunggu semua script eksternal selesai).
  // Banyak halaman memuat Firebase/XLSX/html2canvas yang bisa lambat, bikin UI terlihat hang.
  // DOMContentLoaded cukup untuk set default filter + mulai fetch data.
  function _rbmOnDomReady(fn) {
    try {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
      else fn();
    } catch (e) { try { fn(); } catch(_) {} }
  }
  _rbmOnDomReady(function() {
    // [UX/PERFORMA] Set nilai default tanggal/bulan SEGERA agar input type="month" tidak lama tampil "----"
    // Jangan menunggu RBMStorage.ready() (yang bisa lama saat Firebase/ServerDB loading).
    try {
      var nowFast = new Date();
      var fmtFast = function(d) { return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2); };
      var todayFast = fmtFast(nowFast);
      var firstDayFast = fmtFast(new Date(nowFast.getFullYear(), nowFast.getMonth(), 1));
      var nextMonthEndFast = fmtFast(new Date(nowFast.getFullYear(), nowFast.getMonth() + 2, 0));
      var payrollStartFast = fmtFast(new Date(nowFast.getFullYear(), nowFast.getMonth() - 1, 26));
      var payrollEndFast = fmtFast(new Date(nowFast.getFullYear(), nowFast.getMonth(), 25));
      setPersistedVal("pc_bulan_filter", todayFast.slice(0, 7));
      setPersistedVal("pembukuan_bulan_filter", todayFast.slice(0, 7));
      setPersistedVal("stok_bulan_filter", todayFast.slice(0, 7));
      setPersistedVal("pc_input_tanggal", todayFast);
      setPersistedVal("tanggal_barang", todayFast);
      setPersistedVal("tanggal_keuangan", todayFast);
      setPersistedVal("tanggal_inventaris", todayFast);
      setPersistedVal("tanggal_pembukuan", todayFast);
      setPersistedVal("inv_tanggal_awal", firstDayFast);
      setPersistedVal("inv_tanggal_akhir", todayFast);
      setPersistedVal("absensi_tgl_awal", payrollStartFast);
      setPersistedVal("absensi_tgl_akhir", payrollEndFast);
      setPersistedVal("res_filter_start", firstDayFast);
      setPersistedVal("res_filter_end", nextMonthEndFast);
      setPersistedVal("rekap_gps_start", payrollStartFast);
      setPersistedVal("rekap_gps_end", payrollEndFast);
      setPersistedVal("riwayat_barang_start", firstDayFast);
      setPersistedVal("riwayat_barang_end", todayFast);
    } catch(e) {}

    // [PERFORMA] Auto-load halaman "lihat" tanpa menunggu RBMStorage.ready()
    // Agar tabel tidak stuck di placeholder "klik tampilkan" saat bulan sudah terpilih.
    try {
      var pageFast = window.RBM_PAGE || '';

      // Anti-freeze: tunggu outlet & filter siap, dan cegah load dobel (race) saat runInit juga memanggil load.
      function waitUntilReadyAndRun(opts) {
        opts = opts || {};
        var flag = opts.flag;
        var fn = opts.fn;
        var maxTries = opts.maxTries || 80; // ~4 detik @ 50ms
        var tries = 0;
        if (window[flag]) return;
        window[flag] = 'pending';

        var tick = function() {
          tries++;
          try {
            // cek outlet siap (select terisi & punya value)
            var outletSel = document.getElementById('rbm-outlet-select');
            var outletOk = !outletSel || (!!outletSel.value && outletSel.options && outletSel.options.length > 0);

            // cek filter bulan/tanggal siap (terisi)
            var monthOk = true;
            if (pageFast === 'lihat-petty-cash-view') {
              var m = document.getElementById('pc_bulan_filter');
              monthOk = !!(m && m.value);
            } else if (pageFast === 'lihat-pembukuan-view') {
              var m2 = document.getElementById('pembukuan_bulan_filter');
              monthOk = !!(m2 && m2.value);
            } else if (pageFast === 'stok-barang-view') {
              var m3 = document.getElementById('stok_bulan_filter');
              monthOk = !!(m3 && m3.value);
            } else if (pageFast === 'lihat-inventaris-view') {
              var a = document.getElementById('inv_tanggal_awal');
              var b = document.getElementById('inv_tanggal_akhir');
              monthOk = !!(a && a.value && b && b.value);
            } else if (pageFast === 'lihat-reservasi-view' || pageFast === 'input-reservasi-view') {
              var rs = document.getElementById('res_filter_start');
              var re = document.getElementById('res_filter_end');
              monthOk = !!(rs && rs.value && re && re.value);
            }

            if (outletOk && monthOk && typeof fn === 'function') {
              // cegah pemanggilan berulang
              window[flag] = true;
              // beri kesempatan UI render dulu supaya tidak terlihat "hang"
              setTimeout(function() {
                try { fn(); } catch (e) {}
              }, 0);
              return;
            }
          } catch (e) {}

          if (tries >= maxTries) {
            // jika gagal siap, jangan spam; biarkan runInit yang handle
            window[flag] = false;
            return;
          }
          setTimeout(tick, 50);
        };

        setTimeout(tick, 0);
      }

      if (pageFast === 'lihat-petty-cash-view' && typeof loadPettyCashData === 'function') {
        waitUntilReadyAndRun({ flag: '_rbmAutoLoadedPc', fn: loadPettyCashData });
      } else if (pageFast === 'lihat-inventaris-view' && typeof loadInventarisData === 'function') {
        waitUntilReadyAndRun({ flag: '_rbmAutoLoadedInv', fn: loadInventarisData });
      } else if (pageFast === 'lihat-pembukuan-view' && typeof loadPembukuanData === 'function') {
        waitUntilReadyAndRun({ flag: '_rbmAutoLoadedPb', fn: loadPembukuanData });
      } else if (pageFast === 'stok-barang-view' && typeof renderStokTable === 'function') {
        waitUntilReadyAndRun({ flag: '_rbmAutoLoadedStok', fn: renderStokTable });
      } else if (pageFast === 'absensi-view' && typeof syncAbsensiPeriodAndRefresh === 'function') {
        waitUntilReadyAndRun({ flag: '_rbmAutoLoadedAbsen', fn: syncAbsensiPeriodAndRefresh });
      } else if ((pageFast === 'lihat-reservasi-view' || pageFast === 'input-reservasi-view') && typeof loadReservasiData === 'function') {
        waitUntilReadyAndRun({ flag: '_rbmAutoLoadedRes', fn: function() { loadReservasiData(); if (typeof renderReservasiCalendar === 'function') renderReservasiCalendar(); } });
      }
    } catch(e) {}

    var runInit = function() {
    var now = new Date();
    var fmt = function(d) { return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2); };
    var today = fmt(now);
    var firstDay = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
    var nextMonthEnd = fmt(new Date(now.getFullYear(), now.getMonth() + 2, 0));
    // Periode Gaji: Tanggal 26 Bulan Lalu s/d Tanggal 25 Bulan Ini
    var payrollStart = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 26));
    var payrollEnd = fmt(new Date(now.getFullYear(), now.getMonth(), 25));

    setVal("tanggal_barang", today);
    setVal("tanggal_keuangan", today);
    setVal("tanggal_inventaris", today);
    setVal("tanggal_pembukuan", today);
    setVal("pc_input_tanggal", today);
    // Jangan timpa nilai manual yang dipilih user saat refresh
    setPersistedVal("pc_bulan_filter", today.slice(0, 7));
    setVal("pengajuan_saldo_date", today);
    setVal("pengajuan_filter_date_start", today);
    setVal("pengajuan_filter_date_end", today);
    // Jangan timpa nilai manual yang dipilih user saat refresh
    setPersistedVal("pembukuan_bulan_filter", today.slice(0, 7));
    setVal("inv_tanggal_awal", firstDay);
    setVal("inv_tanggal_akhir", today);
    // Periode absensi (26 s/d 25) harus tetap sesuai pilihan manual user
    setPersistedVal("absensi_tgl_awal", payrollStart);
    setPersistedVal("absensi_tgl_akhir", payrollEnd);
    setPersistedVal("res_filter_start", firstDay);
    setPersistedVal("res_filter_end", nextMonthEnd);
    setPersistedVal("stok_bulan_filter", today.slice(0, 7));
    setPersistedVal("rekap_gps_start", payrollStart);
    setPersistedVal("rekap_gps_end", payrollEnd);
    setVal("riwayat_barang_start", firstDay);
    setVal("riwayat_barang_end", today);
    var pageView = window.RBM_PAGE || (window.location.hash || '').replace(/^#/, '');
    var containers = document.querySelectorAll('.view-container');
    if (containers.length === 1) {
      containers[0].style.display = 'block';
      var viewId = containers[0].id;
      if (viewId === 'absensi-view') {
          if (typeof syncAbsensiPeriodAndRefresh === 'function') syncAbsensiPeriodAndRefresh();
          else renderAbsensiTable();
      }
      else if (viewId === 'reservasi-view') renderReservasiCalendar();
      else if (viewId === 'stok-barang-view') renderStokTable();
      else if (viewId === 'absensi-gps-view') { initAbsensiGPS(); loadOfficeConfig(); if (typeof loadJamConfig === 'function') loadJamConfig(); }
      else if (viewId === 'rekap-absensi-gps-view') { populateRekapGpsFilterNama(); loadRekapAbsensiGPS(); }
    } else if (pageView && document.getElementById(pageView)) {
      showView(pageView);
    } else {
      var first = document.querySelector('.view-container');
      if (first) { first.style.display = 'block'; }
    }
    if (document.getElementById('detail-container-barang')) createBarangRows();
    if (document.getElementById('detail-container-keuangan')) createTransactionRows();
    if (document.getElementById('detail-container-inventaris')) createInventarisRows();
    if (document.getElementById('detail-container-pembukuan')) createPembukuanRows();
    if (document.getElementById('pengajuan-form-container')) createPengajuanForm();
    if (document.getElementById('pc_input_jenis')) createPettyCashInputRows();
    var saldoEl = document.getElementById("pengajuan_saldo_date");
    if (saldoEl && typeof calculateSisaUangPengajuan === 'function') calculateSisaUangPengajuan();
    
    var outletSel = document.getElementById('rbm-outlet-select');
    if (outletSel) outletSel.addEventListener('change', function() {
      if (window.RBMStorage && typeof window.RBMStorage.loadFromFirebase === 'function') {
          window.RBMStorage.loadFromFirebase().then(refreshCurrentView);
      } else {
          refreshCurrentView();
      }
    });
    function refreshCurrentView() {
      var page = window.RBM_PAGE;
      if (page === 'absensi-view' && typeof renderAbsensiTable === 'function') {
        window._absensiViewData = undefined;
        window._absensiViewEmployees = undefined;
        if (typeof syncAbsensiPeriodAndRefresh === 'function') syncAbsensiPeriodAndRefresh();
        else renderAbsensiTable();
      }
      else if (page === 'rekap-absensi-gps-view') {
        if (typeof populateRekapGpsFilterNama === 'function') { populateRekapGpsFilterNama(); }
        if (typeof loadRekapAbsensiGPS === 'function') loadRekapAbsensiGPS();
      }
      else if (page === 'lihat-pembukuan-view' && typeof loadPembukuanData === 'function') loadPembukuanData();
      else if (page === 'lihat-petty-cash-view' && typeof loadPettyCashData === 'function') loadPettyCashData();
      else if (page === 'lihat-inventaris-view' && typeof loadInventarisData === 'function') loadInventarisData();
      else if (page === 'stok-barang-view' && typeof renderStokTable === 'function') renderStokTable();
      else if (page === 'input-barang-view' && typeof createBarangRows === 'function') createBarangRows();
      else if ((page === 'lihat-reservasi-view' || page === 'input-reservasi-view') && typeof loadReservasiData === 'function') { loadReservasiData(); if (typeof renderReservasiCalendar === 'function') renderReservasiCalendar(); }
      else if (page === 'absensi-gps-view') {
        if (typeof loadOfficeConfig === 'function') loadOfficeConfig();
        if (typeof loadJamConfig === 'function') loadJamConfig();
        if (typeof initAbsensiGPS === 'function') initAbsensiGPS();
      }
    }

    // Sembunyikan layar loading secara halus (fade-out) setelah data selesai digambar
    setTimeout(function() { if (typeof window.hideGlobalLoader === 'function') window.hideGlobalLoader(); }, 100);
    };
    if (window.RBMStorage && window.RBMStorage.ready) {
      // [OPTIMASI KILAT] Batasi loading screen agar UI tidak terasa hang menunggu Firebase.
      // Khusus Absensi GPS, percepat lagi karena karyawan hanya butuh form cepat tampil.
      var initFired = false;
      var safeRunInit = function() {
          if (initFired) return;
          initFired = true;
          runInit();
      };
      var firstPaintMaxWait = (window.RBM_PAGE === 'absensi-gps-view') ? 350 : 1500;
      setTimeout(safeRunInit, firstPaintMaxWait);
      window.RBMStorage.ready().then(safeRunInit).catch(safeRunInit);
    } else {
      runInit();
    }
  });

  function showView(viewId) {
    document.querySelectorAll('.view-container').forEach(function(view) { view.style.display = 'none'; });
    var el = document.getElementById(viewId);
    if (el) el.style.display = 'block';
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector('[onclick="showView(\'' + viewId + '\')"]');
    if (activeBtn) activeBtn.classList.add('active');
    if (viewId === 'absensi-view') {
        if (typeof syncAbsensiPeriodAndRefresh === 'function') syncAbsensiPeriodAndRefresh();
        else renderAbsensiTable();
    }
    if (viewId === 'reservasi-view' || viewId === 'lihat-reservasi-view') {
        if (typeof loadReservasiData === 'function') loadReservasiData();
        renderReservasiCalendar();
    }
    if (viewId === 'stok-barang-view') {
        renderStokTable();
    }
    if (viewId === 'absensi-gps-view') {
        initAbsensiGPS();
        loadOfficeConfig();
    }
    if (viewId === 'rekap-absensi-gps-view') {
        populateRekapGpsFilterNama();
        loadRekapAbsensiGPS();
    }
    if (viewId === 'lihat-petty-cash-view' && typeof loadPettyCashData === 'function') loadPettyCashData();
    if (viewId === 'lihat-pembukuan-view' && typeof loadPembukuanData === 'function') loadPembukuanData();
  }
  // expose globally just in case script loads after user interaction
  window.showView = showView;

  function setOutput(outputEl, msg, isSuccess) {
    if (!outputEl) return;
    outputEl.innerText = msg;
    outputEl.className = 'output-msg ' + (isSuccess ? 'success' : 'error');
  }

  function isGoogleScript() {
    return typeof google !== 'undefined' && google.script && google.script.run;
  }

  /** Jika FirebaseStorage tersedia dan terkoneksi, pakai Firebase (bukan Google Sheets). */
  function useFirebaseBackend() {
    if (typeof FirebaseStorage === 'undefined') return false;
    try {
      FirebaseStorage.init();
      return FirebaseStorage.isReady();
    } catch (e) { return false; }
  }

  // safe JSON parse utility: returns fallback when input is null/empty/invalid
  function safeParse(str, fallback) {
    if (!str) return fallback;
    try {
      var parsed = JSON.parse(str);
      if (Array.isArray(fallback)) {
          if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
              parsed = Object.keys(parsed).map(function(k) { return parsed[k]; });
          }
          if (Array.isArray(parsed)) {
              return parsed.filter(function(item) { return item !== null && item !== undefined; });
          }
      }
      return parsed;
    } catch (e) {
      console.warn('safeParse failed, returning fallback', e);
      return fallback;
    }
  }

  // --- SISTEM CACHING MEMORI RBM PRO ---
  window._rbmParsedCache = window._rbmParsedCache || {};
  function getCachedParsedStorage(key, defaultVal) {
    if (window._rbmParsedCache[key]) {
      return window._rbmParsedCache[key].data;
    }
    let data;
    if (window.RBMStorage && typeof window.RBMStorage.getRawData === 'function') {
        let rawObj = window.RBMStorage.getRawData(key);
        if (typeof rawObj === 'string') {
            data = safeParse(rawObj, defaultVal || []);
        } else {
            data = rawObj !== null && rawObj !== undefined ? rawObj : defaultVal;
            if (data === defaultVal && Array.isArray(defaultVal)) data = [];
            if (data === defaultVal && typeof defaultVal === 'object' && !Array.isArray(defaultVal)) data = {};
            
            // [FIX KRUSIAL] Paksa data menjadi Array jika defaultVal adalah Array
            if (Array.isArray(defaultVal) && data !== null && typeof data === 'object' && !Array.isArray(data)) {
                data = Object.keys(data).map(function(k) { return data[k]; }).filter(function(item) { return item !== null && item !== undefined; });
            }
        }
    } else {
        const raw = RBMStorage.getItem(key) || JSON.stringify(defaultVal || []);
        data = safeParse(raw, defaultVal || []);
    }
    
    // [SAFETY NET KILAT] Jika gagal muat dari jaringan, pertahankan data lokal lama agar tidak hilang
    if (Array.isArray(data) && data.length === 0 && key.indexOf('EMPLOYEES') >= 0) {
        const fallbackRaw = localStorage.getItem(key);
        if (fallbackRaw && fallbackRaw.length > 10) {
            data = safeParse(fallbackRaw, data);
        }
    }
    
    window._rbmParsedCache[key] = { data: data };
    return data;
  }

  function sanitizeForStorage(obj) {
    if (!obj) return obj;
    const j = JSON.stringify(obj, function(k, v) {
      // if (k === 'data' && typeof v === 'string' && v.length > 5000) return '[foto-disimpan-terpisah]';
      // if (k === 'foto' && v && v.data) return { fileName: v.fileName, mimeType: v.mimeType, data: '[base64]' };
      if (k === 'fotoRusak' && v && v.data) return { fileName: v.fileName, mimeType: v.mimeType, data: '[base64]' };
      if (k === 'fotoPengajuan' && v && v.data) return { fileName: v.fileName, mimeType: v.mimeType, data: '[base64]' };
      if (k === 'fotoBukti' && v && v.data) return { fileName: v.fileName, mimeType: v.mimeType, data: '[base64]' };
      if (k === 'fotoNota' && v && v.data) return { fileName: v.fileName, mimeType: v.mimeType, data: '[base64]' };
      if (k === 'fotoTtd' && v && v.data) return { fileName: v.fileName, mimeType: v.mimeType, data: '[base64]' };
      return v;
    });
    return safeParse(j, null);
  }

  function savePendingToLocalStorage(type, payload) {
    try {
      const key = getRbmStorageKey('RBM_PENDING_' + type);
      const existing = getCachedParsedStorage(key, []);
      const item = { ts: new Date().toISOString(), payload: sanitizeForStorage(payload) };
      existing.push(item);
      RBMStorage.setItem(key, JSON.stringify(existing));
      window._rbmParsedCache[key] = { data: existing };
      return true;
    } catch (e) {
      console.warn('localStorage save error', e);
      return false;
    }
  }

  function formatRupiah(n) {
    return 'Rp ' + (n || 0).toLocaleString('id-ID');
  }

  // Fungsi global untuk upload & kompresi ke Firebase Storage
  function uploadImageWithCompression(file, storagePath) {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => {
              if (typeof compressImageDataUrl === 'function') {
                  compressImageDataUrl(e.target.result, 800, 0.6, async function(compressed) {
                      if (useFirebaseBackend() && typeof firebase !== 'undefined' && firebase.storage) {
                          try {
                              const storageRef = firebase.storage().ref();
                              const fileName = storagePath + '/' + Date.now() + '_' + Math.random().toString(36).substring(7) + '.jpg';
                              const fileRef = storageRef.child(fileName);
                              await fileRef.putString(compressed, 'data_url');
                              const downloadUrl = await fileRef.getDownloadURL();
                              resolve(downloadUrl);
                          } catch (err) {
                              console.warn("Storage upload failed, fallback to base64", err);
                              const fileData = compressed.split(",");
                              resolve({ fileName: file.name, mimeType: file.type, data: fileData[1] || '' });
                          }
                      } else {
                          const fileData = compressed.split(",");
                          resolve({ fileName: file.name, mimeType: file.type, data: fileData[1] || '' });
                      }
                  });
              } else {
                  const fileData = e.target.result.split(",");
                  resolve({ fileName: file.name, mimeType: file.type, data: fileData[1] });
              }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
  }

  function formatRupiahInput(input) {
    let value = input.value.replace(/[^0-9]/g, '');
    if (value) {
        input.value = 'Rp ' + parseInt(value).toLocaleString('id-ID');
    } else {
        input.value = '';
    }
  }

  function createPettyCashInputRows() {
    const container = document.getElementById("detail-container-petty-cash");
    const jenis = document.getElementById("pc_input_jenis").value;
    container.innerHTML = "";

    if (!jenis) {
      for (let i = 0; i < 8; i++) {
        container.innerHTML += `<div class="row-group"><div style="flex: 2.5;"><input type="text" placeholder="Pilih Jenis Transaksi di atas" disabled></div><div style="flex: 1.2;"><input type="text" placeholder="..." disabled></div></div>`;
      }
      return;
    }

    const isPengeluaran = (jenis === 'pengeluaran');

    for (let i = 0; i < 10; i++) {
      const row = document.createElement("div");
      row.className = "row-group";

      const namaInput = `<div class="col-nama"><input type="text" class="pc_nama" name="pc_nama_${i}" aria-label="Nama Keterangan" placeholder="${isPengeluaran ? 'Nama Barang' : 'Keterangan'}"></div>`;
      const jumlahInput = `<div class="col-jumlah"><input type="number" class="pc_jumlah" name="pc_jumlah_${i}" aria-label="Jumlah" placeholder="Qty" oninput="calculatePettyCashRowTotal(this)"></div>`;
      const hargaInput = `<div class="col-harga"><input type="number" class="pc_harga" name="pc_harga_${i}" aria-label="Harga" placeholder="Harga Satuan" oninput="calculatePettyCashRowTotal(this)"></div>`;
      const totalInput = `<div class="col-total"><input type="text" class="pc_total" name="pc_total_${i}" aria-label="Total" placeholder="Total Rp" readonly style="background: #f0f0f0; font-weight: bold;"></div>`;
      const satuanInput = `<div class="col-satuan"><input type="text" class="pc_satuan" name="pc_satuan_${i}" aria-label="Satuan" placeholder="Satuan"></div>`;
      const nominalPemasukanInput = `<div class="col-jumlah" style="flex: 1.5;"><input type="number" class="pc_nominal_pemasukan" name="pc_nominal_${i}" aria-label="Nominal Pemasukan" placeholder="Nominal (Rp)"></div>`;

      if (isPengeluaran) {
        row.innerHTML = namaInput + jumlahInput + satuanInput + hargaInput + totalInput;
      } else {
        row.innerHTML = namaInput + nominalPemasukanInput;
      }

      container.appendChild(row);
    }
  }

  function removePettyCashInputRow(btn) {
    var row = btn.closest(".row-group");
    if (!row) return;
    var container = document.getElementById("detail-container-petty-cash");
    var rows = container.querySelectorAll(".row-group");
    if (rows.length <= 1) return;
    row.remove();
  }

  function calculatePettyCashRowTotal(element) {
    const row = element.closest('.row-group');
    const qty = parseFloat(row.querySelector(".pc_jumlah").value) || 0;
    const harga = parseFloat(row.querySelector(".pc_harga").value) || 0;
    const total = qty * harga;
    const totalField = row.querySelector(".pc_total");
    if (totalField) {
      totalField.value = total > 0 ? total.toLocaleString('id-ID') : "";
    }
  }

  function submitPettyCashData() {
    const button = document.getElementById("submitButtonPettyCash");
    const output = document.getElementById("outputPettyCash");
    const tanggal = document.getElementById("pc_input_tanggal").value;
    const jenis = document.getElementById("pc_input_jenis").value;

    button.disabled = true;
    button.innerText = "Menyimpan... ⏳";
    output.innerText = "";

    if (!tanggal || !jenis) {
      output.innerText = "⚠️ Tanggal dan Jenis Transaksi wajib diisi.";
      button.disabled = false;
      button.innerText = "Simpan Data";
      return;
    }

    const rows = document.querySelectorAll("#input-petty-cash-view .row-group");
    const transactionList = [];

    rows.forEach(row => {
      const namaInput = row.querySelector(".pc_nama");
      let transaction = null;

      if (jenis === 'pengeluaran') {
        const jumlahInput = row.querySelector(".pc_jumlah");
        if (namaInput && jumlahInput && namaInput.value.trim() && jumlahInput.value.trim()) {
          const hargaVal = parseFloat(row.querySelector(".pc_harga")?.value) || 0;
          const jumlahVal = parseFloat(jumlahInput.value) || 0;
          const total = (jumlahVal * hargaVal);
          transaction = {
            nama: namaInput.value.trim(),
            jumlah: jumlahInput.value.trim(),
            metode: "",
            satuan: row.querySelector(".pc_satuan")?.value.trim() || "",
            harga: row.querySelector(".pc_harga")?.value.trim() || "",
            total: total
          };
        }
      } else {
        const nominalInput = row.querySelector(".pc_nominal_pemasukan");
        if (namaInput && nominalInput && namaInput.value.trim() && nominalInput.value.trim()) {
          const total = parseFloat(nominalInput.value) || 0;
          transaction = {
            nama: namaInput.value.trim(),
            jumlah: 1,
            metode: "",
            satuan: "",
            harga: total,
            total: total
          };
        }
      }

      if (transaction) {
        transactionList.push(transaction);
      }
    });

    if (transactionList.length === 0) {
      output.innerText = "⚠️ Masukkan minimal 1 data transaksi.";
      button.disabled = false;
      button.innerText = "Simpan Data";
      return;
    }

    const dataToSend = { tanggal: tanggal, jenis: jenis, transactions: transactionList };
    if (useFirebaseBackend()) {
      FirebaseStorage.savePettyCashTransactions(dataToSend, getRbmOutlet()).then(showResultPettyCash).catch(function(err) {
        showResultPettyCash('❌ ' + (err && err.message ? err.message : 'Gagal menyimpan ke Firebase.'));
      });
      return;
    }
    if (!isGoogleScript()) {
      savePendingToLocalStorage('PETTY_CASH', dataToSend);
      showResultPettyCash('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
      return;
    }
    google.script.run.withSuccessHandler(showResultPettyCash).simpanTransaksiBatch(dataToSend);
  }

  function showResultPettyCash(res) {
    const output = document.getElementById("outputPettyCash");
    const button = document.getElementById("submitButtonPettyCash");
    setOutput(output, res, res.includes('✅'));
    button.disabled = false;
    button.innerText = "Simpan Data";
    document.getElementById("pc_input_jenis").value = "";
    createPettyCashInputRows();
    setTimeout(() => { output.innerText = "" }, 4000);
  }

function savePembukuanToJpg() {
    const monthFilter = document.getElementById("pembukuan_bulan_filter");
    const monthVal = monthFilter ? monthFilter.value : '';
    
    if (!monthVal) { alert("Pilih bulan terlebih dahulu."); return; }
    
    if(!confirm("Fitur Save JPG akan mencetak laporan bulanan untuk: " + monthVal + ". Lanjutkan?")) return;

    const [year, month] = monthVal.split('-');
    const tglAwal = `${year}-${month}-01`;
    const lastDay = new Date(year, parseInt(month, 10), 0).getDate();
    const tglAkhir = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    // Ambil data
    let pending = window._lastPembukuanPending;
    if (!pending && !useFirebaseBackend()) {
        pending = safeParse(RBMStorage.getItem(getRbmStorageKey('RBM_PENDING_PEMBUKUAN')), []);
    }
    if (!pending) pending = [];

    // Hitung Saldo Awal & Total Bulan Ini
    let saldoAwalCashMasuk = 0;
    let saldoAwalKasKeluar = 0;
    const dataPeriode = [];

    pending.forEach(item => {
        const p = item.payload;
        if (!p || !p.tanggal) return;

        if (p.tanggal < tglAwal) {
            // Akumulasi Saldo Awal
            if (p.kasMasuk) {
                p.kasMasuk.forEach(m => {
                    if (m.keterangan && m.keterangan.toUpperCase() === 'CASH') {
                        let fisikVal = parseFloat(m.fisik) || 0;
                        saldoAwalCashMasuk += fisikVal;
                    }
                });
            }
            if (p.kasKeluar) {
                p.kasKeluar.forEach(k => {
                    saldoAwalKasKeluar += parseFloat(k.setor) || 0;
                });
            }
        } else if (p.tanggal >= tglAwal && p.tanggal <= tglAkhir) {
            // Data bulan ini
            dataPeriode.push(item);
        }
    });
    
    const saldoAwal = saldoAwalCashMasuk - saldoAwalKasKeluar;

    let totalCashMasuk = 0;
    let totalKasKeluar = 0;
    let totalSemuaMasuk = 0;
    let rows = [];

    dataPeriode.forEach((item, parentIdx) => {
        const p = item.payload;
        if (p.kasMasuk && p.kasMasuk.length > 0) {
            p.kasMasuk.forEach((km, subIdx) => {
                let fisikVal = parseFloat(km.fisik) || 0;
                let catatanVal = parseFloat(km.catatan) || 0;
                let fisikDisplay = formatRupiah(fisikVal);
                let selisihVal = 0;
                
                if(km.keterangan && km.keterangan.toUpperCase() === 'VCR') {
                    const jmlVcr = parseFloat(km.vcr) || 0;
                    fisikVal = jmlVcr * 20000;
                    fisikDisplay = `${km.vcr} (VCR)`;
                } else {
                    selisihVal = fisikVal - catatanVal;
                }

                if (km.keterangan && km.keterangan.toUpperCase() === 'CASH') totalCashMasuk += fisikVal;
                totalSemuaMasuk += catatanVal;

                rows.push({
                    tanggal: p.tanggal,
                    keterangan: km.keterangan,
                    catatan: km.catatan ? formatRupiah(km.catatan) : '-',
                    fisik: fisikDisplay,
                    selisih: (km.fisik || km.catatan) ? formatRupiah(selisihVal) : '-',
                    catatanVal: catatanVal,
                    fisikVal: fisikVal,
                    selisihVal: selisihVal,
                    type: 'kasMasuk'
                });
            });
        }
        if (p.kasKeluar && p.kasKeluar.length > 0) {
            p.kasKeluar.forEach((kk, subIdx) => {
                const setor = parseFloat(kk.setor) || 0;
                totalKasKeluar += setor;

                rows.push({
                    tanggal: p.tanggal,
                    keterangan: kk.keterangan,
                    catatan: '-',
                    fisik: formatRupiah(kk.setor),
                    selisih: '-',
                    catatanVal: 0,
                    fisikVal: setor,
                    selisihVal: 0,
                    type: 'kasKeluar'
                });
            });
        }
    });

    const saldoAkhir = saldoAwal + totalCashMasuk - totalKasKeluar;

    if (rows.length === 0 && saldoAwal === 0) {
        alert("Tidak ada data untuk bulan " + monthVal);
        return;
    }

    const grouped = {};
    rows.forEach(r => {
        if (!grouped[r.tanggal]) { 
            grouped[r.tanggal] = { masuk: [], keluar: [], subtotalCatatan: 0, subtotalFisik: 0, subtotalSelisih: 0 }; 
        }
        if (r.type === 'kasMasuk') {
            grouped[r.tanggal].masuk.push(r);
            grouped[r.tanggal].subtotalCatatan += r.catatanVal || 0;
            grouped[r.tanggal].subtotalFisik += r.fisikVal || 0;
            grouped[r.tanggal].subtotalSelisih += r.selisihVal || 0;
        } else {
            grouped[r.tanggal].keluar.push(r);
        }
    });

    let outletName = 'Semua Outlet';
    const outletId = typeof getRbmOutlet === 'function' ? getRbmOutlet() : '';
    if (outletId) {
        try {
            const names = JSON.parse(localStorage.getItem('rbm_outlet_names') || '{}');
            outletName = names[outletId] || (outletId.charAt(0).toUpperCase() + outletId.slice(1));
        } catch(e) {}
    }

    // Buat elemen HTML temporary untuk di-capture
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute; top:-9999px; left:-9999px; width:800px; background:white; padding:30px; font-family:sans-serif; color:#333; border:1px solid #ccc;';
    
    let html = `
        <h2 style="text-align:center; margin:0 0 10px 0; color:#1e40af;">Laporan Pembukuan Bulanan - ${outletName}</h2>
        <p style="text-align:center; margin:0 0 20px 0; font-size:14px; color:#666;">Periode: ${monthVal}</p>
        
        <div style="margin-bottom:15px; background: linear-gradient(135deg, #059669 0%, #047857 100%); padding:15px; border-radius:8px; border:2px solid #34d399; text-align:center; color:white; box-shadow: 0 4px 10px rgba(5, 150, 103, 0.3);">
            <div style="font-size:12px; font-weight:800; color:#a7f3d0; letter-spacing:0.5px;">💰 TOTAL PENDAPATAN (OMSET)</div>
            <div style="font-size:24px; font-weight:800; text-shadow: 0 2px 4px rgba(0,0,0,0.3); margin-top:5px;">${formatRupiah(totalSemuaMasuk)}</div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:10px; margin-bottom:20px; background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
            <div style="text-align:center;">
                <div style="font-size:11px; color:#666;">Saldo Awal</div>
                <div style="font-size:14px; font-weight:bold; color:#6b7280;">${formatRupiah(saldoAwal)}</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:11px; color:#666;">Masuk (CASH)</div>
                <div style="font-size:14px; font-weight:bold; color:#1e40af;">${formatRupiah(totalCashMasuk)}</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:11px; color:#666;">Keluar</div>
                <div style="font-size:14px; font-weight:bold; color:#dc2626;">${formatRupiah(totalKasKeluar)}</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:11px; color:#666;">Saldo Akhir</div>
                <div style="font-size:14px; font-weight:bold; color:#059669;">${formatRupiah(saldoAkhir)}</div>
            </div>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
                <tr style="background:#1e40af; color:white;">
                    <th style="padding:8px; border:1px solid #ccc;">Tanggal</th>
                    <th style="padding:8px; border:1px solid #ccc;">Keterangan</th>
                    <th style="padding:8px; border:1px solid #ccc;">Catatan</th>
                    <th style="padding:8px; border:1px solid #ccc;">Fisik / Setor</th>
                    <th style="padding:8px; border:1px solid #ccc;">Selisih</th>
                </tr>
            </thead>
            <tbody>
    `;

    Object.keys(grouped).sort().forEach(date => {
        const group = grouped[date];
        
        group.masuk.forEach((r, i) => {
            html += '<tr>';
            if (i === 0) {
                html += `<td rowspan="${group.masuk.length}" style="vertical-align: middle; text-align: center; background-color: #f1f5f9; font-weight: 500; border:1px solid #eee;">${date}</td>`;
            }
            html += `
                <td style="padding:6px; border:1px solid #eee;">${r.keterangan}</td>
                <td style="padding:6px; border:1px solid #eee; text-align:right;">${r.catatan}</td>
                <td style="padding:6px; border:1px solid #eee; text-align:right;">${r.fisik}</td>
                <td style="padding:6px; border:1px solid #eee; text-align:right;">${r.selisih}</td>
            `;
            html += '</tr>';
        });
        
        if (group.masuk.length > 0) {
            html += `
                <tr style="background: #e2e8f0; font-weight: bold;">
                    <td colspan="2" style="padding:6px; border:1px solid #eee; text-align: center;">TOTAL ${date}</td>
                    <td style="padding:6px; border:1px solid #eee; text-align:right;">${formatRupiah(group.subtotalCatatan)}</td>
                    <td style="padding:6px; border:1px solid #eee; text-align:right;">${formatRupiah(group.subtotalFisik)}</td>
                    <td style="padding:6px; border:1px solid #eee; text-align:right;">${formatRupiah(group.subtotalSelisih)}</td>
                </tr>
            `;
        }

        group.keluar.forEach((r) => {
            html += '<tr style="background-color: #f0fdf4;">';
            html += `<td style="vertical-align: middle; text-align: center; border:1px solid #eee; font-weight: 500;">${date}</td>`;
            html += `
                <td style="padding:6px; border:1px solid #eee;">${r.keterangan}</td>
                <td style="padding:6px; border:1px solid #eee; text-align:right;">-</td>
                <td style="padding:6px; border:1px solid #eee; text-align:right;">${r.fisik}</td>
                <td style="padding:6px; border:1px solid #eee; text-align:right;">-</td>
            `;
            html += '</tr>';
        });
    });

    html += `</tbody></table>`;
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    html2canvas(wrap, { scale: 1.5 }).then(canvas => {
        const link = document.createElement('a');
        const safeOutletName = outletName.replace(/[^a-zA-Z0-9]/g, '_');
        link.download = `Laporan_Pembukuan_${safeOutletName}_${monthVal}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();
        document.body.removeChild(wrap);
    }).catch(err => {
        alert("Gagal menyimpan JPG: " + err);
        document.body.removeChild(wrap);
    });
}

  function loadPettyCashData() {
    const tbody = document.getElementById("pc_tbody");
    const summaryEl = document.getElementById("pc_summary");
    if (!tbody || !summaryEl) return;

    tbody.innerHTML = '<tr><td colspan="10" class="table-loading">Memuat data...</td></tr>';
    summaryEl.style.display = 'none';

    const monthFilter = document.getElementById("pc_bulan_filter");
    const monthVal = monthFilter ? monthFilter.value : '';
    if (!monthVal) {
        tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Pilih bulan terlebih dahulu.</td></tr>';
        summaryEl.style.display = 'none';
        return;
    }
    try { localStorage.setItem('rbm_pc_last_month', monthVal); } catch(e) {}
    const [year, month] = monthVal.split('-');
    const tglAwal = `${year}-${month}-01`;
    const lastDay = new Date(year, parseInt(month, 10), 0).getDate();
    const tglAkhir = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    // --- Search UI: selalu ada (placeholder di HTML), hanya aktifkan handler ---
    const pcSearchEl = document.getElementById("pc_search");
    if (pcSearchEl && !pcSearchEl._rbmBound) {
        pcSearchEl._rbmBound = true;
        pcSearchEl.disabled = false;
        pcSearchEl.oninput = function() {
            window._pcCurrentPage = 1;
            if (window._pcUseServerPaging) loadPettyCashData();
            else if (typeof window.renderPettyCashPage === 'function') window.renderPettyCashPage();
        };
    } else if (pcSearchEl) {
        pcSearchEl.disabled = false;
    }

    // Tombol hapus foto Petty Cash dihilangkan sesuai permintaan admin.

    // --- [BARU] State Pagination Client-Side ---
    window._pcCurrentPage = 1;
    // [PERFORMA] Biar tidak terasa "tiap scroll baru loading 20 baris lagi",
    // naikkan ukuran halaman (server juga clamp max 50).
    const rowsPerPage = 50;

    window.renderPettyCashPage = function() {
        const data = window._lastPettyCashData || [];
        const summary = window._lastPettyCashSummary || { totalDebit: 0, totalKredit: 0, saldoAkhir: 0, saldoAwal: 0 };
        
        // 1. Filter Pencarian (Simulasi LIKE '%keyword%')
        const searchVal = document.getElementById("pc_search") ? document.getElementById("pc_search").value.toLowerCase() : "";
        const filteredData = searchVal ? data.filter(r => (r.nama || '').toLowerCase().includes(searchVal)) : data;

        // 2. Logika Pagination
        const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
        if (window._pcCurrentPage > totalPages) window._pcCurrentPage = totalPages;
        
        const startIdx = (window._pcCurrentPage - 1) * rowsPerPage;
        const pageData = filteredData.slice(startIdx, startIdx + rowsPerPage);

        // 3. Render Baris HTML yang sudah dipotong (Sangat Ringan!)
        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Tidak ada data ditemukan.</td></tr>';
        } else {
            tbody.innerHTML = pageData.map(function(row) {
                var aksiBtn = (row._firebaseDate != null && row._firebaseIndexInDate != null)
                    ? '<button type="button" class="btn btn-secondary" style="font-size:11px; padding:4px 8px; margin-right:4px; background:#ffc107; color:#000; border:none;" onclick="editPettyCashItemFirebase(\'' + (row._firebaseDate || '') + '\', ' + (row._firebaseIndexInDate ?? '') + ')">Edit</button><button type="button" class="btn-small-danger" onclick="deletePettyCashItemFirebase(\'' + (row._firebaseDate || '') + '\', ' + (row._firebaseIndexInDate ?? '') + ')">Hapus</button>'
                    : '-';
                return '<tr><td>' + (row.no || '') + '</td><td>' + (row.tanggal || '') + '</td><td>' + (row.nama || '') + '</td><td class="num">' + (row.jumlah || '') + '</td><td>' + (row.satuan || '') + '</td><td class="num">' + (row.harga ? formatRupiah(row.harga) : '') + '</td><td class="num">' + (row.debit ? formatRupiah(row.debit) : '') + '</td><td class="num">' + (row.kredit ? formatRupiah(row.kredit) : '') + '</td><td class="num">' + (row.saldo ? formatRupiah(row.saldo) : '') + '</td><td>' + aksiBtn + '</td></tr>';
            }).join('');
        }

        // 4. Render Tombol Navigasi Pagination
        let paginationEl = document.getElementById("pc_pagination");
        if (!paginationEl) {
            paginationEl = document.createElement("div");
            paginationEl.id = "pc_pagination";
            paginationEl.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;";
            tbody.closest('.table-card').appendChild(paginationEl); // Tambahkan di bawah tabel
        }
        // Kamu bilang tidak pakai Prev/Next, jadi disembunyikan.
        paginationEl.style.display = 'none';
        paginationEl.innerHTML = `
            <button class="btn btn-secondary" ${window._pcCurrentPage === 1 ? 'disabled' : ''} onclick="window._pcCurrentPage--; window.renderPettyCashPage()">⬅️ Prev</button>
            <span style="font-size:14px; font-weight:bold; color:#1e40af;">Hal ${window._pcCurrentPage} dari ${totalPages}</span>
            <button class="btn btn-secondary" ${window._pcCurrentPage === totalPages ? 'disabled' : ''} onclick="window._pcCurrentPage++; window.renderPettyCashPage()">Next ➡️</button>
        `;

        // 5. Update Rekap Saldo (Total Kredit = pemasukan bulan ini, bukan saldo awal + kredit)
        summaryEl.style.display = 'grid';
        if (document.getElementById("pc_total_debit")) document.getElementById("pc_total_debit").textContent = formatRupiah(summary.totalDebit || 0);
        if (document.getElementById("pc_total_kredit")) document.getElementById("pc_total_kredit").textContent = formatRupiah(summary.totalKredit || 0);
        if (document.getElementById("pc_saldo_akhir")) document.getElementById("pc_saldo_akhir").textContent = formatRupiah(summary.saldoAkhir || 0);
        if (document.getElementById("pc_saldo_awal")) document.getElementById("pc_saldo_awal").textContent = formatRupiah(summary.saldoAwal || 0);
    }

    function renderPettyCashFromResult(result) {
      window._lastPettyCashData = result && result.data ? result.data : [];
      window._lastPettyCashSummary = result && result.summary ? result.summary : { totalDebit: 0, totalKredit: 0, saldoAkhir: 0, saldoAwal: 0 };
      window._pcCurrentPage = 1; // Reset ke halaman 1 setiap ganti filter
      window.renderPettyCashPage(); // Panggil fungsi render ringan
    }

    // --- [BARU] Server-Side Pagination & Filtering (Mode: ServerDB) ---
    // Jika koneksi aktif adalah "server" (http://localhost:3001/db), maka pencarian + paging dilakukan oleh server (JSON ringan).
    window._pcUseServerPaging = false;
    try {
        if (typeof getRbmActiveConfig === 'function') {
            const cfg = getRbmActiveConfig();
            // [FIX] Jangan bergantung pada cfg.apiUrl; jika type=server tapi apiUrl kosong, fallback ke localhost.
            if (cfg && cfg.type === 'server') window._pcUseServerPaging = true;
        }
    } catch(e) {}

    if (window._pcUseServerPaging) {
        const cfg = (typeof getRbmActiveConfig === 'function') ? getRbmActiveConfig() : null;
        const apiUrl = (cfg && cfg.apiUrl) ? cfg.apiUrl : 'http://localhost:3001/db';
        const baseUrl = apiUrl.replace(/\/db\/?$/, '');
        const outlet = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || 'default';
        const searchVal = document.getElementById("pc_search") ? (document.getElementById("pc_search").value || '') : '';
        const page = window._pcCurrentPage || 1;
        const limit = rowsPerPage;

        const url = `${baseUrl}/api/petty-cash?outlet=${encodeURIComponent(outlet)}&from=${encodeURIComponent(tglAwal)}&to=${encodeURIComponent(tglAkhir)}&search=${encodeURIComponent(searchVal)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}&order=desc`;

        fetch(url).then(r => r.json()).then(function(result) {
            if (!result || result.error) {
                tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Gagal memuat dari server.</td></tr>';
                summaryEl.style.display = 'none';
                return;
            }

            // Render rows (sudah dipotong di server)
            const data = result.data || [];
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Tidak ada data ditemukan.</td></tr>';
            } else {
                tbody.innerHTML = data.map(function(row) {
                    return '<tr><td>' + (row.no || '') + '</td><td>' + (row.tanggal || '') + '</td><td>' + (row.nama || '') + '</td><td class="num">' + (row.jumlah || '') + '</td><td>' + (row.satuan || '') + '</td><td class="num">' + (row.harga ? formatRupiah(row.harga) : '') + '</td><td class="num">' + (row.debit ? formatRupiah(row.debit) : '') + '</td><td class="num">' + (row.kredit ? formatRupiah(row.kredit) : '') + '</td><td class="num">' + (row.saldo ? formatRupiah(row.saldo) : '') + '</td><td>-</td></tr>';
                }).join('');
            }

            // Pagination controls (server)
            const meta = result.meta || {};
            const totalPages = meta.totalPages || 1;
            let paginationEl = document.getElementById("pc_pagination");
            if (!paginationEl) {
                paginationEl = document.createElement("div");
                paginationEl.id = "pc_pagination";
                paginationEl.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;";
                tbody.closest('.table-card').appendChild(paginationEl);
            }
            // Kamu tidak pakai Prev/Next, jadi tombol disembunyikan.
            paginationEl.style.display = 'none';
            paginationEl.innerHTML = `
                <button class="btn btn-secondary" ${(page === 1) ? 'disabled' : ''} onclick="window._pcCurrentPage=(window._pcCurrentPage||1)-1; loadPettyCashData()">⬅️ Prev</button>
                <span style="font-size:14px; font-weight:bold; color:#1e40af;">Hal ${page} dari ${totalPages}</span>
                <button class="btn btn-secondary" ${(page === totalPages) ? 'disabled' : ''} onclick="window._pcCurrentPage=(window._pcCurrentPage||1)+1; loadPettyCashData()">Next ➡️</button>
            `;

            // Summary (server): ledger penuh per outlet di API
            const summary = result.summary || {};
            summaryEl.style.display = 'grid';
            if (document.getElementById("pc_total_debit")) document.getElementById("pc_total_debit").textContent = formatRupiah(summary.totalDebit || 0);
            if (document.getElementById("pc_total_kredit")) document.getElementById("pc_total_kredit").textContent = formatRupiah(summary.totalKredit || 0);
            if (document.getElementById("pc_saldo_akhir")) document.getElementById("pc_saldo_akhir").textContent = formatRupiah(summary.saldoAkhir || 0);
            if (document.getElementById("pc_saldo_awal")) document.getElementById("pc_saldo_awal").textContent = formatRupiah(summary.saldoAwal || 0);
            if (typeof window.showSyncIndicator === 'function') window.showSyncIndicator();
        }).catch(function(err) {
            tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Gagal memuat: ' + (err && err.message ? err.message : '') + '</td></tr>';
            summaryEl.style.display = 'none';
        });
        return;
    }

    if (useFirebaseBackend() && typeof FirebaseStorage !== 'undefined' && FirebaseStorage.getPettyCash) {
      // [SUPER OPTIMASI] Firebase paging: jangan load 1 bulan penuh sekaligus (bisa 1.000.000+ data).
      if (FirebaseStorage.getPettyCashPage) {
        const limit = rowsPerPage;
        const outlet = getRbmOutlet();
        const searchNow = (document.getElementById("pc_search") ? (document.getElementById("pc_search").value || '') : '');
        const queryKey = [outlet || '', tglAwal || '', tglAkhir || '', (searchNow || '').trim().toLowerCase(), limit].join('|');
        const ym = (monthVal || '').toString().trim();
        const cacheKey = (function(){
          const o = (outlet || '').toString().toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'default';
          const ym2 = (monthVal || '').toString().trim();
          const s = (searchNow || '').toString().trim().toLowerCase();
          return 'rbm_pc_cache_v1|' + o + '|' + ym2 + '|' + encodeURIComponent(s) + '|limit=' + limit;
        })();

        // [FIX] Setiap Tampilkan Data / Refresh / ganti filter: selalu mulai dari halaman 1.
        // Jika tidak di-reset, _pcFbCursor dari navigasi "Next" tetap dipakai → tabel kosong/salah & rekap Rp 0.
        window._pcFbQueryKey = queryKey;
        window._pcFbCursor = null;
        window._pcFbPageIndex = 1;
        window._pcFbPageCursors = [null];
        window._pcFbSearch = searchNow;

        // [BARU] Summary per-bulan: ambil dari node ringkas (cepat).
        if (FirebaseStorage.getPettyCashMonthSummary && /^\d{4}-\d{2}$/.test(ym)) {
          FirebaseStorage.getPettyCashMonthSummary(ym, outlet).then(function(ms) {
            ms = ms && typeof ms === 'object' ? ms : {};
            window._lastPettyCashSummary = {
              saldoAwal: parseFloat(ms.saldoAwal) || 0,
              totalDebit: parseFloat(ms.totalDebit) || 0,
              totalKredit: parseFloat(ms.totalKredit) || 0,
              saldoAkhir: parseFloat(ms.saldoAkhir) || 0
            };
            // Tampilkan summary walau list masih paging (node rbm_pro/petty_cash_month_summary/{outlet}/{YYYY-MM})
            summaryEl.style.display = 'grid';
            if (document.getElementById("pc_total_debit")) document.getElementById("pc_total_debit").textContent = formatRupiah(window._lastPettyCashSummary.totalDebit || 0);
            if (document.getElementById("pc_total_kredit")) document.getElementById("pc_total_kredit").textContent = formatRupiah(window._lastPettyCashSummary.totalKredit || 0);
            if (document.getElementById("pc_saldo_akhir")) document.getElementById("pc_saldo_akhir").textContent = formatRupiah(window._lastPettyCashSummary.saldoAkhir || 0);
            if (document.getElementById("pc_saldo_awal")) document.getElementById("pc_saldo_awal").textContent = formatRupiah(window._lastPettyCashSummary.saldoAwal || 0);
            try {
              var raw = localStorage.getItem(cacheKey);
              if (raw) {
                var c = JSON.parse(raw);
                c.ts = Date.now();
                c.summary = window._lastPettyCashSummary;
                localStorage.setItem(cacheKey, JSON.stringify(c));
              }
            } catch (e2) {}
          }).catch(function(e) { try { console.warn('getPettyCashMonthSummary', e); } catch (x) {} });
        }

        // Cache lokal: tampil instan saat masuk ulang halaman, lalu refresh di background.
        const cacheTtlMs = 5 * 60 * 1000; // 5 menit

        function tryRenderCacheIfFirstPage() {
          if (window._pcFbCursor) return; // hanya page pertama
          try {
            const raw = localStorage.getItem(cacheKey);
            if (!raw) return;
            const cached = JSON.parse(raw);
            if (!cached || !cached.ts || (Date.now() - cached.ts) > cacheTtlMs) return;
            if (!cached.data || !Array.isArray(cached.data)) return;
            window._lastPettyCashData = cached.data;
            window._lastPettyCashSummary = cached.summary || window._lastPettyCashSummary;
            // Render cepat dari cache
            const data = cached.data;
            tbody.innerHTML = data.length === 0
              ? '<tr><td colspan="10" class="table-empty">Tidak ada data ditemukan.</td></tr>'
              : data.map(function(row) {
                  var aksiBtn = (row._firebaseDate != null && row._firebaseIndexInDate != null)
                    ? '<button type="button" class="btn btn-secondary" style="font-size:11px; padding:4px 8px; margin-right:4px; background:#ffc107; color:#000; border:none;" onclick="editPettyCashItemFirebase(\'' + (row._firebaseDate || '') + '\', ' + (row._firebaseIndexInDate ?? '') + ')">Edit</button><button class="btn-small-danger" onclick="deletePettyCashItemFirebase(\'' + (row._firebaseDate || '') + '\', ' + (row._firebaseIndexInDate ?? '') + ')">Hapus</button>'
                    : '-';
                  return '<tr><td>' + (row.no || '') + '</td><td>' + (row.tanggal || '') + '</td><td>' + (row.nama || '') + '</td><td class="num">' + (row.jumlah || '') + '</td><td>' + (row.satuan || '') + '</td><td class="num">' + (row.harga ? formatRupiah(row.harga) : '') + '</td><td class="num">' + (row.debit ? formatRupiah(row.debit) : '') + '</td><td class="num">' + (row.kredit ? formatRupiah(row.kredit) : '') + '</td><td class="num">' + (row.saldo ? formatRupiah(row.saldo) : '') + '</td><td>' + aksiBtn + '</td></tr>';
                }).join('');
            const summary = cached.summary || {};
            summaryEl.style.display = 'grid';
            if (document.getElementById("pc_total_debit")) document.getElementById("pc_total_debit").textContent = formatRupiah(summary.totalDebit || 0);
            if (document.getElementById("pc_total_kredit")) document.getElementById("pc_total_kredit").textContent = formatRupiah(summary.totalKredit || 0);
            if (document.getElementById("pc_saldo_akhir")) document.getElementById("pc_saldo_akhir").textContent = formatRupiah(summary.saldoAkhir || 0);
            if (document.getElementById("pc_saldo_awal")) document.getElementById("pc_saldo_awal").textContent = formatRupiah(summary.saldoAwal || 0);
          } catch(e) {}
        }

        function saveCacheIfFirstPage(result) {
          if (window._pcFbCursor) return;
          try {
            var sm = (window._lastPettyCashSummary && typeof window._lastPettyCashSummary === 'object')
              ? window._lastPettyCashSummary
              : ((result && result.summary) ? result.summary : {});
            localStorage.setItem(cacheKey, JSON.stringify({
              ts: Date.now(),
              data: (result && result.data) ? result.data : [],
              summary: sm || {}
            }));
          } catch(e) {}
        }

        function loadPage(cursor, opts) {
          const silent = opts && opts.silent;
          // [FIX] cegah request dobel (sering terasa seperti "auto load" saat UI scroll/re-render)
          if (window._pcFbLoading) return;
          window._pcFbLoading = true;
          if (!silent) {
            tbody.innerHTML = '<tr><td colspan="10" class="table-loading">Memuat data...</td></tr>';
            summaryEl.style.display = 'none';
          }
          FirebaseStorage.getPettyCashPage({
            outletId: outlet,
            from: tglAwal,
            to: tglAkhir,
            search: window._pcFbSearch || '',
            limit: limit,
            cursor: cursor || null,
            order: 'desc' // data terbaru dulu
          }).then(function(result) {
            saveCacheIfFirstPage(result);
            window._lastPettyCashData = result && result.data ? result.data : [];
            // Summary halaman tidak dipakai; summary bulanan diambil dari node ringkas.
            window._pcFbCursor = result && result.page ? result.page.nextCursor : null;

            // render rows directly (server-style page)
            const data = window._lastPettyCashData || [];
            if (data.length === 0) {
              tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Tidak ada data ditemukan.</td></tr>';
            } else {
              tbody.innerHTML = data.map(function(row) {
                var aksiBtn = (row._firebaseDate != null && row._firebaseIndexInDate != null)
                      ? '<button type="button" class="btn btn-secondary" style="font-size:11px; padding:4px 8px; margin-right:4px; background:#ffc107; color:#000; border:none;" onclick="editPettyCashItemFirebase(\'' + (row._firebaseDate || '') + '\', ' + (row._firebaseIndexInDate ?? '') + ')">Edit</button><button type="button" class="btn-small-danger" onclick="deletePettyCashItemFirebase(\'' + (row._firebaseDate || '') + '\', ' + (row._firebaseIndexInDate ?? '') + ')">Hapus</button>'
                  : '-';
                return '<tr><td>' + (row.no || '') + '</td><td>' + (row.tanggal || '') + '</td><td>' + (row.nama || '') + '</td><td class="num">' + (row.jumlah || '') + '</td><td>' + (row.satuan || '') + '</td><td class="num">' + (row.harga ? formatRupiah(row.harga) : '') + '</td><td class="num">' + (row.debit ? formatRupiah(row.debit) : '') + '</td><td class="num">' + (row.kredit ? formatRupiah(row.kredit) : '') + '</td><td class="num">' + (row.saldo ? formatRupiah(row.saldo) : '') + '</td><td>' + aksiBtn + '</td></tr>';
              }).join('');
            }

            // lightweight pagination controls: Next only (cursor-based). Prev requires cursor stack.
            let paginationEl = document.getElementById("pc_pagination");
            if (!paginationEl) {
              paginationEl = document.createElement("div");
              paginationEl.id = "pc_pagination";
              paginationEl.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;";
              tbody.closest('.table-card').appendChild(paginationEl);
            }
            // Kamu tidak pakai Prev/Next, jadi tombol disembunyikan.
            paginationEl.style.display = 'none';
            // Expose lightweight handlers (tidak inject function besar ke HTML)
            window.pettyCashFbGoToPage = function(pageNum) {
              pageNum = parseInt(pageNum, 10) || 1;
              if (!window._pcFbPageCursors || pageNum < 1 || pageNum > (window._pcFbPageIndex || 1)) return;
              window._pcFbPageIndex = pageNum;
              const cursorParam = window._pcFbPageCursors[pageNum - 1];
              loadPage(cursorParam || null);
            };
            window.pettyCashFbPrevPage = function() {
              if ((window._pcFbPageIndex || 1) <= 1) return;
              window._pcFbPageIndex = (window._pcFbPageIndex || 1) - 1;
              const cursorParam = window._pcFbPageCursors[window._pcFbPageIndex - 1];
              loadPage(cursorParam || null);
            };
            window.pettyCashFbNextPage = function() {
              if (!window._pcFbCursor) return; // belum ada halaman berikutnya
              window._pcFbPageIndex = (window._pcFbPageIndex || 1) + 1;
              window._pcFbPageCursors = window._pcFbPageCursors || [];
              window._pcFbPageCursors[window._pcFbPageIndex - 1] = window._pcFbCursor; // cursor untuk halaman yang akan tampil
              loadPage(window._pcFbCursor);
            };

            // Tampilkan kotak nomor halaman di bagian bawah
            paginationEl.style.display = 'flex';
            (function renderPageBoxes() {
              const cur = window._pcFbPageIndex || 1;
              const max = cur; // hanya tampilkan halaman yang sudah dikunjungi
              let html = '';
              for (let i = 1; i <= max; i++) {
                const active = i === cur;
                html += `<button class="btn ${active ? 'btn-primary' : 'btn-secondary'}" style="min-width:44px;" ${active ? 'disabled' : ''} onclick="window.pettyCashFbGoToPage(${i})">${i}</button>`;
              }
              // Prev/Next kecil (opsional) tetap ada, tapi nomor utama sudah kelihatan.
              html += `<span style="width:10px"></span>`;
              html += `<button class="btn btn-secondary" ${cur <= 1 ? 'disabled' : ''} onclick="window.pettyCashFbPrevPage()">⬅</button>`;
              html += `<button class="btn btn-secondary" ${window._pcFbCursor ? '' : 'disabled'} onclick="window.pettyCashFbNextPage()">➡</button>`;
              paginationEl.innerHTML = html;
            })();

            // Jika tabel ada nominal tapi rekap masih 0 (race / summary DB lama), ambil ulang ringkasan bulan
            var rowsCheck = result && result.data ? result.data : [];
            var hasNom = rowsCheck.some(function(r) {
              return (parseFloat(r.debit) || 0) !== 0 || (parseFloat(r.kredit) || 0) !== 0;
            });
            var sum0 = window._lastPettyCashSummary && (parseFloat(window._lastPettyCashSummary.totalDebit) || 0) === 0
              && (parseFloat(window._lastPettyCashSummary.totalKredit) || 0) === 0
              && (parseFloat(window._lastPettyCashSummary.saldoAkhir) || 0) === 0
              && (parseFloat(window._lastPettyCashSummary.saldoAwal) || 0) === 0;
            if (hasNom && sum0 && FirebaseStorage.getPettyCashMonthSummary && /^\d{4}-\d{2}$/.test(ym)) {
              FirebaseStorage.getPettyCashMonthSummary(ym, outlet).then(function(ms) {
                ms = ms && typeof ms === 'object' ? ms : {};
                window._lastPettyCashSummary = {
                  saldoAwal: parseFloat(ms.saldoAwal) || 0,
                  totalDebit: parseFloat(ms.totalDebit) || 0,
                  totalKredit: parseFloat(ms.totalKredit) || 0,
                  saldoAkhir: parseFloat(ms.saldoAkhir) || 0
                };
                summaryEl.style.display = 'grid';
                if (document.getElementById("pc_total_debit")) document.getElementById("pc_total_debit").textContent = formatRupiah(window._lastPettyCashSummary.totalDebit || 0);
                if (document.getElementById("pc_total_kredit")) document.getElementById("pc_total_kredit").textContent = formatRupiah(window._lastPettyCashSummary.totalKredit || 0);
                if (document.getElementById("pc_saldo_akhir")) document.getElementById("pc_saldo_akhir").textContent = formatRupiah(window._lastPettyCashSummary.saldoAkhir || 0);
                if (document.getElementById("pc_saldo_awal")) document.getElementById("pc_saldo_awal").textContent = formatRupiah(window._lastPettyCashSummary.saldoAwal || 0);
                try {
                  var raw2 = localStorage.getItem(cacheKey);
                  if (raw2) {
                    var c2 = JSON.parse(raw2);
                    c2.ts = Date.now();
                    c2.summary = window._lastPettyCashSummary;
                    localStorage.setItem(cacheKey, JSON.stringify(c2));
                  }
                } catch (e3) {}
              }).catch(function() {});
            }
            if (typeof window.showSyncIndicator === 'function') window.showSyncIndicator();
          }).catch(function(err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Gagal memuat: ' + (err && err.message ? err.message : '') + '</td></tr>';
            summaryEl.style.display = 'none';
          }).finally(function() { window._pcFbLoading = false; });
        }

        // gunakan cursor jika ada (next page), kalau tidak (page 1)
        tryRenderCacheIfFirstPage();
        // refresh dari network (silent jika cache sudah tampil)
        loadPage(window._pcFbCursor || null, { silent: true });
      } else {
        FirebaseStorage.getPettyCash(tglAwal, tglAkhir, getRbmOutlet()).then(function(result) {
            renderPettyCashFromResult(result);
            if (typeof window.showSyncIndicator === 'function') window.showSyncIndicator();
        }).catch(function(err) {
          tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Gagal memuat: ' + (err && err.message ? err.message : '') + '</td></tr>';
          summaryEl.style.display = 'none';
        });
      }
      return;
    }
    if (!isGoogleScript()) {
      setTimeout(() => {
          const pending = getCachedParsedStorage(getRbmStorageKey('RBM_PENDING_PETTY_CASH'), []);
          if (pending.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Tidak ada data. Buka dari Google Apps Script untuk data dari sheet, atau input data dulu.</td></tr>';
            return;
          }
          let no = 0;
          let totalDebit = 0, totalKredit = 0;
          let saldoAwal = 0;
          let runningSaldo = 0;
          const rows = [];
          
          // Sort data pending berdasarkan tanggal agar perhitungan saldo urut
          pending.sort((a, b) => (a.payload.tanggal || '').localeCompare(b.payload.tanggal || ''));

          pending.forEach(function(item, parentIdx) {
            const p = item.payload || {};
            
            // [FIX] Filter data berdasarkan tanggal yang dipilih
            let d = p.tanggal || '';
            // Normalize stored date to YYYY-MM-DD (pad single digits) just for comparison
            if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(d)) {
                 const parts = d.split('-');
                 d = parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
            }
            
            // Jika tanggal sebelum periode, hitung sebagai Saldo Awal
            if (d < tglAwal) {
                (p.transactions || []).forEach(function(trx) {
                    const debit = (p.jenis === 'pengeluaran' && trx.total) ? parseFloat(trx.total) || 0 : 0;
                    const kredit = (p.jenis === 'pemasukan' && trx.total) ? parseFloat(trx.total) || 0 : 0;
                    saldoAwal = saldoAwal - debit + kredit;
                });
                return;
            }
            
            // Jika tanggal setelah periode, abaikan
            if (d > tglAkhir) return;

            // Set runningSaldo awal jika ini baris pertama yang ditampilkan
            if (rows.length === 0) runningSaldo = saldoAwal;

            (p.transactions || []).forEach(function(trx, trxIdx) {
              no++;
              const debit = (p.jenis === 'pengeluaran' && trx.total) ? parseFloat(trx.total) || 0 : 0;
              const kredit = (p.jenis === 'pemasukan' && trx.total) ? parseFloat(trx.total) || 0 : 0;
              totalDebit += debit;
              totalKredit += kredit;
              runningSaldo = runningSaldo - debit + kredit;
              
              rows.push({ no, tanggal: p.tanggal || '-', nama: trx.nama || '', jumlah: trx.jumlah, satuan: trx.satuan || '', harga: trx.harga || '', debit, kredit, saldo: runningSaldo, parentIdx, trxIdx });
            });
          });
          if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Tidak ada data untuk rentang ini.</td></tr>';
            // [FIX] Reset summary jika tidak ada data
            document.getElementById("pc_total_debit").textContent = formatRupiah(0);
            document.getElementById("pc_total_kredit").textContent = formatRupiah(0);
            document.getElementById("pc_saldo_akhir").textContent = formatRupiah(saldoAwal); // Tampilkan saldo awal sebagai saldo akhir
            if (document.getElementById("pc_saldo_awal")) document.getElementById("pc_saldo_awal").textContent = formatRupiah(saldoAwal);
            return;
          }
          
          // Panggil logic render dengan format yang sama
          window._lastPettyCashData = rows;
          window._lastPettyCashSummary = { totalDebit: totalDebit, totalKredit: totalKredit, saldoAkhir: runningSaldo, saldoAwal: saldoAwal };
          window._pcCurrentPage = 1;
          window.renderPettyCashPage();
      }, 50);
      return;
    }

    google.script.run
      .withSuccessHandler(function(result) {
        if (result.error) {
          tbody.innerHTML = '<tr><td colspan="10" class="table-empty">' + result.error + '</td></tr>';
          return;
        }
        const data = result.data || [];
        const summary = result.summary || {};

        if (data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Tidak ada data untuk rentang tanggal ini.</td></tr>';
        } else {
          tbody.innerHTML = data.map(row => `
            <tr>
              <td>${row.no || ''}</td>
              <td>${row.tanggal || ''}</td>
              <td>${row.nama || ''}</td>
              <td class="num">${row.jumlah || ''}</td>
              <td>${row.satuan || ''}</td>
              <td class="num">${row.harga ? formatRupiah(row.harga) : ''}</td>
              <td class="num">${row.debit ? formatRupiah(row.debit) : ''}</td>
              <td class="num">${row.kredit ? formatRupiah(row.kredit) : ''}</td>
              <td class="num">${row.saldo ? formatRupiah(row.saldo) : ''}</td>
              <td>-</td>
            </tr>
          `).join('');
        }

        summaryEl.style.display = 'grid';
        document.getElementById("pc_total_debit").textContent = formatRupiah(summary.totalDebit);
        if (document.getElementById("pc_saldo_awal")) document.getElementById("pc_saldo_awal").textContent = formatRupiah(summary.saldoAwal || 0);
        document.getElementById("pc_total_kredit").textContent = formatRupiah(summary.totalKredit);
        document.getElementById("pc_saldo_akhir").textContent = formatRupiah(summary.saldoAkhir);
      })
      .withFailureHandler(function(err) {
        tbody.innerHTML = '<tr><td colspan="11" class="table-empty">Gagal memuat: ' + err.message + '</td></tr>';
      })
      .getDataPettyCash(tglAwal, tglAkhir);
  }

  const defaultSisaItems = ["S. Vietnam", "S. Teriyaki", "S. Madu", "S. Asam Manis", "S. Ladah Hitam", "Daging Rice Bowl", "Ayam Rice Bowl", "Ayam Filet", "Toping Ayam", "Toping Jamur", "K. Merah", "K. Hijau", "Timun", "Tomat", "Pokcoy", "Bombay", "Daun Bawang", "Semangka", "Melon", "Buah Naga", "Nutrijel Gelap", "Nutrijel Terang", "Gula Es Campur", "S. Jawa", "Beras"];
  const defaultInventarisItems = ["Name Tag", "Baju", "Topi", "Apron", "Sumpit Kecil", "Sumpit Besar", "Sompet Besi", "Tray Waiter", "Tray Kasir", "tray Kecil", "Astray", "Sendok", "Garbu", "Tempat Es CMPR", "Sendok Es CMPR K", "Sendok Es CMPR B", "Mangkok 1p", "Mangkok 2p", "Mangkok 4p", "Mangkok 8p", "Mangkok 10p", "Mangkok 30p", "Mangkok Mie Kuah", "Mangkok Rice Bowl", "Mangkok Kuah", "Meja", "Kursi Hitam", "Kursi Kayu", "Tempat Sambel Kotak Hitam", "Tempat Sambel", "Tempat Sambel Besar", "Tempat Sambel Kotak", "Tempat Saos", "Tempat Tusuk Gigi", "Nomer Meja", "Tempat Menu", "Gelas Panas", "Gelas Dingin", "Saringan Mie", "Serok Pengorengan", "Stainless Bulat Cuci Beras", "Capitan Setelsis", "Piring Gorengan Kecil", "Piring gorengan Besar", "Tutup Stainless Kecil 22", "Tutup Stainless Besar", "Tempat Sambal Stainless", "Waterjack Kecil", "Waterjack Besar", "Loyang Stainless", "Tutup Stainless Sedang", "Food Pan Stenlist GN 1/9", "Food Pan Stenlist GN 1/3", "Food Pan Stenlist GN 1/3 (200)", "Panci", "Wajan Kecil", "Wajan Besar", "Teflon", "Solet Telur", "Sutil Plastik", "Cetakan Telur", "Kompor Getra (Mie)", "Kompor Miyako", "Kompor Tungku", "Kompor Dudukan", "Kompor Jos", "Pengorengan", "Kompor Rumah Tangga", "Kompor Tungku", "Kompor Dudukan", "Tempat Pemanas Air", "Fliser", "Chiler", "Pendingin Air", "Penghangat Air", "Rice Cooker", "Magic Jar", "Kompor Hook", "Fryerr", "Rak Piring Kecil", "Rak Piring Besar", "Rak Barang", "Freezer kecil", "Freezer BESAR", "Kipas Angin Kecil", "Kipas Angin Besar", "Kulkas", "Blender", "Meja Dapur", "Washtaffle", "Botol Kecap Asin", "Rak Bumbu", "Botol Telur/SKM", "Skup Tepung", "Keranjang Freezer", "Sutil Stainless", "Dispenser Tisu", "Galon", "Talenan", "Timbangan", "Pisau Kecil", "Pisau Sedang", "Pisau Besar", "Pisau Roti", "Apar Pemadam", "Corong", "Tempat Sampah Kecil", "Tempat Sampah Besar", "Troli", "Payung", "Tempat Payung", "Mosquito Killer Kriskow", "Kulkas Kecil", "Electric Ice Shaver", "Gea", "Cup Sealer", "Mesin Gula", "Tempat Es Batu Kristal", "Rak Bar + Krupuk", "Tempat Cup 12 oz", "Ciller Kondimen Es Campur", "Tempat Biru Sendok Garbu", "Rak Kecil Stainlees", "Standing Menu Besar", "Standing Menu Kecil", "Print Checker", "Astray Sampah", "Mesin EDC Mandiri", "Mesin EDC BCA", "Kalkulator", "Pembatas Kasir", "Mesin Absen", "Karpet Playground", "Kuda", "Prosotan", "Standing Bunga", "Baby Chair", "Semprotan", "Karpet Karet Hutam", "Speaker", "Mixer", "Mix", "Akrilik Open/Close", "Keset", "Rak Meja Waiter", "Sikat Besar", "Sikat Kecil", "Sikat WC", "Spons Kuning Hija", "Skep Kecil", "Skep Besar", "Loby Duster", "Watering Pot", "Pel 1 Set", "Dispenser Tisu Kecil", "Dispenser Stella Matic Refill", "Pengharum Ruangan", "Burung Hantu", "Bak", "Gayung", "Botol Sabun Cuci Tangan", "Pager Gantung", "Daun Gantung", "Daun Gantung Bulat", "Mini Pot Kamar Mandi", "Pigora Kecil", "Pigora sedang", "pigora besar", "Gantungan baju", "Lap Kecil", "Blower", "Jam dinding", "Cikrak", "Sapu", "Pel Bar", "Remote AC", "Pigora Menu", "Papan kecil", "Papan Sedang", "CCTV", "Remote TB", "Tusuk Print Checker", "Bel", "NeonBox", "Standing Warming", "Bax Biru", "Cas Type C", "Hp Resto", "Mouse", "Stapless", "Layar Proyektor", "Di spenser solasi", "Gunting kecil", "Gunting sedang", "PC"];

  function createBarangRows(){
    const container=document.getElementById("detail-container-barang");
    container.innerHTML="";
    const jenis=document.getElementById("jenis_barang").value;
    
    // --- Datalist logic start ---
    const oldDatalist1 = document.getElementById("nama-items");
    if(oldDatalist1) oldDatalist1.remove();
    const oldDatalist2 = document.getElementById("barang-items-datalist");
    if(oldDatalist2) oldDatalist2.remove();

    // Create datalist from Stok Barang (aman jika sales/fruits/notsales bukan array)
    const stokKey = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_STOK_ITEMS') : 'RBM_STOK_ITEMS';
    const raw = getCachedParsedStorage(stokKey, { sales: [], fruits: [], notsales: [] });
    const sales = Array.isArray(raw && raw.sales) ? raw.sales : [];
    const fruits = Array.isArray(raw && raw.fruits) ? raw.fruits : [];
    const notsales = Array.isArray(raw && raw.notsales) ? raw.notsales : [];
    const combinedItems = [ ...sales, ...fruits, ...notsales ];
    const uniqueNames = [...new Set(combinedItems.map(item => item.name))];

    if (uniqueNames.length > 0) {
        const datalist = document.createElement("datalist");
        datalist.id = "barang-items-datalist";
        datalist.innerHTML = uniqueNames.map(item => `<option value="${item}"></option>`).join("");
        document.body.appendChild(datalist);
    }
    // --- Datalist logic end ---

    for(let i=0;i<9;i++){
        const row=document.createElement("div");
        row.className="row-group";
        
        const namaDiv=document.createElement("div");
        namaDiv.style.flex="2.5";
        const namaInput=document.createElement("input");
        namaInput.type="text";
        namaInput.name="nama_barang_"+i;
        namaInput.setAttribute("aria-label", "Nama Barang");
        namaInput.className="nama_barang";
        namaInput.placeholder="Nama Barang";
        if(jenis && uniqueNames.length > 0){ 
            namaInput.setAttribute("list","barang-items-datalist");
        }
        namaDiv.appendChild(namaInput);

        const satuanDiv=document.createElement("div");
        satuanDiv.style.flex="0.9";
        satuanDiv.style.minWidth="60px";
        const satuanInput=document.createElement("input");
        satuanInput.type="text";
        satuanInput.name="satuan_barang_"+i;
        satuanInput.setAttribute("aria-label", "Satuan Barang");
        satuanInput.className="satuan_barang";
        satuanInput.placeholder="Satuan";
        satuanInput.readOnly=true;
        satuanInput.style.background="#f0f0f0";
        satuanInput.style.cursor="default";
        satuanInput.title="Otomatis dari Stok Barang";
        satuanDiv.appendChild(satuanInput);
        namaInput.addEventListener("input", function(){
            const unit = getStokUnitByName(this.value);
            satuanInput.value = unit;
        });
        namaInput.addEventListener("change", function(){
            const unit = getStokUnitByName(this.value);
            satuanInput.value = unit;
        });
        
        const jumlahDiv=document.createElement("div");
        jumlahDiv.style.flex="1.2";
        const jumlahInput=document.createElement("input");
        jumlahInput.type="number";
        jumlahInput.name="jumlah_barang_"+i;
        jumlahInput.setAttribute("aria-label", "Jumlah Barang");
        jumlahInput.className="jumlah_barang";
        jumlahInput.placeholder="Jumlah";
        jumlahDiv.appendChild(jumlahInput);
        
        const barangJadiDiv=document.createElement("div");
        barangJadiDiv.style.flex="1.2";
        barangJadiDiv.style.display=jenis==="barang keluar"?"block":"none";
        const barangJadiInput=document.createElement("input");
        barangJadiInput.type="text";
        barangJadiInput.name="barangjadi_barang_"+i;
        barangJadiInput.setAttribute("aria-label", "Barang Jadi");
        barangJadiInput.className="barangjadi_barang";
        barangJadiInput.placeholder="Barang Jadi";
        barangJadiDiv.appendChild(barangJadiInput);

        const keteranganRusakDiv = document.createElement("div");
        keteranganRusakDiv.style.flex = "2";
        keteranganRusakDiv.style.display = jenis === "rusak" ? "block" : "none";
        const keteranganRusakInput = document.createElement("textarea");
        keteranganRusakInput.className = "keterangan_rusak";
        keteranganRusakInput.name = "keterangan_rusak_"+i;
        keteranganRusakInput.setAttribute("aria-label", "Keterangan Rusak");
        keteranganRusakInput.placeholder = "Keterangan mengapa rusak...";
        keteranganRusakInput.rows = 1;
        keteranganRusakDiv.appendChild(keteranganRusakInput);

        const rusakTujuanDiv = document.createElement("div");
        rusakTujuanDiv.style.flex = "1.8";
        rusakTujuanDiv.style.display = jenis === "rusak" ? "block" : "none";
        rusakTujuanDiv.title = "Pilih kategori tujuan rusak: Same Item on Sales, Fruits & Vegetables, atau Same Item Not Sales";
        const rusakTujuanLabel = document.createElement("label");
        rusakTujuanLabel.style.display = "block";
        rusakTujuanLabel.style.fontSize = "11px";
        rusakTujuanLabel.style.color = "#64748b";
        rusakTujuanLabel.style.marginBottom = "2px";
        rusakTujuanLabel.textContent = "Rusak masuk ke:";
        rusakTujuanDiv.appendChild(rusakTujuanLabel);
        const rusakTujuanSelect = document.createElement("select");
        rusakTujuanSelect.className = "rusak_tujuan_kategori";
        rusakTujuanSelect.name = "rusak_tujuan_kategori_"+i;
        rusakTujuanSelect.setAttribute("aria-label", "Tujuan Kategori Rusak");
        rusakTujuanSelect.innerHTML = '<option value="sales">Same Item on Sales</option><option value="fruits">Fruits & Vegetables</option><option value="notsales">Same Item Not Sales</option>';
        rusakTujuanSelect.style.padding = "6px 8px";
        rusakTujuanSelect.style.width = "100%";
        rusakTujuanDiv.appendChild(rusakTujuanSelect);

        const fotoRusakDiv = document.createElement("div");
        fotoRusakDiv.style.flex = "1.5";
        fotoRusakDiv.style.display = jenis === "rusak" ? "block" : "none";
        const fotoRusakInput = document.createElement("input");
        fotoRusakInput.type = "file";
        fotoRusakInput.name = "foto_barang_rusak_"+i;
        fotoRusakInput.setAttribute("aria-label", "Foto Barang Rusak");
        fotoRusakInput.className = "foto_barang_rusak";
        fotoRusakInput.accept = "image/*";
        fotoRusakDiv.appendChild(fotoRusakInput);

        row.appendChild(namaDiv);
        row.appendChild(satuanDiv);
        row.appendChild(jumlahDiv);
        row.appendChild(barangJadiDiv);
        row.appendChild(keteranganRusakDiv);
        row.appendChild(rusakTujuanDiv);
        row.appendChild(fotoRusakDiv);
        container.appendChild(row)
    }
}

function submitDataBarang(){
    const button=document.getElementById("submitButtonBarang");
    button.disabled=true;
    button.innerText="Menyimpan... ⏳";
    const tanggal=document.getElementById("tanggal_barang").value;
    const jenis=document.getElementById("jenis_barang").value;
    const rows=document.querySelectorAll("#input-barang-view .row-group");
    const dataList=[];
    const filePromises = [];
    const stokUpdates = [];
    const reportItems = []; // Array untuk menampung laporan status stok

    if(!tanggal||!jenis){
        document.getElementById("outputBarang").innerText="⚠️ Tanggal dan Jenis wajib diisi.";
        button.disabled=false;
        button.innerText="Simpan Data Barang";
        return
    }
    
    rows.forEach(row=>{
        const nama=row.querySelector(".nama_barang").value.trim();
        const jumlah=row.querySelector(".jumlah_barang").value.trim();
        const barangjadi=row.querySelector(".barangjadi_barang")?.value.trim()||"";
        
        if(nama&&jumlah){
            const itemData = {tanggal,jenis,nama,jumlah,barangjadi, keteranganRusak: null, fotoRusak: null, tujuanKategori: null};
            
            if (jenis === 'rusak') {
                itemData.keteranganRusak = row.querySelector(".keterangan_rusak")?.value.trim() || "";
                itemData.tujuanKategori = row.querySelector(".rusak_tujuan_kategori")?.value || "sales";
                const fotoInput = row.querySelector(".foto_barang_rusak");
                if (fotoInput && fotoInput.files[0]) {
                    const file = fotoInput.files[0];
                    filePromises.push(uploadImageWithCompression(file, 'barang_rusak').then(res => {
                        itemData.fotoRusak = res;
                    }));
                }
            }
            dataList.push(itemData);
        }
    });
    
    if(dataList.length===0){
        document.getElementById("outputBarang").innerText="⚠️ Masukkan minimal 1 data barang.";
        button.disabled=false;
        button.innerText="Simpan Data Barang";
        return
    }

    Promise.all(filePromises).then(() => {
        // Validasi: barang rusak wajib ada keterangan ATAU foto (minimal salah satu)
        const rusakRows = dataList.filter(d => d.jenis === 'rusak');
        const rusakInvalid = rusakRows.some(d => {
            const hasKet = d.keteranganRusak && d.keteranganRusak.trim();
            const hasFoto = d.fotoRusak && d.fotoRusak.data;
            return !hasKet && !hasFoto;
        });
        if (rusakInvalid) {
            document.getElementById("outputBarang").innerText = "⚠️ Barang rusak wajib diisi Keterangan atau Foto (minimal salah satu).";
            button.disabled = false;
            button.innerText = "Simpan Data Barang";
            return;
        }

        const stokUpdates = [];
        const reportItems = [];
        dataList.forEach(itemData => {
            let itemInfo = null;
            if (itemData.jenis === 'rusak') {
                itemInfo = findStokItemIdByCategory(itemData.nama, itemData.tujuanKategori || 'sales');
                if (!itemInfo) itemInfo = findStokItemId(itemData.nama);
            } else {
                itemInfo = findStokItemId(itemData.nama);
            }
            let isNew = false;
            if (!itemInfo) {
                const stokKey = getRbmStorageKey('RBM_STOK_ITEMS');
                const allItems = getCachedParsedStorage(stokKey, { sales: [], fruits: [], notsales: [] });
                const newId = Date.now() + Math.floor(Math.random() * 10000);
                const newItem = { id: newId, name: itemData.nama, unit: 'Pcs', ratio: 1 };
                allItems.sales.push(newItem);
                RBMStorage.setItem(stokKey, JSON.stringify(allItems));
                window._rbmParsedCache[stokKey] = { data: allItems };
                itemInfo = { id: newId, category: 'sales', ratio: 1, name: itemData.nama };
                isNew = true;
            }
            if (itemInfo) {
                const u = { id: itemInfo.id, date: itemData.tanggal, type: itemData.jenis, qty: parseFloat(itemData.jumlah), extra: itemData.barangjadi };
                if (itemData.jenis === 'rusak') {
                    u.keterangan = itemData.keteranganRusak || '';
                    u.foto = itemData.fotoRusak || null;
                }
                stokUpdates.push(u);
                reportItems.push({ name: itemData.nama, category: itemInfo.category, date: itemData.tanggal, isNew: isNew });
            }
        });

        // Update stok tabel dulu di semua mode
        processStokUpdates(stokUpdates);
        if (reportItems.length > 0) {
            let msg = "Laporan Update Stok:\n";
            reportItems.forEach(item => {
                msg += `- ${item.name}: Masuk ke kategori '${item.category}' pada tgl ${item.date}`;
                if (item.isNew) msg += " (Item Baru - Default Sales)";
                msg += "\n";
            });
            msg += "\nJika tidak muncul di tabel, pastikan Anda melihat Tab Kategori dan Bulan yang sesuai.";
            alert(msg);
        }

        if (useFirebaseBackend()) {
          FirebaseStorage.saveDatabaseBarang(dataList).then(showResultBarang).catch(function(err) { showResultBarang('❌ ' + (err && err.message ? err.message : 'Gagal menyimpan ke Firebase.')); });
          return;
        }

        if (!isGoogleScript()) {
          savePendingToLocalStorage('BARANG', dataList);
          showResultBarang('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
          return;
        }

        google.script.run.withSuccessHandler(showResultBarang).simpanDataOnline(dataList);
    }).catch(error => {
        document.getElementById("outputBarang").innerText="❌ Gagal memproses file: "+error;
        button.disabled=false;
        button.innerText="Simpan Data";
    });
}

function showResultBarang(res) {
  const output = document.getElementById("outputBarang");
  const button = document.getElementById("submitButtonBarang");
  output.innerText = res;
  button.disabled = false;
  button.innerText = "Simpan Data Barang";
  document.getElementById("jenis_barang").value = "";
  createBarangRows();
  setTimeout(() => { output.innerText = "" }, 3000);
}

function createTransactionRows() {
  const container = document.getElementById("detail-container-keuangan");
  const jenis = document.getElementById("jenis_transaksi").value;
  container.innerHTML = "";

  if (!jenis) {
    for (let i = 0; i < 8; i++) {
      container.innerHTML += `<div class="row-group"><div style="flex: 2.5;"><input type="text" placeholder="Pilih Jenis Transaksi di atas" disabled></div><div style="flex: 1.2;"><input type="text" placeholder="..." disabled></div></div>`;
    }
    return;
  }

  const isPengeluaran = (jenis === 'pengeluaran');

  for (let i = 0; i < 10; i++) {
    const row = document.createElement("div");
    row.className = "row-group";

    const namaInput = `<div class="col-nama"><input type="text" class="nama_keuangan" name="nama_keuangan_${i}" aria-label="Keterangan" placeholder="${isPengeluaran ? 'Nama Barang' : 'Keterangan'}"></div>`;
    const jumlahInput = `<div class="col-jumlah"><input type="number" class="jumlah_keuangan" name="jumlah_keuangan_${i}" aria-label="Jumlah" placeholder="Qty" oninput="calculateRowTotal(this)"></div>`;
    const hargaInput = `<div class="col-harga"><input type="number" class="harga_keuangan" name="harga_keuangan_${i}" aria-label="Harga" placeholder="Harga Satuan" oninput="calculateRowTotal(this)"></div>`;
    const totalInput = `<div class="col-total"><input type="text" class="total_keuangan" name="total_keuangan_${i}" aria-label="Total" placeholder="Total Rp" readonly style="background: #f0f0f0; font-weight: bold;"></div>`;
    const satuanInput = `<div class="col-satuan"><input type="text" class="satuan_keuangan" name="satuan_keuangan_${i}" aria-label="Satuan" placeholder="Satuan"></div>`;
    const fotoInput = `<div class="col-foto"><input type="file" class="foto_keuangan" name="foto_keuangan_${i}" aria-label="Foto Keuangan" accept="image/*"></div>`;

    if (isPengeluaran) {
      row.innerHTML = namaInput + jumlahInput + satuanInput + hargaInput + totalInput + fotoInput;
    } else {
      row.innerHTML = namaInput + jumlahInput + fotoInput;
    }

    container.appendChild(row);
  }
}

function calculateRowTotal(element) {
  const row = element.closest('.row-group');
  const qty = parseFloat(row.querySelector(".jumlah_keuangan").value) || 0;
  const harga = parseFloat(row.querySelector(".harga_keuangan").value) || 0;
  const total = qty * harga;
  const totalField = row.querySelector(".total_keuangan");
  if (totalField) {
    totalField.value = total > 0 ? total.toLocaleString('id-ID') : "";
  }
}

function submitTransactions() {
  const button = document.getElementById("submitButtonKeuangan");
  const output = document.getElementById("outputKeuangan");
  const tanggal = document.getElementById("tanggal_keuangan").value;
  const jenis = document.getElementById("jenis_transaksi").value;

  button.disabled = true;
  button.innerText = "Menyimpan... ⏳";
  output.innerText = "";

  if (!tanggal || !jenis) {
    output.innerText = "⚠️ Tanggal dan Jenis Transaksi wajib diisi.";
    button.disabled = false;
    button.innerText = "Simpan Transaksi";
    return;
  }

  const rows = document.querySelectorAll("#input-keuangan-view .row-group");
  const transactionList = [];
  const filePromises = [];

  rows.forEach(row => {
    const namaInput = row.querySelector(".nama_keuangan");
    const jumlahInput = row.querySelector(".jumlah_keuangan");

    if (namaInput && jumlahInput && namaInput.value.trim() && jumlahInput.value.trim()) {
      const transaction = {
        nama: namaInput.value.trim(),
        jumlah: jumlahInput.value.trim(),
        metode: row.querySelector(".metode_keuangan")?.value.trim() || "",
        satuan: row.querySelector(".satuan_keuangan")?.value.trim() || "",
        harga: row.querySelector(".harga_keuangan")?.value.trim() || "",
        total: (parseFloat(jumlahInput.value) || 0) * (parseFloat(row.querySelector(".harga_keuangan")?.value) || 0),
        foto: null
      };
      transactionList.push(transaction);

      const fileInput = row.querySelector(".foto_keuangan");
      if (fileInput && fileInput.files[0]) {
        const file = fileInput.files[0];
        filePromises.push(uploadImageWithCompression(file, 'keuangan').then(res => {
            transaction.foto = res;
        }));
      }
    }
  });

  if (transactionList.length === 0) {
    output.innerText = "⚠️ Masukkan minimal 1 data transaksi.";
    button.disabled = false;
    button.innerText = "Simpan Transaksi";
    return;
  }

  Promise.all(filePromises).then(() => {
    const dataToSend = { tanggal: tanggal, jenis: jenis, transactions: transactionList };
    if (useFirebaseBackend()) {
      FirebaseStorage.savePettyCashTransactions(dataToSend, getRbmOutlet()).then(showResultKeuangan).catch(function(err) { showResultKeuangan('❌ ' + (err && err.message ? err.message : 'Gagal menyimpan ke Firebase.')); });
      return;
    }
    if (!isGoogleScript()) {
      savePendingToLocalStorage('KEUANGAN', dataToSend);
      showResultKeuangan('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
      return;
    }
    google.script.run.withSuccessHandler(showResultKeuangan).simpanTransaksiBatch(dataToSend);
  }).catch(error => {
    output.innerText = "❌ Gagal memproses file: " + error;
    button.disabled = false;
    button.innerText = "Simpan Transaksi";
  });
}

function showResultKeuangan(res) {
  const output = document.getElementById("outputKeuangan");
  const button = document.getElementById("submitButtonKeuangan");
  output.innerText = res;
  button.disabled = false;
  button.innerText = "Simpan Transaksi";
  document.getElementById("jenis_transaksi").value = "";
  createTransactionRows();
  setTimeout(() => { output.innerText = "" }, 4000);
}

function getInventarisDaftarBarang() {
  var key = getRbmStorageKey('RBM_INVENTARIS_DAFTAR_BARANG');
  var raw = RBMStorage.getItem(key);
  var arr = safeParse(raw, []);
  if (!Array.isArray(arr)) return defaultInventarisItems.slice();
  if (arr.length === 0) return defaultInventarisItems.slice();
  return arr;
}

function setInventarisDaftarBarang(arr) {
  var key = getRbmStorageKey('RBM_INVENTARIS_DAFTAR_BARANG');
  RBMStorage.setItem(key, JSON.stringify(Array.isArray(arr) ? arr : []));
}

function addInventarisDaftarBarang(nama) {
  var n = (nama || '').trim();
  if (!n) return;
  var list = getInventarisDaftarBarang();
  if (!Array.isArray(list)) list = [];
  else list = list.slice();
  if (list.indexOf(n) >= 0) return;
  list.push(n);
  list.sort(function(a, b) { return String(a).localeCompare(String(b)); });
  setInventarisDaftarBarang(list);
  var inp = document.getElementById('inv_daftar_barang_nama');
  if (inp) inp.value = '';
  renderInventarisDaftarBarang();
  if (document.getElementById('detail-container-inventaris') && typeof createInventarisRows === 'function') createInventarisRows();
}

function removeInventarisDaftarBarang(idx) {
  var list = getInventarisDaftarBarang();
  if (!Array.isArray(list)) list = [];
  else list = list.slice();
  if (idx < 0 || idx >= list.length) return;
  list.splice(idx, 1);
  setInventarisDaftarBarang(list.length ? list : []);
  renderInventarisDaftarBarang();
  if (document.getElementById('detail-container-inventaris') && typeof createInventarisRows === 'function') createInventarisRows();
}

function renderInventarisDaftarBarang() {
  var tbody = document.getElementById('inv_daftar_barang_tbody');
  if (!tbody) return;
  var list = getInventarisDaftarBarang();
  if (!Array.isArray(list)) list = [];
  tbody.innerHTML = list.map(function(nama, i) {
    var esc = ('' + nama).replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/>/g, '&gt;');
    return '<tr><td>' + esc + '</td><td><button type="button" onclick="removeInventarisDaftarBarang(' + i + ')" style="background:#fff; color:#333; border:1px solid #ccc; padding:6px 10px; font-size:14px; cursor:pointer; border-radius:4px; min-width:36px;">×</button></td></tr>';
  }).join('');
}

function openInventarisDaftarModal() {
  var modal = document.getElementById('invDaftarBarangModal');
  if (!modal) return;
  var inp = document.getElementById('inv_daftar_barang_nama');
  if (inp) inp.value = '';
  renderInventarisDaftarBarang();
  modal.style.display = 'flex';
}

function closeInventarisDaftarModal() {
  var modal = document.getElementById('invDaftarBarangModal');
  if (modal) modal.style.display = 'none';
}

function createInventarisRows() {
  const container = document.getElementById("detail-container-inventaris");
  if (!container) return;
  container.innerHTML = "";
  var items = getInventarisDaftarBarang();
  if (!Array.isArray(items) || items.length === 0) items = defaultInventarisItems;
  items.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "row-group";
    row.innerHTML = `
      <div style="flex:2.5;"><input type="text" class="nama_inventaris" value="${String(item).replace(/"/g, '&quot;')}" readonly style="background: #f1f5f9; color: #334155;"></div>
      <div style="flex:1;"><input type="number" class="jumlah_inventaris" placeholder="Jumlah"></div>`;
    container.appendChild(row);
  });
}

function submitDataInventaris() {
  const button = document.getElementById("submitButtonInventaris");
  const output = document.getElementById("outputInventaris");
  const tanggal = document.getElementById("tanggal_inventaris").value;

  button.disabled = true;
  button.innerText = "Menyimpan... ⏳";
  output.innerText = "";

  if (!tanggal) {
    output.innerText = "⚠️ Tanggal wajib diisi.";
    button.disabled = false;
    button.innerText = "Simpan Data Inventaris";
    return;
  }

  const rows = document.querySelectorAll("#input-inventaris-view .row-group");
  const dataList = [];

  rows.forEach(row => {
    const nama = row.querySelector(".nama_inventaris").value.trim();
    const jumlah = row.querySelector(".jumlah_inventaris").value.trim();
    if (nama && jumlah) {
      dataList.push({ tanggal, nama, jumlah });
    }
  });

  if (dataList.length === 0) {
    output.innerText = "⚠️ Masukkan minimal 1 data inventaris.";
    button.disabled = false;
    button.innerText = "Simpan Data";
    return;
  }

  if (useFirebaseBackend()) {
    FirebaseStorage.saveInventaris(dataList, getRbmOutlet()).then(showResultInventaris).catch(function(err) { showResultInventaris('❌ ' + (err && err.message ? err.message : 'Gagal menyimpan ke Firebase.')); });
    return;
  }
  if (!isGoogleScript()) {
    savePendingToLocalStorage('INVENTARIS', dataList);
    showResultInventaris('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
    return;
  }
  google.script.run.withSuccessHandler(showResultInventaris).simpanDataInventaris(dataList);
}

function showResultInventaris(res) {
  const output = document.getElementById("outputInventaris");
  const button = document.getElementById("submitButtonInventaris");
  output.innerText = res;
  button.disabled = false;
  button.innerText = "Simpan Data Inventaris";
  createInventarisRows();
  if (document.getElementById("inv_table") && typeof loadInventarisData === "function") loadInventarisData();
  setTimeout(() => { output.innerText = "" }, 3000);
}

  function setupDatalists() {
    if (!document.getElementById("pembukuan-list")) {
      const datalist = document.createElement("datalist");
      datalist.id = "pembukuan-list";
      const options = ["CASH", "BCA INTRANSIT", "MANDIRI INTRANSIT", "VOUCHER RBM", "DP", "PELUNASAN RESERVASI TF RBM", "KAS BESAR", "FOC BIL COMPLIMENT", "LAIN-LAIN"];
      datalist.innerHTML = options.map(item => `<option value="${item}">`).join("");
      document.body.appendChild(datalist);
    }
  }
  
  function toggleComment(element, forceShow = false) {
    const column = element.closest('.pembukuan-col-fisik, .pembukuan-col-selisih');
    if (!column) return;

    const wrapper = column.querySelector('.input-wrapper');
    const numberInput = wrapper.querySelector('input[type="number"]');
    const commentIcon = column.querySelector('.comment-icon');
    const commentInput = wrapper.querySelector('textarea');

    if (numberInput.style.display !== 'none' || forceShow) {
        numberInput.style.display = 'none';
        if(commentIcon) commentIcon.style.display = 'none';
        commentInput.style.display = 'block';
        commentInput.focus();
    } else {
        numberInput.style.display = 'block';
        if(commentIcon) commentIcon.style.display = 'flex';
        commentInput.style.display = 'none';
    }
  }

  function hitungSelisih(inputElement) {
      const row = inputElement.closest('.row-group-pembukuan');
      const catatan = parseFloat(row.querySelector('.pembukuan_catatan').value) || 0;
      const fisik = parseFloat(row.querySelector('.pembukuan_fisik').value) || 0;
      const selisihInput = row.querySelector('.pembukuan_selisih');
      selisihInput.value = fisik - catatan;
  }

  function handleKeteranganChange(inputElement) {
      const row = inputElement.closest('.row-group-pembukuan');
      const catatanCol = row.querySelector('.pembukuan-col-catatan');
      const fisikCol = row.querySelector('.pembukuan-col-fisik');
      const selisihCol = row.querySelector('.pembukuan-col-selisih');
      const vcrCol = row.querySelector('.pembukuan-col-vcr');
      
      const fisikIcon = fisikCol.querySelector('.comment-icon');
      const selisihIcon = selisihCol.querySelector('.comment-icon');

      const value = inputElement.value.trim().toUpperCase();
      
      toggleComment(fisikIcon, false);
      toggleComment(selisihIcon, false);
      fisikCol.querySelector('.pembukuan_komentar_fisik').required = false;
      
      // Default display
      catatanCol.style.display = 'block';
      fisikCol.style.display = 'block';
      selisihCol.style.display = 'block';
      vcrCol.style.display = 'none';
      if(fisikIcon) fisikIcon.style.display = 'flex';
      if(selisihIcon) selisihIcon.style.display = 'flex';

      if (value === 'VCR') {
          catatanCol.style.display = 'none';
          fisikCol.style.display = 'none';
          selisihCol.style.display = 'none';
          vcrCol.style.display = 'block';
      } else if (value === 'KAS BESAR') {
          // Logika Baru: Kas Besar otomatis note "GOFOOD & SHOPPEFOOD" di server
          // Hide comment icons as they are ignored/overwritten by script
          if(fisikIcon) fisikIcon.style.display = 'none';
          if(selisihIcon) selisihIcon.style.display = 'none';
      } else if (value === 'DP') {
          // Logika Baru: DP Reservasi wajib ada note
          toggleComment(fisikIcon, true);
          const commentInput = fisikCol.querySelector('.pembukuan_komentar_fisik');
          commentInput.required = true;
          commentInput.placeholder = 'Wajib: Tgl & Nama Reservasi';
      }
  }

function createKasMasukRow() {
    const baris = document.createElement('div');
    baris.className = "row-group-pembukuan";
    baris.innerHTML = `
        <div class="pembukuan-col-detail" style="flex-basis: 180px; flex-grow: 2.5;">
            <input type="text" class="pembukuan_ket_masuk" list="pembukuan-list" placeholder="Detail">
        </div>
        <div class="pembukuan-col-catatan" style="flex-basis: 120px; flex-grow: 1.5;">
            <input type="number" class="pembukuan_catatan" placeholder="Catatan">
        </div>
        <div class="pembukuan-col-fisik" style="flex-basis: 160px; flex-grow: 2;">
            <div class="input-wrapper">
                <input type="number" class="pembukuan_fisik" placeholder="Fisik / Settl">
                <textarea class="pembukuan_komentar_fisik" placeholder="Komentar Fisik..." style="display: none;"></textarea>
            </div>
            <div class="comment-icon">+</div>
        </div>
        <div class="pembukuan-col-selisih" style="flex-basis: 160px; flex-grow: 2;">
            <div class="input-wrapper">
                <input type="number" class="pembukuan_selisih" placeholder="Selisih" readonly>
                <textarea class="pembukuan_komentar_selisih" placeholder="Komentar Selisih..." style="display: none;"></textarea>
            </div>
            <div class="comment-icon">+</div>
        </div>
        <div class="pembukuan-col-vcr" style="display: none; flex-basis: 120px; flex-grow: 1.5;">
            <input type="number" class="pembukuan_vcr" placeholder="Jml VCR">
        </div>
    `;

    baris.querySelector('.pembukuan_ket_masuk').addEventListener('input', (e) => handleKeteranganChange(e.target));
    baris.querySelector('.pembukuan_catatan').addEventListener('input', (e) => hitungSelisih(e.target));
    baris.querySelector('.pembukuan_fisik').addEventListener('input', (e) => hitungSelisih(e.target));
    baris.querySelectorAll('.comment-icon').forEach(icon => { icon.addEventListener('click', (e) => toggleComment(e.target)); });
    baris.querySelectorAll('textarea').forEach(textarea => { textarea.addEventListener('blur', (e) => toggleComment(e.target)); });

    return baris;
}

function createKasKeluarRow() {
    const baris = document.createElement('div');
    baris.className = "row-group";
    baris.innerHTML = `
        <div style="flex:2;"><input type="text" class="pembukuan_ket_keluar" placeholder="Detail Transaksi"></div>
        <div style="flex:1;"><input type="number" class="pembukuan_setor" placeholder="Jumlah Setor"></div>
        <div style="flex:1.5;"><input type="file" class="pembukuan_foto" accept="image/*"></div>
    `;
    return baris;
}

function createPembukuanRows() {
    const container = document.getElementById("detail-container-pembukuan");
    const jenis = document.getElementById("jenis_transaksi_pembukuan").value;

    container.innerHTML = "";

    if (!jenis) {
        container.innerHTML = `<div class="row-group"><div><input type="text" placeholder="Pilih Jenis Transaksi di atas" disabled></div></div>`;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    let rowCount;
    let rowGenerator;

    if (jenis === 'kas-masuk') {
        setupDatalists();
        rowCount = 8;
        rowGenerator = createKasMasukRow;
    } else if (jenis === 'kas-keluar') {
        rowCount = 5;
        rowGenerator = createKasKeluarRow;
    } else {
        return;
    }

    for (let i = 0; i < rowCount; i++) {
        fragment.appendChild(rowGenerator());
    }

    container.appendChild(fragment);
}

  function submitDataPembukuan(){
      const button=document.getElementById("submitButtonPembukuan");
      button.disabled=true; button.innerText="Menyimpan... ⏳";
      const output=document.getElementById("outputPembukuan"); output.innerText="";
      const tanggal=document.getElementById("tanggal_pembukuan").value;
      const tipeForm=document.getElementById("jenis_transaksi_pembukuan").value;
      
      if(!tanggal||!tipeForm){
          output.innerText="⚠️ Tanggal dan Jenis Transaksi wajib diisi.";
          button.disabled=false; button.innerText="Simpan Data Pembukuan";
          return;
      }
      
      const dataMasuk=[];
      const dataKeluar=[];
      const filePromises=[];
      const rows=document.querySelectorAll("#detail-container-pembukuan .row-group-pembukuan, #detail-container-pembukuan .row-group");
      
      if(tipeForm==='kas-masuk'){
          let isDataValid = true;
          rows.forEach(row=>{
              const keteranganElement = row.querySelector(".pembukuan_ket_masuk");
              if (!keteranganElement) return;
              const keterangan = keteranganElement.value.trim();
              if (!keterangan) return;

              const catatan=row.querySelector(".pembukuan_catatan").value.trim();
              const fisik=row.querySelector(".pembukuan_fisik").value.trim();
              const vcr=row.querySelector(".pembukuan_vcr").value.trim();
              const komentarFisik = row.querySelector(".pembukuan_komentar_fisik").value.trim();
              const komentarSelisih = row.querySelector(".pembukuan_komentar_selisih").value.trim();
              
              if (keterangan && (fisik || vcr || komentarFisik || komentarSelisih)) {
                  if (keterangan.trim().toUpperCase() === 'DP' && !komentarFisik) {
                      output.innerText = `⚠️ Untuk transaksi 'DP', komentar Fisik wajib diisi.`;
                      isDataValid = false;
                  }
                  dataMasuk.push({ keterangan, catatan, fisik, vcr, komentarFisik, komentarSelisih });
              }
          });
          if (!isDataValid) { 
              button.disabled=false; button.innerText="Simpan Data Pembukuan";
              return; 
          }
          if (dataMasuk.length > 0) {
            const dataToSend = { tanggal, kasMasuk: dataMasuk, kasKeluar: [], isAppend: true };
            if (useFirebaseBackend()) {
              FirebaseStorage.savePembukuan(dataToSend, getRbmOutlet()).then(showResultPembukuan).catch(function(err) { showResultPembukuan('❌ ' + (err && err.message ? err.message : 'Gagal menyimpan ke Firebase.')); });
            } else if (!isGoogleScript()) {
              savePendingToLocalStorage('PEMBUKUAN', dataToSend);
              showResultPembukuan('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
            } else {
              google.script.run.withSuccessHandler(showResultPembukuan).simpanDataPembukuan(dataToSend);
            }
          } else {
            output.innerText="⚠️ Masukkan minimal 1 baris detail transaksi.";
            button.disabled = false; button.innerText = "Simpan Data Pembukuan";
          }
      } else if(tipeForm==='kas-keluar'){
          rows.forEach(row=>{
              const keteranganElement = row.querySelector(".pembukuan_ket_keluar");
              if (!keteranganElement) return;
              const keterangan = keteranganElement.value.trim();
              const setor=row.querySelector(".pembukuan_setor").value.trim();
              const fileInput=row.querySelector(".pembukuan_foto");
              
              if(setor){
                  const itemKeluar={keterangan,setor,foto:null};
                  dataKeluar.push(itemKeluar);
                  if(fileInput&&fileInput.files[0]){
                      const file=fileInput.files[0];
                      filePromises.push(uploadImageWithCompression(file, 'pembukuan').then(res => {
                          itemKeluar.foto = res;
                      }));
                  }
              }
          });
          if(dataKeluar.length===0){
              output.innerText="⚠️ Masukkan minimal 1 baris detail transaksi.";
              button.disabled = false; button.innerText = "Simpan Data Pembukuan";
              return;
          }
          Promise.all(filePromises).then(()=>{
              const dataToSend={tanggal,kasMasuk:[],kasKeluar:dataKeluar, isAppend: true};
              if (useFirebaseBackend()) {
                FirebaseStorage.savePembukuan(dataToSend, getRbmOutlet()).then(showResultPembukuan).catch(function(err) { showResultPembukuan('❌ ' + (err && err.message ? err.message : 'Gagal menyimpan ke Firebase.')); });
              } else if (!isGoogleScript()) {
                savePendingToLocalStorage('PEMBUKUAN', dataToSend);
                showResultPembukuan('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
              } else {
                google.script.run.withSuccessHandler(showResultPembukuan).simpanDataPembukuan(dataToSend);
              }
          }).catch(error=>{
              output.innerText="❌ Gagal memproses file: "+error;
              button.disabled=false; button.innerText="Simpan Data Pembukuan";
          });
      }
  }
 
  function showResultPembukuan(res){
      const output=document.getElementById("outputPembukuan");
      const button=document.getElementById("submitButtonPembukuan");
      output.innerText=res;
      button.disabled=false;
      button.innerText="Simpan Data Pembukuan";
      document.getElementById("jenis_transaksi_pembukuan").value="";
      createPembukuanRows();
      if (document.getElementById("pembukuan_tbody") && typeof loadPembukuanData === "function") loadPembukuanData();
      setTimeout(()=>{output.innerText=""},4e3);
  }

function getPettyCashRecapForPengajuan(cb) {
    var outlet = typeof getRbmOutlet === 'function' ? getRbmOutlet() : '';
    
    function processTransactions(list) {
        list.sort(function(a, b) {
            var d1 = a.tanggal || a.date || '';
            var d2 = b.tanggal || b.date || '';
            return d1.localeCompare(d2);
        });
        var lastKredit = 0;
        var lastKreditDate = '-';
        var totalDebitSince = 0;
        var detailsSince = [];
        var runningSaldo = 0;
        var saldoAtLastKredit = 0;
        var unreimbursed = [];
        for (var i = 0; i < list.length; i++) {
            var r = list[i];
            var k = parseFloat(r.kredit || r.masuk) || 0;
            var d = parseFloat(r.debit || r.keluar) || parseFloat(r.total) || 0;
            if (r.jenis === 'pemasukan') k = parseFloat(r.total || r.harga) || 0;
            if (r.jenis === 'pengeluaran') d = parseFloat(r.total) || 0;
            runningSaldo = runningSaldo - d + k;
            if (k > 0) {
                lastKredit = k;
                lastKreditDate = r.tanggal || r.date || '-';
                saldoAtLastKredit = runningSaldo;
                
                // Kosongkan riwayat pengeluaran lama.
                // Hitung pengeluaran hanya SETELAH dana masuk terakhir ini.
                unreimbursed = [];
            } else if (d > 0) {
                // Tambahkan pengeluaran ke dalam antrean
                var clonedR = Object.assign({}, r);
                clonedR._remainingDebit = d;
                unreimbursed.push(clonedR);
            }
        }
        
        // Rekap semua pengeluaran dalam antrean yang tersisa (belum ter-reimburse)
        for (var j = 0; j < unreimbursed.length; j++) {
            totalDebitSince += unreimbursed[j]._remainingDebit;
            var item = Object.assign({}, unreimbursed[j]);
            item.debit = item._remainingDebit;
            item.keluar = item._remainingDebit;
            item.total = item._remainingDebit;
            detailsSince.push(item);
        }
        var sisa = runningSaldo;
        var unreimbursedDates = detailsSince.map(function(d) { return d.tanggal || d.date; }).filter(Boolean).sort();
        var rangeStr = '';
        if (unreimbursedDates.length > 0) {
            rangeStr = unreimbursedDates[0] === unreimbursedDates[unreimbursedDates.length - 1] 
                ? ' (Tgl ' + unreimbursedDates[0] + ')' 
                : ' (Tgl ' + unreimbursedDates[0] + ' s/d ' + unreimbursedDates[unreimbursedDates.length - 1] + ')';
        }
        cb({ lastKredit: lastKredit, lastKreditDate: lastKreditDate, totalDebitSince: totalDebitSince, sisa: sisa, detailsSince: detailsSince, saldoAtLastKredit: saldoAtLastKredit, unreimbursedDateRange: rangeStr });
    }
    
    // Menggunakan kueri langsung yang sangat cepat
    if (typeof FirebaseStorage !== 'undefined' && typeof FirebaseStorage.isReady === 'function' && FirebaseStorage.isReady()) {
        var db = typeof FirebaseStorage.db === 'function' ? FirebaseStorage.db() : null;
        if (db) {
            db.ref('rbm_pro/petty_cash/' + (outlet || 'default')).orderByKey().limitToLast(365).once('value').then(function(snap) {
                var root = snap.val();
                var list = [];
                if (root && typeof root === 'object') {
                    Object.keys(root).forEach(function(dateKey) {
                        var node = root[dateKey];
                        var arr = node && Array.isArray(node.transactions) ? node.transactions : (node && node.transactions && typeof node.transactions === 'object' ? Object.values(node.transactions) : []);
                        arr.forEach(function(row) { row.tanggal = row.tanggal || dateKey; list.push(row); });
                    });
                }
                processTransactions(list);
            }).catch(function() { processTransactions([]); });
            return;
        }
    }
    
    var pending = [];
    try { var key = outlet ? 'RBM_PENDING_PETTY_CASH_' + outlet : 'RBM_PENDING_PETTY_CASH'; pending = getCachedParsedStorage(key, []); if(!pending.length) { key = 'RBM_PENDING_PETTY_CASH'; pending = getCachedParsedStorage(key, []); } } catch(e){}
    var list = [];
    pending.forEach(function(p) { var payload = p.payload || p; (payload.transactions || []).forEach(function(trx) { list.push({ tanggal: payload.tanggal, nama: trx.nama, jenis: payload.jenis, debit: payload.jenis === 'pengeluaran' ? (parseFloat(trx.total) || 0) : 0, kredit: payload.jenis === 'pemasukan' ? (parseFloat(trx.total) || parseFloat(trx.harga) || 0) : 0 }); }); });
    processTransactions(list);
}

function createPengajuanForm() {
  const container = document.getElementById("pengajuan-form-container");
  const jenisPengajuan = document.getElementById("jenis_pengajuan").value;
  container.innerHTML = "";

  if (!jenisPengajuan) {
    container.innerHTML = `<div class="row-group"><div><input type="text" placeholder="Pilih Jenis Pengajuan di atas" disabled></div></div>`;
    return;
  }

  container.innerHTML += `
    <div class="pengajuan-field">
        <label>Tanggal Pengajuan</label>
        <input type="date" id="tanggal_pengajuan" value="${new Date().toISOString().split("T")[0]}">
    </div>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
  `;

  if (jenisPengajuan === 'pengajuan-tf') {
    container.innerHTML += `<h3>Detail Pengajuan Transfer</h3>`;
    for (let i = 0; i < 5; i++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'row-group';
      rowDiv.style.alignItems = 'flex-start';
      rowDiv.innerHTML = `
        <div style="flex:1 1 200px;;"><label>Nama Suplier</label><input type="text" class="pengajuan_tf_suplier" placeholder="Nama Suplier" onblur="isiOtomatisDataBank(this)"></div>
        <div style="flex:1;"><label>Tgl. Nota</label><input type="date" class="pengajuan_tf_tgl_nota" value="${new Date().toISOString().split("T")[0]}"></div>
        <div style="flex:1;"><label>Tgl. J/T</label><input type="date" class="pengajuan_tf_tgl_jt"></div>
        <div style="flex:1 1 200px;;"><label>Nominal</label><input type="number" class="pengajuan_tf_nominal" placeholder="Nominal (Rp)" oninput="samakanTotal(this)"></div>
        <div style="flex:1 1 200px;;"><label>Total</label><input type="number" class="pengajuan_tf_total" placeholder="Total (Rp)"></div>
        <div style="flex:1 1 200px;;"><label>Bank Acc</label><input type="text" class="pengajuan_tf_bank_acc" placeholder="Bank & No. Rekening"></div>
        <div style="flex:1 1 200px;;"><label>A/N</label><input type="text" class="pengajuan_tf_atas_nama" placeholder="Atas Nama"></div>
        <div style="flex:1 1 200px;;"><label>Keterangan</label><select class="pengajuan_tf_keterangan keterangan-select" onchange="applyKeteranganColor(this)"><option value="">-- Keterangan --</option><option value="Barang Sudah datang">Barang Sudah datang</option><option value="Barang Belum Datang">Barang Belum Datang</option><option value="DP">DP</option><option value="Pelunasan DP">Pelunasan DP</option><option value="Pelunasan di Awal">Pelunasan di Awal</option></select></div>
        <div style="flex:1 1 200px;;"><label>Foto TTD</label><input type="file" class="pengajuan_tf_foto_ttd" accept="image/*"></div>
      `;
      container.appendChild(rowDiv);
    }
  } else if (jenisPengajuan === 'pengajuan-petty-cash') {
    container.innerHTML += `<h3>Detail Pengajuan Reimburse Petty Cash</h3>`;
    container.innerHTML += `<div id="pc_recap_loading" style="padding:20px; text-align:center; color:#64748b;">Menghitung rekap dari dana terakhir... ⏳</div>`;

    getPettyCashRecapForPengajuan(function(recap) {
        var detailsHtml = '';
        if (recap.detailsSince.length > 0) {
            detailsHtml += `<table class="data-table" style="width:100%; font-size:11px; margin-top:10px; border:1px solid #e2e8f0;">
                <thead><tr style="background:#f1f5f9;"><th style="padding:6px; text-align:left;">Tanggal</th><th style="padding:6px; text-align:left;">Keterangan Pengeluaran</th><th style="padding:6px; text-align:right;">Nominal</th></tr></thead><tbody>`;
            recap.detailsSince.forEach(function(d) {
                var nm = d.nama || d.keterangan || '-';
                var val = parseFloat(d.debit || d.keluar || d.total) || 0;
                var tg = d.tanggal || d.date || '-';
                detailsHtml += `<tr><td style="padding:4px 6px; border-bottom:1px solid #eee;">${tg}</td><td style="padding:4px 6px; border-bottom:1px solid #eee;">${nm}</td><td style="padding:4px 6px; text-align:right; border-bottom:1px solid #eee;">${formatRupiah(val)}</td></tr>`;
            });
            detailsHtml += `</tbody></table>`;
        } else {
            detailsHtml = `<p style="font-size:12px; color:#64748b; margin-top:10px; font-style:italic;">Belum ada pengeluaran yang perlu direimburse (sudah terganti semua).</p>`;
        }

        var saldoSebelumnya = (parseFloat(recap.saldoAtLastKredit) || parseFloat(recap.lastKredit) || 0) - (parseFloat(recap.lastKredit) || 0);
        var html = `
            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:15px;">
                <p style="margin:0 0 5px; font-size:13px; color:#475569;">Sisa Saldo Sebelumnya: <strong>${formatRupiah(saldoSebelumnya)}</strong></p>
                <p style="margin:0 0 5px; font-size:13px; color:#475569;">Dana Masuk Terakhir (${recap.lastKreditDate}): <strong>${formatRupiah(recap.lastKredit)}</strong></p>
                <p style="margin:0 0 5px; font-size:13px; color:#475569;">Total Saldo (Setelah Dana Masuk): <strong>${formatRupiah(recap.saldoAtLastKredit || recap.lastKredit)}</strong></p>
                <p style="margin:0 0 5px; font-size:13px; color:#dc2626;">Total Pengeluaran Belum Diganti${recap.unreimbursedDateRange || ''}: <strong>${formatRupiah(recap.totalDebitSince)}</strong></p>
                <p style="margin:0 0 5px; font-size:14px; color:#16a34a; font-weight:bold;">Sisa Uang (Saldo Saat Ini): ${formatRupiah(recap.sisa)}</p>
                ${detailsHtml}
            </div>
            <div class="row-group" style="align-items:flex-start; background:white; padding:15px; border:1px solid #e2e8f0; border-radius:8px;">
                <div style="flex:1;">
                    <label style="font-size:12px;">Nominal Pengajuan Reimburse (Rp)</label>
                    <input type="number" class="pengajuan_pc_nominal" value="${recap.totalDebitSince}" placeholder="Nominal (Rp)" style="font-size:16px; font-weight:bold; color:#1e40af;">
                    <p style="font-size:10px; color:#64748b; margin-top:4px;">*Otomatis disamakan dengan total pengeluaran agar saldo kembali utuh.</p>
                </div>
                <div style="flex:1.5;">
                    <label style="font-size:12px;">Foto Bukti / Dokumen Pengajuan (Opsional)</label>
                    <input type="file" class="pengajuan_pc_foto_pengajuan" accept="image/*" style="font-size:12px;">
                </div>
            </div>
            <input type="hidden" id="pengajuan_pc_recap_data" value='${JSON.stringify(recap).replace(/'/g, "&#39;")}'>
        `;

        const outletId = typeof getRbmOutlet === 'function' ? getRbmOutlet() : 'default';
        let savedRek = {bank: '', rekening: '', atasnama: ''};
        try { savedRek = JSON.parse(localStorage.getItem('RBM_PC_REK_INFO_' + outletId)) || savedRek; } catch(e){}

        var bankHtml = `
            <div class="row-group" style="align-items:flex-start; background:white; padding:15px; border:1px solid #e2e8f0; border-radius:8px; margin-top:15px;">
                <div style="flex:1;">
                    <label style="font-size:12px; font-weight:bold;">Bank Tujuan Transfer</label>
                    <input type="text" id="pengajuan_pc_bank" class="form-input" placeholder="Belum disetting" value="${savedRek.bank || ''}" readonly style="background:#f1f5f9;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:12px; font-weight:bold;">No. Rekening</label>
                    <input type="text" id="pengajuan_pc_rekening" class="form-input" placeholder="Belum disetting" value="${savedRek.rekening || ''}" readonly style="background:#f1f5f9;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:12px; font-weight:bold;">Atas Nama</label>
                    <input type="text" id="pengajuan_pc_atasnama" class="form-input" placeholder="Belum disetting" value="${savedRek.atasnama || ''}" readonly style="background:#f1f5f9;">
                </div>
            </div>
            <p style="font-size:11px; color:#64748b; margin-top:5px;">*Rekening pencairan diatur secara terpusat oleh Owner di Pengaturan Web (Manajemen Outlet).</p>
        `;
        html += bankHtml;

        var loadingEl = document.getElementById('pc_recap_loading');
        if (loadingEl) {
            loadingEl.outerHTML = html;
        }
        
        if (typeof firebase !== 'undefined' && firebase.database) {
            firebase.database().ref('customer_app_settings/outlets').once('value').then(function(snap) {
                var o = snap.val();
                var list = o ? (Array.isArray(o) ? o : Object.values(o)) : [];
                var data = list.find(function(i) { return i && i.id === outletId; });
                if (data) {
                    if (document.getElementById('pengajuan_pc_bank')) document.getElementById('pengajuan_pc_bank').value = data.bank || '';
                    if (document.getElementById('pengajuan_pc_rekening')) document.getElementById('pengajuan_pc_rekening').value = data.rekening || '';
                    if (document.getElementById('pengajuan_pc_atasnama')) document.getElementById('pengajuan_pc_atasnama').value = data.atasnama || '';
                    localStorage.setItem('RBM_PC_REK_INFO_' + outletId, JSON.stringify({ bank: data.bank || '', rekening: data.rekening || '', atasnama: data.atasnama || '' }));
                }
            }).catch(function(){});
        }
    });
  } else if (jenisPengajuan === 'sudah-tf') {
    container.innerHTML += `<h3>Laporan Bukti Transfer</h3>`;
    for (let i = 0; i < 5; i++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'row-group';
        rowDiv.style.alignItems = 'flex-start';
        rowDiv.innerHTML = `
            <div style="flex:1.5;"><label>Foto Bukti TF</label><input type="file" class="sudah_tf_foto_bukti" accept="image/*"></div>
        `;
        container.appendChild(rowDiv);
    }
  }
}

function isiOtomatisDataBank(inputElement) {
  const nama = inputElement.value.trim();
  const parent = inputElement.closest('.row-group');
  const bankField = parent.querySelector('.pengajuan_tf_bank_acc');
  const anField = parent.querySelector('.pengajuan_tf_atas_nama');

  if (!nama) {
    bankField.value = "";
    anField.value = "";
    return;
  }

  if (!isGoogleScript()) {
    bankField.value = "";
    anField.value = "";
    return;
  }

  google.script.run.withSuccessHandler(data => {
    if (data) {
      bankField.value = data.noRekening || "";
      anField.value = data.namaPemilik || "";
    } else {
      bankField.value = "";
      anField.value = "";
    }
  }).getDataBankBySuplier(nama);
}

function samakanTotal(input) {
  const container = input.closest('div').parentElement; 
  const totalInput = container.querySelector('.pengajuan_tf_total');
  if (totalInput) {
    totalInput.value = input.value;
  }
}

function submitDataPengajuan() {
  const button = document.getElementById("submitButtonPengajuan");
  if (button) {
      button.disabled = true;
      button.innerText = "Menyimpan... ⏳";
  }
  const output = document.getElementById("outputPengajuan");
  if (output) output.innerText = "";

  const showError = function(msg) {
      if (typeof AppPopup !== 'undefined') {
          AppPopup.alert(msg.replace(/⚠️|❌/g, '').trim(), 'Peringatan');
      } else if (output) {
          output.innerText = msg;
      }
      resetButton();
  };

  const jenisPengajuan = document.getElementById("jenis_pengajuan").value;
  const tanggalPengajuanGlobal = document.getElementById("tanggal_pengajuan").value;

  if (!jenisPengajuan || !tanggalPengajuanGlobal) {
    showError("⚠️ Pilih Jenis Pengajuan dan Tanggal Pengajuan terlebih dahulu.");
    return;
  }

  const rows = document.querySelectorAll("#pengajuan-form-container .row-group");
  const dataList = [];
  const filePromises = [];

  if (jenisPengajuan === 'pengajuan-tf') {
    rows.forEach(row => {
      const suplier = row.querySelector(".pengajuan_tf_suplier").value.trim();
      const nominal = row.querySelector(".pengajuan_tf_nominal").value.trim();
      const total = row.querySelector(".pengajuan_tf_total").value.trim();

      if (suplier && (nominal || total)) {
        const pengajuanItem = {
          tanggal: tanggalPengajuanGlobal,
          suplier,
          tglNota: row.querySelector(".pengajuan_tf_tgl_nota").value.trim(),
          tglJt: row.querySelector(".pengajuan_tf_tgl_jt").value.trim(),
          nominal,
          total,
          bankAcc: row.querySelector(".pengajuan_tf_bank_acc").value.trim(),
          atasNama: row.querySelector(".pengajuan_tf_atas_nama").value.trim(),
          keterangan: row.querySelector(".pengajuan_tf_keterangan").value.trim(),
          fotoNota: null,
        };
        dataList.push(pengajuanItem);

        const fotoNotaInput = row.querySelector(".pengajuan_tf_foto_nota");
        if (fotoNotaInput?.files[0]) {
          filePromises.push(uploadImageWithCompression(fotoNotaInput.files[0], 'pengajuan_tf').then(result => {
            pengajuanItem.fotoNota = result;
          }));
        }
        const fotoTtdInput = row.querySelector(".pengajuan_tf_foto_ttd");
        if (fotoTtdInput?.files[0]) {
          filePromises.push(uploadImageWithCompression(fotoTtdInput.files[0], 'pengajuan_tf').then(result => {
            pengajuanItem.fotoTtd = result;
          }));
        }
      }
    });

    if (dataList.length === 0) {
      showError("⚠️ Masukkan minimal 1 data (Suplier dan Nominal/Total wajib diisi).");
      return;
    }

    Promise.all(filePromises).then(() => {
      const payload = { jenis: jenisPengajuan, details: dataList };
      if (useFirebaseBackend()) {
        FirebaseStorage.savePengajuanTF(payload).then(showResultPengajuan).catch(function(err) { showResultPengajuan('❌ ' + (err && err.message ? err.message : 'Gagal menyimpan ke Firebase.')); });
        return;
      }
      if (!isGoogleScript()) {
        savePendingToLocalStorage('PENGAJUAN_TF', payload);
        showResultPengajuan('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
      } else {
        google.script.run.withSuccessHandler(showResultPengajuan).simpanDataPengajuanTF(payload);
      }
      if (window.self !== window.top) window.parent.postMessage({ type: 'REFRESH_NOTIFS' }, '*');
    }).catch(error => {
      showError("❌ Gagal memproses file: " + error);
    });

  } else if (jenisPengajuan === 'pengajuan-petty-cash') {
    const recapDataStr = document.getElementById("pengajuan_pc_recap_data") ? document.getElementById("pengajuan_pc_recap_data").value : "null";
    let recapData = null;
    try { recapData = JSON.parse(recapDataStr); } catch(e) {}

    const bank = document.getElementById("pengajuan_pc_bank") ? document.getElementById("pengajuan_pc_bank").value.trim() : '';
    const rekening = document.getElementById("pengajuan_pc_rekening") ? document.getElementById("pengajuan_pc_rekening").value.trim() : '';
    const atasnama = document.getElementById("pengajuan_pc_atasnama") ? document.getElementById("pengajuan_pc_atasnama").value.trim() : '';
    

    rows.forEach(row => {
      const nominalEl = row.querySelector(".pengajuan_pc_nominal");
      // Hindari crash jika ada row yang tidak punya input nominal (mis. row kosong/template).
      const nominalPc = nominalEl ? nominalEl.value.trim() : '';

      if (nominalPc) {
        const pettyCashItem = {
          tanggalPengajuan: tanggalPengajuanGlobal,
          nominal: nominalPc,
          recapData: recapData,
          fotoPengajuan: null,
          bank: bank,
          rekening: rekening,
          atasnama: atasnama
        };
        dataList.push(pettyCashItem);

        const fotoPengajuanInput = row.querySelector(".pengajuan_pc_foto_pengajuan");
        if (fotoPengajuanInput?.files[0]) {
          filePromises.push(uploadImageWithCompression(fotoPengajuanInput.files[0], 'petty_cash_pengajuan').then(result => {
            pettyCashItem.fotoPengajuan = result;
          }));
        }
      }
    });

    if (dataList.length === 0) {
      showError("⚠️ Masukkan minimal 1 data (Nominal wajib diisi).");
      return;
    }

    Promise.all(filePromises).then(() => {
      const payload = { jenis: jenisPengajuan, details: dataList };
      if (useFirebaseBackend()) {
        FirebaseStorage.savePettyCashPengajuan(payload).then(showResultPengajuan).catch(function(err) { showResultPengajuan('❌ ' + (err && err.message ? err.message : 'Gagal menyimpan ke Firebase.')); });
        return;
      }
      if (!isGoogleScript()) {
        savePendingToLocalStorage('PENGAJUAN_PC', payload);
        showResultPengajuan('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
      } else {
        google.script.run.withSuccessHandler(showResultPengajuan).simpanDataPengajuanPC(payload);
      }
      if (window.self !== window.top) window.parent.postMessage({ type: 'REFRESH_NOTIFS' }, '*');
    }).catch(error => {
      showError("❌ Gagal memproses file: " + error);
    });

  } else if (jenisPengajuan === 'sudah-tf') {
    rows.forEach(row => {
      const fotoBuktiInput = row.querySelector(".sudah_tf_foto_bukti");

      if (fotoBuktiInput?.files[0]) {
        const sudahTfItem = {
          tanggalPengajuan: tanggalPengajuanGlobal,
          fotoBukti: null
        };
        dataList.push(sudahTfItem);

        filePromises.push(uploadImageWithCompression(fotoBuktiInput.files[0], 'pengajuan_bukti_tf').then(result => {
          sudahTfItem.fotoBukti = result;
        }));
      }
    });

    if (dataList.length === 0) {
      showError("⚠️ Masukkan minimal 1 file bukti transfer.");
      return;
    }
    Promise.all(filePromises).then(() => {
        const payload = { jenis: jenisPengajuan, details: dataList };
        if (useFirebaseBackend()) {
          FirebaseStorage.savePengajuanBuktiTF(payload).then(showResultPengajuan).catch(function(err) { showResultPengajuan('❌ ' + (err && err.message ? err.message : 'Gagal menyimpan ke Firebase.')); });
          return;
        }
        if (!isGoogleScript()) {
          savePendingToLocalStorage('PENGAJUAN_SUDAH_TF', payload);
          showResultPengajuan('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
        } else {
          google.script.run.withSuccessHandler(showResultPengajuan).simpanDataSudahTF(payload);
        }
    }).catch(error => {
        showError("❌ Gagal memproses file: " + error);
    });

  } else {
    showError(`⚠️ Fitur untuk "${jenisPengajuan}" belum diimplementasikan.`);
  }
}


function resetButton() {
  const button = document.getElementById("submitButtonPengajuan");
  if (button) {
      button.disabled = false;
      button.innerText = "Kirim Pengajuan";
  }
}

function applyKeteranganColor(selectElement) {
  const value = selectElement.value;
  if (value === 'Sudah Di terima') selectElement.classList.add('keterangan-color-urgent');
  else if (value === 'Pelunasan di Awal') selectElement.classList.add('keterangan-color-penting');
  else if (value === 'Pembayaran') selectElement.classList.add('keterangan-color-biasa');
  else if (value === 'Dp') selectElement.classList.add('keterangan-color-biasa');
  else if (value === 'Pelunasan Dp') selectElement.classList.add('keterangan-color-biasa');
}

function showResultPengajuan(res) {
  if (typeof AppPopup !== 'undefined') {
      const msgLower = (res || '').toLowerCase();
      if (msgLower.includes('berhasil') || msgLower.includes('✅')) {
          AppPopup.success('Pengajuan sudah dikirim, tunggu disetujui.', 'Pengajuan Berhasil');
      } else if (msgLower.includes('gagal') || msgLower.includes('error') || msgLower.includes('❌')) {
          AppPopup.error(res.replace('❌', '').trim(), 'Gagal');
      } else {
          AppPopup.alert(res, 'Informasi');
      }
  } else {
      const output = document.getElementById("outputPengajuan");
      if (output) {
          output.innerText = res;
          setTimeout(() => { output.innerText = "" }, 4000);
      }
  }
  resetButton();
  const jp = document.getElementById("jenis_pengajuan");
  if (jp) jp.value = "";
  if (typeof createPengajuanForm === 'function') createPengajuanForm();
}

function exportPettyCashToExcel() {
  const table = document.getElementById("pc_table");
  if (!table) return;

  const monthFilter = document.getElementById("pc_bulan_filter");
  const monthVal = monthFilter ? monthFilter.value : '';
  const [year, month] = monthVal.split('-');
  const tglAwal = `${year}-${month.padStart(2, '0')}-01`;
  const lastDay = new Date(year, parseInt(month, 10), 0).getDate();
  const tglAkhir = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  const debit = document.getElementById("pc_total_debit").textContent;
  const kredit = document.getElementById("pc_total_kredit").textContent;
  const saldo = document.getElementById("pc_saldo_akhir").textContent;
  const filename = `Laporan_Petty_Cash_${monthVal}.xls`;

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #000000; padding: 5px; vertical-align: top; }
        th { background-color: #1e40af; color: #ffffff; }
        .num { mso-number-format:"\#\,\#\#0"; text-align: right; }
      </style>
    </head>
    <body>
      <h2 style="text-align:center; margin:0;">Laporan Petty Cash</h2>
      <p style="text-align:center; margin:5px 0 20px; color:#666;">Periode: ${tglAwal} s/d ${tglAkhir}</p>
      
      <table style="width: 60%; margin: 0 auto 20px auto;">
        <tr>
          <th style="background:#f0f0f0; color:#333;">Total Debit</th>
          <th style="background:#f0f0f0; color:#333;">Total Kredit</th>
          <th style="background:#f0f0f0; color:#333;">Saldo Akhir</th>
        </tr>
        <tr>
          <td style="text-align:center; font-weight:bold; color:#1e40af;">${debit}</td>
          <td style="text-align:center; font-weight:bold; color:#1e40af;">${kredit}</td>
          <td style="text-align:center; font-weight:bold; color:#1e40af;">${saldo}</td>
        </tr>
      </table>
      ${table.outerHTML}
    </body>
    </html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function triggerImportPettyCashExcel() {
  var el = document.getElementById('import_petty_cash_file');
  if (el) { el.value = ''; el.click(); }
}
function processImportPettyCashExcel(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') { alert('Library Excel belum dimuat. Pastikan halaman memuat xlsx.'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet);
      if (!rows.length) { alert('File kosong atau tidak ada baris data.'); input.value = ''; return; }
      var groups = {};
      rows.forEach(function(r) {
        var tanggal = (r['Tanggal'] != null ? String(r['Tanggal']) : '').trim();
        if (!tanggal) return;
        if (tanggal.indexOf('/') >= 0) {
          var p = tanggal.split('/');
          if (p.length >= 3) tanggal = p[2] + '-' + String(p[1]).padStart(2, '0') + '-' + String(p[0]).padStart(2, '0');
        } else if (tanggal.length === 8 && tanggal.indexOf('-') < 0) {
          tanggal = tanggal.slice(0, 4) + '-' + tanggal.slice(4, 6) + '-' + tanggal.slice(6, 8);
        }
        var jenis = (r['Jenis'] != null ? String(r['Jenis']).toLowerCase() : '').trim();
        if (jenis !== 'pemasukan' && jenis !== 'pengeluaran') return;
        var nama = (r['Nama'] != null ? String(r['Nama']) : (r['Keterangan'] != null ? String(r['Keterangan']) : '')).trim();
        if (!nama) return;
        var jumlah = parseFloat(r['Jumlah']) || 1;
        var satuan = (r['Satuan'] != null ? String(r['Satuan']) : '').trim();
        var harga = parseFloat(r['Harga']) || 0;
        var total = (harga && jumlah) ? jumlah * harga : (parseFloat(r['Total']) || parseFloat(r['Kredit']) || parseFloat(r['Debit']) || jumlah);
        var key = tanggal + '|' + jenis;
        if (!groups[key]) groups[key] = { tanggal: tanggal, jenis: jenis, transactions: [] };
        groups[key].transactions.push({
          nama: nama,
          jumlah: jumlah,
          satuan: satuan,
          harga: harga || total,
          total: total,
          foto: null
        });
      });
      var payloads = Object.keys(groups).map(function(k) { return groups[k]; });
      if (payloads.length === 0) { alert('Tidak ada baris valid. Kolom: Tanggal, Jenis (pemasukan/pengeluaran), Nama, Jumlah, Satuan, Harga.'); input.value = ''; return; }
      var outlet = getRbmOutlet();
      if (useFirebaseBackend() && typeof FirebaseStorage !== 'undefined' && FirebaseStorage.savePettyCashTransactions) {
        var idx = 0;
        function next() {
          if (idx >= payloads.length) {
            alert('Import selesai: ' + payloads.length + ' grup transaksi petty cash.');
            var elBulan = document.getElementById('pc_bulan_filter');
            if (elBulan && payloads.length > 0) {
              var dates = payloads.map(function(p) { return (p.tanggal || '').toString().trim(); }).filter(Boolean);
              if (dates.length > 0) {
                dates.sort();
                elBulan.value = dates[0].slice(0, 7);
              }
            }
            input.value = '';
            if (typeof loadPettyCashData === 'function') {
              setTimeout(function() { loadPettyCashData(); }, 400);
            }
            return;
          }
          FirebaseStorage.savePettyCashTransactions(payloads[idx], outlet).then(function() { idx++; next(); }).catch(function(err) { alert('Gagal: ' + (err && err.message ? err.message : '')); input.value = ''; });
        }
        next();
      } else {
        payloads.forEach(function(p) { savePendingToLocalStorage('PETTY_CASH', p); });
        alert('Import selesai: ' + payloads.length + ' grup transaksi petty cash (disimpan di perangkat).');
        if (typeof loadPettyCashData === 'function') loadPettyCashData();
        input.value = '';
      }
    } catch (err) { alert('Error baca file: ' + (err && err.message ? err.message : '')); input.value = ''; }
  };
  reader.readAsArrayBuffer(file);
}

function downloadTemplatePettyCashExcel() {
  if (typeof XLSX === 'undefined') { alert('Library Excel belum dimuat.'); return; }
  var headers = ['Tanggal', 'Jenis', 'Nama', 'Jumlah', 'Satuan', 'Harga'];
  var contoh = [
    ['2026-03-01', 'pemasukan', 'Setoran kas', 1, 'kali', 500000],
    ['2026-03-01', 'pengeluaran', 'Beli alat tulis', 2, 'pack', 15000]
  ];
  var aoa = [headers].concat(contoh);
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Petty Cash');
  XLSX.writeFile(wb, 'Template_Import_Petty_Cash.xlsx');
}

function printPettyCashReport() {
  const table = document.getElementById("pc_table");
  if (!table) return;

  const monthFilter = document.getElementById("pc_bulan_filter");
  const monthVal = monthFilter ? monthFilter.value : '';
  const [year, month] = monthVal.split('-');
  const tglAwal = `${year}-${month.padStart(2, '0')}-01`;
  const lastDay = new Date(year, parseInt(month, 10), 0).getDate();
  const tglAkhir = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  const debit = document.getElementById("pc_total_debit").textContent;
  const kredit = document.getElementById("pc_total_kredit").textContent;
  const saldo = document.getElementById("pc_saldo_akhir").textContent;

  const printWindow = window.open('', '', 'height=600,width=900');
  if (!printWindow) return;

  // build html in one template string to avoid quoting issues
  const html = `
    <html>
      <head>
        <title>Laporan Petty Cash</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #333; }
          h2 { text-align: center; margin-bottom: 5px; }
          p.period { text-align: center; margin-top: 0; color: #666; font-size: 14px; }
          .summary-box { display: flex; justify-content: space-around; margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: #f8f9fa; }
          .summary-item { text-align: center; }
          .summary-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .summary-value { font-size: 18px; font-weight: bold; margin-top: 5px; color: #1e40af; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
          th { background-color: #1e40af; color: white; -webkit-print-color-adjust: exact; }
          .num { text-align: right; }
          img { max-height: 40px; border-radius: 4px; }
          @media print { @page { size: landscape; margin: 1cm; } body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h2>Laporan Petty Cash</h2>
        <p class="period">Periode: ${tglAwal} s/d ${tglAkhir}</p>
        <div class="summary-box">
          <div class="summary-item"><div class="summary-label">Total Debit</div><div class="summary-value">${debit}</div></div>
          <div class="summary-item"><div class="summary-label">Total Kredit</div><div class="summary-value">${kredit}</div></div>
          <div class="summary-item"><div class="summary-label">Saldo Akhir</div><div class="summary-value">${saldo}</div></div>
        </div>
        ${table.outerHTML}
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

function deletePettyCashItem(parentIdx, trxIdx) {
  if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { alert('Hanya Owner yang dapat menghapus data.'); return; }
  if(!confirm("Yakin ingin menghapus data ini?")) return;
  const key = getRbmStorageKey('RBM_PENDING_PETTY_CASH');
  let pending = getCachedParsedStorage(key, []);
  
  if (pending[parentIdx] && pending[parentIdx].payload && pending[parentIdx].payload.transactions) {
    pending[parentIdx].payload.transactions.splice(trxIdx, 1);
    // Jika transaksi dalam satu tanggal habis, hapus parent-nya
    if (pending[parentIdx].payload.transactions.length === 0) {
      pending.splice(parentIdx, 1);
    }
    RBMStorage.setItem(key, JSON.stringify(pending));
    window._rbmParsedCache[key] = { data: pending };
    loadPettyCashData(); // Refresh tabel
  }
}

function deletePettyCashItemFirebase(firebaseDate, indexInDate) {
  if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { alert('Hanya Owner yang dapat menghapus data.'); return; }
  if (!confirm('Yakin ingin menghapus data ini?')) return;
  if (typeof FirebaseStorage === 'undefined' || !FirebaseStorage.deletePettyCashByDateAndIndex) { alert('Fungsi hapus Firebase tidak tersedia.'); return; }
  FirebaseStorage.deletePettyCashByDateAndIndex(firebaseDate, parseInt(indexInDate, 10), getRbmOutlet()).then(function() {
    if (typeof loadPettyCashData === 'function') loadPettyCashData();
  }).catch(function(err) {
    alert('Gagal menghapus: ' + (err && err.message ? err.message : ''));
  });
}

function toggleEditPcFields() {
  var jenis = document.getElementById('editPcJenis');
  var pengeluaranEl = document.getElementById('editPcPengeluaranFields');
  var pemasukanEl = document.getElementById('editPcPemasukanFields');
  if (!jenis || !pengeluaranEl || !pemasukanEl) return;
  if (jenis.value === 'pengeluaran') {
    pengeluaranEl.style.display = 'block';
    pemasukanEl.style.display = 'none';
  } else {
    pengeluaranEl.style.display = 'none';
    pemasukanEl.style.display = 'block';
  }
}

function openEditPettyCashModal(data, source, parentIdx, trxIdx, firebaseIndex, firebaseDate, firebaseIndexInDate) {
  if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { alert('Hanya Owner yang dapat mengedit data.'); return; }
  var modal = document.getElementById('editPettyCashModal');
  if (!modal) return;
  document.getElementById('editPcSource').value = source || '';
  document.getElementById('editPcParentIdx').value = parentIdx != null ? parentIdx : '';
  document.getElementById('editPcTrxIdx').value = trxIdx != null ? trxIdx : '';
  document.getElementById('editPcFirebaseIndex').value = firebaseIndex != null ? firebaseIndex : '';
  var elDate = document.getElementById('editPcFirebaseDate');
  var elIdx = document.getElementById('editPcFirebaseIndexInDate');
  if (elDate) elDate.value = firebaseDate != null ? firebaseDate : '';
  if (elIdx) elIdx.value = firebaseIndexInDate != null ? firebaseIndexInDate : '';
  var tanggal = data.tanggal || '';
  if (tanggal && tanggal.indexOf('/') !== -1) {
    var parts = tanggal.split('/');
    if (parts.length === 3) tanggal = parts[2] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[0]).slice(-2);
  } else if (tanggal && tanggal.length === 10 && tanggal.charAt(4) === '-') {
    // already YYYY-MM-DD
  } else if (data.date) {
    try { var d = new Date(data.date); tanggal = d.toISOString().slice(0, 10); } catch(e) {}
  }
  document.getElementById('editPcTanggal').value = tanggal || '';
  var jenis = data.jenis || (parseFloat(data.debit) > 0 ? 'pengeluaran' : 'pemasukan');
  document.getElementById('editPcJenis').value = jenis;
  document.getElementById('editPcNama').value = data.nama || '';
  document.getElementById('editPcJumlah').value = data.jumlah != null ? data.jumlah : '';
  document.getElementById('editPcSatuan').value = data.satuan || '';
  document.getElementById('editPcHarga').value = data.harga != null ? data.harga : '';
  document.getElementById('editPcNominal').value = (data.kredit != null ? parseFloat(data.kredit) : (data.harga != null ? parseFloat(data.harga) : '')) || '';
  toggleEditPcFields();
  modal.style.display = 'flex';
}

function closeEditPettyCashModal() {
  var modal = document.getElementById('editPettyCashModal');
  if (modal) modal.style.display = 'none';
}

function saveEditPettyCashModal() {
  if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat mengedit data.', 'Akses Ditolak', 'error'); return; }
  var source = document.getElementById('editPcSource').value;
  var parentIdx = parseInt(document.getElementById('editPcParentIdx').value, 10);
  var trxIdx = parseInt(document.getElementById('editPcTrxIdx').value, 10);
  var firebaseIndex = parseInt(document.getElementById('editPcFirebaseIndex').value, 10);
  var firebaseDate = document.getElementById('editPcFirebaseDate') ? document.getElementById('editPcFirebaseDate').value : '';
  var firebaseIndexInDate = document.getElementById('editPcFirebaseIndexInDate') ? parseInt(document.getElementById('editPcFirebaseIndexInDate').value, 10) : 0;
  var tanggal = document.getElementById('editPcTanggal').value;
  var jenis = document.getElementById('editPcJenis').value;
  var nama = (document.getElementById('editPcNama').value || '').trim();
  if (!nama) { showCustomAlert('Nama / Keterangan wajib diisi.', 'Peringatan', 'warning'); return; }
  if (source === 'local') {
    var key = getRbmStorageKey('RBM_PENDING_PETTY_CASH');
    var pending = getCachedParsedStorage(key, []);
    if (!pending[parentIdx] || !pending[parentIdx].payload || !pending[parentIdx].payload.transactions || !pending[parentIdx].payload.transactions[trxIdx]) { showCustomAlert('Data tidak ditemukan.', 'Peringatan', 'warning'); return; }
    var trx = pending[parentIdx].payload.transactions[trxIdx];
    pending[parentIdx].payload.tanggal = tanggal;
    pending[parentIdx].payload.jenis = jenis;
    if (jenis === 'pengeluaran') {
      var jumlah = parseFloat(document.getElementById('editPcJumlah').value) || 0;
      var harga = parseFloat(document.getElementById('editPcHarga').value) || 0;
      trx.nama = nama;
      trx.jumlah = jumlah;
      trx.satuan = (document.getElementById('editPcSatuan').value || '').trim();
      trx.harga = harga;
      trx.total = jumlah * harga;
    } else {
      var nominal = parseFloat(document.getElementById('editPcNominal').value) || 0;
      trx.nama = nama;
      trx.jumlah = 1;
      trx.satuan = '';
      trx.harga = nominal;
      trx.total = nominal;
    }
    RBMStorage.setItem(key, JSON.stringify(pending));
    window._rbmParsedCache[key] = { data: pending };
    closeEditPettyCashModal();
    if (typeof loadPettyCashData === 'function') loadPettyCashData();
    return;
  }
  if (source === 'firebase' && typeof FirebaseStorage !== 'undefined' && FirebaseStorage.updatePettyCashTransactionByDateAndIndex) {
    var firebaseDateEl = document.getElementById('editPcFirebaseDate');
    var firebaseIndexInDateEl = document.getElementById('editPcFirebaseIndexInDate');
    var firebaseDate = firebaseDateEl ? firebaseDateEl.value : '';
    var firebaseIndexInDate = firebaseIndexInDateEl ? parseInt(firebaseIndexInDateEl.value, 10) : 0;
    var debit = 0, kredit = 0;
    var jumlah = 1, satuan = '', harga = 0;
    if (jenis === 'pengeluaran') {
      jumlah = parseFloat(document.getElementById('editPcJumlah').value) || 0;
      satuan = (document.getElementById('editPcSatuan').value || '').trim();
      harga = parseFloat(document.getElementById('editPcHarga').value) || 0;
      debit = jumlah * harga;
    } else {
      kredit = parseFloat(document.getElementById('editPcNominal').value) || 0;
      harga = kredit;
    }
    FirebaseStorage.updatePettyCashTransactionByDateAndIndex(firebaseDate, firebaseIndexInDate, {
      tanggal: tanggal,
      nama: nama,
      jumlah: jumlah,
      satuan: satuan,
      harga: harga,
      debit: debit,
      kredit: kredit
    }, getRbmOutlet()).then(function() {
      closeEditPettyCashModal();
      if (typeof loadPettyCashData === 'function') loadPettyCashData();
    }).catch(function(err) {
      showCustomAlert('Gagal menyimpan: ' + (err && err.message ? err.message : ''), 'Error', 'error');
    });
  }
}

function editPettyCashItem(parentIdx, trxIdx) {
  if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat mengedit data.', 'Akses Ditolak', 'error'); return; }
  var key = getRbmStorageKey('RBM_PENDING_PETTY_CASH');
  var pending = getCachedParsedStorage(key, []);
  if (!pending[parentIdx] || !pending[parentIdx].payload || !pending[parentIdx].payload.transactions || !pending[parentIdx].payload.transactions[trxIdx]) return;
  var p = pending[parentIdx].payload;
  var trx = p.transactions[trxIdx];
  var data = {
    tanggal: p.tanggal,
    jenis: p.jenis,
    nama: trx.nama,
    jumlah: trx.jumlah,
    satuan: trx.satuan || '',
    harga: trx.harga,
    kredit: p.jenis === 'pemasukan' ? (trx.total || trx.harga) : 0,
    debit: p.jenis === 'pengeluaran' ? trx.total : 0
  };
  openEditPettyCashModal(data, 'local', parentIdx, trxIdx, null);
}

function editPettyCashItemFirebase(firebaseDate, indexInDate) {
  if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat mengedit data.', 'Akses Ditolak', 'error'); return; }
  var dataList = window._lastPettyCashData;
  if (!Array.isArray(dataList)) { showCustomAlert('Data tidak ditemukan. Silakan refresh tabel.', 'Peringatan', 'warning'); return; }
  var idx = parseInt(indexInDate, 10);
  if (isNaN(idx)) idx = Number(indexInDate);
  var fd = (firebaseDate != null ? String(firebaseDate) : '').trim();
  var row = dataList.find(function(r) {
    var rd = (r._firebaseDate != null ? String(r._firebaseDate) : '').trim();
    if (rd !== fd && rd.replace(/\//g, '-') !== fd) return false;
    var ri = r._firebaseIndexInDate;
    return ri === idx || parseInt(ri, 10) === idx || String(ri) === String(indexInDate);
  });
  if (!row) { showCustomAlert('Data tidak ditemukan.', 'Peringatan', 'warning'); return; }
  var data = {
    tanggal: row._firebaseDate || row.tanggal,
    nama: row.nama,
    jumlah: row.jumlah,
    satuan: row.satuan || '',
    harga: row.harga,
    debit: parseFloat(row.debit) || 0,
    kredit: parseFloat(row.kredit) || 0
  };
  openEditPettyCashModal(data, 'firebase', null, null, null, firebaseDate, indexInDate);
}

function showImageModal(src, caption) {
  var imgEl = document.getElementById('modalImage');
  if (imgEl) imgEl.src = src || '';
  var capEl = document.getElementById('modalImageCaption');
  if (capEl) {
    if (caption) {
      capEl.textContent = caption;
      capEl.style.display = 'block';
    } else {
      capEl.textContent = '';
      capEl.style.display = 'none';
    }
  }
  var modal = document.getElementById('imageModal');
  if (modal) modal.style.display = 'flex';
}

function closeImageModal() {
  var modal = document.getElementById('imageModal');
  if (modal) modal.style.display = 'none';
}

window.fetchAndShowGpsPhoto = function(date, firebaseKey, logId, caption, btn) {
    if (btn.getAttribute('data-fetching') === 'true') return;
    btn.setAttribute('data-fetching', 'true');
    var originalText = btn.innerText;
    btn.innerText = '⏳';
    btn.style.pointerEvents = 'none';
    btn.disabled = true;
    var outlet = typeof getRbmOutlet === 'function' ? getRbmOutlet() : 'default';
    var ym = date.substring(0, 7);

    var processPhoto = function(photoBase64) {
        btn.innerText = originalText;
        btn.style.pointerEvents = 'auto';
        btn.disabled = false;
        btn.removeAttribute('data-fetching');
        if (photoBase64 && typeof photoBase64 === 'string' && photoBase64.length > 100 && photoBase64.indexOf('LAZY_SPLIT_') === -1 && photoBase64 !== 'LAZY_PHOTO') {
            showImageModal(photoBase64, caption);
        } else {
            alert('Foto tidak ditemukan di database server.');
        }
    };

    if (window.RBMStorage && window.RBMStorage._useFirebase && window.RBMStorage._db) {
        var fetchByKey = function(key) {
            var photoPath = 'rbm_pro/gps_logs_photos/' + outlet + '/' + ym + '/' + key;
            window.RBMStorage._db.ref(photoPath).once('value').then(function(snap) {
                var p = snap.val();
                if (p && typeof p === 'string' && p.length > 100 && p !== 'LAZY_PHOTO' && p.indexOf('LAZY_SPLIT_') === -1) {
                    processPhoto(p);
                } else {
                    window.RBMStorage._db.ref('rbm_pro/gps_logs_partitioned/' + outlet + '/' + ym + '/' + key + '/photo').once('value').then(function(snap2) {
                        processPhoto(snap2.val());
                    }).catch(function() { processPhoto(null); });
                }
            }).catch(function() { processPhoto(null); });
        };

        if (firebaseKey && firebaseKey !== 'undefined' && firebaseKey !== 'null') {
            fetchByKey(firebaseKey);
        } else if (logId && logId !== 'undefined') {
            window.RBMStorage._db.ref('rbm_pro/gps_logs_partitioned/' + outlet + '/' + ym).orderByChild('id').equalTo(Number(logId)).once('value').then(function(snap) {
                var val = snap.val();
                if (val) {
                    var keys = Object.keys(val);
                    if (keys.length > 0) fetchByKey(keys[0]);
                    else processPhoto(null);
                } else processPhoto(null);
            }).catch(function() { processPhoto(null); });
        } else { processPhoto(null); }
    } else {
        var cacheData = window._rbmParsedCache && window._rbmParsedCache[getRbmStorageKey('RBM_GPS_LOGS')] ? window._rbmParsedCache[getRbmStorageKey('RBM_GPS_LOGS')].data : [];
        var foundPhoto = null;
        for (var i = 0; i < cacheData.length; i++) {
            if (cacheData[i].id == logId) {
                foundPhoto = cacheData[i].photo;
                break;
            }
        }
        processPhoto(foundPhoto);
    }
};

function calculateSisaUangPengajuan() {
    var dateEl = document.getElementById("pengajuan_saldo_date");
    var outEl = document.getElementById("pengajuan_sisa_uang_val");
    if (!dateEl || !outEl) return;
    const dateVal = dateEl.value;
    if (!dateVal) return;

    setTimeout(() => {
        const pending = getCachedParsedStorage(getRbmStorageKey('RBM_PENDING_PETTY_CASH'), []);
        let saldo = 0;

        pending.forEach(item => {
            const p = item.payload;
            if (p.tanggal <= dateVal) {
                (p.transactions || []).forEach(trx => {
                    const amount = parseFloat(trx.total) || 0;
                    if (p.jenis === 'pemasukan') saldo += amount;
                    else if (p.jenis === 'pengeluaran') saldo -= amount;
                });
            }
        });

        outEl.textContent = formatRupiah(saldo);
    }, 50);
}

function loadLihatPengajuanData() {
    const dateStart = document.getElementById("pengajuan_filter_date_start").value;
    const dateEnd = document.getElementById("pengajuan_filter_date_end").value;
    const tbody = document.getElementById("pengajuan_tbody");
    tbody.innerHTML = '';
    
    if (!dateStart || !dateEnd) {
        tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Pilih rentang tanggal terlebih dahulu</td></tr>';
        return;
    }
    
    // [BARU] Jika mode ServerDB aktif, ambil dari server dengan paging (bukan scan 1.000.000 data di browser)
    try {
        if (typeof getRbmActiveConfig === 'function') {
            const cfg = getRbmActiveConfig();
            if (cfg && cfg.type === 'server' && cfg.apiUrl) {
                const baseUrl = cfg.apiUrl.replace(/\/db\/?$/, '');
                window._pgnCurrentPage = window._pgnCurrentPage || 1;
                const page = window._pgnCurrentPage;
                const limit = 20;
                const outlet = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || 'default';
                const url = `${baseUrl}/api/petty-cash?outlet=${encodeURIComponent(outlet)}&from=${encodeURIComponent(dateStart)}&to=${encodeURIComponent(dateEnd)}&search=&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
                tbody.innerHTML = '<tr><td colspan="9" class="table-loading">Memuat data...</td></tr>';
                fetch(url).then(r => r.json()).then(function(result) {
                    if (!result || result.error) {
                        tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Gagal memuat dari server.</td></tr>';
                        return;
                    }
                    const data = result.data || [];
                    if (data.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Tidak ada transaksi pada rentang tanggal ini</td></tr>';
                    } else {
                        tbody.innerHTML = data.map(r => `<tr><td>${r.no || ''}</td><td>${r.tanggal || ''}</td><td>${r.nama || ''}</td><td class="num">${r.jumlah || ''}</td><td>${r.satuan || ''}</td><td class="num">${r.harga ? formatRupiah(r.harga) : ''}</td><td class="num">${r.debit ? formatRupiah(r.debit) : ''}</td><td class="num">${r.kredit ? formatRupiah(r.kredit) : ''}</td><td class="num">${formatRupiah(r.saldo || 0)}</td></tr>`).join('');
                    }

                    const meta = result.meta || {};
                    const totalPages = meta.totalPages || 1;
                    let paginationEl = document.getElementById("pgn_pagination");
                    if (!paginationEl) {
                        paginationEl = document.createElement("div");
                        paginationEl.id = "pgn_pagination";
                        paginationEl.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;";
                        tbody.closest('.table-card').appendChild(paginationEl);
                    }
                    paginationEl.innerHTML = `
                        <button class="btn btn-secondary" ${(page === 1) ? 'disabled' : ''} onclick="window._pgnCurrentPage=(window._pgnCurrentPage||1)-1; loadLihatPengajuanData()">⬅️ Prev</button>
                        <span style="font-size:14px; font-weight:bold; color:#1e40af;">Hal ${page} dari ${totalPages}</span>
                        <button class="btn btn-secondary" ${(page === totalPages) ? 'disabled' : ''} onclick="window._pgnCurrentPage=(window._pgnCurrentPage||1)+1; loadLihatPengajuanData()">Next ➡️</button>
                    `;
                }).catch(function(err) {
                    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Gagal memuat: ' + (err && err.message ? err.message : '') + '</td></tr>';
                });
                return;
            }
        }
    } catch(e) {}

    setTimeout(() => {
        let rows = [];
        let runningSaldo = 0;
        let no = 0;

        // Ambil data dari Petty Cash (per lokasi)
        const pcData = getCachedParsedStorage(getRbmStorageKey('RBM_PENDING_PETTY_CASH'), []);
        pcData.forEach((item, parentIdx) => {
            const p = item.payload;
            (p.transactions || []).forEach((trx, trxIdx) => {
                const debit = (p.jenis === 'pengeluaran' && trx.total) ? parseFloat(trx.total) : 0;
                const kredit = (p.jenis === 'pemasukan' && trx.total) ? parseFloat(trx.total) : 0;
                runningSaldo = runningSaldo - debit + kredit;

                if (p.tanggal >= dateStart && p.tanggal <= dateEnd) {
                    no++;
                    
                    rows.push({
                        no,
                        tanggal: p.tanggal,
                        nama: trx.nama || '',
                        jumlah: trx.jumlah || '',
                        satuan: trx.satuan || '',
                        harga: trx.harga || 0,
                        debit,
                        kredit,
                        saldo: runningSaldo
                    });
                }
            });
        });
        
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Tidak ada transaksi petty cash pada rentang tanggal ini</td></tr>';
            return;
        }
        
        // --- [OPTIMASI 1000X] Virtual Pagination untuk Sisa Uang / Pengajuan ---
        window._pgnCurrentPage = 1;
        const rowsPerPage = 20;
        
        window.renderPengajuanPage = function() {
            const totalPages = Math.ceil(rows.length / rowsPerPage) || 1;
            if (window._pgnCurrentPage > totalPages) window._pgnCurrentPage = totalPages;
            
            const startIdx = (window._pgnCurrentPage - 1) * rowsPerPage;
            const pageData = rows.slice(startIdx, startIdx + rowsPerPage);
            
            tbody.innerHTML = pageData.map(r => `<tr><td>${r.no}</td><td>${r.tanggal}</td><td>${r.nama}</td><td class="num">${r.jumlah}</td><td>${r.satuan}</td><td class="num">${r.harga ? formatRupiah(r.harga) : ''}</td><td class="num">${r.debit ? formatRupiah(r.debit) : ''}</td><td class="num">${r.kredit ? formatRupiah(r.kredit) : ''}</td><td class="num">${formatRupiah(r.saldo)}</td></tr>`).join('');
            
            let paginationEl = document.getElementById("pgn_pagination");
            if (!paginationEl) {
                paginationEl = document.createElement("div");
                paginationEl.id = "pgn_pagination";
                paginationEl.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;";
                tbody.closest('.table-card').appendChild(paginationEl);
            }
            paginationEl.innerHTML = `
                <button class="btn btn-secondary" ${window._pgnCurrentPage === 1 ? 'disabled' : ''} onclick="window._pgnCurrentPage--; window.renderPengajuanPage()">⬅️ Prev</button>
                <span style="font-size:14px; font-weight:bold; color:#1e40af;">Hal ${window._pgnCurrentPage} dari ${totalPages}</span>
                <button class="btn btn-secondary" ${window._pgnCurrentPage === totalPages ? 'disabled' : ''} onclick="window._pgnCurrentPage++; window.renderPengajuanPage()">Next ➡️</button>
            `;
        };
        window.renderPengajuanPage();
    }, 50);

    // [BARU] Pindahkan Riwayat Pengajuan Gaji ke Halaman Pengajuan Dana
    setTimeout(() => {
        const gajiTbody = document.getElementById('gaji_pengajuan_tbody');
        const pengajuanContainer = tbody.closest('.form-container') || tbody.closest('.view-container');
        if (gajiTbody && pengajuanContainer) {
            let parentCard = gajiTbody.closest('.table-card');
            if (parentCard) {
                parentCard.style.display = 'block';
                const prev = parentCard.previousElementSibling;
                if (prev && (prev.tagName.includes('H') || prev.tagName === 'DIV')) {
                    prev.style.display = 'block';
                    pengajuanContainer.appendChild(prev);
                }
                pengajuanContainer.appendChild(parentCard);
                if (typeof loadRiwayatGajiPengajuan === 'function') loadRiwayatGajiPengajuan({ reset: true });
            }
        }
    }, 200);
}

function exportRekapToExcel() {
  const table = document.getElementById("rekap_table");
  if (!table) return;

  const tglAwal = document.getElementById("pengajuan_filter_date_start").value;
  const tglAkhir = document.getElementById("pengajuan_filter_date_end").value;
  const sisaUang = document.getElementById("pengajuan_sisa_uang_val").textContent;
  const filename = `Rekap_Petty_Cash_${tglAwal}_sd_${tglAkhir}.xls`;

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><style>table{border-collapse:collapse;width:100%;}th,td{border:1px solid #000;padding:5px;}th{background-color:#1e40af;color:#fff;}.num{mso-number-format:"\#\,\#\#0";text-align:right;}</style></head>
    <body>
      <h2 style="text-align:center;">Rekap Petty Cash</h2>
      <p style="text-align:center;">Periode: ${tglAwal} s/d ${tglAkhir}</p>
      <p style="text-align:center; font-weight:bold; font-size:16px;">Sisa Uang: ${sisaUang}</p>
      ${table.outerHTML}
    </body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function printRekapReport() {
  const table = document.getElementById("rekap_table");
  if (!table) return;

  const tglAwal = document.getElementById("pengajuan_filter_date_start").value;
  const tglAkhir = document.getElementById("pengajuan_filter_date_end").value;
  const sisaUang = document.getElementById("pengajuan_sisa_uang_val").textContent;

  const printWindow = window.open('', '', 'height=600,width=900');
  printWindow.document.write('<html><head><title>Rekap Petty Cash</title>');
  printWindow.document.write('<style>body{font-family:sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #ccc;padding:8px;}th{background:#1e40af;color:white;}.num{text-align:right;}@media print{@page{size:landscape;}}</style>');
  printWindow.document.write('</head><body>');
  printWindow.document.write(`<h2 style="text-align:center;">Rekap Petty Cash</h2>`);
  printWindow.document.write(`<p style="text-align:center;">Periode: ${tglAwal} s/d ${tglAkhir}</p>`);
  printWindow.document.write(`<div style="text-align:center; margin-bottom:20px; font-size:18px; font-weight:bold; color:#059669;">Sisa Uang: ${sisaUang}</div>`);
  printWindow.document.write(table.outerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

function sendRekapEmail() {
  if (!confirm("Kirim laporan rekap ini via Gmail?")) return;
  
  const tglAwal = document.getElementById("pengajuan_filter_date_start").value;
  const tglAkhir = document.getElementById("pengajuan_filter_date_end").value;
  const sisaUang = document.getElementById("pengajuan_sisa_uang_val").textContent;
  const table = document.getElementById("rekap_table");
  
  // Buat body email sederhana (HTML table)
  const htmlBody = `
    <h2>Rekap Petty Cash</h2>
    <p>Periode: ${tglAwal} s/d ${tglAkhir}</p>
    <h3>Sisa Uang: ${sisaUang}</h3>
    <br>
    <table border="1" style="border-collapse:collapse; width:100%;">
      ${table.innerHTML}
    </table>
  `;

  if (isGoogleScript()) {
    google.script.run
      .withSuccessHandler(() => alert("Email berhasil dikirim!"))
      .withFailureHandler((e) => alert("Gagal kirim email: " + e))
      .sendEmailReport(tglAwal, tglAkhir, sisaUang, htmlBody);
  } else {
    // Fallback untuk lokal: Buka mailto (hanya teks sederhana karena mailto tidak support HTML body kompleks)
    const subject = `Laporan Rekap Petty Cash ${tglAwal} - ${tglAkhir}`;
    const body = `Laporan Rekap Petty Cash\nPeriode: ${tglAwal} s/d ${tglAkhir}\nSisa Uang: ${sisaUang}\n\n(Silakan lampirkan file Excel/PDF manual jika diperlukan)`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
}

function loadPembukuanData() {
    const tbody = document.getElementById("pembukuan_tbody");
    const summaryEl = document.getElementById("pembukuan_summary");
    tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Memuat data...</td></tr>';
    summaryEl.style.display = 'none';
    
    const monthFilter = document.getElementById("pembukuan_bulan_filter");
    const monthVal = monthFilter ? monthFilter.value : '';
    if (!monthVal) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Pilih bulan terlebih dahulu.</td></tr>';
        summaryEl.style.display = 'none';
        return;
    }

    const [year, month] = monthVal.split('-');
    const tglAwal = `${year}-${month}-01`;
    const lastDay = new Date(year, parseInt(month, 10), 0).getDate();
    const tglAkhir = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    // [PERFORMA] Mode Server PC: ambil 7 hari per halaman dari server (hindari proses data besar di browser)
    try {
        if (typeof getRbmActiveConfig === 'function') {
            const cfg = getRbmActiveConfig();
            if (cfg && cfg.type === 'server') {
                const apiUrl = cfg.apiUrl ? cfg.apiUrl : 'http://localhost:3001/db';
                const baseUrl = apiUrl.replace(/\/db\/?$/, '');
                const outlet = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || '_default';
                const daysPerPage = 7;
                window._pbServerPage = window._pbServerPage || 1;
                const page = window._pbServerPage;
                const url = `${baseUrl}/api/pembukuan?outlet=${encodeURIComponent(outlet)}&from=${encodeURIComponent(tglAwal)}&to=${encodeURIComponent(tglAkhir)}&page=${encodeURIComponent(page)}&daysPerPage=${encodeURIComponent(daysPerPage)}`;

                fetch(url).then(r => r.json()).then(function(result) {
                    if (!result || result.error) {
                        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Gagal memuat dari server.</td></tr>';
                        summaryEl.style.display = 'none';
                        return;
                    }
                    const meta = result.meta || {};
                    const totalPages = meta.totalPages || 1;
                    const days = Array.isArray(result.data) ? result.data : [];
                    const summary = result.summary || { saldoAwal: 0, totalCashMasuk: 0, totalKasKeluar: 0, saldoAkhir: 0 };

                    // Render tabel ringan: kasMasuk + subtotal + kasKeluar (tanpa foto base64)
                    let html = '';

                    days.forEach(function(day) {
                        const tgl = day.tanggal || '';
                        const kasMasuk = Array.isArray(day.kasMasuk) ? day.kasMasuk : [];
                        const kasKeluar = Array.isArray(day.kasKeluar) ? day.kasKeluar : [];

                        let subCatatan = 0;
                        let subFisik = 0;
                        let subSelisih = 0;

                        // Kas Masuk rows
                        if (kasMasuk.length > 0) {
                            kasMasuk.forEach(function(km, i) {
                                const ket = km.keterangan || '';
                                const catatanVal = parseFloat(km.catatan) || 0;
                                let fisikVal = parseFloat(km.fisik) || 0;
                                let selisihVal = 0;
                                let fisikDisplay = km.fisik || '';
                                if (ket && ket.toString().toUpperCase() === 'VCR') {
                                    const jmlVcr = parseFloat(km.vcr) || 0;
                                    fisikVal = jmlVcr * 20000;
                                    fisikDisplay = (km.vcr || '') + ' (VCR)';
                                } else {
                                    selisihVal = fisikVal - catatanVal;
                                }
                                subCatatan += catatanVal;
                                subFisik += fisikVal;
                                subSelisih += selisihVal;

                                html += '<tr>';
                                if (i === 0) {
                                    html += `<td rowspan="${kasMasuk.length}" style="vertical-align: middle; text-align: center; background-color: #f1f5f9; font-weight: 500;">${tgl}</td>`;
                                }
                                html += `
                                    <td>${ket}</td>
                                    <td class="num">${catatanVal ? formatRupiah(catatanVal) : '-'}</td>
                                    <td class="num">${fisikDisplay ? fisikDisplay : '-'}</td>
                                    <td class="num">${(km.fisik || km.catatan) ? formatRupiah(selisihVal) : '-'}</td>
                                    <td>-</td>
                                    <td>-</td>
                                `;
                                html += '</tr>';
                            });
                        }

                        // Subtotal row (Kas Masuk)
                        if (kasMasuk.length > 0) {
                            html += `
                                <tr style="background: #e2e8f0; font-weight: bold;">
                                    <td colspan="2" style="text-align: center;">TOTAL ${tgl}</td>
                                    <td class="num">${formatRupiah(subCatatan)}</td>
                                    <td class="num">${formatRupiah(subFisik)}</td>
                                    <td class="num">${formatRupiah(subSelisih)}</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            `;
                        }

                        // Kas Keluar rows (tanpa foto)
                        if (kasKeluar.length > 0) {
                            kasKeluar.forEach(function(kk) {
                                const setor = parseFloat(kk.setor) || 0;
                                html += `
                                    <tr style="background-color: #d1fae5;">
                                        <td style="vertical-align: middle; text-align: center; background-color: #d1fae5; font-weight: 500;">${tgl}</td>
                                        <td>${kk.keterangan || ''}</td>
                                        <td class="num">-</td>
                                        <td class="num">${setor ? formatRupiah(setor) : '-'}</td>
                                        <td class="num">-</td>
                                        <td>${kk.hasFoto ? '📷' : '-'}</td>
                                        <td>-</td>
                                    </tr>
                                `;
                            });
                        }
                    });

                    if (!html) {
                        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Tidak ada data.</td></tr>';
                    } else {
                        tbody.innerHTML = html;
                    }

                    // Pagination controls (server)
                    let paginationEl = document.getElementById("pembukuan_pagination");
                    if (!paginationEl) {
                        paginationEl = document.createElement("div");
                        paginationEl.id = "pembukuan_pagination";
                        paginationEl.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;";
                        tbody.closest('.table-card').appendChild(paginationEl);
                    }
                    paginationEl.innerHTML = `
                        <button class="btn btn-secondary" ${(page === 1) ? 'disabled' : ''} onclick="window._pbServerPage=(window._pbServerPage||1)-1; loadPembukuanData()">⬅️ Prev</button>
                        <span style="font-size:14px; font-weight:bold; color:#1e40af;">Hal ${page} dari ${totalPages}</span>
                        <button class="btn btn-secondary" ${(page === totalPages) ? 'disabled' : ''} onclick="window._pbServerPage=(window._pbServerPage||1)+1; loadPembukuanData()">Next ➡️</button>
                    `;

                    // Summary mengambil data dari backend
                    document.getElementById("pembukuan_saldo_awal").textContent = formatRupiah(summary.saldoAwal);
                    document.getElementById("pembukuan_total_cash").textContent = formatRupiah(summary.totalCashMasuk);
                    document.getElementById("pembukuan_total_keluar").textContent = formatRupiah(summary.totalKasKeluar);
                    document.getElementById("pembukuan_total_fisik").textContent = formatRupiah(summary.saldoAkhir);
                    if (document.getElementById("pembukuan_total_pendapatan")) document.getElementById("pembukuan_total_pendapatan").textContent = formatRupiah(summary.totalSemuaMasuk || 0);
                    summaryEl.style.display = 'grid';
                    if (typeof window.showSyncIndicator === 'function') window.showSyncIndicator();
                }).catch(function(err) {
                    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Gagal memuat: ' + (err && err.message ? err.message : '') + '</td></tr>';
                    summaryEl.style.display = 'none';
                });
                return;
            }
        }
    } catch(e) {}

    function renderPembukuanFromPending(pending) {
        if (!Array.isArray(pending)) pending = [];

        // [BARU] Tahap 1: Pisahkan data sebelum periode dan dalam periode
        let saldoAwalCashMasuk = 0;
        let saldoAwalKasKeluar = 0;
        const dataPeriode = [];

        pending.forEach((item, origIdx) => {
            const p = item.payload;
            if (!p || !p.tanggal) return;

            if (p.tanggal < tglAwal) {
                // Akumulasi untuk Saldo Awal
                if (p.kasMasuk && p.kasMasuk.length > 0) {
                    p.kasMasuk.forEach(km => {
                        if (km.keterangan && km.keterangan.toUpperCase() === 'CASH') {
                            let fisikVal = parseFloat(km.fisik) || 0;
                            saldoAwalCashMasuk += fisikVal;
                        }
                    });
                }
                if (p.kasKeluar && p.kasKeluar.length > 0) {
                    p.kasKeluar.forEach(kk => {
                        saldoAwalKasKeluar += parseFloat(kk.setor) || 0;
                    });
                }
            } else if (p.tanggal >= tglAwal && p.tanggal <= tglAkhir) {
                // Kumpulkan data untuk periode yang dipilih
                item._origIdx = origIdx;
                dataPeriode.push(item);
            }
        });

        const saldoAwal = saldoAwalCashMasuk - saldoAwalKasKeluar;

        // [DIUBAH] Tahap 2: Proses data HANYA untuk periode yang dipilih
        let totalCashMasuk = 0;
        let totalKasKeluar = 0;
        let totalSemuaMasuk = 0;
        let rows = [];

        dataPeriode.forEach((item) => { // Loop pada dataPeriode
            const p = item.payload;
            const parentIdx = item._origIdx;
            // Kas Masuk
            if (p.kasMasuk && p.kasMasuk.length > 0) {
                p.kasMasuk.forEach((km, subIdx) => {
                    let fisikVal = parseFloat(km.fisik) || 0;
                    let catatanVal = parseFloat(km.catatan) || 0;
                    let fisikDisplay = formatRupiah(fisikVal);
                    let selisihVal = 0;
                    
                    if(km.keterangan && km.keterangan.toUpperCase() === 'VCR') {
                        const jmlVcr = parseFloat(km.vcr) || 0;
                        fisikVal = jmlVcr * 20000;
                        fisikDisplay = `${km.vcr} (VCR)`;
                    } else {
                        selisihVal = fisikVal - catatanVal;
                    }

                    if (km.keterangan && km.keterangan.toUpperCase() === 'CASH') totalCashMasuk += fisikVal;
                    totalSemuaMasuk += catatanVal;

                    const komentarFisik = km.komentarFisik || '';
                    const komentarSelisih = km.komentarSelisih || '';
                    rows.push({
                        tanggal: p.tanggal,
                        keterangan: km.keterangan,
                        catatan: km.catatan ? formatRupiah(km.catatan) : '-',
                        fisik: fisikDisplay,
                        selisih: (km.fisik || km.catatan) ? formatRupiah(selisihVal) : '-',
                        komentarFisik,
                        komentarSelisih,
                        catatanVal: catatanVal,
                        fisikVal: fisikVal,
                        selisihVal: selisihVal,
                        foto: '-',
                        parentIdx: parentIdx,
                        type: 'kasMasuk',
                        subIdx: subIdx
                    });
                });
            }
            // Kas Keluar
            if (p.kasKeluar && p.kasKeluar.length > 0) {
                p.kasKeluar.forEach((kk, subIdx) => {
                    const setor = parseFloat(kk.setor) || 0;
                    totalKasKeluar += setor;
    
                    let fotoDisplay = '-';
                    if (typeof kk.foto === 'string' && kk.foto.startsWith('http')) {
                         fotoDisplay = `<img src="${kk.foto}" style="height:40px; border-radius:4px; cursor:pointer;" onclick="showImageModal(this.src)">`;
                    } else if (kk.foto && kk.foto.data && kk.foto.mimeType) {
                         fotoDisplay = `<img src="data:${kk.foto.mimeType};base64,${kk.foto.data}" style="height:40px; border-radius:4px; cursor:pointer;" onclick="showImageModal(this.src)">`;
                    }
                    rows.push({
                        tanggal: p.tanggal,
                        keterangan: kk.keterangan,
                        catatan: '-',
                        fisik: formatRupiah(kk.setor),
                        selisih: '-',
                        komentarFisik: '',
                        komentarSelisih: '',
                        catatanVal: 0,
                        fisikVal: setor,
                        selisihVal: 0,
                        foto: fotoDisplay,
                        parentIdx: parentIdx,
                        type: 'kasKeluar',
                        subIdx: subIdx
                    });
                });
            }
        });

        // [DIUBAH] Hitung saldo akhir kumulatif
        const saldoAkhir = saldoAwal + totalCashMasuk - totalKasKeluar;

        if (rows.length === 0 && saldoAwal === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Tidak ada data untuk rentang ini.</td></tr>';
            document.getElementById("pembukuan_saldo_awal").textContent = "Rp 0";
            document.getElementById("pembukuan_total_cash").textContent = "Rp 0";
            document.getElementById("pembukuan_total_keluar").textContent = "Rp 0";
            document.getElementById("pembukuan_total_fisik").textContent = "Rp 0";
            if (document.getElementById("pembukuan_total_pendapatan")) document.getElementById("pembukuan_total_pendapatan").textContent = "Rp 0";
            summaryEl.style.display = 'grid';
            return;
        }

    // group rows by date and calculate per-date subtotals
    const grouped = {};
    rows.forEach(r => {
        if (!grouped[r.tanggal]) { 
            grouped[r.tanggal] = { masuk: [], keluar: [], subtotalCatatan: 0, subtotalFisik: 0, subtotalSelisih: 0 }; 
        }
        if (r.type === 'kasMasuk') {
            grouped[r.tanggal].masuk.push(r);
            grouped[r.tanggal].subtotalCatatan += r.catatanVal || 0;
            grouped[r.tanggal].subtotalFisik += r.fisikVal || 0;
            grouped[r.tanggal].subtotalSelisih += r.selisihVal || 0;
        } else {
            grouped[r.tanggal].keluar.push(r);
        }
    });

        // --- [OPTIMASI 1000X] Virtual Pagination untuk Pembukuan Harian ---
        const sortedDates = Object.keys(grouped).sort();
        window._pbCurrentPage = 1;
        const datesPerPage = 7; // Batasi render 7 tanggal per halaman
        
        window.renderPembukuanPage = function() {
            const totalPages = Math.ceil(sortedDates.length / datesPerPage) || 1;
            if (window._pbCurrentPage > totalPages) window._pbCurrentPage = totalPages;
            if (window._pbCurrentPage < 1) window._pbCurrentPage = 1;
            
            const startIdx = (window._pbCurrentPage - 1) * datesPerPage;
            const pageDates = sortedDates.slice(startIdx, startIdx + datesPerPage);
            
            let html = '';
            pageDates.forEach(date => {
        const group = grouped[date];
        
        // 1. Render Kas Masuk
        group.masuk.forEach((r, i) => {
            html += '<tr>';
            if (i === 0) {
                html += `<td rowspan="${group.masuk.length}" style="vertical-align: middle; text-align: center; background-color: #f1f5f9; font-weight: 500;">${date}</td>`;
            }
            // build memo icon that shows popup with comment (data-memo + delegation agar klik selalu jalan)
            let fisikCell = r.fisik;
            if (r.komentarFisik) {
                const displayDate = date.split('-').reverse().join('/');
                const info = `${displayDate} - Fisik<br>${r.komentarFisik}`;
                const safe = ('' + info).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                fisikCell += ` <span class="memo-icon" data-memo="${safe}" title="Klik untuk lihat komentar">📝</span>`;
            }
            let selisihCell = r.selisih;
            if (r.komentarSelisih) {
                const displayDate = date.split('-').reverse().join('/');
                const info = `${displayDate} - Selisih<br>${r.komentarSelisih}`;
                const safe = ('' + info).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                selisihCell += ` <span class="memo-icon" data-memo="${safe}" title="Klik untuk lihat komentar">📝</span>`;
            }
            html += `
                <td>${r.keterangan}</td>
                <td class="num">${r.catatan}</td>
                <td class="num">${fisikCell}</td>
                <td class="num">${selisihCell}</td>
                <td>${r.foto}</td>
                <td>
                    ${window.rbmOnlyOwnerCanEditDelete && window.rbmOnlyOwnerCanEditDelete() ? `<button type="button" class="btn-small-danger" style="background: #ffc107; color: #000;" onclick="editPembukuanItem(${r.parentIdx}, '${r.type}', ${r.subIdx})">Edit</button>
                    <button type="button" class="btn-small-danger" onclick="deletePembukuanItem(${r.parentIdx}, '${r.type}', ${r.subIdx})">Hapus</button>` : '-'}
                </td>
            `;
            html += '</tr>';
        });
        
        // 2. Render Subtotal (Hanya Kas Masuk)
        html += `
            <tr style="background: #e2e8f0; font-weight: bold;">
                <td colspan="2" style="text-align: center;">TOTAL ${date}</td>
                <td class="num">${formatRupiah(group.subtotalCatatan)}</td>
                <td class="num">${formatRupiah(group.subtotalFisik)}</td>
                <td class="num">${formatRupiah(group.subtotalSelisih)}</td>
                <td></td>
                <td></td>
            </tr>
        `;

        // 3. Render Kas Keluar (Di bawah Total, Warna Hijau)
        group.keluar.forEach((r) => {
            html += '<tr style="background-color: #d1fae5;">';
            html += `<td style="vertical-align: middle; text-align: center; background-color: #d1fae5; font-weight: 500;">${date}</td>`;
            html += `
                <td>${r.keterangan}</td>
                <td class="num">${r.catatan}</td>
                <td class="num">${r.fisik}</td>
                <td class="num">${r.selisih}</td>
                <td>${r.foto}</td>
                <td>
                    ${window.rbmOnlyOwnerCanEditDelete && window.rbmOnlyOwnerCanEditDelete() ? `<button type="button" class="btn-small-danger" style="background: #ffc107; color: #000;" onclick="editPembukuanItem(${r.parentIdx}, '${r.type}', ${r.subIdx})">Edit</button>
                    <button type="button" class="btn-small-danger" onclick="deletePembukuanItem(${r.parentIdx}, '${r.type}', ${r.subIdx})">Hapus</button>` : '-'}
                </td>
            `;
            html += '</tr>';
        });
            });
            
            tbody.innerHTML = html;
            
            let paginationEl = document.getElementById("pb_pagination");
            if (!paginationEl) {
                paginationEl = document.createElement("div");
                paginationEl.id = "pb_pagination";
                paginationEl.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;";
                tbody.closest('.table-card').appendChild(paginationEl);
            }
            paginationEl.innerHTML = `
                <button class="btn btn-secondary" ${window._pbCurrentPage === 1 ? 'disabled' : ''} onclick="window._pbCurrentPage--; window.renderPembukuanPage()">⬅️ Prev</button>
                <span style="font-size:14px; font-weight:bold; color:#1e40af;">Hal ${window._pbCurrentPage} dari ${totalPages}</span>
                <button class="btn btn-secondary" ${window._pbCurrentPage === totalPages ? 'disabled' : ''} onclick="window._pbCurrentPage++; window.renderPembukuanPage()">Next ➡️</button>
            `;
            
            document.getElementById("pembukuan_saldo_awal").textContent = formatRupiah(saldoAwal);
            document.getElementById("pembukuan_total_cash").textContent = formatRupiah(totalCashMasuk);
            document.getElementById("pembukuan_total_keluar").textContent = formatRupiah(totalKasKeluar);
            document.getElementById("pembukuan_total_fisik").textContent = formatRupiah(saldoAkhir);
            if (document.getElementById("pembukuan_total_pendapatan")) document.getElementById("pembukuan_total_pendapatan").textContent = formatRupiah(totalSemuaMasuk);
            summaryEl.style.display = 'grid';
        };
        
        window.renderPembukuanPage();
    }

    if (typeof FirebaseStorage !== 'undefined' && FirebaseStorage.getPembukuan && useFirebaseBackend()) {
      FirebaseStorage.getPembukuan(tglAwal, tglAkhir, getRbmOutlet()).then(function(pending) {
        window._lastPembukuanPending = pending;
        renderPembukuanFromPending(pending);
        if (typeof window.showSyncIndicator === 'function') window.showSyncIndicator();
      }).catch(function() {
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Gagal memuat data.</td></tr>';
        summaryEl.style.display = 'none';
      });
      return;
    }
    setTimeout(() => {
        var localPending = getCachedParsedStorage(getRbmStorageKey('RBM_PENDING_PEMBUKUAN'), []);
        window._lastPembukuanPending = localPending;
        renderPembukuanFromPending(localPending);
    }, 50);
}

function toggleMemo(icon) {
    // not used any more
}

function showMemoPopup(text, doc) {
    if (!text) return;
    var d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return;
    var overlay = d.getElementById('memoModalOverlay');
    var content = d.getElementById('memoModalContent');
    if (!overlay || !content) return;
    var parts = text.split('<br>');
    var html = '';
    if (parts.length > 0) {
        html += '<div class="memo-modal-header">' + parts[0] + '</div>';
        if (parts.length > 1) html += parts.slice(1).join('<br>');
    }
    content.innerHTML = html;
    overlay.style.display = 'flex';
    window._memoOverlayDoc = d;
}

function closeMemoPopup() {
    var d = window._memoOverlayDoc || (typeof document !== 'undefined' ? document : null);
    if (d) {
        var overlay = d.getElementById('memoModalOverlay');
        if (overlay) overlay.style.display = 'none';
    }
    window._memoOverlayDoc = null;
}

document.addEventListener('click', function(e) {
    var el = e.target && (e.target.closest ? e.target.closest('.memo-icon') : null);
    if (!el || !el.getAttribute('data-memo')) return;
    var text = el.getAttribute('data-memo');
    if (!text) return;
    showMemoPopup(text, el.ownerDocument || document);
}, true);

function deletePembukuanItem(parentIdx, type, subIdx, skipConfirm) {
    if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat menghapus data.', 'Akses Ditolak', 'error'); return; }
    
    const executeDelete = function() {
        var pending = window._lastPembukuanPending;
        if (useFirebaseBackend() && typeof FirebaseStorage !== 'undefined' && FirebaseStorage.deletePembukuanDay && pending && pending[parentIdx] && pending[parentIdx].payload) {
            var p = pending[parentIdx].payload;
            var kasMasuk = (p.kasMasuk || []).slice();
            var kasKeluar = (p.kasKeluar || []).slice();
            if (type === 'kasMasuk' && kasMasuk.length > subIdx) kasMasuk.splice(subIdx, 1);
            else if (type === 'kasKeluar' && kasKeluar.length > subIdx) kasKeluar.splice(subIdx, 1);
            var outlet = (window._lastPembukuanOutletKey !== undefined && window._lastPembukuanOutletKey !== '') ? window._lastPembukuanOutletKey : getRbmOutlet();
            if (kasMasuk.length === 0 && kasKeluar.length === 0) {
                FirebaseStorage.deletePembukuanDay(outlet, p.tanggal).then(function() { loadPembukuanData(); }).catch(function(err) { showCustomAlert('Gagal hapus: ' + (err && err.message ? err.message : ''), 'Error', 'error'); loadPembukuanData(); });
            } else {
                FirebaseStorage.savePembukuan({ tanggal: p.tanggal, kasMasuk: kasMasuk, kasKeluar: kasKeluar }, outlet).then(function() { loadPembukuanData(); }).catch(function(err) { showCustomAlert('Gagal update: ' + (err && err.message ? err.message : ''), 'Error', 'error'); loadPembukuanData(); });
            }
            return;
        }

        const key = getRbmStorageKey('RBM_PENDING_PEMBUKUAN');
        let localPending = getCachedParsedStorage(key, []);
        if (localPending[parentIdx] && localPending[parentIdx].payload) {
            const payload = localPending[parentIdx].payload;
            if (type === 'kasMasuk' && payload.kasMasuk) payload.kasMasuk.splice(subIdx, 1);
            else if (type === 'kasKeluar' && payload.kasKeluar) payload.kasKeluar.splice(subIdx, 1);
            if ((!payload.kasMasuk || payload.kasMasuk.length === 0) && (!payload.kasKeluar || payload.kasKeluar.length === 0)) {
                localPending.splice(parentIdx, 1);
            }
            RBMStorage.setItem(key, JSON.stringify(localPending));
            window._rbmParsedCache[key] = { data: localPending };
            loadPembukuanData();
        }
    };
    
    if (skipConfirm) { executeDelete(); } else { showCustomConfirm("Yakin ingin menghapus data ini?", "Konfirmasi Hapus", executeDelete); }
}

function editPembukuanItem(parentIdx, type, subIdx) {
    if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat mengedit data.', 'Akses Ditolak', 'error'); return; }
    showCustomConfirm("Edit data ini? Data akan dipindahkan ke form input dan dihapus dari daftar ini.", "Konfirmasi Edit", function() {
        var pending = window._lastPembukuanPending;
        if (!pending && !useFirebaseBackend()) {
          var key = getRbmStorageKey('RBM_PENDING_PEMBUKUAN');
          pending = getCachedParsedStorage(key, []);
        }
        var item = pending && pending[parentIdx];
        if (!item || !item.payload) return;

        const p = item.payload;
        let dataToEdit = null;
        
        if (type === 'kasMasuk' && p.kasMasuk && p.kasMasuk[subIdx]) {
            dataToEdit = p.kasMasuk[subIdx];
        } else if (type === 'kasKeluar' && p.kasKeluar && p.kasKeluar[subIdx]) {
            dataToEdit = p.kasKeluar[subIdx];
        }
        
        if (!dataToEdit) return;

        showView('pembukuan-keuangan-view');
        document.getElementById("tanggal_pembukuan").value = p.tanggal;
        
        const jenisSelect = document.getElementById("jenis_transaksi_pembukuan");
        jenisSelect.value = (type === 'kasMasuk') ? 'kas-masuk' : 'kas-keluar';
        createPembukuanRows();
        
        const container = document.getElementById("detail-container-pembukuan");
        const firstRow = container.querySelector(type === 'kasMasuk' ? '.row-group-pembukuan' : '.row-group');
        
        if (firstRow) {
            if (type === 'kasMasuk') {
                if(firstRow.querySelector(".pembukuan_ket_masuk")) firstRow.querySelector(".pembukuan_ket_masuk").value = dataToEdit.keterangan || '';
                if(firstRow.querySelector(".pembukuan_catatan")) firstRow.querySelector(".pembukuan_catatan").value = dataToEdit.catatan || '';
                if(firstRow.querySelector(".pembukuan_fisik")) firstRow.querySelector(".pembukuan_fisik").value = dataToEdit.fisik || '';
                if(firstRow.querySelector(".pembukuan_vcr")) firstRow.querySelector(".pembukuan_vcr").value = dataToEdit.vcr || '';
                
                firstRow.querySelector(".pembukuan_ket_masuk").dispatchEvent(new Event('input'));
                firstRow.querySelector(".pembukuan_fisik").dispatchEvent(new Event('input'));
                
                if (dataToEdit.komentarFisik) {
                    firstRow.querySelector(".pembukuan_komentar_fisik").value = dataToEdit.komentarFisik;
                }
                if (dataToEdit.komentarSelisih) {
                    firstRow.querySelector(".pembukuan_komentar_selisih").value = dataToEdit.komentarSelisih;
                }
            } else {
                if(firstRow.querySelector(".pembukuan_ket_keluar")) firstRow.querySelector(".pembukuan_ket_keluar").value = dataToEdit.keterangan || '';
                if(firstRow.querySelector(".pembukuan_setor")) firstRow.querySelector(".pembukuan_setor").value = dataToEdit.setor || '';
                if (dataToEdit.foto) {
                    showCustomAlert("Catatan: Foto sebelumnya tidak dapat dimuat kembali ke input file. Silakan upload ulang jika perlu.", "Info", "info");
                }
            }
        }

        if (useFirebaseBackend() && typeof FirebaseStorage !== 'undefined' && pending) {
            var kasMasuk = (p.kasMasuk || []).slice();
            var kasKeluar = (p.kasKeluar || []).slice();
            if (type === 'kasMasuk' && kasMasuk.length > subIdx) kasMasuk.splice(subIdx, 1);
            else if (type === 'kasKeluar' && kasKeluar.length > subIdx) kasKeluar.splice(subIdx, 1);
            var outlet = (window._lastPembukuanOutletKey !== undefined && window._lastPembukuanOutletKey !== '') ? window._lastPembukuanOutletKey : getRbmOutlet();
            if (kasMasuk.length === 0 && kasKeluar.length === 0) {
                FirebaseStorage.deletePembukuanDay(outlet, p.tanggal).then(function() { loadPembukuanData(); }).catch(function() { loadPembukuanData(); });
            } else {
                FirebaseStorage.savePembukuan({ tanggal: p.tanggal, kasMasuk: kasMasuk, kasKeluar: kasKeluar }, outlet).then(function() { loadPembukuanData(); }).catch(function() { loadPembukuanData(); });
            }
        } else {
            deletePembukuanItem(parentIdx, type, subIdx, true);
        }
    });
}

function exportPembukuanToExcel() {
  const tglAwal = document.getElementById("pembukuan_tanggal_awal").value;
  const tglAkhir = document.getElementById("pembukuan_tanggal_akhir").value;

  let outletName = 'Semua Outlet';
  const outletId = typeof getRbmOutlet === 'function' ? getRbmOutlet() : '';
  if (outletId) {
      try {
          const names = JSON.parse(localStorage.getItem('rbm_outlet_names') || '{}');
          outletName = names[outletId] || (outletId.charAt(0).toUpperCase() + outletId.slice(1));
      } catch(e) {}
  }
  const safeOutletName = outletName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Laporan_Pembukuan_${safeOutletName}_${tglAwal}_sd_${tglAkhir}.xls`;

  function buildAndDownloadExcel(pending) {
    pending = Array.isArray(pending) ? pending : [];
  let rows = [];

  let saldoAwalCashMasuk = 0;
  let saldoAwalKasKeluar = 0;
  let totalCashMasuk = 0;
  let totalKasKeluar = 0;
  let totalFisikSheet = 0;
  let totalSemuaMasuk = 0;

  pending.forEach((item) => {
      const p = item.payload;
      if (p.tanggal < tglAwal) {
          if (p.kasMasuk && p.kasMasuk.length > 0) {
              p.kasMasuk.forEach(km => {
                  if (km.keterangan && km.keterangan.toUpperCase() === 'CASH') {
                      saldoAwalCashMasuk += parseFloat(km.fisik) || 0;
                  }
              });
          }
          if (p.kasKeluar && p.kasKeluar.length > 0) {
              p.kasKeluar.forEach(kk => {
                  saldoAwalKasKeluar += parseFloat(kk.setor) || 0;
              });
          }
      } else if (p.tanggal >= tglAwal && p.tanggal <= tglAkhir) {
          if (p.kasMasuk && p.kasMasuk.length > 0) {
              p.kasMasuk.forEach((km) => {
                  let fisikVal = parseFloat(km.fisik) || 0;
                  let catatanVal = parseFloat(km.catatan) || 0;
                  let fisikDisplay = formatRupiah(fisikVal);
                  let selisihVal = 0;
                  if(km.keterangan && km.keterangan.toUpperCase() === 'VCR') {
                      const jmlVcr = parseFloat(km.vcr) || 0;
                      fisikVal = jmlVcr * 20000;
                      fisikDisplay = `${km.vcr} (VCR)`;
                  } else {
                      selisihVal = fisikVal - catatanVal;
                  }

                  if (km.keterangan && km.keterangan.toUpperCase() === 'CASH') {
                      totalCashMasuk += fisikVal;
                  }
                  totalSemuaMasuk += catatanVal;

                  rows.push({
                      tanggal: p.tanggal,
                      keterangan: km.keterangan,
                      catatan: km.catatan ? formatRupiah(km.catatan) : '-',
                      fisik: fisikDisplay,
                      selisih: (km.fisik || km.catatan) ? formatRupiah(selisihVal) : '-',
                      komentarFisik: km.komentarFisik || '',
                      komentarSelisih: km.komentarSelisih || '',
                      catatanVal: catatanVal,
                      fisikVal: fisikVal,
                      selisihVal: selisihVal,
                      foto: '-',
                      type: 'kasMasuk'
                  });
              });
          }
          if (p.kasKeluar && p.kasKeluar.length > 0) {
              p.kasKeluar.forEach((kk) => {
                  const setor = parseFloat(kk.setor) || 0;
                  
                  totalKasKeluar += setor;

                  rows.push({
                      tanggal: p.tanggal,
                      keterangan: kk.keterangan,
                      catatan: '-',
                      fisik: formatRupiah(kk.setor),
                      selisih: '-',
                      komentarFisik: '',
                      komentarSelisih: '',
                      catatanVal: 0,
                      fisikVal: setor,
                      selisihVal: 0,
                      foto: kk.foto ? '(Ada Foto)' : '-',
                      type: 'kasKeluar'
                  });
              });
          }
      }
  });

  const saldoAwal = saldoAwalCashMasuk - saldoAwalKasKeluar;
  totalFisikSheet = saldoAwal + totalCashMasuk - totalKasKeluar;

  const grouped = {};
  rows.forEach(r => {
      if (!grouped[r.tanggal]) grouped[r.tanggal] = { masuk: [], keluar: [], subtotalCatatan: 0, subtotalFisik: 0, subtotalSelisih: 0 };
      if (r.type === 'kasMasuk') {
          grouped[r.tanggal].masuk.push(r);
          grouped[r.tanggal].subtotalCatatan += r.catatanVal || 0;
          grouped[r.tanggal].subtotalFisik += r.fisikVal || 0;
          grouped[r.tanggal].subtotalSelisih += r.selisihVal || 0;
      } else {
          grouped[r.tanggal].keluar.push(r);
      }
  });

  const esc = (str) => {
      if (str === null || str === undefined) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  };

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">\n';
  
  xml += '<Styles>\n';
  xml += ' <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders/><Font ss:FontName="Calibri" ss:Size="11"/><Interior/><NumberFormat/><Protection/></Style>\n';
  xml += ' <Style ss:ID="sHeader"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1e40af" ss:Pattern="Solid"/></Style>\n';
  xml += ' <Style ss:ID="sData"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>\n';
  xml += ' <Style ss:ID="sCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>\n';
  xml += ' <Style ss:ID="sNum"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>\n';
  xml += ' <Style ss:ID="sTotal"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1"/><Interior ss:Color="#e2e8f0" ss:Pattern="Solid"/></Style>\n';
  xml += ' <Style ss:ID="sTotalLabel"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1"/><Interior ss:Color="#e2e8f0" ss:Pattern="Solid"/></Style>\n';
  xml += ' <Style ss:ID="sTitle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#1e40af"/></Style>\n';
  xml += ' <Style ss:ID="sSubtitle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#64748b"/></Style>\n';
  xml += ' <Style ss:ID="sSummaryLabel"><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1e40af" ss:Pattern="Solid"/></Style>\n';
  xml += ' <Style ss:ID="sSummaryValue"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1"/></Style>\n';
  xml += ' <Style ss:ID="sDataGreen"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Interior ss:Color="#d1fae5" ss:Pattern="Solid"/></Style>\n';
  xml += ' <Style ss:ID="sNumGreen"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Interior ss:Color="#d1fae5" ss:Pattern="Solid"/></Style>\n';
  xml += ' <Style ss:ID="sCenterGreen"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Interior ss:Color="#d1fae5" ss:Pattern="Solid"/></Style>\n';
  xml += '</Styles>\n';

  xml += '<Worksheet ss:Name="Laporan Pembukuan">\n';
  xml += ' <Table>\n';
  xml += '  <Column ss:Width="80"/>\n';
  xml += '  <Column ss:Width="200"/>\n';
  xml += '  <Column ss:Width="100"/>\n';
  xml += '  <Column ss:Width="100"/>\n';
  xml += '  <Column ss:Width="100"/>\n';
  xml += '  <Column ss:Width="60"/>\n';

  xml += '  <Row ss:Height="25">\n';
  xml += `   <Cell ss:StyleID="sTitle" ss:MergeAcross="5"><Data ss:Type="String">Laporan Pembukuan - ${esc(outletName)}</Data></Cell>\n`;
  xml += '  </Row>\n';
  xml += '  <Row ss:Height="20">\n';
  xml += `   <Cell ss:StyleID="sSubtitle" ss:MergeAcross="5"><Data ss:Type="String">Periode: ${tglAwal} s/d ${tglAkhir}</Data></Cell>\n`;
  xml += '  </Row>\n';
  xml += '  <Row ss:Index="4">\n';
  xml += '  </Row>\n';
  
  xml += '  <Row>\n';
  xml += `   <Cell ss:StyleID="sSummaryLabel" ss:MergeAcross="1"><Data ss:Type="String">Saldo Awal</Data></Cell>\n`;
  xml += `   <Cell ss:StyleID="sSummaryValue"><Data ss:Type="String">${esc(formatRupiah(saldoAwal))}</Data></Cell>\n`;
  xml += '  </Row>\n';
  xml += '  <Row>\n';
  xml += `   <Cell ss:StyleID="sSummaryLabel" ss:MergeAcross="1"><Data ss:Type="String">Total Cash Masuk (G4)</Data></Cell>\n`;
  xml += `   <Cell ss:StyleID="sSummaryValue"><Data ss:Type="String">${esc(formatRupiah(totalCashMasuk))}</Data></Cell>\n`;
  xml += '  </Row>\n';
  xml += '  <Row>\n';
  xml += `   <Cell ss:StyleID="sSummaryLabel" ss:MergeAcross="1"><Data ss:Type="String">Total Kas Keluar (H4)</Data></Cell>\n`;
  xml += `   <Cell ss:StyleID="sSummaryValue"><Data ss:Type="String">${esc(formatRupiah(totalKasKeluar))}</Data></Cell>\n`;
  xml += '  </Row>\n';
  xml += '  <Row>\n';
  xml += `   <Cell ss:StyleID="sSummaryLabel" ss:MergeAcross="1"><Data ss:Type="String">Saldo Akhir (Total Fisik)</Data></Cell>\n`;
  xml += `   <Cell ss:StyleID="sSummaryValue"><Data ss:Type="String">${esc(formatRupiah(totalFisikSheet))}</Data></Cell>\n`;
  xml += '  </Row>\n';
  xml += '  <Row>\n';
  xml += `   <Cell ss:StyleID="sSummaryLabel" ss:MergeAcross="1"><Data ss:Type="String">Total Pendapatan</Data></Cell>\n`;
  xml += `   <Cell ss:StyleID="sSummaryValue"><Data ss:Type="String">${esc(formatRupiah(totalSemuaMasuk))}</Data></Cell>\n`;
  xml += '  </Row>\n';
  
  xml += '  <Row>\n';
  xml += '  </Row>\n';
  xml += '  <Row>\n';
  xml += '   <Cell ss:StyleID="sHeader"><Data ss:Type="String">Tanggal</Data></Cell>\n';
  xml += '   <Cell ss:StyleID="sHeader"><Data ss:Type="String">Keterangan</Data></Cell>\n';
  xml += '   <Cell ss:StyleID="sHeader"><Data ss:Type="String">Catatan</Data></Cell>\n';
  xml += '   <Cell ss:StyleID="sHeader"><Data ss:Type="String">Fisik / Setor</Data></Cell>\n';
  xml += '   <Cell ss:StyleID="sHeader"><Data ss:Type="String">Selisih</Data></Cell>\n';
  xml += '   <Cell ss:StyleID="sHeader"><Data ss:Type="String">Foto</Data></Cell>\n';
  xml += '  </Row>\n';

  Object.keys(grouped).sort().forEach(date => {
      const group = grouped[date];
      
      // 1. Kas Masuk
      group.masuk.forEach((r, i) => {
          xml += '  <Row>\n';
          if (i === 0) {
              const merge = group.masuk.length > 1 ? ` ss:MergeDown="${group.masuk.length - 1}"` : '';
              xml += `   <Cell ss:StyleID="sCenter"${merge}><Data ss:Type="String">${esc(date)}</Data></Cell>\n`;
              xml += `   <Cell ss:StyleID="sData"><Data ss:Type="String">${esc(r.keterangan)}</Data></Cell>\n`;
          } else {
              xml += `   <Cell ss:StyleID="sData" ss:Index="2"><Data ss:Type="String">${esc(r.keterangan)}</Data></Cell>\n`;
          }
          xml += `   <Cell ss:StyleID="sNum"><Data ss:Type="String">${esc(r.catatan)}</Data></Cell>\n`;
          
          // Fisik with Comment
          xml += `   <Cell ss:StyleID="sNum"><Data ss:Type="String">${esc(r.fisik)}</Data>`;
          if (r.komentarFisik) {
              xml += `<Comment ss:Author="RBM"><ss:Data>${esc(r.komentarFisik)}</ss:Data></Comment>`;
          }
          xml += `</Cell>\n`;

          // Selisih with Comment
          xml += `   <Cell ss:StyleID="sNum"><Data ss:Type="String">${esc(r.selisih)}</Data>`;
          if (r.komentarSelisih) {
              xml += `<Comment ss:Author="RBM"><ss:Data>${esc(r.komentarSelisih)}</ss:Data></Comment>`;
          }
          xml += `</Cell>\n`;

          xml += `   <Cell ss:StyleID="sData"><Data ss:Type="String">${esc(r.foto)}</Data></Cell>\n`;
          xml += '  </Row>\n';
      });
      
      // Subtotal Row
      xml += '  <Row>\n';
      xml += `   <Cell ss:StyleID="sTotalLabel" ss:MergeAcross="1"><Data ss:Type="String">TOTAL ${esc(date)}</Data></Cell>\n`;
      xml += `   <Cell ss:StyleID="sTotal"><Data ss:Type="String">${esc(formatRupiah(group.subtotalCatatan))}</Data></Cell>\n`;
      xml += `   <Cell ss:StyleID="sTotal"><Data ss:Type="String">${esc(formatRupiah(group.subtotalFisik))}</Data></Cell>\n`;
      xml += `   <Cell ss:StyleID="sTotal"><Data ss:Type="String">${esc(formatRupiah(group.subtotalSelisih))}</Data></Cell>\n`;
      xml += `   <Cell ss:StyleID="sTotal"><Data ss:Type="String"></Data></Cell>\n`;
      xml += '  </Row>\n';

      // 3. Kas Keluar (Green)
      group.keluar.forEach((r) => {
          xml += '  <Row>\n';
          xml += `   <Cell ss:StyleID="sCenterGreen"><Data ss:Type="String">${esc(date)}</Data></Cell>\n`;
          xml += `   <Cell ss:StyleID="sDataGreen"><Data ss:Type="String">${esc(r.keterangan)}</Data></Cell>\n`;
          xml += `   <Cell ss:StyleID="sNumGreen"><Data ss:Type="String">${esc(r.catatan)}</Data></Cell>\n`;
          xml += `   <Cell ss:StyleID="sNumGreen"><Data ss:Type="String">${esc(r.fisik)}</Data></Cell>\n`;
          xml += `   <Cell ss:StyleID="sNumGreen"><Data ss:Type="String">${esc(r.selisih)}</Data></Cell>\n`;
          xml += `   <Cell ss:StyleID="sDataGreen"><Data ss:Type="String">${esc(r.foto)}</Data></Cell>\n`;
          xml += '  </Row>\n';
      });
  });

  xml += ' </Table>\n';
  xml += '</Worksheet>\n';
  xml += '</Workbook>';

  const blob = new Blob(['\ufeff', xml], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  }

  if (typeof FirebaseStorage !== 'undefined' && FirebaseStorage.getPembukuan && useFirebaseBackend()) {
    FirebaseStorage.getPembukuan(tglAwal, tglAkhir, getRbmOutlet()).then(function(p) {
      buildAndDownloadExcel(p || []);
    }).catch(function() {
      buildAndDownloadExcel(window._lastPembukuanPending || safeParse(RBMStorage.getItem(getRbmStorageKey('RBM_PENDING_PEMBUKUAN')), []));
    });
  } else {
    buildAndDownloadExcel(window._lastPembukuanPending || safeParse(RBMStorage.getItem(getRbmStorageKey('RBM_PENDING_PEMBUKUAN')), []));
  }
}

function triggerImportPembukuanExcel() {
  var el = document.getElementById('import_pembukuan_file');
  if (el) { el.value = ''; el.click(); }
}
function parseRupiahExcel(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number' && !isNaN(val)) return val;
  var s = String(val).replace(/Rp\s*/gi, '').replace(/\./g, '').replace(/,/g, '.').trim();
  return parseFloat(s) || 0;
}

function processImportPembukuanExcel(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') { alert('Library Excel belum dimuat. Pastikan halaman memuat xlsx.'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var sheet = workbook.Sheets[workbook.SheetNames[0]];
      var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      var headerRowIdx = 0;
      for (var i = 0; i < aoa.length; i++) {
        var first = (aoa[i] && aoa[i][0] != null) ? String(aoa[i][0]).trim() : '';
        if (first === 'Tanggal') { headerRowIdx = i; break; }
      }
      var headers = (aoa[headerRowIdx] || []).map(function(h) { return (h != null && h !== '') ? String(h).trim() : ''; });
      var rows = aoa.slice(headerRowIdx + 1).map(function(arr) {
        var o = {};
        headers.forEach(function(h, j) { if (h) o[h] = arr[j]; });
        return o;
      });
      if (!rows.length) { alert('File kosong atau tidak ada baris data.'); input.value = ''; return; }
      var byDate = {};
      var hasFormatExport = false;
      rows.forEach(function(r) {
        var kolomKeterangan = (r['Keterangan'] != null ? String(r['Keterangan']) : '').trim();
        var kolomFisikSetor = r['Fisik / Setor'] != null ? r['Fisik / Setor'] : r['Fisik'];
        if (r['Fisik / Setor'] !== undefined || (kolomKeterangan && (String(r['Catatan'] || '').indexOf('Rp') >= 0 || String(kolomFisikSetor || '').indexOf('Rp') >= 0))) hasFormatExport = true;
      });
      if (hasFormatExport) {
        var currentDate = '';
        var modeKeluar = false;
        rows.forEach(function(r) {
          var rawTanggal = (r['Tanggal'] != null ? String(r['Tanggal']) : '').trim();
          var keterangan = (r['Keterangan'] != null ? String(r['Keterangan']) : '').trim();
          if (!keterangan && !rawTanggal && parseRupiahExcel(r['Catatan']) === 0 && parseRupiahExcel(r['Fisik / Setor'] || r['Fisik']) === 0) return;
          if (keterangan === 'Laporan Pembukuan' || (keterangan && keterangan.indexOf('Periode:') === 0)) return;
          if (rawTanggal && (rawTanggal.indexOf('Laporan') >= 0 || rawTanggal.indexOf('Periode') >= 0)) return;
          if (keterangan.toUpperCase().indexOf('TOTAL ') === 0) {
            modeKeluar = true;
            return;
          }
          var tanggal = rawTanggal || currentDate;
          if (tanggal) {
            if (tanggal.indexOf('/') >= 0) {
              var p = tanggal.split('/');
              if (p.length >= 3) tanggal = p[2] + '-' + String(p[1]).padStart(2, '0') + '-' + String(p[0]).padStart(2, '0');
            } else if (tanggal.length === 8 && tanggal.indexOf('-') < 0) {
              tanggal = tanggal.slice(0, 4) + '-' + tanggal.slice(4, 6) + '-' + tanggal.slice(6, 8);
            }
            currentDate = tanggal;
          } else {
            tanggal = currentDate;
          }
          if (!tanggal) return;
          if (!byDate[tanggal]) { byDate[tanggal] = { tanggal: tanggal, kasMasuk: [], kasKeluar: [] }; modeKeluar = false; }
          var catatanVal = parseRupiahExcel(r['Catatan']);
          var fisikSetorVal = parseRupiahExcel(r['Fisik / Setor'] != null ? r['Fisik / Setor'] : r['Fisik']);
          if (modeKeluar) {
            if (!keterangan && fisikSetorVal === 0) return;
            byDate[tanggal].kasKeluar.push({ keterangan: keterangan, setor: fisikSetorVal, foto: null });
          } else {
            if (!keterangan && catatanVal === 0 && fisikSetorVal === 0) return;
            byDate[tanggal].kasMasuk.push({
              keterangan: keterangan,
              catatan: String(catatanVal),
              fisik: String(fisikSetorVal),
              vcr: (r['VCR'] != null ? String(r['VCR']) : '').trim(),
              komentarFisik: (r['KomentarFisik'] != null ? String(r['KomentarFisik']) : '').trim(),
              komentarSelisih: (r['KomentarSelisih'] != null ? String(r['KomentarSelisih']) : '').trim()
            });
          }
        });
      } else {
        rows.forEach(function(r) {
          var tanggal = (r['Tanggal'] != null ? String(r['Tanggal']) : '').trim();
          if (!tanggal) return;
          if (tanggal.indexOf('/') >= 0) {
            var p = tanggal.split('/');
            if (p.length >= 3) tanggal = p[2] + '-' + String(p[1]).padStart(2, '0') + '-' + String(p[0]).padStart(2, '0');
          } else if (tanggal.length === 8 && tanggal.indexOf('-') < 0) {
            tanggal = tanggal.slice(0, 4) + '-' + tanggal.slice(4, 6) + '-' + tanggal.slice(6, 8);
          }
          var tipe = (r['Tipe'] != null ? String(r['Tipe']).toLowerCase() : (r['Type'] != null ? String(r['Type']).toLowerCase() : '')).trim();
          var isKeluar = (tipe.indexOf('keluar') >= 0 || tipe === 'kas keluar');
          if (isKeluar) {
            var keterangan = (r['Keterangan'] != null ? String(r['Keterangan']) : '').trim();
            var setor = parseFloat(r['Setor']) || parseRupiahExcel(r['Fisik']) || 0;
            if (!keterangan && !setor) return;
            if (!byDate[tanggal]) byDate[tanggal] = { tanggal: tanggal, kasMasuk: [], kasKeluar: [] };
            byDate[tanggal].kasKeluar.push({ keterangan: keterangan, setor: setor, foto: null });
          } else {
            var ket = (r['Keterangan'] != null ? String(r['Keterangan']) : '').trim();
            var catatan = parseRupiahExcel(r['Catatan']) || parseFloat(r['Catatan']) || 0;
            var fisik = parseRupiahExcel(r['Fisik']) || parseFloat(r['Fisik']) || 0;
            var vcr = (r['VCR'] != null ? String(r['VCR']) : '').trim();
            if (!ket && !catatan && !fisik && !vcr) return;
            if (!byDate[tanggal]) byDate[tanggal] = { tanggal: tanggal, kasMasuk: [], kasKeluar: [] };
            byDate[tanggal].kasMasuk.push({
              keterangan: ket,
              catatan: String(catatan),
              fisik: String(fisik),
              vcr: vcr,
              komentarFisik: (r['KomentarFisik'] != null ? String(r['KomentarFisik']) : '').trim(),
              komentarSelisih: (r['KomentarSelisih'] != null ? String(r['KomentarSelisih']) : '').trim()
            });
          }
        });
      }
      var payloads = Object.keys(byDate).sort().map(function(k) { return byDate[k]; });
      if (payloads.length === 0) { alert('Tidak ada baris valid. Gunakan format: Tanggal, Keterangan, Catatan, Fisik / Setor, Selisih, Foto (sama seperti hasil Export).'); input.value = ''; return; }
      var outlet = getRbmOutlet();
      if (useFirebaseBackend() && typeof FirebaseStorage !== 'undefined' && FirebaseStorage.savePembukuan) {
        var idx = 0;
        function next() {
          if (idx >= payloads.length) { alert('Import selesai: ' + payloads.length + ' tanggal pembukuan.'); if (typeof loadPembukuanData === 'function') loadPembukuanData(); input.value = ''; return; }
          FirebaseStorage.savePembukuan(payloads[idx], outlet).then(function() { idx++; next(); }).catch(function(err) { alert('Gagal: ' + (err && err.message ? err.message : '')); input.value = ''; });
        }
        next();
      } else {
        payloads.forEach(function(p) { savePendingToLocalStorage('PEMBUKUAN', p); });
        alert('Import selesai: ' + payloads.length + ' tanggal pembukuan (disimpan di perangkat).');
        if (typeof loadPembukuanData === 'function') loadPembukuanData();
        input.value = '';
      }
    } catch (err) { alert('Error baca file: ' + (err && err.message ? err.message : '')); input.value = ''; }
  };
  reader.readAsArrayBuffer(file);
}

function downloadTemplatePembukuanExcel() {
  if (typeof XLSX === 'undefined') { alert('Library Excel belum dimuat.'); return; }
  // Format sama dengan hasil Export Excel: Tanggal, Keterangan, Catatan, Fisik / Setor, Selisih, Foto
  var headers = ['Tanggal', 'Keterangan', 'Catatan', 'Fisik / Setor', 'Selisih', 'Foto'];
  var contoh = [
    ['2026-03-01', 'CASH', 'Rp 3683804', 'Rp 3.684.000', 'Rp 196', ''],
    ['', 'MANDIRI INTRANSIT', 'Rp 2095458', 'Rp 2.095.458', 'Rp 0', ''],
    ['', 'KAS BESAR', 'Rp 33601', 'Rp 33.601', 'Rp 0', ''],
    ['', 'TOTAL 2026-03-01', 'Rp 5.812.863', 'Rp 5.813.059', 'Rp 196', ''],
    ['2026-03-01', 'Setor ke bank', '', 'Rp 500000', '', '']
  ];
  var aoa = [['Laporan Pembukuan'], ['Periode: (isi tanggal dari - sampai)'], []].concat([headers]).concat(contoh);
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Pembukuan');
  XLSX.writeFile(wb, 'Template_Import_Pembukuan.xlsx');
}

function printPembukuanReport() {
    // Reuse existing print logic structure
    window.print();
}

function loadInventarisData() {
  const table = document.getElementById("inv_table");
  const thead = table.querySelector("thead");
  const tbody = document.getElementById("inv_tbody");
  
  tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Memuat data...</td></tr>';
  
  const tglAwal = document.getElementById("inv_tanggal_awal").value;
  const tglAkhir = document.getElementById("inv_tanggal_akhir").value;

  // [BARU] Jika mode ServerDB aktif, pakai server-side paging + search (tabel list cepat).
  try {
    if (typeof getRbmActiveConfig === 'function') {
      const cfg = getRbmActiveConfig();
      if (cfg && cfg.type === 'server') {
        window._invCurrentPage = window._invCurrentPage || 1;
        const page = window._invCurrentPage;
        const limit = 20;
        const apiUrl = cfg.apiUrl ? cfg.apiUrl : 'http://localhost:3001/db';
        const baseUrl = apiUrl.replace(/\/db\/?$/, '');
        const outlet = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || '_default';
        const searchVal = (document.getElementById('inv_search') && document.getElementById('inv_search').value) || '';

        // inject search UI once
        if (!document.getElementById('inv_search')) {
          const wrap = document.querySelector("#lihat-inventaris-view .filter-row") || document.querySelector("#lihat-inventaris-view");
          if (wrap) {
            const el = document.createElement('div');
            el.className = 'filter-group';
            el.style.marginLeft = '8px';
            el.innerHTML = `<label>Cari Barang</label><input type="text" id="inv_search" placeholder="Ketik nama barang..." style="padding:6px; border:1px solid #ccc; border-radius:4px;" oninput="window._invCurrentPage=1; loadInventarisData()">`;
            wrap.appendChild(el);
          }
        }

        thead.innerHTML = '<tr><th>No</th><th>Tanggal</th><th>Nama Barang</th><th class="num">Jumlah</th></tr>';
        const url = `${baseUrl}/api/inventaris?outlet=${encodeURIComponent(outlet)}&from=${encodeURIComponent(tglAwal)}&to=${encodeURIComponent(tglAkhir)}&search=${encodeURIComponent(searchVal)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;

        fetch(url).then(r => r.json()).then(function(result) {
          if (!result || result.error) {
            tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Gagal memuat dari server.</td></tr>';
            return;
          }
          const data = result.data || [];
          if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Tidak ada data.</td></tr>';
          } else {
            tbody.innerHTML = data.map(function(r, idx) {
              return `<tr><td>${(idx + 1) + ((page - 1) * limit)}</td><td>${r.tanggal || ''}</td><td>${r.nama || ''}</td><td class="num">${r.jumlah || ''}</td></tr>`;
            }).join('');
          }
          const meta = result.meta || {};
          const totalPages = meta.totalPages || 1;
          let paginationEl = document.getElementById("inv_pagination");
          if (!paginationEl) {
            paginationEl = document.createElement("div");
            paginationEl.id = "inv_pagination";
            paginationEl.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;";
            tbody.closest('.table-card').appendChild(paginationEl);
          }
          paginationEl.innerHTML = `
            <button class="btn btn-secondary" ${(page === 1) ? 'disabled' : ''} onclick="window._invCurrentPage=(window._invCurrentPage||1)-1; loadInventarisData()">⬅️ Prev</button>
            <span style="font-size:14px; font-weight:bold; color:#1e40af;">Hal ${page} dari ${totalPages}</span>
            <button class="btn btn-secondary" ${(page === totalPages) ? 'disabled' : ''} onclick="window._invCurrentPage=(window._invCurrentPage||1)+1; loadInventarisData()">Next ➡️</button>
          `;
        }).catch(function(err) {
          tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Gagal memuat: ' + (err && err.message ? err.message : '') + '</td></tr>';
        });
        return;
      }
    }
  } catch(e) {}

  // Fungsi untuk merender data menjadi Matrix (Pivot)
  const renderPivot = (data) => {
      if (!data || data.length === 0) {
          thead.innerHTML = '<tr><th>No</th><th>Nama Barang</th><th>Status</th></tr>';
          tbody.innerHTML = '<tr><td colspan="3" class="table-empty">Tidak ada data ditemukan.</td></tr>';
          return;
      }

      // [SUPER OPTIMASI] Jika data terlalu besar, jangan buat pivot (matrix bisa jutaan sel -> hang).
      // Fallback: tampilkan list paginated sederhana.
      if (data.length > 5000) {
          thead.innerHTML = '<tr><th>No</th><th>Tanggal</th><th>Nama Barang</th><th class="num">Jumlah</th></tr>';
          window._invLocalPage = window._invLocalPage || 1;
          const rowsPerPage = 20;
          const totalPages = Math.ceil(data.length / rowsPerPage) || 1;
          if (window._invLocalPage > totalPages) window._invLocalPage = totalPages;
          const startIdx = (window._invLocalPage - 1) * rowsPerPage;
          const pageData = data.slice(startIdx, startIdx + rowsPerPage);
          tbody.innerHTML = pageData.map(function(r, i) {
              return `<tr><td>${startIdx + i + 1}</td><td>${r.tanggal || ''}</td><td>${r.nama || ''}</td><td class="num">${r.jumlah || ''}</td></tr>`;
          }).join('');
          let paginationEl = document.getElementById("inv_pagination");
          if (!paginationEl) {
              paginationEl = document.createElement("div");
              paginationEl.id = "inv_pagination";
              paginationEl.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;";
              tbody.closest('.table-card').appendChild(paginationEl);
          }
          paginationEl.innerHTML = `
              <button class="btn btn-secondary" ${window._invLocalPage === 1 ? 'disabled' : ''} onclick="window._invLocalPage--; loadInventarisData()">⬅️ Prev</button>
              <span style="font-size:14px; font-weight:bold; color:#1e40af;">Hal ${window._invLocalPage} dari ${totalPages}</span>
              <button class="btn btn-secondary" ${window._invLocalPage === totalPages ? 'disabled' : ''} onclick="window._invLocalPage++; loadInventarisData()">Next ➡️</button>
          `;
          return;
      }

      // 1. Ambil tanggal unik & urutkan
      const dates = [...new Set(data.map(d => d.tanggal))].sort();
      
      // 2. Ambil nama barang unik & urutkan
      const items = [...new Set(data.map(d => d.nama))].sort();

      // 3. Buat Header Table (Tanggal sebagai kolom)
      let headerHtml = '<tr><th style="width: 50px;">No</th><th>Nama Barang</th>';
      dates.forEach(d => {
          // Format tanggal jadi dd/mm agar hemat tempat
          const dateObj = new Date(d);
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const year = dateObj.getFullYear();
          headerHtml += `<th class="num">${day}/${month}/${year}</th>`;
      });
      headerHtml += '</tr>';
      thead.innerHTML = headerHtml;

      // 4. Buat Body Table
      let bodyHtml = '';
      
      // [OPTIMASI SUPER KILAT] Gunakan Map Lookup O(1) alih-alih filter O(N) di dalam loop bersarang (memangkas dari 15.000.000 kalkulasi menjadi cuma 5.000)
      const dataMap = {};
      data.forEach(d => { dataMap[`${d.nama}_${d.tanggal}`] = d.jumlah; });

      items.forEach((item, index) => {
          bodyHtml += `<tr><td>${index + 1}</td><td>${item}</td>`;
          
          dates.forEach(date => {
              let val = dataMap[`${item}_${date}`];
              let valForEdit = '';

              if (val !== undefined) {
                  valForEdit = val;
              } else {
                  val = '-';
              }

              let cellClass = 'num clickable-cell';
              let onClick = `onclick="openEditInventaris('${item.replace(/'/g, "\\'")}', '${date}', '${valForEdit}')"`;
              bodyHtml += `<td class="${cellClass}" ${onClick} title="Klik untuk edit/tambah">${val}</td>`;
          });
          
          bodyHtml += '</tr>';
      });
      tbody.innerHTML = bodyHtml;
  };

  // Local Storage Logic (Offline/Pending)
  if (!useFirebaseBackend() && !isGoogleScript()) {
    setTimeout(() => {
        const pending = getCachedParsedStorage(getRbmStorageKey('RBM_PENDING_INVENTARIS'), []);
        let flatData = [];
        
        pending.forEach((item) => {
          const dataList = item.payload || [];
          dataList.forEach((data) => {
            if (data.tanggal >= tglAwal && data.tanggal <= tglAkhir) {
              flatData.push({
                tanggal: data.tanggal,
                nama: data.nama,
                jumlah: data.jumlah
              });
            }
          });
        });

        renderPivot(flatData);
    }, 50);
    return;
  }

  // Firebase: load inventaris dari Firebase
  if (typeof FirebaseStorage !== 'undefined' && FirebaseStorage.getInventaris && useFirebaseBackend()) {
    FirebaseStorage.getInventaris(tglAwal, tglAkhir, getRbmOutlet()).then(function(list) {
      renderPivot(list || []);
    }).catch(function(err) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error: ' + (err && err.message ? err.message : 'Gagal memuat') + '</td></tr>';
    });
    return;
  }

  // Google Script Logic (Placeholder - Anda perlu membuat fungsi getLaporanInventaris di GAS)
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(renderPivot)
      .withFailureHandler(function(err) {
         tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error: ' + (err && err.message ? err.message : 'Gagal memuat') + '</td></tr>';
      })
      .getLaporanInventaris(tglAwal, tglAkhir);
    return;
  }

  renderPivot([]);
}

function exportInventarisToExcel() {
  const table = document.getElementById("inv_table");
  if (!table) return;
  const tglAwal = document.getElementById("inv_tanggal_awal").value;
  const tglAkhir = document.getElementById("inv_tanggal_akhir").value;
  const filename = `Laporan_Inventaris_${tglAwal}_sd_${tglAkhir}.xls`;
  
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>table{border-collapse:collapse;width:100%;}th,td{border:1px solid #000;padding:5px;}th{background-color:#1e40af;color:#fff;}.num{mso-number-format:"\#\,\#\#0";text-align:right;}</style></head><body><h2 style="text-align:center;">Laporan Inventaris</h2><p style="text-align:center;">Periode: ${tglAwal} s/d ${tglAkhir}</p>${table.outerHTML}</body></html>`;
  
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function printInventarisReport() {
  const table = document.getElementById("inv_table");
  if (!table) return;
  const tglAwal = document.getElementById("inv_tanggal_awal").value;
  const tglAkhir = document.getElementById("inv_tanggal_akhir").value;

  const printWindow = window.open('', '', 'height=600,width=900');
  printWindow.document.write('<html><head><title>Laporan Inventaris</title><style>body{font-family:sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #ccc;padding:8px;}th{background:#1e40af;color:white;}.num{text-align:right;}@media print{@page{size:portrait;}}</style></head><body>');
  printWindow.document.write(`<h2 style="text-align:center;">Laporan Inventaris</h2><p style="text-align:center;">Periode: ${tglAwal} s/d ${tglAkhir}</p>`);
  printWindow.document.write(table.outerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

function openEditInventaris(nama, tanggal, jumlah) {
    document.getElementById('editInvNama').value = nama;
    document.getElementById('editInvTanggal').value = tanggal;
    document.getElementById('editInvJumlah').value = jumlah;
    
    const d = new Date(tanggal);
    const displayDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    document.getElementById('editInvInfo').innerHTML = `<strong>${nama}</strong><br>${displayDate}`;
    var modal = document.getElementById('editInventarisModal');
    if (modal) {
        var btns = modal.querySelectorAll('button');
        var canEdit = window.rbmOnlyOwnerCanEditDelete && window.rbmOnlyOwnerCanEditDelete();
        if (btns[0]) btns[0].style.display = canEdit ? '' : 'none';
        if (btns[1]) btns[1].style.display = canEdit ? '' : 'none';
    }
    if (modal) modal.style.display = 'flex';
}

function closeEditInventaris() {
    document.getElementById('editInventarisModal').style.display = 'none';
}

function saveEditInventaris() {
    if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat mengedit data.', 'Akses Ditolak', 'error'); return; }
    const nama = document.getElementById('editInvNama').value;
    const tanggal = document.getElementById('editInvTanggal').value;
    const jumlah = document.getElementById('editInvJumlah').value;
    
    if (jumlah === '') { showCustomAlert("Jumlah harus diisi", "Peringatan", "warning"); return; }
    processInventarisUpdate(nama, tanggal, jumlah);
}

function deleteEditInventaris() {
    if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat menghapus data.', 'Akses Ditolak', 'error'); return; }
    showCustomConfirm("Hapus data inventaris ini? (Jumlah akan di-set ke 0)", "Konfirmasi Hapus", function() {
        const nama = document.getElementById('editInvNama').value;
        const tanggal = document.getElementById('editInvTanggal').value;
        processInventarisUpdate(nama, tanggal, 0);
    });
}

function processInventarisUpdate(nama, tanggal, jumlah) {
    const dataList = [{ tanggal: tanggal, nama: nama, jumlah: jumlah }];
    closeEditInventaris();
    
    const tbody = document.getElementById("inv_tbody");
    tbody.innerHTML = '<tr><td colspan="100%" class="table-loading">Menyimpan perubahan...</td></tr>';

    if (useFirebaseBackend()) {
        FirebaseStorage.saveInventaris(dataList, getRbmOutlet()).then(function(res) { alert(res); loadInventarisData(); }).catch(function(err) { alert("Error: " + (err && err.message ? err.message : '')); loadInventarisData(); });
        return;
    }
    if (!isGoogleScript()) {
        savePendingToLocalStorage('INVENTARIS', dataList);
        loadInventarisData();
    } else {
        google.script.run.withSuccessHandler(function(res) { alert(res); loadInventarisData(); }).withFailureHandler(function(err) { alert("Error: " + err.message); loadInventarisData(); }).simpanDataInventaris(dataList);
    }
}

// ================= ABSENSI LOGIC =================
const ABSENSI_CODES = ['H', 'R', 'O', 'S', 'I', 'A', 'DP', 'PH', 'AL', ''];
const JADWAL_CODES = ['P', 'M', 'S', 'Off', 'PH', 'AL', 'DP', ''];
function getJadwalCodesList() {
    var c = typeof getGpsJamConfig === 'function' ? getGpsJamConfig() : {};
    if (c.shifts && Array.isArray(c.shifts) && c.shifts.length > 0) {
        var codes = c.shifts.map(function(s) { return s.code || ''; }).filter(Boolean);
        return codes.concat(['Off', 'PH', 'AL', 'DP', '']);
    }
    return JADWAL_CODES;
}

function updateJadwalLegend() {
    var el = document.getElementById('legend-jadwal');
    if (!el) return;
    var c = typeof getGpsJamConfig === 'function' ? getGpsJamConfig() : {};
    var html = '';
    if (c.shifts && Array.isArray(c.shifts) && c.shifts.length > 0) {
        c.shifts.forEach(function(s) {
            var code = (s.code || '').toString().replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/>/g, '&gt;');
            var name = (s.name || code).toString().replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/>/g, '&gt;');
            html += '<span class="badge jadwal-' + code + '">' + code + ': ' + name + '</span>';
        });
    } else {
        html += '<span class="badge jadwal-P">P: Pagi</span><span class="badge jadwal-M">M: Middle</span><span class="badge jadwal-S">S: Sore</span>';
    }
    html += '<span class="badge jadwal-Off">Off: Libur</span><span class="badge status-C">PH/AL/DP: Cuti</span>';
    el.innerHTML = html;
    el.style.display = 'flex';
    el.style.gap = '10px';
    el.style.flexWrap = 'wrap';
}

let activeAbsensiMode = 'absensi';

function getLocalDateKey(input) {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function syncAbsensiPeriodAndRefresh() {
    if (window._absensiEmployeesDirty) {
        if (!confirm("Ada perubahan data karyawan yang belum disimpan! Lanjutkan refresh (perubahan akan hilang)?")) return;
        window._absensiEmployeesDirty = false;
    }

    var tglAwal = document.getElementById("absensi_tgl_awal") ? document.getElementById("absensi_tgl_awal").value : '';
    var tglAkhir = document.getElementById("absensi_tgl_akhir") ? document.getElementById("absensi_tgl_akhir").value : '';
    if (!tglAwal || !tglAkhir) return;

    if (window._isSyncingAbsensi) return;
    window._isSyncingAbsensi = true;

    var absenKey = getRbmStorageKey('RBM_ABSENSI_DATA');
    var jadwalKey = getRbmStorageKey('RBM_JADWAL_DATA');
    var gpsKey = getRbmStorageKey('RBM_GPS_LOGS');
    
    var cachedAbsen = window._rbmParsedCache[absenKey] ? window._rbmParsedCache[absenKey].data : safeParse(RBMStorage.getItem(absenKey), {});
    var cachedJadwal = window._rbmParsedCache[jadwalKey] ? window._rbmParsedCache[jadwalKey].data : safeParse(RBMStorage.getItem(jadwalKey), {});

    if (cachedAbsen || cachedJadwal) {
        window._rbmParsedCache[absenKey] = { data: cachedAbsen || {} };
        window._rbmParsedCache[jadwalKey] = { data: cachedJadwal || {} };
        window._absensiViewEmployees = undefined; // [FIX] Selalu kosongkan agar tabel mengambil data karyawan terbaru dari cache
        if (activeAbsensiMode === 'jadwal') window._absensiViewData = cachedJadwal || {};
        else window._absensiViewData = cachedAbsen || {};
        switchAbsensiTab(activeAbsensiMode);
    } else {
        var tbody = document.getElementById("absensi_tbody");
        if (tbody && (activeAbsensiMode === 'absensi' || activeAbsensiMode === 'jadwal')) {
            tbody.innerHTML = '<tr><td colspan="30" style="text-align:center; padding:20px;">Memuat data dari server... ⏳</td></tr>';
        }
    }

    // [FIX] Tarik juga master Karyawan terbaru dari Firebase saat Refresh,
    // lalu paksa render ulang agar nama karyawan lintas-device langsung sinkron.
    if (window.RBMStorage && typeof window.RBMStorage.loadFromFirebase === 'function') {
        window.RBMStorage.loadFromFirebase().then(function() {
            try {
                var empKey = getRbmStorageKey('RBM_EMPLOYEES');
                if (window._rbmParsedCache && window._rbmParsedCache[empKey]) {
                    delete window._rbmParsedCache[empKey];
                }
                window._absensiViewEmployees = undefined;
                if (activeAbsensiMode === 'absensi' || activeAbsensiMode === 'jadwal') {
                    renderAbsensiTable(activeAbsensiMode);
                } else if (activeAbsensiMode === 'laporan' && typeof renderRekapAbsensiReport === 'function') {
                    renderRekapAbsensiReport();
                } else if (activeAbsensiMode === 'gaji' && typeof renderRekapGaji === 'function') {
                    renderRekapGaji();
                } else if (activeAbsensiMode === 'bonus' && typeof renderBonusTab === 'function') {
                    renderBonusTab();
                }
            } catch (e) {}
        }).catch(function(){});
    }

    if (useFirebaseBackend() && typeof FirebaseStorage !== 'undefined' && FirebaseStorage.loadAbsensiJadwal) {
        var outlet = getRbmOutlet() || 'default';
        Promise.all([
            FirebaseStorage.loadAbsensiJadwal(outlet, 'absensi', tglAwal, tglAkhir),
            FirebaseStorage.loadAbsensiJadwal(outlet, 'jadwal', tglAwal, tglAkhir)
        ]).then(function(results) {
            var oldAbsen = JSON.stringify(cachedAbsen || {});
            var newAbsen = JSON.stringify(results[0] || {});
            var oldJadwal = JSON.stringify(cachedJadwal || {});
            var newJadwal = JSON.stringify(results[1] || {});

            window._rbmParsedCache[absenKey] = { data: results[0] };
            window._rbmParsedCache[jadwalKey] = { data: results[1] };
            
            if (oldAbsen !== newAbsen || oldJadwal !== newJadwal || !window._absensiAutoRefreshed) {
                window._absensiAutoRefreshed = true;
                window._absensiViewEmployees = undefined; // Paksa refresh daftar karyawan terbaru jika ada perubahan
                if (activeAbsensiMode === 'jadwal') window._absensiViewData = results[1];
                else window._absensiViewData = results[0];
                switchAbsensiTab(activeAbsensiMode);
            }
            window._isSyncingAbsensi = false;
        }).catch(function(e) {
            if (!cachedAbsen && !cachedJadwal) {
                window._absensiViewData = {};
                switchAbsensiTab(activeAbsensiMode);
            }
            window._isSyncingAbsensi = false;
        });

        // [OPTIMASI KILAT] Tarik GPS logs (yang sangat berat) di background secara terpisah.
        // JANGAN memblokir proses render Tabel Absensi dan Jadwal!
        FirebaseStorage.loadGpsLogs(outlet, tglAwal, tglAkhir).then(function(gpsData) {
            window._rbmParsedCache[gpsKey] = { data: gpsData };
            // Auto-update tabel Gaji jika kebetulan user sedang berada di Tab Gaji
            if (activeAbsensiMode === 'gaji' && typeof renderRekapGaji === 'function') {
                renderRekapGaji();
            }
        }).catch(function(){});
    } else {
        if (!cachedAbsen && !cachedJadwal) {
            window._absensiViewData = undefined;
            switchAbsensiTab(activeAbsensiMode);
        }
        window._isSyncingAbsensi = false;
    }

    // [FIX KRUSIAL] Tarik data Gaji & Bonus dari Firebase (Di luar blok agar SELALU tereksekusi meskipun modul lawas absen)
    var gajiKey = getRbmStorageKey('RBM_GAJI_' + tglAwal + '_' + tglAkhir);
    var bonusKey = getRbmStorageKey('RBM_BONUS_' + tglAwal + '_' + tglAkhir);
    if (window.RBMStorage && window.RBMStorage._db) {
        window.RBMStorage._db.ref('rbm_pro/gaji/' + gajiKey.slice(9)).once('value').then(function(snap) {
            var v = snap.val();
            if (v) {
                // Jangan menimpa edit lokal terbaru: gabungkan data cloud + lokal dan utamakan nilai lokal jika ada.
                var localGaji = getCachedParsedStorage(gajiKey, {});
                var mergedGaji = {};
                try {
                    var localObj = (localGaji && typeof localGaji === 'object') ? localGaji : {};
                    var cloudObj = (v && typeof v === 'object') ? v : {};
                    Object.keys(cloudObj).forEach(function(k) { mergedGaji[k] = cloudObj[k]; });
                    Object.keys(localObj).forEach(function(k) {
                        if (!mergedGaji[k] || typeof mergedGaji[k] !== 'object') mergedGaji[k] = {};
                        if (localObj[k] && typeof localObj[k] === 'object') {
                            Object.keys(localObj[k]).forEach(function(f) {
                                var lv = localObj[k][f];
                                if (lv !== undefined && lv !== null && lv !== '') mergedGaji[k][f] = lv;
                            });
                        } else if (localObj[k] !== undefined) {
                            mergedGaji[k] = localObj[k];
                        }
                    });
                } catch (e) { mergedGaji = v; }
                window._rbmParsedCache[gajiKey] = { data: mergedGaji };
                try { localStorage.setItem(gajiKey, JSON.stringify(mergedGaji)); } catch(e) {}
                if (activeAbsensiMode === 'gaji' && typeof renderRekapGaji === 'function') renderRekapGaji();
            }
        }).catch(function(){});
        window.RBMStorage._db.ref('rbm_pro/bonus/' + bonusKey.slice(10)).once('value').then(function(snap) {
            var v = snap.val();
            if (v) {
                // Jangan menimpa edit lokal terbaru: gabungkan data cloud + lokal dan utamakan data lokal
                var localBonus = getCachedParsedStorage(bonusKey, {});
                var mergedBonus = {};
                try {
                    var localObj = (localBonus && typeof localBonus === 'object') ? localBonus : {};
                    var cloudObj = (v && typeof v === 'object') ? v : {};

                    // Default: pakai cloud dulu, lalu overlay lokal yang benar-benar ada
                    mergedBonus = cloudObj || {};

                    if (Array.isArray(localObj.absensi)) {
                        if (localObj.absensi.length > 0 || !(cloudObj && Array.isArray(cloudObj.absensi) && cloudObj.absensi.length > 0)) {
                            mergedBonus.absensi = localObj.absensi;
                        }
                    }

                    if (localObj.omset && typeof localObj.omset === 'object') {
                        mergedBonus.omset = localObj.omset;
                    }

                    // Overlay key lain kalau ada
                    Object.keys(localObj).forEach(function(k) {
                        if (k === 'absensi' || k === 'omset') return;
                        if (localObj[k] !== undefined) mergedBonus[k] = localObj[k];
                    });
                } catch (e) {
                    mergedBonus = v;
                }

                window._rbmParsedCache[bonusKey] = { data: mergedBonus };
                try { localStorage.setItem(bonusKey, JSON.stringify(mergedBonus)); } catch(e) {}
                if (activeAbsensiMode === 'bonus' && typeof renderBonusTab === 'function') renderBonusTab();
            }
        }).catch(function(){});
    }
}

function switchAbsensiTab(mode) {
    mode = mode || activeAbsensiMode;
    activeAbsensiMode = mode;
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('tab-btn-' + mode);
    if(activeBtn) activeBtn.classList.add('active');

    // Hide all content sections
    document.getElementById('tab-content-input').style.display = 'none';
    document.getElementById('tab-content-laporan').style.display = 'none';
    document.getElementById('tab-content-gaji').style.display = 'none';
    document.getElementById('tab-content-bonus').style.display = 'none';

    if (mode === 'absensi' || mode === 'jadwal') {
        document.getElementById('tab-content-input').style.display = 'block';
        if (useFirebaseBackend()) {
             const key = getRbmStorageKey(mode === 'jadwal' ? 'RBM_JADWAL_DATA' : 'RBM_ABSENSI_DATA');
             window._absensiViewData = window._rbmParsedCache[key] ? window._rbmParsedCache[key].data : undefined;
        } else {
             window._absensiViewData = undefined;
        }
        renderAbsensiTable(mode);
    } else if (mode === 'laporan') {
        document.getElementById('tab-content-laporan').style.display = 'block';
        renderRekapAbsensiReport();
    } else if (mode === 'gaji') {
        document.getElementById('tab-content-gaji').style.display = 'block';
        renderRekapGaji();
    } else if (mode === 'bonus') {
        document.getElementById('tab-content-bonus').style.display = 'block';
        renderBonusTab();
    }
}

function renderAbsensiTable(mode) {
    if (mode) activeAbsensiMode = mode;
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    const thead = document.getElementById("absensi_thead");
    const tbody = document.getElementById("absensi_tbody");

    if (!tglAwal || !tglAkhir) return;

    // Toggle Legends
    const isJadwal = activeAbsensiMode === 'jadwal';
    const legendAbsensi = document.getElementById('legend-absensi');
    const legendJadwal = document.getElementById('legend-jadwal');
    if (legendAbsensi && legendJadwal) {
        legendAbsensi.style.display = isJadwal ? 'none' : 'flex';
        legendJadwal.style.display = isJadwal ? 'flex' : 'none';
        if (isJadwal && typeof updateJadwalLegend === 'function') updateJadwalLegend();
    }

    // Generate Date Range
    const dates = [];
    let curr = new Date(tglAwal);
    const end = new Date(tglAkhir);
    while (curr <= end) {
        dates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }

    // Determine Codes and Headers (jadwal: ikut daftar shift dari Pengaturan Jadwal & Absensi)
    const rekapHeaders = isJadwal ? (typeof getJadwalCodesList === 'function' ? getJadwalCodesList().filter(function(c) { return c !== ''; }) : ['P','M','S','Off','PH','AL','DP']) : ['H','R','O','S','I','A','DP','PH','AL'];
    const dataKey = getRbmStorageKey(isJadwal ? 'RBM_JADWAL_DATA' : 'RBM_ABSENSI_DATA');
    if (window._absensiViewData === undefined) {
        window._absensiViewData = safeParse(RBMStorage.getItem(dataKey), {});
    }
    const storedData = window._absensiViewData;

    const extraColsVisible = RBMStorage.getItem(getRbmStorageKey('RBM_ABSENSI_EXTRA_COLS')) !== '0';
    const table = document.getElementById('absensi_table');
    const toggleBtn = document.getElementById('absensi-toggle-cols-btn');

    // 1. Build Header (Email dihapus; Jabatan, Join Date, Sisa Cuti bisa dilipat via icon mata di samping Save/Print Jadwal)
    let row1 = `
        <tr>
            <th rowspan="2" style="position:sticky; left:0; z-index:10; min-width: 40px; background: #1e40af;">No</th>
            <th rowspan="2" style="position:sticky; left:40px; z-index:10; min-width:150px; background: #1e40af;">Nama</th>
            <th rowspan="2" class="col-jabatan" style="min-width:100px; background: #1e40af;">Jabatan</th>
            <th rowspan="2" class="col-joindate" style="min-width:110px; background: #1e40af;">Join Date</th>
            <th colspan="3" class="col-sisa-cuti" style="background: #1e40af;">Sisa Cuti</th>
            <th colspan="${dates.length}">Tanggal (${tglAwal} s/d ${tglAkhir}) - ${isJadwal ? 'JADWAL' : 'ABSENSI'}</th>
            <th colspan="${rekapHeaders.length}">Rekap ${isJadwal ? 'Jadwal' : 'Absensi'}</th>
            <th rowspan="2">Aksi</th>
        </tr>
        <tr>`;
    
    row1 += `<th class="col-sisa-cuti" style="min-width:60px; background: #1e40af;">AL</th>`;
    row1 += `<th class="col-sisa-cuti" style="min-width:60px; background: #1e40af;">DP</th>`;
    row1 += `<th class="col-sisa-cuti" style="min-width:60px; background: #1e40af;">PH</th>`;

    dates.forEach(d => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        row1 += `<th style="font-size:11px; min-width:35px;">${day}/${month}</th>`;
    });

    rekapHeaders.forEach(h => { row1 += `<th>${h}</th>`; });
    row1 += `</tr>`;
    thead.innerHTML = row1;
    if (table) {
        if (extraColsVisible) table.classList.remove('hide-extra-cols'); else table.classList.add('hide-extra-cols');
    }
    if (toggleBtn) {
        toggleBtn.title = extraColsVisible ? 'Sembunyikan Jabatan, Join Date, Sisa Cuti' : 'Tampilkan Jabatan, Join Date, Sisa Cuti';
        toggleBtn.innerHTML = '&#128065;';
    }

    // 2. Load Data (in-memory; simpan ke Firebase hanya saat klik Simpan)
    if (window._absensiViewEmployees === undefined || !Array.isArray(window._absensiViewEmployees)) {
        window._absensiViewEmployees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    }
    const employees = window._absensiViewEmployees;

    // Tombol Atur Urutan hanya untuk Developer
    try {
        var btnEmpOrder = document.getElementById('absensi-order-btn');
        if (btnEmpOrder) btnEmpOrder.style.display = rbmIsDeveloper() ? '' : 'none';
    } catch (e) {}

    // 3. Build Body
    let bodyHtml = '';
    const ordered = getOrderedAbsensiEmployeesWithIndex(employees);
    ordered.forEach((item, displayIndex) => {
        const emp = item.emp;
        const index = item.idx; // index asli (untuk key & update/remove)
        // Static Info (Email dihapus; Jabatan, Join Date, Sisa Cuti bisa dilipat via icon di samping Save/Print Jadwal)
        let rowHtml = `<tr>
            <td style="position:sticky; left:0; background:white; z-index:5;">${displayIndex + 1}</td>
            <td style="position:sticky; left:40px; background:white; z-index:5; text-align:left;">
                <input type="text" name="emp_name_${index}" aria-label="Nama Karyawan" value="${emp.name}" onchange="updateEmployee(${index}, 'name', this.value)" style="border:none; width:100%; padding:0;">
            </td>
            <td class="col-jabatan">
                <input type="text" name="emp_jabatan_${index}" aria-label="Jabatan Karyawan" value="${emp.jabatan}" onchange="updateEmployee(${index}, 'jabatan', this.value)" style="border:none; width:80px; padding:0;">
            </td>
            <td class="col-joindate">
                <input type="date" name="emp_joindate_${index}" aria-label="Tanggal Masuk" value="${emp.joinDate || ''}" onchange="updateEmployee(${index}, 'joinDate', this.value)" style="border:none; width:100px; padding:0; font-size:11px;">
            </td>
            <td class="col-sisa-cuti">
                <input type="number" name="emp_sisaAL_${index}" aria-label="Sisa Cuti AL" value="${emp.sisaAL||0}" onchange="updateEmployee(${index}, 'sisaAL', this.value)" style="width:50px; padding:5px; border:1px solid #eee; text-align:center;">
            </td>
            <td class="col-sisa-cuti">
                <input type="number" name="emp_sisaDP_${index}" aria-label="Sisa Cuti DP" value="${emp.sisaDP||0}" onchange="updateEmployee(${index}, 'sisaDP', this.value)" style="width:50px; padding:5px; border:1px solid #eee; text-align:center;">
            </td>
            <td class="col-sisa-cuti">
                <input type="number" name="emp_sisaPH_${index}" aria-label="Sisa Cuti PH" value="${emp.sisaPH||0}" onchange="updateEmployee(${index}, 'sisaPH', this.value)" style="width:50px; padding:5px; border:1px solid #eee; text-align:center;">
            </td>
        `;

        // Date Cells
        let counts = {};
        rekapHeaders.forEach(h => counts[h] = 0);
        
        dates.forEach(d => {
            const dateKey = getLocalDateKey(d);
            const key = `${dateKey}_${emp.id || index}`;
            const status = storedData[key] || '';
            
            if (status && counts.hasOwnProperty(status)) counts[status]++;
            
            let colorClass = '';
            if (isJadwal) {
                 if (['PH','AL','DP'].includes(status)) colorClass = 'status-C';
                 else if (status) colorClass = 'jadwal-' + status;
            } else {
                 if (status) {
                    let type = status.charAt(0);
                    if(['DP','PH','AL'].includes(status)) type = 'C';
                    colorClass = `status-${type}`;
                 }
            }
            rowHtml += `<td class="absensi-cell ${colorClass}" onclick="cycleAbsensiStatus(this, '${key}')">${status}</td>`;
        });

        // Rekap Columns
        rekapHeaders.forEach(h => {
            rowHtml += `<td class="rekap-${h}" style="text-align:center;">${counts[h]}</td>`;
        });
        rowHtml += `<td>${window.rbmOnlyOwnerCanEditDelete && window.rbmOnlyOwnerCanEditDelete() ? '<button class="btn-small-danger" onclick="removeEmployee(' + index + ')">x</button>' : '-'}</td></tr>`;

        bodyHtml += rowHtml;
    });
    tbody.innerHTML = bodyHtml;
}

function toggleAbsensiExtraCols(btn) {
    const table = document.getElementById('absensi_table');
    if (!table) return;
    const isHidden = table.classList.contains('hide-extra-cols');
    if (isHidden) {
        table.classList.remove('hide-extra-cols');
        RBMStorage.setItem(getRbmStorageKey('RBM_ABSENSI_EXTRA_COLS'), '1');
        if (btn) { btn.title = 'Sembunyikan Jabatan, Join Date, Sisa Cuti'; btn.innerHTML = '&#128065;'; }
    } else {
        table.classList.add('hide-extra-cols');
        RBMStorage.setItem(getRbmStorageKey('RBM_ABSENSI_EXTRA_COLS'), '0');
        if (btn) { btn.title = 'Tampilkan Jabatan, Join Date, Sisa Cuti'; btn.innerHTML = '&#128065;'; }
    }
}

function cycleAbsensiStatus(cell, key) {
    const isJadwal = activeAbsensiMode === 'jadwal';
    const codes = isJadwal ? (typeof getJadwalCodesList === 'function' ? getJadwalCodesList() : JADWAL_CODES) : ABSENSI_CODES;
    const current = cell.innerText;
    let nextIdx = codes.indexOf(current) + 1;
    if (nextIdx >= codes.length) nextIdx = 0;
    const next = codes[nextIdx];
    
    cell.innerText = next;
    
    // Update Class
    cell.className = 'absensi-cell'; // reset
    if (next) {
        if (isJadwal) {
             if (['PH','AL','DP'].includes(next)) cell.classList.add('status-C');
             else if (next) cell.classList.add('jadwal-' + next);
        } else {
             let type = next.charAt(0);
             if(['DP','PH','AL'].includes(next)) type = 'C';
             cell.classList.add(`status-${type}`);
        }
    }

    // Simpan di memori saja; akan tersimpan ke Firebase saat user klik tombol Simpan
    if (window._absensiViewData === undefined) {
        window._absensiViewData = getCachedParsedStorage(getRbmStorageKey(isJadwal ? 'RBM_JADWAL_DATA' : 'RBM_ABSENSI_DATA'), {});
    }
    window._absensiViewData[key] = next;
}

function updateEmployee(index, field, value) {
    if (window._absensiViewEmployees === undefined || !Array.isArray(window._absensiViewEmployees)) {
        window._absensiViewEmployees = safeParse(RBMStorage.getItem(getRbmStorageKey('RBM_EMPLOYEES')), []);
    }
    const employees = window._absensiViewEmployees;
    if (employees[index]) {
        employees[index][field] = value;
    }
    // [NO AUTO-SAVE] perubahan master karyawan harus disimpan manual
    window._absensiEmployeesDirty = true;
    markAbsensiEmployeesDirtyUI();
    renderAbsensiTable();
}

function addEmployeeRow() {
    if (window._absensiViewEmployees === undefined || !Array.isArray(window._absensiViewEmployees)) {
        window._absensiViewEmployees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    }
    const employees = window._absensiViewEmployees;
    const newId = employees.length > 0 ? Math.max(...employees.map(e => e.id || 0)) + 1 : 1;
    employees.push({ id: newId, name: "Nama Baru", jabatan: "-", email: "", joinDate: "", sisaAL:0, sisaDP:0, sisaPH:0 });
    // [NO AUTO-SAVE] harus disimpan manual
    window._absensiEmployeesDirty = true;
    markAbsensiEmployeesDirtyUI();
    renderAbsensiTable();
}

function removeEmployee(index) {
    if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat menghapus data karyawan.', 'Akses Ditolak', 'error'); return; }
    showCustomConfirm("Hapus karyawan ini?", "Konfirmasi Hapus", function() {
        if (window._absensiViewEmployees === undefined || !Array.isArray(window._absensiViewEmployees)) {
            window._absensiViewEmployees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
        }
        window._absensiViewEmployees.splice(index, 1);
        // [NO AUTO-SAVE] harus disimpan manual
        window._absensiEmployeesDirty = true;
        markAbsensiEmployeesDirtyUI();
        renderAbsensiTable();
    });
}

function saveAbsensiData() {
    renderAbsensiTable();
}

/** Simpan data Absensi & Jadwal (karyawan + status per tanggal) ke Firebase. Panggil saat user klik tombol Simpan. */
function saveAbsensiToFirebase(silent) {
    var employees = window._absensiViewEmployees;
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
        if (!silent) alert('Tidak ada data karyawan untuk disimpan.');
        return;
    }
    var data = window._absensiViewData;
    if (data === undefined) data = {};
    var isJadwal = activeAbsensiMode === 'jadwal';
    var type = isJadwal ? 'jadwal' : 'absensi';
    var outlet = getRbmOutlet() || 'default';
    var msg = document.getElementById('absensi-save-feedback');
    function showSuccess() {
        if (msg) {
            msg.textContent = 'Data tersimpan.';
            msg.style.color = '#16a34a';
            setTimeout(function() { msg.textContent = ''; }, 3000);
        } else {
            if (!silent) alert('Data tersimpan.');
        }
    }
    function showError() {
        if (msg) {
            msg.textContent = 'Gagal menyimpan. Cek koneksi internet.';
            msg.style.color = '#dc2626';
        } else {
            if (!silent) alert('Gagal menyimpan. Cek koneksi internet.');
        }
    }
    if (msg && !silent) msg.textContent = 'Menyimpan...';
    var promises = [];
    
    var keyEmployees = getRbmStorageKey('RBM_EMPLOYEES');
    var keyData = getRbmStorageKey(isJadwal ? 'RBM_JADWAL_DATA' : 'RBM_ABSENSI_DATA');

    // [PERFORMA] jika karyawan belum diubah, jangan rewrite node karyawan
    var shouldSaveEmployees = window._absensiEmployeesDirty === true;
    if (shouldSaveEmployees) {
        promises.push(RBMStorage.setItem(keyEmployees, JSON.stringify(employees)));
    }

    if (useFirebaseBackend() && typeof FirebaseStorage !== 'undefined' && FirebaseStorage.saveAbsensiJadwal) {
        promises.push(FirebaseStorage.saveAbsensiJadwal(outlet, type, data));
        window._rbmParsedCache[keyData] = { data: data };
    } else {
        promises.push(RBMStorage.setItem(keyData, JSON.stringify(data)));
    }

    Promise.all(promises).then(function() {
        window._absensiEmployeesDirty = false;
        if (msg && !silent) msg.textContent = 'Data tersimpan.';
        showSuccess();
        try {
            if (useFirebaseBackend() && typeof FirebaseStorage !== 'undefined' && FirebaseStorage.syncGpsKioskAfterAbsensiSave) {
                FirebaseStorage.syncGpsKioskAfterAbsensiSave(outlet, type, data, employees);
            }
        } catch (eGps) {}
    }).catch(function(err) {
        console.warn('saveAbsensiToFirebase failed', err);
        // Tampilkan pesan lebih jelas jika ada
        if (msg && !silent) {
            msg.textContent = 'Gagal menyimpan: ' + ((err && err.message) ? err.message : 'cek koneksi');
            msg.style.color = '#dc2626';
        }
        showError();
    });
}

// [NEW] Simpan hanya master karyawan (nama, jabatan, joinDate, sisa cuti).
function saveAbsensiEmployeesToFirebase(silent) {
    var employees = window._absensiViewEmployees;
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
        if (!silent) alert('Tidak ada data karyawan untuk disimpan.');
        return;
    }
    var keyEmployees = getRbmStorageKey('RBM_EMPLOYEES');
    var msg = document.getElementById('absensi-save-feedback');
    if (msg && !silent) msg.textContent = 'Menyimpan karyawan...';

    return RBMStorage.setItem(keyEmployees, JSON.stringify(employees)).then(function() {
        window._absensiEmployeesDirty = false;
        if (msg) {
            msg.textContent = 'Karyawan tersimpan.';
            msg.style.color = '#16a34a';
            setTimeout(function() { msg.textContent = ''; }, 2500);
        } else if (!silent) {
            alert('Karyawan tersimpan.');
        }
        try {
            if (useFirebaseBackend() && typeof FirebaseStorage !== 'undefined' && FirebaseStorage.syncGpsKioskAfterAbsensiSave) {
                var outletEmp = getRbmOutlet() || 'default';
                FirebaseStorage.syncGpsKioskAfterAbsensiSave(outletEmp, 'absensi', {}, employees);
            }
        } catch (eK) {}
    }).catch(function(err) {
        console.warn('saveAbsensiEmployeesToFirebase failed', err);
        if (msg) {
            msg.textContent = 'Gagal menyimpan karyawan: ' + ((err && err.message) ? err.message : 'cek koneksi');
            msg.style.color = '#dc2626';
        } else if (!silent) {
            alert('Gagal menyimpan karyawan.');
        }
    });
}

function markAbsensiEmployeesDirtyUI() {
    const msg = document.getElementById('absensi-save-feedback');
    if (!msg) return;
    msg.textContent = 'Perubahan karyawan belum tersimpan. Klik "Simpan".';
    msg.style.color = '#f59e0b';
}

function renderRekapAbsensiReport() {
    const tglAwalEl = document.getElementById("absensi_tgl_awal");
    const tglAkhirEl = document.getElementById("absensi_tgl_akhir");
    const tglAwal = tglAwalEl ? tglAwalEl.value : '';
    const tglAkhir = tglAkhirEl ? tglAkhirEl.value : '';
    
    if (!tglAwal || !tglAkhir) {
        alert("Pilih tanggal mulai dan selesai terlebih dahulu.");
        return;
    }

    // Update Header Text
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const d1 = new Date(tglAwal).toLocaleDateString('id-ID', options);
    const d2 = new Date(tglAkhir).toLocaleDateString('id-ID', options);
    document.getElementById("rekap_periode_text").innerText = `Absensi Periode ${d1} s/d ${d2}`;
    
    // Update Sign Date
    const todayStr = new Date().toLocaleDateString('id-ID', options);
    const signDateEl = document.getElementById("rekap_sign_date");
    if(signDateEl) signDateEl.innerText = `Sidoarjo, ${todayStr}`;

    // Generate Dates
    const dates = [];
    let curr = new Date(tglAwal);
    const end = new Date(tglAkhir);
    while (curr <= end) {
        dates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }

    const thead = document.getElementById("rekap_absen_thead");
    const tbody = document.getElementById("rekap_absen_tbody");
    const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    const gajiPeriodKey = getRbmStorageKey('RBM_GAJI_' + tglAwal + '_' + tglAkhir);
    const gajiPeriodData = getCachedParsedStorage(gajiPeriodKey, {});
    const configTelat = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : 10;

    // 1. Build Header
    let hRow1 = `
        <tr>
            <th rowspan="2" style="border:1px solid black; padding:4px;">NO</th>
            <th rowspan="2" style="border:1px solid black; padding:4px;">ID KARYAWAN</th>
            <th rowspan="2" style="border:1px solid black; padding:4px;">NAMA</th>
            <th rowspan="2" style="border:1px solid black; padding:4px;">JABATAN</th>
            <th colspan="${dates.length}" style="border:1px solid black; padding:4px;">PERIODE (${d1} - ${d2})</th>
            <th rowspan="2" style="border:1px solid black; padding:4px; width:40px;">TOTAL HARI KERJA</th>
            <th rowspan="2" style="border:1px solid black; padding:4px; width:40px;">TOTAL SISA CUTI</th>
            <th colspan="8" style="border:1px solid black; padding:4px;">ABSENSI/TIDAK HADIR</th>
            <th colspan="2" style="border:1px solid black; padding:4px;">POTONGAN</th>
        </tr>
        <tr>`;
    
    // Date Sub-headers
    dates.forEach(d => {
        hRow1 += `<th style="border:1px solid black; padding:2px; min-width:20px;">${d.getDate()}</th>`;
    });

    // Absensi Sub-headers
    const absTypes = ['A', 'I', 'S', 'OFF', 'DP', 'PH', 'AL', 'JML'];
    absTypes.forEach(t => {
        hRow1 += `<th style="border:1px solid black; padding:2px; min-width:25px;">${t}</th>`;
    });
    hRow1 += `<th style="border:1px solid black; padding:2px; min-width:35px;">HARI</th>`;
    hRow1 += `<th style="border:1px solid black; padding:2px; min-width:40px;">TELAT (JAM)</th>`;
    hRow1 += `</tr>`;
    thead.innerHTML = hRow1;

    // 2. Build Body
    let bodyHtml = '';
    if (employees.length === 0) {
        bodyHtml = `<tr><td colspan="${7 + dates.length + 8}" style="text-align:center; padding:10px; border:1px solid black;">Tidak ada data karyawan</td></tr>`;
    } else {
        employees.forEach((emp, idx) => {
            let row = `<tr>`;
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${idx + 1}</td>`;
            row += `<td style="border:1px solid black; padding:4px;">${emp.id || '-'}</td>`;
            row += `<td style="border:1px solid black; padding:4px;">${emp.name}</td>`;
            row += `<td style="border:1px solid black; padding:4px;">${emp.jabatan}</td>`;

            let counts = { H:0, A:0, I:0, S:0, OFF:0, DP:0, PH:0, AL:0 };
            
            // Date Cells
            dates.forEach(d => {
                const dateKey = getLocalDateKey(d);
                const key = `${dateKey}_${emp.id || idx}`;
                const status = absensiData[key] || '';
                
                // Fix: Map 'O' to 'OFF' for counting
                let countKey = status;
                if (status === 'O') countKey = 'OFF';

                if (status && counts.hasOwnProperty(countKey)) {
                    counts[countKey]++;
                }
                
                row += `<td style="border:1px solid black; padding:2px; text-align:center; font-size:9px;">${status}</td>`;
            });

            // Calculations
            const totalHariKerja = counts.H; 
            const totalSisaCuti = (parseInt(emp.sisaAL)||0) + (parseInt(emp.sisaDP)||0) + (parseInt(emp.sisaPH)||0);
            const totalJml = dates.length; 

            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${totalHariKerja}</td>`;
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${totalSisaCuti}</td>`;

            // Breakdown Columns
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${counts.A || '-'}</td>`;
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${counts.I || '-'}</td>`;
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${counts.S || '-'}</td>`;
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${counts.OFF || '-'}</td>`;
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${counts.DP || '-'}</td>`;
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${counts.PH || '-'}</td>`;
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${counts.AL || '-'}</td>`;
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${totalJml}</td>`;

            const empKey = (emp && emp.id != null && emp.id !== '') ? ('id_' + String(emp.id)) : (emp && emp.name ? ('name_' + String(emp.name).replace(/[.#$\[\]]/g, '_')) : ('idx_' + String(idx)));
            const pData = gajiPeriodData[empKey] || {};
            const potHari = pData.potHari !== undefined ? parseFloat(pData.potHari) : 0;
            const totalMenitTelatGps = typeof getTotalMenitTelatFromGps === 'function' ? getTotalMenitTelatFromGps(emp.id || idx, emp.name, tglAwal, tglAkhir) : 0;
            const calcGpsJam = totalMenitTelatGps > 0 ? Math.round((totalMenitTelatGps / configTelat) * 10) / 10 : 0;
            let jamTerlambat = pData.jamTerlambatManual !== undefined ? parseFloat(pData.jamTerlambatManual) : calcGpsJam;

            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${potHari || '-'}</td>`;
            row += `<td style="border:1px solid black; padding:4px; text-align:center;">${jamTerlambat || '-'}</td>`;

            row += `</tr>`;
            bodyHtml += row;
        });
    }
    tbody.innerHTML = bodyHtml;

    var rbmUser = null;
    try { rbmUser = JSON.parse(localStorage.getItem('rbm_user') || '{}'); } catch (e) {}
    var namaEl = document.getElementById('rekap_dibuat_nama');
    var jabatanEl = document.getElementById('rekap_dibuat_jabatan');
    var displayName = (rbmUser && (rbmUser.nama || rbmUser.name || rbmUser.username)) ? (rbmUser.nama || rbmUser.name || rbmUser.username) : '-';
    var displayJabatan = (rbmUser && (rbmUser.jabatan || rbmUser.role)) ? (rbmUser.jabatan || (rbmUser.role ? rbmUser.role.charAt(0).toUpperCase() + rbmUser.role.slice(1) : '')) : '-';
    if (namaEl) namaEl.textContent = displayName;
    if (jabatanEl) jabatanEl.textContent = displayJabatan;
}

function generateKodeSetupAbsensi() {
    var outletId = typeof getRbmOutlet === 'function' ? getRbmOutlet() : (document.getElementById('rbm-outlet-select') && document.getElementById('rbm-outlet-select').value) || '';
    if (!outletId) {
        alert('Pilih outlet terlebih dahulu.');
        return;
    }
    var names = JSON.parse(localStorage.getItem('rbm_outlet_names') || '{}');
    var outletName = names[outletId] || (outletId.charAt(0).toUpperCase() + outletId.slice(1));
    var employees = [];
    try {
        var key = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_EMPLOYEES') : 'RBM_EMPLOYEES_' + outletId;
        employees = getCachedParsedStorage(key, []);
    } catch (e) {}
    var payload = { outletId: outletId, outletName: outletName, employees: employees };
    var kode = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(kode).then(function() {
            alert('Kode Setup telah disalin ke clipboard. Berikan ke karyawan untuk paste di halaman Absensi GPS saat diminta.');
        }).catch(function() {
            prompt('Salin kode berikut dan kirim ke karyawan:', kode);
        });
    } else {
        prompt('Salin kode berikut dan kirim ke karyawan:', kode);
    }
}

function printRekapAbsensiArea() {
    const printContent = document.getElementById('printable-rekap-area').innerHTML;
    const printWindow = window.open('', '', 'height=600,width=900');
    if (!printWindow) { alert('Izinkan pop-up untuk mencetak.'); return; }
    
    const html = `<html><head><title>Print Rekap Absensi</title>
    <style>
      @media print { @page { size: landscape; margin: 10mm; } body { zoom: 0.65; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      body { font-family: sans-serif; padding: 20px; color: #000; }
      table { width: 100% !important; border-collapse: collapse; }
      th, td { white-space: nowrap; padding: 4px; border: 1px solid #ccc; text-align: center; }
    </style>
    </head><body>${printContent}</body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

function resizeInput(el) {
    // Minimal 50px (cukup untuk 3 digit), estimasi 8px per karakter + buffer
    el.style.width = Math.max(50, (el.value.length * 8) + 20) + 'px';
}

// ================= REKAP GAJI LOGIC =================
function renderRekapGaji() {
    const tglAwalEl = document.getElementById("absensi_tgl_awal");
    const tglAkhirEl = document.getElementById("absensi_tgl_akhir");
    const tglAwal = tglAwalEl ? tglAwalEl.value : '';
    const tglAkhir = tglAkhirEl ? tglAkhirEl.value : '';
    
    // --- PERBAIKAN LAYOUT TOMBOL AKSI GAJI (Menjadi 1 Baris) ---
    try {
        const allButtons = Array.from(document.querySelectorAll('button'));
        const btnSaveGaji = allButtons.find(b => b.textContent && b.textContent.includes('Simpan Perubahan'));
        const btnPrintGaji = allButtons.find(b => b.textContent && (b.textContent.includes('Print Slip/Rekap') || b.textContent.includes('PDF')));
        const btnZipGaji = allButtons.find(b => b.textContent && b.textContent.includes('Download Semua Slip (ZIP)'));
        
        const btns = [btnSaveGaji, btnZipGaji, btnPrintGaji].filter(Boolean);
        
        let wrapper = btns.length > 0 ? btns[0].parentElement : null;
        
        if (wrapper && !wrapper.classList.contains('flex-wrapper-gaji')) {
            // Hapus elemen <br> di dekat tombol agar tidak menyebabkan spasi berlebih
            btns.forEach(b => {
                if (b.previousElementSibling && b.previousElementSibling.tagName === 'BR') b.previousElementSibling.remove();
                if (b.nextElementSibling && b.nextElementSibling.tagName === 'BR') b.nextElementSibling.remove();
            });
            
            wrapper = document.createElement('div');
            wrapper.className = 'flex-wrapper-gaji';
            wrapper.style.cssText = 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 15px;';
            
            btns[0].parentNode.insertBefore(wrapper, btns[0]);
            
            btns.forEach(b => {
                b.style.width = 'auto'; // Cegah tombol mengambil 100% lebar
                b.style.margin = '0';   // Hilangkan margin bawaan yang bikin turun ke bawah
                wrapper.appendChild(b);
            });
        }

        if (wrapper && wrapper.classList.contains('flex-wrapper-gaji')) {
            // --- MENAMPILKAN KEMBALI FITUR PENGAJUAN GAJI LENGKAP KE OWNER ---
            let btnPengajuan = allButtons.find(b => b.textContent && (b.textContent.includes('Pengajuan Gaji') || b.textContent.includes('Pengajuan Petty Cash') || b.textContent.includes('Ajukan Laporan Lengkap')));
            if (!btnPengajuan) {
                btnPengajuan = document.createElement('button');
                btnPengajuan.onclick = typeof submitGajiPengajuan === 'function' ? submitGajiPengajuan : null;
            }
            btnPengajuan.textContent = 'Ajukan Laporan Lengkap (Owner)';
            btnPengajuan.className = 'btn btn-primary';
            btnPengajuan.style.cssText = 'background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 14px; cursor: pointer; width: auto; margin: 0;';
            
            // Sembunyikan div parent lamanya jika isinya kosong
            if (btnPengajuan.parentElement && btnPengajuan.parentElement.tagName === 'DIV' && !btnPengajuan.parentElement.classList.contains('flex-wrapper-gaji')) {
                if (btnPengajuan.parentElement.children.length <= 1) {
                    btnPengajuan.parentElement.style.display = 'none';
                }
            }
            
            if (!wrapper.contains(btnPengajuan)) {
                wrapper.appendChild(btnPengajuan);
            }

            // Menyembunyikan tabel riwayat pengajuan di Rekap Gaji (karena dipindah ke Pengajuan Dana)
            const tbodyRiwayat = document.getElementById('gaji_pengajuan_tbody');
            if (tbodyRiwayat) {
                let parentCard = tbodyRiwayat.closest('.table-card');
                // Hanya sembunyikan jika masih berada di dalam tab gaji
                if (parentCard && parentCard.closest('#tab-content-gaji')) {
                    parentCard.style.display = 'none';
                    const prev = parentCard.previousElementSibling; 
                    if (prev && (prev.tagName.includes('H') || prev.tagName === 'DIV')) prev.style.display = 'none';
                }
            }
        }
    } catch(e) {}
    // -----------------------------------------------------------

    if (!tglAwal || !tglAkhir) { alert("Pilih tanggal terlebih dahulu"); return; }

    // Update Header Text
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const d1 = new Date(tglAwal).toLocaleDateString('id-ID', options);
    const d2 = new Date(tglAkhir).toLocaleDateString('id-ID', options);
    document.getElementById("gaji_periode_text").innerText = `Absensi Periode ${d1} s/d ${d2}`;
    document.getElementById("gaji_sign_date").innerText = `Sidoarjo, ${new Date().toLocaleDateString('id-ID', options)}`;

    var rbmUser = null;
    try { rbmUser = JSON.parse(localStorage.getItem('rbm_user') || '{}'); } catch (e) {}
    var gajiNamaEl = document.getElementById('gaji_dibuat_nama');
    var gajiJabatanEl = document.getElementById('gaji_dibuat_jabatan');
    var displayName = (rbmUser && (rbmUser.nama || rbmUser.name || rbmUser.username)) ? (rbmUser.nama || rbmUser.name || rbmUser.username) : '-';
    var displayJabatan = (rbmUser && (rbmUser.jabatan || rbmUser.role)) ? (rbmUser.jabatan || (rbmUser.role ? rbmUser.role.charAt(0).toUpperCase() + rbmUser.role.slice(1) : '')) : '-';
    if (gajiNamaEl) gajiNamaEl.textContent = displayName;
    if (gajiJabatanEl) gajiJabatanEl.textContent = displayJabatan;

    const tbody = document.getElementById("gaji_tbody");
    const thead = document.getElementById("gaji_thead");
    const tfoot = document.getElementById("gaji_tfoot");
    
    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
    // Data Gaji Periodik (Hutang, Terlambat, dll) disimpan terpisah agar tidak hilang saat refresh
    const gajiPeriodKey = getRbmStorageKey('RBM_GAJI_' + tglAwal + '_' + tglAkhir);
    const gajiPeriodData = getCachedParsedStorage(gajiPeriodKey, {});

    // Key employee untuk menyimpan/membaca hutang-tunjangan harus stabil.
    // Prioritas: `emp.id` jika ada, jika tidak pakai `emp.name`, jika masih kosong pakai idx.
    // Tambahkan prefix agar kunci TIDAK numerik murni (firebase storage akan mengubah object numeric-key jadi array lalu "dipadatkan").
    const getGajiEmpKey = function(emp, idx) {
        if (emp && emp.id !== undefined && emp.id !== null && emp.id !== '') return 'id_' + String(emp.id);
        if (emp && emp.name) return 'name_' + String(emp.name).replace(/[.#$\[\]]/g, '_');
        return 'idx_' + String(idx);
    };
    
    // Ambil konfigurasi menit telat dari settings
    const configTelat = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : MENIT_TELAT_PER_JAM_GAJI;

    // Generate Dates for counting
    let curr = new Date(tglAwal);
    const end = new Date(tglAkhir);
    const dates = [];
    while (curr <= end) { dates.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }

    // Header (NO dan NAMA dibekukan saat scroll horizontal)
    thead.innerHTML = `
        <tr style="background:#1e40af; color:white;">
            <th rowspan="2" style="border:1px solid #ccc; padding:4px; position:sticky; left:0; z-index:11; background:#1e40af; min-width:40px;">NO</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px; position:sticky; left:40px; z-index:11; background:#1e40af; min-width:120px;">NAMA</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">JABATAN</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">BANK</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">NO REK</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">HK<br>TARGET</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">HK<br>AKTUAL</th>
            <th colspan="8" style="border:1px solid #ccc; padding:4px;">ABSENSI</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">GAJI POKOK</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">GAJI/HARI</th>
            <th colspan="2" style="border:1px solid #ccc; padding:4px;">POTONGAN KEHADIRAN</th>
            <th colspan="3" style="border:1px solid #ccc; padding:4px;">KETERLAMBATAN</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">HUTANG</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">UANG MAKAN</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">TUNJANGAN</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">GRAND TOTAL</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">PEMBAYARAN</th>
            <th rowspan="2" style="border:1px solid #ccc; padding:4px;">AKSI</th>
        </tr>
        <tr style="background:#3b82f6; color:white; font-size:9px;">
            <th>A</th><th>I</th><th>S</th><th>OFF</th><th>DP</th><th>PH</th><th>AL</th><th>JML</th>
            <th>HARI</th><th>Rp</th>
            <th>JAM</th><th>RATE/JAM</th><th>TOTAL</th>
        </tr>
    `;

    let totalGrand = 0;
    let html = '';

    employees.forEach((emp, idx) => {
        const empKey = getGajiEmpKey(emp, idx);
        const empKeyAttr = String(empKey).replace(/"/g, '&quot;');
        // 1. Hitung Absensi
        let counts = { H:0, A:0, I:0, S:0, OFF:0, DP:0, PH:0, AL:0 };
        dates.forEach(d => {
            const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
            const status = absensiData[key];
            
            let countKey = status;
            if (status === 'O') countKey = 'OFF';

            if (status && counts.hasOwnProperty(countKey)) {
                counts[countKey]++;
            }
        });

        // 2. Ambil Data Tersimpan / Default
        const pData = gajiPeriodData[empKey] || {};
        const totalMenitTelatGps = getTotalMenitTelatFromGps(emp.id || idx, emp.name, tglAwal, tglAkhir);
        const calcGpsJam = totalMenitTelatGps > 0 ? Math.round((totalMenitTelatGps / configTelat) * 10) / 10 : 0;
        let jamTerlambat = pData.jamTerlambatManual !== undefined ? parseFloat(pData.jamTerlambatManual) : calcGpsJam;
        
        // Static Data (Save to Employee Object)
        const bank = emp.bank || '';
        const noRek = emp.noRek || '';
        const gajiPokok = parseInt(emp.gajiPokok) || 0;
        
        // Period Data (Save to Period Object)
        const hkTarget = pData.hkTarget !== undefined ? parseInt(pData.hkTarget) : 26;
        const potHari = pData.potHari !== undefined ? parseFloat(pData.potHari) : 0; // Default 0
        const hutang = pData.hutang !== undefined ? parseInt(pData.hutang) : 0;
        const tunjangan = pData.tunjangan !== undefined ? parseInt(pData.tunjangan) : 0;
        const metodeBayar = pData.metodeBayar || 'TF';

        // 3. Rumus Perhitungan
        const gajiPerHari = Math.round(gajiPokok / 30); // Rumus: GP / 30
        const potTerlambatPerJam = Math.round(gajiPokok / 240); // Rumus: GP / 240
        const uangMakan = counts.H * 10000; // Rumus: HK Aktual * 10.000
        
        const totalPotKehadiran = Math.round(potHari * gajiPerHari);
        const totalPotTerlambat = Math.round(jamTerlambat * potTerlambatPerJam);
        
        const grandTotal = gajiPokok - totalPotKehadiran - totalPotTerlambat - hutang + uangMakan + tunjangan;
        totalGrand += grandTotal;

        // Hitung lebar awal berdasarkan isi data
        const wBank = Math.max(60, (bank.length * 8) + 15);
        const wRek = Math.max(80, (noRek.length * 8) + 15);
        const wHK = Math.max(50, (String(hkTarget).length * 8) + 20);
        const wGP = Math.max(90, (String(gajiPokok).length * 8) + 15);
        const wPot = Math.max(50, (String(potHari).length * 8) + 20);
        const wJam = Math.max(50, (String(jamTerlambat).length * 8) + 20);
        const wHutang = Math.max(80, (String(hutang).length * 8) + 15);
        const wTunj = Math.max(80, (String(tunjangan).length * 8) + 15);

        // 4. Render Row (NO dan NAMA sticky) - simpan hanya saat klik Simpan Perubahan
        html += `<tr data-emp-index="${idx}" data-emp-id="${empKeyAttr}">
            <td style="text-align:center; position:sticky; left:0; background:white; z-index:5; border:1px solid #ccc;">${idx + 1}</td>
            <td style="position:sticky; left:40px; background:white; z-index:5; border:1px solid #ccc;">${emp.name}</td>
            <td>${emp.jabatan}</td>
            <td><input type="text" data-field="bank" value="${bank}" oninput="resizeInput(this)" style="width:${wBank}px; border:none; font-size:10px; padding:5px;"></td>
            <td><input type="text" data-field="noRek" value="${noRek}" oninput="resizeInput(this)" style="width:${wRek}px; border:none; font-size:10px; padding:5px;"></td>
            <td><input type="number" data-field="hkTarget" value="${hkTarget}" oninput="resizeInput(this)" style="width:${wHK}px; text-align:center; padding:5px;"></td>
            <td style="text-align:center; font-weight:bold;">${counts.H}</td>
            
            <!-- Absensi Counts -->
            <td style="text-align:center; font-size:9px;">${counts.A||'-'}</td>
            <td style="text-align:center; font-size:9px;">${counts.I||'-'}</td>
            <td style="text-align:center; font-size:9px;">${counts.S||'-'}</td>
            <td style="text-align:center; font-size:9px;">${counts.OFF||'-'}</td>
            <td style="text-align:center; font-size:9px;">${counts.DP||'-'}</td>
            <td style="text-align:center; font-size:9px;">${counts.PH||'-'}</td>
            <td style="text-align:center; font-size:9px;">${counts.AL||'-'}</td>
            <td style="text-align:center; font-size:9px;">${dates.length}</td>

            <!-- Financials -->
            <td><input type="text" data-field="gajiPokok" value="${formatRupiah(gajiPokok)}" oninput="resizeInput(this)" style="width:${wGP}px; text-align:right; padding:5px;"></td>
            <td style="text-align:right;">${formatRupiah(gajiPerHari)}</td>
            
            <!-- Potongan Kehadiran -->
            <td><input type="number" data-field="potHari" value="${potHari}" oninput="resizeInput(this)" style="width:${wPot}px; text-align:center; padding:5px;" placeholder="0"></td>
            <td style="text-align:right;">${formatRupiah(totalPotKehadiran)}</td>

            <!-- Keterlambatan -->
            <td><input type="number" data-field="jamTerlambat" value="${jamTerlambat}" oninput="resizeInput(this); this.setAttribute('data-edited', 'true');" style="width:${wJam}px; text-align:center; padding:5px;" placeholder="0"></td>
            <td style="text-align:right; font-size:9px;">${formatRupiah(potTerlambatPerJam)}</td>
            <td style="text-align:right;">${formatRupiah(totalPotTerlambat)}</td>

            <!-- Lainnya -->
            <td><input type="text" data-field="hutang" value="${formatRupiah(hutang)}" oninput="resizeInput(this)" style="width:${wHutang}px; text-align:right; padding:5px;" placeholder="Rp 0"></td>
            <td style="text-align:right;">${formatRupiah(uangMakan)}</td>
            <td><input type="text" data-field="tunjangan" value="${formatRupiah(tunjangan)}" oninput="resizeInput(this)" style="width:${wTunj}px; text-align:right; padding:5px;" placeholder="Rp 0"></td>
            
            <td style="text-align:right; font-weight:bold; background:#e0f2fe;">${formatRupiah(grandTotal)}</td>
            <td>
                <select data-field="metodeBayar" style="width:50px; font-size:10px; padding:0;">
                    <option value="TF" ${metodeBayar==='TF'?'selected':''}>TF</option>
                    <option value="CASH" ${metodeBayar==='CASH'?'selected':''}>CASH</option>
                </select>
            </td>
            <td>
                <button class="btn-small-danger" style="background:#0d6efd; border:none; padding: 5px 8px;" onclick="generateAndShowSlip(${idx})">Slip</button>
                <button class="btn-small-danger" style="background:#198754; border:none; padding: 5px 8px; margin-left:4px;" onclick="sendSlipEmail(${idx})">Email</button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
    tfoot.innerHTML = `<tr><td colspan="28" style="text-align:right; font-weight:bold; padding:10px;">TOTAL PENGELUARAN GAJI: ${formatRupiah(totalGrand)}</td><td></td></tr>`;
}

async function saveRekapGajiData() {
    var tglAwalEl = document.getElementById('absensi_tgl_awal');
    var tglAkhirEl = document.getElementById('absensi_tgl_akhir');
    var tglAwal = tglAwalEl ? tglAwalEl.value : '';
    var tglAkhir = tglAkhirEl ? tglAkhirEl.value : '';
    if (!tglAwal || !tglAkhir) {
        alert('Pilih periode tanggal terlebih dahulu.');
        return;
    }
    var parseRp = function(str) { return parseInt(String(str || '0').replace(/[^0-9]/g, ''), 10) || 0; };
    var employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    var gajiKey = getRbmStorageKey('RBM_GAJI_' + tglAwal + '_' + tglAkhir);
    var gajiData = getCachedParsedStorage(gajiKey, {});
    var tbody = document.getElementById('gaji_tbody');
    if (!tbody || !tbody.rows) {
        alert('Tabel rekap gaji tidak ditemukan.');
        return;
    }
    for (var r = 0; r < tbody.rows.length; r++) {
        var tr = tbody.rows[r];
        var empIdx = parseInt(tr.getAttribute('data-emp-index'), 10);
        // Kunci employee untuk gaji periodik harus konsisten dengan render:
        // render pakai `emp.id || idx` (bisa string/non-numeric), jadi jangan dipaksa parseInt.
        var empId = tr.getAttribute('data-emp-id');
        if (isNaN(empIdx) || !employees[empIdx]) continue;
        if (empId === null || empId === undefined || empId === '') empId = String(empIdx);
        var inpBank = tr.querySelector('input[data-field="bank"]');
        var inpNoRek = tr.querySelector('input[data-field="noRek"]');
        var inpGajiPokok = tr.querySelector('input[data-field="gajiPokok"]');
        var inpHkTarget = tr.querySelector('input[data-field="hkTarget"]');
        var inpPotHari = tr.querySelector('input[data-field="potHari"]');
        var inpJamTerlambat = tr.querySelector('input[data-field="jamTerlambat"]');
        var inpHutang = tr.querySelector('input[data-field="hutang"]');
        var inpTunjangan = tr.querySelector('input[data-field="tunjangan"]');
        var selMetode = tr.querySelector('select[data-field="metodeBayar"]');
        if (inpBank) employees[empIdx].bank = inpBank.value || '';
        if (inpNoRek) employees[empIdx].noRek = inpNoRek.value || '';
        if (inpGajiPokok) employees[empIdx].gajiPokok = parseRp(inpGajiPokok.value);
        if (!gajiData[empId]) gajiData[empId] = {};
        if (inpHkTarget) gajiData[empId].hkTarget = parseInt(inpHkTarget.value, 10) || 0;
        if (inpPotHari) gajiData[empId].potHari = parseFloat(inpPotHari.value) || 0;
        if (inpJamTerlambat) {
            if (inpJamTerlambat.getAttribute('data-edited') === 'true') {
                gajiData[empId].jamTerlambatManual = parseFloat(inpJamTerlambat.value) || 0;
                var valStr = inpJamTerlambat.value.trim();
                if (valStr === '') {
                    delete gajiData[empId].jamTerlambatManual; // Lepas pengunci manual agar kembali otomatis (GPS)
                } else {
                    gajiData[empId].jamTerlambatManual = parseFloat(valStr) || 0;
                }
            }
            delete gajiData[empId].jamTerlambat; // Bersihkan data nyangkut lama
        }
        if (inpHutang) gajiData[empId].hutang = parseRp(inpHutang.value);
        if (inpTunjangan) gajiData[empId].tunjangan = parseRp(inpTunjangan.value);
        if (selMetode) gajiData[empId].metodeBayar = selMetode.value || 'TF';
    }
    try {
        // Simpan ke cache memory dan local storage DULU agar instan
        window._rbmParsedCache[getRbmStorageKey('RBM_EMPLOYEES')] = { data: employees };
        window._rbmParsedCache[gajiKey] = { data: gajiData };
        try { localStorage.setItem(getRbmStorageKey('RBM_EMPLOYEES'), JSON.stringify(employees)); } catch(e){}
        try { localStorage.setItem(gajiKey, JSON.stringify(gajiData)); } catch(e){}

        // Proses tulis ke server secara paralel + tunggu hasil agar status simpan akurat.
        var saveResults = await Promise.allSettled([
            RBMStorage.setItem(getRbmStorageKey('RBM_EMPLOYEES'), JSON.stringify(employees)),
            RBMStorage.setItem(gajiKey, JSON.stringify(gajiData))
        ]);
        var hasFailedSave = saveResults.some(function(r) { return r.status === 'rejected'; });
        if (hasFailedSave) {
            console.warn('Sebagian data gagal sinkron ke server, data lokal tetap tersimpan.', saveResults);
            alert('Data tersimpan di perangkat, tetapi sinkron server gagal. Coba Simpan lagi saat koneksi stabil.');
            return;
        }

        alert('Data Rekap Gaji tersimpan.');
    } catch (e) {
        console.error(e);
        alert('Gagal menyimpan Data Rekap Gaji. Cek koneksi / storage.');
    }
}

// -----------------------------
// PENGAJUAN GAJI (Owner & Manager)
// -----------------------------
function _getAbsensiGajiPeriod() {
    const tglAwal = document.getElementById('absensi_tgl_awal') ? document.getElementById('absensi_tgl_awal').value : '';
    const tglAkhir = document.getElementById('absensi_tgl_akhir') ? document.getElementById('absensi_tgl_akhir').value : '';
    if (!tglAwal || !tglAkhir) return null;
    return { tglAwal, tglAkhir, monthKey: String(tglAkhir).slice(0, 7) };
}

function _getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('rbm_user') || '{}'); } catch(e) { return {}; }
}

let pendingPengajuanAction = null;

function openRekeningPencairanModal(actionCallback) {
    const outletId = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || 'default';
    let savedRek = {bank: '', rekening: '', atasnama: ''};
    try { savedRek = JSON.parse(localStorage.getItem('RBM_PC_REK_INFO_' + outletId)) || savedRek; } catch(e){}
    
    const b = document.getElementById('confirm_rek_bank');
    const r = document.getElementById('confirm_rek_no');
    const a = document.getElementById('confirm_rek_nama');
    
    const m = document.getElementById('rekeningPencairanModal');
    if (m) {
        if (b) b.value = 'Memuat...';
        if (r) r.value = 'Memuat...';
        if (a) a.value = 'Memuat...';
        pendingPengajuanAction = actionCallback;
        m.style.display = 'flex';
    }

    const finish = function() {
        if (m) {
            if (b) b.value = savedRek.bank || '';
            if (r) r.value = savedRek.rekening || '';
            if (a) a.value = savedRek.atasnama || '';
        } else if (actionCallback) {
            actionCallback(savedRek);
        }
    };

    if (typeof firebase !== 'undefined' && firebase.database) {
        firebase.database().ref('customer_app_settings/outlets').once('value').then(function(snap) {
            var o = snap.val();
            var list = o ? (Array.isArray(o) ? o : Object.values(o)) : [];
            var data = list.find(function(i) { return i && i.id === outletId; });
            if (data && (data.bank || data.rekening || data.atasnama)) {
                savedRek = { bank: data.bank || '', rekening: data.rekening || '', atasnama: data.atasnama || '' };
                localStorage.setItem('RBM_PC_REK_INFO_' + outletId, JSON.stringify(savedRek));
            }
            finish();
        }).catch(function(){ finish(); });
    } else {
        finish();
    }
}

function closeRekeningPencairanModal() {
    const m = document.getElementById('rekeningPencairanModal');
    if (m) m.style.display = 'none';
    pendingPengajuanAction = null;
}

function processPengajuanWithRekening() {
    const b = document.getElementById('confirm_rek_bank');
    const r = document.getElementById('confirm_rek_no');
    const a = document.getElementById('confirm_rek_nama');
    const bank = b ? b.value.trim() : '';
    const rekening = r ? r.value.trim() : '';
    const atasnama = a ? a.value.trim() : '';
    
    
    closeRekeningPencairanModal();
    if (pendingPengajuanAction) pendingPengajuanAction({bank, rekening, atasnama});
}

async function submitGajiPengajuan() {
    const period = _getAbsensiGajiPeriod();
    if (!period) return alert('Pilih periode tanggal terlebih dahulu (Absensi Tanggal Mulai/Selesai).');

    if (typeof FirebaseStorage === 'undefined' || !FirebaseStorage.init || !FirebaseStorage.init()) {
        return alert('Pengajuan Gaji hanya tersedia di mode Online (Firebase).');
    }

    openRekeningPencairanModal(async (rekInfo) => {
        try {
            const outletId = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || 'default';
            const { tglAwal, tglAkhir, monthKey } = period;

            const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
            const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
            const jadwalData = getCachedParsedStorage(getRbmStorageKey('RBM_JADWAL_DATA'), {});
            const gajiKey = getRbmStorageKey('RBM_GAJI_' + tglAwal + '_' + tglAkhir);
            const gajiPeriodData = getCachedParsedStorage(gajiKey, {});
            
            const allGpsLogs = getCachedParsedStorage(getRbmStorageKey('RBM_GPS_LOGS'), []);
            const gpsLogsLight = allGpsLogs.filter(l => l.date >= tglAwal && l.date <= tglAkhir).map(l => ({
                date: l.date, name: l.name, type: l.type, time: l.time
            }));

            if (!Array.isArray(employees) || employees.length === 0) return alert('Tidak ada data karyawan untuk periode ini.');

            const end = new Date(tglAkhir);
            let curr = new Date(tglAwal);
            const dates = [];
            while (curr <= end) {
                dates.push(new Date(curr));
                curr.setDate(curr.getDate() + 1);
            }

            let totalGrand = 0;
            const items = [];

            employees.forEach((emp, idx) => {
                const empKey = emp && emp.id != null && emp.id !== '' ? ('id_' + String(emp.id)) : (emp && emp.name ? ('name_' + String(emp.name).replace(/[.#$\[\]]/g, '_')) : ('idx_' + String(idx)));
                // Key absensi historis (RBM_ABSENSI_DATA) tidak memakai prefix id_/name_/idx_.
                // Ini harus konsisten dengan cara rekap absensi & rekap gaji menghitung HK Aktual.
                const empKeyAbsensi = (emp && emp.id != null && emp.id !== '') ? String(emp.id) : String(idx);
                const pData = gajiPeriodData[empKey] || {};

                const configTelat = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : 10;
                const gajiPokok = parseInt(emp.gajiPokok) || 0;
                const potHari = pData.potHari !== undefined ? parseFloat(pData.potHari) : 0;
                const totalMenitTelatGps = typeof getTotalMenitTelatFromGps === 'function' ? getTotalMenitTelatFromGps(emp.id || idx, emp.name, tglAwal, tglAkhir) : 0;
                const calcGpsJam = totalMenitTelatGps > 0 ? Math.round((totalMenitTelatGps / configTelat) * 10) / 10 : 0;
                let jamTerlambat = pData.jamTerlambatManual !== undefined ? parseFloat(pData.jamTerlambatManual) : calcGpsJam;
                const hutang = pData.hutang !== undefined ? parseInt(pData.hutang) : 0;
                const tunjangan = pData.tunjangan !== undefined ? parseInt(pData.tunjangan) : 0;
                const metodeBayar = pData.metodeBayar || 'TF';

                let jumlahH = 0;
                dates.forEach(d => {
                    const dateKey = getLocalDateKey(d);
                    const absKey = `${dateKey}_${empKeyAbsensi}`;
                    if (absensiData[absKey] === 'H') jumlahH++;
                });

                const gajiPerHari = Math.round(gajiPokok / 30);
                const potTerlambatPerJam = Math.round(gajiPokok / 240);
                const uangMakan = jumlahH * 10000;

                const totalPotKehadiran = Math.round(potHari * gajiPerHari);
                const totalPotTerlambat = Math.round(jamTerlambat * potTerlambatPerJam);

                const totalPendapatan = gajiPokok + tunjangan + uangMakan;
                const grandTotal = totalPendapatan - totalPotKehadiran - totalPotTerlambat - hutang;

                items.push({
                    empId: empKey,
                    nama: emp.name || '',
                    jabatan: emp.jabatan || '',
                    grandTotal: grandTotal,
                    metodeBayar: metodeBayar
                });
                totalGrand += Number(grandTotal) || 0;
            });

            const u = _getCurrentUser();
            const requester = (u && (u.username || u.nama)) ? (u.username || u.nama) : 'unknown';
            const note = `Pengajuan gaji periode ${tglAwal} s/d ${tglAkhir}`;

            const feedbackEl = document.getElementById('gaji_pengajuan_feedback');
            if (feedbackEl) {
                feedbackEl.textContent = 'Mengajukan...';
                feedbackEl.style.color = '#1d4ed8';
            }

            const res = await FirebaseStorage.saveGajiPengajuan({
                outletId: outletId,
                monthKey: monthKey,
                periodStart: tglAwal,
                periodEnd: tglAkhir,
                requester: requester,
                totalGrand: totalGrand,
                bank: rekInfo.bank,
                rekening: rekInfo.rekening,
                atasnama: rekInfo.atasnama
            }, items);

            let reqId = res ? (res.requestId || res.id || res.key) : null;
            if (!reqId && typeof res === 'string') reqId = res;
            
            if (reqId && typeof firebase !== 'undefined' && firebase.database) {
                try {
                    await firebase.database().ref(`rbm_pro/gaji_pengajuan/${outletId}/${monthKey}/${reqId}`).update({
                        snapshot: JSON.stringify({
                            employees: employees,
                            absensiData: absensiData,
                            jadwalData: jadwalData,
                            gajiData: gajiPeriodData,
                            gpsLogs: gpsLogsLight
                        })
                    });
                } catch(e) { console.warn('Gagal inject snapshot:', e); }
            }

            if (feedbackEl) {
                feedbackEl.textContent = 'Sukses mengajukan. ID: ' + (reqId || '-');
                feedbackEl.style.color = '#16a34a';
            }
            
            if (window.self !== window.top) {
                window.parent.postMessage({ type: 'REFRESH_NOTIFS' }, '*');
            }

            loadRiwayatGajiPengajuan({ reset: true });
        } catch (e) {
            console.error(e);
            const feedbackEl = document.getElementById('gaji_pengajuan_feedback');
            if (feedbackEl) {
                feedbackEl.textContent = 'Gagal mengajukan: ' + (e && e.message ? e.message : String(e));
                feedbackEl.style.color = '#dc2626';
            } else {
                alert('Gagal mengajukan: ' + (e && e.message ? e.message : String(e)));
            }
        }
    });
}

async function loadRiwayatGajiPengajuan(opts) {
    opts = opts || {};
    const feedbackEl = document.getElementById('gaji_pengajuan_feedback');
    const tbody = document.getElementById('gaji_pengajuan_tbody');
    const btnMore = document.getElementById('gaji_pengajuan_load_more_btn');
    if (!tbody) return;

    const period = _getAbsensiGajiPeriod();
    if (!period) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Pilih periode tanggal dulu.</td></tr>';
        return;
    }

    const outletId = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || 'default';
    const { monthKey } = period;
    const limit = 15;

    if (opts.reset) {
        window._gajiPengajuanCursorKey = null;
        tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Memuat riwayat...</td></tr>';
    }

    if (feedbackEl) {
        feedbackEl.textContent = opts && opts.loadMore ? 'Memuat lebih lama...' : 'Memuat riwayat...';
        feedbackEl.style.color = '#64748b';
    }

    if (btnMore) btnMore.disabled = true;

    try {
        const cursorKey = window._gajiPengajuanCursorKey || null;
        const result = await FirebaseStorage.getGajiPengajuanPage(outletId, monthKey, limit, cursorKey);
        const rows = (result && result.items) ? result.items : [];

        if (opts.reset && rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Belum ada riwayat pengajuan.</td></tr>';
        } else {
            const html = rows.map(r => {
                const d = r.createdAt ? new Date(r.createdAt) : null;
                const tgl = d ? d.toLocaleDateString('id-ID') : '-';
                const statusOwner = r.statusOwner || '-';
                const statusManager = r.statusManager || '-';
                const canApproveOwner = (function() {
                    const u = _getCurrentUser();
                    return u && String(u.role || '').toLowerCase() === 'owner' && statusOwner !== 'approved';
                })();
                const canApproveManager = (function() {
                    const u = _getCurrentUser();
                    return u && String(u.role || '').toLowerCase() === 'manager' && statusManager !== 'approved';
                })();

                const approveBtns = [];
                approveBtns.push(`<button class="btn btn-secondary" style="padding:5px 8px; margin-right:6px; background:#3b82f6; color:white; border:none;" onclick="viewPengajuanDetail('${r.periodStart}', '${r.periodEnd}')">Lihat Detail Laporan</button>`);
                if (canApproveOwner) approveBtns.push(`<button class="btn btn-secondary" style="padding:5px 8px; margin-right:6px; background:#10b981; color:white; border:none;" onclick="approveGajiPengajuan('${r.requestId}','owner')">Setujui Owner</button>`);
                if (canApproveManager) approveBtns.push(`<button class="btn btn-secondary" style="padding:5px 8px; background:#f59e0b; color:white; border:none;" onclick="approveGajiPengajuan('${r.requestId}','manager')">Setujui Manager</button>`);

                return `
                  <tr>
                    <td>${tgl}</td>
                    <td>${r.periodStart || '-'} s/d ${r.periodEnd || '-'}</td>
                    <td style="text-align:right; font-weight:600;">${formatRupiah(r.totalGrand || 0)}</td>
                    <td>${statusOwner}</td>
                    <td>${statusManager}</td>
                    <td>${approveBtns.length ? approveBtns.join('') : '-'}</td>
                  </tr>
                `;
            }).join('');

            if (opts.reset) tbody.innerHTML = html;
            else tbody.insertAdjacentHTML('beforeend', html);
        }

        // set cursor for pagination older
        if (result && result.nextCursorKey) {
            window._gajiPengajuanCursorKey = result.nextCursorKey;
        }
        // Hide "Muat Lebih Lama" kalau ternyata tidak ada data tambahan.
        if (btnMore) {
            var hasMore = !!(result && result.hasMore);
            btnMore.disabled = !hasMore;
            btnMore.style.display = hasMore ? '' : 'none';
        }

        if (feedbackEl) {
            feedbackEl.textContent = 'Selesai.';
            feedbackEl.style.color = '#16a34a';
        }
    } catch (e) {
        console.error(e);
        if (feedbackEl) {
            feedbackEl.textContent = 'Gagal memuat riwayat: ' + (e && e.message ? e.message : String(e));
            feedbackEl.style.color = '#dc2626';
        }
        if (btnMore) {
            btnMore.disabled = true;
            btnMore.style.display = 'none';
        }
    }
}

async function approveGajiPengajuan(requestId, role) {
    try {
        const period = _getAbsensiGajiPeriod();
        if (!period) return alert('Pilih periode dulu.');
        const outletId = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || 'default';
        const monthKey = period.monthKey;
        if (!requestId) return;

        const feedbackEl = document.getElementById('gaji_pengajuan_feedback');
        if (feedbackEl) { feedbackEl.textContent = 'Memproses approval...'; feedbackEl.style.color = '#1d4ed8'; }

        await FirebaseStorage.setGajiPengajuanApproval(outletId, monthKey, requestId, role);

        if (feedbackEl) { feedbackEl.textContent = 'Approval berhasil.'; feedbackEl.style.color = '#16a34a'; }
        loadRiwayatGajiPengajuan({ reset: true });
    } catch (e) {
        console.error(e);
        const feedbackEl = document.getElementById('gaji_pengajuan_feedback');
        if (feedbackEl) { feedbackEl.textContent = 'Gagal approval: ' + (e && e.message ? e.message : String(e)); feedbackEl.style.color = '#dc2626'; }
        else alert('Gagal approval: ' + (e && e.message ? e.message : String(e)));
    }
}

function updateEmpGaji(idx, field, val) {
    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    if (employees[idx]) {
        if (field === 'gajiPokok') {
            employees[idx][field] = parseInt(String(val).replace(/[^0-9]/g, '')) || 0;
        } else {
            employees[idx][field] = val;
        }
        RBMStorage.setItem(getRbmStorageKey('RBM_EMPLOYEES'), JSON.stringify(employees));
        window._rbmParsedCache[getRbmStorageKey('RBM_EMPLOYEES')] = { data: employees };
        renderRekapGaji(); // Recalculate
    }
}

function updatePeriodGaji(start, end, empId, field, val) {
    const key = getRbmStorageKey('RBM_GAJI_' + start + '_' + end);
    const data = getCachedParsedStorage(key, {});
    if (!data[empId]) data[empId] = {};
    if (['hutang', 'tunjangan'].includes(field)) {
        data[empId][field] = parseInt(String(val).replace(/[^0-9]/g, '')) || 0;
    } else {
        data[empId][field] = val;
    }
    RBMStorage.setItem(key, JSON.stringify(data));
    window._rbmParsedCache[key] = { data: data };
    renderRekapGaji(); // Recalculate
}

function printRekapGaji() {
    const printContent = document.getElementById('printable-gaji-area').innerHTML;
    const printWindow = window.open('', '', 'height=600,width=900');
    if (!printWindow) { alert('Izinkan pop-up untuk mencetak.'); return; }
    
    const html = `<html><head><title>Print Rekap Gaji</title>
    <style>
      @media print { @page { size: landscape; margin: 10mm; } body { zoom: 0.6; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      body { font-family: sans-serif; padding: 20px; color: #000; }
      table { width: 100% !important; border-collapse: collapse; }
      th, td { white-space: nowrap; padding: 4px; border: 1px solid #ccc; text-align: center; }
    </style>
    </head><body>${printContent}</body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

function saveRekapGajiToJpg() {
    let area = null;
    const activeModal = document.querySelector('.modal-overlay[style*="display: flex"] .modal-content');
    if (activeModal) {
        area = activeModal.querySelector('#printable-gaji-area') || activeModal;
    } else {
        area = document.getElementById('printable-gaji-area');
    }
    if (!area) { alert('Area laporan tidak ditemukan.'); return; }
    
    const tglAwal = document.getElementById("absensi_tgl_awal") ? document.getElementById("absensi_tgl_awal").value : 'Laporan';
    const tglAkhir = document.getElementById("absensi_tgl_akhir") ? document.getElementById("absensi_tgl_akhir").value : 'Gaji';
    const filename = `Laporan_Gaji_${tglAwal}_sd_${tglAkhir}.jpg`;

    html2canvas(area, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
        const a = document.createElement('a');
        a.href = canvas.toDataURL("image/jpeg", 0.9);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }).catch(err => { alert("Gagal menyimpan JPG: " + err); });
}

let currentSlipIdx = -1;

function generateAndShowSlip(idx) {
    currentSlipIdx = idx;
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    
    if (!tglAwal || !tglAkhir) { alert("Tanggal pada halaman rekap gaji belum diatur."); return; }

    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    const emp = employees[idx];
    if (!emp) { alert("Karyawan tidak ditemukan."); return; }

    const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
    const gajiPeriodKey = getRbmStorageKey('RBM_GAJI_' + tglAwal + '_' + tglAkhir);
    const gajiPeriodData = getCachedParsedStorage(gajiPeriodKey, {});

    // --- Start of calculation logic (copied & adapted from renderRekapGaji) ---
    let curr = new Date(tglAwal);
    const end = new Date(tglAkhir);
    const dates = [];
    while (curr <= end) { dates.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }

    let counts = { H:0, A:0, I:0, S:0, OFF:0, DP:0, PH:0, AL:0 };
    dates.forEach(d => {
        const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
        const status = absensiData[key];
        if (status && (counts.hasOwnProperty(status) || status === 'H')) {
            if(counts.hasOwnProperty(status)) counts[status]++;
            else if(status === 'H') counts.H++;
        }
    });

    const empKey = (emp && emp.id !== undefined && emp.id !== null && emp.id !== '') ? ('id_' + String(emp.id)) : (emp && emp.name ? ('name_' + String(emp.name).replace(/[.#$\[\]]/g, '_')) : ('idx_' + String(idx)));
    const pData = gajiPeriodData[empKey] || {};
    const configTelat = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : 10;
    const gajiPokok = parseInt(emp.gajiPokok) || 0;
    const potHari = pData.potHari !== undefined ? parseFloat(pData.potHari) : 0;
    const totalMenitTelatGps = typeof getTotalMenitTelatFromGps === 'function' ? getTotalMenitTelatFromGps(emp.id || idx, emp.name, tglAwal, tglAkhir) : 0;
    const calcGpsJam = totalMenitTelatGps > 0 ? Math.round((totalMenitTelatGps / configTelat) * 10) / 10 : 0;
    let jamTerlambat = pData.jamTerlambatManual !== undefined ? parseFloat(pData.jamTerlambatManual) : calcGpsJam;

    const hutang = pData.hutang !== undefined ? parseInt(pData.hutang) : 0;
    const tunjangan = pData.tunjangan !== undefined ? parseInt(pData.tunjangan) : 0;

    const gajiPerHari = Math.round(gajiPokok / 30);
    const potTerlambatPerJam = Math.round(gajiPokok / 240);
    const uangMakan = counts.H * 10000;
    
    const totalPotKehadiran = Math.round(potHari * gajiPerHari);
    const totalPotTerlambat = Math.round(jamTerlambat * potTerlambatPerJam);
    
    const totalPendapatan = gajiPokok + tunjangan + uangMakan; // Lembur is not implemented yet
    const grandTotal = totalPendapatan - totalPotKehadiran - totalPotTerlambat - hutang;
    // --- End of calculation logic ---

    // Populate the slip
    const options = { month: 'long', year: 'numeric' };
    const periodeText = new Date(tglAwal).toLocaleDateString('id-ID', options).toUpperCase();
    document.getElementById('slip_periode_text').innerText = `BULAN ${periodeText}`;

    document.getElementById('slip_nama').innerText = emp.name || '-';
    document.getElementById('slip_jabatan').innerText = emp.jabatan || '-';

    document.getElementById('slip_gaji_pokok').innerText = formatRupiah(gajiPokok);
    document.getElementById('slip_tunjangan').innerText = formatRupiah(tunjangan);
    document.getElementById('slip_uang_makan').innerText = formatRupiah(uangMakan);
    document.getElementById('slip_total_pendapatan').innerText = formatRupiah(totalPendapatan);

    document.getElementById('slip_pot_absensi').innerText = formatRupiah(totalPotKehadiran);
    document.getElementById('slip_pot_terlambat').innerText = formatRupiah(totalPotTerlambat);
    document.getElementById('slip_hutang').innerText = formatRupiah(hutang);
    document.getElementById('slip_grand_total').innerText = formatRupiah(grandTotal);

    showView('slip-gaji-view');
}

function printSlipGaji() {
    window.print();
}

function sendCurrentSlipEmail() {
    if (currentSlipIdx === -1) return;
    sendSlipEmail(currentSlipIdx);
}

function sendSlipEmail(idx) {
    if (!confirm("Kirim slip gaji via email ke karyawan ini?")) return;

    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    const emp = employees[idx];
    
    if (!emp || !emp.email) {
        alert("Email karyawan belum diisi. Silakan isi di tab Absensi.");
        return;
    }

    // Re-calculate for Email Body
    const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
    const gajiPeriodKey = getRbmStorageKey('RBM_GAJI_' + tglAwal + '_' + tglAkhir);
    const gajiPeriodData = getCachedParsedStorage(gajiPeriodKey, {});
    let counts = { H:0 };
    let curr = new Date(tglAwal); const end = new Date(tglAkhir);
    while (curr <= end) {
        const key = `${getLocalDateKey(curr)}_${emp.id || idx}`;
        if (absensiData[key] === 'H') counts.H++;
        curr.setDate(curr.getDate() + 1);
    }
    const empKey = (emp && emp.id !== undefined && emp.id !== null && emp.id !== '') ? ('id_' + String(emp.id)) : (emp && emp.name ? ('name_' + String(emp.name).replace(/[.#$\[\]]/g, '_')) : ('idx_' + String(idx)));
    const pData = gajiPeriodData[empKey] || {};
    const configTelat = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : 10;
    const gajiPokok = parseInt(emp.gajiPokok) || 0;
    const potHari = parseFloat(pData.potHari) || 0;
    const totalMenitTelatGps = typeof getTotalMenitTelatFromGps === 'function' ? getTotalMenitTelatFromGps(emp.id || idx, emp.name, tglAwal, tglAkhir) : 0;
    const calcGpsJam = totalMenitTelatGps > 0 ? Math.round((totalMenitTelatGps / configTelat) * 10) / 10 : 0;
    let jamTerlambat = pData.jamTerlambatManual !== undefined ? parseFloat(pData.jamTerlambatManual) : calcGpsJam;

    const hutang = parseInt(pData.hutang) || 0;
    const tunjangan = parseInt(pData.tunjangan) || 0;
    const gajiPerHari = Math.round(gajiPokok / 30);
    const potTerlambatPerJam = Math.round(gajiPokok / 240);
    const uangMakan = counts.H * 10000;
    const totalPotKehadiran = Math.round(potHari * gajiPerHari);
    const totalPotTerlambat = Math.round(jamTerlambat * potTerlambatPerJam);
    const totalPendapatan = gajiPokok + tunjangan + uangMakan;
    const grandTotal = totalPendapatan - totalPotKehadiran - totalPotTerlambat - hutang;

    const htmlBody = `
        <div style="font-family: Courier New, monospace; padding: 20px; border: 1px solid #ccc; max-width: 600px;">
            <h3 style="text-align: center; border-bottom: 2px solid black; padding-bottom: 10px;">SLIP GAJI - RICE BOWL MONSTERS</h3>
            <p>Periode: ${new Date(tglAwal).toLocaleDateString('id-ID', {month:'long', year:'numeric'})}</p>
            <table style="width:100%; margin-bottom:20px;"><tr><td>Nama</td><td>: ${emp.name}</td></tr><tr><td>Jabatan</td><td>: ${emp.jabatan}</td></tr></table>
            <table style="width:100%; border-collapse:collapse;">
                <tr><td colspan="3" style="font-weight:bold; padding-top:10px;">PENDAPATAN</td></tr>
                <tr><td>Gaji Pokok</td><td>:</td><td style="text-align:right;">${formatRupiah(gajiPokok)}</td></tr>
                <tr><td>Tunjangan</td><td>:</td><td style="text-align:right;">${formatRupiah(tunjangan)}</td></tr>
                <tr><td>Uang Makan</td><td>:</td><td style="text-align:right;">${formatRupiah(uangMakan)}</td></tr>
                <tr><td style="font-weight:bold;">Total Pendapatan</td><td>:</td><td style="text-align:right; font-weight:bold;">${formatRupiah(totalPendapatan)}</td></tr>
                <tr><td colspan="3" style="font-weight:bold; padding-top:10px;">POTONGAN</td></tr>
                <tr><td>Absensi</td><td>:</td><td style="text-align:right;">${formatRupiah(totalPotKehadiran)}</td></tr>
                <tr><td>Terlambat</td><td>:</td><td style="text-align:right;">${formatRupiah(totalPotTerlambat)}</td></tr>
                <tr><td>Hutang</td><td>:</td><td style="text-align:right;">${formatRupiah(hutang)}</td></tr>
                <tr><td colspan="3" style="border-top:2px solid black; padding-top:10px; font-weight:bold;">GRAND TOTAL: ${formatRupiah(grandTotal)}</td></tr>
            </table>
        </div>`;

    if (isGoogleScript()) {
        google.script.run.withSuccessHandler(() => alert("Email terkirim ke " + emp.email)).withFailureHandler((e) => alert("Gagal: " + e)).sendEmailSlip(emp.email, `Slip Gaji ${emp.name}`, htmlBody);
    } else {
        console.log(htmlBody);
        alert("Fitur email memerlukan backend Google Apps Script. Cek console untuk preview HTML.");
    }
}

function exportCompleteAbsensiExcel() {
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    
    if (!tglAwal || !tglAkhir) {
        alert("Harap pilih Tanggal Mulai dan Selesai di tab Absensi terlebih dahulu.");
        return;
    }

    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
    const jadwalData = getCachedParsedStorage(getRbmStorageKey('RBM_JADWAL_DATA'), {});
    const gajiKey = getRbmStorageKey('RBM_GAJI_' + tglAwal + '_' + tglAkhir);
    const gajiData = getCachedParsedStorage(gajiKey, {});

    // Generate Dates
    const dates = [];
    let curr = new Date(tglAwal);
    const end = new Date(tglAkhir);
    while (curr <= end) {
        dates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }

    const esc = (str) => {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    };

    const formatMoney = (n) => {
        if (isNaN(n) || n === null) return 'Rp 0';
        return 'Rp ' + (n || 0).toLocaleString('id-ID');
    };

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">\n';
    
    // Styles
    xml += '<Styles>\n';
    xml += ' <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders/><Font ss:FontName="Calibri" ss:Size="11"/><Interior/><NumberFormat/><Protection/></Style>\n';
    xml += ' <Style ss:ID="sTitle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="18" ss:Bold="1" ss:Color="#1e40af"/></Style>\n';
    xml += ' <Style ss:ID="sSubtitle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="12" ss:Color="#64748b"/></Style>\n';
    xml += ' <Style ss:ID="sHeader"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1e3a8a" ss:Pattern="Solid"/></Style>\n';
    xml += ' <Style ss:ID="sHeaderBlue"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2563eb" ss:Pattern="Solid"/></Style>\n';
    xml += ' <Style ss:ID="sHeaderGreen"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#16a34a" ss:Pattern="Solid"/></Style>\n';
    xml += ' <Style ss:ID="sDateHeader"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#333333"/><Interior ss:Color="#f1f5f9" ss:Pattern="Solid"/></Style>\n';
    xml += ' <Style ss:ID="sData"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>\n';
    xml += ' <Style ss:ID="sCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>\n';
    xml += ' <Style ss:ID="sNum"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><NumberFormat ss:Format="#,##0"/></Style>\n';
    xml += ' <Style ss:ID="sNumCurrency"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><NumberFormat ss:Format="&quot;Rp&quot;\\ #,##0"/></Style>\n';
    xml += ' <Style ss:ID="sTotalLabel"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1"/><Interior ss:Color="#e2e8f0" ss:Pattern="Solid"/></Style>\n';
    xml += ' <Style ss:ID="sTotalNum"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1"/><Interior ss:Color="#e2e8f0" ss:Pattern="Solid"/><NumberFormat ss:Format="&quot;Rp&quot;\\ #,##0"/></Style>\n';
    xml += '</Styles>\n';

    const absensiRekapHeaders = ['H','R','O','S','I','A','DP','PH','AL'];
    const jadwalRekapHeaders = ['P','M','S','Off','PH','AL','DP'];

    // --- SHEET 1: ABSENSI ---
    xml += `<Worksheet ss:Name="Absensi">\n<Table>\n`;
    xml += '<Column ss:Width="30"/>\n<Column ss:Width="150"/>\n<Column ss:Width="100"/>\n<Column ss:Width="80"/>\n'; // No, Nama, Jabatan, Join
    xml += '<Column ss:Width="40"/>\n<Column ss:Width="40"/>\n<Column ss:Width="40"/>\n'; // Cuti
    dates.forEach(() => xml += '<Column ss:Width="35"/>\n');
    absensiRekapHeaders.forEach(() => xml += '<Column ss:Width="35"/>\n');
    
    xml += `<Row ss:Height="25"><Cell ss:StyleID="sTitle" ss:MergeAcross="${6 + dates.length + absensiRekapHeaders.length}"><Data ss:Type="String">LAPORAN ABSENSI HARIAN</Data></Cell></Row>\n`;
    xml += `<Row ss:Height="20"><Cell ss:StyleID="sSubtitle" ss:MergeAcross="${6 + dates.length + absensiRekapHeaders.length}"><Data ss:Type="String">Periode: ${tglAwal} s/d ${tglAkhir}</Data></Cell></Row>\n`;
    xml += '<Row ss:Height="10"></Row>\n';

    xml += '<Row ss:Height="20">\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">No</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">Nama</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">Jabatan</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">Join Date</Data></Cell>\n';
    xml += `<Cell ss:StyleID="sHeaderBlue" ss:MergeAcross="2"><Data ss:Type="String">Sisa Cuti</Data></Cell>\n`;
    xml += `<Cell ss:StyleID="sHeaderGreen" ss:MergeAcross="${dates.length - 1}"><Data ss:Type="String">Tanggal</Data></Cell>\n`;
    xml += `<Cell ss:StyleID="sHeaderBlue" ss:MergeAcross="${absensiRekapHeaders.length - 1}"><Data ss:Type="String">Rekap Absensi</Data></Cell>\n`;
    xml += '</Row>\n';
    xml += '<Row ss:Height="20">\n';
    xml += '<Cell ss:StyleID="sHeaderBlue" ss:Index="5"><Data ss:Type="String">AL</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">DP</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">PH</Data></Cell>\n';
    dates.forEach(d => { xml += `<Cell ss:StyleID="sDateHeader"><Data ss:Type="String">${d.getDate()}</Data></Cell>\n`; });
    absensiRekapHeaders.forEach(h => { xml += `<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">${h}</Data></Cell>\n`; });
    xml += '</Row>\n';
    
    employees.forEach((emp, idx) => {
        let counts = {};
        absensiRekapHeaders.forEach(h => counts[h] = 0);
        xml += '<Row>\n';
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>\n<Cell ss:StyleID="sData"><Data ss:Type="String">${esc(emp.name)}</Data></Cell>\n<Cell ss:StyleID="sData"><Data ss:Type="String">${esc(emp.jabatan)}</Data></Cell>\n<Cell ss:StyleID="sCenter"><Data ss:Type="String">${esc(emp.joinDate)}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${emp.sisaAL || 0}</Data></Cell>\n<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${emp.sisaDP || 0}</Data></Cell>\n<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${emp.sisaPH || 0}</Data></Cell>\n`;
        dates.forEach(d => {
            const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
            const status = absensiData[key] || '';
            if (status && counts.hasOwnProperty(status)) counts[status]++;
            xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="String">${esc(status)}</Data></Cell>\n`;
        });
        absensiRekapHeaders.forEach(h => { xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${counts[h]}</Data></Cell>\n`; });
        xml += '</Row>\n';
    });
    xml += '</Table>\n</Worksheet>\n';

    // --- SHEET 2: JADWAL ---
    xml += `<Worksheet ss:Name="Jadwal">\n<Table>\n`;
    xml += '<Column ss:Width="30"/>\n<Column ss:Width="150"/>\n<Column ss:Width="100"/>\n<Column ss:Width="80"/>\n';
    xml += '<Column ss:Width="40"/>\n<Column ss:Width="40"/>\n<Column ss:Width="40"/>\n';
    dates.forEach(() => xml += '<Column ss:Width="35"/>\n');
    jadwalRekapHeaders.forEach(() => xml += '<Column ss:Width="35"/>\n');

    xml += `<Row ss:Height="25"><Cell ss:StyleID="sTitle" ss:MergeAcross="${6 + dates.length + jadwalRekapHeaders.length}"><Data ss:Type="String">JADWAL KERJA</Data></Cell></Row>\n`;
    xml += `<Row ss:Height="20"><Cell ss:StyleID="sSubtitle" ss:MergeAcross="${6 + dates.length + jadwalRekapHeaders.length}"><Data ss:Type="String">Periode: ${tglAwal} s/d ${tglAkhir}</Data></Cell></Row>\n`;
    xml += '<Row ss:Height="10"></Row>\n';

    xml += '<Row ss:Height="20">\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">No</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">Nama</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">Jabatan</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">Join Date</Data></Cell>\n';
    xml += `<Cell ss:StyleID="sHeaderBlue" ss:MergeAcross="2"><Data ss:Type="String">Sisa Cuti</Data></Cell>\n`;
    xml += `<Cell ss:StyleID="sHeaderGreen" ss:MergeAcross="${dates.length - 1}"><Data ss:Type="String">Tanggal</Data></Cell>\n`;
    xml += `<Cell ss:StyleID="sHeaderBlue" ss:MergeAcross="${jadwalRekapHeaders.length - 1}"><Data ss:Type="String">Rekap Jadwal</Data></Cell>\n`;
    xml += '</Row>\n';
    xml += '<Row ss:Height="20">\n';
    xml += '<Cell ss:StyleID="sHeaderBlue" ss:Index="5"><Data ss:Type="String">AL</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">DP</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">PH</Data></Cell>\n';
    dates.forEach(d => { xml += `<Cell ss:StyleID="sDateHeader"><Data ss:Type="String">${d.getDate()}</Data></Cell>\n`; });
    jadwalRekapHeaders.forEach(h => { xml += `<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">${h}</Data></Cell>\n`; });
    xml += '</Row>\n';

    employees.forEach((emp, idx) => {
        let counts = {};
        jadwalRekapHeaders.forEach(h => counts[h] = 0);
        xml += '<Row>\n';
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>\n<Cell ss:StyleID="sData"><Data ss:Type="String">${esc(emp.name)}</Data></Cell>\n<Cell ss:StyleID="sData"><Data ss:Type="String">${esc(emp.jabatan)}</Data></Cell>\n<Cell ss:StyleID="sCenter"><Data ss:Type="String">${esc(emp.joinDate)}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${emp.sisaAL || 0}</Data></Cell>\n<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${emp.sisaDP || 0}</Data></Cell>\n<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${emp.sisaPH || 0}</Data></Cell>\n`;
        dates.forEach(d => {
            const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
            const status = jadwalData[key] || '';
            if (status && counts.hasOwnProperty(status)) counts[status]++;
            xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="String">${esc(status)}</Data></Cell>\n`;
        });
        jadwalRekapHeaders.forEach(h => { xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${counts[h]}</Data></Cell>\n`; });
        xml += '</Row>\n';
    });
    xml += '</Table>\n</Worksheet>\n';

    // --- SHEET 3: LAPORAN ABSEN ---
    const rekapAbsenHeaders = ['A', 'I', 'S', 'OFF', 'DP', 'PH', 'AL', 'JML'];
    xml += `<Worksheet ss:Name="Laporan Absen">\n<Table>\n`;
    xml += '<Column ss:Width="30"/>\n<Column ss:Width="80"/>\n<Column ss:Width="150"/>\n<Column ss:Width="100"/>\n'; // No, ID, Nama, Jabatan
    dates.forEach(() => xml += '<Column ss:Width="30"/>\n');
    xml += '<Column ss:Width="60"/>\n<Column ss:Width="60"/>\n'; // Total HK, Sisa Cuti
    rekapAbsenHeaders.forEach(() => xml += '<Column ss:Width="35"/>\n');
    xml += '<Column ss:Width="60"/>\n<Column ss:Width="70"/>\n'; // Pot Hari, Telat Jam

    xml += `<Row ss:Height="25"><Cell ss:StyleID="sTitle" ss:MergeAcross="${7 + dates.length + rekapAbsenHeaders.length}"><Data ss:Type="String">REKAPITULASI KEHADIRAN</Data></Cell></Row>\n`;
    xml += `<Row ss:Height="20"><Cell ss:StyleID="sSubtitle" ss:MergeAcross="${7 + dates.length + rekapAbsenHeaders.length}"><Data ss:Type="String">Periode: ${tglAwal} s/d ${tglAkhir}</Data></Cell></Row>\n`;
    xml += '<Row ss:Height="10"></Row>\n';

    xml += '<Row ss:Height="20">\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">No</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">ID</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">Nama</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">Jabatan</Data></Cell>\n';
    xml += `<Cell ss:StyleID="sHeaderGreen" ss:MergeAcross="${dates.length - 1}"><Data ss:Type="String">Periode</Data></Cell>\n`;
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">Total HK</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">Sisa Cuti</Data></Cell>\n';
    xml += `<Cell ss:StyleID="sHeaderBlue" ss:MergeAcross="${rekapAbsenHeaders.length - 1}"><Data ss:Type="String">Absensi</Data></Cell>\n`;
    xml += `<Cell ss:StyleID="sHeader" ss:MergeAcross="1"><Data ss:Type="String">Potongan</Data></Cell>\n`;
    xml += '</Row>\n';
    xml += '<Row ss:Height="20">\n';
    dates.forEach((d, i) => { xml += `<Cell ss:StyleID="sDateHeader" ${i === 0 ? 'ss:Index="5"' : ''}><Data ss:Type="String">${d.getDate()}</Data></Cell>\n`; });
    rekapAbsenHeaders.forEach((h, i) => { xml += `<Cell ss:StyleID="sHeaderBlue" ${i === 0 ? `ss:Index="${7 + dates.length}"` : ''}><Data ss:Type="String">${h}</Data></Cell>\n`; });
    xml += `<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">Hari</Data></Cell>\n`;
    xml += `<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">Telat (Jam)</Data></Cell>\n`;
    xml += '</Row>\n';

    employees.forEach((emp, idx) => {
        let counts = { H:0, A:0, I:0, S:0, OFF:0, DP:0, PH:0, AL:0 };
        xml += '<Row>\n';
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>\n<Cell ss:StyleID="sCenter"><Data ss:Type="String">${emp.id || '-'}</Data></Cell>\n<Cell ss:StyleID="sData"><Data ss:Type="String">${esc(emp.name)}</Data></Cell>\n<Cell ss:StyleID="sData"><Data ss:Type="String">${esc(emp.jabatan)}</Data></Cell>\n`;
        dates.forEach(d => {
            const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
            const status = absensiData[key] || '';
            let countKey = status;
            if (status === 'O') countKey = 'OFF';
            if (status && counts.hasOwnProperty(countKey)) counts[countKey]++;
            xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="String">${esc(status)}</Data></Cell>\n`;
        });
        const totalSisaCuti = (emp.sisaAL || 0) + (emp.sisaDP || 0) + (emp.sisaPH || 0);
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${counts.H}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${totalSisaCuti}</Data></Cell>\n`;
        rekapAbsenHeaders.forEach(h => {
            if (h === 'JML') {
                xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${dates.length}</Data></Cell>\n`;
            } else {
                xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${counts[h]}</Data></Cell>\n`;
            }
        });

        const empKey = (emp && emp.id != null && emp.id !== '') ? ('id_' + String(emp.id)) : (emp && emp.name ? ('name_' + String(emp.name).replace(/[.#$\[\]]/g, '_')) : ('idx_' + String(idx)));
        const pData = gajiData[empKey] || {};
        const potHari = pData.potHari !== undefined ? parseFloat(pData.potHari) : 0;
        const configTelat = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : 10;
        const totalMenitTelatGps = typeof getTotalMenitTelatFromGps === 'function' ? getTotalMenitTelatFromGps(emp.id || idx, emp.name, tglAwal, tglAkhir) : 0;
        const calcGpsJam = totalMenitTelatGps > 0 ? Math.round((totalMenitTelatGps / configTelat) * 10) / 10 : 0;
        let jamTerlambat = pData.jamTerlambatManual !== undefined ? parseFloat(pData.jamTerlambatManual) : calcGpsJam;

        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${potHari}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${jamTerlambat}</Data></Cell>\n`;

        xml += '</Row>\n';
    });
    xml += '</Table>\n</Worksheet>\n';

    // --- SHEET 4: REKAP GAJI ---
    xml += `<Worksheet ss:Name="Rekap Gaji">\n<Table>\n`;
    const gajiHeaders = ['NO', 'NAMA', 'JABATAN', 'BANK', 'NO REK', 'HK TARGET', 'HK AKTUAL', 'A', 'I', 'S', 'OFF', 'DP', 'PH', 'AL', 'JML', 'GAJI POKOK', 'GAJI/HARI', 'HARI', 'Rp', 'JAM', 'RATE/JAM', 'TOTAL', 'HUTANG', 'UANG MAKAN', 'TUNJANGAN', 'GRAND TOTAL', 'PEMBAYARAN'];
    gajiHeaders.forEach(h => xml += `<Column ss:Width="${h.length > 5 ? '100' : '60'}"/>\n`);

    xml += `<Row ss:Height="25"><Cell ss:StyleID="sTitle" ss:MergeAcross="${gajiHeaders.length - 1}"><Data ss:Type="String">REKAPITULASI GAJI KARYAWAN</Data></Cell></Row>\n`;
    xml += `<Row ss:Height="20"><Cell ss:StyleID="sSubtitle" ss:MergeAcross="${gajiHeaders.length - 1}"><Data ss:Type="String">Periode: ${tglAwal} s/d ${tglAkhir}</Data></Cell></Row>\n`;
    xml += '<Row ss:Height="10"></Row>\n';

    xml += '<Row ss:Height="20">\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">NO</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">NAMA</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">JABATAN</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">BANK</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">NO REK</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">HK TARGET</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">HK AKTUAL</Data></Cell>\n';
    xml += `<Cell ss:StyleID="sHeaderBlue" ss:MergeAcross="7"><Data ss:Type="String">ABSENSI</Data></Cell>\n`;
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">GAJI POKOK</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">GAJI/HARI</Data></Cell>\n';
    xml += `<Cell ss:StyleID="sHeaderGreen" ss:MergeAcross="1"><Data ss:Type="String">POT. KEHADIRAN</Data></Cell>\n`;
    xml += `<Cell ss:StyleID="sHeaderGreen" ss:MergeAcross="2"><Data ss:Type="String">KETERLAMBATAN</Data></Cell>\n`;
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">HUTANG</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">UANG MAKAN</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">TUNJANGAN</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">GRAND TOTAL</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeader" ss:MergeDown="1"><Data ss:Type="String">PEMBAYARAN</Data></Cell>\n';
    xml += '</Row>\n';
    xml += '<Row ss:Height="20">\n';
    xml += '<Cell ss:StyleID="sHeaderBlue" ss:Index="8"><Data ss:Type="String">A</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">I</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">S</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">OFF</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">DP</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">PH</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">AL</Data></Cell>\n<Cell ss:StyleID="sHeaderBlue"><Data ss:Type="String">JML</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeaderGreen" ss:Index="18"><Data ss:Type="String">HARI</Data></Cell>\n<Cell ss:StyleID="sHeaderGreen"><Data ss:Type="String">Rp</Data></Cell>\n';
    xml += '<Cell ss:StyleID="sHeaderGreen"><Data ss:Type="String">JAM</Data></Cell>\n<Cell ss:StyleID="sHeaderGreen"><Data ss:Type="String">RATE/JAM</Data></Cell>\n<Cell ss:StyleID="sHeaderGreen"><Data ss:Type="String">TOTAL</Data></Cell>\n';
    xml += '</Row>\n';

    let totalGrand = 0;
    employees.forEach((emp, idx) => {
        let counts = { H:0, A:0, I:0, S:0, OFF:0, DP:0, PH:0, AL:0 };
        dates.forEach(d => {
            const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
            const status = absensiData[key];
            let countKey = status;
            if (status === 'O') countKey = 'OFF';
            if (status && counts.hasOwnProperty(countKey)) counts[countKey]++;
        });

        const empKey = (emp && emp.id != null && emp.id !== '') ? ('id_' + String(emp.id)) : (emp && emp.name ? ('name_' + String(emp.name).replace(/[.#$\[\]]/g, '_')) : ('idx_' + String(idx)));
        const pData = gajiData[empKey] || {};
        const gajiPokok = parseInt(emp.gajiPokok) || 0;
        const hkTarget = pData.hkTarget !== undefined ? parseInt(pData.hkTarget) : 26;
        const potHari = pData.potHari !== undefined ? parseFloat(pData.potHari) : 0;
        const jamTerlambat = pData.jamTerlambat !== undefined ? parseFloat(pData.jamTerlambat) : 0;
        const hutang = parseInt(pData.hutang) || 0;
        const tunjangan = parseInt(pData.tunjangan) || 0;
        const metodeBayar = pData.metodeBayar || 'TF';

        const gajiPerHari = Math.round(gajiPokok / 30);
        const potTerlambatPerJam = Math.round(gajiPokok / 240);
        const uangMakan = counts.H * 10000;
        const totalPotKehadiran = Math.round(potHari * gajiPerHari);
        const totalPotTerlambat = Math.round(jamTerlambat * potTerlambatPerJam);
        const grandTotal = gajiPokok - totalPotKehadiran - totalPotTerlambat - hutang + uangMakan + tunjangan;
        totalGrand += grandTotal;

        xml += '<Row>\n';
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sData"><Data ss:Type="String">${esc(emp.name)}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sData"><Data ss:Type="String">${esc(emp.jabatan)}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sData"><Data ss:Type="String">${esc(emp.bank)}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sData"><Data ss:Type="String">${esc(emp.noRek)}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${hkTarget}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${counts.H}</Data></Cell>\n`;
        // Absensi
        ['A', 'I', 'S', 'OFF', 'DP', 'PH', 'AL'].forEach(h => { xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${counts[h]}</Data></Cell>\n`; });
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${dates.length}</Data></Cell>\n`;
        // Gaji
        xml += `<Cell ss:StyleID="sNumCurrency"><Data ss:Type="Number">${gajiPokok}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sNumCurrency"><Data ss:Type="Number">${gajiPerHari}</Data></Cell>\n`;
        // Potongan
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${potHari}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sNumCurrency"><Data ss:Type="Number">${totalPotKehadiran}</Data></Cell>\n`;
        // Terlambat
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${jamTerlambat}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sNumCurrency"><Data ss:Type="Number">${potTerlambatPerJam}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sNumCurrency"><Data ss:Type="Number">${totalPotTerlambat}</Data></Cell>\n`;
        // Lainnya
        xml += `<Cell ss:StyleID="sNumCurrency"><Data ss:Type="Number">${hutang}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sNumCurrency"><Data ss:Type="Number">${uangMakan}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sNumCurrency"><Data ss:Type="Number">${tunjangan}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sNumCurrency"><Data ss:Type="Number">${grandTotal}</Data></Cell>\n`;
        xml += `<Cell ss:StyleID="sCenter"><Data ss:Type="String">${esc(metodeBayar)}</Data></Cell>\n`;
        xml += '</Row>\n';
    });

    // Total Row
    xml += '<Row>\n';
    xml += `<Cell ss:StyleID="sTotalLabel" ss:MergeAcross="25"><Data ss:Type="String">TOTAL PENGELUARAN GAJI</Data></Cell>\n`;
    xml += `<Cell ss:StyleID="sTotalNum"><Data ss:Type="Number">${totalGrand}</Data></Cell>\n`;
    xml += '</Row>\n';

    xml += '</Table>\n</Worksheet>\n';

    xml += '</Workbook>';

    const blob = new Blob(['\ufeff', xml], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Laporan_Lengkap_${tglAwal}_sd_${tglAkhir}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function exportCompleteAbsensiPDF() {
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    
    if (!tglAwal || !tglAkhir) {
        alert("Harap pilih Tanggal Mulai dan Selesai di tab Absensi terlebih dahulu.");
        return;
    }

    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
    const jadwalData = getCachedParsedStorage(getRbmStorageKey('RBM_JADWAL_DATA'), {});
    const gajiKey = getRbmStorageKey('RBM_GAJI_' + tglAwal + '_' + tglAkhir);
    const gajiData = getCachedParsedStorage(gajiKey, {});

    // Generate Dates
    const dates = [];
    let curr = new Date(tglAwal);
    const end = new Date(tglAkhir);
    while (curr <= end) {
        dates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }

    const formatMoney = (n) => {
        if (isNaN(n) || n === null) return 'Rp 0';
        return 'Rp ' + (n || 0).toLocaleString('id-ID');
    };

    var styleBlock = '<style>body{font-family:sans-serif;font-size:10px;}h2,h3{text-align:center;margin:5px 0;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:4px;text-align:center;}th{background-color:#1e40af;color:#fff;}.text-left{text-align:left;}.text-right{text-align:right;}</style>';

    // --- 1. ABSENSI (halaman sendiri) ---
    var htmlAbsensi = styleBlock + `<h2>LAPORAN ABSENSI HARIAN</h2><h3>Periode: ${tglAwal} s/d ${tglAkhir}</h3><table><thead><tr>
        <th rowspan="2">No</th><th rowspan="2">Nama</th><th rowspan="2">Jabatan</th>
        <th colspan="${dates.length}">Tanggal</th><th colspan="9">Rekap</th></tr><tr>`;
    dates.forEach(d => htmlAbsensi += `<th>${d.getDate()}</th>`);
    ['H','R','O','S','I','A','DP','PH','AL'].forEach(h => htmlAbsensi += `<th>${h}</th>`);
    htmlAbsensi += `</tr></thead><tbody>`;
    employees.forEach((emp, idx) => {
        let counts = {H:0,R:0,O:0,S:0,I:0,A:0,DP:0,PH:0,AL:0};
        htmlAbsensi += `<tr><td>${idx+1}</td><td class="text-left">${emp.name}</td><td class="text-left">${emp.jabatan}</td>`;
        dates.forEach(d => {
            const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
            const status = absensiData[key] || '';
            let countKey = status === 'O' ? 'O' : status;
            if(counts.hasOwnProperty(countKey)) counts[countKey]++;
            htmlAbsensi += `<td>${status}</td>`;
        });
        ['H','R','O','S','I','A','DP','PH','AL'].forEach(h => htmlAbsensi += `<td>${counts[h]}</td>`);
        htmlAbsensi += `</tr>`;
    });
    htmlAbsensi += `</tbody></table>`;

    // --- 2. JADWAL (halaman sendiri) ---
    var htmlJadwal = styleBlock + `<h2>JADWAL KERJA</h2><h3>Periode: ${tglAwal} s/d ${tglAkhir}</h3><table><thead><tr>
        <th rowspan="2">No</th><th rowspan="2">Nama</th><th rowspan="2">Jabatan</th>
        <th colspan="${dates.length}">Tanggal</th><th colspan="7">Rekap</th></tr><tr>`;
    dates.forEach(d => htmlJadwal += `<th>${d.getDate()}</th>`);
    ['P','M','S','Off','PH','AL','DP'].forEach(h => htmlJadwal += `<th>${h}</th>`);
    htmlJadwal += `</tr></thead><tbody>`;
    employees.forEach((emp, idx) => {
        let counts = {P:0,M:0,S:0,Off:0,PH:0,AL:0,DP:0};
        htmlJadwal += `<tr><td>${idx+1}</td><td class="text-left">${emp.name}</td><td class="text-left">${emp.jabatan}</td>`;
        dates.forEach(d => {
            const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
            const status = jadwalData[key] || '';
            if(counts.hasOwnProperty(status)) counts[status]++;
            htmlJadwal += `<td>${status}</td>`;
        });
        ['P','M','S','Off','PH','AL','DP'].forEach(h => htmlJadwal += `<td>${counts[h]}</td>`);
        htmlJadwal += `</tr>`;
    });
    htmlJadwal += `</tbody></table>`;

    // --- 3. LAPORAN ABSEN (halaman sendiri) ---
    var htmlLaporanAbsen = styleBlock + `<h2>REKAP ABSENSI / LAPORAN ABSEN</h2><h3>Periode: ${tglAwal} s/d ${tglAkhir}</h3><table><thead><tr>
        <th rowspan="2">No</th><th rowspan="2">ID</th><th rowspan="2">Nama</th><th rowspan="2">Jabatan</th>
        <th colspan="${dates.length}">Periode</th><th rowspan="2">Total HK</th><th rowspan="2">Sisa Cuti</th><th colspan="8">Absensi</th><th colspan="2">Potongan</th></tr><tr>`;
    dates.forEach(d => htmlLaporanAbsen += `<th>${d.getDate()}</th>`);
    ['A','I','S','OFF','DP','PH','AL','JML'].forEach(h => htmlLaporanAbsen += `<th>${h}</th>`);
    htmlLaporanAbsen += `<th>Hari</th><th>Telat (Jam)</th></tr></thead><tbody>`;
    employees.forEach((emp, idx) => {
        let counts = { H:0, A:0, I:0, S:0, OFF:0, DP:0, PH:0, AL:0 };
        dates.forEach(d => {
            const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
            const status = absensiData[key] || '';
            let countKey = status === 'O' ? 'OFF' : status;
            if (status && counts.hasOwnProperty(countKey)) counts[countKey]++;
        });
        const totalSisaCuti = (parseInt(emp.sisaAL)||0) + (parseInt(emp.sisaDP)||0) + (parseInt(emp.sisaPH)||0);
        htmlLaporanAbsen += `<tr><td>${idx+1}</td><td>${emp.id || '-'}</td><td class="text-left">${emp.name}</td><td class="text-left">${emp.jabatan}</td>`;
        dates.forEach(d => {
            const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
            htmlLaporanAbsen += `<td>${absensiData[key] || ''}</td>`;
        });
        const empKey = (emp && emp.id != null && emp.id !== '') ? ('id_' + String(emp.id)) : (emp && emp.name ? ('name_' + String(emp.name).replace(/[.#$\[\]]/g, '_')) : ('idx_' + String(idx)));
        const pData = gajiData[empKey] || {};
        const potHari = pData.potHari !== undefined ? parseFloat(pData.potHari) : 0;
        const configTelat = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : 10;
        const totalMenitTelatGps = typeof getTotalMenitTelatFromGps === 'function' ? getTotalMenitTelatFromGps(emp.id || idx, emp.name, tglAwal, tglAkhir) : 0;
        const calcGpsJam = totalMenitTelatGps > 0 ? Math.round((totalMenitTelatGps / configTelat) * 10) / 10 : 0;
        let jamTerlambat = pData.jamTerlambatManual !== undefined ? parseFloat(pData.jamTerlambatManual) : calcGpsJam;

        htmlLaporanAbsen += `<td>${counts.H}</td><td>${totalSisaCuti}</td><td>${counts.A}</td><td>${counts.I}</td><td>${counts.S}</td><td>${counts.OFF}</td><td>${counts.DP}</td><td>${counts.PH}</td><td>${counts.AL}</td><td>${dates.length}</td><td>${potHari || '-'}</td><td>${jamTerlambat || '-'}</td></tr>`;
    });
    htmlLaporanAbsen += `</tbody></table>`;

    // --- 4. REKAP GAJI (halaman sendiri) ---
    var totalGrand = 0;
    var rowsGaji = '';
    employees.forEach((emp, idx) => {
        let counts = { H:0, A:0, I:0, S:0, OFF:0, DP:0, PH:0, AL:0 };
        dates.forEach(d => {
            const key = `${getLocalDateKey(d)}_${emp.id || idx}`;
            const status = absensiData[key] || '';
            let countKey = status === 'O' ? 'OFF' : status;
            if (status && counts.hasOwnProperty(countKey)) counts[countKey]++;
        });
        const empKey = (emp && emp.id != null && emp.id !== '') ? ('id_' + String(emp.id)) : (emp && emp.name ? ('name_' + String(emp.name).replace(/[.#$\[\]]/g, '_')) : ('idx_' + String(idx)));
        const pData = gajiData[empKey] || {};
        const configTelat = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : 10;
        const bank = emp.bank || '-';
        const noRek = emp.noRek || '-';
        const hkTarget = pData.hkTarget !== undefined ? parseInt(pData.hkTarget) : 26;
        const hkAktual = counts.H;
        const gajiPokok = parseInt(emp.gajiPokok) || 0;
        const potHari = parseFloat(pData.potHari) || 0;
        const totalMenitTelatGps = typeof getTotalMenitTelatFromGps === 'function' ? getTotalMenitTelatFromGps(emp.id || idx, emp.name, tglAwal, tglAkhir) : 0;
        const calcGpsJam = totalMenitTelatGps > 0 ? Math.round((totalMenitTelatGps / configTelat) * 10) / 10 : 0;
        let jamTerlambat = pData.jamTerlambatManual !== undefined ? parseFloat(pData.jamTerlambatManual) : calcGpsJam;

        const hutang = parseInt(pData.hutang) || 0;
        const tunjangan = parseInt(pData.tunjangan) || 0;
        const metodeBayar = pData.metodeBayar || 'TF';
        const gajiPerHari = Math.round(gajiPokok / 30);
        const potTerlambatPerJam = Math.round(gajiPokok / 240);
        const uangMakan = hkAktual * 10000;
        const totalPotKehadiran = Math.round(potHari * gajiPerHari);
        const totalPotTerlambat = Math.round(jamTerlambat * potTerlambatPerJam);
        const grandTotal = gajiPokok - totalPotKehadiran - totalPotTerlambat - hutang + uangMakan + tunjangan;
        totalGrand += grandTotal;
        rowsGaji += `<tr>
            <td>${idx+1}</td><td class="text-left">${emp.name}</td><td class="text-left">${emp.jabatan}</td>
            <td>${bank}</td><td>${noRek}</td><td>${hkTarget}</td><td>${hkAktual}</td>
            <td>${counts.A || '-'}</td><td>${counts.I || '-'}</td><td>${counts.S || '-'}</td><td>${counts.OFF || '-'}</td><td>${counts.DP || '-'}</td><td>${counts.PH || '-'}</td><td>${counts.AL || '-'}</td><td>${dates.length}</td>
            <td class="text-right">${formatMoney(gajiPokok)}</td><td class="text-right">${formatMoney(gajiPerHari)}</td>
            <td>${potHari}</td><td class="text-right">${formatMoney(totalPotKehadiran)}</td>
            <td>${jamTerlambat}</td><td class="text-right">${formatMoney(potTerlambatPerJam)}</td><td class="text-right">${formatMoney(totalPotTerlambat)}</td>
            <td class="text-right">${formatMoney(hutang)}</td><td class="text-right">${formatMoney(uangMakan)}</td><td class="text-right">${formatMoney(tunjangan)}</td>
            <td class="text-right" style="font-weight:bold;">${formatMoney(grandTotal)}</td><td>${metodeBayar}</td>
        </tr>`;
    });
    var htmlGaji = styleBlock + `<h2>REKAPITULASI GAJI KARYAWAN</h2><h3>Periode: ${tglAwal} s/d ${tglAkhir}</h3><table><thead><tr>
        <th rowspan="2">No</th><th rowspan="2">Nama</th><th rowspan="2">Jabatan</th>
        <th rowspan="2">Bank</th><th rowspan="2">No Rek</th><th rowspan="2">HK<br>Target</th><th rowspan="2">HK<br>Aktual</th>
        <th colspan="8">Absensi</th>
        <th rowspan="2">Gaji Pokok</th><th rowspan="2">Gaji/Hari</th>
        <th colspan="2">Potongan</th><th colspan="3">Terlambat</th>
        <th rowspan="2">Hutang</th><th rowspan="2">Makan</th><th rowspan="2">Tunjangan</th>
        <th rowspan="2">Grand Total</th><th rowspan="2">Pembayaran</th>
    </tr><tr>
        <th>A</th><th>I</th><th>S</th><th>OFF</th><th>DP</th><th>PH</th><th>AL</th><th>JML</th>
        <th>Hari</th><th>Rp</th><th>Jam</th><th>Rate</th><th>Total</th>
    </tr></thead><tbody>${rowsGaji}</tbody></table>`;
    htmlGaji += `<p style="text-align:right;font-weight:bold;margin-top:8px;">TOTAL: ${formatMoney(totalGrand)}</p>`;

    if (typeof window.jspdf !== 'undefined' && typeof html2canvas !== 'undefined') {
        var pageW, pageH, margin, usableW, usableH, pxToMm;
        function addSectionToPdf(doc, sectionHtml, addNewPageBefore) {
            return new Promise(function(resolve, reject) {
                var wrap = document.createElement('div');
                wrap.style.cssText = 'position:absolute;left:0;top:-99999px;width:1100px;min-height:200px;padding:16px;font-family:sans-serif;font-size:10px;background:#fff;color:#333;box-sizing:border-box;';
                wrap.innerHTML = sectionHtml;
                document.body.appendChild(wrap);
                html2canvas(wrap, { scale: 1, backgroundColor: '#ffffff' }).then(function(canvas) {
                    document.body.removeChild(wrap);
                    if (addNewPageBefore) doc.addPage('l');
                    pageW = doc.internal.pageSize.getWidth();
                    pageH = doc.internal.pageSize.getHeight();
                    margin = 8;
                    usableW = pageW - margin * 2;
                    usableH = pageH - margin * 2;
                    pxToMm = 25.4 / 96;
                    var imgWmm = canvas.width * pxToMm;
                    var imgHmm = canvas.height * pxToMm;
                    var scale = Math.min(usableW / imgWmm, usableH / imgHmm, 1);
                    var drawW = imgWmm * scale;
                    var drawH = imgHmm * scale;
                    if (drawH <= usableH && drawW <= usableW) {
                        doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, drawW, drawH);
                    } else {
                        var totalH = drawH;
                        var drawn = 0;
                        while (drawn < totalH) {
                            var pageImgH = Math.min(usableH, totalH - drawn);
                            var srcY = (drawn / totalH) * canvas.height;
                            var srcH = (pageImgH / totalH) * canvas.height;
                            var small = document.createElement('canvas');
                            small.width = canvas.width;
                            small.height = Math.ceil(srcH);
                            small.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, small.width, small.height);
                            doc.addImage(small.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, drawW, pageImgH);
                            drawn += pageImgH;
                            if (drawn < totalH) doc.addPage('l');
                        }
                    }
                    resolve();
                }).catch(function(e) {
                    if (wrap.parentNode) document.body.removeChild(wrap);
                    reject(e);
                });
            });
        }

        var doc = new window.jspdf.jsPDF('l', 'mm', 'a4');
        pageW = doc.internal.pageSize.getWidth();
        pageH = doc.internal.pageSize.getHeight();
        margin = 8;
        usableW = pageW - margin * 2;
        usableH = pageH - margin * 2;
        pxToMm = 25.4 / 96;

        addSectionToPdf(doc, htmlAbsensi, false)
            .then(function() { return addSectionToPdf(doc, htmlJadwal, true); })
            .then(function() { return addSectionToPdf(doc, htmlLaporanAbsen, true); })
            .then(function() { return addSectionToPdf(doc, htmlGaji, true); })
            .then(function() {
                var namaFile = 'Laporan_Lengkap_' + (tglAwal || '').replace(/-/g, '') + '_sd_' + (tglAkhir || '').replace(/-/g, '') + '.pdf';
                doc.save(namaFile);
            })
            .catch(function(err) {
                alert('Gagal membuat PDF. Coba lagi atau gunakan Print lalu pilih Simpan sebagai PDF.');
            });
    } else {
        var html = '<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;font-size:10px;}h2,h3{text-align:center;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:4px;}th{background:#1e40af;color:#fff;}.text-left{text-align:left;}.text-right{text-align:right;} .break{page-break-before:always;}</style></head><body>' +
            htmlAbsensi + '<div class="break"></div>' + htmlJadwal.replace(styleBlock,'') + '<div class="break"></div>' + htmlLaporanAbsen.replace(styleBlock,'') + '<div class="break"></div>' + htmlGaji.replace(styleBlock,'') + '</body></html>';
        var printWindow = window.open('', '', 'height=600,width=900');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(function() { printWindow.print(); printWindow.close(); }, 500);
    }
}

function openJadwalModal() {
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    
    document.getElementById("jadwal_preview_start").value = tglAwal;
    document.getElementById("jadwal_preview_end").value = tglAkhir;
    
    // Load saved note based on date range
    const noteKey = getRbmStorageKey('RBM_JADWAL_NOTE_' + tglAwal + '_' + tglAkhir);
    const savedNote = RBMStorage.getItem(noteKey) || "";
    document.getElementById("jadwal_notes").value = savedNote;

    document.getElementById("jadwalModal").style.display = "flex";
    updateJadwalPreview();
}

function closeJadwalModal() {
    document.getElementById("jadwalModal").style.display = "none";
}

function updateJadwalPreview() {
    const tglAwal = document.getElementById("jadwal_preview_start").value;
    const tglAkhir = document.getElementById("jadwal_preview_end").value;
    const notes = document.getElementById("jadwal_notes").value;
    const container = document.getElementById("jadwalPreviewArea");

    // Save note automatically
    if (tglAwal && tglAkhir) {
        const noteKey = getRbmStorageKey('RBM_JADWAL_NOTE_' + tglAwal + '_' + tglAkhir);
        RBMStorage.setItem(noteKey, notes);
    }

    if (!tglAwal || !tglAkhir) {
        container.innerHTML = '<p style="text-align:center;">Pilih tanggal terlebih dahulu.</p>';
        return;
    }

    let employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    if (typeof getOrderedAbsensiEmployeesWithIndex === 'function') {
        employees = getOrderedAbsensiEmployeesWithIndex(employees).map(function(item) {
            var e = Object.assign({}, item.emp);
            e._originalIndex = item.idx; // Simpan index asli untuk query jadwal
            return e;
        });
    } else {
        employees = employees.map(function(e, idx) {
            var emp = Object.assign({}, e);
            emp._originalIndex = idx;
            return emp;
        });
    }

    let jadwalData = getCachedParsedStorage(getRbmStorageKey('RBM_JADWAL_DATA'), {});
    if (typeof activeAbsensiMode !== 'undefined' && activeAbsensiMode === 'jadwal' && window._absensiViewData) {
        jadwalData = window._absensiViewData; // Gunakan data yang sedang diedit (belum disave)
    }

    const dates = [];
    let curr = new Date(tglAwal);
    const end = new Date(tglAkhir);
    while (curr <= end) {
        dates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }

    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const d1 = new Date(tglAwal).toLocaleDateString('id-ID', options);
    const d2 = new Date(tglAkhir).toLocaleDateString('id-ID', options);

    let html = `
    <div style="font-family: 'Segoe UI', sans-serif; padding: 10px;">
        <h2 style="text-align:center; margin:0 0 5px 0; font-size:18px;">JADWAL KERJA KARYAWAN</h2>
        <h3 style="text-align:center; margin:0 0 15px 0; font-size:14px; font-weight:normal; color:#333;">Periode: ${d1} s/d ${d2}</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
                <tr>
                    <th style="border:1px solid #000; padding:6px; background:#f2f2f2; width:30px;">No</th>
                    <th style="border:1px solid #000; padding:6px; background:#f2f2f2; text-align:left; width:150px;">Nama</th>
                    <th style="border:1px solid #000; padding:6px; background:#f2f2f2; text-align:left; width:100px;">Jabatan</th>
    `;
    
    dates.forEach(d => {
        const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
        html += `<th style="border:1px solid #000; padding:6px; background:#f2f2f2; text-align:center;">${dayName}<br>${d.getDate()}</th>`;
    });
    
    html += `<th style="border:1px solid #000; padding:6px; background:#f2f2f2; width:35px;">PH</th>`;
    html += `<th style="border:1px solid #000; padding:6px; background:#f2f2f2; width:35px;">AL</th>`;
    html += `<th style="border:1px solid #000; padding:6px; background:#f2f2f2; width:35px;">DP</th>`;
    
    html += `</tr></thead><tbody>`;

    employees.forEach((emp, idx) => {
        html += `<tr>
            <td style="border:1px solid #000; padding:6px; text-align:center;">${idx + 1}</td>
            <td style="border:1px solid #000; padding:6px;">${emp.name}</td>
            <td style="border:1px solid #000; padding:6px;">${emp.jabatan}</td>`;
            
        dates.forEach(d => {
            const origIdx = emp._originalIndex !== undefined ? emp._originalIndex : idx;
            const key = `${getLocalDateKey(d)}_${emp.id || origIdx}`;
            const status = jadwalData[key] || '';
            
            let bg = '';
            let color = '#000';
            if (status === 'P') { bg = '#ffedd5'; color = '#9a3412'; }
            else if (status === 'M') { bg = '#e0f2fe'; color = '#075985'; }
            else if (status === 'S') { bg = '#fae8ff'; color = '#86198f'; }
            else if (status === 'Off') { bg = '#f1f5f9'; color = '#64748b'; }
            else if (['PH','AL','DP'].includes(status)) { bg = '#dbeafe'; color = '#1e40af'; }
            
            const style = bg ? `background-color:${bg}; color:${color};` : '';
            
            html += `<td style="border:1px solid #000; padding:6px; text-align:center; ${style}">${status}</td>`;
        });
        html += `<td style="border:1px solid #000; padding:6px; text-align:center;">${emp.sisaPH || 0}</td>`;
        html += `<td style="border:1px solid #000; padding:6px; text-align:center;">${emp.sisaAL || 0}</td>`;
        html += `<td style="border:1px solid #000; padding:6px; text-align:center;">${emp.sisaDP || 0}</td>`;
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    
    if (notes) {
        html += `<div style="margin-top: 15px; text-align: left; font-size: 12px; color: #000;"><strong>Catatan:</strong><br>${notes}</div>`;
    }
    
    html += `</div>`;
    container.innerHTML = html;
}

function printJadwalPreview() {
    const content = document.getElementById("jadwalPreviewArea").innerHTML;
    const printWindow = window.open('', '', 'height=700,width=800');
    printWindow.document.write('<html><head><title>Jadwal Kerja</title>');
    printWindow.document.write('<style>body { font-family: sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #000; padding: 6px; } @media print { @page { size: landscape; margin: 10mm; } }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(content);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

function saveJadwalImage() {
    const container = document.getElementById("jadwalPreviewArea");
    const content = container.firstElementChild;
    
    if (!content) {
        alert("Silakan klik 'Lihat Preview' terlebih dahulu.");
        return;
    }

    const tglAwal = document.getElementById("jadwal_preview_start").value;
    const tglAkhir = document.getElementById("jadwal_preview_end").value;

    html2canvas(content, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
        const a = document.createElement('a');
        a.href = canvas.toDataURL("image/jpeg", 0.9);
        a.download = `Jadwal_Kerja_${tglAwal}_sd_${tglAkhir}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
}

async function downloadAllSlipsAsZip(event) {
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    
    if (!tglAwal || !tglAkhir) { alert("Pilih tanggal terlebih dahulu di filter Rekap Gaji."); return; }

    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    if (employees.length === 0) { alert("Tidak ada data karyawan."); return; }

    // UI Feedback
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Memproses... (0/" + employees.length + ")";
    btn.disabled = true;

    const zip = new JSZip();
    const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
    const gajiPeriodKey = getRbmStorageKey('RBM_GAJI_' + tglAwal + '_' + tglAkhir);
    const gajiPeriodData = getCachedParsedStorage(gajiPeriodKey, {});

    // Create temp container off-screen
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '-9999px';
    wrapper.style.left = '-9999px';
    wrapper.style.width = '800px'; 
    wrapper.style.backgroundColor = '#ffffff';
    document.body.appendChild(wrapper);

    // Date generation
    let curr = new Date(tglAwal);
    const end = new Date(tglAkhir);
    const dates = [];
    while (curr <= end) { dates.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }
    
    const options = { month: 'long', year: 'numeric' };
    const periodeText = new Date(tglAwal).toLocaleDateString('id-ID', options).toUpperCase();

    try {
        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            btn.innerText = `Memproses... (${i+1}/${employees.length})`;

            // Calculate Data (Logic same as renderRekapGaji)
            let counts = { H:0 };
            dates.forEach(d => {
                const key = `${getLocalDateKey(d)}_${emp.id || i}`;
                if (absensiData[key] === 'H') counts.H++;
            });

            const empKey = (emp && emp.id != null && emp.id !== '') ? ('id_' + String(emp.id)) : (emp && emp.name ? ('name_' + String(emp.name).replace(/[.#$\[\]]/g, '_')) : ('idx_' + String(i)));
            const pData = gajiPeriodData[empKey] || {};
            const configTelat = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : 10;
            const gajiPokok = parseInt(emp.gajiPokok) || 0;
            const potHari = parseFloat(pData.potHari) || 0;
            const totalMenitTelatGps = typeof getTotalMenitTelatFromGps === 'function' ? getTotalMenitTelatFromGps(emp.id || i, emp.name, tglAwal, tglAkhir) : 0;
            const calcGpsJam = totalMenitTelatGps > 0 ? Math.round((totalMenitTelatGps / configTelat) * 10) / 10 : 0;
        let jamTerlambat = pData.jamTerlambatManual !== undefined ? parseFloat(pData.jamTerlambatManual) : calcGpsJam;

            const hutang = parseInt(pData.hutang) || 0;
            const tunjangan = parseInt(pData.tunjangan) || 0;

            const gajiPerHari = Math.round(gajiPokok / 30);
            const potTerlambatPerJam = Math.round(gajiPokok / 240);
            const uangMakan = counts.H * 10000;
            const totalPotKehadiran = Math.round(potHari * gajiPerHari);
            const totalPotTerlambat = Math.round(jamTerlambat * potTerlambatPerJam);
            const totalPendapatan = gajiPokok + tunjangan + uangMakan;
            const grandTotal = totalPendapatan - totalPotKehadiran - totalPotTerlambat - hutang;

            // Render HTML Template
            wrapper.innerHTML = `
                <div style="padding: 40px; font-family: 'Courier New', Courier, monospace; color: #000; border: 1px solid #eee; background: white;">
                    <div style="text-align: center; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px;">
                        <h3 style="margin: 0; font-size: 18px; font-weight: bold;">SLIP GAJI KARYAWAN</h3>
                        <h4 style="margin: 5px 0 0; font-size: 16px; font-weight: bold;">RICE BOWL MONSTERS</h4>
                        <p style="margin: 5px 0 0; font-size: 14px;">BULAN ${periodeText}</p>
                    </div>
                    <table style="width: 100%; margin-bottom: 20px; font-size: 14px; border-collapse: collapse;"><tr><td style="width: 120px; padding: 2px 0;">Nama</td><td style="width: 10px;">:</td><td style="font-weight: bold;">${emp.name}</td></tr><tr><td style="padding: 2px 0;">Jabatan</td><td>:</td><td>${emp.jabatan}</td></tr><tr><td style="padding: 2px 0;">Bagian</td><td>:</td><td>Rice Bowl Monsters</td></tr></table>
                    <table style="width: 100%; font-size: 14px; border-collapse: collapse;"><tr><td style="padding: 8px 0; font-weight: bold;" colspan="4">Pendapatan (+):</td></tr><tr><td style="padding-left: 15px;">Gaji Pokok</td><td>:</td><td style="text-align: right;">${formatRupiah(gajiPokok)}</td><td></td></tr><tr><td style="padding-left: 15px;">Tunjangan</td><td>:</td><td style="text-align: right;">${formatRupiah(tunjangan)}</td><td></td></tr><tr><td style="padding-left: 15px;">Lembur Minggu</td><td>:</td><td style="text-align: right;">Rp -</td><td></td></tr><tr style="border-bottom: 1px solid black;"><td style="padding-left: 15px; padding-bottom: 8px;">Uang Makan</td><td style="padding-bottom: 8px;">:</td><td style="text-align: right; padding-bottom: 8px;">${formatRupiah(uangMakan)}</td><td style="text-align: right; font-weight: bold; padding-bottom: 8px;">+</td></tr><tr><td style="font-weight: bold; padding-top: 8px;">Total</td><td style="font-weight: bold; padding-top: 8px;">:</td><td style="text-align: right; font-weight: bold; padding-top: 8px;">${formatRupiah(totalPendapatan)}</td><td></td></tr><tr><td colspan="4" style="height: 20px;"></td></tr><tr><td style="padding: 8px 0; font-weight: bold;" colspan="4">Pengurangan (-):</td></tr><tr><td style="padding-left: 15px;">Potongan Absensi</td><td>:</td><td style="text-align: right;">${formatRupiah(totalPotKehadiran)}</td><td></td></tr><tr><td style="padding-left: 15px;">Potongan Terlambat</td><td>:</td><td style="text-align: right;">${formatRupiah(totalPotTerlambat)}</td><td></td></tr><tr><td style="padding-left: 15px;">Hutang Karyawan</td><td>:</td><td style="text-align: right;">${formatRupiah(hutang)}</td><td></td></tr><tr><td colspan="4" style="height: 20px;"></td></tr><tr style="background: #f0f0f0; border-top: 2px solid black; border-bottom: 2px solid black;"><td style="font-weight: bold; padding: 10px;">Grand Total Gaji</td><td style="font-weight: bold; padding: 10px;">:</td><td style="text-align: right; font-weight: bold; padding: 10px;">${formatRupiah(grandTotal)}</td><td></td></tr></table>
                    <div style="margin-top: 50px; width: 200px; font-size: 14px;"><p style="margin-bottom: 70px;">Dibuat Oleh:</p><p style="font-weight: bold; text-decoration: underline; margin: 0;">Admin</p></div>
                </div>`;

            // Convert to JPG & Add to Zip
            const canvas = await html2canvas(wrapper, { scale: 1.5, backgroundColor: "#ffffff" });
            const imgData = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
            zip.file(`Slip_${emp.name.replace(/[^a-z0-9]/gi, '_')}.jpg`, imgData, {base64: true});
        }

        // Download Zip
        const content = await zip.generateAsync({type:"blob"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(content);
        a.download = `Slip_Gaji_All_${tglAwal}_${tglAkhir}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        console.error(e);
        alert("Gagal: " + e.message);
    } finally {
        document.body.removeChild(wrapper);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ================= BONUS LOGIC =================
function getBonusManualNames() {
    var key = getRbmStorageKey('RBM_BONUS_MANUAL_NAMES');
    var list = safeParse(localStorage.getItem(key), []);
    if (!Array.isArray(list)) return [];
    return list
        .map(function(x) { return (x || '').toString().trim(); })
        .filter(function(x) { return !!x; });
}

function rbmIsDeveloper() {
    try {
        var u = JSON.parse(localStorage.getItem('rbm_user') || '{}');
        return (u && (u.username || '').toString().toLowerCase() === 'burhan');
    } catch (e) {
        return false;
    }
}

function getAbsensiEmployeeOrder() {
    var key = getRbmStorageKey('RBM_ABSENSI_EMP_ORDER');
    var list = safeParse(localStorage.getItem(key), []);
    if (!Array.isArray(list)) return [];
    return list.map(function(x) { return (x || '').toString().trim(); }).filter(function(x) { return !!x; });
}

function setAbsensiEmployeeOrder(list) {
    var key = getRbmStorageKey('RBM_ABSENSI_EMP_ORDER');
    try { localStorage.setItem(key, JSON.stringify(list || [])); } catch (e) {}
}

function getAbsensiEmployeeIdentifier(emp) {
    if (!emp) return '';
    if (emp.id != null && emp.id !== '') return 'id:' + String(emp.id);
    var n = (emp.name || '').toString().trim();
    return n ? ('name:' + n) : '';
}

function getOrderedAbsensiEmployeesWithIndex(employees) {
    var list = [];
    (employees || []).forEach(function(emp, idx) {
        list.push({ emp: emp, idx: idx, ident: getAbsensiEmployeeIdentifier(emp) });
    });
    var order = getAbsensiEmployeeOrder();
    if (!order || !order.length) return list;

    var pos = {};
    order.forEach(function(id, i) { if (id && pos[id] == null) pos[id] = i; });
    list.sort(function(a, b) {
        var pa = (pos[a.ident] != null) ? pos[a.ident] : 999999;
        var pb = (pos[b.ident] != null) ? pos[b.ident] : 999999;
        if (pa !== pb) return pa - pb;
        // fallback: pertahankan urutan aslinya agar key berbasis index tetap aman
        return a.idx - b.idx;
    });
    return list;
}

function openAbsensiEmployeeOrderModal() {
    if (!rbmIsDeveloper()) {
        showCustomAlert('Akses ditolak. Hanya Developer yang bisa mengatur urutan karyawan.', 'Akses Ditolak', 'error');
        return;
    }
    var existing = document.getElementById('absensiEmployeeOrderModal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'absensiEmployeeOrderModal';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex; align-items:center; justify-content:center;';
    overlay.onclick = function() { overlay.remove(); };

    var box = document.createElement('div');
    box.className = 'modal-content';
    box.style.cssText = 'background:#fff; padding:18px; width:560px; max-width:95%; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.15); position:relative;';
    box.onclick = function(e) { e.stopPropagation(); };

    var title = document.createElement('h3');
    title.textContent = 'Atur Urutan Karyawan (Absensi/Jadwal)';
    title.style.cssText = 'margin:0 0 10px; font-size:18px;';

    var info = document.createElement('div');
    info.style.cssText = 'font-size:12px; color:#64748b; margin-bottom:10px; line-height:1.4;';
    info.innerHTML = 'Urutan ini mempengaruhi tabel <b>Absensi</b> dan <b>Jadwal</b> (tampilan). Disimpan per outlet. Aman untuk data lama karena key absensi tetap memakai index/id asli.';

    var listWrap = document.createElement('div');
    listWrap.style.cssText = 'max-height:55vh; overflow:auto; border:1px solid #e2e8f0; border-radius:10px;';

    var employees = (window._absensiViewEmployees && Array.isArray(window._absensiViewEmployees))
        ? window._absensiViewEmployees
        : getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);

    var items = (employees || []).map(function(emp, idx) {
        return { emp: emp, idx: idx, ident: getAbsensiEmployeeIdentifier(emp) };
    }).filter(function(x) { return !!x.ident; });

    var present = {};
    items.forEach(function(x) { present[x.ident] = x; });

    var existingOrder = getAbsensiEmployeeOrder();
    var order = (existingOrder && existingOrder.length)
        ? existingOrder.filter(function(id) { return !!present[id]; })
        : items.map(function(x) { return x.ident; });

    var render = function() {
        listWrap.innerHTML = '';
        order.forEach(function(id, index) {
            var item = present[id];
            if (!item) return;
            var emp = item.emp || {};

            var row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid #f1f5f9;';

            var nameEl = document.createElement('div');
            nameEl.style.cssText = 'flex:1; font-size:13px; color:#0f172a;';
            nameEl.innerHTML = '<div style="font-weight:600;">' + (emp.name || '-') + '</div>' +
                               '<div style="font-size:11px; color:#64748b;">' + (emp.jabatan || '') + '</div>';

            var up = document.createElement('button');
            up.type = 'button';
            up.className = 'btn btn-secondary';
            up.textContent = '⬆️';
            up.style.cssText = 'width:auto; padding:6px 10px;';
            up.disabled = index === 0;
            up.onclick = function() {
                var tmp = order[index - 1];
                order[index - 1] = order[index];
                order[index] = tmp;
                render();
            };

            var down = document.createElement('button');
            down.type = 'button';
            down.className = 'btn btn-secondary';
            down.textContent = '⬇️';
            down.style.cssText = 'width:auto; padding:6px 10px;';
            down.disabled = index === order.length - 1;
            down.onclick = function() {
                var tmp = order[index + 1];
                order[index + 1] = order[index];
                order[index] = tmp;
                render();
            };

            row.appendChild(nameEl);
            row.appendChild(up);
            row.appendChild(down);
            listWrap.appendChild(row);
        });
    };

    var footer = document.createElement('div');
    footer.style.cssText = 'display:flex; gap:8px; margin-top:12px;';

    var btnReset = document.createElement('button');
    btnReset.className = 'btn btn-secondary';
    btnReset.type = 'button';
    btnReset.textContent = 'Reset (Urutan Awal)';
    btnReset.onclick = function() {
        order = items.map(function(x) { return x.ident; });
        render();
    };

    var btnSave = document.createElement('button');
    btnSave.className = 'btn btn-primary';
    btnSave.type = 'button';
    btnSave.textContent = 'Simpan Urutan';
    btnSave.style.cssText = 'flex:1;';
    btnSave.onclick = function() {
        setAbsensiEmployeeOrder(order);
        overlay.remove();
        renderAbsensiTable(activeAbsensiMode);
        if (typeof AppPopup !== 'undefined') AppPopup.success('Urutan karyawan tersimpan.', 'Sukses');
        else alert('✅ Urutan karyawan tersimpan.');
    };

    var btnClose = document.createElement('button');
    btnClose.className = 'btn btn-secondary';
    btnClose.type = 'button';
    btnClose.textContent = 'Tutup';
    btnClose.onclick = function() { overlay.remove(); };

    footer.appendChild(btnReset);
    footer.appendChild(btnClose);
    footer.appendChild(btnSave);

    box.appendChild(title);
    box.appendChild(info);
    box.appendChild(listWrap);
    box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    render();
}

if (typeof openAbsensiEmployeeOrderModal !== 'undefined') window.openAbsensiEmployeeOrderModal = openAbsensiEmployeeOrderModal;

function getBonusNameOrder() {
    var key = getRbmStorageKey('RBM_BONUS_NAME_ORDER');
    var list = safeParse(localStorage.getItem(key), []);
    if (!Array.isArray(list)) return [];
    return list
        .map(function(x) { return (x || '').toString().trim(); })
        .filter(function(x) { return !!x; });
}

function setBonusNameOrder(list) {
    var key = getRbmStorageKey('RBM_BONUS_NAME_ORDER');
    try { localStorage.setItem(key, JSON.stringify(list || [])); } catch (e) {}
}

function getBonusAbsensiNameList() {
    var employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);

    // Urutan Bonus harus sama seperti tampilan Absensi/Jadwal,
    // jadi tidak memakai RBM_BONUS_MANUAL_NAMES maupun RBM_BONUS_NAME_ORDER.
    var ordered = (typeof getOrderedAbsensiEmployeesWithIndex === 'function')
        ? getOrderedAbsensiEmployeesWithIndex(employees)
        : (employees || []).map(function(emp, idx) { return { emp: emp, idx: idx }; });

    var names = (ordered || []).map(function(item) {
        var n = item && item.emp && item.emp.name ? item.emp.name : '';
        return n ? n.toString().trim() : '';
    }).filter(function(x) { return !!x; });

    // Unik-kan tanpa mengubah urutan
    var seen = {};
    var uniq = [];
    names.forEach(function(n) {
        if (!seen[n]) { seen[n] = true; uniq.push(n); }
    });
    return uniq;
}

function buildBonusAbsensiNameOptionsHtml(selectedName) {
    var names = getBonusAbsensiNameList();
    var sel = (selectedName || '').toString().trim();
    // Untuk data bonus lama: pastikan opsi tetap ada agar selectedName tetap tampil.
    if (sel && names.indexOf(sel) < 0) names.push(sel);
    var html = `<option value="">-- Pilih --</option>`;
    names.forEach(function(n) {
        html += `<option value="${n}" ${sel === n ? 'selected' : ''}>${n}</option>`;
    });
    return html;
}

function refreshBonusAbsensiSelectOptions() {
    document.querySelectorAll('select.bonus-absensi-name').forEach(function(sel) {
        var current = sel.value;
        sel.innerHTML = buildBonusAbsensiNameOptionsHtml(current);
        if (current) sel.value = current;
    });
}

function addBonusManualName() {
    // Fitur ini sudah dihapus dari UI.
    // Fungsi dibiarkan sebagai no-op agar tidak error jika masih ada referensi lama.
    return;
}

if (typeof addBonusManualName !== 'undefined') window.addBonusManualName = addBonusManualName;

function openBonusNameOrderModal() {
    if (!rbmIsDeveloper()) {
        showCustomAlert('Akses ditolak. Hanya Developer yang bisa mengatur urutan nama.', 'Akses Ditolak', 'error');
        return;
    }
    var existing = document.getElementById('bonusNameOrderModal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'bonusNameOrderModal';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex; align-items:center; justify-content:center;';
    overlay.onclick = function() { overlay.remove(); };

    var box = document.createElement('div');
    box.className = 'modal-content';
    box.style.cssText = 'background:#fff; padding:18px; width:520px; max-width:95%; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.15); position:relative;';
    box.onclick = function(e) { e.stopPropagation(); };

    var title = document.createElement('h3');
    title.textContent = 'Atur Urutan Nama (Bonus)';
    title.style.cssText = 'margin:0 0 10px; font-size:18px;';

    var info = document.createElement('div');
    info.style.cssText = 'font-size:12px; color:#64748b; margin-bottom:10px; line-height:1.4;';
    info.innerHTML = 'Urutan ini hanya mempengaruhi dropdown <b>Bonus Absensi</b> dan tersimpan per outlet. Nama yang tidak ada di daftar urutan akan tetap tampil alfabet di bawahnya.';

    var listWrap = document.createElement('div');
    listWrap.style.cssText = 'max-height:55vh; overflow:auto; border:1px solid #e2e8f0; border-radius:10px;';

    var allNames = getBonusAbsensiNameList(); // sudah termasuk manual + employee (dan sudah berurut)
    var order = getBonusNameOrder();
    // Jika order kosong, inisialisasi dengan urutan saat ini (supaya bisa dipindah)
    if (!order || !order.length) order = allNames.slice();

    // Buat list yang hanya berisi nama yang masih ada
    var present = {};
    allNames.forEach(function(n) { present[n] = true; });
    order = order.filter(function(n) { return present[n]; });

    var render = function() {
        listWrap.innerHTML = '';
        order.forEach(function(n, idx) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid #f1f5f9;';

            var nameEl = document.createElement('div');
            nameEl.textContent = n;
            nameEl.style.cssText = 'flex:1; font-size:13px; color:#0f172a;';

            var up = document.createElement('button');
            up.type = 'button';
            up.className = 'btn btn-secondary';
            up.textContent = '⬆️';
            up.style.cssText = 'width:auto; padding:6px 10px;';
            up.disabled = idx === 0;
            up.onclick = function() {
                var tmp = order[idx - 1];
                order[idx - 1] = order[idx];
                order[idx] = tmp;
                render();
            };

            var down = document.createElement('button');
            down.type = 'button';
            down.className = 'btn btn-secondary';
            down.textContent = '⬇️';
            down.style.cssText = 'width:auto; padding:6px 10px;';
            down.disabled = idx === order.length - 1;
            down.onclick = function() {
                var tmp = order[idx + 1];
                order[idx + 1] = order[idx];
                order[idx] = tmp;
                render();
            };

            row.appendChild(nameEl);
            row.appendChild(up);
            row.appendChild(down);
            listWrap.appendChild(row);
        });
    };

    var footer = document.createElement('div');
    footer.style.cssText = 'display:flex; gap:8px; margin-top:12px;';

    var btnReset = document.createElement('button');
    btnReset.className = 'btn btn-secondary';
    btnReset.type = 'button';
    btnReset.textContent = 'Reset (Alfabet)';
    btnReset.onclick = function() {
        order = allNames.slice().sort(function(a, b) { return String(a).localeCompare(String(b)); });
        render();
    };

    var btnSave = document.createElement('button');
    btnSave.className = 'btn btn-primary';
    btnSave.type = 'button';
    btnSave.textContent = 'Simpan Urutan';
    btnSave.style.cssText = 'flex:1;';
    btnSave.onclick = function() {
        setBonusNameOrder(order);
        refreshBonusAbsensiSelectOptions();
        overlay.remove();
        if (typeof AppPopup !== 'undefined') AppPopup.success('Urutan nama tersimpan.', 'Sukses');
        else alert('✅ Urutan nama tersimpan.');
    };

    var btnClose = document.createElement('button');
    btnClose.className = 'btn btn-secondary';
    btnClose.type = 'button';
    btnClose.textContent = 'Tutup';
    btnClose.onclick = function() { overlay.remove(); };

    footer.appendChild(btnReset);
    footer.appendChild(btnClose);
    footer.appendChild(btnSave);

    box.appendChild(title);
    box.appendChild(info);
    box.appendChild(listWrap);
    box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    render();
}

if (typeof openBonusNameOrderModal !== 'undefined') window.openBonusNameOrderModal = openBonusNameOrderModal;

function renderBonusTab() {
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    if (!tglAwal || !tglAkhir) return;

    const key = getRbmStorageKey('RBM_BONUS_' + tglAwal + '_' + tglAkhir);
    const savedData = getCachedParsedStorage(key, { absensi: [], omset: { total: 0, persen: 2, pool: 0, excludedIds: [], manualNominals: {}, extraName: '', extraNominal: 0 } });
    const omsetData = savedData.omset || { total: 0, persen: 2, pool: 0, excludedIds: [], manualNominals: {}, extraName: '', extraNominal: 0 };
    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);

    // Tombol Atur Urutan hanya untuk Developer
    try {
        var btnOrder = document.getElementById('bonus_order_btn');
        if (btnOrder) btnOrder.style.display = rbmIsDeveloper() ? '' : 'none';
    } catch (e) {}

    // --- 1. Render Bonus Absensi ---
    const absensiTbody = document.getElementById("bonus_absensi_tbody");
    absensiTbody.innerHTML = "";
    
    // Helper to create row
    const createRow = (data = {}) => {
        const tr = document.createElement("tr");
        let options = buildBonusAbsensiNameOptionsHtml(data.name);

        tr.innerHTML = `
            <td><select class="bonus-absensi-name" style="width:100%; padding:5px;">${options}</select></td>
            <td><input type="text" class="bonus-absensi-nominal" value="${data.nominal ? formatRupiah(data.nominal) : ''}" oninput="formatRupiahInput(this); calculateBonusAbsensiTotal()" style="width:100%; padding:5px; text-align:right;"></td>
            <td><input type="text" class="bonus-absensi-ket" value="${data.keterangan || ''}" placeholder="Ket..." style="width:100%; padding:5px;"></td>
            <td><button class="btn-small-danger" onclick="this.closest('tr').remove(); calculateBonusAbsensiTotal()">x</button></td>
        `;
        absensiTbody.appendChild(tr);
    };

    if (savedData.absensi && savedData.absensi.length > 0) {
        savedData.absensi.forEach(item => createRow(item));
    } else {
        createRow(); // Empty row
    }
    calculateBonusAbsensiTotal();

    // --- 2. Render Bonus Omset ---
    document.getElementById("bonus_omset_total").value = omsetData.total ? formatRupiah(omsetData.total) : "";
    document.getElementById("bonus_omset_persen").value = omsetData.persen !== undefined ? omsetData.persen : 2;
    document.getElementById("bonus_omset_pool").value = omsetData.pool ? formatRupiah(omsetData.pool) : "";
    
    const extraNameEl = document.getElementById("bonus_omset_extra_name");
    const extraNomEl = document.getElementById("bonus_omset_extra_nominal");
    if (extraNameEl) extraNameEl.value = omsetData.extraName || '';
    if (extraNomEl) extraNomEl.value = omsetData.extraNominal ? formatRupiah(omsetData.extraNominal) : '';

    const omsetTbody = document.getElementById("bonus_omset_tbody");
    omsetTbody.innerHTML = "";
    
    employees.forEach(emp => {
        const isExcluded = (omsetData.excludedIds || []).includes(emp.id);
        const savedNominal = (omsetData.manualNominals && omsetData.manualNominals[emp.id] !== undefined) ? omsetData.manualNominals[emp.id] : null;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${emp.name}<br><span style="font-size:10px; color:#666;">${emp.jabatan}</span></td>
            <td style="text-align:center;">
                <input type="checkbox" class="bonus-omset-check" value="${emp.id}" ${!isExcluded ? 'checked' : ''} onchange="calculateBonusOmsetFromPool()">
            </td>
            <td style="text-align:right;" class="bonus-omset-nominal-display">${savedNominal !== null ? formatRupiah(savedNominal) : '-'}</td>
        `;
        omsetTbody.appendChild(tr);
    });
    if (omsetData.manualNominals && Object.keys(omsetData.manualNominals).length > 0) {
        // Biarkan data manual
    } else if (omsetData.pool > 0) {
        calculateBonusOmsetFromPool();
    } else {
        calculateBonusOmset();
    }
}

function addBonusAbsensiRow() {
    const tbody = document.getElementById("bonus_absensi_tbody");
    const tr = document.createElement("tr");
    let options = buildBonusAbsensiNameOptionsHtml('');

    tr.innerHTML = `
        <td><select class="bonus-absensi-name" style="width:100%; padding:5px;">${options}</select></td>
        <td><input type="text" class="bonus-absensi-nominal" oninput="formatRupiahInput(this); calculateBonusAbsensiTotal()" style="width:100%; padding:5px; text-align:right;"></td>
        <td><input type="text" class="bonus-absensi-ket" placeholder="Ket..." style="width:100%; padding:5px;"></td>
        <td><button class="btn-small-danger" onclick="this.closest('tr').remove(); calculateBonusAbsensiTotal()">x</button></td>
    `;
    tbody.appendChild(tr);
}

function calculateBonusAbsensiTotal() {
    let total = 0;
    document.querySelectorAll(".bonus-absensi-nominal").forEach(input => {
        const val = parseInt(input.value.replace(/[^0-9]/g, '')) || 0;
        total += val;
    });
    document.getElementById("bonus_absensi_total").innerText = formatRupiah(total);
}

function calculateBonusOmsetFromPool() {
    const poolStr = document.getElementById("bonus_omset_pool").value;
    const pool = parseInt(poolStr.replace(/[^0-9]/g, '')) || 0;

    const checkboxes = document.querySelectorAll(".bonus-omset-check:checked");
    const count = checkboxes.length;
    const perPerson = count > 0 ? Math.round(pool / count) : 0;

    document.querySelectorAll(".bonus-omset-nominal-display").forEach(el => el.innerText = "Rp 0");
    checkboxes.forEach(cb => {
        const row = cb.closest("tr");
        row.querySelector(".bonus-omset-nominal-display").innerText = formatRupiah(perPerson);
    });
}

function calculateBonusOmset() {
    const omsetStr = document.getElementById("bonus_omset_total").value;
    const omset = parseInt(omsetStr.replace(/[^0-9]/g, '')) || 0;
    const persen = parseFloat(document.getElementById("bonus_omset_persen").value) || 0;
    
    const pool = Math.round(omset * (persen / 100));
    document.getElementById("bonus_omset_pool").value = formatRupiah(pool);

    calculateBonusOmsetFromPool();
}

function saveBonusData() {
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    if (!tglAwal || !tglAkhir) { alert("Pilih tanggal terlebih dahulu."); return; }

    const absensiData = [];
    document.querySelectorAll("#bonus_absensi_tbody tr").forEach(tr => {
        const nameSel = tr.querySelector(".bonus-absensi-name");
        if (!nameSel) return;
        const name = nameSel.value;
        const nominal = parseInt(tr.querySelector(".bonus-absensi-nominal").value.replace(/[^0-9]/g, '')) || 0;
        const keterangan = tr.querySelector(".bonus-absensi-ket").value;
        if (name) absensiData.push({ name, nominal, keterangan });
    });

    const omsetTotal = parseInt(document.getElementById("bonus_omset_total").value.replace(/[^0-9]/g, '')) || 0;
    const omsetPersen = parseFloat(document.getElementById("bonus_omset_persen").value) || 0;
    const omsetPool = parseInt(document.getElementById("bonus_omset_pool").value.replace(/[^0-9]/g, '')) || 0;
    const excludedIds = [];
    const manualNominals = {};
    document.querySelectorAll("#bonus_omset_tbody tr").forEach(tr => {
        const cb = tr.querySelector(".bonus-omset-check");
        if (cb && !cb.checked) excludedIds.push(parseInt(cb.value));
        
        const inputEl = tr.querySelector(".bonus-nominal-input");
        const nomEl = tr.querySelector(".bonus-omset-nominal-display");
        const valText = inputEl ? inputEl.value : (nomEl ? nomEl.textContent : "");
        const nominal = parseInt(valText.replace(/[^0-9]/g, '')) || 0;
        
        if (cb && cb.value) {
            manualNominals[cb.value] = nominal;
        }
    });
    
    const extraNameEl = document.getElementById("bonus_omset_extra_name");
    const extraNomEl = document.getElementById("bonus_omset_extra_nominal");
    const extraName = extraNameEl ? extraNameEl.value : "";
    const extraNominal = extraNomEl ? (parseInt(extraNomEl.value.replace(/[^0-9]/g, '')) || 0) : 0;

    const data = { absensi: absensiData, omset: { total: omsetTotal, persen: omsetPersen, pool: omsetPool, excludedIds, manualNominals, extraName, extraNominal } };
    RBMStorage.setItem(getRbmStorageKey('RBM_BONUS_' + tglAwal + '_' + tglAkhir), JSON.stringify(data));
    window._rbmParsedCache[getRbmStorageKey('RBM_BONUS_' + tglAwal + '_' + tglAkhir)] = { data: data };
    if (typeof AppPopup !== 'undefined') AppPopup.success("Data Bonus tersimpan.", "Sukses");
    else alert("✅ Data Bonus tersimpan.");
}

function exportBonusAbsensiExcel() {
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    const rows = document.querySelectorAll("#bonus_absensi_tbody tr");
    const total = document.getElementById("bonus_absensi_total").innerText;

    let xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += '<Styles><Style ss:ID="sHeader"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1e40af" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="sData"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style></Styles>';
    xml += '<Worksheet ss:Name="Bonus Absensi"><Table>';
    xml += '<Column ss:Width="30"/><Column ss:Width="150"/><Column ss:Width="100"/><Column ss:Width="150"/>';
    
    xml += `<Row><Cell ss:MergeAcross="3" ss:StyleID="sHeader"><Data ss:Type="String">LAPORAN BONUS ABSENSI (${tglAwal} s/d ${tglAkhir})</Data></Cell></Row>`;
    xml += '<Row><Cell ss:StyleID="sHeader"><Data ss:Type="String">No</Data></Cell><Cell ss:StyleID="sHeader"><Data ss:Type="String">Nama</Data></Cell><Cell ss:StyleID="sHeader"><Data ss:Type="String">Nominal</Data></Cell><Cell ss:StyleID="sHeader"><Data ss:Type="String">Keterangan</Data></Cell></Row>';

    rows.forEach((tr, i) => {
        const name = tr.querySelector(".bonus-absensi-name").value;
        const nominal = tr.querySelector(".bonus-absensi-nominal").value;
        const ket = tr.querySelector(".bonus-absensi-ket").value;
        if(name) {
            xml += `<Row><Cell ss:StyleID="sData"><Data ss:Type="Number">${i+1}</Data></Cell><Cell ss:StyleID="sData"><Data ss:Type="String">${name}</Data></Cell><Cell ss:StyleID="sData"><Data ss:Type="String">${nominal}</Data></Cell><Cell ss:StyleID="sData"><Data ss:Type="String">${ket}</Data></Cell></Row>`;
        }
    });

    xml += `<Row><Cell></Cell><Cell><Data ss:Type="String">TOTAL</Data></Cell><Cell><Data ss:Type="String">${total}</Data></Cell></Row>`;
    xml += '</Table></Worksheet></Workbook>';

    const blob = new Blob([xml], {type: 'application/vnd.ms-excel'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Bonus_Absensi_${tglAwal}_${tglAkhir}.xls`;
    a.click();
}

function exportBonusAbsensiPDF() {
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    const rows = document.querySelectorAll("#bonus_absensi_tbody tr");
    const total = document.getElementById("bonus_absensi_total").innerText;

    let html = `<html><head><title>Bonus Absensi</title><style>body{font-family:sans-serif;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ccc;padding:8px;} th{background:#1e40af;color:white;}</style></head><body>`;
    html += `<h2 style="text-align:center;">Laporan Bonus Absensi</h2><p style="text-align:center;">Periode: ${tglAwal} s/d ${tglAkhir}</p>`;
    html += `<table><thead><tr><th>No</th><th>Nama</th><th>Nominal</th><th>Keterangan</th></tr></thead><tbody>`;
    
    let no = 1;
    rows.forEach(tr => {
        const name = tr.querySelector(".bonus-absensi-name").value;
        const nominal = tr.querySelector(".bonus-absensi-nominal").value;
        const ket = tr.querySelector(".bonus-absensi-ket").value;
        if(name) {
            html += `<tr><td style="text-align:center;">${no++}</td><td>${name}</td><td style="text-align:right;">${nominal}</td><td>${ket}</td></tr>`;
        }
    });
    html += `<tr><td colspan="2" style="text-align:right;font-weight:bold;">TOTAL</td><td style="text-align:right;font-weight:bold;">${total}</td><td></td></tr>`;
    html += `</tbody></table></body></html>`;

    const win = window.open('', '', 'height=600,width=800');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
}

function exportBonusOmsetExcel() {
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    const omset = document.getElementById("bonus_omset_total").value;
    const persen = document.getElementById("bonus_omset_persen").value;
    const pool = document.getElementById("bonus_omset_pool").value;
    const rows = document.querySelectorAll("#bonus_omset_tbody tr");

    let xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += '<Styles><Style ss:ID="sHeader"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#059669" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="sData"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style></Styles>';
    xml += '<Worksheet ss:Name="Bonus Omset"><Table>';
    xml += '<Column ss:Width="30"/><Column ss:Width="150"/><Column ss:Width="80"/><Column ss:Width="100"/>';
    
    xml += `<Row><Cell ss:MergeAcross="3" ss:StyleID="sHeader"><Data ss:Type="String">LAPORAN BONUS OMSET (${tglAwal} s/d ${tglAkhir})</Data></Cell></Row>`;
    xml += `<Row><Cell><Data ss:Type="String">Total Omset:</Data></Cell><Cell><Data ss:Type="String">${omset}</Data></Cell></Row>`;
    xml += `<Row><Cell><Data ss:Type="String">Persentase:</Data></Cell><Cell><Data ss:Type="String">${persen}%</Data></Cell></Row>`;
    xml += `<Row><Cell><Data ss:Type="String">Total Dibagi:</Data></Cell><Cell><Data ss:Type="String">${pool}</Data></Cell></Row>`;
    xml += '<Row></Row>';

    xml += '<Row><Cell ss:StyleID="sHeader"><Data ss:Type="String">No</Data></Cell><Cell ss:StyleID="sHeader"><Data ss:Type="String">Nama</Data></Cell><Cell ss:StyleID="sHeader"><Data ss:Type="String">Status</Data></Cell><Cell ss:StyleID="sHeader"><Data ss:Type="String">Nominal</Data></Cell></Row>';

    rows.forEach((tr, i) => {
        const nameHtml = tr.cells[0].innerHTML;
        const name = nameHtml.split('<br>')[0]; // Ambil nama saja
        const checked = tr.querySelector(".bonus-omset-check").checked;
        const inputEl = tr.querySelector(".bonus-nominal-input");
        const nomEl = tr.querySelector(".bonus-omset-nominal-display");
        const nominal = inputEl ? inputEl.value : (nomEl ? nomEl.textContent : "");
        
        xml += `<Row><Cell ss:StyleID="sData"><Data ss:Type="Number">${i+1}</Data></Cell><Cell ss:StyleID="sData"><Data ss:Type="String">${name}</Data></Cell><Cell ss:StyleID="sData"><Data ss:Type="String">${checked ? 'Dapat' : 'Tidak'}</Data></Cell><Cell ss:StyleID="sData"><Data ss:Type="String">${nominal}</Data></Cell></Row>`;
    });
    
    const extraNameEl = document.getElementById("bonus_omset_extra_name");
    const extraNomEl = document.getElementById("bonus_omset_extra_nominal");
    if (extraNameEl || extraNomEl) {
        const eName = extraNameEl ? extraNameEl.value : "Lain-lain";
        const eNominal = extraNomEl ? extraNomEl.value : "Rp 0";
        xml += `<Row><Cell ss:StyleID="sData"><Data ss:Type="Number">-</Data></Cell><Cell ss:StyleID="sData"><Data ss:Type="String">${eName}</Data></Cell><Cell ss:StyleID="sData"><Data ss:Type="String">-</Data></Cell><Cell ss:StyleID="sData"><Data ss:Type="String">${eNominal}</Data></Cell></Row>`;
    }

    xml += '</Table></Worksheet></Workbook>';

    const blob = new Blob([xml], {type: 'application/vnd.ms-excel'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Bonus_Omset_${tglAwal}_${tglAkhir}.xls`;
    a.click();
}

function exportBonusOmsetPDF() {
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    const omset = document.getElementById("bonus_omset_total").value;
    const persen = document.getElementById("bonus_omset_persen").value;
    const pool = document.getElementById("bonus_omset_pool").value;
    const rows = document.querySelectorAll("#bonus_omset_tbody tr");

    let html = `<html><head><title>Bonus Omset</title><style>body{font-family:sans-serif;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ccc;padding:8px;} th{background:#059669;color:white;}</style></head><body>`;
    html += `<h2 style="text-align:center;">Laporan Bonus Omset</h2><p style="text-align:center;">Periode: ${tglAwal} s/d ${tglAkhir}</p>`;
    
    html += `<div style="margin-bottom:20px; padding:10px; border:1px solid #ddd; background:#f9f9f9;">`;
    html += `<strong>Total Omset:</strong> ${omset}<br>`;
    html += `<strong>Persentase:</strong> ${persen}%<br>`;
    html += `<strong>Total Dibagi:</strong> ${pool}`;
    html += `</div>`;

    html += `<table><thead><tr><th>No</th><th>Nama</th><th>Status</th><th>Nominal</th></tr></thead><tbody>`;
    
    rows.forEach((tr, i) => {
        const nameHtml = tr.cells[0].innerHTML;
        const name = nameHtml.split('<br>')[0];
        const checked = tr.querySelector(".bonus-omset-check").checked;
        const inputEl = tr.querySelector(".bonus-nominal-input");
        const nomEl = tr.querySelector(".bonus-omset-nominal-display");
        const nominal = inputEl ? inputEl.value : (nomEl ? nomEl.textContent : "");
        
        html += `<tr><td style="text-align:center;">${i+1}</td><td>${name}</td><td style="text-align:center;">${checked ? '✅' : '-'}</td><td style="text-align:right;">${nominal}</td></tr>`;
    });
    
    const extraNameEl = document.getElementById("bonus_omset_extra_name");
    const extraNomEl = document.getElementById("bonus_omset_extra_nominal");
    if (extraNameEl || extraNomEl) {
        const eName = extraNameEl ? extraNameEl.value : "Lain-lain";
        const eNominal = extraNomEl ? extraNomEl.value : "Rp 0";
        html += `<tr style="background:#f1f5f9;"><td style="text-align:center;">-</td><td>${eName}</td><td style="text-align:center;">-</td><td style="text-align:right; font-weight:bold;">${eNominal}</td></tr>`;
    }
    
    html += `</tbody></table></body></html>`;

    const win = window.open('', '', 'height=600,width=800');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
}

async function submitBonusAbsensiPengajuan() {
    const period = _getAbsensiGajiPeriod();
    if (!period) return alert('Pilih periode tanggal terlebih dahulu.');

    if (typeof FirebaseStorage === 'undefined' || !FirebaseStorage.init || !FirebaseStorage.init()) {
        return alert('Pengajuan hanya tersedia di mode Online (Firebase).');
    }

    openRekeningPencairanModal(async (rekInfo) => {
        try {
            const outletId = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || 'default';
            const { tglAwal, tglAkhir, monthKey } = period;

            let totalGrand = 0;
            const items = [];
            
            document.querySelectorAll("#bonus_absensi_tbody tr").forEach((tr, idx) => {
                const nameSel = tr.querySelector(".bonus-absensi-name");
                const nomInput = tr.querySelector(".bonus-absensi-nominal");
                const ketInput = tr.querySelector(".bonus-absensi-ket");
                if (!nameSel || !nomInput) return;
                
                const name = nameSel.value;
                const nominal = parseInt(nomInput.value.replace(/[^0-9]/g, '')) || 0;
                const keterangan = ketInput ? ketInput.value : '-';
                
                if (name && nominal > 0) {
                    totalGrand += nominal;
                    const employees = window._absensiViewEmployees || getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
                    const emp = employees.find(e => e.name === name);
                    const empId = emp ? (emp.id != null ? emp.id : idx) : idx;
                    
                    items.push({ empId: empId, nama: name, jabatan: emp ? emp.jabatan : '-', grandTotal: nominal, metodeBayar: 'TF', keterangan: keterangan });
                }
            });

            if (totalGrand === 0) {
                if(!confirm("Total bonus absensi adalah Rp 0. Lanjutkan pengajuan?")) return;
            }

            const u = _getCurrentUser();
            const requester = (u && (u.username || u.nama)) ? (u.username || u.nama) : 'unknown';
            const note = `Pengajuan BONUS ABSENSI periode ${tglAwal} s/d ${tglAkhir}`;

            await FirebaseStorage.saveGajiPengajuan({ 
                outletId, monthKey, periodStart: tglAwal, periodEnd: tglAkhir, requester, totalGrand, note,
                bank: rekInfo.bank, rekening: rekInfo.rekening, atasnama: rekInfo.atasnama 
            }, items);
            if (typeof showCustomAlert !== 'undefined') showCustomAlert('Pengajuan Bonus Absensi berhasil dikirim ke Owner.', 'Sukses', 'success');
            else alert('Pengajuan Bonus Absensi berhasil dikirim ke Owner.');
            
            if (window.self !== window.top) {
                window.parent.postMessage({ type: 'REFRESH_NOTIFS' }, '*');
            }
        } catch (e) {
            console.error(e);
            if (typeof showCustomAlert !== 'undefined') showCustomAlert('Gagal mengajukan: ' + (e.message || e), 'Error', 'error');
            else alert('Gagal mengajukan: ' + (e.message || e));
        }
    });
}

async function submitBonusOmsetPengajuan() {
    const period = _getAbsensiGajiPeriod();
    if (!period) return alert('Pilih periode tanggal terlebih dahulu.');

    if (typeof FirebaseStorage === 'undefined' || !FirebaseStorage.init || !FirebaseStorage.init()) {
        return alert('Pengajuan hanya tersedia di mode Online (Firebase).');
    }

    openRekeningPencairanModal(async (rekInfo) => {
        try {
            const outletId = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || 'default';
            const { tglAwal, tglAkhir, monthKey } = period;

            let totalGrand = 0;
            const items = [];
            
            document.querySelectorAll("#bonus_omset_tbody tr").forEach((tr, idx) => {
                if (!tr.cells || tr.cells.length < 3) return;
                const nameHtml = tr.cells[0].innerHTML;
                const name = nameHtml.split('<br>')[0].trim();
                const jabatanHtml = tr.cells[0].querySelector('span');
                const jabatan = jabatanHtml ? jabatanHtml.textContent : '-';
                
                const checkEl = tr.querySelector(".bonus-omset-check");
                const checked = checkEl ? checkEl.checked : false;
                
                const inputEl = tr.querySelector(".bonus-nominal-input");
                const nomEl = tr.querySelector(".bonus-omset-nominal-display");
                const valText = inputEl ? inputEl.value : (nomEl ? nomEl.textContent : "");
                const nominal = parseInt(valText.replace(/[^0-9]/g, '')) || 0;
                
                if (checked && nominal > 0) {
                    totalGrand += nominal;
                    const employees = window._absensiViewEmployees || getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
                    const emp = employees.find(e => e.name === name);
                    const empId = emp ? (emp.id != null ? emp.id : idx) : idx;
                    
                    items.push({ empId: empId, nama: name, jabatan: jabatan, grandTotal: nominal, metodeBayar: 'TF', keterangan: 'Bonus Omset' });
                }
            });
            
            const extraNameEl = document.getElementById("bonus_omset_extra_name");
            const extraNomEl = document.getElementById("bonus_omset_extra_nominal");
            const extraNominal = extraNomEl ? (parseInt(extraNomEl.value.replace(/[^0-9]/g, '')) || 0) : 0;
            if (extraNominal > 0) {
                totalGrand += extraNominal;
                items.push({ empId: 'extra', nama: extraNameEl ? extraNameEl.value || 'Lainnya' : 'Lainnya', jabatan: '-', grandTotal: extraNominal, metodeBayar: 'TF', keterangan: 'Bonus Omset (Extra)' });
            }

            if (totalGrand === 0) {
                if(!confirm("Total bonus omset adalah Rp 0. Lanjutkan pengajuan?")) return;
            }

            const omsetTotal = document.getElementById("bonus_omset_total").value || "Rp 0";
            const omsetPersen = document.getElementById("bonus_omset_persen").value || "0";
            const omsetPool = document.getElementById("bonus_omset_pool").value || "Rp 0";

            const u = _getCurrentUser();
            const requester = (u && (u.username || u.nama)) ? (u.username || u.nama) : 'unknown';
            const note = `Pengajuan BONUS OMSET periode ${tglAwal} s/d ${tglAkhir}<br><span style="font-size:11px; color:#475569;">&bull; Total Omset: <b>${omsetTotal}</b><br>&bull; Persentase: <b>${omsetPersen}%</b><br>&bull; Total Dibagi: <b>${omsetPool}</b></span>`;

            await FirebaseStorage.saveGajiPengajuan({ 
                outletId, monthKey, periodStart: tglAwal, periodEnd: tglAkhir, requester, totalGrand, note,
                bank: rekInfo.bank, rekening: rekInfo.rekening, atasnama: rekInfo.atasnama 
            }, items);
            if (typeof showCustomAlert !== 'undefined') showCustomAlert('Pengajuan Bonus Omset berhasil dikirim ke Owner.', 'Sukses', 'success');
            else alert('Pengajuan Bonus Omset berhasil dikirim ke Owner.');
            
            if (window.self !== window.top) {
                window.parent.postMessage({ type: 'REFRESH_NOTIFS' }, '*');
            }
        } catch (e) {
            console.error(e);
            if (typeof showCustomAlert !== 'undefined') showCustomAlert('Gagal mengajukan: ' + (e.message || e), 'Error', 'error');
            else alert('Gagal mengajukan: ' + (e.message || e));
        }
    });
}

// ================= RESERVASI LOGIC =================
function submitReservasi() {
    const pj = document.getElementById("res_pj").value;
    const nama = document.getElementById("res_nama").value;
    const wa = document.getElementById("res_wa").value;
    const tanggal = document.getElementById("res_tanggal").value;
    const jamMulai = document.getElementById("res_jam_mulai").value;
    const jamSelesai = document.getElementById("res_jam_selesai").value;
    const jmlTamu = document.getElementById("res_jml_tamu").value;
    const ruangan = document.getElementById("res_ruangan").value;
    const meja = document.getElementById("res_meja").value;
    const fasilitas = document.getElementById("res_fasilitas").value;
    const dp = document.getElementById("res_dp").value;

    if (!nama || !tanggal || !jamMulai) {
        alert("Nama, Tanggal, dan Jam Mulai wajib diisi!");
        return;
    }

    const reservasiData = getCachedParsedStorage(getRbmStorageKey('RBM_RESERVASI_DATA'), []);
    // Generate ID: RES + Timestamp
    const timestamp = new Date().toISOString();
    const id = "RES-" + Date.now().toString().slice(-6);

    const newRes = {
        id, pj, timestamp, nama, tanggal, jamMulai, jamSelesai, wa, jmlTamu, ruangan, meja, fasilitas, dp
    };

    reservasiData.push(newRes);
    RBMStorage.setItem(getRbmStorageKey('RBM_RESERVASI_DATA'), JSON.stringify(reservasiData));
    window._rbmParsedCache[getRbmStorageKey('RBM_RESERVASI_DATA')] = { data: reservasiData };
    
    alert("✅ Reservasi Berhasil Disimpan!");
    
    // Reset Form
    document.getElementById("res_nama").value = "";
    document.getElementById("res_wa").value = "";
    document.getElementById("res_jml_tamu").value = "";
    document.getElementById("res_meja").value = "";
    document.getElementById("res_fasilitas").value = "";
    document.getElementById("res_dp").value = "";
    
    loadReservasiData();
    renderReservasiCalendar();
}

function loadReservasiData() {
    const tglAwal = document.getElementById("res_filter_start").value;
    const tglAkhir = document.getElementById("res_filter_end").value;
    const tbody = document.getElementById("reservasi_tbody");
    
    const allData = getCachedParsedStorage(getRbmStorageKey('RBM_RESERVASI_DATA'), []);
    
    // Filter by date range
    const filtered = allData.filter(d => d.tanggal >= tglAwal && d.tanggal <= tglAkhir);
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Tidak ada data reservasi pada rentang tanggal ini.</td></tr>';
        return;
    }

    // Sort by date desc
    filtered.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    let html = '';
    filtered.forEach((res, idx) => {
        html += `<tr>
            <td><span style="font-size:11px; font-weight:bold; color:#1e40af;">${res.id}</span></td>
            <td>${res.tanggal}</td>
            <td>${res.nama}<br><span style="font-size:10px; color:#666;">${res.wa}</span></td>
            <td>${res.jamMulai} - ${res.jamSelesai}</td>
            <td style="text-align:center;">${res.jmlTamu}</td>
            <td>${res.ruangan}</td>
            <td style="text-align:right;">${formatRupiah(res.dp)}</td>
            <td>
                <button class="btn-small-danger" style="background:#0d6efd;" onclick="printReservasiBill('${res.id}')">Print Bill</button>
                ${window.rbmOnlyOwnerCanEditDelete && window.rbmOnlyOwnerCanEditDelete() ? '<button class="btn-small-danger" onclick="deleteReservasi(\'' + res.id + '\')">Hapus</button>' : '-'}
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function deleteReservasi(id) {
    if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat menghapus data.', 'Akses Ditolak', 'error'); return; }
    showCustomConfirm("Hapus data reservasi ini?", "Konfirmasi Hapus", function() {
        let allData = getCachedParsedStorage(getRbmStorageKey('RBM_RESERVASI_DATA'), []);
        allData = allData.filter(d => d.id !== id);
        RBMStorage.setItem(getRbmStorageKey('RBM_RESERVASI_DATA'), JSON.stringify(allData));
        window._rbmParsedCache[getRbmStorageKey('RBM_RESERVASI_DATA')] = { data: allData };
        loadReservasiData();
        renderReservasiCalendar();
    });
}

function printReservasiBill(id) {
    const allData = getCachedParsedStorage(getRbmStorageKey('RBM_RESERVASI_DATA'), []);
    const res = allData.find(d => d.id === id);
    if (!res) return;

    const win = window.open('', '', 'height=600,width=400');
    const html = `
    <html><head><title>Bill Reservasi</title>
    <style>
        body { font-family: 'Courier New', monospace; padding: 20px; font-size: 12px; color: #000; }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
        .row { display: flex; margin-bottom: 5px; }
        .label { width: 100px; font-weight: bold; }
        .val { flex: 1; }
        .footer { text-align: center; margin-top: 20px; border-top: 2px dashed #000; padding-top: 10px; }
    </style>
    </head><body>
        <div class="header">
            <h2 style="margin:0;">RICE BOWL MONSTERS</h2>
            <p style="margin:5px 0;">BUKTI RESERVASI</p>
            <p style="margin:0; font-size:10px;">ID: ${res.id}</p>
        </div>
        <div class="row"><div class="label">PJ</div><div class="val">: ${res.pj}</div></div>
        <div class="row"><div class="label">Tgl Pesan</div><div class="val">: ${new Date(res.timestamp).toLocaleDateString('id-ID')}</div></div>
        <br>
        <div class="row"><div class="label">Nama</div><div class="val">: ${res.nama}</div></div>
        <div class="row"><div class="label">No WA</div><div class="val">: ${res.wa}</div></div>
        <div class="row"><div class="label">Tgl Acara</div><div class="val">: ${res.tanggal}</div></div>
        <div class="row"><div class="label">Waktu</div><div class="val">: ${res.jamMulai} s/d ${res.jamSelesai}</div></div>
        <div class="row"><div class="label">Jml Tamu</div><div class="val">: ${res.jmlTamu} Orang</div></div>
        <div class="row"><div class="label">Ruangan</div><div class="val">: ${res.ruangan}</div></div>
        <div class="row"><div class="label">Meja</div><div class="val">: ${res.meja}</div></div>
        <div class="row"><div class="label">Fasilitas</div><div class="val">: ${res.fasilitas}</div></div>
        <br>
        <div class="row" style="font-size:14px; font-weight:bold;">
            <div class="label">DP MASUK</div>
            <div class="val">: ${formatRupiah(res.dp)}</div>
        </div>
        <div class="footer">
            <p>Terima Kasih atas Reservasi Anda</p>
            <p style="font-size:10px;">Harap simpan bukti ini</p>
        </div>
    </body></html>`;
    
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
}

let calCurrentDate = new Date();

function renderReservasiCalendar() {
    const grid = document.getElementById('calendar_grid');
    const monthYear = document.getElementById('cal_month_year');
    if (!grid || !monthYear) return;

    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();
    
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    monthYear.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    let html = '';
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    days.forEach(d => html += `<div class="calendar-day-header">${d}</div>`);

    // Previous month filler
    for (let i = 0; i < startDayOfWeek; i++) {
        html += `<div class="calendar-day other-month"></div>`;
    }

    const reservasiData = getCachedParsedStorage(getRbmStorageKey('RBM_RESERVASI_DATA'), []);

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const isToday = (dateStr === getLocalDateKey(new Date()));
        
        // Find events
        const events = reservasiData.filter(r => r.tanggal === dateStr);
        
        let eventsHtml = '';
        events.forEach(ev => {
            let colorClass = 'indoor'; // default
            if (ev.ruangan.toLowerCase().includes('outdoor')) colorClass = 'outdoor';
            else if (ev.ruangan.toLowerCase().includes('vip')) colorClass = 'vip';
            else if (ev.ruangan.toLowerCase().includes('meeting')) colorClass = 'meeting';
            
            eventsHtml += `<div class="cal-event ${colorClass}" title="${ev.nama} (${ev.jamMulai}-${ev.jamSelesai}) - ${ev.ruangan}">${ev.jamMulai} ${ev.nama}</div>`;
        });

        html += `<div class="calendar-day ${isToday ? 'today' : ''}" onclick="selectCalendarDate('${dateStr}')">
            <div class="calendar-day-number">${i}</div>
            ${eventsHtml}
        </div>`;
    }

    grid.innerHTML = html;
}

function changeCalendarMonth(offset) {
    calCurrentDate.setMonth(calCurrentDate.getMonth() + offset);
    renderReservasiCalendar();
}

function selectCalendarDate(dateStr) {
    var el = document.getElementById("res_tanggal");
    if (el) el.value = dateStr;
    showView('input-reservasi-view');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
    }
}

// ================= STOK BARANG LOGIC =================
let activeStokTab = 'sales'; // sales, fruits, notsales

// Helper to find item ID by name across all categories
function findStokItemId(name) {
    const stokKey = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_STOK_ITEMS') : 'RBM_STOK_ITEMS';
    const allItems = getCachedParsedStorage(stokKey, {sales:[], fruits:[], notsales:[]});
    for (const cat in allItems) {
        const list = allItems[cat];
        if (!Array.isArray(list)) continue;
        const item = list.find(i => i.name.toLowerCase() === name.trim().toLowerCase());
        if (item) return { id: item.id, category: cat, ratio: item.ratio, name: item.name };
    }
    return null;
}

// Cari item by nama di kategori tertentu (untuk rusak: bedakan Sales vs Fruits)
function findStokItemIdByCategory(name, category) {
    if (!name || !name.trim() || !category) return null;
    const stokKey = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_STOK_ITEMS') : 'RBM_STOK_ITEMS';
    const allItems = getCachedParsedStorage(stokKey, { sales: [], fruits: [], notsales: [] });
    const list = Array.isArray(allItems && allItems[category]) ? allItems[category] : null;
    if (!list) return null;
    const item = list.find(i => i.name.toLowerCase() === name.trim().toLowerCase());
    if (item) return { id: item.id, category: category, ratio: item.ratio, name: item.name };
    return null;
}

// Ambil satuan dari Stok Barang berdasarkan nama (untuk Input Barang)
function getStokUnitByName(name) {
    if (!name || !name.trim()) return '';
    const stokKey = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_STOK_ITEMS') : 'RBM_STOK_ITEMS';
    const allItems = getCachedParsedStorage(stokKey, { sales: [], fruits: [], notsales: [] });
    for (const cat in allItems) {
        const list = Array.isArray(allItems[cat]) ? allItems[cat] : [];
        const item = list.find(i => i.name.toLowerCase() === name.trim().toLowerCase());
        if (item && item.unit) return item.unit;
    }
    return '';
}

function getPreviousMonth(monthVal) {
    if (!monthVal || monthVal.length < 7) return '';
    var parts = monthVal.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    m--;
    if (m < 1) { m = 12; y--; }
    return y + '-' + String(m).padStart(2, '0');
}

// Process updates from Input Barang
function processStokUpdates(updates) {
    const stokKey = getRbmStorageKey('RBM_STOK_TRANSACTIONS');
    let data = getCachedParsedStorage(stokKey, {});
    
    updates.forEach(u => {
        // Key format: ITEMID_TYPE_DATE (e.g., 1_in_2023-10-01)
        // Date from input is YYYY-MM-DD.
        // We need to handle accumulation for In/Out/Rusak, but overwrite for Sisa?
        // For simplicity, we add to existing values for flow types.
        
        if (u.type === 'barang masuk') {
            const key = `${u.id}_in_${u.date}`;
            data[key] = (parseFloat(data[key]) || 0) + u.qty;
        } else if (u.type === 'barang keluar') {
            const keyOut = `${u.id}_out_${u.date}`; // For Fruits/NotSales
            const keyOutPck = `${u.id}_outpck_${u.date}`; // For Sales (if manual out is needed, though Sales uses Sisa logic)
            data[keyOut] = (parseFloat(data[keyOut]) || 0) + u.qty;
            data[keyOutPck] = (parseFloat(data[keyOutPck]) || 0) + u.qty;
            
            if (u.extra) { // Barang Jadi / Finished
                const keyFin = `${u.id}_fin_${u.date}`;
                data[keyFin] = (parseFloat(data[keyFin]) || 0) + parseFloat(u.extra); // Assuming extra is number
            }
        } else if (u.type === 'rusak') {
            const key = `${u.id}_rusak_${u.date}`;
            data[key] = (parseFloat(data[key]) || 0) + u.qty;
            if (u.keterangan != null || (u.foto && u.foto.data)) {
                const detailKey = getRbmStorageKey('RBM_STOK_RUSAK_DETAIL');
                let details = getCachedParsedStorage(detailKey, {});
                const detailId = `${u.id}_${u.date}`;
            const fotoDataUrl = (typeof u.foto === 'string' && u.foto.startsWith('http')) ? u.foto : (u.foto && u.foto.data ? `data:${u.foto.mimeType || 'image/jpeg'};base64,${u.foto.data}` : null);
                details[detailId] = { keterangan: u.keterangan || '', foto: fotoDataUrl };
                RBMStorage.setItem(detailKey, JSON.stringify(details));
                window._rbmParsedCache[detailKey] = { data: details };
            }
        } else if (u.type === 'sisa') {
            const key = `${u.id}_sisa_${u.date}`;
            data[key] = u.qty; // Overwrite sisa
        }
    });
    
    RBMStorage.setItem(stokKey, JSON.stringify(data));
    window._rbmParsedCache[stokKey] = { data: data };
}

function getRusakDetail(itemId, dateKey) {
    const detailKey = getRbmStorageKey('RBM_STOK_RUSAK_DETAIL');
    const details = getCachedParsedStorage(detailKey, {});
    const id = `${itemId}_${dateKey}`;
    return details[id] || null;
}

function showRusakDetailModal(itemId, dateKey, itemName) {
    const detail = getRusakDetail(itemId, dateKey);
    const modal = document.getElementById('rusakDetailModal');
    const titleEl = document.getElementById('rusakDetailModalTitle');
    const bodyEl = document.getElementById('rusakDetailModalBody');
    const imgEl = document.getElementById('rusakDetailModalImg');
    if (!modal || !bodyEl) return;
    if (titleEl) titleEl.textContent = 'Detail Barang Rusak — ' + (itemName || '');
    const tgl = dateKey ? dateKey.split('-').reverse().join('/') : '';
    if (detail) {
        bodyEl.innerHTML = (tgl ? '<p style="margin:0 0 10px; color:#64748b;">Tanggal: ' + tgl + '</p>' : '') +
            (detail.keterangan ? '<p style="margin:0 0 10px; white-space:pre-wrap;">' + (detail.keterangan.replace(/</g,'&lt;').replace(/>/g,'&gt;')) + '</p>' : '<p style="margin:0 0 10px; color:#94a3b8;">Tidak ada keterangan.</p>');
        if (imgEl) {
            if (detail.foto) {
                imgEl.src = detail.foto;
                imgEl.style.display = 'block';
                imgEl.style.maxWidth = '100%';
                imgEl.style.maxHeight = '280px';
                imgEl.style.marginTop = '10px';
                imgEl.style.borderRadius = '8px';
            } else {
                imgEl.src = '';
                imgEl.style.display = 'none';
            }
        }
    } else {
        bodyEl.innerHTML = (tgl ? '<p>Tanggal: ' + tgl + '</p>' : '') + '<p style="color:#94a3b8;">Tidak ada detail keterangan/foto untuk rusak ini.</p>';
        if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
    }
    modal.style.display = 'flex';
}

function closeRusakDetailModal() {
    const modal = document.getElementById('rusakDetailModal');
    if (modal) modal.style.display = 'none';
}

function switchStokTab(tab) {
    activeStokTab = tab;
    document.querySelectorAll('#stok-barang-view .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-stok-${tab}`).classList.add('active');
    renderStokTable();
}

function getStokItems(category) {
    const stokKey = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_STOK_ITEMS') : 'RBM_STOK_ITEMS';
    const allItems = getCachedParsedStorage(stokKey, {
        sales: [
            {id:1, name:'Ayam', unit:'Ekor', ratio:1}, 
            {id:2, name:'Saus BBQ', unit:'Pck', ratio:20}
        ],
        fruits: [
            {id:101, name:'Tomat', unit:'Kg', ratio:1},
            {id:102, name:'Selada', unit:'Ikat', ratio:1}
        ],
        notsales: [
            {id:201, name:'Tisu', unit:'Pack', ratio:1},
            {id:202, name:'Sabun Cuci', unit:'Btl', ratio:1}
        ]
    });
    const list = allItems && allItems[category];
    return Array.isArray(list) ? list : [];
}

// Untuk tab Same Item on Sales: gabung item Sales + item Fruits yang belum ada di Sales (nama sama)
function getStokItemsForSalesTab() {
    const sales = getStokItems('sales');
    const fruits = getStokItems('fruits');
    const salesNames = new Set(sales.map(s => s.name.toLowerCase()));
    const fruitsOnly = fruits.filter(f => !salesNames.has(f.name.toLowerCase()));
    return [...sales, ...fruitsOnly];
}

function renderStokTable() {
    window._isBatchUpdatingStok = true;
    const monthVal = document.getElementById("stok_bulan_filter").value;
    if (!monthVal) return;

    const [year, month] = monthVal.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    let items = activeStokTab === 'sales' ? getStokItemsForSalesTab() : getStokItems(activeStokTab);
    const stokKey = getRbmStorageKey('RBM_STOK_TRANSACTIONS');
    const stokData = getCachedParsedStorage(stokKey, {});

    const thead = document.getElementById("stok_thead");
    const tbody = document.getElementById("stok_tbody");

    // [PERFORMA] Tabel stok itu matrix besar (hari x item). Supaya tidak hang:
    // - render hanya range hari (default 7 hari)
    // - pagination item (default 20 item)
    // - search item
    window._stokDayStart = window._stokDayStart || 1;
    window._stokDaysPerPage = window._stokDaysPerPage || 7;
    window._stokItemPage = window._stokItemPage || 1;
    window._stokItemLimit = window._stokItemLimit || 20;
    const dayStart = Math.max(1, Math.min(daysInMonth, parseInt(window._stokDayStart, 10) || 1));
    const daysPerPage = Math.max(3, Math.min(15, parseInt(window._stokDaysPerPage, 10) || 7));
    const dayEnd = Math.min(daysInMonth, dayStart + daysPerPage - 1);

    // Inject controls once
    try {
        if (!document.getElementById('stok_perf_controls')) {
            const wrap = document.querySelector("#stok-barang-view .filter-row") || document.querySelector("#stok-barang-view");
            if (wrap) {
                const el = document.createElement('div');
                el.id = 'stok_perf_controls';
                el.className = 'filter-row';
                el.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-top:10px;';
                el.innerHTML = `
                    <div class="filter-group">
                        <label>Cari Item</label>
                        <input type="text" id="stok_search" placeholder="Ketik nama..." style="padding:6px; border:1px solid #ccc; border-radius:4px;" />
                    </div>
                    <div class="filter-group">
                        <label>Item / halaman</label>
                        <select id="stok_item_limit" style="padding:6px; border:1px solid #ccc; border-radius:4px;">
                            <option value="10">10</option>
                            <option value="20" selected>20</option>
                            <option value="30">30</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Hari / tampilan</label>
                        <select id="stok_days_per_page" style="padding:6px; border:1px solid #ccc; border-radius:4px;">
                            <option value="7" selected>7 hari</option>
                            <option value="10">10 hari</option>
                            <option value="15">15 hari</option>
                        </select>
                    </div>
                    <div class="filter-group" style="min-width:220px;">
                        <label>Range Hari</label>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button class="btn btn-secondary" type="button" onclick="window._stokDayStart=Math.max(1,(window._stokDayStart||1)- (window._stokDaysPerPage||7)); renderStokTable()">⬅️</button>
                            <span id="stok_day_range" style="font-weight:bold; color:#1e40af;">${dayStart}-${dayEnd}</span>
                            <button class="btn btn-secondary" type="button" onclick="window._stokDayStart=Math.min(${daysInMonth},(window._stokDayStart||1)+ (window._stokDaysPerPage||7)); renderStokTable()">➡️</button>
                        </div>
                    </div>
                    <div class="filter-group" style="min-width:220px;">
                        <label>Halaman Item</label>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button class="btn btn-secondary" type="button" onclick="window._stokItemPage=Math.max(1,(window._stokItemPage||1)-1); renderStokTable()">⬅️</button>
                            <span id="stok_item_page_label" style="font-weight:bold; color:#1e40af;">1</span>
                            <button class="btn btn-secondary" type="button" onclick="window._stokItemPage=(window._stokItemPage||1)+1; renderStokTable()">➡️</button>
                        </div>
                    </div>
                `;
                wrap.appendChild(el);

                const searchEl = el.querySelector('#stok_search');
                const itemLimitEl = el.querySelector('#stok_item_limit');
                const daysLimitEl = el.querySelector('#stok_days_per_page');
                if (searchEl) {
                    searchEl.addEventListener('input', function() { window._stokItemPage = 1; renderStokTable(); });
                }
                if (itemLimitEl) {
                    itemLimitEl.addEventListener('change', function() { window._stokItemLimit = parseInt(itemLimitEl.value, 10) || 20; window._stokItemPage = 1; renderStokTable(); });
                }
                if (daysLimitEl) {
                    daysLimitEl.addEventListener('change', function() {
                        window._stokDaysPerPage = parseInt(daysLimitEl.value, 10) || 7;
                        window._stokDayStart = 1;
                        renderStokTable();
                    });
                }
            }
        } else {
            const rangeLabel = document.getElementById('stok_day_range');
            if (rangeLabel) rangeLabel.textContent = `${dayStart}-${dayEnd}`;
            const itemLimitEl = document.getElementById('stok_item_limit');
            if (itemLimitEl && String(itemLimitEl.value) !== String(window._stokItemLimit)) itemLimitEl.value = String(window._stokItemLimit);
            const daysLimitEl = document.getElementById('stok_days_per_page');
            if (daysLimitEl && String(daysLimitEl.value) !== String(window._stokDaysPerPage)) daysLimitEl.value = String(window._stokDaysPerPage);
        }
    } catch(e) {}

    // Filter + pagination items
    const searchVal = (document.getElementById('stok_search') && document.getElementById('stok_search').value || '').toString().trim().toLowerCase();
    if (searchVal) items = items.filter(it => (it && it.name ? it.name.toLowerCase() : '').includes(searchVal));
    const itemLimit = Math.max(5, Math.min(50, parseInt(window._stokItemLimit, 10) || 20));
    const totalItemPages = Math.max(1, Math.ceil(items.length / itemLimit));
    if (window._stokItemPage > totalItemPages) window._stokItemPage = totalItemPages;
    if (window._stokItemPage < 1) window._stokItemPage = 1;
    const itemStartIdx = (window._stokItemPage - 1) * itemLimit;
    const itemsPage = items.slice(itemStartIdx, itemStartIdx + itemLimit);
    const pageLabel = document.getElementById('stok_item_page_label');
    if (pageLabel) pageLabel.textContent = `Hal ${window._stokItemPage}/${totalItemPages} (${items.length} item)`;

    // --- BUILD HEADER ---
    let hRow1 = `<tr>
        <th rowspan="2" style="left:0; z-index:20; min-width:150px;">Nama Barang</th>
        <th rowspan="2" style="left:150px; z-index:20; min-width:60px;">Satuan</th>
        <th rowspan="2" style="min-width:60px;">Awal</th>`;
    
    let hRow2 = `<tr>`;

    // Columns per day based on category
    let colsPerDay = 0;
    let colLabels = [];
    
    if (activeStokTab === 'sales') {
        colsPerDay = 5; // In, Out(Pck), Out(Por), Rusak, Total
        colLabels = ['In', 'Out(Pck)', 'Out(Por)', 'Rusak', 'Total'];
    } else if (activeStokTab === 'fruits') {
        colsPerDay = 6; // In, Out, Finish, Waste, Rusak, Total
        colLabels = ['In', 'Out', 'Finish', 'Waste', 'Rusak', 'Total'];
    } else {
        colsPerDay = 4; // In, Out, Rusak, Total
        colLabels = ['In', 'Out', 'Rusak', 'Total'];
    }

    for (let d = dayStart; d <= dayEnd; d++) {
        hRow1 += `<th colspan="${colsPerDay}">${d}</th>`;
        colLabels.forEach(lbl => hRow2 += `<th>${lbl}</th>`);
    }

    // Summary Columns
    hRow1 += `<th colspan="2">Total</th><th rowspan="2">SO Akhir</th></tr>`;
    hRow2 += `<th>In</th><th>Out</th></tr>`;

    thead.innerHTML = hRow1 + hRow2;

    // --- BUILD BODY ---
    const prevMonth = getPreviousMonth(monthVal);
    let bodyHtml = '';
    itemsPage.forEach(item => {
        // Stok awal: jika kosong, ambil dari SO Akhir bulan lalu (rollover otomatis)
        let awalVal = getStokValue(stokData, item.id, 'awal', monthVal);
        if (awalVal === '' || awalVal === undefined || awalVal === null) {
            const prevSo = getStokValue(stokData, item.id, 'so_akhir', prevMonth);
            if (prevSo !== '' && prevSo !== undefined && prevSo !== null) {
                awalVal = prevSo;
                updateStokValue(item.id, 'awal', monthVal, prevSo);
            }
        }
        let currentStock = parseFloat(awalVal) || 0;

        // Determine item name color based on source
        let nameColor = '#ffffff';
        if (activeStokTab === 'sales') {
            const fruitItem = getStokItems('fruits').find(f => f.name.toLowerCase() === item.name.toLowerCase());
            nameColor = fruitItem ? '#bfdbfe' : '#d1d5db';
        } else if (activeStokTab === 'fruits') {
            nameColor = '#bfdbfe';
        } else {
            nameColor = '#d1d5db';
        }
        
        let rowHtml = `<tr>
            <td style="position:sticky; left:0; background:${nameColor}; z-index:15; text-align:left; font-weight:bold;">${item.name}</td>
            <td style="position:sticky; left:150px; background:white; z-index:15;">${item.unit}</td>
            <td><input type="number" class="stok-input" value="${awalVal !== '' && awalVal !== undefined ? awalVal : ''}" readonly style="background:#f0f0f0; font-weight:bold;" title="Stok awal = SO akhir bulan lalu (otomatis, tidak bisa diedit)"></td>`;

        let totalIn = 0;
        let totalOut = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateKey = `${monthVal}-${String(d).padStart(2,'0')}`;
            let valIn = parseFloat(getStokValue(stokData, item.id, `in_${dateKey}`)) || 0;
            const valRusak = parseFloat(getStokValue(stokData, item.id, `rusak_${dateKey}`)) || 0;
            let valOut = 0;
            const shouldRender = (d >= dayStart && d <= dayEnd);
            
            if (activeStokTab === 'sales') {
                // Logic: In comes from Input Barang. 
                // BUT if this item exists in Fruits & Veg (as Finished), In = Finished of Fruits.
                // We check if there is a Fruit item with same name.
                const fruitItem = getStokItems('fruits').find(f => f.name.toLowerCase() === item.name.toLowerCase());
                let isLinked = false;
                if (fruitItem) {
                    const valFinFruit = parseFloat(getStokValue(stokData, fruitItem.id, `fin_${dateKey}`)) || 0;
                    valIn = valFinFruit; // Override In automatically
                    isLinked = true;
                }

                // Out otomatis = (Total kemarin + Masuk) - Sisa. Total = Total kemarin + In - Out - Rusak.
                let valSisaInput = getStokValue(stokData, item.id, `sisa_${dateKey}`);
                let valSisa = valSisaInput !== '' && valSisaInput !== undefined && valSisaInput !== null 
                    ? parseFloat(valSisaInput) 
                    : 0;
                const outEffective = Math.max(0, (currentStock + valIn) - valSisa); // Out = (ttl kemarin + masuk) - sisa
                const valTotal = currentStock + valIn - outEffective - valRusak;
                const valTotalClamped = Math.max(0, valTotal);

                currentStock = valTotalClamped;

                const valOutPor = outEffective * (item.ratio || 1);

                totalIn += valIn;
                totalOut += outEffective;

                // Determine In color based on source
                const inStyle = isLinked 
                    ? 'readonly style="background:#bfdbfe; font-weight:bold;"' 
                    : 'readonly style="background:#d1d5db; font-weight:bold;"';

                if (valSisaInput !== '' && valSisaInput !== undefined && valSisaInput !== null) {
                    updateStokValue(item.id, `sisa_${dateKey}`, monthVal, valSisaInput);
                }

                const rusakCell = valRusak > 0
                    ? `<td style="cursor:pointer; background:#fef3c7; font-weight:bold; padding:6px; text-align:center;" onclick="showRusakDetailModal('${item.id}','${dateKey}','${(item.name||'').replace(/'/g,"\\'")}')" title="Klik untuk lihat keterangan dan foto">${valRusak}</td>`
                    : `<td><input type="number" class="stok-input" value="${valRusak || ''}" readonly style="background:#d1d5db; font-weight:bold;"></td>`;
                if (shouldRender) {
                    rowHtml += `
                        <td><input type="number" class="stok-input" value="${valIn || ''}" ${inStyle} onchange=""></td>
                        <td><input type="number" class="stok-input" id="outpck_${item.id}_${dateKey}" value="${outEffective || ''}" readonly style="background:#bfdbfe; font-weight:bold;"></td>
                        <td><input type="number" class="stok-input" id="outpor_${item.id}_${dateKey}" value="${valOutPor || ''}" readonly style="background:#e5e7eb;"></td>
                        ${rusakCell}
                        <td><input type="number" class="stok-input" id="total_${item.id}_${dateKey}" value="${(valTotalClamped === 0 || valTotalClamped) ? valTotalClamped : ''}" readonly style="background:#bfdbfe; font-weight:bold;"></td>
                    `;
                }
            } else if (activeStokTab === 'fruits') {
                const valOut = parseFloat(getStokValue(stokData, item.id, `out_${dateKey}`)) || 0;
                const valFin = getStokValue(stokData, item.id, `fin_${dateKey}`);
                const valWaste = valOut - (parseFloat(valFin)||0);
                
                currentStock = currentStock + valIn - valOut - valRusak;

                totalIn += valIn;
                totalOut += valOut;

                const rusakCellF = valRusak > 0
                    ? `<td style="cursor:pointer; background:#fef3c7; font-weight:bold; padding:6px; text-align:center;" onclick="showRusakDetailModal('${item.id}','${dateKey}','${(item.name||'').replace(/'/g,"\\'")}')" title="Klik untuk lihat keterangan dan foto">${valRusak}</td>`
                    : `<td><input type="number" class="stok-input" value="${valRusak || ''}" readonly style="background:#d1d5db; font-weight:bold;"></td>`;
                if (shouldRender) {
                    rowHtml += `
                        <td><input type="number" class="stok-input" value="${valIn || ''}" readonly style="background:#d1d5db; font-weight:bold;"></td>
                        <td><input type="number" class="stok-input" value="${valOut || ''}" readonly style="background:#bfdbfe; font-weight:bold;"></td>
                        <td><input type="number" class="stok-input" value="${valFin || ''}" readonly style="background:#bfdbfe; font-weight:bold;"></td>
                        <td><input type="number" class="stok-input" id="waste_${item.id}_${dateKey}" value="${valWaste}" readonly style="background:#e5e7eb; font-weight:bold;"></td>
                        ${rusakCellF}
                        <td><input type="number" class="stok-input total-stok-${item.id}" id="total_${item.id}_${dateKey}" value="${(currentStock === 0 || currentStock) ? currentStock : ''}" readonly style="background:#bfdbfe; font-weight:bold;"></td>
                    `;
                }
            } else {
                const valOut = parseFloat(getStokValue(stokData, item.id, `out_${dateKey}`)) || 0;
                
                currentStock = currentStock + valIn - valOut - valRusak;

                totalIn += valIn;
                totalOut += valOut;

                const rusakCellN = valRusak > 0
                    ? `<td style="cursor:pointer; background:#fef3c7; font-weight:bold; padding:6px; text-align:center;" onclick="showRusakDetailModal('${item.id}','${dateKey}','${(item.name||'').replace(/'/g,"\\'")}')" title="Klik untuk lihat keterangan dan foto">${valRusak}</td>`
                    : `<td><input type="number" class="stok-input" value="${valRusak || ''}" readonly style="background:#d1d5db; font-weight:bold;"></td>`;
                if (shouldRender) {
                    rowHtml += `
                        <td><input type="number" class="stok-input" value="${valIn || ''}" readonly style="background:#d1d5db; font-weight:bold;"></td>
                        <td><input type="number" class="stok-input" value="${valOut || ''}" readonly style="background:#bfdbfe; font-weight:bold;"></td>
                        ${rusakCellN}
                        <td><input type="number" class="stok-input total-stok-${item.id}" id="total_${item.id}_${dateKey}" value="${(currentStock === 0 || currentStock) ? currentStock : ''}" readonly style="background:#bfdbfe; font-weight:bold;"></td>
                    `;
                }
            }
        }

        // Tampilkan SO Akhir: utamakan nilai yang sudah disimpan (hasil edit user); kalau kosong pakai hasil hitung
        let soAkhirDisplay = getStokValue(stokData, item.id, 'so_akhir', monthVal);
        if (soAkhirDisplay === '' || soAkhirDisplay === undefined || soAkhirDisplay === null)
            soAkhirDisplay = currentStock;
        rowHtml += `
            <td style="font-weight:bold; background:#f0f0f0;">${totalIn}</td>
            <td style="font-weight:bold; background:#f0f0f0;">${totalOut}</td>
            <td><input type="number" class="stok-input" id="so_akhir_${item.id}_${monthVal}" value="${soAkhirDisplay}" onchange="updateStokValue('${item.id}', 'so_akhir', '${monthVal}', this.value)" style="width:60px; font-weight:bold;" title="Stok akhir bulan (edit otomatis tersimpan)"></td>
        </tr>`;
        bodyHtml += rowHtml;
    });
    tbody.innerHTML = bodyHtml;
    
    if (window._isBatchUpdatingStok) {
        window._isBatchUpdatingStok = false;
        RBMStorage.setItem(stokKey, JSON.stringify(stokData));
        window._rbmParsedCache[stokKey] = { data: stokData };
    }
}

function getStokValue(data, itemId, field, monthVal) {
    // Key format: ITEMID_FIELD (e.g., 1_in_2023-10-01)
    // For monthly fields like 'awal', key is 1_awal_2023-10
    let key = '';
    if (field === 'awal' || field === 'so_akhir') {
        key = `${itemId}_${field}_${monthVal}`;
    } else {
        key = `${itemId}_${field}`;
    }
    return data[key] || '';
}

function updateStokValue(itemId, field, monthVal, value) {
    const stokKey = getRbmStorageKey('RBM_STOK_TRANSACTIONS');
    let data = getCachedParsedStorage(stokKey, {});
    let key = '';
    if (field === 'awal' || field === 'so_akhir') {
        key = `${itemId}_${field}_${monthVal}`;
    } else {
        key = `${itemId}_${field}`;
    }
    data[key] = value;
    if (!window._isBatchUpdatingStok) {
        RBMStorage.setItem(stokKey, JSON.stringify(data));
        window._rbmParsedCache[stokKey] = { data: data };
    }
}

function updateStokFruits(itemId, dateKey, monthVal, value, type) {
    // 1. Save changed value
    updateStokValue(itemId, `${type}_${dateKey}`, monthVal, value);
    
    // 2. Recalculate Waste
    const stokKey = getRbmStorageKey('RBM_STOK_TRANSACTIONS');
    const data = getCachedParsedStorage(stokKey, {});
    const outVal = parseFloat(data[`${itemId}_out_${dateKey}`]) || 0;
    const finVal = parseFloat(data[`${itemId}_fin_${dateKey}`]) || 0;
    const waste = outVal - finVal;
    
    // 3. Update UI
    const el = document.getElementById(`waste_${itemId}_${dateKey}`);
    if(el) el.value = waste;
    recalculateStokRow(itemId, monthVal);
}

function recalculateStokRow(itemId, monthVal) {
    const stokKey = getRbmStorageKey('RBM_STOK_TRANSACTIONS');
    const stokData = getCachedParsedStorage(stokKey, {});
    const items = activeStokTab === 'sales' ? getStokItemsForSalesTab() : getStokItems(activeStokTab);
    const item = items.find(i => String(i.id) === String(itemId));
    if (!item) return;

    const [year, month] = monthVal.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let currentStock = parseFloat(getStokValue(stokData, itemId, 'awal', monthVal)) || 0;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${monthVal}-${String(d).padStart(2,'0')}`;
        let valIn = parseFloat(getStokValue(stokData, itemId, `in_${dateKey}`)) || 0;
        const valRusak = parseFloat(getStokValue(stokData, itemId, `rusak_${dateKey}`)) || 0;
        let valOut = 0;

        if (activeStokTab === 'sales') {
            const fruitItem = getStokItems('fruits').find(f => f.name.toLowerCase() === item.name.toLowerCase());
            if (fruitItem) {
                const valFinFruit = parseFloat(getStokValue(stokData, fruitItem.id, `fin_${dateKey}`)) || 0;
                valIn = valFinFruit;
            }

            // Out otomatis = (Total kemarin + Masuk) - Sisa.
            let valSisaInput = getStokValue(stokData, itemId, `sisa_${dateKey}`);
            let valSisa = valSisaInput !== '' && valSisaInput !== undefined && valSisaInput !== null 
                ? parseFloat(valSisaInput) 
                : 0;
            const outEffective = Math.max(0, (currentStock + valIn) - valSisa);
            let valTotal = currentStock + valIn - outEffective - valRusak;
            if (valTotal < 0) valTotal = 0;
            currentStock = valTotal;

            const elOutPck = document.getElementById(`outpck_${itemId}_${dateKey}`);
            const elOutPor = document.getElementById(`outpor_${itemId}_${dateKey}`);
            const elTotal = document.getElementById(`total_${itemId}_${dateKey}`);
            if (elOutPck) elOutPck.value = (outEffective === 0 || outEffective) ? outEffective : '';
            if (elOutPor) elOutPor.value = (outEffective === 0 || outEffective) ? (outEffective * (item.ratio || 1)) : '';
            if (elTotal) elTotal.value = (valTotal === 0 || valTotal) ? valTotal : '';

        } else {
            valOut = parseFloat(getStokValue(stokData, itemId, `out_${dateKey}`)) || 0;
            currentStock = currentStock + valIn - valOut - valRusak;
            
            const elTotal = document.getElementById(`total_${itemId}_${dateKey}`);
            if (elTotal) elTotal.value = (currentStock === 0 || currentStock) ? currentStock : '';
            
            // If this is a Fruit item, we might need to trigger update on linked Sales item?
            // For simplicity, we assume user refreshes or we'd need complex dependency tracking.
        }
    }
    
    // SO Akhir = stok akhir bulan (total hari terakhir), agar bulan berikutnya stok awal terisi otomatis
    updateStokValue(itemId, 'so_akhir', monthVal, currentStock);
    const elSoAkhir = document.getElementById('so_akhir_' + itemId + '_' + monthVal);
    if (elSoAkhir) elSoAkhir.value = currentStock;
}

function saveStokData() {
    var msg = (window.RBMStorage && window.RBMStorage._useFirebase)
        ? "✅ Data Stok tersimpan ke Firebase."
        : "✅ Data Stok tersimpan di perangkat (Local Storage).";
    alert(msg);
}

function getStokTableForExport() {
    const table = document.getElementById('stok_table');
    const monthVal = document.getElementById('stok_bulan_filter') && document.getElementById('stok_bulan_filter').value;
    if (!table) return { tableEl: null, monthVal: monthVal || '' };
    const clone = table.cloneNode(true);
    clone.querySelectorAll('td').forEach(td => {
        td.removeAttribute('onclick');
        const input = td.querySelector('input');
        if (input) {
            td.textContent = input.value || '';
            td.removeAttribute('style');
            td.style.border = '1px solid #ddd';
            td.style.padding = '4px';
        }
    });
    clone.querySelectorAll('th').forEach(th => {
        th.removeAttribute('onclick');
    });
    return { tableEl: clone, monthVal: monthVal || '' };
}

function exportStokBarangToExcel() {
    const monthVal = document.getElementById('stok_bulan_filter') && document.getElementById('stok_bulan_filter').value;
    if (!monthVal) {
        alert('Pilih Bulan & Tahun terlebih dahulu.');
        return;
    }
    const { tableEl, monthVal: m } = getStokTableForExport();
    if (!tableEl) {
        alert('Tabel stok tidak ditemukan. Klik Tampilkan / pilih bulan.');
        return;
    }
    const label = activeStokTab === 'sales' ? 'Same_Item_on_Sales' : activeStokTab === 'fruits' ? 'Fruits_Vegetables' : 'Same_Item_Not_Sales';
    const fileName = `Stok_Barang_${label}_${m}.xlsx`;
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.table_to_sheet(tableEl);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stok ' + label.substring(0, 28));
        XLSX.writeFile(wb, fileName);
    } else {
        const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>table{border-collapse:collapse;}th,td{border:1px solid #000;padding:4px;}th{background:#1e40af;color:#fff;}</style></head><body><h2>Stok Barang</h2><p>Bulan: ' + m + '</p>' + tableEl.outerHTML + '</body></html>';
        const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.replace('.xlsx', '.xls');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

function exportStokBarangToPdf() {
    const monthVal = document.getElementById('stok_bulan_filter') && document.getElementById('stok_bulan_filter').value;
    if (!monthVal) {
        alert('Pilih Bulan & Tahun terlebih dahulu.');
        return;
    }
    const { tableEl, monthVal: m } = getStokTableForExport();
    if (!tableEl) {
        alert('Tabel stok tidak ditemukan.');
        return;
    }
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('Library PDF belum dimuat. Refresh halaman lalu coba lagi.');
        return;
    }
    var origTable = document.getElementById('stok_table');
    var fullTableWidth = (origTable && (origTable.scrollWidth > 0)) ? origTable.scrollWidth + 80 : 8000;
    var fullTableHeight = (origTable && (origTable.scrollHeight > 0)) ? origTable.scrollHeight + 100 : 4000;
    const label = activeStokTab === 'sales' ? 'Same Item on Sales' : activeStokTab === 'fruits' ? 'Fruits & Vegetables' : 'Same Item Not Sales';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:0;top:-99999px;width:' + fullTableWidth + 'px;min-height:' + fullTableHeight + 'px;padding:16px;font-family:Arial,sans-serif;color:#333;font-size:11px;background:#fff;overflow:visible;box-sizing:border-box;';
    wrap.innerHTML = '<h2 style="text-align:center;margin-bottom:4px;">Stok Barang</h2><p class="period" style="text-align:center;margin-top:0;color:#666;">Bulan: ' + m + ' &mdash; ' + label + '</p>' + tableEl.outerHTML;
    var tbl = wrap.querySelector('table');
    tbl.removeAttribute('class');
    tbl.style.borderCollapse = 'collapse';
    tbl.style.width = 'auto';
    tbl.style.tableLayout = 'auto';
    wrap.querySelectorAll('th, td').forEach(function(cell) {
        cell.style.border = '1px solid #ddd';
        cell.style.padding = '4px';
        cell.style.whiteSpace = 'nowrap';
        cell.style.position = 'static';
        cell.style.left = '';
        cell.style.right = '';
        cell.style.zIndex = '';
    });
    wrap.querySelectorAll('th').forEach(function(th) { th.style.background = '#1e40af'; th.style.color = 'white'; });
    tbl.querySelectorAll('thead').forEach(function(thead) { thead.style.display = ''; });
    tbl.querySelectorAll('tbody').forEach(function(tbody) { tbody.style.display = ''; });
    [].forEach.call(tbl.querySelectorAll('tr'), function(tr) {
        var cells = tr.querySelectorAll('th, td');
        if (cells.length > 0) cells[0].style.minWidth = '150px';
        if (cells.length > 1) cells[1].style.minWidth = '60px';
    });
    document.body.appendChild(wrap);
    var tw = tbl.scrollWidth;
    var th = tbl.scrollHeight;
    if (tw > 0) wrap.style.width = (tw + 80) + 'px';
    if (th > 0) wrap.style.minHeight = (th + 120) + 'px';
    var captureScale = (wrap.scrollWidth > 3500 || wrap.scrollHeight > 2500) ? 1 : 2;
    html2canvas(wrap, { scale: captureScale, backgroundColor: '#ffffff' }).then(function(canvas) {
        document.body.removeChild(wrap);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 8;
        const usableW = pageW - margin * 2;
        const usableH = pageH - margin * 2;
        var pxToMm = 25.4 / 96;
        var imgWmm = canvas.width * pxToMm;
        var imgHmm = canvas.height * pxToMm;
        var scale = Math.min(usableW / imgWmm, usableH / imgHmm, 1);
        var drawW = imgWmm * scale;
        var drawH = imgHmm * scale;
        if (drawH <= usableH && drawW <= usableW) {
            doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, drawW, drawH);
        } else {
            var totalH = drawH;
            var drawn = 0;
            while (drawn < totalH) {
                var pageImgH = Math.min(usableH, totalH - drawn);
                var srcY = (drawn / totalH) * canvas.height;
                var srcH = (pageImgH / totalH) * canvas.height;
                var small = document.createElement('canvas');
                small.width = canvas.width;
                small.height = Math.ceil(srcH);
                small.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, small.width, small.height);
                doc.addImage(small.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, drawW, pageImgH);
                drawn += pageImgH;
                if (drawn < totalH) doc.addPage('l');
            }
        }
        doc.save('Stok_Barang_' + (label.replace(/\s+/g, '_')) + '_' + (m || '').replace(/\//g, '-') + '.pdf');
    }).catch(function(err) {
        if (wrap.parentNode) document.body.removeChild(wrap);
        alert('Gagal membuat PDF: ' + (err.message || err));
    });
}

function manageStokItems() {
    const tbody = document.getElementById("stok_item_tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const items = getStokItems(activeStokTab);
    var tabLabel = activeStokTab === 'sales' ? 'Same Item on Sales' : activeStokTab === 'fruits' ? 'Fruits & Vegetables' : 'Same Item Not Sales';
    var titleEl = document.getElementById("stokItemModalTitle");
    if (titleEl) titleEl.textContent = "Kelola Item Stok (" + tabLabel + ")";
    var subEl = document.getElementById("stokItemModalSub");
    if (subEl) subEl.textContent = "Menambah/hapus item di tab \"" + tabLabel + "\". Setelah tambah, tutup modal dan cek tabel di tab tersebut.";
    items.forEach(function(item, idx) {
        var qtyPorsi = 1;
        if (item.ratio) {
            qtyPorsi = 1 / item.ratio;
            qtyPorsi = Math.round((qtyPorsi + Number.EPSILON) * 100) / 100;
        }
        var actionCell = (window.rbmOnlyOwnerCanEditDelete && window.rbmOnlyOwnerCanEditDelete()) ? '<button class="btn-small-danger" onclick="removeStokItem(' + idx + ')">x</button>' : '-';
        tbody.innerHTML += "<tr><td>" + item.name + "</td><td>" + item.unit + "</td><td>" + qtyPorsi + "</td><td>" + actionCell + "</td></tr>";
    });
    document.getElementById("stokItemModal").style.display = "flex";
}

function addStokItem() {
    const name = document.getElementById("new_stok_name").value;
    const unit = document.getElementById("new_stok_unit").value;
    const qtyPorsi = parseFloat(document.getElementById("new_stok_qty_porsi").value);
    
    if(!name) { alert("Nama item wajib diisi"); return; }

    let ratio = 1;
    if (qtyPorsi && qtyPorsi > 0) {
        // Jika user mengisi pembagi (misal 70gr), maka ratio = 1/70
        ratio = 1 / qtyPorsi;
    }

    const stokKey = getRbmStorageKey('RBM_STOK_ITEMS');
    const allItems = safeParse(RBMStorage.getItem(stokKey), {sales:[], fruits:[], notsales:[]});
    if (!Array.isArray(allItems[activeStokTab])) allItems[activeStokTab] = [];
    const newId = Date.now();
    allItems[activeStokTab].push({id: newId, name, unit, ratio});
    
    // Jika menambah di Fruits & Vegetables, otomatis tambah ke Same Item on Sales
    if (activeStokTab === 'fruits') {
        if (!Array.isArray(allItems.sales)) allItems.sales = [];
        const exists = allItems.sales.some(i => i.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
            allItems.sales.push({id: newId + 1, name, unit, ratio});
        }
    }
    
    RBMStorage.setItem(stokKey, JSON.stringify(allItems));
    window._rbmParsedCache[stokKey] = { data: allItems };
    
    document.getElementById("new_stok_name").value = "";
    document.getElementById("new_stok_unit").value = "";
    document.getElementById("new_stok_qty_porsi").value = "";
    manageStokItems(); // Refresh modal
    renderStokTable(); // Refresh table
}

function removeStokItem(idx) {
    if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat menghapus data.', 'Akses Ditolak', 'error'); return; }
    showCustomConfirm("Hapus item ini?", "Konfirmasi Hapus", function() {
        const stokKey = getRbmStorageKey('RBM_STOK_ITEMS');
        const allItems = getCachedParsedStorage(stokKey, {sales:[], fruits:[], notsales:[]});
        if (Array.isArray(allItems[activeStokTab])) allItems[activeStokTab].splice(idx, 1);
        RBMStorage.setItem(stokKey, JSON.stringify(allItems));
        window._rbmParsedCache[stokKey] = { data: allItems };
        manageStokItems();
        renderStokTable();
    });
}


function triggerStokImport() {
    document.getElementById('importStokInput').click();
}

function processStokImport(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
            alert("File kosong atau format salah.");
            return;
        }

        const stokKey = getRbmStorageKey('RBM_STOK_ITEMS');
        const allItems = getCachedParsedStorage(stokKey, {sales:[], fruits:[], notsales:[]});
        if (!Array.isArray(allItems[activeStokTab])) allItems[activeStokTab] = [];
        let count = 0;

        json.forEach(row => {
            const name = row['Nama'] || row['Nama Item'] || row['Name'];
            const unit = row['Satuan'] || row['Unit'];
            const qtyPorsi = row['Qty per Porsi'] || row['Qty/Porsi'] || row['Qty'] || 1;

            if (name && unit) {
                let ratio = 1;
                const qtyVal = parseFloat(qtyPorsi);
                if (qtyVal && qtyVal > 0) ratio = 1 / qtyVal;

                const exists = allItems[activeStokTab].some(i => i.name.toLowerCase() === name.toLowerCase());
                if (!exists) {
                    const newId = Date.now() + Math.floor(Math.random() * 1000) + count;
                    allItems[activeStokTab].push({id: newId, name, unit, ratio});
                    count++;
                }
            }
        });

        RBMStorage.setItem(stokKey, JSON.stringify(allItems));
        window._rbmParsedCache[stokKey] = { data: allItems };
        alert(`Berhasil mengimpor ${count} item baru.`);
        manageStokItems();
        renderStokTable();
        input.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function exportStokItemsToExcel() {
    const items = getStokItems(activeStokTab);
    if (items.length === 0) { alert("Tidak ada data."); return; }
    const data = items.map(item => {
        let qtyPorsi = 1;
        if (item.ratio) qtyPorsi = Math.round((1 / item.ratio + Number.EPSILON) * 100) / 100;
        return { "Nama": item.name, "Satuan": item.unit, "Qty per Porsi": qtyPorsi };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stok Items");
    XLSX.writeFile(wb, `Stok_Items_${activeStokTab}.xlsx`);
}

// Global variable to store all riwayat data
let riwayatBarangData = {
    'barang masuk': [],
    'barang keluar': [],
    'sisa': [],
    'rusak': []
};

function loadRiwayatBarang() {
    const start = document.getElementById("riwayat_barang_start").value;
    const end = document.getElementById("riwayat_barang_end").value;
    
    const key = getRbmStorageKey('RBM_PENDING_BARANG');
    const pending = getCachedParsedStorage(key, []);
    
    // Reset grouped data
    riwayatBarangData = {
        'barang masuk': [],
        'barang keluar': [],
        'sisa': [],
        'rusak': []
    };
    
    // Group data by jenis
    pending.forEach((submission, parentIdx) => {
        const items = submission.payload || [];
        if (Array.isArray(items)) {
            items.forEach((item, itemIdx) => {
                if (item.tanggal >= start && item.tanggal <= end) {
                    // Normalize jenis to match groupedData keys
                    const jenis = item.jenis.toLowerCase().trim();
                    const groupKey = jenis === 'barang masuk' ? 'barang masuk' :
                                     jenis === 'barang keluar' ? 'barang keluar' :
                                     jenis === 'sisa' ? 'sisa' :
                                     jenis === 'rusak' ? 'rusak' : null;
                    
                    if (groupKey) {
                        riwayatBarangData[groupKey].push({
                            item: item,
                            parentIdx: parentIdx,
                            itemIdx: itemIdx
                        });
                    }
                }
            });
        }
    });
    
    // Display first tab (barang masuk)
    filterRiwayatBarang('barang masuk', document.querySelector('[data-filter="barang masuk"]'));
}

function filterRiwayatBarang(jenis, buttonElement) {
    // Update active button
    document.querySelectorAll('.riwayat-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    buttonElement.classList.add('active');
    
    // Get data for selected jenis
    const items = riwayatBarangData[jenis] || [];
    const container = document.getElementById("riwayat_barang_table_container");
    
    if (items.length === 0) {
        container.innerHTML = '<div class="riwayat-empty">📭 Tidak ada data untuk kategori ini</div>';
        return;
    }
    
    // Define config for each jenis
    const jenisList = {
        'barang masuk': { emoji: '📥', label: 'Barang Masuk', icon: 'Masuk' },
        'barang keluar': { emoji: '📤', label: 'Barang Keluar', icon: 'Keluar' },
        'sisa': { emoji: '📦', label: 'Sisa Stok', icon: 'Sisa' },
        'rusak': { emoji: '⚠️', label: 'Barang Rusak', icon: 'Rusak' }
    };
    
    const config = jenisList[jenis];
    
    let tableHtml = `
        <div style="margin-bottom:10px;">${window.rbmOnlyOwnerCanEditDelete && window.rbmOnlyOwnerCanEditDelete() ? '<button type="button" class="btn btn-small-danger" onclick="hapusRiwayatBarangYangDitandai()" id="btn_hapus_tandai_riwayat_barang">🗑️ Hapus yang ditandai</button>' : '<span style="color:#64748b;">Hapus data hanya untuk Owner.</span>'}</div>
        <table class="riwayat-data-table">
            <thead>
                <tr>
                    <th style="width:42px;" title="Tandai untuk hapus"><input type="checkbox" id="riwayat_barang_select_all" onclick="toggleRiwayatBarangSelectAll(this)"></th>
                    <th>Tanggal</th>
                    <th>Nama Barang</th>
                    <th>Jumlah</th>
                    <th>Ket / Extra</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    items.forEach(data => {
        const item = data.item;
        let extra = item.barangjadi ? `(Jadi: ${item.barangjadi})` : '';
        if (item.keteranganRusak) extra += ` ${item.keteranganRusak}`;
        
        tableHtml += `
            <tr>
                <td style="text-align:center;"><input type="checkbox" class="riwayat_barang_row_check" data-parent="${data.parentIdx}" data-item="${data.itemIdx}"></td>
                <td>${item.tanggal}</td>
                <td><strong>${item.nama}</strong></td>
                <td class="num"><strong>${item.jumlah}</strong></td>
                <td>${extra}</td>
                <td>${window.rbmOnlyOwnerCanEditDelete && window.rbmOnlyOwnerCanEditDelete() ? '<button class="btn-small-danger" onclick="deleteRiwayatBarang(' + data.parentIdx + ',' + data.itemIdx + ')">Hapus</button>' : '-'}</td>
            </tr>
        `;
    });
    
    tableHtml += `
            </tbody>
        </table>
        <div class="riwayat-count">Total: <strong>${items.length}</strong> item${items.length > 1 ? 's' : ''}</div>
    `;
    
    container.innerHTML = tableHtml;
}

function toggleRiwayatBarangSelectAll(checkbox) {
    document.querySelectorAll('#riwayat_barang_table_container .riwayat_barang_row_check').forEach(cb => {
        cb.checked = !!checkbox.checked;
    });
}

function hapusRiwayatBarangYangDitandai() {
    if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat menghapus data.', 'Akses Ditolak', 'error'); return; }
    const checked = document.querySelectorAll('#riwayat_barang_table_container .riwayat_barang_row_check:checked');
    if (!checked.length) {
        showCustomAlert('Tandai dulu item yang ingin dihapus (centang checkbox).', 'Peringatan', 'warning');
        return;
    }
    const selections = Array.from(checked).map(cb => ({ parentIdx: parseInt(cb.dataset.parent, 10), itemIdx: parseInt(cb.dataset.item, 10) }));
    showCustomConfirm('Hapus ' + selections.length + ' data yang ditandai? Stok akan diperbarui.', "Konfirmasi Hapus", function() {
        deleteRiwayatBarangBulk(selections);
    });
}

function deleteRiwayatBarangBulk(selections) {
    if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat menghapus data.', 'Akses Ditolak', 'error'); return; }
    if (!selections.length) return;
    selections.sort((a, b) => (b.parentIdx - a.parentIdx) || (b.itemIdx - a.itemIdx));
    const key = getRbmStorageKey('RBM_PENDING_BARANG');
    let pending = getCachedParsedStorage(key, []);
    const stokKeyBarang = getRbmStorageKey('RBM_STOK_TRANSACTIONS');
    let stokData = getCachedParsedStorage(stokKeyBarang, {});

    selections.forEach(({ parentIdx, itemIdx }) => {
        const submission = pending[parentIdx];
        if (!submission || !submission.payload || !submission.payload[itemIdx]) return;
        const p = submission.payload[itemIdx];
        const itemInfo = findStokItemId(p.nama);
        if (itemInfo) {
            const dateKey = p.tanggal;
            const jenis = (p.jenis || '').toLowerCase().trim();
            if (jenis === 'barang masuk') {
                const k = `${itemInfo.id}_in_${dateKey}`;
                stokData[k] = (parseFloat(stokData[k]) || 0) - parseFloat(p.jumlah);
            } else if (jenis === 'barang keluar') {
                const keyOut = `${itemInfo.id}_out_${dateKey}`;
                const keyOutPck = `${itemInfo.id}_outpck_${dateKey}`;
                stokData[keyOut] = (parseFloat(stokData[keyOut]) || 0) - parseFloat(p.jumlah);
                stokData[keyOutPck] = (parseFloat(stokData[keyOutPck]) || 0) - parseFloat(p.jumlah);
                if (p.barangjadi) {
                    const keyFin = `${itemInfo.id}_fin_${dateKey}`;
                    stokData[keyFin] = (parseFloat(stokData[keyFin]) || 0) - parseFloat(p.barangjadi);
                }
            } else if (jenis === 'rusak') {
                const k = `${itemInfo.id}_rusak_${dateKey}`;
                stokData[k] = (parseFloat(stokData[k]) || 0) - parseFloat(p.jumlah);
            } else if (jenis === 'sisa') {
                delete stokData[`${itemInfo.id}_sisa_${dateKey}`];
            }
        }
        submission.payload.splice(itemIdx, 1);
    });

    pending = pending.filter(s => s && s.payload && s.payload.length > 0);
    RBMStorage.setItem(stokKeyBarang, JSON.stringify(stokData));
    RBMStorage.setItem(key, JSON.stringify(pending));
    window._rbmParsedCache[stokKeyBarang] = { data: stokData };
    window._rbmParsedCache[key] = { data: pending };

    const start = document.getElementById("riwayat_barang_start") && document.getElementById("riwayat_barang_start").value;
    const end = document.getElementById("riwayat_barang_end") && document.getElementById("riwayat_barang_end").value;
    riwayatBarangData = { 'barang masuk': [], 'barang keluar': [], 'sisa': [], 'rusak': [] };
    pending.forEach((submission, parentIdx) => {
        const items = submission.payload || [];
        if (Array.isArray(items)) {
            items.forEach((item, itemIdx) => {
                if (item.tanggal >= start && item.tanggal <= end) {
                    const jenis = (item.jenis || '').toLowerCase().trim();
                    const groupKey = jenis === 'barang masuk' ? 'barang masuk' : jenis === 'barang keluar' ? 'barang keluar' : jenis === 'sisa' ? 'sisa' : jenis === 'rusak' ? 'rusak' : null;
                    if (groupKey) riwayatBarangData[groupKey].push({ item: item, parentIdx: parentIdx, itemIdx: itemIdx });
                }
            });
        }
    });
    const activeBtn = document.querySelector('.riwayat-filter-btn.active');
    if (activeBtn) filterRiwayatBarang(activeBtn.dataset.filter, activeBtn);
}

function deleteRiwayatBarang(parentIdx, itemIdx) {
    if (window.rbmOnlyOwnerCanEditDelete && !window.rbmOnlyOwnerCanEditDelete()) { showCustomAlert('Hanya Owner yang dapat menghapus data.', 'Akses Ditolak', 'error'); return; }
    showCustomConfirm("Hapus data ini? Stok akan diperbarui.", "Konfirmasi Hapus", function() {
        const key = getRbmStorageKey('RBM_PENDING_BARANG');
        const pending = getCachedParsedStorage(key, []);
        const submission = pending[parentIdx];
        if (!submission || !submission.payload || !submission.payload[itemIdx]) return;
        
        const p = submission.payload[itemIdx];
        const itemInfo = findStokItemId(p.nama);
        
        if (itemInfo) {
            const stokKeyBarang = getRbmStorageKey('RBM_STOK_TRANSACTIONS');
            let stokData = getCachedParsedStorage(stokKeyBarang, {});
            const dateKey = p.tanggal;
            const jenis = p.jenis.toLowerCase().trim();
            
            if (jenis === 'barang masuk') {
                const keyStr = `${itemInfo.id}_in_${dateKey}`;
                stokData[keyStr] = (parseFloat(stokData[keyStr]) || 0) - parseFloat(p.jumlah);
            } else if (jenis === 'barang keluar') {
                const keyOut = `${itemInfo.id}_out_${dateKey}`;
                const keyOutPck = `${itemInfo.id}_outpck_${dateKey}`;
                stokData[keyOut] = (parseFloat(stokData[keyOut]) || 0) - parseFloat(p.jumlah);
                stokData[keyOutPck] = (parseFloat(stokData[keyOutPck]) || 0) - parseFloat(p.jumlah);
                if (p.barangjadi) {
                    const keyFin = `${itemInfo.id}_fin_${dateKey}`;
                    stokData[keyFin] = (parseFloat(stokData[keyFin]) || 0) - parseFloat(p.barangjadi);
                }
            } else if (jenis === 'rusak') {
                const keyStr = `${itemInfo.id}_rusak_${dateKey}`;
                stokData[keyStr] = (parseFloat(stokData[keyStr]) || 0) - parseFloat(p.jumlah);
            } else if (jenis === 'sisa') {
                const keyStr = `${itemInfo.id}_sisa_${dateKey}`;
                delete stokData[keyStr];
            }
            RBMStorage.setItem(stokKeyBarang, JSON.stringify(stokData));
            window._rbmParsedCache[stokKeyBarang] = { data: stokData };
        }
        
        submission.payload.splice(itemIdx, 1);
        if (submission.payload.length === 0) pending.splice(parentIdx, 1);
        
        RBMStorage.setItem(key, JSON.stringify(pending));
        window._rbmParsedCache[key] = { data: pending };
        
        const start = document.getElementById("riwayat_barang_start").value;
        const end = document.getElementById("riwayat_barang_end").value;
        
        const pendingData = pending;
        
        riwayatBarangData = {
            'barang masuk': [],
            'barang keluar': [],
            'sisa': [],
            'rusak': []
        };
        
        pendingData.forEach((subm, pIdx) => {
            const items = subm.payload || [];
            if (Array.isArray(items)) {
                items.forEach((item, iIdx) => {
                    if (item.tanggal >= start && item.tanggal <= end) {
                        const jenis = item.jenis.toLowerCase().trim();
                        const groupKey = jenis === 'barang masuk' ? 'barang masuk' :
                                         jenis === 'barang keluar' ? 'barang keluar' :
                                         jenis === 'sisa' ? 'sisa' :
                                         jenis === 'rusak' ? 'rusak' : null;
                        
                        if (groupKey) {
                            riwayatBarangData[groupKey].push({
                                item: item,
                                parentIdx: pIdx,
                                itemIdx: iIdx
                            });
                        }
                    }
                });
            }
        });
        
        const activeBtn = document.querySelector('.riwayat-filter-btn.active');
        if (activeBtn) {
            const jenis = activeBtn.getAttribute('data-filter');
            filterRiwayatBarang(jenis, activeBtn);
        }
    });
}

function getRiwayatBarangDataForExport() {
    const start = document.getElementById("riwayat_barang_start") && document.getElementById("riwayat_barang_start").value;
    const end = document.getElementById("riwayat_barang_end") && document.getElementById("riwayat_barang_end").value;
    const rows = [];
    ['barang masuk', 'barang keluar', 'sisa', 'rusak'].forEach(jenis => {
        (riwayatBarangData[jenis] || []).forEach(({ item }) => {
            let ket = item.barangjadi ? `Jadi: ${item.barangjadi}` : '';
            if (item.keteranganRusak) ket += (ket ? ' | ' : '') + item.keteranganRusak;
            rows.push({
                Tanggal: item.tanggal,
                Jenis: jenis,
                'Nama Barang': item.nama,
                Jumlah: item.jumlah,
                Keterangan: ket || ''
            });
        });
    });
    return { rows, tglAwal: start || '', tglAkhir: end || '' };
}

function exportRiwayatBarangToExcel() {
    const { rows, tglAwal, tglAkhir } = getRiwayatBarangDataForExport();
    if (rows.length === 0) {
        alert('Tidak ada data untuk di-export. Pilih periode lalu klik Tampilkan terlebih dahulu.');
        return;
    }
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Barang');
        XLSX.writeFile(wb, `Riwayat_Barang_${tglAwal || 'start'}_${tglAkhir || 'end'}.xlsx`);
    } else {
        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>table{border-collapse:collapse;}th,td{border:1px solid #000;padding:6px;}th{background:#1e40af;color:#fff;}</style></head><body><h2>Riwayat Input Barang</h2><p>Periode: ${tglAwal} s/d ${tglAkhir}</p><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Nama Barang</th><th>Jumlah</th><th>Keterangan</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.Tanggal}</td><td>${r.Jenis}</td><td>${r['Nama Barang']}</td><td>${r.Jumlah}</td><td>${r.Keterangan}</td></tr>`).join('')}</tbody></table></body></html>`;
        const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Riwayat_Barang_${tglAwal || 'start'}_${tglAkhir || 'end'}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

function exportRiwayatBarangToPdf() {
    const { rows, tglAwal, tglAkhir } = getRiwayatBarangDataForExport();
    if (rows.length === 0) {
        alert('Tidak ada data untuk dicetak/PDF. Pilih periode lalu klik Tampilkan terlebih dahulu.');
        return;
    }
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('Library PDF belum dimuat. Refresh halaman lalu coba lagi.');
        return;
    }
    const tableRows = rows.map(r => `<tr><td>${r.Tanggal}</td><td>${r.Jenis}</td><td>${r['Nama Barang']}</td><td>${r.Jumlah}</td><td>${r.Keterangan}</td></tr>`).join('');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:900px;padding:20px;font-family:Arial,sans-serif;color:#333;font-size:12px;background:#fff;';
    wrap.innerHTML = '<h2 style="text-align:center;margin-bottom:5px;">Riwayat Input Barang</h2><p class="period" style="text-align:center;margin-top:0;color:#666;">Periode: ' + tglAwal + ' s/d ' + tglAkhir + '</p><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="border:1px solid #ddd;padding:8px;background:#1e40af;color:white;">Tanggal</th><th style="border:1px solid #ddd;padding:8px;background:#1e40af;color:white;">Jenis</th><th style="border:1px solid #ddd;padding:8px;background:#1e40af;color:white;">Nama Barang</th><th style="border:1px solid #ddd;padding:8px;background:#1e40af;color:white;">Jumlah</th><th style="border:1px solid #ddd;padding:8px;background:#1e40af;color:white;">Keterangan</th></tr></thead><tbody>' + tableRows + '</tbody></table>';
    wrap.querySelectorAll('td').forEach(function(td) { td.style.border = '1px solid #ddd'; td.style.padding = '8px'; });
    document.body.appendChild(wrap);
    html2canvas(wrap, { scale: 2, backgroundColor: '#ffffff' }).then(function(canvas) {
        document.body.removeChild(wrap);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 10;
        const w = pageW - margin * 2;
        const h = (canvas.height * w) / canvas.width;
        if (h <= pageH - margin * 2) {
            doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, w, h);
        } else {
            var totalH = h;
            var drawn = 0;
            while (drawn < totalH) {
                var pageImgH = Math.min(pageH - margin * 2, totalH - drawn);
                var srcY = (drawn / totalH) * canvas.height;
                var srcH = (pageImgH / totalH) * canvas.height;
                var small = document.createElement('canvas');
                small.width = canvas.width;
                small.height = Math.ceil(srcH);
                small.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, small.width, small.height);
                doc.addImage(small.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, w, pageImgH);
                drawn += pageImgH;
                if (drawn < totalH) doc.addPage();
            }
        }
        doc.save('Riwayat_Barang_' + (tglAwal || 'start').replace(/-/g, '') + '_' + (tglAkhir || 'end').replace(/-/g, '') + '.pdf');
    }).catch(function(err) {
        document.body.removeChild(wrap);
        alert('Gagal membuat PDF: ' + (err.message || err));
    });
}

// ================= ABSENSI GPS LOGIC =================
let gpsStream = null;
let gpsWatchId = null;
let currentPos = null;

function getOfficeConfigFromStorage() {
    var outletId = typeof getRbmOutlet === 'function' ? getRbmOutlet() : '';
    if (outletId) {
        try {
            var locs = JSON.parse(localStorage.getItem('rbm_outlet_locations') || '{}');
            var loc = locs[outletId];
            if (loc && (loc.lat != null || loc.lon != null)) {
                return {
                    lat: String(loc.lat != null ? loc.lat : ''),
                    lng: String(loc.lon != null ? loc.lon : ''),
                    radius: (loc.radius != null && loc.radius >= 0) ? loc.radius : 50
                };
            }
        } catch (e) {}
    }
    var key = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_GPS_CONFIG') : 'RBM_GPS_CONFIG';
    return getCachedParsedStorage(key, { lat: '', lng: '', radius: 50 });
}

function loadOfficeConfig() {
    var config = getOfficeConfigFromStorage();
    var latEl = document.getElementById('gps_office_lat');
    var lngEl = document.getElementById('gps_office_lng');
    var radEl = document.getElementById('gps_office_radius');
    if (latEl) latEl.value = config.lat;
    if (lngEl) lngEl.value = config.lng;
    if (radEl) radEl.value = config.radius;
}

function saveOfficeConfig() {
    var latEl = document.getElementById('gps_office_lat');
    var lngEl = document.getElementById('gps_office_lng');
    var radEl = document.getElementById('gps_office_radius');
    if (!latEl || !lngEl || !radEl) return;
    var lat = latEl.value;
    var lng = lngEl.value;
    var radius = radEl.value;
    var key = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_GPS_CONFIG') : 'RBM_GPS_CONFIG';
    RBMStorage.setItem(key, JSON.stringify({ lat: lat, lng: lng, radius: radius }));
    window._cachedOfficeConfig = null;
    alert("Konfigurasi Lokasi Disimpan!");
    if (typeof checkDistance === 'function') checkDistance();
}

function setCurrentLocationAsOffice() {
    var latEl = document.getElementById('gps_office_lat');
    var lngEl = document.getElementById('gps_office_lng');
    if (!latEl || !lngEl) return;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
            latEl.value = pos.coords.latitude;
            lngEl.value = pos.coords.longitude;
        }, function (err) { alert("Gagal ambil lokasi: " + err.message); });
    } else {
        alert("Geolocation tidak didukung browser ini.");
    }
}

var RBM_GPS_JAM_DEFAULTS = {
    jamMasukPagi: '08:30', jamPulangPagi: '17:00',
    jamMasukMiddle: '12:30', jamPulangMiddle: '21:00',
    jamMasukSore: '16:30', jamPulangSore: '17:00',
    durasiIstirahatPagi: 60,
    durasiIstirahatMiddle: 60,
    durasiIstirahatSore: 60,
    menitTelatPerJamGaji: 10
};

var RBM_GPS_SHIFTS_DEFAULT = [
    { code: 'P', name: 'Pagi', jamMasuk: '08:30', jamMasukSPV: '08:15', jamPulang: '17:00', durasiIstirahat: 60 },
    { code: 'M', name: 'Middle', jamMasuk: '12:30', jamMasukSPV: '12:20', jamPulang: '21:00', durasiIstirahat: 60 },
    { code: 'S', name: 'Sore', jamMasuk: '16:30', jamMasukSPV: '16:20', jamPulang: '17:00', durasiIstirahat: 60 }
];

function getGpsJamConfig() {
    var key = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_GPS_JAM_CONFIG') : 'RBM_GPS_JAM_CONFIG';
    var stored = getCachedParsedStorage(key, {});
    
    var rawShifts = stored.shifts;
    var validShifts = [];
    if (Array.isArray(rawShifts)) {
        validShifts = rawShifts;
    } else if (rawShifts && typeof rawShifts === 'object') {
        validShifts = Object.keys(rawShifts).sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); }).map(function(k) { return rawShifts[k]; });
    }
    
    if (validShifts.length > 0) {
        return {
            shifts: validShifts,
            menitTelatPerJamGaji: typeof stored.menitTelatPerJamGaji === 'number' ? stored.menitTelatPerJamGaji : (parseInt(stored.menitTelatPerJamGaji, 10) || 10),
            toleransiTelatMenit: typeof stored.toleransiTelatMenit === 'number' ? stored.toleransiTelatMenit : (parseInt(stored.toleransiTelatMenit, 10) || 0),
            potonganLupaAbsenJam: typeof stored.potonganLupaAbsenJam === 'number' ? stored.potonganLupaAbsenJam : (parseFloat(stored.potonganLupaAbsenJam) || 7)
        };
    }
    var num = function(v, def) { var n = parseInt(v, 10); return (n >= 0 && n <= 999) ? n : def; };
    return {
        shifts: null,
        jamMasukPagi: stored.jamMasukPagi || RBM_GPS_JAM_DEFAULTS.jamMasukPagi,
        jamPulangPagi: stored.jamPulangPagi || RBM_GPS_JAM_DEFAULTS.jamPulangPagi,
        jamMasukMiddle: stored.jamMasukMiddle || RBM_GPS_JAM_DEFAULTS.jamMasukMiddle,
        jamPulangMiddle: stored.jamPulangMiddle || RBM_GPS_JAM_DEFAULTS.jamPulangMiddle,
        jamMasukSore: stored.jamMasukSore || RBM_GPS_JAM_DEFAULTS.jamMasukSore,
        jamPulangSore: stored.jamPulangSore || RBM_GPS_JAM_DEFAULTS.jamPulangSore,
        durasiIstirahatPagi: num(stored.durasiIstirahatPagi, RBM_GPS_JAM_DEFAULTS.durasiIstirahatPagi),
        durasiIstirahatMiddle: num(stored.durasiIstirahatMiddle, RBM_GPS_JAM_DEFAULTS.durasiIstirahatMiddle),
        durasiIstirahatSore: num(stored.durasiIstirahatSore, RBM_GPS_JAM_DEFAULTS.durasiIstirahatSore),
        menitTelatPerJamGaji: typeof stored.menitTelatPerJamGaji === 'number' ? stored.menitTelatPerJamGaji : (parseInt(stored.menitTelatPerJamGaji, 10) || 10),
        toleransiTelatMenit: typeof stored.toleransiTelatMenit === 'number' ? stored.toleransiTelatMenit : (parseInt(stored.toleransiTelatMenit, 10) || 0),
        potonganLupaAbsenJam: typeof stored.potonganLupaAbsenJam === 'number' ? stored.potonganLupaAbsenJam : (parseFloat(stored.potonganLupaAbsenJam) || 7)
    };
}

function getPotonganLupaAbsenJamFromConfig() {
    return getGpsJamConfig().potonganLupaAbsenJam;
}

function getToleransiTelatMenitFromConfig() {
    return getGpsJamConfig().toleransiTelatMenit;
}

function getShiftByCodeFromConfig(shiftCode) {
    var c = getGpsJamConfig();
    if (c.shifts && Array.isArray(c.shifts)) {
        for (var i = 0; i < c.shifts.length; i++) {
            if (c.shifts[i].code === shiftCode) return c.shifts[i];
        }
        return null;
    }
    return null;
}

function getJadwalLabelFromConfig(shiftCode) {
    var s = getShiftByCodeFromConfig(shiftCode);
    if (s && s.name) return s.name;
    return (typeof JADWAL_LABEL !== 'undefined' && JADWAL_LABEL[shiftCode]) ? JADWAL_LABEL[shiftCode] : (shiftCode || '');
}

function getDurasiIstirahatMenitFromConfig(shift) {
    var s = getShiftByCodeFromConfig(shift);
    if (s && s.durasiIstirahat != null) return parseInt(s.durasiIstirahat, 10) || 60;
    var c = getGpsJamConfig();
    if (c.shifts) return 60;
    if (shift === 'P') return c.durasiIstirahatPagi;
    if (shift === 'M') return c.durasiIstirahatMiddle;
    if (shift === 'S') return c.durasiIstirahatSore;
    return 60;
}

function getBatasMasukFromConfig(shift, jabatan) {
    var c = getGpsJamConfig();
    var s = getShiftByCodeFromConfig(shift);
    
    var isManagerOrSPV = false;
    if (jabatan) {
        var jab = String(jabatan).toLowerCase();
        if (jab.includes('manager') || jab.includes('menejer') || jab.includes('spv') || jab.includes('supervisor')) {
            isManagerOrSPV = true;
        }
    }
    
    if (s) {
        if (isManagerOrSPV && s.jamMasukSPV) return s.jamMasukSPV;
        if (s.jamMasuk) return s.jamMasuk;
    }
    
    var baseTime = '';
    if (!c.shifts) {
        if (shift === 'P') baseTime = c.jamMasukPagi;
        else if (shift === 'M') baseTime = c.jamMasukMiddle;
        else if (shift === 'S') baseTime = c.jamMasukSore;
    }
    if (!baseTime && typeof JADWAL_BATAS_MASUK !== 'undefined' && JADWAL_BATAS_MASUK[shift]) {
        baseTime = JADWAL_BATAS_MASUK[shift];
    }
    return baseTime;
}

function getBatasPulangFromConfig(shift, jabatan) {
    var c = getGpsJamConfig();
    var baseTime = '';
    var s = getShiftByCodeFromConfig(shift);
    if (s && s.jamPulang) {
        baseTime = s.jamPulang;
    } else if (!c.shifts) {
        if (shift === 'P') baseTime = c.jamPulangPagi;
        else if (shift === 'M') baseTime = c.jamPulangMiddle;
        else if (shift === 'S') baseTime = c.jamPulangSore;
    }
    if (!baseTime && typeof JADWAL_BATAS_PULANG !== 'undefined' && JADWAL_BATAS_PULANG[shift]) {
        baseTime = JADWAL_BATAS_PULANG[shift];
    }
    return baseTime;
}

function getMenitTelatPerJamGajiFromConfig() {
    return getGpsJamConfig().menitTelatPerJamGaji;
}

function addGpsShiftRow(shift) {
    var tbody = document.getElementById('gps_shifts_tbody');
    if (!tbody) return;
    var row = document.createElement('tr');
    var s = shift || { code: '', name: '', jamMasuk: '08:00', jamMasukSPV: '08:00', jamPulang: '17:00', durasiIstirahat: 60 };
    row.innerHTML =
        '<td><input type="text" class="gps-shift-code" placeholder="P" value="' + (s.code || '').replace(/"/g, '&quot;') + '" style="width:100%; max-width:60px;" maxlength="8"></td>' +
        '<td><input type="text" class="gps-shift-name" placeholder="Nama shift" value="' + (s.name || '').replace(/"/g, '&quot;') + '" style="width:100%;"></td>' +
        '<td><input type="time" class="gps-shift-masuk" value="' + (s.jamMasuk || '08:00') + '" style="width:100%;"></td>' +
        '<td><input type="time" class="gps-shift-masuk-spv" value="' + (s.jamMasukSPV || s.jamMasuk || '08:00') + '" style="width:100%;" title="Jam Masuk Manager/SPV"></td>' +
        '<td><input type="time" class="gps-shift-pulang" value="' + (s.jamPulang || '17:00') + '" style="width:100%;"></td>' +
        '<td><input type="number" class="gps-shift-istirahat" value="' + (s.durasiIstirahat != null ? s.durasiIstirahat : 60) + '" min="0" max="999" style="width:70px;"></td>' +
        '<td><button type="button" class="btn-secondary" onclick="this.closest(\'tr\').remove()" style="padding:2px 6px; font-size:11px;">Hapus</button></td>';
    tbody.appendChild(row);
}

function loadJamConfig() {
    var key = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_GPS_JAM_CONFIG') : 'RBM_GPS_JAM_CONFIG';
    var stored = getCachedParsedStorage(key, {});
    var tbody = document.getElementById('gps_shifts_tbody');
    if (tbody) {
        var thead = tbody.parentElement.querySelector('thead tr');
        if (thead && !thead.getAttribute('data-spv-added')) {
            for (var j = 0; j < thead.children.length; j++) {
                if (thead.children[j].textContent.includes('Jam Masuk') || thead.children[j].textContent.includes('Masuk')) {
                    var th = document.createElement('th');
                    th.textContent = 'Masuk Mgr/SPV';
                    thead.insertBefore(th, thead.children[j].nextSibling);
                    break;
                }
            }
            thead.setAttribute('data-spv-added', 'true');
        }
        tbody.innerHTML = '';
        
        var rawShifts = stored.shifts;
        var validShifts = [];
        if (Array.isArray(rawShifts)) {
            validShifts = rawShifts;
        } else if (rawShifts && typeof rawShifts === 'object') {
            validShifts = Object.keys(rawShifts).sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); }).map(function(k) { return rawShifts[k]; });
        }
        var shifts = validShifts.length > 0 ? validShifts : RBM_GPS_SHIFTS_DEFAULT;
        for (var i = 0; i < shifts.length; i++) addGpsShiftRow(shifts[i]);
    }
    var menitEl = document.getElementById('gps_menit_telat_per_jam');
    if (menitEl) menitEl.value = (typeof stored.menitTelatPerJamGaji === 'number' ? stored.menitTelatPerJamGaji : (parseInt(stored.menitTelatPerJamGaji, 10) || 10));
    var tolEl = document.getElementById('gps_toleransi_telat_menit');
    if (tolEl) tolEl.value = (typeof stored.toleransiTelatMenit === 'number' ? stored.toleransiTelatMenit : (parseInt(stored.toleransiTelatMenit, 10) || 0));
    var lupaEl = document.getElementById('gps_potongan_lupa_absen_jam');
    if (lupaEl) lupaEl.value = (typeof stored.potonganLupaAbsenJam === 'number' ? stored.potonganLupaAbsenJam : (parseFloat(stored.potonganLupaAbsenJam) || 7));
    
    var existingConfig = document.getElementById('spv_mgr_jam_config');
    if (existingConfig) {
        existingConfig.style.display = 'none';
    }
}

function saveJamConfig() {
    var tbody = document.getElementById('gps_shifts_tbody');
    var shifts = [];
    if (tbody) {
        var rows = tbody.querySelectorAll('tr');
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var code = (r.querySelector('.gps-shift-code') && r.querySelector('.gps-shift-code').value || '').trim();
            var name = (r.querySelector('.gps-shift-name') && r.querySelector('.gps-shift-name').value || '').trim();
            var jamMasuk = r.querySelector('.gps-shift-masuk') && r.querySelector('.gps-shift-masuk').value;
            var jamMasukSPV = r.querySelector('.gps-shift-masuk-spv') && r.querySelector('.gps-shift-masuk-spv').value;
            var jamPulang = r.querySelector('.gps-shift-pulang') && r.querySelector('.gps-shift-pulang').value;
            var durasiEl = r.querySelector('.gps-shift-istirahat');
            var durasi = (durasiEl && durasiEl.value !== '') ? parseInt(durasiEl.value, 10) : 60;
            if (!code) continue;
            shifts.push({
                code: code,
                name: name || code,
                jamMasuk: jamMasuk || '08:00',
                jamMasukSPV: jamMasukSPV || jamMasuk || '08:00',
                jamPulang: jamPulang || '17:00',
                durasiIstirahat: (durasi >= 0 && durasi <= 999) ? durasi : 60
            });
        }
    }
    if (shifts.length === 0) shifts = RBM_GPS_SHIFTS_DEFAULT;
    
    var mEl = document.getElementById('gps_menit_telat_per_jam');
    var menitTelatPerJamGaji = (mEl && mEl.value !== '') ? parseInt(mEl.value, 10) : 10;
    
    var tolEl = document.getElementById('gps_toleransi_telat_menit');
    var toleransiTelatMenit = (tolEl && tolEl.value !== '') ? parseInt(tolEl.value, 10) : 0;
    
    var lupaEl = document.getElementById('gps_potongan_lupa_absen_jam');
    var potonganLupaAbsenJam = (lupaEl && lupaEl.value !== '') ? parseFloat(lupaEl.value) : 7;
    
    var key = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_GPS_JAM_CONFIG') : 'RBM_GPS_JAM_CONFIG';
    var objToSave = { shifts: shifts, menitTelatPerJamGaji: menitTelatPerJamGaji, toleransiTelatMenit: toleransiTelatMenit, potonganLupaAbsenJam: potonganLupaAbsenJam };
    
    window._rbmParsedCache = window._rbmParsedCache || {};
    window._rbmParsedCache[key] = { data: objToSave };
    
    var p = RBMStorage.setItem(key, JSON.stringify(objToSave));
    if (p && typeof p.then === 'function') {
        p.then(function() { alert("Pengaturan Jam Disimpan!"); }).catch(function(err) { alert("Gagal menyimpan: " + (err && err.message ? err.message : 'periksa koneksi')); });
    } else {
        alert("Pengaturan Jam Disimpan!");
    }
}

/** Normalisasi descriptor dari node gps_kiosk/faces atau blob lama Firebase. */
function normalizeGpsKioskDescriptor(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) return raw;
    if (raw.descriptor != null) {
        var d = raw.descriptor;
        if (Array.isArray(d)) return d;
        if (d && typeof d === 'object') {
            return Object.keys(d).sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); }).map(function(k) { return d[k]; });
        }
    }
    // [PERBAIKAN] Jika Firebase mengembalikan array sebagai objek {0: val, 1: val} langsung tanpa bungkus .descriptor
    if (typeof raw === 'object' && raw[0] !== undefined) {
        return Object.keys(raw).sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); }).map(function(k) { return raw[k]; });
    }
    return null;
}

function initAbsensiGPS() {
    // Fungsi ini dipanggil setelah DB siap, jadi kita panggil lagi untuk me-refresh data.
    // UI awal (nama karyawan) sudah di-load dari cache di bawah.
    populateGpsNames();
    loadOfficeConfig();
    if (typeof loadJamConfig === 'function') loadJamConfig();
    initAbsensiHardware(); // Panggil lagi untuk memastikan, tidak akan jalan ganda
}

function populateGpsNames() {
    const select = document.getElementById('gps_absen_name');
    if (!select) return;
    const currentValue = select.value;

    function normalizeEmployees(val) {
        if (Array.isArray(val)) return val.filter(function(emp) { return emp && emp.name; });
        if (val && typeof val === 'object') {
            return Object.keys(val).map(function(k) { return val[k]; }).filter(function(emp) { return emp && emp.name; });
        }
        return [];
    }

    function loadEmployeesFromStorage() {
        var key = getRbmStorageKey('RBM_EMPLOYEES');
        var employees = normalizeEmployees(safeParse(RBMStorage.getItem(key), []));
        if (employees.length) return employees;
        // Fallback key untuk beberapa format data lama / cache awal
        employees = normalizeEmployees(safeParse(RBMStorage.getItem('RBM_EMPLOYEES'), []));
        if (employees.length) return employees;
        employees = normalizeEmployees(safeParse(localStorage.getItem('RBM_EMPLOYEES_ALL'), []));
        return employees;
    }

    window._gpsKioskRosterEmployees = null;

    const employees = loadEmployeesFromStorage();
    if (employees.length === 0) {
        select.innerHTML = '<option value="">-- Memuat Data Karyawan... --</option>';
        try {
            if (window._gpsNamesLoadTimer) clearTimeout(window._gpsNamesLoadTimer);
            window._gpsNamesLoadTimer = setTimeout(function() {
                var sel = document.getElementById('gps_absen_name');
                if (!sel) return;
                var stillEmpty = true;
                try {
                    var k = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_EMPLOYEES') : 'RBM_EMPLOYEES';
                    var raw = (window.RBMStorage && RBMStorage.getItem(k)) || localStorage.getItem(k);
                    if (raw && raw.length > 5) stillEmpty = false;
                } catch (e2) {}
                if (stillEmpty && sel.options.length <= 1) {
                    sel.innerHTML = '<option value="">⚠️ Gagal muat nama. Tap Refresh atau cek jaringan.</option>';
                }
            }, 18000);
        } catch (e0) {}

        function applyGpsNameOptions(list) {
            var sel2 = document.getElementById('gps_absen_name');
            if (!sel2) return;
            try {
                if (window._gpsNamesLoadTimer) { clearTimeout(window._gpsNamesLoadTimer); window._gpsNamesLoadTimer = null; }
            } catch (eT) {}
            if (list && list.length > 0) {
                sel2.innerHTML = '<option value="">-- Pilih Nama --</option>';
                list.forEach(function(emp) {
                    if (emp && emp.name) sel2.innerHTML += `<option value="${emp.name}">${emp.name}</option>`;
                });
                if (Array.from(sel2.options).some(function(opt) { return opt.value === currentValue; })) {
                    sel2.value = currentValue;
                }
            } else {
                sel2.innerHTML = '<option value="">⚠️ Belum ada data karyawan untuk outlet ini.</option>';
            }
        }

        function runFullFirebaseSync() {
            if (!window.RBMStorage || typeof window.RBMStorage.loadFromFirebase !== 'function') return;
            if (window._gpsNamesSyncInFlight) return;
            window._gpsNamesSyncInFlight = true;
            window.RBMStorage.loadFromFirebase().then(function() {
                setTimeout(function() {
                    try {
                        window._gpsKioskRosterEmployees = null;
                        applyGpsNameOptions(loadEmployeesFromStorage());
                    } catch (e) {}
                }, 0);
            }).catch(function() {
                try {
                    if (window._gpsNamesLoadTimer) clearTimeout(window._gpsNamesLoadTimer);
                    var sel3 = document.getElementById('gps_absen_name');
                    if (sel3 && sel3.options.length <= 1) {
                        sel3.innerHTML = '<option value="">⚠️ Gagal muat. Tap Refresh atau login ulang.</option>';
                    }
                } catch (e3) {}
            }).finally(function() {
                window._gpsNamesSyncInFlight = false;
            });
        }

        var tryKiosk = window.RBM_PAGE === 'absensi-gps-view' &&
            typeof useFirebaseBackend === 'function' && useFirebaseBackend() &&
            typeof FirebaseStorage !== 'undefined' &&
            FirebaseStorage.loadGpsKioskRoster && FirebaseStorage.loadGpsKioskDayCells;

        if (tryKiosk) {
            window._gpsNamesSyncInFlight = true;
            var outletK = getRbmOutlet() || 'default';
            FirebaseStorage.loadGpsKioskRoster(outletK).then(function(roster) {
                if (!roster || !roster.employees || !roster.employees.length) throw new Error('no_roster');
                window._gpsKioskRosterEmployees = roster.employees;
                applyGpsNameOptions(window._gpsKioskRosterEmployees || []);
            }).catch(function() {
                window._gpsKioskRosterEmployees = null;
                runFullFirebaseSync();
            }).finally(function() {
                window._gpsNamesSyncInFlight = false;
            });
        } else {
            runFullFirebaseSync();
        }
    } else {
        select.innerHTML = '<option value="">-- Pilih Nama --</option>';
        employees.forEach(emp => {
            select.innerHTML += `<option value="${emp.name}">${emp.name}</option>`;
        });
    }
    if (Array.from(select.options).some(opt => opt.value === currentValue)) {
        select.value = currentValue;
    }
    if (!select.onchange) {
        select.onchange = function() {
            window._cachedGpsName = null;
            updateGpsJadwalDisplay();
            if (typeof checkDistance === 'function') checkDistance();
            const faceStatus = document.getElementById('face_id_status_info');
            if (!this.value) {
                if (typeof window.stopLiveFaceVerification === 'function') window.stopLiveFaceVerification();
                if (faceStatus) {
                    faceStatus.innerHTML = "✅ Sistem AI Siap. Silakan pilih nama Anda.";
                    faceStatus.style.color = "#15803d";
                    faceStatus.style.background = "#f0fdf4";
                    faceStatus.style.borderColor = "#bbf7d0";
                }
                return;
            }
            // Face ID per karyawan: ambil dari gps_kiosk/faces/{id} (1 read), fallback blob lama setelah model siap.
            (function gpsLoadFaceThenModels() {
                var nameSel = document.getElementById('gps_absen_name');
                var name = nameSel ? nameSel.value : '';
                if (!name) return;
                
                function goModels() {
                    if (typeof window.loadFaceApiModelsForAbsensi === 'function') window.loadFaceApiModelsForAbsensi(false);
                }

                // [OPTIMASI KILAT] Cek memori HP dulu! Jika wajah sudah pernah didownload, LANGSUNG JALAN tanpa nunggu server.
                var faceKey = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_FACE_DATA') : 'RBM_FACE_DATA';
                var faceDataCache = getCachedParsedStorage(faceKey, {});
                if (faceDataCache[name] && faceDataCache[name].length > 0) {
                    goModels();
                    return; // Berhenti di sini, lompat ke pemindaian
                }

                var outlet = typeof getRbmOutlet === 'function' ? getRbmOutlet() : '';
                var emList = (window._gpsKioskRosterEmployees && window._gpsKioskRosterEmployees.length)
                    ? window._gpsKioskRosterEmployees
                    : getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
                var emp = emList.find(function(e) { return e && e.name === name; });
                var empIdToUse = (emp && emp.id != null) ? emp.id : (emp ? emList.indexOf(emp) : null);
                if (typeof useFirebaseBackend === 'function' && useFirebaseBackend() &&
                    typeof FirebaseStorage !== 'undefined' && FirebaseStorage.loadGpsKioskFace) {
                    var fallbackToMaster = function() {
                        // [PERBAIKAN] Fallback: Cari wajah spesifik ini langsung ke Data Master (Gudang Utama)
                        var sfx = outlet ? '_' + outlet.toLowerCase().replace(/[^a-z0-9_]/g, '_') : '';
                        firebase.database().ref('rbm_pro/face_data' + sfx + '/' + name).once('value').then(function(snap) {
                            var masterRaw = snap.val();
                            var masterDesc = normalizeGpsKioskDescriptor(masterRaw);
                            if (masterDesc && masterDesc.length) {
                                var faceKey = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_FACE_DATA') : 'RBM_FACE_DATA';
                                var fd = getCachedParsedStorage(faceKey, {});
                                fd[name] = masterDesc;
                                window._rbmParsedCache[faceKey] = { data: fd };
                                // FIX: Hanya simpan di memori lokal HP, jangan timpa ulang ke Firebase!
                                try { localStorage.setItem(faceKey, JSON.stringify(fd)); } catch(e) {}
                            }
                            goModels();
                        }).catch(goModels);
                    };
                    if (empIdToUse != null) {
                        FirebaseStorage.loadGpsKioskFace(outlet, empIdToUse).then(function(raw) {
                            var desc = normalizeGpsKioskDescriptor(raw);
                            if (desc && desc.length) {
                                var faceKey = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_FACE_DATA') : 'RBM_FACE_DATA';
                                var fd = getCachedParsedStorage(faceKey, {});
                                fd[name] = desc;
                                window._rbmParsedCache[faceKey] = { data: fd };
                                // FIX: Hanya simpan di memori lokal HP, jangan timpa ulang ke Firebase!
                                try { localStorage.setItem(faceKey, JSON.stringify(fd)); } catch(e) {}
                                goModels();
                            } else {
                                fallbackToMaster();
                            }
                        }).catch(fallbackToMaster);
                    } else {
                        fallbackToMaster();
                    }
                } else {
                    goModels();
                }
            })();
        };
    }
    // [PERFORMA] Jangan hitung jadwal/sisa cuti saat startup.
    // Tampilkan detail hanya setelah karyawan memilih nama.
    if (select.value) updateGpsJadwalDisplay();
}

window._faceVerified = false;
window._faceVerificationInterval = null;

function getRegisteredFaceDescriptorByName(name) {
    if (!name) return null;
    var faceKey = typeof getRbmStorageKey === 'function' ? getRbmStorageKey('RBM_FACE_DATA') : 'RBM_FACE_DATA';
    var faceData = getCachedParsedStorage(faceKey, {});
    if (!faceData || typeof faceData !== 'object') return null;
    var raw = faceData[name];
    var desc = normalizeGpsKioskDescriptor(raw);
    return (desc && desc.length) ? desc : null;
}

window._playSuccessBeep = function() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.1);
    } catch(e) {}
};

window.startLiveFaceVerification = function() {
    // [DINONAKTIFKAN SEPENUHNYA] Bypass AI Face Detection untuk menghemat baterai & CPU HP
    window._faceVerified = true;
    if (typeof checkDistance === 'function') checkDistance();
    return;
};

window.stopLiveFaceVerification = function() {
    window._faceVerified = false;
};

window.isFaceApiLoaded = window.isFaceApiLoaded || false;
window._faceApiLoading = window._faceApiLoading || false;
window.loadFaceApiModelsForAbsensi = async function(silent = false) {
    // [DINONAKTIFKAN SEPENUHNYA] Stop unduhan model AI raksasa yang bikin HP panas!
    window.isFaceApiLoaded = true;
    window._faceVerified = true;
    
    const faceStatus = document.getElementById('face_id_status_info');
    const nameSel = document.getElementById('gps_absen_name');
    const name = nameSel ? nameSel.value : '';

    if (faceStatus) {
        if (!name) {
            faceStatus.innerHTML = "✅ Sistem Siap. Silakan pilih nama Anda.";
        } else {
            faceStatus.innerHTML = "✅ Siap. Silakan klik tombol Absen di bawah.";
        }
        faceStatus.style.color = "#15803d";
        faceStatus.style.background = "#dcfce7";
        faceStatus.style.borderColor = "#bbf7d0";
    }
    
    if (typeof checkDistance === 'function') checkDistance();
    return;
};

function initAbsensiHardware() {
    if (window._gpsHardwareStarted) return; // Cegah double init
    window._gpsHardwareStarted = true;

    // [FIX] Bersihkan pencarian lokasi sebelumnya
    if (typeof gpsWatchId !== 'undefined' && gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    // Start Camera
    const video = document.getElementById('gps_video');
    if (video && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // [PERCEPATAN] Pastikan video dibisukan agar browser seluler (terutama iOS) langsung mengizinkan autoplay instan
            video.muted = true;
            
            // [PERCEPATAN] Minta resolusi menengah (480p) agar hardware kamera tidak butuh waktu negosiasi sensor lama
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 480 } } })
        .then(stream => {
            gpsStream = stream;
            video.srcObject = stream;
        })
        .catch(err => {
            window._gpsHardwareStarted = false;
            var msg = "Kamera tidak tersedia";
            if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                msg = "❌ Izin Kamera Ditolak";
                showCustomAlert("Akses kamera ditolak!<br><br>Fitur absensi <b>WAJIB</b> menggunakan foto wajah Anda untuk validasi kehadiran.<br><br><b>Cara memperbaiki:</b><br>1. Ketuk ikon gembok (atau logo situs) di samping alamat web.<br>2. Pilih 'Izin' atau 'Permissions'.<br>3. Izinkan akses <b>Kamera</b>.<br>4. Sistem otomatis meminta ulang dalam 3 detik...", "Izin Kamera Wajib", "error");
                setTimeout(function() { window.initAbsensiHardware(); }, 3000);
            }
            var el = document.getElementById('gps_status_overlay');
            if (el) el.innerHTML = msg + " <button class='btn-secondary' style='padding:2px 6px; font-size:10px; margin-left:5px; color:#333;' onclick='window.location.reload()'>Refresh</button>";
        });
    } else {
        var el = document.getElementById('gps_status_overlay');
        if (el) el.innerText = "Kamera tidak didukung perangkat ini.";
    }

    // Start GPS Watch
    if (navigator.geolocation) {
        // [OPTIMASI KILAT] Gunakan getCurrentPosition dulu untuk mendapatkan lokasi terakhir dengan sangat cepat,
        // lalu lanjutkan dengan watchPosition untuk akurasi tinggi.
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                if (!currentPos) {
                    currentPos = pos.coords;
                    checkDistance();
                }
            }, 
            function() {}, 
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );

        // Tambahkan timeout 15 detik & maximumAge 10 detik agar watchPosition bisa mereturn cache jika posisi tidak banyak berubah
        var geoOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 };

        gpsWatchId = navigator.geolocation.watchPosition(
            pos => {
                currentPos = pos.coords;
                checkDistance();
            },
            err => {
                var msg = "GPS Error: " + err.message;
                var action = "window._gpsHardwareStarted=false; window.initAbsensiHardware()";
                var btnText = "Ulangi";
                
                if (err.code === 1) {
                    msg = "❌ Izin Lokasi Ditolak.";
                    action = "window.location.reload()";
                    btnText = "Refresh";
                    window._gpsHardwareStarted = false;
                    showCustomAlert("Akses lokasi (GPS) ditolak!<br><br>Fitur absensi <b>WAJIB</b> mendeteksi posisi Anda untuk memastikan Anda berada di lokasi outlet.<br><br><b>Cara memperbaiki:</b><br>1. Pastikan GPS/Lokasi HP Anda menyala.<br>2. Ketuk ikon gembok di samping alamat web.<br>3. Pilih 'Izin' atau 'Permissions'.<br>4. Izinkan akses <b>Lokasi</b>.<br>5. Sistem otomatis meminta ulang dalam 3 detik...", "Izin Lokasi Wajib", "error");
                    setTimeout(function() { window.initAbsensiHardware(); }, 3000);
                }
                else if (err.code === 2) msg = "❌ Lokasi tidak tersedia. Pastikan GPS HP Anda menyala.";
                else if (err.code === 3) msg = "⚠️ Sinyal GPS Lemah (Timeout). Coba geser ke area terbuka.";
                
                var el = document.getElementById('gps_status_overlay');
                if(el) el.innerHTML = msg + " <button class='btn-secondary' style='padding:2px 6px; font-size:10px; margin-left:5px; color:#333;' onclick='" + action + "'>" + btnText + "</button>";
            },
            geoOptions
        );
    } else {
        var el = document.getElementById('gps_status_overlay');
        if(el) el.innerText = "Browser tidak support GPS";
    }

    // [PERFORMA] Jangan auto-load Face API di startup.
    // Model akan dimuat saat nama karyawan dipilih.
}

// Stop camera/gps when leaving view (optional optimization)

function checkDistance() {
    var latEl = document.getElementById('gps_office_lat');
    var lngEl = document.getElementById('gps_office_lng');
    var radEl = document.getElementById('gps_office_radius');
    var officeLat, officeLng, maxRadius;
    if (latEl && lngEl && radEl) {
        officeLat = parseFloat(latEl.value);
        officeLng = parseFloat(lngEl.value);
        maxRadius = parseFloat(radEl.value) || 50;
    } else {
        // [OPTIMASI] Gunakan cache config agar tidak baca localStorage ratusan kali per menit
        if (!window._cachedOfficeConfig) {
            window._cachedOfficeConfig = getOfficeConfigFromStorage();
        }
        officeLat = parseFloat(window._cachedOfficeConfig.lat);
        officeLng = parseFloat(window._cachedOfficeConfig.lng);
        maxRadius = parseFloat(window._cachedOfficeConfig.radius) || 50;
    }

    var statusEl = document.getElementById('gps_status_overlay');
    var infoEl = document.getElementById('gps_distance_info');
    if (!statusEl || !infoEl) return;

    if (!currentPos || isNaN(officeLat) || isNaN(officeLng)) {
        statusEl.innerText = "Menunggu Konfigurasi / Sinyal GPS...";
        return;
    }

    var dist = getDistanceFromLatLonInM(currentPos.latitude, currentPos.longitude, officeLat, officeLng);
    var distStr = Math.round(dist);

    var infoText = "Jarak ke titik: " + distStr + " Meter (Max: " + maxRadius + "m)";
    infoEl.innerText = infoText;

    var inRange = dist <= maxRadius;

    if (inRange) {
        statusEl.innerText = "✅ Dalam Area Absensi";
        statusEl.style.background = "rgba(25, 135, 84, 0.7)";
    } else {
        statusEl.innerText = "❌ Di Luar Area Absensi";
        statusEl.style.background = "rgba(220, 53, 69, 0.7)";
    }

    // Logic Kunci Tombol berdasarkan Status Absensi
    var nameEl = document.getElementById('gps_absen_name');
    var name = nameEl ? nameEl.value : '';
    
    var disableAll = !inRange || !name;

    // Kunci tombol jika wajah belum terdaftar
    /* [FITUR FACE ID DINONAKTIFKAN SEMENTARA]
    if (name) {
        var desc = getRegisteredFaceDescriptorByName(name);
        if (!desc) {
            disableAll = true; 
        } else if (typeof faceapi !== 'undefined' && window.isFaceApiLoaded) {
            // Tombol hanya aktif jika wajah di kamera = true / cocok
            if (!window._faceVerified) disableAll = true;
        }
    }
    */
    var statusMsg = "";

    if (name) {
        var now = new Date();
        var today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
        
        // [OPTIMASI KILAT] Hindari parse JSON gps_logs (foto base64 besar) pada setiap sinyal GPS agar HP karyawan tidak Hang/Macet
        // Data ini sudah di-fetch khusus oleh updateGpsJadwalDisplay saat nama dipilih.
        statusMsg = window._cachedGpsStatusMsg;
    }

    if (statusMsg) {
        infoEl.innerHTML = infoText + "<br><div style='margin-top:6px; font-weight:bold; color:#1e40af; background:#dbeafe; padding:6px 12px; border-radius:6px; display:inline-block; font-size:13px;'>" + statusMsg + "</div>";
    } else {
        infoEl.innerText = infoText;
    }

    var btnM = document.getElementById('btn_absen_masuk');
    var btnP = document.getElementById('btn_absen_pulang');
    var btnBO = document.getElementById('btn_absen_break_out');
    var btnBI = document.getElementById('btn_absen_break_in');

    if (btnM) btnM.disabled = disableAll;
    if (btnP) btnP.disabled = disableAll;
    if (btnBO) btnBO.disabled = disableAll;
    if (btnBI) btnBI.disabled = disableAll;
}

function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    var R = 6371000; // Radius of the earth in m
    var dLat = deg2rad(lat2-lat1);
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in m
    return d;
}

function deg2rad(deg) { return deg * (Math.PI/180); }

function getBreakStats(logs, name, date) {
    let total = 0;
    let lastOut = null;
    logs.forEach(l => {
        if (l.name === name && l.date === date) {
            if (l.type === 'Istirahat Keluar') {
                lastOut = parseTimeToMinutes(l.time);
            } else if (l.type === 'Istirahat Kembali') {
                if (lastOut !== null) {
                    let inTime = parseTimeToMinutes(l.time);
                    let dur = inTime - lastOut;
                    if (dur < 0) dur += 24 * 60;
                    total += dur;
                    lastOut = null;
                }
            }
        }
    });
    return { total, lastOut };
}

async function loadRekapAbsensiGPS() {
    const tglAwal = document.getElementById("rekap_gps_start").value;
    const tglAkhir = document.getElementById("rekap_gps_end").value;
    const filterNama = document.getElementById("rekap_gps_filter_nama").value;
    const tbody = document.getElementById("rekap_gps_tbody");

    // [NEW] Cek status tombol mata (Tampilkan/Sembunyikan baris kosong)
    const showEmpty = localStorage.getItem('RBM_SHOW_EMPTY_ABSENSI') !== '0';
    const toggleBtn = document.getElementById('toggle-empty-rows-btn');
    if (toggleBtn) {
        toggleBtn.innerHTML = showEmpty ? '👁️' : '🙈';
        toggleBtn.title = showEmpty ? 'Sembunyikan yang belum absen' : 'Tampilkan yang belum absen';
        toggleBtn.style.opacity = showEmpty ? '1' : '0.7';
    }

    // [OPTIMASI KILAT] Gunakan pola Stale-While-Revalidate
    const renderTable = (logs) => {
        const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
        const jadwalData = getCachedParsedStorage(getRbmStorageKey('RBM_JADWAL_DATA'), {});
        let filtered = logs.filter(l => l.date >= tglAwal && l.date <= tglAkhir);

        const dates = [];
        let curr = new Date(tglAwal);
        const end = new Date(tglAkhir);
        while (curr <= end) {
            dates.push(getLocalDateKey(new Date(curr)));
            curr.setDate(curr.getDate() + 1);
        }

        window._rekapGpsPage = window._rekapGpsPage || 1;
        const daysPerPage = 3;
        const totalPages = Math.ceil(dates.length / daysPerPage) || 1;
        if (window._rekapGpsPage > totalPages) window._rekapGpsPage = totalPages;
        if (window._rekapGpsPage < 1) window._rekapGpsPage = 1;
        const pageStart = (window._rekapGpsPage - 1) * daysPerPage;
        const pageDates = dates.slice(pageStart, pageStart + daysPerPage);

        const grouped = {};
        filtered.forEach(log => {
            if (pageDates.indexOf(log.date) < 0) return;
            const key = `${log.date}_${log.name}`;
            if (!grouped[key]) grouped[key] = { date: log.date, name: log.name, masuk: null, breakOuts: [], breakIns: [], pulang: null, hasLog: true };
            grouped[key].hasLog = true;
            if (log.type === 'Masuk' && !grouped[key].masuk) grouped[key].masuk = log;
            else if (log.type === 'Pulang') grouped[key].pulang = log;
            else if (log.type === 'Istirahat Keluar') grouped[key].breakOuts.push(log);
            else if (log.type === 'Istirahat Kembali') grouped[key].breakIns.push(log);
        });

        const canDelete = window.rbmOnlyOwnerCanEditDelete && (window.rbmOnlyOwnerCanEditDelete() || (JSON.parse(localStorage.getItem('rbm_user')||'{}').username||'').toLowerCase() === 'burhan');

        let keys = [];
        if (showEmpty) {
            pageDates.forEach(function(d) {
                employees.forEach(function(emp) {
                    const name = emp && emp.name ? emp.name : '';
                    if (!name) return;
                    const key = `${d}_${name}`;
                    if (!grouped[key]) grouped[key] = { date: d, name: name, masuk: null, breakOuts: [], breakIns: [], pulang: null, hasLog: false };
                    keys.push(key);
                });
            });
        } else {
            keys = Object.keys(grouped);
        }

        if (filterNama) keys = keys.filter(k => grouped[k] && grouped[k].name === filterNama);
        keys.sort((a, b) => {
            if (grouped[a].date !== grouped[b].date) return grouped[b].date.localeCompare(grouped[a].date);
            return grouped[a].name.localeCompare(grouped[b].name);
        });

        if (keys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Tidak ada data pada halaman ini.</td></tr>';
        } else {
            const empMap = {};
            employees.forEach(e => { empMap[e.name] = e; });

            function getLupaAbsen(item) {
                const lupa = [];
                if (!item.masuk) lupa.push('Masuk');
                if (item.breakOuts.length === 0 || item.breakIns.length > item.breakOuts.length) lupa.push('Istirahat Keluar');
                if (item.breakIns.length === 0 || item.breakOuts.length > item.breakIns.length) lupa.push('Istirahat Kembali');
                if (!item.pulang) lupa.push('Pulang');
                if (lupa.length === 0) return '-';
                return 'Lupa ' + lupa.join(' & ');
            }

            let html = '';
            keys.forEach(k => {
                const item = grouped[k];
                if (!item.hasLog) {
                    if (showEmpty) {
                        html += `<tr style="background:#f8fafc; color:#94a3b8;"><td>${item.date}</td><td>${item.name}</td><td colspan="7" style="text-align:center; font-style:italic; font-size:12px;">Tidak ada data absensi (Belum Absen / Libur)</td></tr>`;
                    }
                    return;
                }
                const buildGpsLogCaption = (log) => {
                    if (!log) return '';
                    let s = (log.name || '') + ' - ' + (log.type || '') + ' | ' + (log.date || '') + ' ' + (log.time || '');
                    if (log.lat != null && log.lng != null) s += ' | Lat: ' + Number(log.lat).toFixed(5) + ', Lng: ' + Number(log.lng).toFixed(5);
                    return s;
                };
                const renderCell = (logOrArray) => {
                    const renderSingleLog = (log) => {
                        if (!log || log.id == null) return '<span>-</span>';
                        const captionEsc = buildGpsLogCaption(log).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        
                        let timeHtml = '';
                        if (log.photo && typeof log.photo === 'string' && log.photo.length > 100 && log.photo.indexOf('LAZY_SPLIT_') === -1) {
                            timeHtml = `<span title="Klik untuk lihat foto: ${captionEsc.replace(/&quot;/g,'"')}" style="color:#1d4ed8; cursor:pointer; font-weight:600; text-decoration:underline;" onclick="showImageModal('${log.photo}', '${log.type} - ${log.time}')">📷 ${log.time}</span>`;
                        } else {
                            timeHtml = `<span title="Klik untuk lihat foto: ${captionEsc.replace(/&quot;/g,'"')}" style="color:#1d4ed8; cursor:pointer; font-weight:600; text-decoration:underline;" onclick="fetchAndShowGpsPhoto('${log.date}', '${log._firebaseKey || ''}', '${log.id}', '${log.type} - ${log.time}', this)">📷 ${log.time}</span>`;
                        }
                        
                        const deleteHtml = canDelete ? ` <span style="cursor:pointer; color:#dc3545; font-size:14px; vertical-align:middle; margin-left:4px;" onclick="deleteSingleGpsLog(${log.id})" title="Hapus absensi ini">&#x2715;</span>` : '';
                        return `<div style="white-space:nowrap; display:flex; align-items:center; justify-content:flex-start;">${timeHtml}${deleteHtml}</div>`;
                    };
                    if (!logOrArray) return renderSingleLog(null);
                    if (Array.isArray(logOrArray)) return logOrArray.length > 0 ? logOrArray.map(renderSingleLog).join('<br>') : '-';
                    return renderSingleLog(logOrArray);
                };
                const detailTelat = getDetailTelatUntukRekap(item.date, item.name, item, employees, jadwalData, empMap);
                const isBenarBenarTelat = detailTelat.totalMenit > 0;
                const lupaAbsen = getLupaAbsen(item);
                const lupaMasuk = !item.masuk;
                const lupaPulang = !item.pulang;
                const lupaBreakOut = item.breakOuts.length === 0 || item.breakIns.length > item.breakOuts.length;
                const lupaBreakIn = item.breakIns.length === 0 || item.breakOuts.length > item.breakIns.length;
                const detailTelatEsc = JSON.stringify({ lines: detailTelat.lines }).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                const telatHtml = isBenarBenarTelat ? '<span style="color:#b91c1c; font-weight:bold; cursor:pointer; text-decoration:underline;" onclick="showDetailTelatModal(\'' + item.date + '\', \'' + (item.name || '').replace(/'/g, "\\'") + '\', \'' + detailTelatEsc + '\')">Ya (' + detailTelat.totalMenit + 'm)</span>' : '-';
                const lupaHtml = lupaAbsen !== '-' ? '<span style="color:#b45309; font-weight:bold; cursor:pointer; text-decoration:underline;" onclick="showDetailLupaModal(\'' + item.date + '\', \'' + (item.name || '').replace(/'/g, "\\'") + '\', ' + lupaMasuk + ', ' + lupaPulang + ', ' + lupaBreakOut + ', ' + lupaBreakIn + ')">' + lupaAbsen + '</span>' : '-';

                const breakStats = getBreakStats(filtered, item.name, item.date);
                const totalIstirahat = breakStats.total > 0 ? breakStats.total + ' menit' : '-';
                html += `<tr${isBenarBenarTelat || lupaAbsen !== '-' ? ' style="background:#fef2f2;"' : ''}>
                    <td>${item.date}</td>
                    <td>${item.name}</td>
                    <td>${renderCell(item.masuk)}</td>
                    <td>${renderCell(item.breakOuts)}</td>
                    <td>${renderCell(item.breakIns)}</td>
                    <td>${totalIstirahat}</td>
                    <td>${renderCell(item.pulang)}</td>
                    <td>${telatHtml}</td>
                    <td>${lupaHtml}</td>
                </tr>`;
            });
            tbody.innerHTML = html;
        }
        let paginationEl = document.getElementById('rekap_gps_pagination');
        if (!paginationEl) {
            paginationEl = document.createElement('div');
            paginationEl.id = 'rekap_gps_pagination';
            paginationEl.style.cssText = "display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;";
            const tableCard = tbody.closest('.table-card') || tbody.parentElement;
            if (tableCard) tableCard.appendChild(paginationEl);
        }
        paginationEl.innerHTML = `
            <button class="btn btn-secondary" ${window._rekapGpsPage === 1 ? 'disabled' : ''} onclick="window._rekapGpsPage--; loadRekapAbsensiGPS()">⬅️ Prev</button>
            <span style="font-size:14px; font-weight:bold; color:#1e40af;">Hal ${window._rekapGpsPage} dari ${totalPages} (per ${daysPerPage} hari)</span>
            <button class="btn btn-secondary" ${window._rekapGpsPage === totalPages ? 'disabled' : ''} onclick="window._rekapGpsPage++; loadRekapAbsensiGPS()">Next ➡️</button>
        `;
        const legend = document.getElementById('rekap_gps_legend');
        if (legend) legend.style.display = 'block';
    };

    let cachedLogs = getCachedParsedStorage(getRbmStorageKey('RBM_GPS_LOGS'), []);
    if (cachedLogs.length > 0) {
        renderTable(cachedLogs);
    } else {
        tbody.innerHTML = '<tr><td colspan="9" class="table-loading">Memuat data dari server... ⏳</td></tr>';
    }

    if (useFirebaseBackend() && typeof FirebaseStorage !== 'undefined' && FirebaseStorage.loadGpsLogs) {
        const outlet = getRbmOutlet() || 'default';
        try {
            // [PERBAIKAN] Tarik juga Jadwal agar kalkulasi telat akurat di Rekap GPS
            if (FirebaseStorage.loadAbsensiJadwal) {
                let jadwalServer = await FirebaseStorage.loadAbsensiJadwal(outlet, 'jadwal', tglAwal, tglAkhir);
                if (jadwalServer) {
                    window._rbmParsedCache[getRbmStorageKey('RBM_JADWAL_DATA')] = { data: jadwalServer };
                }
            }

            let serverLogs = await Promise.race([
                FirebaseStorage.loadGpsLogs(outlet, tglAwal, tglAkhir),
                new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
            ]);
            window._rbmParsedCache[getRbmStorageKey('RBM_GPS_LOGS')] = { data: serverLogs };
                // Langsung render tanpa JSON.stringify untuk mencegah browser hang!
                renderTable(serverLogs);
        } catch(e) {}
    }
}

function toggleEmptyRows() {
    const current = localStorage.getItem('RBM_SHOW_EMPTY_ABSENSI') !== '0';
    localStorage.setItem('RBM_SHOW_EMPTY_ABSENSI', current ? '0' : '1');
    loadRekapAbsensiGPS();
}

function deleteSingleGpsLog(logId) {
    var u = JSON.parse(localStorage.getItem('rbm_user') || '{}');
    var isDev = (u.username || '').toString().toLowerCase() === 'burhan';
    var isOwner = u.role === 'owner';
    
    if (!isDev && !isOwner) {
        showCustomAlert('Akses ditolak. Hanya Owner atau Developer yang bisa menghapus data.', 'Akses Ditolak', 'error');
        return;
    }
    
    showCustomConfirm('Yakin ingin menghapus 1 data absensi ini?', "Konfirmasi Hapus", function() {
        var key = getRbmStorageKey('RBM_GPS_LOGS');
        var logs = getCachedParsedStorage(key, []);
        
        var logToDelete = logs.find(l => l.id == logId);
        if (!logToDelete) { showCustomAlert('Data tidak ditemukan untuk dihapus.', 'Info', 'error'); return; }

        if (window.RBMStorage && window.RBMStorage.isUsingFirebase && window.RBMStorage.isUsingFirebase() && logToDelete._firebaseKey) {
            var outlet = getRbmOutlet() || 'default';
            var ym = logToDelete.date.substring(0, 7);
            var refPath = 'rbm_pro/gps_logs_partitioned/' + outlet + '/' + ym + '/' + logToDelete._firebaseKey;
            window.RBMStorage._db.ref(refPath).remove().then(function() {
                var newLogs = logs.filter(function(l) { return l.id != logId; });
                try { localStorage.setItem(key, JSON.stringify(newLogs)); } catch(e){}
                window._rbmParsedCache[key] = { data: newLogs };
                loadRekapAbsensiGPS();
                showCustomAlert('Data absensi untuk ' + logToDelete.name + ' (' + logToDelete.type + ' ' + logToDelete.time + ') berhasil dihapus.', 'Berhasil', 'success');
            });
        } else {
            var newLogs = logs.filter(function(l) {
                return l.id != logId;
            });
            
            RBMStorage.setItem(key, JSON.stringify(newLogs)).then(function() {
                window._rbmParsedCache[key] = { data: newLogs };
                loadRekapAbsensiGPS();
                showCustomAlert('Data absensi untuk ' + logToDelete.name + ' (' + logToDelete.type + ' ' + logToDelete.time + ') berhasil dihapus.', 'Berhasil', 'success');
            });
        }
    });
}

function populateRekapGpsFilterNama() {
    const filterSelect = document.getElementById("rekap_gps_filter_nama");
    if (!filterSelect) return;
    var key = getRbmStorageKey('RBM_GPS_LOGS');
    var logs = getCachedParsedStorage(key, []);
    var names = [];
    var seen = {};
    logs.forEach(function(log) {
        var n = (log && log.name || '').trim();
        if (n && !seen[n]) { seen[n] = true; names.push(n); }
    });
    
    // [FIX] Selalu gabungkan dengan data Master Karyawan agar nama yang belum absen tetap muncul
    var employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    if (!employees || employees.length === 0) {
        employees = getCachedParsedStorage('RBM_EMPLOYEES', []);
    }
    employees.forEach(function(emp) {
        var n = (emp && emp.name || '').trim();
        if (n && !seen[n]) { seen[n] = true; names.push(n); }
    });

    // [NEW] Nama manual untuk dropdown (disimpan di localStorage per-outlet)
    var manualKey = getRbmStorageKey('RBM_REKAP_GPS_MANUAL_NAMES');
    var manualNames = safeParse(localStorage.getItem(manualKey), []);
    if (Array.isArray(manualNames)) {
        manualNames.forEach(function(nm) {
            var n = (nm || '').toString().trim();
            if (n && !seen[n]) { seen[n] = true; names.push(n); }
        });
    }

    names.sort(function(a, b) { return String(a).localeCompare(String(b)); });
    
    var currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Semua</option>';
    names.forEach(function(n) {
        var opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        filterSelect.appendChild(opt);
    });
    if (currentVal && names.indexOf(currentVal) >= 0) filterSelect.value = currentVal;
}

// Tambah nama manual untuk dropdown Rekap GPS
function addRekapGpsManualName() {
    var input = document.getElementById('rekap_gps_manual_name');
    if (!input) return;
    var name = (input.value || '').toString().trim();
    if (!name) return;
    var manualKey = getRbmStorageKey('RBM_REKAP_GPS_MANUAL_NAMES');
    var manualNames = safeParse(localStorage.getItem(manualKey), []);
    if (!Array.isArray(manualNames)) manualNames = [];
    if (manualNames.indexOf(name) < 0) manualNames.push(name);
    manualNames.sort(function(a, b) { return String(a).localeCompare(String(b)); });
    try { localStorage.setItem(manualKey, JSON.stringify(manualNames)); } catch(e) {}
    input.value = '';
    populateRekapGpsFilterNama();
}

if (typeof addRekapGpsManualName !== 'undefined') window.addRekapGpsManualName = addRekapGpsManualName;

// Data rekap GPS untuk export (Excel/PDF) - sama filter dengan tampilan
function getRekapAbsensiGpsDataForExport() {
    const tglAwal = document.getElementById("rekap_gps_start").value;
    const tglAkhir = document.getElementById("rekap_gps_end").value;
    const filterNama = document.getElementById("rekap_gps_filter_nama").value;
    const logs = getCachedParsedStorage(getRbmStorageKey('RBM_GPS_LOGS'), []);
    let filtered = logs.filter(l => l.date >= tglAwal && l.date <= tglAkhir);
    if (filterNama) filtered = filtered.filter(l => l.name === filterNama);
    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    const jadwalData = getCachedParsedStorage(getRbmStorageKey('RBM_JADWAL_DATA'), {});
    const empMap = {};
    employees.forEach(e => empMap[e.name] = e);

    const grouped = {};
    filtered.forEach(log => {
        const key = `${log.date}_${log.name}`;
        if (!grouped[key]) grouped[key] = { date: log.date, name: log.name, masuk: null, breakOuts: [], breakIns: [], pulang: null };
        if (log.type === 'Masuk' && !grouped[key].masuk) grouped[key].masuk = log;
        else if (log.type === 'Pulang') grouped[key].pulang = log;
        else if (log.type === 'Istirahat Keluar') grouped[key].breakOuts.push(log);
        else if (log.type === 'Istirahat Kembali') grouped[key].breakIns.push(log);
    });
    const keys = Object.keys(grouped).sort().reverse();
    const rows = [];
    keys.forEach(k => {
        const item = grouped[k];
        const telatDetail = getDetailTelatUntukRekap(item.date, item.name, item, employees, jadwalData, empMap);
        const telat = telatDetail.totalMenit > 0 ? 'Ya (' + telatDetail.totalMenit + ' menit)' : '-';
        let lupa = [];
        if (!item.masuk) lupa.push('Masuk');
            if (item.breakOuts.length === 0 || item.breakIns.length > item.breakOuts.length) lupa.push('Istirahat Keluar');
            if (item.breakIns.length === 0 || item.breakOuts.length > item.breakIns.length) lupa.push('Istirahat Kembali');
        if (!item.pulang) lupa.push('Pulang');
        const lupaAbsen = lupa.length ? 'Lupa ' + lupa.join(' & ') : '-';
        const foto = [item.masuk, ...item.breakOuts, ...item.breakIns, item.pulang].filter(Boolean).length ? 'Ada' : '-';
        const breakStats = getBreakStats(filtered, item.name, item.date);
        rows.push({
            date: item.date,
            name: item.name,
            masuk: item.masuk ? item.masuk.time : '-',
            breakOut: item.breakOuts.length ? item.breakOuts.map(l => l.time).join(', ') : '-',
            breakIn: item.breakIns.length ? item.breakIns.map(l => l.time).join(', ') : '-',
            totalIstirahat: breakStats.total > 0 ? breakStats.total + ' menit' : '-',
            pulang: item.pulang ? item.pulang.time : '-',
            telat: telat,
            lupaAbsen: lupaAbsen,
            foto: foto
        });
    });
    return { tglAwal, tglAkhir, filterNama, rows };
}

function exportRekapAbsensiGpsToExcel() {
    const data = getRekapAbsensiGpsDataForExport();
    if (data.rows.length === 0) {
        alert('Tidak ada data untuk di-export. Pilih periode dan klik Tampilkan terlebih dahulu.');
        return;
    }
    const filename = 'Rekap_Absensi_GPS_' + data.tglAwal + '_sd_' + data.tglAkhir + '.xls';
    let tableRows = '';
    data.rows.forEach(r => {
        tableRows += `<tr>
            <td>${r.date}</td>
            <td>${r.name}</td>
            <td>${r.masuk}</td>
            <td>${r.breakOut}</td>
            <td>${r.breakIn}</td>
            <td>${r.totalIstirahat}</td>
            <td>${r.pulang}</td>
            <td>${r.telat}</td>
            <td>${r.lupaAbsen}</td>
        </tr>`;
    });
    const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8">
    <style>table{border-collapse:collapse;width:100%;} th,td{border:1px solid #333;padding:6px;} th{background:#1e40af;color:#fff;}</style>
    </head>
    <body>
    <h2 style="text-align:center;">Rekap Absensi GPS</h2>
    <p style="text-align:center;margin:5px 0 15px;">Riwayat absensi foto dan lokasi. Periode: ${data.tglAwal} s/d ${data.tglAkhir}</p>
    <table>
    <thead><tr>
        <th>Tanggal</th><th>Nama</th><th>Masuk</th><th>Istirahat Keluar</th><th>Istirahat Kembali</th><th>Total Istirahat</th><th>Pulang</th><th>Telat</th><th>Lupa Absen</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
    </table>
    </body>
    </html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function printRekapAbsensiGpsPdf() {
    const data = getRekapAbsensiGpsDataForExport();
    if (data.rows.length === 0) {
        alert('Tidak ada data untuk dicetak. Pilih periode dan klik Tampilkan terlebih dahulu.');
        return;
    }
    const printWindow = window.open('', '', 'height=700,width=900');
    if (!printWindow) { alert('Izinkan pop-up untuk mencetak / save PDF.'); return; }
    let tableRows = '';
    data.rows.forEach(r => {
        tableRows += `<tr>
            <td>${r.date}</td>
            <td>${r.name}</td>
            <td>${r.masuk}</td>
            <td>${r.breakOut}</td>
            <td>${r.breakIn}</td>
            <td>${r.totalIstirahat}</td>
            <td>${r.pulang}</td>
            <td>${r.telat}</td>
            <td>${r.lupaAbsen}</td>
        </tr>`;
    });
    const html = `
    <html>
    <head><title>Rekap Absensi GPS</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;color:#333;}
      h2{text-align:center;margin-bottom:5px;}
      p.period{text-align:center;margin-top:0;color:#666;}
      table{width:100%;border-collapse:collapse;font-size:12px;}
      th,td{border:1px solid #ddd;padding:8px;}
      th{background:#1e40af;color:white;-webkit-print-color-adjust:exact;}
      @media print{@page{size:landscape;margin:1cm;} body{-webkit-print-color-adjust:exact;}}
    </style>
    </head>
    <body>
    <h2>Rekap Absensi GPS</h2>
    <p class="period">Riwayat absensi foto dan lokasi. Periode: ${data.tglAwal} s/d ${data.tglAkhir}</p>
    <table>
    <thead><tr>
      <th>Tanggal</th><th>Nama</th><th>Masuk</th><th>Istirahat Keluar</th><th>Istirahat Kembali</th><th>Total Istirahat</th><th>Pulang</th><th>Telat</th><th>Lupa Absen</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
    </table>
    </body>
    </html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function() { printWindow.print(); printWindow.close(); }, 500);
}

// Batas jam masuk & pulang per shift (format HH:mm). 10 menit telat = 1 jam di Rekap Gaji.
const JADWAL_BATAS_MASUK = { 'P': '08:30', 'M': '12:30', 'S': '16:30' };
const JADWAL_BATAS_PULANG = { 'P': '17:00', 'M': '21:00', 'S': '17:00' };
const JADWAL_LABEL = { 'P': 'Pagi', 'M': 'Middle', 'S': 'Sore', 'Off': 'Libur' };
const MENIT_TELAT_PER_JAM_GAJI = 10; // 10 menit = 1 jam untuk potongan gaji

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = String(timeStr).replace(/,/g, '.').split(/[.:]/).map(n => parseInt(n, 10) || 0);
    const h = parts[0] || 0, m = parts[1] || 0;
    return h * 60 + m;
}

function getDetailTelatUntukRekap(date, name, item, employees, jadwalData, empMap) {
    const emp = empMap ? empMap[name] : employees.find(e => e.name === name);
    const empId = emp ? (emp.id != null ? emp.id : employees.indexOf(emp)) : null;
    if (empId === null) return { totalMenit: 0, lines: [], jamUntukGaji: 0 };
    const jadwalKey = `${date}_${empId}`;
    const shift = jadwalData[jadwalKey];
    const batasMasuk = (typeof getBatasMasukFromConfig === 'function' ? getBatasMasukFromConfig(shift, emp.jabatan) : null) || JADWAL_BATAS_MASUK[shift];
    const batasPulang = (typeof getBatasPulangFromConfig === 'function' ? getBatasPulangFromConfig(shift, emp.jabatan) : null) || JADWAL_BATAS_PULANG[shift];
    const toleransi = typeof getToleransiTelatMenitFromConfig === 'function' ? getToleransiTelatMenitFromConfig() : 0;
    const lines = [];
    let menitTelatMasuk = 0, menitPulangCepat = 0;
    if (item.masuk && item.masuk.time && batasMasuk) {
        const menitBatas = parseTimeToMinutes(batasMasuk);
        const menitMasuk = parseTimeToMinutes(item.masuk.time);
        if (menitMasuk > menitBatas) {
            const telatAsli = menitMasuk - menitBatas;
            if (telatAsli <= toleransi) {
                lines.push('Telat Masuk: ' + telatAsli + ' mnt (Dimaafkan krn toleransi ' + toleransi + ' mnt)');
            } else {
                    menitTelatMasuk = telatAsli;
                    lines.push('Telat Masuk: ' + telatAsli + ' mnt (Melebihi toleransi ' + toleransi + ' mnt, dihitung FULL dari batas ' + batasMasuk + ')');
            }
        }
    }
    if (item.pulang && item.pulang.time && batasPulang) {
        const menitBatas = parseTimeToMinutes(batasPulang);
        const menitPulang = parseTimeToMinutes(item.pulang.time);
        if (menitPulang < menitBatas) {
            menitPulangCepat = menitBatas - menitPulang;
            lines.push('Pulang Cepat: ' + menitPulangCepat + ' menit (Batas ' + batasPulang + ', Pulang ' + item.pulang.time + ')');
        }
    }
    const totalMenit = menitTelatMasuk + menitPulangCepat;
    const menitPerJam = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : MENIT_TELAT_PER_JAM_GAJI;
    const jamUntukGaji = menitPerJam > 0 ? totalMenit / menitPerJam : 0;
    if (totalMenit > 0) lines.push('Total durasi telat: ' + totalMenit + ' menit (= ' + jamUntukGaji.toFixed(1) + ' jam untuk Rekap Gaji)');
    return { totalMenit, lines, jamUntukGaji, menitTelatMasuk, menitPulangCepat };
}

function showDetailTelatModal(date, name, detailJson) {
    if (typeof detailJson === 'string') {
        detailJson = detailJson.replace(/&quot;/g, '"');
        try { detailJson = JSON.parse(detailJson); } catch (e) { detailJson = { lines: [] }; }
    }
    const detail = detailJson || {};
    const title = document.getElementById('gpsDetailModalTitle');
    const body = document.getElementById('gpsDetailModalBody');
    title.textContent = 'Detail Telat - ' + name + ' (' + date + ')';
    body.innerHTML = detail.lines && detail.lines.length ? detail.lines.map(l => '<p style="margin:4px 0;">' + l + '</p>').join('') : '<p>Tidak ada detail telat.</p>';
    var footer = document.getElementById('gpsDetailModalFooter');
    if (footer && typeof getMenitTelatPerJamGajiFromConfig === 'function') {
        var n = getMenitTelatPerJamGajiFromConfig();
        footer.textContent = 'Aturan: ' + n + ' menit telat = 1 jam (masuk ke Rekap Gaji)';
    }
    document.getElementById('gpsDetailModal').style.display = 'flex';
}

function showDetailLupaModal(date, name, lupaMasuk, lupaPulang, lupaBreakOut, lupaBreakIn) {
    const title = document.getElementById('gpsDetailModalTitle');
    const body = document.getElementById('gpsDetailModalBody');
    title.textContent = 'Detail Lupa Absen - ' + name + ' (' + date + ')';
    const lines = [];
    if (lupaMasuk) lines.push('Tidak ada catatan absen <strong>Masuk</strong> pada tanggal ini.');
        if (lupaBreakOut) lines.push('Tidak ada catatan absen <strong>Istirahat Keluar</strong> pada tanggal ini (atau jumlah tidak sesuai).');
        if (lupaBreakIn) lines.push('Tidak ada catatan absen <strong>Istirahat Kembali</strong> pada tanggal ini (atau jumlah tidak sesuai).');
    if (lupaPulang) lines.push('Tidak ada catatan absen <strong>Pulang</strong> pada tanggal ini.');
    body.innerHTML = lines.length ? lines.map(l => '<p style="margin:8px 0;">' + l + '</p>').join('') : '<p>-</p>';
    document.getElementById('gpsDetailModal').style.display = 'flex';
}

function closeGpsDetailModal() {
    const el = document.getElementById('gpsDetailModal');
    if (el) el.style.display = 'none';
}

// Total menit telat dari GPS untuk satu karyawan dalam periode (untuk Rekap Gaji)
function getTotalMenitTelatFromGps(empId, empName, tglAwal, tglAkhir) {
    const logs = getCachedParsedStorage(getRbmStorageKey('RBM_GPS_LOGS'), []);
    const jadwalData = getCachedParsedStorage(getRbmStorageKey('RBM_JADWAL_DATA'), {});
    const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
    const empMap = {};
    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    employees.forEach(e => empMap[e.name] = e);
    
    const byDate = {};
    logs.forEach(log => {
        if ((log.name || '').trim().toLowerCase() !== (empName || '').trim().toLowerCase()) return;
        if (log.date < tglAwal || log.date > tglAkhir) return;
        const key = log.date;
        if (!byDate[key]) byDate[key] = { masuk: null, pulang: null, breakOuts: [], breakIns: [] };
        if (log.type === 'Masuk') byDate[key].masuk = log;
        else if (log.type === 'Pulang') byDate[key].pulang = log;
        else if (log.type === 'Istirahat Keluar') byDate[key].breakOuts.push(log);
        else if (log.type === 'Istirahat Kembali') byDate[key].breakIns.push(log);
    });
    let totalMenit = 0;
    let totalLupaAbsenKali = 0;

    const dates = [];
    let curr = new Date(tglAwal);
    const end = new Date(tglAkhir);
    while (curr <= end) {
        dates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }

    dates.forEach(d => {
        const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const absKey = `${dateStr}_${empId}`;
        const item = byDate[dateStr] || { masuk: null, pulang: null, breakOuts: [], breakIns: [] };
        
        if (byDate[dateStr]) {
            const detailTelat = getDetailTelatUntukRekap(dateStr, empName, item, employees, jadwalData, empMap);
            totalMenit += detailTelat.totalMenit;
        }

        if (absensiData[absKey] === 'H') {
            if (!item.masuk) totalLupaAbsenKali += 1;
            if (!item.pulang) totalLupaAbsenKali += 1;
            
            if (item.breakOuts.length === 0) {
                totalLupaAbsenKali += 1;
            } else if (item.breakIns.length > item.breakOuts.length) {
                totalLupaAbsenKali += (item.breakIns.length - item.breakOuts.length);
            }
            
            if (item.breakIns.length === 0) {
                totalLupaAbsenKali += 1;
            } else if (item.breakOuts.length > item.breakIns.length) {
                totalLupaAbsenKali += (item.breakOuts.length - item.breakIns.length);
            }
        }
    });

    const configLupaAbsenJam = typeof getPotonganLupaAbsenJamFromConfig === 'function' ? getPotonganLupaAbsenJamFromConfig() : 7;
    const configTelat = typeof getMenitTelatPerJamGajiFromConfig === 'function' ? getMenitTelatPerJamGajiFromConfig() : 10;
    
    if (totalLupaAbsenKali > 0) {
        totalMenit += (totalLupaAbsenKali * configLupaAbsenJam * configTelat);
    }

    return totalMenit;
}

async function updateGpsJadwalDisplay() {
    const name = document.getElementById('gps_absen_name').value;
    const box = document.getElementById('gps_jadwal_display');
    const textEl = document.getElementById('gps_jadwal_text');
    const faceStatus = document.getElementById('face_id_status_info');
    if (!box || !textEl) return;
    if (!name) {
        box.style.display = 'none';
        if (faceStatus && window.isFaceApiLoaded) {
            faceStatus.innerHTML = "✅ Sistem AI Siap. Silakan pilih nama Anda.";
            faceStatus.style.color = "#15803d";
            faceStatus.style.background = "#f0fdf4";
            faceStatus.style.borderColor = "#bbf7d0";
        }
        if (typeof window.stopLiveFaceVerification === 'function') window.stopLiveFaceVerification();
        return;
    }

    const employees = (window._gpsKioskRosterEmployees && window._gpsKioskRosterEmployees.length)
        ? window._gpsKioskRosterEmployees
        : getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    const emp = employees.find(e => e.name === name);
    if (!emp) {
        textEl.textContent = '-';
        return;
    }
    const now = new Date();
    const today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    const ym = today.substring(0, 7);
    const outlet = typeof getRbmOutlet === 'function' ? getRbmOutlet() : 'default';
    const empIdSafe = (emp.id != null) ? emp.id : emp.name.replace(/[^a-zA-Z0-9]/g, '_');
    
    textEl.innerHTML = '<span style="color:#64748b;">Memuat data khusus untuk Anda... ⏳</span>';
    box.style.display = 'block';

    let shift = '';
    let myLogs = [];
    let hrData = {};
    let spSettingsData = {};

    // [KEMBALI KE AWAL] Fetch data dari server HANYA khusus untuk karyawan yang dipilih
    if (typeof FirebaseStorage !== 'undefined' && FirebaseStorage.isReady()) {
        const db = FirebaseStorage.db();
        try {
            const [shiftSnap, logsSnap, hrSnap, spSettingsSnap] = await Promise.all([
                db.ref(`rbm_pro/jadwal/${outlet}/${ym}/${today}_${emp.id}`).once('value'),
                db.ref(`rbm_pro/gps_logs_partitioned/${outlet}/${ym}`).limitToLast(100).once('value'),
                db.ref(`rbm_pro/hr_karyawan/${outlet}/${empIdSafe}`).once('value'),
                db.ref(`rbm_pro/hr_sp_settings/${outlet}`).once('value')
            ]);
            
            shift = shiftSnap.val() || '';
            const logsVal = logsSnap.val();
            if (logsVal) {
                myLogs = Object.values(logsVal).filter(l => l.name === name && l.date === today);
            }
            hrData = hrSnap.val() || {};
            spSettingsData = spSettingsSnap.val() || {};

            window._cachedHrData = window._cachedHrData || {};
            window._cachedHrData[empIdSafe] = hrData;
            window._cachedSpSettings = spSettingsData;
        } catch (e) {
            console.warn("Gagal fetch data spesifik", e);
        }
    } else {
        const jadwalData = getCachedParsedStorage(getRbmStorageKey('RBM_JADWAL_DATA'), {});
        const jadwalKey = `${today}_${emp.id || employees.indexOf(emp)}`;
        shift = jadwalData[jadwalKey] || '';
        
        const allLogs = getCachedParsedStorage(getRbmStorageKey('RBM_GPS_LOGS'), []);
        myLogs = allLogs.filter(l => l.name === name && l.date === today);
    
        hrData = (window._cachedHrData && window._cachedHrData[empIdSafe]) || {};
        spSettingsData = window._cachedSpSettings || {};
    }

    window._cachedGpsMyLogs = myLogs || [];
    const label = (typeof getJadwalLabelFromConfig === 'function' ? getJadwalLabelFromConfig(shift) : null) || (typeof JADWAL_LABEL !== 'undefined' && JADWAL_LABEL[shift]) || shift || 'Tidak ada jadwal';
    
    // Hitung sisa istirahat dari log spesifik ini
    const stats = getBreakStats(myLogs, name, today);
    const batasMenit = typeof getDurasiIstirahatMenitFromConfig === 'function' ? getDurasiIstirahatMenitFromConfig(shift) : 60;
    
    let info = '';
    
    let isOnLeave = false;
    let leaveCode = '';
    if (['PH','AL','DP'].includes(shift)) {
        isOnLeave = true;
        leaveCode = shift;
    }

        if (shift && !isOnLeave) {
            const batasMasuk = (typeof getBatasMasukFromConfig === 'function' ? getBatasMasukFromConfig(shift, emp.jabatan) : null) || (typeof JADWAL_BATAS_MASUK !== 'undefined' ? JADWAL_BATAS_MASUK[shift] : null);
            if (batasMasuk) {
                const hasMasuk = myLogs && myLogs.some(l => l.type === 'Masuk');
                const toleransi = typeof getToleransiTelatMenitFromConfig === 'function' ? getToleransiTelatMenitFromConfig() : 0;
                const menitBatas = parseTimeToMinutes(batasMasuk);
                
                if (!hasMasuk) {
                    const menitSekarang = now.getHours() * 60 + now.getMinutes();
                    if (menitSekarang > menitBatas) {
                        const menitTelat = menitSekarang - menitBatas;
                        if (toleransi > 0 && menitTelat <= toleransi) {
                            info += `<div style="margin-top:8px; font-size:13px;"><span style="color:#b45309; font-weight:600;">Batas Masuk: ${batasMasuk} (Telat ${menitTelat} menit - Dimaafkan)</span></div>`;
                        } else {
                            info += `<div style="margin-top:8px; font-size:13px;"><span style="color:#dc2626; font-weight:600;">⚠️ Anda Telat ${menitTelat} menit (Batas Masuk: ${batasMasuk})</span></div>`;
                        }
                    } else {
                            info += `<div style="margin-top:8px; font-size:13px;"><span style="color:#16a34a; font-weight:600;">Batas Masuk: ${batasMasuk} (Belum telat)</span></div>`;
                    }
                } else {
                    const masukLog = myLogs.find(l => l.type === 'Masuk');
                    if (masukLog && masukLog.time) {
                        const menitMasuk = parseTimeToMinutes(masukLog.time);
                        if (menitMasuk > menitBatas) {
                            const menitTelat = menitMasuk - menitBatas;
                            if (toleransi > 0 && menitTelat <= toleransi) {
                                info += `<div style="margin-top:8px; font-size:13px;"><span style="color:#b45309; font-weight:600;">Waktu Masuk: ${masukLog.time} (Telat ${menitTelat} menit - Dimaafkan)</span></div>`;
                            } else {
                                info += `<div style="margin-top:8px; font-size:13px;"><span style="color:#dc2626; font-weight:600;">⚠️ Waktu Masuk: ${masukLog.time} (Telat ${menitTelat} menit)</span></div>`;
                            }
                        } else {
                            info += `<div style="margin-top:8px; font-size:13px;"><span style="color:#16a34a; font-weight:600;">Waktu Masuk: ${masukLog.time} (Tepat waktu)</span></div>`;
                        }
                    }
                }
            }

            info += `<div style="margin-top:6px; font-size:12px; color:#64748b;">Jatah Istirahat: ${batasMenit} menit.`;
            if (stats.total > 0) {
                info += ` | Terpakai: ${stats.total} menit.`;
            }
            
            if (stats.lastOut !== null) {
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                let currentDur = currentMinutes - stats.lastOut;
                if (currentDur < 0) currentDur += 24 * 60;
                info += ` <span style="color:#d97706; font-weight:600;">(Sedang Istirahat: ${currentDur} menit)</span>`;
            } else {
                const sisa = batasMenit - stats.total;
                info += sisa >= 0 ? ` <span style="color:#16a34a; font-weight:600;">(Sisa: ${sisa} menit)</span>` : ` <span style="color:#dc2626; font-weight:600;">(Over: ${Math.abs(sisa)} menit)</span>`;
            }
            info += `</div>`;
        }

        let cutiInfo = `<div style="font-size:13px; color:#334155; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-top:16px;">
            <strong style="display:block; margin-bottom:8px; color:#475569; font-size:12px;">SISA CUTI KAMU:</strong>
            <div style="display:flex; justify-content:space-around; text-align:center;">
                <span><span style="font-size:10px; color:#64748b; display:block;">Tahunan (AL)</span><strong style="font-size:18px; color:#15803d;">${emp.sisaAL || 0}</strong></span>
                <span><span style="font-size:10px; color:#64748b; display:block;">Pengganti (DP)</span><strong style="font-size:18px; color:#15803d;">${emp.sisaDP || 0}</strong></span>
                <span><span style="font-size:10px; color:#64748b; display:block;">Tgl Merah (PH)</span><strong style="font-size:18px; color:#15803d;">${emp.sisaPH || 0}</strong></span>
            </div>
        </div>`;

        let quoteMasaKerja = spSettingsData.quoteMasaKerja || 'Terima kasih atas dedikasi dan kontribusinya selama ini. Terus berikan yang terbaik!';
        if (quoteMasaKerja.trim() === 'Terima kasih atas dedikasi dan kontribusinya selama') {
            quoteMasaKerja = 'Terima kasih atas dedikasi dan kontribusinya selama ini. Terus berikan yang terbaik!';
        }
        let durasiMasaKerja = 'Belum disetting';
        if (emp.joinDate) {
            const start = new Date(emp.joinDate);
            const now2 = new Date();
            start.setHours(0,0,0,0); now2.setHours(0,0,0,0);
            if (now2 >= start && !isNaN(start.getTime())) {
                let years = now2.getFullYear() - start.getFullYear();
                let months = now2.getMonth() - start.getMonth();
                let days = now2.getDate() - start.getDate();
                if (days < 0) { months--; const prevMonth = new Date(now2.getFullYear(), now2.getMonth(), 0); days += prevMonth.getDate(); }
                if (months < 0) { years--; months += 12; }
                let res = [];
                if (years > 0) res.push(`${years} thn`);
                if (months > 0) res.push(`${months} bln`);
                if (days > 0) res.push(`${days} hr`);
                durasiMasaKerja = res.length > 0 ? res.join(', ') : 'Hari ini';
            }
        }
        let spHtml = '';
        if (hrData.sp && hrData.sp.length > 0) {
            let activeCount = 0;
            const n = new Date();
            let spDetails = [];
            hrData.sp.forEach(sp => {
                let isActive = false;
                let endD = null;
                if (sp.berlakuHingga) {
                    endD = new Date(sp.berlakuHingga);
                    endD.setHours(23,59,59,999);
                    if (n <= endD) isActive = true;
                } else { isActive = true; }
                if (isActive) {
                    activeCount++;
                    let startD = new Date(sp.tanggal);
                    startD.setHours(0,0,0,0);
                    let diffTime = n - startD;
                    let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    let berjalanStr = sp.tanggal ? (diffDays < 0 ? `Belum mulai (H${diffDays})` : (diffDays === 0 ? 'Hari ini' : `${diffDays} hari`)) : '-';
                    
                    spDetails.push(`
                      <div style="margin-top:8px; padding:10px; background:white; border-radius:6px; font-size:12px; color:#7f1d1d; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                         <strong style="font-size:13px; color:#b91c1c;">${sp.tingkat || 'SP'}</strong>
                         <div style="margin-top:6px; display:grid; grid-template-columns:60px 1fr; gap:4px; font-size:11px;">
                             <span style="color:#9ca3af;">Berlaku:</span> <span><strong>${sp.tanggal ? new Date(sp.tanggal).toLocaleDateString('id-ID') : '-'}</strong> s/d <strong>${sp.berlakuHingga ? new Date(sp.berlakuHingga).toLocaleDateString('id-ID') : '-'}</strong></span>
                             <span style="color:#9ca3af;">Berjalan:</span> <span><strong>${berjalanStr}</strong></span>
                             <span style="color:#9ca3af;">Alasan:</span> <span>${sp.keterangan || '-'}</span>
                         </div>
                         <div style="margin-top:6px; padding-top:6px; border-top:1px dotted #fecaca; font-weight:600; color:#b91c1c; font-size:11px;">Sanksi: ${sp.sanksi || '-'}</div>
                      </div>
                    `);
                }
            });
            if (activeCount > 0) {
                spHtml = `<div style="margin-top:12px; background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:8px; color:#dc2626;">
                    <div style="font-weight:bold; font-size:13px; display:flex; align-items:center; gap:6px;"><span>⚠️</span> Terdapat ${activeCount} Surat Peringatan Aktif!</div>
                    ${spDetails.join('')}
                </div>`;
            }
        }
        let notesHtml = '';
        if (hrData.notes) {
            notesHtml = `<div style="margin-top:12px; background:#fef2f2; border:1px solid #ef4444; padding:12px; border-radius:8px; color:#b91c1c; font-size:12px; line-height:1.5;">
                <div style="font-size:13px; margin-bottom:6px; display:flex; align-items:center; gap:6px;"><span>⚠️</span> <strong>CATATAN HR:</strong></div>
                ${hrData.notes.replace(/\\n/g, '<br>')}
            </div>`;
        }
        let hrSectionHtml = `<div style="font-size:13px; color:#334155; background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #e2e8f0; margin-top:16px;">
            <div style="text-align:center; margin-bottom:${spHtml || notesHtml ? '16px' : '0'};">
                <div style="font-size:11px; color:#64748b; font-weight:700; letter-spacing:1px; margin-bottom:8px;">⭐ MASA KERJA ⭐</div>
                <div style="font-style:italic; color:#475569; font-size:12px; line-height:1.5; margin-bottom:12px;">"${quoteMasaKerja}"</div>
                <div style="color:#0f766e; font-size:16px; font-weight:900; background:#ccfbf1; border:1px solid #99f6e4; display:inline-block; padding:8px 16px; border-radius:24px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">${durasiMasaKerja}</div>
            </div>
            <div style="text-align:left;">
                ${spHtml}
                ${notesHtml}
            </div>
        </div>`;

        let quote = '';
        if (isOnLeave) {
            let leaveName = leaveCode === 'AL' ? 'Cuti Tahunan (AL)' : (leaveCode === 'PH' ? 'Public Holiday (PH)' : 'Day Off Payment (DP)');
            quote = `<div style="font-style:italic; text-align:center; color:#059669; font-size:13px; font-weight:600; border-top:1px dashed #cbd5e1; padding-top:16px; margin-top:16px; line-height:1.5;">"Selamat menikmati ${leaveName} kamu! Lepaskan penat, nikmati waktumu, dan kembalilah dengan energi baru!" 🌴✨</div>`;
        } else {
            const defaultQuote = '"Lakukan rutinitas pekerjaanmu dengan senang hati. Jangan lupa istirahat jika lelah!" 💪😊';
            const customQuote = spSettingsData.quoteAbsensi || defaultQuote;
            quote = `<div style="font-style:italic; text-align:center; color:#64748b; font-size:12px; border-top:1px dashed #cbd5e1; padding-top:16px; margin-top:16px; line-height:1.5;">${customQuote}</div>`;
        }

        textEl.innerHTML = (shift ? `<div style="font-size:16px; color:#1e40af; margin-bottom:12px;"><strong>${shift} (${label})</strong></div>` : `<div style="font-size:16px; color:#1e40af; margin-bottom:12px;"><strong>${label}</strong></div>`) + info + cutiInfo + hrSectionHtml + quote;
        box.style.display = 'block';
        
        if (typeof checkDistance === 'function') checkDistance();
}

function processAbsensiGPS(type) {
    const name = document.getElementById('gps_absen_name').value;
    if (!name) { showCustomAlert("Pilih nama karyawan dulu!", "Perhatian", "error"); return; }
    
    // Gunakan log spesifik yang sudah di-fetch oleh updateGpsJadwalDisplay
    const todayLogs = window._cachedGpsMyLogs || [];
    
    const hasMasuk = todayLogs.some(l => l.type === 'Masuk');
    const hasPulang = todayLogs.some(l => l.type === 'Pulang');
    const breaks = todayLogs.filter(l => l.type === 'Istirahat Keluar' || l.type === 'Istirahat Kembali');
    const lastBreak = breaks.length > 0 ? breaks[breaks.length - 1] : null;
    const isOnBreak = lastBreak && lastBreak.type === 'Istirahat Keluar';

    let warning = null;

    if (type === 'Masuk' && hasMasuk) {
        warning = "Anda sudah absen Masuk hari ini.<br>Ingin absen Masuk lagi?";
    } else if (type === 'Pulang') {
        if (hasPulang) warning = "Anda sudah absen Pulang hari ini.<br>Ingin absen Pulang lagi?";
        else if (!hasMasuk) warning = "Anda belum absen Masuk hari ini.<br>Yakin ingin absen Pulang?";
    } else if (type === 'Istirahat Keluar') {
        if (!hasMasuk) warning = "Anda belum absen Masuk.<br>Yakin ingin absen Istirahat?";
        else if (isOnBreak) warning = "Anda tercatat sedang istirahat.<br>Ingin absen Istirahat Keluar lagi?";
    } else if (type === 'Istirahat Kembali') {
        if (!hasMasuk) warning = "Anda belum absen Masuk.<br>Yakin ingin absen Selesai Istirahat?";
        else if (!isOnBreak) warning = "Anda tidak tercatat sedang istirahat.<br>Yakin ingin absen Selesai Istirahat?";
    }

    if (warning) {
        showCustomConfirm(warning, "Konfirmasi Absensi", function() {
            showCustomAlert("📸 Menjepret foto...<br>Mohon tunggu.", "Memproses", "info");
            setTimeout(function() {
                requestAnimationFrame(function() {
                    _executeAbsensiGPS(type).catch(e => console.error("Error execute:", e));
                });
            }, 150); // Memberi waktu browser menyelesaikan animasi pop-up sebelum membebani CPU
        });
    } else {
        showCustomAlert("📸 Menjepret foto...<br>Mohon tunggu.", "Memproses", "info");
        setTimeout(function() {
            requestAnimationFrame(function() {
                _executeAbsensiGPS(type).catch(e => console.error("Error execute:", e));
            });
        }, 150); // Memberi waktu browser menyelesaikan animasi pop-up sebelum membebani CPU
    }
}

async function _executeAbsensiGPS(type) {
    const name = document.getElementById('gps_absen_name').value;
    if (!currentPos) { showCustomAlert("Lokasi belum ditemukan! Pastikan GPS aktif.", "GPS Error", "error"); return; }

    const video = document.getElementById('gps_video');
    
    // [OPTIMASI SUPER KILAT] Menghapus blok request Data Wajah (Firebase) dari fungsi jepret foto.
    // Karena jika Face ID aktif pun, validasi sudah berjalan secara LIVE menggunakan kamera 
    // sebelum tombol absen diizinkan untuk ditekan.

    const employees = (window._gpsKioskRosterEmployees && window._gpsKioskRosterEmployees.length)
        ? window._gpsKioskRosterEmployees
        : getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    const emp = employees.find(e => e.name === name);
    const empId = emp ? (emp.id || employees.indexOf(emp)) : null;
    
    const now = new Date();
    const today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);

    const canvas = document.getElementById('gps_canvas');
    const context = canvas.getContext('2d');

    // [OPTIMASI KILAT] Matikan penghalusan gambar agar proses jepret lebih cepat dan ringan di HP low-end
    context.imageSmoothingEnabled = false;

    // [OPTIMASI KILAT] Perkecil ukuran foto drastis agar HP tidak lemot/hang
    const MAX_WIDTH = 150; // [EKSTREM] Turunkan ke 150px agar ukuran file hanya beberapa KB
    let scale = 1;
    if (video.videoWidth > MAX_WIDTH) {
        scale = MAX_WIDTH / video.videoWidth;
    }
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dateStr = now.toLocaleDateString('id-ID');
    const timeStr = now.toLocaleTimeString('id-ID');
    const locStr = `Lat: ${currentPos.latitude.toFixed(5)}, Lng: ${currentPos.longitude.toFixed(5)}`;

    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fillRect(0, canvas.height - 40, canvas.width, 40);
    context.font = "12px Arial";
    context.fillStyle = "white";
    context.fillText(`${name} - ${type}`, 5, canvas.height - 22);
    context.font = "9px Arial";
    context.fillText(`${dateStr} ${timeStr} | ${locStr}`, 5, canvas.height - 8);

    // [OPTIMASI KILAT] Gunakan toDataURL langsung karena resolusi sudah sangat kecil (toBlob kadang lambat di HP jadul)
    // [EKSTREM] Turunkan kualitas JPEG menjadi 20% (0.2)
    const photoData = canvas.toDataURL('image/jpeg', 0.2);

    const log = {
        id: Date.now(),
        timestamp: now.toISOString(),
        date: today,
        time: timeStr,
        name: name,
        type: type,
        lat: currentPos.latitude,
        lng: currentPos.longitude,
        photo: photoData
    };

    const gpsKey = getRbmStorageKey('RBM_GPS_LOGS');
    const logs = getCachedParsedStorage(gpsKey, []);
    const myLogs = window._cachedGpsMyLogs || [];
    
    // [OPTIMASI KILAT] Batasi sangat ketat max 3 log lokal agar proses Save/JSON.stringify instan (tidak nge-lag)
    if (logs.length > 3) {
        logs.splice(0, logs.length - 3);
    }

    // Peringatan durasi istirahat (sebelum push log Selesai Istirahat)
    if (type === 'Istirahat Kembali' && empId !== null) {
        const stats = getBreakStats(myLogs, name, today);
        if (stats.lastOut !== null) {
            var menitSelesai = now.getHours() * 60 + now.getMinutes();
            var durasiIni = menitSelesai - stats.lastOut;
            if (durasiIni < 0) durasiIni += 24 * 60;
            var totalDurasi = stats.total + durasiIni;

            var shift = window._cachedGpsShift || '';
            var batasMenit = typeof getDurasiIstirahatMenitFromConfig === 'function' ? getDurasiIstirahatMenitFromConfig(shift) : 60;
            var labelShift = (typeof getJadwalLabelFromConfig === 'function' ? getJadwalLabelFromConfig(shift) : null) || (typeof JADWAL_LABEL !== 'undefined' && JADWAL_LABEL[shift]) || (shift || 'Shift');

            if (batasMenit > 0) {
                if (totalDurasi > batasMenit) {
                    showCustomAlert("⚠️ Peringatan: Total durasi istirahat melebihi batas!<br><br>" + "Shift " + labelShift + ": batas " + batasMenit + " menit.<br>" + "Sudah diambil: " + stats.total + " menit.<br>" + "Istirahat ini: " + durasiIni + " menit.<br>" + "Total: " + totalDurasi + " menit.<br>" + "Over: " + (totalDurasi - batasMenit) + " menit.", "Over Istirahat", "warning");
                } else {
                    showCustomAlert("✅ Selesai Istirahat.<br><br>" + "Istirahat ini: " + durasiIni + " menit.<br>" + "Total hari ini: " + totalDurasi + " menit.<br>" + "Sisa: " + (batasMenit - totalDurasi) + " menit.", "Info Istirahat", "success");
                }
            }
        }
    }

    logs.push(log);
    myLogs.push(log);
    window._cachedGpsMyLogs = myLogs;
    
    // [OPTIMASI KILAT & AMAN] Jangan gunakan setItem untuk gps_logs karena akan menimpa seluruh history!
    // Pastikan log tersimpan ke struktur partitioned agar "Riwayat Absensi" bisa langsung terbaca.
    try {
        if (window.RBMStorage && window.RBMStorage.isUsingFirebase && window.RBMStorage.isUsingFirebase()) {
            var outlet = getRbmOutlet() || 'default';
            var ym = today.substring(0, 7); // YYYY-MM
            var refPath = 'rbm_pro/gps_logs_partitioned/' + outlet + '/' + ym;
            if (window.RBMStorage._db) {
                window.RBMStorage._db.ref(refPath).push(log).catch(function(e) { console.warn("Gagal push log:", e); });
            }
            try { localStorage.setItem(gpsKey, JSON.stringify(logs)); } catch(e){}
        } else {
            RBMStorage.setItem(gpsKey, JSON.stringify(logs));
        }
    } catch (dbErr1) {
        console.warn("DB Error 1:", dbErr1);
        try { localStorage.setItem(gpsKey, JSON.stringify(logs)); } catch(e){}
    }
    window._cachedGpsName = null; // Reset cache agar UI status langsung terupdate

    // Jika absen Masuk: set Hadir (H) di tab Absensi & Jadwal
    if (type === 'Masuk' && empId !== null) {
        const absKey = `${today}_${empId}`;
        try {
            if (window.RBMStorage && window.RBMStorage.isUsingFirebase && window.RBMStorage.isUsingFirebase()) {
                const outlet = getRbmOutlet() || 'default';
                const ym = today.substring(0, 7);
                const path = `rbm_pro/absensi/${outlet}/${ym}/${absKey}`;
                if (window.RBMStorage._db) window.RBMStorage._db.ref(path).set('H').catch(function(e) { console.warn("Gagal set absensi:", e); });
                const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
                absensiData[absKey] = 'H';
            } else {
                const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
                absensiData[absKey] = 'H';
                RBMStorage.setItem(getRbmStorageKey('RBM_ABSENSI_DATA'), JSON.stringify(absensiData));
            }
        } catch (dbErr2) {
            console.warn("DB Error 2:", dbErr2);
        }
    }

    // Cek telat (hanya untuk Masuk)
    let isLate = false;
    if (type === 'Masuk' && empId !== null) {
        const jadwalData = getCachedParsedStorage(getRbmStorageKey('RBM_JADWAL_DATA'), {});
        const jadwalKey = `${today}_${empId}`;
        const shift = jadwalData[jadwalKey];
        const batas = (typeof getBatasMasukFromConfig === 'function' ? getBatasMasukFromConfig(shift, emp ? emp.jabatan : null) : null) || JADWAL_BATAS_MASUK[shift];
        if (batas) {
            const menitBatas = parseTimeToMinutes(batas);
            const jamNow = now.getHours();
            const menitNow = now.getMinutes();
            const menitSekarang = jamNow * 60 + menitNow;
            if (menitSekarang > menitBatas) {
                const menitTelat = menitSekarang - menitBatas;
                const toleransi = typeof getToleransiTelatMenitFromConfig === 'function' ? getToleransiTelatMenitFromConfig() : 0;
                let pesanTelat = "⚠️ Anda tercatat TELAT <b>" + menitTelat + " menit</b>.<br>";
                
                if (toleransi > 0 && menitTelat <= toleransi) {
                    pesanTelat = "⚠️ Anda telat <b>" + menitTelat + " menit</b> (Masih dimaafkan toleransi " + toleransi + " menit).<br>";
                }
                
                showCustomAlert(pesanTelat + "Batas masuk " + ((typeof getJadwalLabelFromConfig === 'function' ? getJadwalLabelFromConfig(shift) : null) || (typeof JADWAL_LABEL !== 'undefined' && JADWAL_LABEL[shift]) || shift) + ": " + batas + "<br>Waktu Anda: " + timeStr, "Terlambat", "warning");
                isLate = true;
            }
        }
    }

    const alertTitle = document.getElementById('rbm-alert-title');
    const isBreakAlertShown = alertTitle && (alertTitle.textContent === 'Over Istirahat' || alertTitle.textContent === 'Info Istirahat');

    if (!isLate && !isBreakAlertShown) {
        showCustomAlert(`Absensi <b>${type}</b> berhasil tercatat!<br>Waktu: <strong>${timeStr}</strong>`, "Sukses", "success");
    }

    // Perbarui tampilan Jadwal & Status agar data terbarunya (seperti info "Sedang Istirahat") langsung muncul
    if (typeof updateGpsJadwalDisplay === 'function') {
        updateGpsJadwalDisplay();
    }
}

function loadMyGpsHistory() {
    const name = document.getElementById('gps_absen_name').value;
    if (!name) { alert("Pilih nama karyawan terlebih dahulu!"); return; }
    
    // Gunakan log spesifik yang sudah di-fetch oleh updateGpsJadwalDisplay
    let baseLogs = window._cachedGpsMyLogs || [];
    if (!Array.isArray(baseLogs) || baseLogs.length === 0) {
        // Fallback: ambil dari cache lokal/partitioned (untuk bulan berjalan)
        try { baseLogs = getCachedParsedStorage(getRbmStorageKey('RBM_GPS_LOGS'), []); } catch(e) {}
    }
    
    // Dapatkan tanggal hari ini dengan format YYYY-MM-DD
    const now = new Date();
    const today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);

    // Filter hanya berdasarkan nama DAN tanggal hari ini saja, lalu urutkan menurun (terbaru di atas)
    const myLogs = baseLogs.filter(l => l.name === name && l.date === today).sort((a, b) => {
        const ta = a.timestamp || (a.date + 'T' + a.time);
        const tb = b.timestamp || (b.date + 'T' + b.time);
        return tb.localeCompare(ta);
    });

    const listContainer = document.getElementById('gpsHistoryList');
    if (!listContainer) return;
    
    if (myLogs.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Belum ada riwayat absensi untuk ' + name + ' pada hari ini.</div>';
    } else {
        let html = '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
        html += '<thead style="background:#f8fafc; color:#64748b;"><tr><th style="padding:10px; text-align:left; border-bottom:1px solid #e2e8f0;">Tanggal</th><th style="padding:10px; text-align:left; border-bottom:1px solid #e2e8f0;">Jam</th><th style="padding:10px; text-align:left; border-bottom:1px solid #e2e8f0;">Status</th></tr></thead><tbody>';
        
        myLogs.forEach(log => {
            let color = '#334155';
            let bg = 'transparent';
            if (log.type === 'Masuk') { color = '#15803d'; bg = '#f0fdf4'; }
            else if (log.type === 'Pulang') { color = '#b91c1c'; bg = '#fef2f2'; }
            else if (log.type.includes('Istirahat')) { color = '#b45309'; bg = '#fffbeb'; }
            
            html += `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px; color:#334155;">${log.date}</td><td style="padding:10px; color:#334155;">${log.time}</td><td style="padding:10px;"><span style="color:${color}; background:${bg}; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600;">${log.type}</span></td></tr>`;
        });
        html += '</tbody></table>';

        // Hitung akumulasi total istirahat hari ini
        const ascendingLogs = [...myLogs].reverse(); // Kembalikan ke urutan kronologis untuk hitungan
        const stats = getBreakStats(ascendingLogs, name, today);
        let totalBreak = stats.total;
        let isOngoing = false;
        if (stats.lastOut !== null) {
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            let currentDur = currentMinutes - stats.lastOut;
            if (currentDur < 0) currentDur += 24 * 60;
            totalBreak += currentDur;
            isOngoing = true;
        }

        if (totalBreak > 0 || isOngoing) {
            html += `<div style="margin-top:15px; padding:12px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; text-align:center; color:#b45309; font-size:13px; font-weight:600;">☕ Total Istirahat Hari Ini: ${totalBreak} menit ${isOngoing ? '<span style="font-size:11px; color:#d97706; font-style:italic;">(sedang berlangsung...)</span>' : ''}</div>`;
        }

        listContainer.innerHTML = html;
    }

    const modal = document.getElementById('gpsHistoryModal');
    if (modal) modal.style.display = 'flex';
}

function closeGpsHistoryModal() {
    const modal = document.getElementById('gpsHistoryModal');
    if (modal) modal.style.display = 'none';
}

function populateManualAbsenNameSelect() {
    const sel = document.getElementById('manual_absen_name');
    if (!sel) return;
    const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
    sel.innerHTML = '<option value="">-- Pilih Nama --</option>';
    employees.forEach(function(emp) {
        const opt = document.createElement('option');
        opt.value = emp.name;
        opt.textContent = emp.name;
        sel.appendChild(opt);
    });
}

function compressImageDataUrl(dataUrl, maxWidth, quality, callback) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.match(/^data:image\//)) {
        if (callback) callback(dataUrl || '');
        return;
    }
    var img = new Image();
    img.onload = function() {
        var w = img.width, h = img.height;
        if (w <= maxWidth && h <= maxWidth) {
            try {
                var c = document.createElement('canvas');
                c.width = w; c.height = h;
                var ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                if (callback) callback(c.toDataURL('image/jpeg', quality || 0.55));
            } catch (e) { if (callback) callback(dataUrl); }
            return;
        }
        var r = maxWidth / Math.max(w, h);
        var nw = Math.round(w * r), nh = Math.round(h * r);
        var canvas = document.createElement('canvas');
        canvas.width = nw; canvas.height = nh;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, nw, nh);
        try {
            if (callback) callback(canvas.toDataURL('image/jpeg', quality || 0.55));
        } catch (e) { if (callback) callback(dataUrl); }
    };
    img.onerror = function() { if (callback) callback(dataUrl); };
    img.src = dataUrl;
}

function saveAbsensiGpsManual(name, type, date, time, photoData, feedbackEl, noAlert) {
    return new Promise(function(resolve, reject) {
        if (!name || !date || !time) {
            if (feedbackEl) { feedbackEl.textContent = 'Nama, tanggal, dan jam wajib.'; feedbackEl.style.color = '#b91c1c'; }
            resolve(false);
            return;
        }
        function doSave(photo) {
            const employees = getCachedParsedStorage(getRbmStorageKey('RBM_EMPLOYEES'), []);
            const emp = employees.find(function(e) { return e.name === name; });
            const empId = emp ? (emp.id != null ? emp.id : employees.indexOf(emp)) : null;
            var timeDisplay = (time.length >= 8 && time.indexOf(':') >= 0) ? time.slice(0, 8) : (time.length >= 5 ? time.slice(0, 5) : time);
            if (timeDisplay.length === 5) timeDisplay = timeDisplay + ':00';
            var isoTime = (time.length >= 8 && /^\d{2}:\d{2}:\d{2}$/.test(time.slice(0, 8))) ? time.slice(0, 8) : (time.length >= 5 ? time.slice(0, 5) + ':00' : time + ':00');
            var isoDate = date + 'T' + isoTime;
            var d = new Date(isoDate);
            if (isNaN(d.getTime())) d = new Date();
            const log = {
                id: Date.now() + Math.floor(Math.random() * 1000), // Tambah random agar ID unik jika loop cepat
                timestamp: d.toISOString(),
                date: date,
                time: timeDisplay,
                name: name,
                type: type,
                lat: null,
                lng: null,
                photo: photo || '',
                manualEntry: true
            };
            const gpsKey = getRbmStorageKey('RBM_GPS_LOGS');
            const logs = getCachedParsedStorage(gpsKey, []);
            logs.push(log);
            
            var savePromise;
            if (window.RBMStorage && window.RBMStorage.isUsingFirebase && window.RBMStorage.isUsingFirebase()) {
                var outlet = getRbmOutlet() || 'default';
                var ym = date.substring(0, 7);
                var refPath = 'rbm_pro/gps_logs_partitioned/' + outlet + '/' + ym;
                if (window.RBMStorage._db) {
                    savePromise = window.RBMStorage._db.ref(refPath).push(log).then(function(){ return true; });
                } else {
                    savePromise = RBMStorage.setItem(gpsKey, JSON.stringify(logs));
                }
                try { localStorage.setItem(gpsKey, JSON.stringify(logs)); } catch(e){}
            } else {
                savePromise = RBMStorage.setItem(gpsKey, JSON.stringify(logs));
            }
            
            savePromise.then(function() {
                if (type === 'Masuk' && empId !== null) {
                    const absKey = date + '_' + empId;
                    if (window.RBMStorage && window.RBMStorage.isUsingFirebase && window.RBMStorage.isUsingFirebase()) {
                        const outlet = getRbmOutlet() || 'default';
                        const ym = date.substring(0, 7);
                        const path = `rbm_pro/absensi/${outlet}/${ym}/${absKey}`;
                        if (window.RBMStorage._db) window.RBMStorage._db.ref(path).set('H');
                        const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
                        absensiData[absKey] = 'H';
                    } else {
                        const absensiData = getCachedParsedStorage(getRbmStorageKey('RBM_ABSENSI_DATA'), {});
                        absensiData[absKey] = 'H';
                        RBMStorage.setItem(getRbmStorageKey('RBM_ABSENSI_DATA'), JSON.stringify(absensiData));
                    }
                }
                if (feedbackEl) {
                    feedbackEl.textContent = 'Absensi ' + type + ' berhasil disimpan (manual). Tanggal: ' + date + ', Jam: ' + timeDisplay;
                    feedbackEl.style.color = 'var(--success)';
                }
                if (!noAlert) alert('Absensi ' + type + ' berhasil disimpan.');
                resolve(true);
            });
        }
        if (photoData && typeof photoData === 'string' && photoData.indexOf('data:image') === 0) {
            compressImageDataUrl(photoData, 800, 0.55, doSave);
        } else {
            doSave(photoData || '');
        }
    });
}

  // Expose functions for inline handlers (onclick/onchange) di halaman RBM terpisah
  if (typeof createPettyCashInputRows !== 'undefined') window.createPettyCashInputRows = createPettyCashInputRows;
  if (typeof createBarangRows !== 'undefined') window.createBarangRows = createBarangRows;
  if (typeof openJadwalModal !== 'undefined') window.openJadwalModal = openJadwalModal;
  if (typeof toggleAbsensiExtraCols !== 'undefined') window.toggleAbsensiExtraCols = toggleAbsensiExtraCols;
  if (typeof selectCalendarDate !== 'undefined') window.selectCalendarDate = selectCalendarDate;
  if (typeof switchStokTab !== 'undefined') window.switchStokTab = switchStokTab;
  if (typeof loadPettyCashData !== 'undefined') window.loadPettyCashData = loadPettyCashData;
  if (typeof loadPembukuanData !== 'undefined') window.loadPembukuanData = loadPembukuanData;
  if (typeof loadInventarisData !== 'undefined') window.loadInventarisData = loadInventarisData;
  if (typeof loadRekapAbsensiGPS !== 'undefined') window.loadRekapAbsensiGPS = loadRekapAbsensiGPS;
  if (typeof createPembukuanRows !== 'undefined') window.createPembukuanRows = createPembukuanRows;
  if (typeof saveAbsensiData !== 'undefined') window.saveAbsensiData = saveAbsensiData;
  if (typeof saveAbsensiToFirebase !== 'undefined') window.saveAbsensiToFirebase = saveAbsensiToFirebase;
  if (typeof saveAbsensiEmployeesToFirebase !== 'undefined') window.saveAbsensiEmployeesToFirebase = saveAbsensiEmployeesToFirebase;
  if (typeof updateEmployee !== 'undefined') window.updateEmployee = updateEmployee;
  if (typeof addEmployeeRow !== 'undefined') window.addEmployeeRow = addEmployeeRow;
  if (typeof removeEmployee !== 'undefined') window.removeEmployee = removeEmployee;
  if (typeof cycleAbsensiStatus !== 'undefined') window.cycleAbsensiStatus = cycleAbsensiStatus;
  if (typeof switchAbsensiTab !== 'undefined') window.switchAbsensiTab = switchAbsensiTab;
  if (typeof syncAbsensiPeriodAndRefresh !== 'undefined') window.syncAbsensiPeriodAndRefresh = syncAbsensiPeriodAndRefresh;
  if (typeof submitPettyCashData !== 'undefined') window.submitPettyCashData = submitPettyCashData;
  if (typeof submitDataBarang !== 'undefined') window.submitDataBarang = submitDataBarang;
  if (typeof submitDataInventaris !== 'undefined') window.submitDataInventaris = submitDataInventaris;
  if (typeof submitDataPembukuan !== 'undefined') window.submitDataPembukuan = submitDataPembukuan;
  if (typeof updateJadwalPreview !== 'undefined') window.updateJadwalPreview = updateJadwalPreview;
  if (typeof printJadwalPreview !== 'undefined') window.printJadwalPreview = printJadwalPreview;
  if (typeof saveJadwalImage !== 'undefined') window.saveJadwalImage = saveJadwalImage;
  if (typeof closeJadwalModal !== 'undefined') window.closeJadwalModal = closeJadwalModal;
  if (typeof printRekapAbsensiArea !== 'undefined') window.printRekapAbsensiArea = printRekapAbsensiArea;
  if (typeof printRekapGaji !== 'undefined') window.printRekapGaji = printRekapGaji;
  if (typeof saveRekapGajiToJpg !== 'undefined') window.saveRekapGajiToJpg = saveRekapGajiToJpg;
  if (typeof saveRekapGajiData !== 'undefined') window.saveRekapGajiData = saveRekapGajiData;
  if (typeof submitGajiPengajuan !== 'undefined') window.submitGajiPengajuan = submitGajiPengajuan;
  if (typeof loadRiwayatGajiPengajuan !== 'undefined') window.loadRiwayatGajiPengajuan = loadRiwayatGajiPengajuan;
  if (typeof approveGajiPengajuan !== 'undefined') window.approveGajiPengajuan = approveGajiPengajuan;
  if (typeof downloadAllSlipsAsZip !== 'undefined') window.downloadAllSlipsAsZip = downloadAllSlipsAsZip;
  if (typeof submitReservasi !== 'undefined') window.submitReservasi = submitReservasi;
  if (typeof loadReservasiData !== 'undefined') window.loadReservasiData = loadReservasiData;
  if (typeof changeCalendarMonth !== 'undefined') window.changeCalendarMonth = changeCalendarMonth;
  if (typeof renderReservasiCalendar !== 'undefined') window.renderReservasiCalendar = renderReservasiCalendar;
  if (typeof saveStokData !== 'undefined') window.saveStokData = saveStokData;
  if (typeof renderStokTable !== 'undefined') window.renderStokTable = renderStokTable;
  if (typeof updateStokValue !== 'undefined') window.updateStokValue = updateStokValue;
  if (typeof recalculateStokRow !== 'undefined') window.recalculateStokRow = recalculateStokRow;
  if (typeof manageStokItems !== 'undefined') window.manageStokItems = manageStokItems;
  if (typeof addStokItem !== 'undefined') window.addStokItem = addStokItem;
  if (typeof removeStokItem !== 'undefined') window.removeStokItem = removeStokItem;
  if (typeof triggerStokImport !== 'undefined') window.triggerStokImport = triggerStokImport;
  if (typeof exportStokItemsToExcel !== 'undefined') window.exportStokItemsToExcel = exportStokItemsToExcel;
  if (typeof processStokImport !== 'undefined') window.processStokImport = processStokImport;
  if (typeof exportStokBarangToExcel !== 'undefined') window.exportStokBarangToExcel = exportStokBarangToExcel;
  if (typeof exportStokBarangToPdf !== 'undefined') window.exportStokBarangToPdf = exportStokBarangToPdf;
  if (typeof filterRiwayatBarang !== 'undefined') window.filterRiwayatBarang = filterRiwayatBarang;
  if (typeof loadRiwayatBarang !== 'undefined') window.loadRiwayatBarang = loadRiwayatBarang;
  if (typeof deleteRiwayatBarang !== 'undefined') window.deleteRiwayatBarang = deleteRiwayatBarang;
  if (typeof toggleRiwayatBarangSelectAll !== 'undefined') window.toggleRiwayatBarangSelectAll = toggleRiwayatBarangSelectAll;
  if (typeof hapusRiwayatBarangYangDitandai !== 'undefined') window.hapusRiwayatBarangYangDitandai = hapusRiwayatBarangYangDitandai;
  if (typeof exportRiwayatBarangToExcel !== 'undefined') window.exportRiwayatBarangToExcel = exportRiwayatBarangToExcel;
  if (typeof exportRiwayatBarangToPdf !== 'undefined') window.exportRiwayatBarangToPdf = exportRiwayatBarangToPdf;
  if (typeof triggerImportPettyCashExcel !== 'undefined') window.triggerImportPettyCashExcel = triggerImportPettyCashExcel;
  if (typeof processImportPettyCashExcel !== 'undefined') window.processImportPettyCashExcel = processImportPettyCashExcel;
  if (typeof downloadTemplatePettyCashExcel !== 'undefined') window.downloadTemplatePettyCashExcel = downloadTemplatePettyCashExcel;
  if (typeof exportPettyCashToExcel !== 'undefined') window.exportPettyCashToExcel = exportPettyCashToExcel;
  if (typeof printPettyCashReport !== 'undefined') window.printPettyCashReport = printPettyCashReport;
  if (typeof triggerImportPembukuanExcel !== 'undefined') window.triggerImportPembukuanExcel = triggerImportPembukuanExcel;
  if (typeof processImportPembukuanExcel !== 'undefined') window.processImportPembukuanExcel = processImportPembukuanExcel;
  if (typeof downloadTemplatePembukuanExcel !== 'undefined') window.downloadTemplatePembukuanExcel = downloadTemplatePembukuanExcel;
  if (typeof exportRekapToExcel !== 'undefined') window.exportRekapToExcel = exportRekapToExcel;
  if (typeof printRekapReport !== 'undefined') window.printRekapReport = printRekapReport;
  if (typeof sendRekapEmail !== 'undefined') window.sendRekapEmail = sendRekapEmail;
  if (typeof loadLihatPengajuanData !== 'undefined') window.loadLihatPengajuanData = loadLihatPengajuanData;
  if (typeof exportPembukuanToExcel !== 'undefined') window.exportPembukuanToExcel = exportPembukuanToExcel;
  if (typeof printPembukuanReport !== 'undefined') window.printPembukuanReport = printPembukuanReport;
  if (typeof savePembukuanToJpg !== 'undefined') window.savePembukuanToJpg = savePembukuanToJpg;
  if (typeof printInventarisReport !== 'undefined') window.printInventarisReport = printInventarisReport;
  if (typeof exportInventarisToExcel !== 'undefined') window.exportInventarisToExcel = exportInventarisToExcel;
  if (typeof exportRekapAbsensiGpsToExcel !== 'undefined') window.exportRekapAbsensiGpsToExcel = exportRekapAbsensiGpsToExcel;
  if (typeof printRekapAbsensiGpsPdf !== 'undefined') window.printRekapAbsensiGpsPdf = printRekapAbsensiGpsPdf;
  if (typeof exportCompleteAbsensiExcel !== 'undefined') window.exportCompleteAbsensiExcel = exportCompleteAbsensiExcel;
  if (typeof exportCompleteAbsensiPDF !== 'undefined') window.exportCompleteAbsensiPDF = exportCompleteAbsensiPDF;
  if (typeof generateKodeSetupAbsensi !== 'undefined') window.generateKodeSetupAbsensi = generateKodeSetupAbsensi;
  if (typeof generateAndShowSlip !== 'undefined') window.generateAndShowSlip = generateAndShowSlip;
  if (typeof sendSlipEmail !== 'undefined') window.sendSlipEmail = sendSlipEmail;
  if (typeof saveBonusData !== 'undefined') window.saveBonusData = saveBonusData;
  if (typeof submitBonusAbsensiPengajuan !== 'undefined') window.submitBonusAbsensiPengajuan = submitBonusAbsensiPengajuan;
  if (typeof submitBonusOmsetPengajuan !== 'undefined') window.submitBonusOmsetPengajuan = submitBonusOmsetPengajuan;
  if (typeof exportBonusAbsensiExcel !== 'undefined') window.exportBonusAbsensiExcel = exportBonusAbsensiExcel;
  if (typeof exportBonusAbsensiPDF !== 'undefined') window.exportBonusAbsensiPDF = exportBonusAbsensiPDF;
  if (typeof printReservasiBill !== 'undefined') window.printReservasiBill = printReservasiBill;
  if (typeof deleteReservasi !== 'undefined') window.deleteReservasi = deleteReservasi;
  if (typeof formatRupiahInput !== 'undefined') window.formatRupiahInput = formatRupiahInput;
  if (typeof resizeInput !== 'undefined') window.resizeInput = resizeInput;
  if (typeof addBonusAbsensiRow !== 'undefined') window.addBonusAbsensiRow = addBonusAbsensiRow;
  if (typeof calculateBonusAbsensiTotal !== 'undefined') window.calculateBonusAbsensiTotal = calculateBonusAbsensiTotal;
  if (typeof calculateBonusOmset !== 'undefined') window.calculateBonusOmset = calculateBonusOmset;
  if (typeof calculateBonusOmsetFromPool !== 'undefined') window.calculateBonusOmsetFromPool = calculateBonusOmsetFromPool;
  if (typeof openRekeningPencairanModal !== 'undefined') window.openRekeningPencairanModal = openRekeningPencairanModal;
  if (typeof closeRekeningPencairanModal !== 'undefined') window.closeRekeningPencairanModal = closeRekeningPencairanModal;
  if (typeof processPengajuanWithRekening !== 'undefined') window.processPengajuanWithRekening = processPengajuanWithRekening;
  if (typeof updateGpsJadwalDisplay !== 'undefined') window.updateGpsJadwalDisplay = updateGpsJadwalDisplay;
  if (typeof processAbsensiGPS !== 'undefined') window.processAbsensiGPS = processAbsensiGPS;
  if (typeof loadMyGpsHistory !== 'undefined') window.loadMyGpsHistory = loadMyGpsHistory;
  if (typeof closeGpsHistoryModal !== 'undefined') window.closeGpsHistoryModal = closeGpsHistoryModal;
  if (typeof populateManualAbsenNameSelect !== 'undefined') window.populateManualAbsenNameSelect = populateManualAbsenNameSelect;
  if (typeof saveAbsensiGpsManual !== 'undefined') window.saveAbsensiGpsManual = saveAbsensiGpsManual;
  if (typeof deletePettyCashItem !== 'undefined') window.deletePettyCashItem = deletePettyCashItem;
  if (typeof deletePettyCashItemFirebase !== 'undefined') window.deletePettyCashItemFirebase = deletePettyCashItemFirebase;
  if (typeof toggleEditPcFields !== 'undefined') window.toggleEditPcFields = toggleEditPcFields;
  if (typeof openEditPettyCashModal !== 'undefined') window.openEditPettyCashModal = openEditPettyCashModal;
  if (typeof closeEditPettyCashModal !== 'undefined') window.closeEditPettyCashModal = closeEditPettyCashModal;
  if (typeof saveEditPettyCashModal !== 'undefined') window.saveEditPettyCashModal = saveEditPettyCashModal;
  if (typeof editPettyCashItem !== 'undefined') window.editPettyCashItem = editPettyCashItem;
  if (typeof editPettyCashItemFirebase !== 'undefined') window.editPettyCashItemFirebase = editPettyCashItemFirebase;
  if (typeof editPembukuanItem !== 'undefined') window.editPembukuanItem = editPembukuanItem;
  if (typeof deletePembukuanItem !== 'undefined') window.deletePembukuanItem = deletePembukuanItem;
  if (typeof openEditInventaris !== 'undefined') window.openEditInventaris = openEditInventaris;
  if (typeof closeEditInventaris !== 'undefined') window.closeEditInventaris = closeEditInventaris;
  if (typeof saveEditInventaris !== 'undefined') window.saveEditInventaris = saveEditInventaris;
  if (typeof deleteEditInventaris !== 'undefined') window.deleteEditInventaris = deleteEditInventaris;
  if (typeof getInventarisDaftarBarang !== 'undefined') window.getInventarisDaftarBarang = getInventarisDaftarBarang;
  if (typeof addInventarisDaftarBarang !== 'undefined') window.addInventarisDaftarBarang = addInventarisDaftarBarang;
  if (typeof removeInventarisDaftarBarang !== 'undefined') window.removeInventarisDaftarBarang = removeInventarisDaftarBarang;
  if (typeof renderInventarisDaftarBarang !== 'undefined') window.renderInventarisDaftarBarang = renderInventarisDaftarBarang;
  if (typeof openInventarisDaftarModal !== 'undefined') window.openInventarisDaftarModal = openInventarisDaftarModal;
  if (typeof closeInventarisDaftarModal !== 'undefined') window.closeInventarisDaftarModal = closeInventarisDaftarModal;
  if (typeof showDetailLupaModal !== 'undefined') window.showDetailLupaModal = showDetailLupaModal;
  if (typeof showImageModal !== 'undefined') window.showImageModal = showImageModal;
  if (typeof closeImageModal !== 'undefined') window.closeImageModal = closeImageModal;
  if (typeof showMemoPopup !== 'undefined') window.showMemoPopup = showMemoPopup;
  if (typeof closeMemoPopup !== 'undefined') window.closeMemoPopup = closeMemoPopup;
  if (typeof showRusakDetailModal !== 'undefined') window.showRusakDetailModal = showRusakDetailModal;
  if (typeof closeRusakDetailModal !== 'undefined') window.closeRusakDetailModal = closeRusakDetailModal;
  if (typeof showDetailTelatModal !== 'undefined') window.showDetailTelatModal = showDetailTelatModal;
  if (typeof closeGpsDetailModal !== 'undefined') window.closeGpsDetailModal = closeGpsDetailModal;
  if (typeof fetchAndShowGpsPhoto !== 'undefined') window.fetchAndShowGpsPhoto = fetchAndShowGpsPhoto;
  if (typeof calculatePettyCashRowTotal !== 'undefined') window.calculatePettyCashRowTotal = calculatePettyCashRowTotal;
  if (typeof triggerPcFoto !== 'undefined') window.triggerPcFoto = triggerPcFoto;
  if (typeof removePettyCashInputRow !== 'undefined') window.removePettyCashInputRow = removePettyCashInputRow;
  if (typeof addEmployeeRow !== 'undefined') window.addEmployeeRow = addEmployeeRow;
  if (typeof setCurrentLocationAsOffice !== 'undefined') window.setCurrentLocationAsOffice = setCurrentLocationAsOffice;
  if (typeof saveOfficeConfig !== 'undefined') window.saveOfficeConfig = saveOfficeConfig;
  if (typeof loadOfficeConfig !== 'undefined') window.loadOfficeConfig = loadOfficeConfig;
  if (typeof saveJamConfig !== 'undefined') window.saveJamConfig = saveJamConfig;
  if (typeof loadJamConfig !== 'undefined') window.loadJamConfig = loadJamConfig;
  if (typeof addGpsShiftRow !== 'undefined') window.addGpsShiftRow = addGpsShiftRow;
  if (typeof cycleAbsensiStatus !== 'undefined') window.cycleAbsensiStatus = cycleAbsensiStatus;
  if (typeof updateJadwalLegend !== 'undefined') window.updateJadwalLegend = updateJadwalLegend;
  if (typeof deleteSingleGpsLog !== 'undefined') window.deleteSingleGpsLog = deleteSingleGpsLog;
  if (typeof toggleEmptyRows !== 'undefined') window.toggleEmptyRows = toggleEmptyRows;
  if (typeof showCustomAlert !== 'undefined') window.showCustomAlert = showCustomAlert;
  if (typeof initAbsensiHardware !== 'undefined') window.initAbsensiHardware = initAbsensiHardware;
  if (typeof showCustomConfirm !== 'undefined') window.showCustomConfirm = showCustomConfirm;
  if (typeof populateGpsNames !== 'undefined') window.populateGpsNames = populateGpsNames;
  if (typeof getPettyCashRecapForPengajuan !== 'undefined') window.getPettyCashRecapForPengajuan = getPettyCashRecapForPengajuan;
  if (typeof createPengajuanForm !== 'undefined') window.createPengajuanForm = createPengajuanForm;
  if (typeof submitDataPengajuan !== 'undefined') window.submitDataPengajuan = submitDataPengajuan;
  if (typeof samakanTotal !== 'undefined') window.samakanTotal = samakanTotal;
  if (typeof isiOtomatisDataBank !== 'undefined') window.isiOtomatisDataBank = isiOtomatisDataBank;
  if (typeof applyKeteranganColor !== 'undefined') window.applyKeteranganColor = applyKeteranganColor;
})();

// [OPTIMASI] Jalankan Kamera & GPS segera setelah halaman siap (tanpa menunggu DB)
if (window.RBM_PAGE === 'absensi-gps-view') {
    function runGpsEarlyInit() {
        // [PERCEPATAN] Langsung singkirkan layar loading putih agar kamera yang sedang bersiap langsung terlihat
        if (typeof window.hideGlobalLoader === 'function') window.hideGlobalLoader();
        
        if (window.initAbsensiHardware) window.initAbsensiHardware();
        // [OPTIMASI 2] Langsung isi nama dari cache localStorage, jangan tunggu DB
        if (window.populateGpsNames) window.populateGpsNames();
        
        // [CANGGIH] Preload AI Face API di background secara senyap saat halaman baru dibuka
        setTimeout(function() {
            if (typeof window.loadFaceApiModelsForAbsensi === 'function') window.loadFaceApiModelsForAbsensi(true);
        }, 50); // Dipercepat dari 800ms menjadi 50ms agar segera di-download
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runGpsEarlyInit);
    } else {
        runGpsEarlyInit();
    }
}

function showCustomAlert(message, title, type) {
    let modal = document.getElementById('rbm-custom-alert');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'rbm-custom-alert';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:none; align-items:center; justify-content:center; z-index:10000;';
        modal.innerHTML = `
            <div style="background:white; padding:24px; border-radius:16px; max-width:85%; width:320px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <style>@keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>
                <div id="rbm-alert-icon" style="font-size:48px; margin-bottom:16px;"></div>
                <h3 id="rbm-alert-title" style="margin:0 0 8px; color:#1e293b; font-size: 18px; font-weight: 700;"></h3>
                <p id="rbm-alert-msg" style="margin:0 0 24px; color:#64748b; font-size:14px; line-height:1.5;"></p>
                <button type="button" onclick="document.getElementById('rbm-custom-alert').style.display='none'" style="background:#1e40af; color:white; border:none; padding:12px 0; border-radius:10px; font-weight:600; cursor:pointer; width:100%; font-size:14px; transition: background 0.2s;">Tutup</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const iconEl = document.getElementById('rbm-alert-icon');
    const titleEl = document.getElementById('rbm-alert-title');
    const msgEl = document.getElementById('rbm-alert-msg');
    
    titleEl.textContent = title || 'Info';
    msgEl.innerHTML = message.replace(/\n/g, '<br>');
    
    if (type === 'success') {
        iconEl.textContent = '✅';
        titleEl.style.color = '#15803d';
    } else if (type === 'error') {
        iconEl.textContent = '❌';
        titleEl.style.color = '#b91c1c';
    } else if (type === 'warning') {
        iconEl.textContent = '⚠️';
        titleEl.style.color = '#b45309';
    } else {
        iconEl.textContent = 'ℹ️';
        titleEl.style.color = '#1e293b';
    }
    
    modal.style.display = 'flex';
}

function showCustomConfirm(message, title, onYes) {
    let modal = document.getElementById('rbm-custom-confirm');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'rbm-custom-confirm';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:none; align-items:center; justify-content:center; z-index:10001;';
        modal.innerHTML = `
            <div style="background:white; padding:24px; border-radius:16px; max-width:85%; width:320px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <div style="font-size:48px; margin-bottom:16px;">❓</div>
                <h3 id="rbm-confirm-title" style="margin:0 0 8px; color:#1e293b; font-size: 18px; font-weight: 700;"></h3>
                <p id="rbm-confirm-msg" style="margin:0 0 24px; color:#64748b; font-size:14px; line-height:1.5;"></p>
                <div style="display:flex; gap:10px;">
                    <button type="button" id="rbm-confirm-no" style="flex:1; background:#e2e8f0; color:#475569; border:none; padding:12px 0; border-radius:10px; font-weight:600; cursor:pointer; font-size:14px;">Batal</button>
                    <button type="button" id="rbm-confirm-yes" style="flex:1; background:#1e40af; color:white; border:none; padding:12px 0; border-radius:10px; font-weight:600; cursor:pointer; font-size:14px;">Ya, Lanjut</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const titleEl = document.getElementById('rbm-confirm-title');
    const msgEl = document.getElementById('rbm-confirm-msg');
    const yesBtn = document.getElementById('rbm-confirm-yes');
    const noBtn = document.getElementById('rbm-confirm-no');
    
    titleEl.textContent = title || 'Konfirmasi';
    msgEl.innerHTML = message;
    
    // Clone buttons to remove old listeners
    const newYes = yesBtn.cloneNode(true);
    const newNo = noBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYes, yesBtn);
    noBtn.parentNode.replaceChild(newNo, noBtn);
    
    newYes.onclick = function() {
        document.getElementById('rbm-custom-confirm').style.display = 'none';
        if (onYes) onYes();
    };
    newNo.onclick = function() {
        document.getElementById('rbm-custom-confirm').style.display = 'none';
    };
    
    modal.style.display = 'flex';
}