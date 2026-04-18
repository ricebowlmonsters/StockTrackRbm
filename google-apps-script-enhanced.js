/******************************************************************************
 * Rice Bowl Monster - Combined API (Fixed for Custom Headers)
 ******************************************************************************/

// ===== 1. CONFIGURATION: Define Sheet Names Here =====
const SHEET_USERS = 'users'; 
const SHEET_MENU = 'menu';
const SHEET_VOUCHERS = 'vouchers';
const SHEET_MERCHANDISE = 'merchandise';
const SHEET_LOCATIONS = 'locations';
const SHEET_LOG_TUKAR_POIN = 'Log Tukar Poin';
const SHEET_POINT_HISTORY = 'POINT_HISTORY';
const SHEET_CLAIMS = 'claims'; 

// ===== 2. CORE HELPER FUNCTIONS =====

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().toLowerCase() === name.toLowerCase()) {
        return sheets[i];
      }
    }
    sh = ss.insertSheet(name);
  }
  return sh;
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readHeaderMap(sheet) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  header.forEach((h, idx) => {
    map[String(h).toLowerCase().trim()] = idx + 1;
  });
  return map;
}

function findUserRowByPhone(phone) {
  const sh = getSheet(SHEET_USERS);
  const lastRow = sh.getLastRow();
  const headerMap = readHeaderMap(sh);

  if (lastRow < 2) return { row: -1, data: null, sheet: sh, headerMap: headerMap };
  
  // [FIX] Deteksi kolom Phone
  const phoneCol = headerMap['phone'] || headerMap['no hp'] || headerMap['no telepon'] || 2;
  
  // [FIX KRITIKAL] Deteksi kolom Nama
  // HAPUS 'username' dari fallback agar tidak salah ambil kolom C.
  // Jika tidak ada header 'nama'/'name', PAKSA ambil Kolom 1 (Kolom A).
  const namaCol = headerMap['nama'] || headerMap['name'] || headerMap['customer'] || 1;
  
  // [FIX] Deteksi kolom Points
  const pointsCol = headerMap['points sisa'] || headerMap['points'] || headerMap['point'] || headerMap['jumlah point'] || 4;

  const targetDigits = String(phone).replace(/\D+/g, '');
  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  
  for (let i = 0; i < values.length; i++) {
    const rowIndex = i + 2;
    const pIdx = (phoneCol > 0) ? phoneCol - 1 : 1;
    const cellVal = values[i][pIdx];
    
    const cellStr = cellVal === null || cellVal === undefined ? '' : String(cellVal);
    const sheetDigits = cellStr.replace(/\D+/g, '');

    if (sheetDigits === targetDigits) {
      const rowValues = sh.getRange(rowIndex, 1, 1, sh.getLastColumn()).getValues()[0];
      
      const user = {
        phone: cellStr,
        nama: '',
        username: '',
        points: 0
      };
      
      // Ambil Nama (Prioritas Kolom A jika header aneh)
      if (namaCol > 0 && rowValues[namaCol - 1]) {
        user.nama = rowValues[namaCol - 1];
      } else {
        user.nama = rowValues[0]; // Default mutlak ke kolom pertama
      }

      // Ambil Username (jika ada)
      const usernameCol = headerMap['username'];
      if (usernameCol > 0) {
         user.username = rowValues[usernameCol - 1];
      }

      // Ambil Poin
      if (pointsCol > 0) {
        user.points = Number(rowValues[pointsCol - 1] || 0);
      }
      
      return { row: rowIndex, data: user, headerMap, sheet: sh };
    }
  }

  return { row: -1, data: null, headerMap, sheet: sh };
}

function getDataFromSheet(sheetName, requiredColumns) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getDataRange().getValues();
  const items = [];
  const headers = data[0].map(h => h.toLowerCase().trim());

  const indices = {};
  for (const colName in requiredColumns) {
    const index = headers.indexOf(requiredColumns[colName]);
    if (index !== -1) indices[colName] = index;
    else indices[colName] = -1;
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.join('').trim() !== '') {
      const item = {};
      let hasData = false;
      for (const colName in indices) {
        if (indices[colName] !== -1) {
          item[colName] = row[indices[colName]];
          hasData = true;
        } else {
          item[colName] = '';
        }
      }
      if (hasData) items.push(item);
    }
  }
  return items;
}

function writePointHistory({ phone, nama, amount, source, operator }) {
  const sheet = getSheet(SHEET_POINT_HISTORY);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['TIMESTAMP', 'PHONE', 'NAMA', 'AMOUNT', 'SOURCE', 'OPERATOR']);
  }
  const now = new Date();
  sheet.appendRow([now, phone, nama || '', Number(amount || 0), source || 'unknown', operator || 'system']);
}

// ===== 3. HTTP HANDLERS =====

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getLocations') return handleGetLocations();
    if (action === 'getMenuData') return handleGetMenuData();

    const phoneNumber = (e.parameter.phone || '').trim();
    if (phoneNumber) {
      const { data } = findUserRowByPhone(phoneNumber);
      if (!data) return createJsonResponse({ status: 'error', message: 'Phone number not registered.' });
      return createJsonResponse({ status: 'success', data: data });
    }
    return createJsonResponse({ status: 'error', message: 'Invalid request.' });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: 'Server error: ' + error.message });
  }
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    if (!action) throw new Error('Action parameter is missing.');

    switch (action) {
      case 'register': return handleRegister(requestData);
      case 'getUserData': return handleGetUserData(requestData);
      case 'getMenuItems': return handleGetMenuItems();
      case 'getVoucherData': return handleGetVoucherData();
      case 'getMerchandiseData': return handleGetMerchandiseData();
      case 'addPoints': return handleAddPoints(requestData);
      case 'validateClaimCode': return handleValidateClaimCode(requestData);
      case 'getMenuData': return handleGetMenuData();
      
      case 'redeemReward': 
      case 'generateClaimCode': 
        return handleRedeemReward(requestData);

      default: throw new Error('Unknown action: ' + action);
    }

  } catch (error) {
    return createJsonResponse({ status: 'error', message: 'Failed to process request: ' + error.message });
  }
}

// ===== 4. ACTION HANDLERS =====

function handleRegister(requestData) {
  const { nama, username } = requestData;
  if (!nama || !username) throw new Error('Name and Phone Number cannot be empty.');
  const sheet = getSheet(SHEET_USERS);
  // Format: Nama, Phone, Username (kosong), Points
  sheet.appendRow([nama, username, '', 0]);
  return createJsonResponse({ status: 'success', message: 'Registration successful!' });
}

function handleGetUserData(requestData) {
  const phone = requestData.phone;
  if (!phone) throw new Error("Phone number is required.");
  const { data } = findUserRowByPhone(phone);
  if (data) return createJsonResponse({ status: 'success', user: data });
  return createJsonResponse({ status: 'error', message: 'User not found.' });
}

function handleGetMenuItems() {
  const menuItems = getDataFromSheet(SHEET_MENU, { nama: 'nama', harga: 'harga', gambar_url: 'gambar_url', kategori: 'kategori' });
  return createJsonResponse({ status: 'success', data: menuItems });
}

function handleGetVoucherData() {
  const vouchers = getDataFromSheet(SHEET_VOUCHERS, { nama: 'nama', point: 'point', foto: 'foto' });
  return createJsonResponse({ status: 'success', data: vouchers });
}

function handleGetMerchandiseData() {
  const merchandise = getDataFromSheet(SHEET_MERCHANDISE, { nama: 'nama', point: 'point', foto: 'foto' });
  return createJsonResponse({ status: 'success', data: merchandise });
}

function handleGetLocations() {
  try {
    const locations = getDataFromSheet(SHEET_LOCATIONS, { nama: 'nama', lat: 'lat', lng: 'lng' });
    return createJsonResponse({ status: 'success', data: locations });
  } catch (e) { return createJsonResponse({ status: 'success', data: [] }); }
}

function handleRedeemReward(requestData) {
  const { phone, reward, cost, nama } = requestData;
  const rewardCost = parseInt(cost);

  if (!phone || !reward || isNaN(rewardCost)) {
    return createJsonResponse({ status: 'error', message: 'Data tidak lengkap (phone/reward/cost).' });
  }
  
  const { row, data, headerMap, sheet } = findUserRowByPhone(phone);
  if (!data) return createJsonResponse({ status: 'error', message: 'User tidak ditemukan.' });

  const pointsCol = headerMap['points sisa'] || headerMap['points'] || headerMap['point'] || 4;
  const currentPoints = parseInt(data.points || 0);

  if (currentPoints >= rewardCost) {
    const newPoints = currentPoints - rewardCost;
    sheet.getRange(row, pointsCol).setValue(newPoints);
    
    const customerName = nama || data.nama || '';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName(SHEET_LOG_TUKAR_POIN);
    
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_LOG_TUKAR_POIN);
      logSheet.appendRow(['TIMESTAMP', 'PHONE', 'NAMA', 'REWARD', 'COST', 'CODE']); 
    } else if (logSheet.getLastRow() === 0) {
      logSheet.appendRow(['TIMESTAMP', 'PHONE', 'NAMA', 'REWARD', 'COST', 'CODE']);
    }

    const uniqueCode = reward.substring(0,3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
    logSheet.appendRow([new Date(), phone, customerName, reward, rewardCost, uniqueCode]);

    writePointHistory({
      phone: phone,
      nama: customerName,
      amount: -rewardCost,
      source: 'Redeem: ' + reward,
      operator: 'System'
    });

    return createJsonResponse({ 
      status: 'success', 
      message: 'Penukaran berhasil.', 
      newPoints: newPoints,
      data: {
        code: uniqueCode,
        claimTime: new Date()
      }
    });
  } else {
    return createJsonResponse({ status: 'error', message: 'Poin tidak cukup.' });
  }
}

function handleAddPoints(requestData) {
  const { phone, nominal, points, source, operator, nama } = requestData;
  const cleanPhone = String(phone || '').trim();
  const addPoints = Number(points || 0);

  if (!cleanPhone) return createJsonResponse({ status: 'error', message: 'phone is required' });
  if (!(addPoints > 0)) return createJsonResponse({ status: 'error', message: 'points must be > 0' });

  const { row, data, headerMap, sheet } = findUserRowByPhone(cleanPhone);
  if (!data) return createJsonResponse({ status: 'error', message: 'Customer not found.' });

  const pointsCol = headerMap['points sisa'] || headerMap['points'] || headerMap['point'] || 4;
  const currentPoints = data.points;
  const newPoints = currentPoints + addPoints;
  sheet.getRange(row, pointsCol).setValue(newPoints);

  const customerName = nama || data.nama || '';
  writePointHistory({ phone: cleanPhone, nama: customerName, amount: addPoints, source: source, operator: operator });

  return createJsonResponse({ status: 'success', data: { phone: cleanPhone, points_before: currentPoints, points_after: newPoints, added: addPoints } });
}

function handleValidateClaimCode(data) {
  return createJsonResponse({ status: 'success', message: 'Fitur validasi belum diaktifkan sepenuhnya.' });
}

function handleGetMenuData() {
  return createJsonResponse({ status: 'success', data: { riceBowl: [], mie: [], minuman: [], esCampur: [], gorengan: [] } });
}
