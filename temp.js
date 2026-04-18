
  window.addEventListener('load', () => {
    function setPersistedValTemp(id, defaultVal) {
        const el = document.getElementById(id);
        if (!el) return;
        const saved = sessionStorage.getItem('rbm_saved_date_' + id);
        el.value = saved ? saved : defaultVal;
        if (!el._rbmPersistBound) {
            el.addEventListener('change', function() { sessionStorage.setItem('rbm_saved_date_' + id, this.value); });
            el._rbmPersistBound = true;
        }
    }

    const today = new Date().toISOString().split("T")[0];
    setPersistedValTemp("tanggal_barang", today);
    setPersistedValTemp("tanggal_keuangan", today);
    setPersistedValTemp("tanggal_inventaris", today);
    setPersistedValTemp("tanggal_pembukuan", today);
    setPersistedValTemp("pc_input_tanggal", today);
    
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    setPersistedValTemp("pc_tanggal_awal", firstDay);
    setPersistedValTemp("pc_tanggal_akhir", today);
    setPersistedValTemp("pengajuan_saldo_date", today);
    setPersistedValTemp("pengajuan_filter_date_start", today);
    setPersistedValTemp("pengajuan_filter_date_end", today);
    setPersistedValTemp("pembukuan_tanggal_awal", firstDay);
    setPersistedValTemp("pembukuan_tanggal_akhir", today);
    setPersistedValTemp("inv_tanggal_awal", firstDay);
    setPersistedValTemp("inv_tanggal_akhir", today);
    setPersistedValTemp("absensi_tgl_awal", firstDay);
    setPersistedValTemp("absensi_tgl_akhir", today);
    
    // [BARU] Set default bulan untuk filter agar tidak kosong
    setPersistedValTemp("pc_bulan_filter", today.substring(0, 7));
    setPersistedValTemp("pembukuan_bulan_filter", today.substring(0, 7));

    // [DIUBAH] Buka tab yang sesuai dengan halaman
    const initialView = window.RBM_PAGE || 'input-petty-cash-view';
    try { showView(initialView); } catch(e){}

    if (document.getElementById("detail-container-barang")) createBarangRows();
    if (document.getElementById("detail-container-keuangan")) createTransactionRows();
    if (document.getElementById("detail-container-inventaris")) createInventarisRows();
    if (document.getElementById("detail-container-pembukuan")) createPembukuanRows();
    if (document.getElementById("pengajuan-form-container")) createPengajuanForm();
    if (document.getElementById("detail-container-petty-cash")) createPettyCashInputRows();
    if (document.getElementById("pengajuan_saldo_date")) calculateSisaUangPengajuan();
  });

  function showView(viewId) {
    document.querySelectorAll('.view-container').forEach(view => view.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector('[onclick="showView(\'' + viewId + '\')"]');
    if (activeBtn) activeBtn.classList.add('active');
    if (viewId === 'absensi-view') {
        renderAbsensiTable();
    }
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

  // safe JSON parse utility: returns fallback when input is null/empty/invalid
  function safeParse(str, fallback) {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      console.warn('safeParse failed, returning fallback', e);
      return fallback;
    }
  }

  // --- SISTEM CACHING MEMORI ---
  window._rbmParsedCache = window._rbmParsedCache || {};
  function getCachedParsedStorage(key) {
    if (window._rbmParsedCache[key]) {
      return window._rbmParsedCache[key].data; // INSTAN: Ambil dari RAM, lewati proses baca Harddisk/LocalStorage
    }
    const raw = localStorage.getItem(key) || '[]';
    const data = safeParse(raw, []);
    window._rbmParsedCache[key] = { data: data }; // Kunci di memori
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
      const key = 'RBM_PENDING_' + type;
      const existing = safeParse(localStorage.getItem(key), []);
      const item = { ts: new Date().toISOString(), payload: sanitizeForStorage(payload) };
      existing.push(item);
      localStorage.setItem(key, JSON.stringify(existing));
      window._rbmParsedCache[key] = { data: existing }; // Auto-update RAM saat ada input baru
      return true;
    } catch (e) {
      console.warn('localStorage save error', e);
      return false;
    }
  }

  function formatRupiah(n) {
    return 'Rp ' + (n || 0).toLocaleString('id-ID');
  }

  function createPettyCashInputRows() {
    const container = document.getElementById("detail-container-petty-cash");
    if (!container) return;
    const jenis = document.getElementById("pc_input_jenis") ? document.getElementById("pc_input_jenis").value : "";
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

      const namaInput = `<div class="col-nama"><input type="text" class="pc_nama" placeholder="${isPengeluaran ? 'Nama Barang' : 'Keterangan'}"></div>`;
      const jumlahInput = `<div class="col-jumlah"><input type="number" class="pc_jumlah" placeholder="Qty" oninput="calculatePettyCashRowTotal(this)"></div>`;
      const hargaInput = `<div class="col-harga"><input type="number" class="pc_harga" placeholder="Harga Satuan" oninput="calculatePettyCashRowTotal(this)"></div>`;
      const totalInput = `<div class="col-total"><input type="text" class="pc_total" placeholder="Total Rp" readonly style="background: #f0f0f0; font-weight: bold;"></div>`;
      const satuanInput = `<div class="col-satuan"><input type="text" class="pc_satuan" placeholder="Satuan"></div>`;
      const nominalPemasukanInput = `<div class="col-jumlah" style="flex: 1.5;"><input type="number" class="pc_nominal_pemasukan" placeholder="Nominal (Rp)"></div>`;

      if (isPengeluaran) {
        row.innerHTML = namaInput + jumlahInput + satuanInput + hargaInput + totalInput;
      } else {
        row.innerHTML = namaInput + nominalPemasukanInput;
      }

      container.appendChild(row);
    }
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

  function loadPettyCashData() {
    const tbody = document.getElementById("pc_tbody");
    const summaryEl = document.getElementById("pc_summary");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" class="table-loading">Memuat data...</td></tr>';
    if (summaryEl) summaryEl.style.display = 'none';

    let tglAwal = "", tglAkhir = "";
    const bulanFilter = document.getElementById("pc_bulan_filter");
    if (bulanFilter && bulanFilter.value) {
        const [year, month] = bulanFilter.value.split('-');
        tglAwal = `${year}-${month}-01`;
        const lastDay = new Date(year, parseInt(month, 10), 0).getDate();
        tglAkhir = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    } else {
        tglAwal = document.getElementById("pc_tanggal_awal") ? document.getElementById("pc_tanggal_awal").value : "";
        tglAkhir = document.getElementById("pc_tanggal_akhir") ? document.getElementById("pc_tanggal_akhir").value : "";
    }

    if (!tglAwal || !tglAkhir) {
        tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Pilih rentang tanggal/bulan terlebih dahulu.</td></tr>';
        return;
    }

    if (!isGoogleScript()) {
      setTimeout(() => {
        const pending = getCachedParsedStorage('RBM_PENDING_PETTY_CASH');
        if (pending.length === 0) {
          tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Tidak ada data. Buka dari Google Apps Script untuk data dari sheet, atau input data dulu.</td></tr>';
          return;
        }
        let no = 0;
        let totalDebit = 0, totalKredit = 0;
        let runningSaldo = 0;
        const rows = [];
        pending.forEach(function(item, parentIdx) {
          const p = item.payload || {};
          (p.transactions || []).forEach(function(trx, trxIdx) {
            no++;
            const debit = (p.jenis === 'pengeluaran' && trx.total) ? trx.total : 0;
            const kredit = (p.jenis === 'pemasukan' && trx.total) ? trx.total : 0;
            totalDebit += debit;
            totalKredit += kredit;
            runningSaldo = runningSaldo - debit + kredit;
            
            rows.push({ no, tanggal: p.tanggal || '-', nama: trx.nama || '', jumlah: trx.jumlah, satuan: trx.satuan || '', harga: trx.harga || '', debit, kredit, saldo: runningSaldo, parentIdx, trxIdx });
          });
        });
        if (rows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Tidak ada data untuk rentang ini.</td></tr>';
          return;
        }
        tbody.innerHTML = rows.map(row => `
          <tr>
            <td>${row.no}</td>
            <td>${row.tanggal}</td>
            <td>${row.nama}</td>
            <td class="num">${row.jumlah || ''}</td>
            <td>${row.satuan}</td>
            <td class="num">${row.harga ? formatRupiah(row.harga) : ''}</td>
            <td class="num">${row.debit ? formatRupiah(row.debit) : ''}</td>
            <td class="num">${row.kredit ? formatRupiah(row.kredit) : ''}</td>
            <td class="num">${formatRupiah(row.saldo)}</td>
            <td><button class="btn-small-danger" onclick="deletePettyCashItem(${row.parentIdx}, ${row.trxIdx})">Hapus</button></td>
          </tr>
        `).join('');
        summaryEl.style.display = 'grid';
        document.getElementById("pc_total_debit").textContent = formatRupiah(totalDebit);
        document.getElementById("pc_total_kredit").textContent = formatRupiah(totalKredit);
        document.getElementById("pc_saldo_akhir").textContent = formatRupiah(runningSaldo);
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
        document.getElementById("pc_total_kredit").textContent = formatRupiah(summary.totalKredit);
        document.getElementById("pc_saldo_akhir").textContent = formatRupiah(summary.saldoAkhir);
      })
      .withFailureHandler(function(err) {
        tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Gagal memuat: ' + err.message + '</td></tr>';
      })
      .getDataPettyCash(tglAwal, tglAkhir);
  }

  const defaultSisaItems = ["S. Vietnam", "S. Teriyaki", "S. Madu", "S. Asam Manis", "S. Ladah Hitam", "Daging Rice Bowl", "Ayam Rice Bowl", "Ayam Filet", "Toping Ayam", "Toping Jamur", "K. Merah", "K. Hijau", "Timun", "Tomat", "Pokcoy", "Bombay", "Daun Bawang", "Semangka", "Melon", "Buah Naga", "Nutrijel Gelap", "Nutrijel Terang", "Gula Es Campur", "S. Jawa", "Beras"];
  const defaultInventarisItems = ["Name Tag", "Baju", "Topi", "Apron", "Sumpit Kecil", "Sumpit Besar", "Sompet Besi", "Tray Waiter", "Tray Kasir", "tray Kecil", "Astray", "Sendok", "Garbu", "Tempat Es CMPR", "Sendok Es CMPR K", "Sendok Es CMPR B", "Mangkok 1p", "Mangkok 2p", "Mangkok 4p", "Mangkok 8p", "Mangkok 10p", "Mangkok 30p", "Mangkok Mie Kuah", "Mangkok Rice Bowl", "Mangkok Kuah", "Meja", "Kursi Hitam", "Kursi Kayu", "Tempat Sambel Kotak Hitam", "Tempat Sambel", "Tempat Sambel Besar", "Tempat Sambel Kotak", "Tempat Saos", "Tempat Tusuk Gigi", "Nomer Meja", "Tempat Menu", "Gelas Panas", "Gelas Dingin", "Saringan Mie", "Serok Pengorengan", "Stainless Bulat Cuci Beras", "Capitan Setelsis", "Piring Gorengan Kecil", "Piring gorengan Besar", "Tutup Stainless Kecil 22", "Tutup Stainless Besar", "Tempat Sambal Stainless", "Waterjack Kecil", "Waterjack Besar", "Loyang Stainless", "Tutup Stainless Sedang", "Food Pan Stenlist GN 1/9", "Food Pan Stenlist GN 1/3", "Food Pan Stenlist GN 1/3 (200)", "Panci", "Wajan Kecil", "Wajan Besar", "Teflon", "Solet Telur", "Sutil Plastik", "Cetakan Telur", "Kompor Getra (Mie)", "Kompor Miyako", "Kompor Tungku", "Kompor Dudukan", "Kompor Jos", "Pengorengan", "Kompor Rumah Tangga", "Kompor Tungku", "Kompor Dudukan", "Tempat Pemanas Air", "Fliser", "Chiler", "Pendingin Air", "Penghangat Air", "Rice Cooker", "Magic Jar", "Kompor Hook", "Fryerr", "Rak Piring Kecil", "Rak Piring Besar", "Rak Barang", "Freezer kecil", "Freezer BESAR", "Kipas Angin Kecil", "Kipas Angin Besar", "Kulkas", "Blender", "Meja Dapur", "Washtaffle", "Botol Kecap Asin", "Rak Bumbu", "Botol Telur/SKM", "Skup Tepung", "Keranjang Freezer", "Sutil Stainless", "Dispenser Tisu", "Galon", "Talenan", "Timbangan", "Pisau Kecil", "Pisau Sedang", "Pisau Besar", "Pisau Roti", "Apar Pemadam", "Corong", "Tempat Sampah Kecil", "Tempat Sampah Besar", "Troli", "Payung", "Tempat Payung", "Mosquito Killer Kriskow", "Kulkas Kecil", "Electric Ice Shaver", "Gea", "Cup Sealer", "Mesin Gula", "Tempat Es Batu Kristal", "Rak Bar + Krupuk", "Tempat Cup 12 oz", "Ciller Kondimen Es Campur", "Tempat Biru Sendok Garbu", "Rak Kecil Stainlees", "Standing Menu Besar", "Standing Menu Kecil", "Print Checker", "Astray Sampah", "Mesin EDC Mandiri", "Mesin EDC BCA", "Kalkulator", "Pembatas Kasir", "Mesin Absen", "Karpet Playground", "Kuda", "Prosotan", "Standing Bunga", "Baby Chair", "Semprotan", "Karpet Karet Hutam", "Speaker", "Mixer", "Mix", "Akrilik Open/Close", "Keset", "Rak Meja Waiter", "Sikat Besar", "Sikat Kecil", "Sikat WC", "Spons Kuning Hija", "Skep Kecil", "Skep Besar", "Loby Duster", "Watering Pot", "Pel 1 Set", "Dispenser Tisu Kecil", "Dispenser Stella Matic Refill", "Pengharum Ruangan", "Burung Hantu", "Bak", "Gayung", "Botol Sabun Cuci Tangan", "Pager Gantung", "Daun Gantung", "Daun Gantung Bulat", "Mini Pot Kamar Mandi", "Pigora Kecil", "Pigora sedang", "pigora besar", "Gantungan baju", "Lap Kecil", "Blower", "Jam dinding", "Cikrak", "Sapu", "Pel Bar", "Remote AC", "Pigora Menu", "Papan kecil", "Papan Sedang", "CCTV", "Remote TB", "Tusuk Print Checker", "Bel", "NeonBox", "Standing Warming", "Bax Biru", "Cas Type C", "Hp Resto", "Mouse", "Stapless", "Layar Proyektor", "Di spenser solasi", "Gunting kecil", "Gunting sedang", "PC"];

  function createBarangRows(){
    const container=document.getElementById("detail-container-barang");
    if (!container) return;
    container.innerHTML="";
    const jenis=document.getElementById("jenis_barang") ? document.getElementById("jenis_barang").value : "";
    
    // --- Datalist logic start ---
    const oldDatalist1 = document.getElementById("nama-items");
    if(oldDatalist1) oldDatalist1.remove();
    const oldDatalist2 = document.getElementById("barang-items-datalist");
    if(oldDatalist2) oldDatalist2.remove();

    // Create datalist from Stok Barang
    const allStokItems = safeParse(localStorage.getItem('RBM_STOK_ITEMS'), { sales: [], fruits: [], notsales: [] });
    const combinedItems = [ ...allStokItems.sales, ...allStokItems.fruits, ...allStokItems.notsales ];
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
        namaInput.className="nama_barang";
        namaInput.placeholder="Nama Barang";
        if(jenis && uniqueNames.length > 0){ 
            namaInput.setAttribute("list","barang-items-datalist");
        }
        namaDiv.appendChild(namaInput);
        
        const jumlahDiv=document.createElement("div");
        jumlahDiv.style.flex="1.2";
        const jumlahInput=document.createElement("input");
        jumlahInput.type="number";
        jumlahInput.className="jumlah_barang";
        jumlahInput.placeholder="Jumlah";
        jumlahDiv.appendChild(jumlahInput);
        
        const barangJadiDiv=document.createElement("div");
        barangJadiDiv.style.flex="1.2";
        barangJadiDiv.style.display=jenis==="barang keluar"?"block":"none";
        const barangJadiInput=document.createElement("input");
        barangJadiInput.type="text";
        barangJadiInput.className="barangjadi_barang";
        barangJadiInput.placeholder="Barang Jadi";
        barangJadiDiv.appendChild(barangJadiInput);

        const keteranganRusakDiv = document.createElement("div");
        keteranganRusakDiv.style.flex = "2";
        keteranganRusakDiv.style.display = jenis === "rusak" ? "block" : "none";
        const keteranganRusakInput = document.createElement("textarea");
        keteranganRusakInput.className = "keterangan_rusak";
        keteranganRusakInput.placeholder = "Keterangan mengapa rusak...";
        keteranganRusakInput.rows = 1;
        keteranganRusakDiv.appendChild(keteranganRusakInput);

        const fotoRusakDiv = document.createElement("div");
        fotoRusakDiv.style.flex = "1.5";
        fotoRusakDiv.style.display = jenis === "rusak" ? "block" : "none";
        const fotoRusakInput = document.createElement("input");
        fotoRusakInput.type = "file";
        fotoRusakInput.className = "foto_barang_rusak";
        fotoRusakInput.accept = "image/*";
        fotoRusakDiv.appendChild(fotoRusakInput);

        row.appendChild(namaDiv);
        row.appendChild(jumlahDiv);
        row.appendChild(barangJadiDiv);
        row.appendChild(keteranganRusakDiv);
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
            const itemData = {tanggal,jenis,nama,jumlah,barangjadi, keteranganRusak: null, fotoRusak: null};
            
            if (jenis === 'rusak') {
                itemData.keteranganRusak = row.querySelector(".keterangan_rusak")?.value.trim() || "";
                const fotoInput = row.querySelector(".foto_barang_rusak");
                if (fotoInput && fotoInput.files[0]) {
                    const file = fotoInput.files[0];
                    const promise = new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => {
                            const fileData = e.target.result.split(",");
                            itemData.fotoRusak = { fileName: file.name, mimeType: file.type, data: fileData[1] };
                            resolve();
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    filePromises.push(promise);
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
  if (!container) return;
  const jenis = document.getElementById("jenis_transaksi") ? document.getElementById("jenis_transaksi").value : "";
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

    const namaInput = `<div class="col-nama"><input type="text" class="nama_keuangan" placeholder="${isPengeluaran ? 'Nama Barang' : 'Keterangan'}"></div>`;
    const jumlahInput = `<div class="col-jumlah"><input type="number" class="jumlah_keuangan" placeholder="Qty" oninput="calculateRowTotal(this)"></div>`;
    const hargaInput = `<div class="col-harga"><input type="number" class="harga_keuangan" placeholder="Harga Satuan" oninput="calculateRowTotal(this)"></div>`;
    const totalInput = `<div class="col-total"><input type="text" class="total_keuangan" placeholder="Total Rp" readonly style="background: #f0f0f0; font-weight: bold;"></div>`;
    const satuanInput = `<div class="col-satuan"><input type="text" class="satuan_keuangan" placeholder="Satuan"></div>`;
    const fotoInput = `<div class="col-foto"><input type="file" class="foto_keuangan" accept="image/*"></div>`;

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
        const promise = new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const fileData = e.target.result.split(",");
            transaction.foto = { fileName: file.name, mimeType: file.type, data: fileData[1] };
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        filePromises.push(promise);
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

function createInventarisRows() {
  const container = document.getElementById("detail-container-inventaris");
  if (!container) return;
  container.innerHTML = "";

  // Menggunakan daftar barang default agar user tinggal isi jumlah
  defaultInventarisItems.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "row-group";
    row.innerHTML = `
      <div style="flex:2.5;"><input type="text" class="nama_inventaris" value="${item}" readonly style="background: #f1f5f9; color: #334155;"></div>
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
    if (!container) return;
    const jenis = document.getElementById("jenis_transaksi_pembukuan") ? document.getElementById("jenis_transaksi_pembukuan").value : "";

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
            if (!isGoogleScript()) {
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
                      const promise=new Promise((resolve,reject)=>{
                          const reader=new FileReader;
                          reader.onload=e=>{
                              const fileData=e.target.result.split(",");
                              itemKeluar.foto={fileName:file.name,mimeType:file.type,data:fileData[1]};
                              resolve();
                          };
                          reader.onerror=reject;
                          reader.readAsDataURL(file);
                      });
                      filePromises.push(promise);
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
              if (!isGoogleScript()) {
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
      setTimeout(()=>{output.innerText=""},4e3);
  }

function createPengajuanForm() {
  const container = document.getElementById("pengajuan-form-container");
  if (!container) return;
  const jenisPengajuan = document.getElementById("jenis_pengajuan") ? document.getElementById("jenis_pengajuan").value : "";
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
    container.innerHTML += `<h3>Detail Pengajuan Petty Cash</h3>`;
    for (let i = 0; i < 5; i++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'row-group';
        rowDiv.style.alignItems = 'flex-start';
        rowDiv.innerHTML = `
            <div style="flex:1;"><label>Nominal</label><input type="number" class="pengajuan_pc_nominal" placeholder="Nominal (Rp)"></div>
            <div style="flex:1.5;"><label>Foto Pengajuan</label><input type="file" class="pengajuan_pc_foto_pengajuan" accept="image/*"></div>
        `;
        container.appendChild(rowDiv);
    }
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
  button.disabled = true;
  button.innerText = "Menyimpan... ⏳";
  const output = document.getElementById("outputPengajuan");
  output.innerText = "";

  const jenisPengajuan = document.getElementById("jenis_pengajuan").value;
  const tanggalPengajuanGlobal = document.getElementById("tanggal_pengajuan").value;

  if (!jenisPengajuan || !tanggalPengajuanGlobal) {
    output.innerText = "⚠️ Pilih Jenis Pengajuan dan Tanggal Pengajuan terlebih dahulu.";
    resetButton();
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
          filePromises.push(readFileAsBase64(fotoNotaInput.files[0]).then(result => {
            pengajuanItem.fotoNota = result;
          }));
        }
        const fotoTtdInput = row.querySelector(".pengajuan_tf_foto_ttd");
        if (fotoTtdInput?.files[0]) {
          filePromises.push(readFileAsBase64(fotoTtdInput.files[0]).then(result => {
            pengajuanItem.fotoTtd = result;
          }));
        }
      }
    });

    if (dataList.length === 0) {
      output.innerText = "⚠️ Masukkan minimal 1 data (Suplier dan Nominal/Total wajib diisi).";
      resetButton();
      return;
    }

    Promise.all(filePromises).then(() => {
      const payload = { jenis: jenisPengajuan, details: dataList };
      if (!isGoogleScript()) {
        savePendingToLocalStorage('PENGAJUAN_TF', payload);
        showResultPengajuan('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
      } else {
        google.script.run.withSuccessHandler(showResultPengajuan).simpanDataPengajuanTF(payload);
      }
    }).catch(error => {
      output.innerText = "❌ Gagal memproses file: " + error;
      resetButton();
    });

  } else if (jenisPengajuan === 'pengajuan-petty-cash') {
    rows.forEach(row => {
      const nominalPc = row.querySelector(".pengajuan_pc_nominal").value.trim();

      if (nominalPc) {
        const pettyCashItem = {
          tanggalPengajuan: tanggalPengajuanGlobal,
          nominal: nominalPc,
          fotoPengajuan: null
        };
        dataList.push(pettyCashItem);

        const fotoPengajuanInput = row.querySelector(".pengajuan_pc_foto_pengajuan");
        if (fotoPengajuanInput?.files[0]) {
          filePromises.push(readFileAsBase64(fotoPengajuanInput.files[0]).then(result => {
            pettyCashItem.fotoPengajuan = result;
          }));
        }
      }
    });

    if (dataList.length === 0) {
      output.innerText = "⚠️ Masukkan minimal 1 data (Nominal wajib diisi).";
      resetButton();
      return;
    }

    Promise.all(filePromises).then(() => {
      const payload = { jenis: jenisPengajuan, details: dataList };
      if (!isGoogleScript()) {
        savePendingToLocalStorage('PENGAJUAN_PC', payload);
        showResultPengajuan('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
      } else {
        google.script.run.withSuccessHandler(showResultPengajuan).simpanDataPengajuanPC(payload);
      }
    }).catch(error => {
      output.innerText = "❌ Gagal memproses file: " + error;
      resetButton();
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

        filePromises.push(readFileAsBase64(fotoBuktiInput.files[0]).then(result => {
          sudahTfItem.fotoBukti = result;
        }));
      }
    });

    if (dataList.length === 0) {
      output.innerText = "⚠️ Masukkan minimal 1 file bukti transfer.";
      resetButton();
      return;
    }
    Promise.all(filePromises).then(() => {
        const payload = { jenis: jenisPengajuan, details: dataList };
        if (!isGoogleScript()) {
          savePendingToLocalStorage('PENGAJUAN_SUDAH_TF', payload);
          showResultPengajuan('✅ Data disimpan sementara di perangkat. Buka dari Google Apps Script untuk sinkron ke sheet.');
        } else {
          google.script.run.withSuccessHandler(showResultPengajuan).simpanDataSudahTF(payload);
        }
    }).catch(error => {
        output.innerText = "❌ Gagal memproses file: " + error;
        resetButton();
    });

  } else {
    output.innerText = `⚠️ Fitur untuk "${jenisPengajuan}" belum diimplementasikan.`;
    resetButton();
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const [header, data] = e.target.result.split(",");
      resolve({ fileName: file.name, mimeType: file.type, data });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resetButton() {
  const button = document.getElementById("submitButtonPengajuan");
  button.disabled = false;
  button.innerText = "Simpan Data Pengajuan";
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
  const output = document.getElementById("outputPengajuan");
  output.innerText = res;
  resetButton();
  document.getElementById("jenis_pengajuan").value = "";
  createPengajuanForm();
  setTimeout(() => { output.innerText = "" }, 4000);
}

function exportPettyCashToExcel() {
  const table = document.getElementById("pc_table");
  if (!table) return;

  const tglAwal = document.getElementById("pc_tanggal_awal").value;
  const tglAkhir = document.getElementById("pc_tanggal_akhir").value;
  const debit = document.getElementById("pc_total_debit").textContent;
  const kredit = document.getElementById("pc_total_kredit").textContent;
  const saldo = document.getElementById("pc_saldo_akhir").textContent;
  const filename = `Laporan_Petty_Cash_${tglAwal}_sd_${tglAkhir}.xls`;

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

function printPettyCashReport() {
  const table = document.getElementById("pc_table");
  if (!table) return;

  const tglAwal = document.getElementById("pc_tanggal_awal").value;
  const tglAkhir = document.getElementById("pc_tanggal_akhir").value;
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
  if(!confirm("Yakin ingin menghapus data ini?")) return;
  const key = 'RBM_PENDING_PETTY_CASH';
  let pending = getCachedParsedStorage(key);
  
  if (pending[parentIdx] && pending[parentIdx].payload && pending[parentIdx].payload.transactions) {
    pending[parentIdx].payload.transactions.splice(trxIdx, 1);
    // Jika transaksi dalam satu tanggal habis, hapus parent-nya
    if (pending[parentIdx].payload.transactions.length === 0) {
      pending.splice(parentIdx, 1);
    }
    localStorage.setItem(key, JSON.stringify(pending));
      window._rbmParsedCache[key] = { data: pending }; // Auto-update RAM saat data dihapus
    loadPettyCashData(); // Refresh tabel
  }
}

function showImageModal(src) {
  document.getElementById('modalImage').src = src;
  document.getElementById('imageModal').style.display = 'flex';
}

function closeImageModal() {
  document.getElementById('imageModal').style.display = 'none';
}

function calculateSisaUangPengajuan() {
    const dateVal = document.getElementById("pengajuan_saldo_date").value;
    if (!dateVal) return;
    
    // [DIUBAH] Beri nafas ke browser agar render HTML (tombol & input) beres dulu sebelum memproses data berat
    setTimeout(() => {
        const pending = getCachedParsedStorage('RBM_PENDING_PETTY_CASH');
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
        
        const el = document.getElementById("pengajuan_sisa_uang_val");
        if (el) el.textContent = formatRupiah(saldo);
    }, 100);
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
    
    setTimeout(() => {
        let rows = [];
        let runningSaldo = 0;
        let no = 0;

        // Ambil data dari Petty Cash (RBM_PENDING_PETTY_CASH)
        const pcData = getCachedParsedStorage('RBM_PENDING_PETTY_CASH');
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
        
        tbody.innerHTML = rows.map(r => `
            <tr>
                <td>${r.no}</td>
                <td>${r.tanggal}</td>
                <td>${r.nama}</td>
                <td class="num">${r.jumlah}</td>
                <td>${r.satuan}</td>
                <td class="num">${r.harga ? formatRupiah(r.harga) : ''}</td>
                <td class="num">${r.debit ? formatRupiah(r.debit) : ''}</td>
                <td class="num">${r.kredit ? formatRupiah(r.kredit) : ''}</td>
                <td class="num">${formatRupiah(r.saldo)}</td>
            </tr>
        `).join('');
    }, 50);
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
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Memuat data...</td></tr>';
    if (summaryEl) summaryEl.style.display = 'none';

    let tglAwal = "", tglAkhir = "";
    const bulanFilter = document.getElementById("pembukuan_bulan_filter");
    if (bulanFilter && bulanFilter.value) {
        const [year, month] = bulanFilter.value.split('-');
        tglAwal = `${year}-${month}-01`;
        const lastDay = new Date(year, parseInt(month, 10), 0).getDate();
        tglAkhir = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    } else {
        tglAwal = document.getElementById("pembukuan_tanggal_awal") ? document.getElementById("pembukuan_tanggal_awal").value : "";
        tglAkhir = document.getElementById("pembukuan_tanggal_akhir") ? document.getElementById("pembukuan_tanggal_akhir").value : "";
    }

    if (!tglAwal || !tglAkhir) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Pilih rentang tanggal/bulan terlebih dahulu.</td></tr>';
        return;
    }

    setTimeout(() => {
        const pending = getCachedParsedStorage('RBM_PENDING_PEMBUKUAN');

        let totalCashMasuk = 0;
        let totalKasKeluar = 0;
        let totalSemuaMasuk = 0;
        let totalFisikSheet = 0;
        let totalCatatan = 0;
        let totalSelisih = 0;
        let rows = [];

        pending.forEach((item, parentIdx) => {
            const p = item.payload;
            if (p.tanggal >= tglAwal && p.tanggal <= tglAkhir) {
                // Kas Masuk
                if (p.kasMasuk && p.kasMasuk.length > 0) {
                    p.kasMasuk.forEach((km, subIdx) => {
                        let fisikVal = parseFloat(km.fisik) || 0;
                        let catatanVal = parseFloat(km.catatan) || 0;
                        let fisikDisplay = formatRupiah(fisikVal);
                        let selisihVal = 0;

                        // Logika VCR
                        if(km.keterangan && km.keterangan.toUpperCase() === 'VCR') {
                            const jmlVcr = parseFloat(km.vcr) || 0;
                            fisikVal = jmlVcr * 20000;
                            fisikDisplay = `${km.vcr} (VCR)`;
                        } else {
                            selisihVal = fisikVal - catatanVal;
                        }

                        if (km.keterangan && km.keterangan.toUpperCase() === 'CASH') totalCashMasuk += fisikVal;
                    totalSemuaMasuk += catatanVal;
                        totalCatatan += catatanVal;
                        totalSelisih += selisihVal;

                        // store numeric values for later grouping
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
                            // numeric values for subtotal calculations
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
                             fotoDisplay = `<button type="button" class="btn-secondary" style="padding:2px 6px; font-size:11px; cursor:pointer;" onclick="showImageModal('${kk.foto}')">🖼️ Lihat Foto</button>`;
                        } else if (kk.foto && kk.foto.data && kk.foto.mimeType) {
                             window._pbImages = window._pbImages || {};
                             let imgKey = parentIdx + '_' + subIdx;
                             window._pbImages[imgKey] = `data:${kk.foto.mimeType};base64,${kk.foto.data}`;
                             fotoDisplay = `<button type="button" class="btn-secondary" style="padding:2px 6px; font-size:11px; cursor:pointer;" onclick="showImageModal(window._pbImages['${imgKey}'])">🖼️ Lihat Foto</button>`;
                        }
                        rows.push({
                            tanggal: p.tanggal,
                            keterangan: kk.keterangan,
                            catatan: '-',
                            fisik: formatRupiah(kk.setor),
                            selisih: '-',
                            komentarFisik: '',
                            komentarSelisih: '',
                            // numeric values for subtotal calculations
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
            }
        });

        totalFisikSheet = totalCashMasuk - totalKasKeluar;

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Tidak ada data untuk rentang ini.</td></tr>';
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

        // build HTML using grouped data
        let html = '';
        Object.keys(grouped).sort().forEach(date => {
            const group = grouped[date];
            
            // 1. Render Kas Masuk
            group.masuk.forEach((r, i) => {
                html += '<tr>';
                if (i === 0) {
                    html += `<td rowspan="${group.masuk.length}" style="vertical-align: middle; text-align: center; background-color: #f1f5f9; font-weight: 500;">${date}</td>`;
                }
                // build memo icon that shows popup with comment
                let fisikCell = r.fisik;
                if (r.komentarFisik) {
                    // popup shows date + label on first line and memo text below
                    const displayDate = date.split('-').reverse().join('/');
                    const info = `${displayDate} - Fisik<br>${r.komentarFisik}`;
                    fisikCell += ` <span class="memo-icon" onclick="showMemoPopup('${info.replace(/'/g,"\\'")}')">📝</span>`;
                }
                let selisihCell = r.selisih;
                if (r.komentarSelisih) {
                    const displayDate = date.split('-').reverse().join('/');
                    const info = `${displayDate} - Selisih<br>${r.komentarSelisih}`;
                    selisihCell += ` <span class="memo-icon" onclick="showMemoPopup('${info.replace(/'/g,"\\'")}')">📝</span>`;
                }
                html += `
                    <td>${r.keterangan}</td>
                    <td class="num">${r.catatan}</td>
                    <td class="num">${fisikCell}</td>
                    <td class="num">${selisihCell}</td>
                    <td>${r.foto}</td>
                    <td>
                        <button class="btn-small-danger" style="background: #ffc107; color: #000;" onclick="editPembukuanItem(${r.parentIdx}, '${r.type}', ${r.subIdx})">Edit</button>
                        <button class="btn-small-danger" onclick="deletePembukuanItem(${r.parentIdx}, '${r.type}', ${r.subIdx})">Hapus</button>
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
                        <button type="button" class="btn-small-danger" style="background: #ffc107; color: #000;" onclick="editPembukuanItem(${r.parentIdx}, '${r.type}', ${r.subIdx})">Edit</button>
                        <button type="button" class="btn-small-danger" onclick="deletePembukuanItem(${r.parentIdx}, '${r.type}', ${r.subIdx})">Hapus</button>
                    </td>
                `;
                html += '</tr>';
            });
        });

        // do not include a global total row; only per-date subtotals are needed
        tbody.innerHTML = html;
        document.getElementById("pembukuan_total_cash").textContent = formatRupiah(totalCashMasuk);
        document.getElementById("pembukuan_total_keluar").textContent = formatRupiah(totalKasKeluar);
        document.getElementById("pembukuan_total_fisik").textContent = formatRupiah(totalFisikSheet);
        if (document.getElementById("pembukuan_total_pendapatan")) document.getElementById("pembukuan_total_pendapatan").textContent = formatRupiah(totalSemuaMasuk);
        summaryEl.style.display = 'grid';
    }, 50);
}

function toggleMemo(icon) {
    // not used any more
}

function showMemoPopup(text) {
    if (!text) return;
    const overlay = document.getElementById('memoModalOverlay');
    const content = document.getElementById('memoModalContent');
    // split first line as header and rest as body
    const parts = text.split('<br>');
    let html = '';
    if (parts.length > 0) {
        html += `<div class="memo-modal-header">${parts[0]}</div>`;
        if (parts.length > 1) html += parts.slice(1).join('<br>');
    }
    content.innerHTML = html;
    overlay.style.display = 'flex';
}

function closeMemoPopup() {
    const overlay = document.getElementById('memoModalOverlay');
    overlay.style.display = 'none';
}

function deletePembukuanItem(parentIdx, type, subIdx) {
    if(!confirm("Yakin ingin menghapus data ini?")) return;
    const key = 'RBM_PENDING_PEMBUKUAN';
    let pending = getCachedParsedStorage(key);
    
    if (pending[parentIdx] && pending[parentIdx].payload) {
        const payload = pending[parentIdx].payload;
        
        if (type === 'kasMasuk' && payload.kasMasuk) {
            payload.kasMasuk.splice(subIdx, 1);
        } else if (type === 'kasKeluar' && payload.kasKeluar) {
            payload.kasKeluar.splice(subIdx, 1);
        }
        
        // Jika kedua array kosong, hapus parent
        if ((!payload.kasMasuk || payload.kasMasuk.length === 0) && 
            (!payload.kasKeluar || payload.kasKeluar.length === 0)) {
            pending.splice(parentIdx, 1);
        }
        
        localStorage.setItem(key, JSON.stringify(pending));
        window._rbmParsedCache[key] = { data: pending }; // Auto-update RAM saat data dihapus
        loadPembukuanData();
    }
}

function editPembukuanItem(parentIdx, type, subIdx) {
    if(!confirm("Edit data ini? Data akan dipindahkan ke form input dan dihapus dari daftar ini.")) return;
    
    const key = 'RBM_PENDING_PEMBUKUAN';
    let pending = getCachedParsedStorage(key);
    const item = pending[parentIdx];
    
    if (!item || !item.payload) return;
    
    const p = item.payload;
    let dataToEdit = null;
    
    if (type === 'kasMasuk' && p.kasMasuk && p.kasMasuk[subIdx]) {
        dataToEdit = p.kasMasuk[subIdx];
    } else if (type === 'kasKeluar' && p.kasKeluar && p.kasKeluar[subIdx]) {
        dataToEdit = p.kasKeluar[subIdx];
    }
    
    if (!dataToEdit) return;

    // Pindah ke view input
    showView('pembukuan-keuangan-view');
    
    // Set tanggal
    document.getElementById("tanggal_pembukuan").value = p.tanggal;
    
    // Set jenis dan generate rows
    const jenisSelect = document.getElementById("jenis_transaksi_pembukuan");
    jenisSelect.value = (type === 'kasMasuk') ? 'kas-masuk' : 'kas-keluar';
    createPembukuanRows();
    
    // Isi data ke baris pertama
    const container = document.getElementById("detail-container-pembukuan");
    const firstRow = container.querySelector(type === 'kasMasuk' ? '.row-group-pembukuan' : '.row-group');
    
    if (firstRow) {
        if (type === 'kasMasuk') {
            if(firstRow.querySelector(".pembukuan_ket_masuk")) firstRow.querySelector(".pembukuan_ket_masuk").value = dataToEdit.keterangan || '';
            if(firstRow.querySelector(".pembukuan_catatan")) firstRow.querySelector(".pembukuan_catatan").value = dataToEdit.catatan || '';
            if(firstRow.querySelector(".pembukuan_fisik")) firstRow.querySelector(".pembukuan_fisik").value = dataToEdit.fisik || '';
            if(firstRow.querySelector(".pembukuan_vcr")) firstRow.querySelector(".pembukuan_vcr").value = dataToEdit.vcr || '';
            
            // Trigger perhitungan selisih dan display logic
            firstRow.querySelector(".pembukuan_ket_masuk").dispatchEvent(new Event('input'));
            firstRow.querySelector(".pembukuan_fisik").dispatchEvent(new Event('input'));
            
            // Isi komentar jika ada
            if (dataToEdit.komentarFisik) {
                firstRow.querySelector(".pembukuan_komentar_fisik").value = dataToEdit.komentarFisik;
                // Force show comment field logic if needed, simplified here
            }
            if (dataToEdit.komentarSelisih) {
                firstRow.querySelector(".pembukuan_komentar_selisih").value = dataToEdit.komentarSelisih;
            }
        } else {
            if(firstRow.querySelector(".pembukuan_ket_keluar")) firstRow.querySelector(".pembukuan_ket_keluar").value = dataToEdit.keterangan || '';
            if(firstRow.querySelector(".pembukuan_setor")) firstRow.querySelector(".pembukuan_setor").value = dataToEdit.setor || '';
            // Foto tidak bisa di-restore ke input file karena security browser
            if (dataToEdit.foto) {
                alert("Catatan: Foto sebelumnya tidak dapat dimuat kembali ke input file. Silakan upload ulang jika perlu.");
            }
        }
    }
    
    // Hapus data lama
    deletePembukuanItem(parentIdx, type, subIdx);
}

function exportPembukuanToExcel() {
  const tglAwal = document.getElementById("pembukuan_tanggal_awal").value;
  const tglAkhir = document.getElementById("pembukuan_tanggal_akhir").value;
  const filename = `Laporan_Pembukuan_${tglAwal}_sd_${tglAkhir}.xls`;

  const pending = getCachedParsedStorage('RBM_PENDING_PEMBUKUAN');
  let rows = [];

  let totalCashMasuk = 0;
  let totalKasKeluar = 0;
  let totalFisikSheet = 0;
  let totalSemuaMasuk = 0;

  pending.forEach((item) => {
      const p = item.payload;
      if (p.tanggal >= tglAwal && p.tanggal <= tglAkhir) {
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

  totalFisikSheet = totalCashMasuk - totalKasKeluar;

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
  xml += `   <Cell ss:StyleID="sTitle" ss:MergeAcross="5"><Data ss:Type="String">Laporan Pembukuan</Data></Cell>\n`;
  xml += '  </Row>\n';
  xml += '  <Row ss:Height="20">\n';
  xml += `   <Cell ss:StyleID="sSubtitle" ss:MergeAcross="5"><Data ss:Type="String">Periode: ${tglAwal} s/d ${tglAkhir}</Data></Cell>\n`;
  xml += '  </Row>\n';
  xml += '  <Row ss:Index="4">\n';
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
  xml += `   <Cell ss:StyleID="sSummaryLabel" ss:MergeAcross="1"><Data ss:Type="String">Total Fisik (Sheet)</Data></Cell>\n`;
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

  // Fungsi untuk merender data menjadi Matrix (Pivot)
  const renderPivot = (data) => {
      if (!data || data.length === 0) {
          thead.innerHTML = '<tr><th>No</th><th>Nama Barang</th><th>Status</th></tr>';
          tbody.innerHTML = '<tr><td colspan="3" class="table-empty">Tidak ada data ditemukan.</td></tr>';
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
      items.forEach((item, index) => {
          bodyHtml += `<tr><td>${index + 1}</td><td>${item}</td>`;
          
          dates.forEach(date => {
              // Cari data yang cocok
              // Kita ambil data terakhir jika ada duplikat input di tanggal yang sama
              const matches = data.filter(d => d.nama === item && d.tanggal === date);
              let val = '-';
              let valForEdit = '';

              if (matches.length > 0) {
                  val = matches[matches.length - 1].jumlah;
                  valForEdit = val;
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
  if (!isGoogleScript()) {
    setTimeout(() => {
        const pending = getCachedParsedStorage('RBM_PENDING_INVENTARIS');
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

  // Google Script Logic (Placeholder - Anda perlu membuat fungsi getLaporanInventaris di GAS)
  google.script.run
    .withSuccessHandler(renderPivot)
    .withFailureHandler(function(err) {
       tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error: ' + err.message + '</td></tr>';
    })
    .getLaporanInventaris(tglAwal, tglAkhir);
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
    document.getElementById('editInventarisModal').style.display = 'flex';
}

function closeEditInventaris() {
    document.getElementById('editInventarisModal').style.display = 'none';
}

function saveEditInventaris() {
    const nama = document.getElementById('editInvNama').value;
    const tanggal = document.getElementById('editInvTanggal').value;
    const jumlah = document.getElementById('editInvJumlah').value;
    
    if (jumlah === '') { alert("Jumlah harus diisi"); return; }
    processInventarisUpdate(nama, tanggal, jumlah);
}

function deleteEditInventaris() {
    if (!confirm("Hapus data inventaris ini? (Jumlah akan di-set ke 0)")) return;
    const nama = document.getElementById('editInvNama').value;
    const tanggal = document.getElementById('editInvTanggal').value;
    processInventarisUpdate(nama, tanggal, 0);
}

function processInventarisUpdate(nama, tanggal, jumlah) {
    const dataList = [{ tanggal: tanggal, nama: nama, jumlah: jumlah }];
    closeEditInventaris();
    
    const tbody = document.getElementById("inv_tbody");
    tbody.innerHTML = '<tr><td colspan="100%" class="table-loading">Menyimpan perubahan...</td></tr>';

    if (!isGoogleScript()) {
        savePendingToLocalStorage('INVENTARIS', dataList);
        loadInventarisData();
    } else {
        google.script.run.withSuccessHandler(function(res) { alert(res); loadInventarisData(); }).withFailureHandler(function(err) { alert("Error: " + err.message); loadInventarisData(); }).simpanDataInventaris(dataList);
    }
}

// ================= ABSENSI LOGIC =================
const ABSENSI_CODES = ['H', 'R', 'O', 'S', 'I', 'A', 'DP', 'PH', 'AL', ''];
let activeAbsensiMode = 'absensi';

function switchAbsensiTab(mode) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('tab-btn-' + mode);
    if(activeBtn) activeBtn.classList.add('active');
    renderAbsensiTable(mode);
}

function renderAbsensiTable(mode) {
    if (mode) activeAbsensiMode = mode;
    const tglAwal = document.getElementById("absensi_tgl_awal").value;
    const tglAkhir = document.getElementById("absensi_tgl_akhir").value;
    const thead = document.getElementById("absensi_thead");
    const tbody = document.getElementById("absensi_tbody");

    if (!tglAwal || !tglAkhir) return;

    // Generate Date Range
    const dates = [];
    let curr = new Date(tglAwal);
    const end = new Date(tglAkhir);
    while (curr <= end) {
        dates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }

    const isJadwal = activeAbsensiMode === 'jadwal';
    const legendAbsensi = document.getElementById('legend-absensi');
    const legendJadwal = document.getElementById('legend-jadwal');
    if (legendAbsensi && legendJadwal) {
        legendAbsensi.style.display = isJadwal ? 'none' : 'flex';
        legendJadwal.style.display = isJadwal ? 'flex' : 'none';
    }

    const rekapHeaders = isJadwal ? ['P','M','S','Off','PH','AL','DP'] : ['H','R','O','S','I','A','DP','PH','AL'];
    const dataKey = isJadwal ? 'RBM_JADWAL_DATA' : 'RBM_ABSENSI_DATA';
    const storedData = safeParse(localStorage.getItem(dataKey), {});

    // 1. Build Header
    let row1 = `
        <tr>
            <th rowspan="2" style="position:sticky; left:0; z-index:10;">No</th>
            <th rowspan="2" style="position:sticky; left:40px; z-index:10; min-width:150px;">Nama</th>
            <th rowspan="2">Jabatan</th>
            <th rowspan="2">Join Date</th>
            <th colspan="3">Sisa Cuti</th>
            <th colspan="${dates.length}">Tanggal (${tglAwal} s/d ${tglAkhir}) - ${isJadwal ? 'JADWAL' : 'ABSENSI'}</th>
            <th colspan="3">Sisa Cuti</th>
            <th colspan="${rekapHeaders.length}">Rekap ${isJadwal ? 'Jadwal' : 'Absensi'}</th>
            <th rowspan="2">Aksi</th>
        </tr>
        <tr>`;
    
    // Header Sisa Cuti
    row1 += `<th>AL</th><th>DP</th><th>PH</th>`;

    dates.forEach(d => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        row1 += `<th style="font-size:11px; min-width:35px;">${day}/${month}</th>`;
    });

    // Header Sisa Cuti & Rekap
    row1 += `<th>AL</th><th>DP</th><th>PH</th>`; // Sisa Cuti
    rekapHeaders.forEach(h => {
        row1 += `<th>${h}</th>`;
    });
    row1 += `</tr>`;
    thead.innerHTML = row1;

    // 2. Load Data
    const employees = safeParse(localStorage.getItem('RBM_EMPLOYEES'), []);
    if (employees.length === 0) {
        // Default data jika kosong
        employees.push({id: 1, name: "Budi", jabatan: "Kitchen", joinDate: "2023-01-01", sisaAL:12, sisaDP:0, sisaPH:0});
        employees.push({id: 2, name: "Siti", jabatan: "Server", joinDate: "2023-02-15", sisaAL:12, sisaDP:0, sisaPH:0});
    }

    // 3. Build Body
    let bodyHtml = '';
    employees.forEach((emp, index) => {
        // Static Info
        let rowHtml = `<tr>
            <td style="position:sticky; left:0; background:white; z-index:5;">${index + 1}</td>
            <td style="position:sticky; left:40px; background:white; z-index:5; text-align:left;">
                <input type="text" value="${emp.name}" onchange="updateEmployee(${index}, 'name', this.value)" style="border:none; width:100%; padding:0;">
            </td>
            <td><input type="text" value="${emp.jabatan}" onchange="updateEmployee(${index}, 'jabatan', this.value)" style="border:none; width:80px; padding:0;"></td>
            <td><input type="date" value="${emp.joinDate || ''}" onchange="updateEmployee(${index}, 'joinDate', this.value)" style="border:none; width:110px; padding:0; font-size:11px;"></td>
        `;

        // Sisa Cuti Inputs (Dipindah ke sini agar terlihat di kiri)
        rowHtml += `
            <td><input type="number" value="${emp.sisaAL||0}" onchange="updateEmployee(${index}, 'sisaAL', this.value)" style="width:50px; padding:5px; border:1px solid #eee; text-align:center;"></td>
            <td><input type="number" value="${emp.sisaDP||0}" onchange="updateEmployee(${index}, 'sisaDP', this.value)" style="width:50px; padding:5px; border:1px solid #eee; text-align:center;"></td>
            <td><input type="number" value="${emp.sisaPH||0}" onchange="updateEmployee(${index}, 'sisaPH', this.value)" style="width:50px; padding:5px; border:1px solid #eee; text-align:center;"></td>
        `;

        // Date Cells
        let counts = {};
        rekapHeaders.forEach(h => counts[h] = 0);
        
        dates.forEach(d => {
            const dateKey = d.toISOString().split('T')[0];
            const key = `${dateKey}_${emp.id || index}`; // Simple key
            const status = storedData[key] || '';
            
            if (status && counts.hasOwnProperty(status)) counts[status]++;
            
            let colorClass = '';
            if (isJadwal) {
                 if (['P','M','S','Off'].includes(status)) colorClass = `jadwal-${status}`;
                 else if (['PH','AL','DP'].includes(status)) colorClass = 'status-C';
            } else {
                 if (status) {
                    let type = status.charAt(0);
                    if(['DP','PH','AL'].includes(status)) type = 'C';
                    colorClass = `status-${type}`;
                 }
            }
            rowHtml += `<td class="absensi-cell ${colorClass}" onclick="cycleStatus(this, '${key}', '${activeAbsensiMode}')">${status}</td>`;
        });

        // Sisa Cuti Inputs
        rowHtml += `
            <td><input type="number" value="${emp.sisaAL||0}" onchange="updateEmployee(${index}, 'sisaAL', this.value)" style="width:50px; padding:5px; border:none; text-align:center;"></td>
            <td><input type="number" value="${emp.sisaDP||0}" onchange="updateEmployee(${index}, 'sisaDP', this.value)" style="width:50px; padding:5px; border:none; text-align:center;"></td>
            <td><input type="number" value="${emp.sisaPH||0}" onchange="updateEmployee(${index}, 'sisaPH', this.value)" style="width:50px; padding:5px; border:none; text-align:center;"></td>
        `;

        // Rekap Columns (Calculated)
        rekapHeaders.forEach(h => {
            rowHtml += `<td class="rekap-${h}">${counts[h]}</td>`;
        });
        rowHtml += `<td><button class="btn-small-danger" onclick="removeEmployee(${index})">x</button></td></tr>`;

        bodyHtml += rowHtml;
    });
    tbody.innerHTML = bodyHtml;
    
    // Simpan employees ke local storage jika baru inisialisasi
    localStorage.setItem('RBM_EMPLOYEES', JSON.stringify(employees));
}

function cycleStatus(cell, key, mode) {
    const codes = mode === 'jadwal' ? JADWAL_CODES : ABSENSI_CODES;
    const current = cell.innerText;
    let nextIdx = codes.indexOf(current) + 1;
    if (nextIdx >= codes.length) nextIdx = 0;
    const next = codes[nextIdx];
    
    cell.innerText = next;
    
    // Update Class
    cell.className = 'absensi-cell'; // reset
    if (next) {
        if (mode === 'jadwal') {
             if (['P','M','S','Off'].includes(next)) cell.classList.add(`jadwal-${next}`);
             else if (['PH','AL','DP'].includes(next)) cell.classList.add('status-C');
        } else {
             let type = next.charAt(0);
             if(['DP','PH','AL'].includes(next)) type = 'C';
             cell.classList.add(`status-${type}`);
        }
    }

    // Save to temp object in memory (will be saved to storage on 'Simpan')
    const dataKey = mode === 'jadwal' ? 'RBM_JADWAL_DATA' : 'RBM_ABSENSI_DATA';
    let data = safeParse(localStorage.getItem(dataKey), {});
    data[key] = next;
    localStorage.setItem(dataKey, JSON.stringify(data));
    
    // Optional: Recalculate row recap immediately could be added here, 
    // but for simplicity, user can click "Tampilkan" to refresh counts or we can do simple DOM update.
}

function updateEmployee(index, field, value) {
    const employees = safeParse(localStorage.getItem('RBM_EMPLOYEES'), []);
    if (employees[index]) {
        employees[index][field] = value;
        localStorage.setItem('RBM_EMPLOYEES', JSON.stringify(employees));
    }
}

function addEmployeeRow() {
    const employees = safeParse(localStorage.getItem('RBM_EMPLOYEES'), []);
    const newId = employees.length > 0 ? Math.max(...employees.map(e => e.id || 0)) + 1 : 1;
    employees.push({ id: newId, name: "Nama Baru", jabatan: "-", joinDate: "", sisaAL:0, sisaDP:0, sisaPH:0 });
    localStorage.setItem('RBM_EMPLOYEES', JSON.stringify(employees));
    renderAbsensiTable();
}

function removeEmployee(index) {
    if(!confirm("Hapus karyawan ini?")) return;
    const employees = safeParse(localStorage.getItem('RBM_EMPLOYEES'), []);
    employees.splice(index, 1);
    localStorage.setItem('RBM_EMPLOYEES', JSON.stringify(employees));
    renderAbsensiTable();
}

function saveAbsensiData() {
    // Data sudah tersimpan otomatis di localStorage saat klik cell (cycleAbsensiStatus) dan edit input (updateEmployee).
    // Fungsi ini bisa digunakan untuk trigger sync ke Google Sheet nantinya.
    alert("✅ Data Absensi & Jadwal tersimpan di Local Storage.");
    renderAbsensiTable(); // Refresh untuk update rekap
}

const JADWAL_CODES = ['P', 'M', 'S', 'Off', 'PH', 'AL', 'DP', ''];
        employees[index][field] = value;
        localStorage.setItem('RBM_EMPLOYEES', JSON.stringify(employees));
    }
}

function addEmployeeRow() {
    const employees = safeParse(localStorage.getItem('RBM_EMPLOYEES'), []);
    const newId = employees.length > 0 ? Math.max(...employees.map(e => e.id || 0)) + 1 : 1;
    employees.push({ id: newId, name: "Nama Baru", jabatan: "-", joinDate: "", sisaAL:0, sisaDP:0, sisaPH:0 });
    localStorage.setItem('RBM_EMPLOYEES', JSON.stringify(employees));
    renderAbsensiTable();
}

function removeEmployee(index) {
    if(!confirm("Hapus karyawan ini?")) return;
    const employees = safeParse(localStorage.getItem('RBM_EMPLOYEES'), []);
    employees.splice(index, 1);
    localStorage.setItem('RBM_EMPLOYEES', JSON.stringify(employees));
    renderAbsensiTable();
}

function saveAbsensiData() {
    // Data sudah tersimpan otomatis di localStorage saat klik cell (cycleAbsensiStatus) dan edit input (updateEmployee).
    // Fungsi ini bisa digunakan untuk trigger sync ke Google Sheet nantinya.
    alert("✅ Data Absensi & Jadwal tersimpan di Local Storage.");
    renderAbsensiTable(); // Refresh untuk update rekap
}

const JADWAL_CODES = ['P', 'M', 'S', 'Off', 'PH', 'AL', 'DP', ''];
