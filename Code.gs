// ===============================================================
// |   FUNGSI UTAMA UNTUK MENAMPILKAN APLIKASI WEB                 |
// ===============================================================
function doGet() {
  return HtmlService.createHtmlOutputFromFile("Input Data")
    .setTitle("Input Data RBM Ponti")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===============================================================
// |   FUNGSI BACA DATA PETTY CASH DENGAN FILTER RENTANG TANGGAL   |
// ===============================================================
/**
 * Mengambil data Petty Cash dari sheet "Pety Cash" dengan filter rentang tanggal.
 * Kolom: C=No, D=Tanggal, E=Nama, F=Jml, G=Satuan, H=Harga, I=Keluar, J=Masuk, K=Saldo, L=Foto
 * @param {string} tanggalAwal - Format YYYY-MM-DD
 * @param {string} tanggalAkhir - Format YYYY-MM-DD
 * @returns {Object} { data: array transaksi, summary: { totalDebit, totalKredit, saldoAkhir } }
 */
function getDataPettyCash(tanggalAwal, tanggalAkhir) {
  try {
    const ss = SpreadsheetApp.openById("1Sm7wORw3gFR2HcnzpMWNcRtJOz_hwpeG-xkCOy--VLA");
    const sheet = ss.getSheetByName("Pety Cash");
    if (!sheet) return { error: "Sheet 'Pety Cash' tidak ditemukan.", data: [], summary: {} };

    const lastRow = sheet.getLastRow();
    if (lastRow < 10) return { data: [], summary: { totalDebit: 0, totalKredit: 0, saldoAkhir: 0 } };

    // Ambil data dari baris 10 ke bawah (sesuaikan jika header berbeda)
    // Kolom: A=1, B=2, C=3(No), D=4(Tanggal), E=5(Nama), F=6(Jml), G=7(Satuan), H=8(Harga), I=9(Keluar), J=10(Masuk), K=11(Saldo), L=12(Foto)
    const dataRange = sheet.getRange(10, 1, lastRow, 12);
    const rawData = dataRange.getValues();
    const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "Asia/Jakarta";

    const tglAwal = tanggalAwal ? new Date(tanggalAwal) : null;
    const tglAkhir = tanggalAkhir ? new Date(tanggalAkhir) : null;
    if (tglAkhir) tglAkhir.setHours(23, 59, 59, 999);

    const filtered = [];
    let totalDebit = 0, totalKredit = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const no = row[2];
      const tglVal = row[3];
      const nama = row[4] || "";
      const jml = row[5] || 0;
      const satuan = row[6] || "";
      const harga = row[7] || 0;
      const keluar = parseFloat(row[8]) || 0;
      const masuk = parseFloat(row[9]) || 0;
      const saldo = parseFloat(row[10]) || 0;
      const foto = row[11] || "";

      if (!tglVal || (typeof tglVal !== "object" && !tglVal.toString().trim())) continue;

      const tglSheet = tglVal instanceof Date ? tglVal : new Date(tglVal);
      tglSheet.setHours(0, 0, 0, 0);

      if (tglAwal && tglSheet < tglAwal) continue;
      if (tglAkhir && tglSheet > tglAkhir) continue;

      const tglStr = Utilities.formatDate(tglSheet, timezone, "dd/MM/yyyy");
      filtered.push({
        no: no,
        tanggal: tglStr,
        nama: nama,
        jumlah: jml,
        satuan: satuan,
        harga: harga,
        debit: keluar,
        kredit: masuk,
        saldo: saldo,
        foto: foto
      });
      totalDebit += keluar;
      totalKredit += masuk;
    }

    const saldoAkhir = filtered.length > 0 ? filtered[filtered.length - 1].saldo : 0;

    return {
      data: filtered,
      summary: {
        totalDebit: totalDebit,
        totalKredit: totalKredit,
        saldoAkhir: saldoAkhir
      }
    };
  } catch (e) {
    Logger.log("getDataPettyCash error: " + e.toString());
    return { error: e.toString(), data: [], summary: {} };
  }
}

/**
 * Mengambil data Pengajuan Petty Cash dari kolom T, U, V (tanggal, nominal, foto)
 * @param {string} tanggalAwal - Format YYYY-MM-DD
 * @param {string} tanggalAkhir - Format YYYY-MM-DD
 */
function getDataPengajuanPettyCash(tanggalAwal, tanggalAkhir) {
  try {
    const ss = SpreadsheetApp.openById("1Sm7wORw3gFR2HcnzpMWNcRtJOz_hwpeG-xkCOy--VLA");
    const sheet = ss.getSheetByName("Pety Cash");
    if (!sheet) return { error: "Sheet tidak ditemukan.", data: [] };

    const lastRow = sheet.getLastRow();
    if (lastRow < 12) return { data: [] };

    const colT = sheet.getRange(12, 20, lastRow, 22).getValues(); // T=20, U=21, V=22
    const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "Asia/Jakarta";

    const tglAwal = tanggalAwal ? new Date(tanggalAwal) : null;
    const tglAkhir = tanggalAkhir ? new Date(tanggalAkhir) : null;
    if (tglAkhir) tglAkhir.setHours(23, 59, 59, 999);

    const filtered = [];
    for (let i = 0; i < colT.length; i++) {
      const tglVal = colT[i][0];
      const nominal = parseFloat(colT[i][1]) || 0;
      const foto = colT[i][2] || "";
      if (!tglVal && !nominal) continue;

      const tglSheet = tglVal instanceof Date ? tglVal : (tglVal ? new Date(tglVal) : null);
      if (tglSheet) {
        tglSheet.setHours(0, 0, 0, 0);
        if (tglAwal && tglSheet < tglAwal) continue;
        if (tglAkhir && tglSheet > tglAkhir) continue;
      }

      filtered.push({
        tanggal: tglSheet ? Utilities.formatDate(tglSheet, timezone, "dd/MM/yyyy") : "-",
        nominal: nominal,
        foto: foto
      });
    }
    return { data: filtered };
  } catch (e) {
    Logger.log("getDataPengajuanPettyCash error: " + e.toString());
    return { error: e.toString(), data: [] };
  }
}

// ===============================================================
// |              SKRIP FINAL UNTUK PENYIMPANAN DATA             |
// ===============================================================

function simpanDataOnline(dataList) {
  Logger.log("Menjalankan SKRIP FINAL. Jika log ini muncul, kodenya sudah benar.");

  try {
    const ss = SpreadsheetApp.openById("1Sm7wORw3gFR2HcnzpMWNcRtJOz_hwpeG-xkCOy--VLA");
    const sheet = ss.getSheetByName("Database");
    
    if (!sheet) {
      return "❌ Gagal: Sheet dengan nama 'Database' tidak ditemukan.";
    }

    const FOLDER_ID_FOTO_RUSAK = "1Fp1KT3QjRLYIqj0iHrIxNfGYTbAvfcE8";

    const getLastRowInColumn = (columnIndex) => {
      const allValues = sheet.getRange(1, columnIndex, sheet.getLastRow() || 1, 1).getValues();
      let lastRow = 0;
      for (let i = allValues.length - 1; i >= 0; i--) {
        if (allValues[i][0] !== "" && allValues[i][0] !== "Tanggal") {
          lastRow = i + 1;
          break;
        }
      }
      return Math.max(lastRow, 2);
    };

    dataList.forEach(data => {
      const jenis = data.jenis.toLowerCase();
      let newRow;

      switch (jenis) {
        case "barang masuk":
          newRow = getLastRowInColumn(1) + 1;
          sheet.getRange(newRow, 1, 1, 3).setValues([[ data.tanggal, data.nama, data.jumlah ]]);
          break;
        case "barang keluar":
          newRow = getLastRowInColumn(4) + 1; 
          sheet.getRange(newRow, 4, 1, 4).setValues([[ data.tanggal, data.nama, data.jumlah, data.barangjadi || "" ]]);
          break;
        case "rusak":
          newRow = getLastRowInColumn(8) + 1; 
          let fotoUrlRusak = "";
          if (data.fotoRusak && FOLDER_ID_FOTO_RUSAK !== "1Fp1KT3QjRLYIqj0iHrIxNfGYTbAvfcE8") {
            try {
              const folder = DriveApp.getFolderById(FOLDER_ID_FOTO_RUSAK);
              const blob = Utilities.newBlob(Utilities.base64Decode(data.fotoRusak.data), data.fotoRusak.mimeType, data.fotoRusak.fileName);
              const file = folder.createFile(blob);
              fotoUrlRusak = file.getUrl();
            } catch (e) {
              fotoUrlRusak = "Gagal Upload: " + e.toString();
            }
          } else if (data.fotoRusak && FOLDER_ID_FOTO_RUSAK === "1Fp1KT3QjRLYIqj0iHrIxNfGYTbAvfcE8") {
              fotoUrlRusak = "ERROR: FOLDER_ID_FOTO_RUSAK belum diatur!";
          }
          sheet.getRange(newRow, 8, 1, 5).setValues([[ data.tanggal, data.nama, data.jumlah, data.keteranganRusak || "", fotoUrlRusak ]]);
          break;
        case "sisa":
          newRow = getLastRowInColumn(13) + 1; 
          const [y, m, d] = data.tanggal.split("-").map(Number);
          const tgl = new Date(y, m - 1, d);
          const besok = new Date(tgl);
          besok.setDate(tgl.getDate() + 1);
          sheet.getRange(newRow, 13, 1, 6).setValues([[ tgl, data.nama, data.jumlah, besok, data.nama, data.jumlah ]]);
          break;
      }
    });

    return `✅ ${dataList.length} data barang berhasil disimpan di baris terakhir.`;

  } catch (e) {
    Logger.log(e);
    return "❌ Terjadi error (Barang): " + e.message;
  }
}

function simpanTransaksiBatch(data) {
  try {
    const ss = SpreadsheetApp.openById("1Sm7wORw3gFR2HcnzpMWNcRtJOz_hwpeG-xkCOy--VLA");
    const sheet = ss.getSheetByName("Pety Cash");
    if (!sheet) return "❌ Sheet tidak ditemukan.";

    const transactions = data.transactions;
    if (!transactions || transactions.length === 0) return "ℹ️ Tidak ada data.";

    const rowsToInsert = [];
    const numColumns = 26; 
    const lastRow = sheet.getLastRow();
    const COL_NOMOR_STR = "C"; 
    const COL_TANGGAL_STR = "D"; 
    const COL_SALDO_STR = "K"; 
    const COL_SALDO_IDX = 10; 

    const newTransactionDate = new Date(data.tanggal);
    newTransactionDate.setHours(0, 0, 0, 0);

    let lastNo = 0;
    let lastSaldo = 0;

    if (lastRow >= 1) {
      lastSaldo = sheet.getRange(COL_SALDO_STR + lastRow).getValue() || 0;
      const lastDateValue = sheet.getRange(COL_TANGGAL_STR + lastRow).getValue();
      
      if (lastDateValue instanceof Date) {
        const lastDateInSheet = new Date(lastDateValue);
        lastDateInSheet.setHours(0, 0, 0, 0);

        if (newTransactionDate.getTime() > lastDateInSheet.getTime()) {
          let blankRow = new Array(numColumns).fill('');
          blankRow[COL_SALDO_IDX] = lastSaldo;
          rowsToInsert.push(blankRow); 
          lastNo = 0;
        } else {
          const lastNoValue = sheet.getRange(COL_NOMOR_STR + lastRow).getValue();
          lastNo = parseInt(lastNoValue) || 0;
        }
      }
    }
    
    let currentNo = lastNo;

    transactions.forEach((trx) => {
      let fotoUrl = "";
      if (trx.foto && trx.foto.data) {
        const blob = Utilities.newBlob(Utilities.base64Decode(trx.foto.data), trx.foto.mimeType, trx.foto.fileName);
        const folder = DriveApp.getFolderById("1Fp1KT3QjRLYIqj0iHrIxNfGYTbAvfcE8");
        fotoUrl = folder.createFile(blob).getUrl();
      }
      
      let newRowData = new Array(numColumns).fill(''); 
      const targetRow = lastRow + rowsToInsert.length + 1;
      const formulaSaldo = `=${COL_SALDO_STR}${targetRow - 1}-I${targetRow}+J${targetRow}`;

      currentNo++;
      newRowData[2] = currentNo;
      newRowData[3] = new Date(data.tanggal);
      newRowData[4] = trx.nama;
      
      if (data.jenis === 'pengeluaran') {
        const jumlah = parseFloat(trx.jumlah) || 0;
        const harga = parseFloat(trx.harga) || 0;
        const total = jumlah * harga;
        newRowData[5] = jumlah;
        newRowData[6] = trx.satuan;
        newRowData[7] = harga;
        newRowData[8] = total;
        newRowData[9] = 0;
      } else { 
        newRowData[8] = 0;
        newRowData[9] = parseFloat(trx.jumlah) || 0;
      }
      
      newRowData[10] = formulaSaldo;
      newRowData[11] = fotoUrl;
      
      rowsToInsert.push(newRowData);
    });
    
    sheet.getRange(lastRow + 1, 1, rowsToInsert.length, numColumns).setValues(rowsToInsert);
    sheet.getRange(lastRow + 1, 3, rowsToInsert.length, 8).setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
    
    return `✅ Berhasil disimpan. Nomor terakhir: ${currentNo}`;
  } catch (e) {
    return "❌ Error: " + e.message;
  }
}

function simpanDataInventaris(dataList) {
  try {
    const ss = SpreadsheetApp.openById("1Sm7wORw3gFR2HcnzpMWNcRtJOz_hwpeG-xkCOy--VLA");
    const sheet = ss.getSheetByName("Inventaris");
    
    if (!sheet) return "❌ Sheet 'Inventaris' tidak ditemukan.";
    
    const newDate = new Date(dataList[0].tanggal);
    const newDateString = Utilities.formatDate(newDate, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    
    const lastCol = sheet.getLastColumn();
    const dateRow = sheet.getRange(5, 8, 1, lastCol - 7).getValues()[0];
    
    let targetColIndex = -1;
    
    for (let i = 0; i < dateRow.length; i++) {
      const cellDate = dateRow[i];
      if (cellDate instanceof Date) {
        const cellDateString = Utilities.formatDate(cellDate, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
        if (cellDateString === newDateString) {
          targetColIndex = i + 8;
          break;
        }
      } else if (cellDate === "") {
        targetColIndex = i + 8;
        break;
      }
    }
    
    if (targetColIndex === -1) targetColIndex = lastCol + 1;

    sheet.getRange(5, targetColIndex).setValue(newDate);

    const lastRow = sheet.getLastRow();
    const namaBarangInSheet = sheet.getRange("G6:G" + lastRow).getValues().flat();
    
    let updatedCount = 0;
    
    dataList.forEach(data => {
      const rowIndex = namaBarangInSheet.findIndex(item => item.trim() === data.nama.trim());
      
      if (rowIndex !== -1) {
        const sheetRow = rowIndex + 6;
        sheet.getRange(sheetRow, targetColIndex).setValue(parseInt(data.jumlah));
        updatedCount++;
      }
    });

    return updatedCount > 0 
      ? `✅ ${updatedCount} data inventaris berhasil diperbarui.`
      : "ℹ️ Tidak ada data inventaris yang cocok untuk diperbarui.";
  } catch (e) {
    return "❌ Terjadi error (Inventaris): " + e.message;
  }
}

function simpanDataPembukuan(data) {
  const SPREADSHEET_ID = "1Sm7wORw3gFR2HcnzpMWNcRtJOz_hwpeG-xkCOy--VLA"; 
  const SHEET_NAME = "Rekonsiliasi";
  const SHEET_DP_RESERVASI = "Rekonsiliasi"; 
  const KOLOM_TANGGAL = 3;
  const WARNA_FONT_SEMBUNYI = "#ffffff";

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return `❌ Gagal: Sheet '${SHEET_NAME}' tidak ditemukan.`;
    
    const JUMLAH_KOLOM = sheet.getLastColumn();
    const dpSheet = ss.getSheetByName(SHEET_DP_RESERVASI);
    if (!dpSheet) return `❌ Gagal: Sheet '${SHEET_DP_RESERVASI}' tidak ditemukan.`;

    const tanggal = new Date(data.tanggal);
    const rowsToInsert = [];
    const notesToInsert = []; 
    
    let totalCatatan = 0, totalFisik = 0, totalVoucherJml = 0;
    let totalKasKeluar = 0, totalCashMasuk = 0;

    if (data.kasMasuk && data.kasMasuk.length > 0) {
      data.kasMasuk.forEach(item => {
        let row = new Array(16).fill('');
        let noteRow = new Array(16).fill('');
        
        const keterangan = item.keterangan.toLowerCase().trim();
        row[2] = tanggal;
        row[3] = item.keterangan;

        if (keterangan === 'kas besar') {
            noteRow[5] = "GOFOOD & SHOPPEFOOD";
        } else if (item.keterangan.toLowerCase().trim() !== 'vcr') {
            if (item.komentarFisik) noteRow[5] = item.komentarFisik;
            if (item.komentarSelisih) noteRow[6] = item.komentarSelisih;
        }

        if (keterangan === 'vcr') {
          let jmlVcr = parseFloat(item.vcr) || 0;
          let hasilVcr = jmlVcr * 20000;
          row[5] = hasilVcr; 
          row[7] = jmlVcr;
          totalFisik += hasilVcr;
          totalVoucherJml += jmlVcr;
        } else {
          let catatan = parseFloat(item.catatan) || 0;
          let fisik = parseFloat(item.fisik) || 0;
          let selisih = fisik - catatan;
          row[4] = catatan;
          row[5] = fisik;
          row[6] = selisih;
          totalCatatan += catatan;
          totalFisik += fisik;
          if (keterangan === "cash") totalCashMasuk += fisik;
        }
        rowsToInsert.push(row);
        notesToInsert.push(noteRow);
      });
    }

    if (data.kasKeluar && data.kasKeluar.length > 0) {
      data.kasKeluar.forEach(item => {
        let row = new Array(JUMLAH_KOLOM).fill('');
        let jumlahKeluar = parseFloat(item.setor) || 0;

        row[2] = tanggal;
        row[3] = item.keterangan;
        row[5] = jumlahKeluar;

        if (item.foto && item.foto.data) {
          try {
            const folderId = "1Fp1KT3QjRLYIqj0iHrIxNfGYTbAvfcE8";
            const folder = DriveApp.getFolderById(folderId);
            const blob = Utilities.newBlob(Utilities.base64Decode(item.foto.data), item.foto.mimeType, item.foto.fileName);
            const file = folder.createFile(blob);
            row[8] = file.getUrl();
          } catch (err) {
            row[8] = "Error: Gagal Upload";
          }
        }
        rowsToInsert.push(row);
        notesToInsert.push(new Array(JUMLAH_KOLOM).fill(''));
        totalKasKeluar += jumlahKeluar;
        totalFisik += jumlahKeluar;
      });
    }

    if (rowsToInsert.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      const numRows = rowsToInsert.length;
      const numCols = rowsToInsert[0].length;
      const range = sheet.getRange(startRow, 1, numRows, numCols);
      range.setValues(rowsToInsert);
      range.setNotes(notesToInsert);
      sheet.getRange(startRow, 3, numRows, 5).setBorder(true, true, true, true, true, true);

      if (numRows > 1) {
        for (let i = 1; i < numRows; i++) {
          sheet.getRange(startRow + i, 3).setFontColor(WARNA_FONT_SEMBUNYI);
        }
      }

      let totalSelisih = "";
      if (data.kasMasuk && data.kasMasuk.length > 0) {
        let totalFisikKasMasuk = 0;
        data.kasMasuk.forEach(item => {
            if (item.keterangan.toLowerCase().trim() === 'vcr') {
                totalFisikKasMasuk += (parseFloat(item.vcr) || 0) * 20000;
            } else {
                totalFisikKasMasuk += parseFloat(item.fisik) || 0;
            }
        });
        totalSelisih = totalFisikKasMasuk - totalCatatan;
      }
      
      let summaryRow = new Array(10).fill('');
      summaryRow[3] = "TOTAL";
      summaryRow[4] = totalCatatan;
      summaryRow[5] = totalFisik;
      summaryRow[6] = totalSelisih;
      summaryRow[7] = totalVoucherJml;

      const summaryRowIndex = startRow + numRows;
      sheet.insertRowAfter(summaryRowIndex - 1);
      sheet.getRange(summaryRowIndex, 1, summaryRowIndex, summaryRow.length).setValues([summaryRow]);
      sheet.getRange(summaryRowIndex, 3, summaryRowIndex, 7).setFontWeight("bold").setBackground("#d9d9d9");
      sheet.getRange(summaryRowIndex, 3, summaryRowIndex, 7).setBorder(true, true, true, true, true, true);

      const tanggalRangeMulai = startRow;
      const tanggalRangeAkhir = summaryRowIndex - 1;
      sheet.getRange(tanggalRangeMulai, 3, tanggalRangeAkhir, 3).mergeVertically().setHorizontalAlignment("center").setVerticalAlignment("middle");
    }

    const cellG4 = sheet.getRange("g4");
    const cellH4 = sheet.getRange("h4");
    if (totalCashMasuk > 0) cellG4.setValue((parseFloat(cellG4.getValue()) || 0) + totalCashMasuk);
    if (totalKasKeluar > 0) cellH4.setValue((parseFloat(cellH4.getValue()) || 0) + totalKasKeluar);
    
    return "✅ Data berhasil disimpan dengan logika baru!";

  } catch (e) {
    Logger.log(e);
    return "❌ Error: " + e.message;
  }
}

function simpanDataPengajuanTF(data) {
  Logger.log("Mencoba menyimpan Pengajuan TF: " + JSON.stringify(data));
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("pengajuan");
    if (!sheet) return "❌ Error: Sheet 'pengajuan' tidak ditemukan.";

    const details = data.details;
    if (!details || details.length === 0) return "❌ Error: Tidak ada data detail yang diterima.";

    for (const item of details) {
      const fotoNotaUrl = item.fotoNota ? saveBase64FileToDrive(item.fotoNota) : "Tidak Ada File";
      const fotoTtdUrl = item.fotoTtd ? saveBase64FileToDrive(item.fotoTtd) : "Tidak Ada File";

      sheet.appendRow([
        "", "", "", "", "", "", "", "",
        item.tanggal, item.suplier, item.tglNota, item.tglJt,
        item.nominal, item.total, item.bankAcc, item.atasNama,
        item.keterangan, fotoNotaUrl, fotoTtdUrl
      ]);
    }
    return `✅ Berhasil! ${details.length} data Pengajuan TF telah disimpan.`;
  } catch (e) {
    Logger.log("ERROR di simpanDataPengajuanTF: " + e.toString());
    return `❌ Error: ${e.toString()}`;
  }
}

function simpanDataPengajuanPC(data) {
  Logger.log("Mencoba menyimpan Petty Cash: " + JSON.stringify(data));
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Pety Cash");
    if (!sheet) return "❌ Error: Sheet 'Pety Cash' tidak ditemukan.";

    const details = data.details;
    if (!details || details.length === 0) return "❌ Error: Tidak ada data detail yang diterima.";
    
    const START_ROW = 12;

    for (const item of details) {
      const lastRowWithContent = sheet.getLastRow();
      const checkUntilRow = Math.max(START_ROW, lastRowWithContent);
      const valuesT = sheet.getRange("T1:T" + checkUntilRow).getValues();

      let targetRow = -1;

      for (let i = START_ROW - 1; i < valuesT.length; i++) {
        if (valuesT[i][0] === "") {
          targetRow = i + 1;
          break;
        }
      }

      if (targetRow === -1) {
        targetRow = Math.max(START_ROW, lastRowWithContent + 1);
      }

      const fotoPengajuanUrl = item.fotoPengajuan ? saveBase64FileToDrive(item.fotoPengajuan) : "Tidak Ada File";
      const dataToInsert = [[item.tanggalPengajuan, item.nominal, fotoPengajuanUrl]];

      sheet.getRange(targetRow, 20, targetRow, 22).setValues(dataToInsert);
    }
    return `✅ Berhasil! ${details.length} data Petty Cash telah disimpan.`;
  } catch (e) {
    Logger.log("ERROR di simpanDataPengajuanPC: " + e.toString());
    return `❌ Error: ${e.toString()}`;
  }
}

function saveBase64FileToDrive(fileObject) {
  const FOLDER_ID = "1Fp1KT3QjRLYIqj0iHrIxNfGYTbAvfcE8";
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const decoded = Utilities.base64Decode(fileObject.data);
    const blob = Utilities.newBlob(decoded, fileObject.mimeType, fileObject.fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    Logger.log("ERROR saat menyimpan file ke Drive: " + e.toString());
    return "Error Gagal Simpan File";
  }
}

function simpanDataSudahTF(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Pengajuan");
    if (!sheet) return `❌ Gagal: Sheet "Pengajuan" tidak ditemukan.`;

    const folderId = "1Fp1KT3QjRLYIqj0iHrIxNfGYTbAvfcE8"; 
    const driveFolder = DriveApp.getFolderById(folderId);

    const startRow = 9;
    const colVValues = sheet.getRange(`V${startRow}:V`).getValues();
    let nextEmptyRow = startRow;
    for (let i = 0; i < colVValues.length; i++) {
      if (colVValues[i][0] === "") {
        nextEmptyRow = startRow + i;
        break;
      }
    }
    
    const details = data.details;
    const dataToSave = [];

    details.forEach(item => {
      const tanggalPengajuan = item.tanggalPengajuan;
      const fotoBukti = item.fotoBukti;
      let fileUrl = "No File Uploaded";

      if (fotoBukti && fotoBukti.data) {
        const decodedData = Utilities.base64Decode(fotoBukti.data);
        const blob = Utilities.newBlob(decodedData, fotoBukti.mimeType, fotoBukti.fileName);
        const file = driveFolder.createFile(blob);
        fileUrl = file.getUrl();
      }
      
      dataToSave.push([tanggalPengajuan, fileUrl]);
    });

    if (dataToSave.length > 0) {
      sheet.getRange(nextEmptyRow, 22, nextEmptyRow + dataToSave.length - 1, 23).setValues(dataToSave);
    }
    
    return `✅ ${details.length} Bukti Transfer berhasil disimpan!`;

  } catch (error) {
    Logger.log(error.toString());
    return `❌ Terjadi error: ${error.toString()}`;
  }
}

function getDataBankBySuplier(namaSuplier) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Bank");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const [nama, noRekening, namaPemilik] = data[i];
    if (nama && nama.toString().trim().toLowerCase() === namaSuplier.toLowerCase()) {
      return { noRekening, namaPemilik };
    }
  }
  return null;
}
