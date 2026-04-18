/**
 * firebase-storage.js
 * Satu titik penyimpanan ke Firebase – pengganti localStorage (app state) dan Google Sheets (Code.gs).
 * - App state: rbm_user, rbm_users, rbm_outlets, rbm_settings, printer, dll. → Firebase app_state/*
 * - Data RBM Pro (ex-Sheet): Petty Cash, Database barang, Inventaris, Pembukuan, Pengajuan, Bank → rbm_pro/*
 * Gunakan script ini setelah Firebase SDK (firebase-app.js, firebase-database.js) dimuat.
 */
(function(global) {
  'use strict';

  var db = null;
  var config = null;
  var useFirebase = false;

  // Pemetaan key localStorage → path Firebase (app_state)
  var APP_STATE_KEYS = {
    rbm_users: 'app_state/users',
    rbm_outlets: 'app_state/outlet_ids',
    rbm_outlet_names: 'app_state/outlet_names',
    rbm_db_connections: 'app_state/db_connections',
    rbm_active_connection_index: 'app_state/active_connection_index',
    rbm_settings: 'app_state/settings',
    rbm_menu_categories: 'app_state/menu_categories',
    rbm_printer_groups: 'app_state/printer_groups',
    rbm_printer_config: 'app_state/printer_config',
    rbm_payment_methods: 'payment_methods',
    rbm_points_history: 'rbm_pro/points_history',
    rbm_vouchers: 'rbm_pro/vouchers',
    rbm_active_outlets: 'app_state/active_outlets',
    rbm_outlet_locations: 'app_state/outlet_locations',
    rbm_quick_memos: 'app_state/quick_memos'
  };

  function getConnections() {
    try {
      var raw = localStorage.getItem('rbm_db_connections');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  var DEFAULT_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDWQG53tP2zKILTwPSJQpiVzFNyvYLxLqw',
    authDomain: 'ricebowlmonst.firebaseapp.com',
    databaseURL: 'https://ricebowlmonst-default-rtdb.firebaseio.com',
    projectId: 'ricebowlmonst',
    storageBucket: 'ricebowlmonst.firebasestorage.app',
    messagingSenderId: '723669558962',
    appId: '1:723669558962:web:c17a1a4683a86cc5a88bab',
    type: 'firebase'
  };

  function getActiveConnection() {
    var idx = parseInt(localStorage.getItem('rbm_active_connection_index') || '0', 10);
    var conns = getConnections();
    if (conns.length && conns[idx] && conns[idx].config) return conns[idx].config;
    if (conns.length && conns[0].config) return conns[0].config;
    return null;
  }

  // [OPTIMASI GPS] Interceptor untuk memisahkan Base64 Foto dari teks log GPS
  // Agar saat load bulan tidak mendownload gambar yang sangat berat
  function patchFirebaseGpsWrite() {
    if (typeof firebase === 'undefined' || !firebase.database) return;
    var refProto = firebase.database.Reference.prototype;
    if (refProto._gpsWritePatched) return;
    refProto._gpsWritePatched = true;

    var origPush = refProto.push;
    refProto.push = function(data, onComplete) {
        var pathStr = decodeURIComponent(this.toString());
        if (pathStr.indexOf('gps_logs_partitioned') >= 0 && data && typeof data.photo === 'string' && data.photo.length > 500) {
            var photoData = data.photo;
            data.photo = 'LAZY_PHOTO';
            data.hasPhoto = true;
            var pushRef = origPush.call(this, data, onComplete);
            var key = pushRef.key;
                var pathStrNorm = pathStr;
                if (pathStrNorm.indexOf('https://') === 0) {
                    pathStrNorm = pathStrNorm.replace(/^https:\/\/[^\/]+\//, '');
                }
                var photoPath = pathStrNorm.replace('gps_logs_partitioned', 'gps_logs_photos') + '/' + key;
            firebase.database().ref(photoPath).set(photoData);
            return pushRef;
        }
        return origPush.call(this, data, onComplete);
    };

    var origSet = refProto.set;
    refProto.set = function(data, onComplete) {
        var pathStr = decodeURIComponent(this.toString());
        if (pathStr.indexOf('gps_logs_partitioned') >= 0 && data && typeof data.photo === 'string' && data.photo.length > 500) {
            var photoData = data.photo;
            data.photo = 'LAZY_PHOTO';
            data.hasPhoto = true;
                var pathStrNorm = pathStr;
                if (pathStrNorm.indexOf('https://') === 0) {
                    pathStrNorm = pathStrNorm.replace(/^https:\/\/[^\/]+\//, '');
                }
                var photoPath = pathStrNorm.replace('gps_logs_partitioned', 'gps_logs_photos');
            firebase.database().ref(photoPath).set(photoData);
        }
        return origSet.call(this, data, onComplete);
    };

    var origUpdate = refProto.update;
    refProto.update = function(data, onComplete) {
        var pathStr = decodeURIComponent(this.toString());
        if (pathStr.indexOf('gps_logs_partitioned') >= 0 && data) {
            var photoUpdates = {};
            Object.keys(data).forEach(function(k) {
                if (k === 'photo' && typeof data[k] === 'string' && data[k].length > 500) {
                    photoUpdates[k] = data[k];
                    data[k] = 'LAZY_PHOTO';
                    data['hasPhoto'] = true;
                }
                if (data[k] && typeof data[k] === 'object' && typeof data[k].photo === 'string' && data[k].photo.length > 500) {
                    photoUpdates[k] = data[k].photo;
                    data[k].photo = 'LAZY_PHOTO';
                    data[k].hasPhoto = true;
                }
            });
            if (Object.keys(photoUpdates).length > 0) {
                    var pathStrNorm = pathStr;
                    if (pathStrNorm.indexOf('https://') === 0) {
                        pathStrNorm = pathStrNorm.replace(/^https:\/\/[^\/]+\//, '');
                    }
                    var photoPath = pathStrNorm.replace('gps_logs_partitioned', 'gps_logs_photos');
                firebase.database().ref(photoPath).update(photoUpdates);
            }
        }
        return origUpdate.call(this, data, onComplete);
    };
  }

  function init() {
    if (db !== null) return !!useFirebase;
    config = getActiveConnection();
    if (!config) config = DEFAULT_FIREBASE_CONFIG;
    if (config.type === 'local' || config.type === 'server') return false;
    try {
      if (typeof firebase === 'undefined') return false;
      if (!firebase.apps.length) firebase.initializeApp(config);
      db = firebase.database();
      useFirebase = true;
      patchFirebaseGpsWrite();
    } catch (e) {
      console.warn('firebase-storage: init failed', e);
    }
    return useFirebase;
  }

  function parseVal(val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string' && (val === '[]' || val === '{}')) return val.length === 2 ? (val === '[]' ? [] : {}) : val;
    return val;
  }

  // ---------- App state (pengganti localStorage untuk key rbm_*) ----------

  function getAppState(key) {
    var path = APP_STATE_KEYS[key];
    if (!path) return Promise.resolve(localStorage.getItem(key));
    var localVal = localStorage.getItem(key);
    if (!init()) return Promise.resolve(localVal);
    return db.ref(path).once('value').then(function(snap) {
      var v = snap.val();
      if (v !== undefined && v !== null) return typeof v === 'object' ? JSON.stringify(v) : String(v);
      return localVal;
    }).catch(function() { return localVal; });
  }

  function setAppState(key, value) {
    var path = APP_STATE_KEYS[key];
    try { localStorage.setItem(key, value); } catch (e) {}
    if (!path || !init()) return Promise.resolve();
    var toSet = value;
    try {
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) toSet = JSON.parse(value);
    } catch (e) {}
    return db.ref(path).set(toSet).catch(function(err) { console.warn('firebase-storage setAppState failed', key, err); });
  }

  function removeAppState(key) {
    try { localStorage.removeItem(key); } catch (e) {}
    var path = APP_STATE_KEYS[key];
    if (!path || !init()) return Promise.resolve();
    return db.ref(path).remove().catch(function(err) { console.warn('firebase-storage removeAppState failed', key, err); });
  }

  // ---------- Sesi aktif (satu akun hanya boleh login di satu perangkat) ----------
  function safeUsernameKey(username) {
    return String(username || '').replace(/[.#$[\]]/g, '_') || 'unknown';
  }

  function getActiveSession(username) {
    if (!init() || !username) return Promise.resolve(null);
    var path = 'app_state/active_sessions/' + safeUsernameKey(username);
    return db.ref(path).once('value').then(function(snap) {
      var v = snap.val();
      return v && typeof v === 'object' ? v : null;
    }).catch(function() { return null; });
  }

  function setActiveSession(username, sessionId) {
    if (!username || !sessionId) return Promise.resolve();
    if (!init()) return Promise.resolve();
    var path = 'app_state/active_sessions/' + safeUsernameKey(username);
    var payload = { sessionId: String(sessionId), lastLogin: Date.now() };
    return db.ref(path).set(payload).catch(function(err) { console.warn('firebase-storage setActiveSession failed', err); });
  }

  // ---------- Fitur Online / Presence ----------
  function trackPresence(username, nama, role) {
    if (!init() || !username) return;
    var uid = safeUsernameKey(username);
    var myConnectionsRef = db.ref('app_state/presence/' + uid + '/connections');
    var lastOnlineRef = db.ref('app_state/presence/' + uid + '/lastOnline');
    var infoRef = db.ref('app_state/presence/' + uid + '/info');

    db.ref('.info/connected').on('value', function(snap) {
      if (snap.val() === true) {
        var con = myConnectionsRef.push();
        con.onDisconnect().remove();
        lastOnlineRef.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
        con.set(true);
        infoRef.set({ username: username, nama: nama || username, role: role || 'user', onlineSince: firebase.database.ServerValue.TIMESTAMP });
      }
    });
  }

  // ---------- Absensi & Jadwal (Struktur Partisi Per Bulan) ----------
  function saveAbsensiJadwal(outlet, type, dataObj) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var updates = {};
    Object.keys(dataObj).forEach(function(key) {
         var dateStr = key.split('_')[0];
         if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
             var ym = dateStr.substring(0, 7);
             var val = dataObj[key];
             updates['rbm_pro/' + type + '/' + outlet + '/' + ym + '/' + key] = val === '' ? null : val;
         }
    });
    if (Object.keys(updates).length === 0) return Promise.resolve();
    return db.ref().update(updates);
  }

  function loadAbsensiJadwal(outlet, type, tglAwal, tglAkhir) {
    if (!init()) return Promise.resolve({});
    var ymStart = (tglAwal || '').substring(0, 7);
    var ymEnd = (tglAkhir || '').substring(0, 7);
    if (!ymStart || !ymEnd) return Promise.resolve({});

    var months = [];
    var curr = new Date(ymStart + '-01');
    var end = new Date(ymEnd + '-01');
    while(curr <= end) {
        months.push(curr.getFullYear() + '-' + ('0'+(curr.getMonth()+1)).slice(-2));
        curr.setMonth(curr.getMonth() + 1);
    }
    
    var promises = months.map(function(ym) { return db.ref('rbm_pro/' + type + '/' + outlet + '/' + ym).once('value'); });
    return Promise.all(promises).then(function(snaps) {
        var merged = {};
        snaps.forEach(function(snap) {
            var val = snap.val();
            if (val && typeof val === 'object') Object.assign(merged, val);
        });
        return merged;
    });
  }

  /**
   * Ringkasan khusus halaman Absensi GPS (HP karyawan): sedikit bacaan, mudah di-cache.
   * Path: rbm_pro/gps_kiosk/{outletId}/
   *   roster          → { updatedAt, employees: [{ id, name, sisaAL, sisaDP, sisaPH }] }
   *   day/{yyyy-mm-dd}/cells/{empId} → { j: shift code, a: absensi harian (opsional) }
   *   faces/{empId}   → { name, descriptor: number[], updatedAt }
   * Diisi ulang saat Owner/Manager menyimpan absensi/jadwal/karyawan atau registrasi wajah.
   */
  function gpsKioskBase(outletId) {
    return 'rbm_pro/gps_kiosk/' + String(outletId || 'default').replace(/[.#$\[\]]/g, '_');
  }

  function loadGpsKioskRoster(outletId) {
    if (!init()) return Promise.resolve(null);
    return db.ref(gpsKioskBase(outletId) + '/roster').once('value').then(function(snap) {
      return snap.val();
    });
  }

  function loadGpsKioskDayCells(outletId, dateStr) {
    if (!init()) return Promise.resolve(null);
    return db.ref(gpsKioskBase(outletId) + '/day/' + dateStr + '/cells').once('value').then(function(snap) {
      return snap.val() || {};
    });
  }

  function loadGpsKioskFace(outletId, empId) {
    if (!init()) return Promise.resolve(null);
    return db.ref(gpsKioskBase(outletId) + '/faces/' + String(empId)).once('value').then(function(snap) {
      return snap.val();
    });
  }

  function writeGpsKioskFace(outletId, empId, empName, descriptorArr) {
    if (!init()) return Promise.resolve();
    return db.ref(gpsKioskBase(outletId) + '/faces/' + String(empId)).set({
      name: empName || '',
      descriptor: descriptorArr,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    }).catch(function(e) { console.warn('writeGpsKioskFace failed', e); });
  }

  function deleteGpsKioskFace(outletId, empId) {
    if (!init()) return Promise.resolve();
    return db.ref(gpsKioskBase(outletId) + '/faces/' + String(empId)).remove()
      .catch(function(e) { console.warn('deleteGpsKioskFace failed', e); });
  }

  /** Sinkron roster + snapshot hari ini (saja) untuk kiosk. */
  function syncGpsKioskAfterAbsensiSave(outlet, type, dataObj, employees) {
    if (!init()) return Promise.resolve();
    var o = outlet || 'default';
    var updates = {};
    var now = new Date();
    var today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);

    if (employees && employees.length) {
      updates[gpsKioskBase(o) + '/roster'] = {
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        employees: employees.map(function(e) {
          return {
            id: e.id,
            name: e.name,
            sisaAL: e.sisaAL != null ? e.sisaAL : 0,
            sisaDP: e.sisaDP != null ? e.sisaDP : 0,
            sisaPH: e.sisaPH != null ? e.sisaPH : 0
          };
        })
      };
    }

    if (dataObj && typeof dataObj === 'object') {
      Object.keys(dataObj).forEach(function(k) {
        var m = k.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
        if (!m) return;
        var dateStr = m[1];
        var empPart = m[2];
        if (dateStr !== today) return;
        var val = dataObj[k];
        var basePath = gpsKioskBase(o) + '/day/' + today + '/cells/' + empPart;
        if (type === 'jadwal') {
          updates[basePath + '/j'] = val === '' || val === null ? null : val;
        } else if (type === 'absensi') {
          updates[basePath + '/a'] = val === '' || val === null ? null : val;
        }
      });
    }

    if (Object.keys(updates).length === 0) return Promise.resolve();
    return db.ref().update(updates).catch(function(err) {
      console.warn('syncGpsKioskAfterAbsensiSave failed', err);
    });
  }

  // ---------- GPS Logs (Struktur Partisi Per Bulan) ----------
  function loadGpsLogs(outlet, tglAwal, tglAkhir) {
    if (!init()) return Promise.resolve([]);
    
    var ymStart = (tglAwal || '').substring(0, 7);
    var ymEnd = (tglAkhir || '').substring(0, 7);
    if (!ymStart || !ymEnd) return Promise.resolve([]);

        var months = [];
        var curr = new Date(ymStart + '-01');
        var end = new Date(ymEnd + '-01');
        while(curr <= end) {
            months.push(curr.getFullYear() + '-' + ('0'+(curr.getMonth()+1)).slice(-2));
            curr.setMonth(curr.getMonth() + 1);
        }
        var promises = months.map(function(ym) { return db.ref('rbm_pro/gps_logs_partitioned/' + (outlet || 'default') + '/' + ym).once('value'); });
        return Promise.all(promises).then(function(snaps) {
                var safeOutlet = (outlet || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
                var merged = [];

            snaps.forEach(function(snap) {
                var val = snap.val();
                if (val && typeof val === 'object') {
                    Object.keys(val).forEach(function(k) {
                        var item = val[k];
                        if (item && typeof item === 'object') {
                            item._firebaseKey = k;
                            
                            // [PERFORMA] Jangan upload ulang foto raksasa yang macet, cukup ringankan di tampilan lokal
                            if (item.photo && item.photo.length > 500 && item.photo.indexOf('LAZY_SPLIT_') === -1 && item.photo !== 'LAZY_PHOTO') {
                                item.hasPhoto = true;
                            }
                            
                            if (item.photo === 'LAZY_PHOTO' || item.hasPhoto) {
                                var ymDate = item.date ? item.date.substring(0, 7) : 'unknown';
                                item.photo = "data:image/svg+xml;utf8,<svg id='LAZY_SPLIT_" + safeOutlet + "_" + ymDate + "_" + k + "' xmlns='http://www.w3.org/2000/svg' width='60' height='60'><rect width='60' height='60' fill='lightgray' rx='4'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='11' fill='blue' font-weight='bold'>Lihat Foto</text></svg>";
                            }

                            merged.push(item);
                        }
                    });
                }
            });
            
            return merged.filter(function(l) { return l.date >= tglAwal && l.date <= tglAkhir; });
        });
  }

  // ---------- Petty Cash (logika sama seperti Pembukuan: satu node per tanggal) ----------
  function getPettyCashPath(outletId) {
    var o = outletId || (typeof getRbmOutlet === 'function' && getRbmOutlet()) || (window.getRbmOutlet && window.getRbmOutlet());
    return 'rbm_pro/petty_cash/' + (o ? String(o).replace(/[.#$[\]]/g, '_') : 'default');
  }

  // Index ringan per-bulan (Accurate-style): hanya data list tanpa foto/base64
  // Path: rbm_pro/petty_cash_index/{outlet}/{YYYY-MM}/{pushId} -> { tanggal,nama,jumlah,satuan,harga,debit,kredit,refDate,refIndex }
  function getPettyCashIndexMonthPath(outletId, yyyyMm) {
    var o = outletId || (typeof getRbmOutlet === 'function' && getRbmOutlet()) || (window.getRbmOutlet && window.getRbmOutlet());
    var outletKey = (o ? String(o).replace(/[.#$[\]]/g, '_') : 'default');
    var ym = (yyyyMm || '').toString().trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) return 'rbm_pro/petty_cash_index/' + outletKey;
    return 'rbm_pro/petty_cash_index/' + outletKey + '/' + ym;
  }

  function getPettyCashDatePath(outletId, dateStr) {
    var d = (dateStr || '').toString().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return getPettyCashPath(outletId) + '/' + d;
    try {
      var parts = d.split('/');
      if (parts.length === 3) d = parts[2] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[0]).slice(-2);
    } catch (e) {}
    return getPettyCashPath(outletId) + '/' + (d || Date.now());
  }

  // Summary ringan per-bulan (untuk tampilan Saldo Awal/Akhir & Total Debit/Kredit)
  // Path: rbm_pro/petty_cash_month_summary/{outlet}/{YYYY-MM} -> { saldoAwal,totalDebit,totalKredit,saldoAkhir,updatedAt }
  function getPettyCashMonthSummaryPath(outletId, yyyyMm) {
    var o = outletId || (typeof getRbmOutlet === 'function' && getRbmOutlet()) || (window.getRbmOutlet && window.getRbmOutlet()) || '';
    var outletKey = (o ? String(o).replace(/[.#$[\]]/g, '_') : 'default');
    var ym = (yyyyMm || '').toString().trim();
    return 'rbm_pro/petty_cash_month_summary/' + outletKey + '/' + ym;
  }

  function _daysInMonth(yyyyMm) {
    try {
      var y = parseInt(yyyyMm.slice(0, 4), 10);
      var m = parseInt(yyyyMm.slice(5, 7), 10);
      return new Date(y, m, 0).getDate();
    } catch (e) { return 31; }
  }

  function _prevYm(yyyyMm) {
    if (!/^\d{4}-\d{2}$/.test(yyyyMm || '')) return '';
    var y = parseInt(yyyyMm.slice(0, 4), 10);
    var m = parseInt(yyyyMm.slice(5, 7), 10);
    m -= 1;
    if (m <= 0) { y -= 1; m = 12; }
    return y + '-' + ('0' + m).slice(-2);
  }

  function buildPettyCashMonthSummary(yyyyMm, outletId, depth) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var ym = (yyyyMm || '').toString().trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) return Promise.reject(new Error('Format bulan harus YYYY-MM'));
    depth = depth || 0;
    var maxDepth = 6;

    var from = ym + '-01';
    var to = ym + '-' + ('0' + _daysInMonth(ym)).slice(-2);
    var summaryPath = getPettyCashMonthSummaryPath(outletId, ym);

    // Saldo awal: ambil dari saldo akhir bulan sebelumnya (kalau ada)
    var prev = _prevYm(ym);
    var prevPath = prev ? getPettyCashMonthSummaryPath(outletId, prev) : '';

    return (prevPath ? db.ref(prevPath).once('value').then(function(s) { return s.val(); }).catch(function() { return null; }) : Promise.resolve(null))
      .then(function(prevSummary) {
        // [FIX] Kalau summary bulan sebelumnya belum ada, build dulu biar saldoAwal nyambung.
        if ((!prevSummary || typeof prevSummary !== 'object' || prevSummary.saldoAkhir == null) && prev && depth < maxDepth) {
          return buildPettyCashMonthSummary(prev, outletId, depth + 1).catch(function() { return null; });
        }
        return prevSummary;
      })
      .then(function(prevSummary2) {
        var saldoAwal = prevSummary2 && typeof prevSummary2 === 'object' ? (parseFloat(prevSummary2.saldoAkhir) || 0) : 0;
        var path = getPettyCashPath(outletId);
        var q = db.ref(path).orderByKey().startAt(from).endAt(to);
        return q.once('value').then(function(snap) {
          var root = snap.val();
          if (!root || typeof root !== 'object') root = {};
          // Normalisasi kalau outlet nested
          var oid = (outletId || '').toString().trim();
          if (oid && root[oid] && typeof root[oid] === 'object') root = root[oid];
          else if (!Array.isArray(root.transactions) && Object.keys(root).length === 1) {
            var onlyKey = Object.keys(root)[0];
            if (root[onlyKey] && typeof root[onlyKey] === 'object') root = root[onlyKey];
          }

          var totalDebit = 0, totalKredit = 0;
          var runningSaldo = saldoAwal;
          Object.keys(root).sort().forEach(function(dateKey) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
            var node = root[dateKey];
            var arr = node && Array.isArray(node.transactions) ? node.transactions : (node && node.transactions && typeof node.transactions === 'object' ? Object.values(node.transactions) : []);
            for (var i = 0; i < arr.length; i++) {
              var r = arr[i] || {};
              var debit = parseFloat(r.debit || r.keluar || 0) || 0;
              var kredit = parseFloat(r.kredit || r.masuk || 0) || 0;
              totalDebit += debit;
              totalKredit += kredit;
              runningSaldo = runningSaldo - debit + kredit;
            }
          });

          function writeSummary(p) {
            return db.ref(summaryPath).set(p).then(function() { return p; });
          }
          var payload = {
            saldoAwal: saldoAwal,
            totalDebit: totalDebit,
            totalKredit: totalKredit,
            saldoAkhir: runningSaldo,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
          };
          // [FIX] List halaman pakai petty_cash_index; kalau node per-tanggal kosong/tidak sinkron, agregasi dari index.
          if (totalDebit > 0 || totalKredit > 0) {
            return writeSummary(payload);
          }
          var idxPath = getPettyCashIndexMonthPath(outletId, ym);
          return db.ref(idxPath).once('value').then(function(idxSnap) {
            var idxObj = idxSnap.val();
            var td = 0, tk = 0;
            if (idxObj && typeof idxObj === 'object') {
              Object.keys(idxObj).forEach(function(k) {
                var r = idxObj[k] || {};
                td += parseFloat(r.debit || 0) || 0;
                tk += parseFloat(r.kredit || 0) || 0;
              });
            }
            if (td === 0 && tk === 0) {
              return writeSummary(payload);
            }
            var run = saldoAwal - td + tk;
            return writeSummary({
              saldoAwal: saldoAwal,
              totalDebit: td,
              totalKredit: tk,
              saldoAkhir: run,
              updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
          });
        });
      });
  }

  function getPettyCashMonthSummary(yyyyMm, outletId) {
    if (!init()) return Promise.resolve({ saldoAwal: 0, totalDebit: 0, totalKredit: 0, saldoAkhir: 0 });
    var ym = (yyyyMm || '').toString().trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) return Promise.resolve({ saldoAwal: 0, totalDebit: 0, totalKredit: 0, saldoAkhir: 0 });
    var path = getPettyCashMonthSummaryPath(outletId, ym);
    return db.ref(path).once('value').then(function(snap) {
      var v = snap.val();
      if (v && typeof v === 'object' && (v.totalDebit != null || v.totalKredit != null || v.saldoAkhir != null)) {
        var td = parseFloat(v.totalDebit);
        var tk = parseFloat(v.totalKredit);
        if (!isFinite(td)) td = 0;
        if (!isFinite(tk)) tk = 0;
        var sak = parseFloat(v.saldoAkhir);
        var saw = parseFloat(v.saldoAwal);
        if (!isFinite(saw)) saw = 0;
        if (td !== 0 || tk !== 0) return v;
        // debit & kredit 0: bisa bulan tanpa transaksi (saldo tetap) atau summary salah yang tersimpan {0,0,0}
        if (isFinite(sak) && (sak !== 0 || saw !== 0)) return v;
        return buildPettyCashMonthSummary(ym, outletId, 0);
      }
      return buildPettyCashMonthSummary(ym, outletId, 0);
    }).catch(function() {
      return buildPettyCashMonthSummary(ym, outletId, 0).catch(function() {
        return { saldoAwal: 0, totalDebit: 0, totalKredit: 0, saldoAkhir: 0 };
      });
    });
  }

  function normalizeDateKeyToYyyyMmDd(keyOrDate) {
    var s = (keyOrDate == null ? '' : keyOrDate).toString().trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      var p = s.split('/');
      return p[2] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2);
    }
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
      var parts = s.split('-');
      return parts[0] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[2]).slice(-2);
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
      var p2 = s.split('-');
      return p2[2] + '-' + ('0' + p2[1]).slice(-2) + '-' + ('0' + p2[0]).slice(-2);
    }
    try {
      var d = new Date(s);
      if (!isNaN(d.getTime())) return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    } catch (e) {}
    return s;
  }

  function getPettyCash(tanggalAwal, tanggalAkhir, outletId) {
    if (!init()) return Promise.resolve({ data: [], summary: { totalDebit: 0, totalKredit: 0, saldoAkhir: 0 } });
    var path = getPettyCashPath(outletId);
    
    var tglAwalStr = normalizeDateKeyToYyyyMmDd(tanggalAwal) || '';
    var tglAkhirStr = (tanggalAkhir || '').toString().trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tglAkhirStr)) tglAkhirStr = normalizeDateKeyToYyyyMmDd(tglAkhirStr) || '';
    
    var query = db.ref(path).orderByKey();
    
    // [SUPER OPTIMASI] Hanya unduh data bulan ini saja untuk mempercepat loading.
    // Catatan: Saldo Awal historis dari bulan lalu tidak akan terakumulasi dengan cara ini, 
    // namun loading data akan menjadi 2x lebih cepat.
    if (tglAwalStr) {
        query = query.startAt(tglAwalStr);
    }
    if (tglAkhirStr) query = query.endAt(tglAkhirStr); // Filter data masa depan agar query lebih cepat
    
    return query.once('value').then(function(snap) {
      var root = snap.val();
      if (!root || typeof root !== 'object') root = {};
      var oid = (outletId || '').toString().trim();
      if (oid && root[oid] && typeof root[oid] === 'object') root = root[oid];
      else if (!Array.isArray(root.transactions) && Object.keys(root).length === 1) {
        var onlyKey = Object.keys(root)[0];
        if (root[onlyKey] && typeof root[onlyKey] === 'object') root = root[onlyKey];
      }
      var tglAwal = tglAwalStr ? new Date(tglAwalStr) : null;
      var tglAkhir = tglAkhirStr ? new Date(tglAkhirStr) : null;
      if (tglAkhir) tglAkhir.setHours(23, 59, 59, 999);
      var filtered = [];
      var totalDebit = 0, totalKredit = 0;
      var saldoAwal = 0;
      var runningSaldo = 0;
      var allKeys = Object.keys(root);
      var dateKeys = allKeys.filter(function(k) {
        if (k === 'transactions') return false;
        var node = root[k];
        if (!node || typeof node !== 'object') return false;
        var hasTransactions = Array.isArray(node.transactions) || (node.transactions && typeof node.transactions === 'object');
        if (!hasTransactions) return false;
        return true;
      });
      if (dateKeys.length === 0 && Array.isArray(root.transactions)) {
        var legacyList = root.transactions;
        legacyList.forEach(function(row, idx) {
          var t = row.tanggal || row.date;
          if (!t) return;
          var d = t instanceof Date ? t : new Date(t);
          d.setHours(0, 0, 0, 0);
          var dateKey = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
          if (tglAwal && d < tglAwal) return;
          if (tglAkhir && d > tglAkhir) return;
          var debit = parseFloat(row.debit || row.keluar || 0) || 0;
          var kredit = parseFloat(row.kredit || row.masuk || 0) || 0;
          runningSaldo = (parseFloat(row.saldo) || runningSaldo) - debit + kredit;
          filtered.push({
            no: filtered.length + 1,
            tanggal: row.tanggalStr || (d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()),
            nama: row.nama,
            jumlah: row.jumlah,
            satuan: row.satuan || '',
            harga: row.harga,
            debit: debit,
            kredit: kredit,
            saldo: runningSaldo,
            // [SUPER OPTIMASI] Jangan kirim foto (base64/url) ke UI list
            hasFoto: !!row.foto,
            foto: ''
          });
          totalDebit += debit;
          totalKredit += kredit;
        });
        var saldoAkhirLegacy = filtered.length ? (filtered[filtered.length - 1].saldo || 0) : 0;
        return { data: filtered, summary: { totalDebit: totalDebit, totalKredit: totalKredit, saldoAkhir: saldoAkhirLegacy } };
      }
      dateKeys.sort();
      dateKeys.forEach(function(dateKey) {
        var node = root[dateKey];
        var effectiveDate = normalizeDateKeyToYyyyMmDd(node.tanggal || dateKey);
        var arr = node && Array.isArray(node.transactions) ? node.transactions : (node && node.transactions && typeof node.transactions === 'object' ? Object.values(node.transactions) : []);
        
        // Jika tanggal sebelum periode, akumulasi ke Saldo Awal
        if (tglAwalStr && effectiveDate && effectiveDate < tglAwalStr) {
          arr.forEach(function(row) {
            var debit = parseFloat(row.debit || row.keluar || 0) || 0;
            var kredit = parseFloat(row.kredit || row.masuk || 0) || 0;
            saldoAwal = saldoAwal - debit + kredit;
          });
          return;
        }
        
        // Jika tanggal setelah periode, abaikan
        if (tglAkhirStr && effectiveDate && effectiveDate > tglAkhirStr) return;

        if (filtered.length === 0) runningSaldo = saldoAwal;

        arr.forEach(function(row, idxInDate) {
          var t = row.tanggal || row.date || dateKey;
          var d = t instanceof Date ? t : new Date(t);
          d.setHours(0, 0, 0, 0);
          var debit = parseFloat(row.debit || row.keluar || 0) || 0;
          var kredit = parseFloat(row.kredit || row.masuk || 0) || 0;
          runningSaldo = (parseFloat(row.saldo) || runningSaldo) - debit + kredit;
          filtered.push({
            no: filtered.length + 1,
            tanggal: row.tanggalStr || (d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()),
            nama: row.nama,
            jumlah: row.jumlah,
            satuan: row.satuan || '',
            harga: row.harga,
            debit: debit,
            kredit: kredit,
            saldo: runningSaldo,
            // [SUPER OPTIMASI] Jangan kirim foto (base64/url) ke UI list
            hasFoto: !!row.foto,
            foto: '',
            _firebaseDate: dateKey,
            _firebaseIndexInDate: idxInDate
          });
          totalDebit += debit;
          totalKredit += kredit;
        });
      });
      var saldoAkhir = filtered.length ? (filtered[filtered.length - 1].saldo || 0) : saldoAwal;
      return { data: filtered, summary: { totalDebit: totalDebit, totalKredit: totalKredit, saldoAkhir: saldoAkhir, saldoAwal: saldoAwal } };
    }).catch(function(err) {
      console.warn('getPettyCash failed', err);
      return { data: [], summary: {} };
    });
  }

  /**
   * Server-side style paging untuk Petty Cash (Firebase RTDB).
   * - Tidak pakai OFFSET (RTDB tidak efisien), pakai cursor.
   * - Ambil tanggal per-batch, stop setelah cukup `limit` baris.
   *
   * cursor format:
   *  - null untuk halaman pertama
   *  - { dateKey: 'YYYY-MM-DD', indexInDate: 0 } untuk lanjut dari posisi itu (exclusive)
   */
  function getPettyCashPage(params) {
    if (!init()) return Promise.resolve({ data: [], summary: { totalDebit: 0, totalKredit: 0, saldoAkhir: 0, saldoAwal: 0 }, page: { limit: 20, nextCursor: null } });
    params = params || {};
    var outletId = params.outletId;
    var tanggalAwal = params.from;
    var tanggalAkhir = params.to;
    var search = (params.search || '').toString().trim().toLowerCase();
    var limit = parseInt(params.limit, 10) || 20;
    if (limit < 20) limit = 20;
    if (limit > 50) limit = 50;
    var cursor = params.cursor || null;
    // Paging order: default ASC (lama->baru). Untuk "data terbaru dulu" pakai DESC.
    var order = (params.order || params.sort || '').toString().trim().toLowerCase();
    var desc = (order === 'desc' || order === 'descending' || order === 'newest');

    var tglAwalStr = normalizeDateKeyToYyyyMmDd(tanggalAwal) || '';
    var tglAkhirStr = (tanggalAkhir || '').toString().trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tglAkhirStr)) tglAkhirStr = normalizeDateKeyToYyyyMmDd(tglAkhirStr) || '';

    function runSlowPath() {
      var path = getPettyCashPath(outletId);

      // Ambil tanggal batch kecil dulu (biar responsif)
      // [OPTIMASI] Jangan ambil terlalu banyak tanggal sekaligus.
      // Untuk data jutaan, 1-2 tanggal saja sudah cukup untuk isi 20 baris pertama.
      // [FIX] Jangan terlalu kecil: jika limit minta 50, 2 tanggal bisa cuma jadi ~20 baris.
      // Perkiraan kepadatan transaksi per tanggal bervariasi, jadi pakai scaling sederhana dan cap agar aman.
      var batchDates = Math.min(10, Math.max(2, Math.ceil(limit / 20) * 2));
      var q = db.ref(path).orderByKey();
      // [FIX] Firebase query hanya boleh punya satu startAt
      // Kalau cursor aktif, startAt harus dari cursor saja.
      if (tglAwalStr && !(cursor && cursor.dateKey)) q = q.startAt(tglAwalStr);
      if (tglAkhirStr) q = q.endAt(tglAkhirStr);

      // cursor paging berbasis dateKey: mulai dari cursor.dateKey (inclusive), nanti kita skip manual
      if (cursor && cursor.dateKey) q = q.startAt(cursor.dateKey);
      q = q.limitToFirst(batchDates);

      function slimRow(row, runningSaldo, dateKey, idxInDate, no) {
        var nama = (row.nama || '').toString();
        var debit = parseFloat(row.debit || row.keluar || 0) || 0;
        var kredit = parseFloat(row.kredit || row.masuk || 0) || 0;
        return {
          no: no,
          tanggal: row.tanggalStr || row.tanggal || row.date || dateKey,
          nama: nama,
          jumlah: row.jumlah,
          satuan: row.satuan || '',
          harga: row.harga,
          debit: debit,
          kredit: kredit,
          saldo: runningSaldo,
          hasFoto: !!row.foto,
          foto: '',
          _firebaseDate: dateKey,
          _firebaseIndexInDate: idxInDate
        };
      }

      return q.once('value').then(function(snap) {
        var root = snap.val();
        if (!root || typeof root !== 'object') root = {};

        // Normalisasi kalau outlet nested
        var oid = (outletId || '').toString().trim();
        if (oid && root[oid] && typeof root[oid] === 'object') root = root[oid];
        else if (!Array.isArray(root.transactions) && Object.keys(root).length === 1) {
          var onlyKey = Object.keys(root)[0];
          if (root[onlyKey] && typeof root[onlyKey] === 'object') root = root[onlyKey];
        }

        var dateKeys = Object.keys(root).filter(function(k) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
          var node = root[k];
          if (!node || typeof node !== 'object') return false;
          var hasTransactions = Array.isArray(node.transactions) || (node.transactions && typeof node.transactions === 'object');
          return !!hasTransactions;
        }).sort();

        if (dateKeys.length === 0) return { data: [], summary: { totalDebit: 0, totalKredit: 0, saldoAkhir: 0, saldoAwal: 0 }, page: { limit: limit, nextCursor: null } };

        var rows = [];
        var totalDebit = 0, totalKredit = 0;
        var runningSaldo = 0; // saldo berjalan untuk halaman ini (bukan seluruh histori)
        var started = !cursor;
        var nextCursor = null;

        for (var dkIdx = 0; dkIdx < dateKeys.length; dkIdx++) {
          var dateKey = dateKeys[dkIdx];
          var node = root[dateKey];
          var arr = node && Array.isArray(node.transactions) ? node.transactions : (node && node.transactions && typeof node.transactions === 'object' ? Object.values(node.transactions) : []);
          for (var i = 0; i < arr.length; i++) {
            if (!started) {
              if (dateKey === cursor.dateKey) {
                if (i <= (parseInt(cursor.indexInDate, 10) || 0)) continue;
                started = true;
              } else {
                started = true;
              }
            }

            var r = arr[i] || {};
            var namaLower = ((r.nama || '') + '').toLowerCase();
            var debit = parseFloat(r.debit || r.keluar || 0) || 0;
            var kredit = parseFloat(r.kredit || r.masuk || 0) || 0;
            runningSaldo = (parseFloat(r.saldo) || runningSaldo) - debit + kredit;
            totalDebit += debit;
            totalKredit += kredit;

            if (search && namaLower.indexOf(search) < 0) continue;
            rows.push(slimRow(r, runningSaldo, dateKey, i, rows.length + 1));
            nextCursor = { dateKey: dateKey, indexInDate: i };
            if (rows.length >= limit) break;
          }
          if (rows.length >= limit) break;
        }

        if (rows.length === 0) nextCursor = null;

        return {
          data: rows,
          summary: { totalDebit: totalDebit, totalKredit: totalKredit, saldoAkhir: rows.length ? (rows[rows.length - 1].saldo || 0) : 0, saldoAwal: 0 },
          page: { limit: limit, nextCursor: nextCursor }
        };
      }).catch(function(err) {
        console.warn('getPettyCashPage failed', err);
        return { data: [], summary: {}, page: { limit: limit, nextCursor: null } };
      });
    }

    // ===== FAST PATH: baca index ringan per-bulan (muat bulan jadi sangat cepat) =====
    var ym = (tglAwalStr && /^\d{4}-\d{2}-\d{2}$/.test(tglAwalStr)) ? tglAwalStr.slice(0, 7) : '';
    if (ym && /^\d{4}-\d{2}$/.test(ym)) {
      var idxPath = getPettyCashIndexMonthPath(outletId, ym);
      var summaryPath = getPettyCashMonthSummaryPath(outletId, ym);

      return Promise.all([
        db.ref(summaryPath).once('value'),
        db.ref(idxPath).orderByKey().once('value')
      ]).then(function(snaps) {
        var sumObj = snaps[0].val() || {};
        var obj = snaps[1].val();
        if (!obj || typeof obj !== 'object') return null; // fallback ke slow path

        // [FIX] Kalau index masih pakai format lama (i tidak di-padding), cursor berbasis orderByKey bisa loncat.
        // Deteksi cepat: semua suffix setelah '_' harus panjang 6.
        var keysRaw = Object.keys(obj);
        for (var qi = 0; qi < keysRaw.length; qi++) {
          var k = keysRaw[qi];
          var parts = String(k).split('_');
          if (parts.length !== 2) return null;
          // parts[1] = refIndex
          if (!/^\d{6}$/.test(parts[1])) return null;
        }

        var keys = keysRaw.sort();
        var saldoAwal = parseFloat(sumObj.saldoAwal) || 0;
        var runningSaldo = saldoAwal;
        var finalSaldoAkhir = saldoAwal;
        
        var allRows = [];
        var totalDebit = 0, totalKredit = 0;

        // Iterasi berurutan dari awal bulan untuk menghitung saldo berjalan yang akurat
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          var r = obj[k] || {};
          var tgl = normalizeDateKeyToYyyyMmDd(r.tanggal || '');
          
          var debit = parseFloat(r.debit || 0) || 0;
          var kredit = parseFloat(r.kredit || 0) || 0;
          
          runningSaldo = runningSaldo - debit + kredit;
          
          if (tglAkhirStr && tgl && tgl > tglAkhirStr) continue;
          
          finalSaldoAkhir = runningSaldo;
          
          if (tglAwalStr && tgl && tgl < tglAwalStr) continue;
          var nama = (r.nama || '').toString();
          if (search && nama.toLowerCase().indexOf(search) < 0) continue;
          
          totalDebit += debit;
          totalKredit += kredit;
          
          allRows.push({
            tanggal: r.tanggal || tgl,
            nama: nama,
            jumlah: r.jumlah,
            satuan: r.satuan || '',
            harga: r.harga,
            debit: debit,
            kredit: kredit,
            saldo: runningSaldo,
            hasFoto: false,
            foto: '',
            _firebaseDate: r.refDate || tgl,
            _firebaseIndexInDate: (r.refIndex != null ? r.refIndex : 0),
            _indexKey: k
          });
        }

        if (desc) allRows.reverse();

        var startIndex = 0;
        if (cursor && cursor.key) {
          var pos = allRows.findIndex(function(x) { return x._indexKey === cursor.key; });
          if (pos >= 0) startIndex = pos + 1;
        }

        var pageRows = allRows.slice(startIndex, startIndex + limit);
        
        for (var j = 0; j < pageRows.length; j++) {
            pageRows[j].no = startIndex + j + 1;
        }

        var nextCursor = null;
        if (startIndex + limit < allRows.length) {
          nextCursor = { key: pageRows[pageRows.length - 1]._indexKey };
        }

        return {
          data: pageRows,
          summary: { totalDebit: totalDebit, totalKredit: totalKredit, saldoAkhir: finalSaldoAkhir, saldoAwal: saldoAwal },
          page: { limit: limit, nextCursor: nextCursor }
        };
      }).then(function(res) {
        return res || runSlowPath();
      }).catch(function() {
        return runSlowPath();
      });
    }

    return runSlowPath();
  }

  // ---------- Admin Tools: Purge Foto/Bukti (hapus permanen) ----------
  function _isOwnerOrDev() {
    try {
      var u = JSON.parse(localStorage.getItem('rbm_user') || '{}');
      var un = (u.username || '').toString().toLowerCase();
      return u.role === 'owner' || un === 'burhan';
    } catch (e) { return false; }
  }

  function purgePettyCashPhotos(tglAwal, tglAkhir, outletId) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    if (!_isOwnerOrDev()) return Promise.reject(new Error('Akses ditolak (Owner/Developer saja)'));
    var path = getPettyCashPath(outletId);
    var from = normalizeDateKeyToYyyyMmDd(tglAwal) || '';
    var to = normalizeDateKeyToYyyyMmDd(tglAkhir) || '';
    var q = db.ref(path).orderByKey();
    if (from) q = q.startAt(from);
    if (to) q = q.endAt(to);
    return q.once('value').then(function(snap) {
      var root = snap.val();
      if (!root || typeof root !== 'object') return { updated: 0 };
      var updates = {};
      var updated = 0;
      Object.keys(root).forEach(function(dateKey) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
        var node = root[dateKey];
        if (!node || typeof node !== 'object') return;
        var tx = node.transactions;
        if (Array.isArray(tx)) {
          for (var i = 0; i < tx.length; i++) {
            if (tx[i] && tx[i].foto) {
              updates[path + '/' + dateKey + '/transactions/' + i + '/foto'] = null;
              updated++;
            }
          }
        } else if (tx && typeof tx === 'object') {
          Object.keys(tx).forEach(function(k) {
            if (tx[k] && tx[k].foto) {
              updates[path + '/' + dateKey + '/transactions/' + k + '/foto'] = null;
              updated++;
            }
          });
        }
      });
      if (Object.keys(updates).length === 0) return { updated: 0 };
      return db.ref().update(updates).then(function() { return { updated: updated }; });
    });
  }

  // Bangun index ringan untuk data LAMA agar "muat bulan" instan.
  // Idempotent: key index = YYYY-MM-DD_idxInDate (aman dijalankan ulang).
  function buildPettyCashMonthIndex(yyyyMm, outletId) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    if (!_isOwnerOrDev()) return Promise.reject(new Error('Akses ditolak (Owner/Developer saja)'));
    var ym = (yyyyMm || '').toString().trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) return Promise.reject(new Error('Format bulan harus YYYY-MM'));

    var from = ym + '-01';
    var endDay = new Date(parseInt(ym.slice(0, 4), 10), parseInt(ym.slice(5, 7), 10), 0).getDate();
    var to = ym + '-' + ('0' + endDay).slice(-2);

    var path = getPettyCashPath(outletId);
    var idxBase = getPettyCashIndexMonthPath(outletId, ym);
    var q = db.ref(path).orderByKey().startAt(from).endAt(to);

    return q.once('value').then(function(snap) {
      var root = snap.val();
      if (!root || typeof root !== 'object') return { indexed: 0, dates: 0 };

      var updates = {};
      var indexed = 0;
      var dates = 0;
      var runningSaldo = 0;

      Object.keys(root).sort().forEach(function(dateKey) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
        var node = root[dateKey];
        if (!node || typeof node !== 'object') return;
        var arr = node && Array.isArray(node.transactions) ? node.transactions : (node && node.transactions && typeof node.transactions === 'object' ? Object.values(node.transactions) : []);
        if (!arr || arr.length === 0) return;
        dates++;

        for (var i = 0; i < arr.length; i++) {
          var r = arr[i] || {};
          var debit = parseFloat(r.debit || r.keluar || 0) || 0;
          var kredit = parseFloat(r.kredit || r.masuk || 0) || 0;
          runningSaldo = (parseFloat(r.saldo) || runningSaldo) - debit + kredit;

          // Idempotent & urut: pad angka biar lexicographic == chronological
          var refIndexPadded = ('000000' + i).slice(-6);
          var key = dateKey + '_' + refIndexPadded;
          updates[idxBase + '/' + key] = {
            tanggal: dateKey,
            nama: (r.nama || '').toString(),
            jumlah: r.jumlah,
            satuan: r.satuan || '',
            harga: r.harga,
            debit: debit,
            kredit: kredit,
            saldo: runningSaldo,
            refDate: dateKey,
            refIndex: i
          };
          indexed++;
        }
      });

      if (Object.keys(updates).length === 0) return { indexed: 0, dates: 0 };

      // Batasi ukuran update per batch untuk menghindari request terlalu besar
      var keys = Object.keys(updates);
      var batchSize = 800;
      var idx = 0;
      function next() {
        if (idx >= keys.length) return Promise.resolve({ indexed: indexed, dates: dates });
        var part = {};
        for (var j = 0; j < batchSize && idx < keys.length; j++, idx++) {
          var k = keys[idx];
          part[k] = updates[k];
        }
        return db.ref().update(part).then(next);
      }
      return next();
    });
  }

  function purgePembukuanPhotos(tglAwal, tglAkhir, outletId) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    if (!_isOwnerOrDev()) return Promise.reject(new Error('Akses ditolak (Owner/Developer saja)'));
    var base = getPembukuanPath(outletId);
    var from = normalizeDateKeyToYyyyMmDd(tglAwal) || '';
    var to = normalizeDateKeyToYyyyMmDd(tglAkhir) || '';
    var q = db.ref(base).orderByKey();
    if (from) q = q.startAt(from);
    if (to) q = q.endAt(to);
    return q.once('value').then(function(snap) {
      var all = snap.val();
      if (!all || typeof all !== 'object') return { updated: 0 };
      var updates = {};
      var updated = 0;
      Object.keys(all).forEach(function(dateKey) {
        var p = all[dateKey];
        if (!p || typeof p !== 'object') return;
        var arr = p.kasKeluar;
        if (Array.isArray(arr)) {
          for (var i = 0; i < arr.length; i++) {
            var it = arr[i];
            if (it && (it.foto || it.fotoUrl)) {
              updates[base + '/' + dateKey + '/kasKeluar/' + i + '/foto'] = null;
              updates[base + '/' + dateKey + '/kasKeluar/' + i + '/fotoUrl'] = null;
              updated++;
            }
          }
        }
      });
      if (Object.keys(updates).length === 0) return { updated: 0 };
      return db.ref().update(updates).then(function() { return { updated: updated }; });
    });
  }

  function purgeGpsLogPhotos(outletId) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    if (!_isOwnerOrDev()) return Promise.reject(new Error('Akses ditolak (Owner/Developer saja)'));
    var o = outletId || (typeof getRbmOutlet === 'function' && getRbmOutlet()) || '';
    var sfx = o ? '_' + String(o).toLowerCase().replace(/[^a-z0-9]/g, '_') : '';
    var safeOutlet = o ? String(o).toLowerCase().replace(/[^a-z0-9_-]/g, '') : 'default';
    
    var oldPath = 'rbm_pro/gps_logs' + sfx;
    var newPhotosPath = 'rbm_pro/gps_logs_photos/' + safeOutlet;

    return db.ref(newPhotosPath).remove().then(function() {
      return db.ref(oldPath).once('value');
    }).then(function(snap) {
      var obj = snap.val();
      if (!obj || typeof obj !== 'object') return { updated: 0 };
      var updates = {};
      var updated = 0;
      Object.keys(obj).forEach(function(k) {
        if (obj[k] && obj[k].photo) {
          updates[oldPath + '/' + k + '/photo'] = null;
          updated++;
        }
      });
      if (Object.keys(updates).length === 0) return { updated: 0 };
      return db.ref().update(updates).then(function() { return { updated: updated }; });
    });
  }

  function savePettyCashTransactions(data, outletId) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var dateStr = (data.tanggal || '').toString().trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      var p = dateStr.split('/');
      dateStr = p[2] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2);
    }
    var path = getPettyCashDatePath(outletId, dateStr);
    var newList = (data.transactions || []).map(function(trx) {
      var nominalPemasukan = parseFloat(trx.total) || parseFloat(trx.harga) || 0;
      var nominalPengeluaran = (parseFloat(trx.jumlah) || 0) * (parseFloat(trx.harga) || 0);
      return {
        tanggal: dateStr,
        date: dateStr,
        nama: trx.nama,
        jumlah: trx.jumlah != null ? trx.jumlah : 1,
        satuan: trx.satuan || '',
        harga: parseFloat(trx.harga) || (data.jenis === 'pemasukan' ? nominalPemasukan : 0),
        keluar: data.jenis === 'pengeluaran' ? nominalPengeluaran : 0,
        masuk: data.jenis === 'pemasukan' ? nominalPemasukan : 0,
        debit: data.jenis === 'pengeluaran' ? nominalPengeluaran : 0,
        kredit: data.jenis === 'pemasukan' ? nominalPemasukan : 0,
        // Petty Cash tidak pakai foto lagi: selalu kosongkan
        foto: '',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
    });
    return db.ref(path).once('value').then(function(snap) {
      var existing = snap.val();
      var existingArr = existing && Array.isArray(existing.transactions) ? existing.transactions : (existing && existing.transactions && typeof existing.transactions === 'object' ? Object.values(existing.transactions) : []);
      var startIdx = existingArr.length;
      existingArr = existingArr.concat(newList);
      return db.ref(path).set({
        tanggal: dateStr,
        transactions: existingArr,
        createdAt: (existing && existing.createdAt) || firebase.database.ServerValue.TIMESTAMP
      }).then(function() {
        // [BARU] Simpan index ringan per-bulan agar "muat bulan" jadi sangat cepat
        var ym = dateStr.slice(0, 7);
        var idxBase = getPettyCashIndexMonthPath(outletId, ym);
        var updates = {};
        for (var i = 0; i < newList.length; i++) {
          var it = newList[i] || {};
          // [FIX] Index key harus urut berdasarkan tanggal+index transaksi
          // agar paging tidak loncat dan per-urutan sesuai awal bulan.
          var refIndex = startIdx + i;
          var refIndexPadded = ('000000' + refIndex).slice(-6);
          var key = dateStr + '_' + refIndexPadded;
          updates[idxBase + '/' + key] = {
            tanggal: dateStr,
            nama: it.nama || '',
            jumlah: it.jumlah,
            satuan: it.satuan || '',
            harga: it.harga,
            debit: it.debit || 0,
            kredit: it.kredit || 0,
            refDate: dateStr,
            refIndex: refIndex
          };
        }
        if (Object.keys(updates).length === 0) return;
        return db.ref().update(updates).catch(function(e) { console.warn('petty_cash_index update failed', e); });
      });
      }).then(function() {
        // Update summary bulan ini (ringan) agar tampilan saldo cepat tanpa scan besar
        try {
          var ym = dateStr.slice(0, 7);
          return buildPettyCashMonthSummary(ym, outletId).catch(function() {});
        } catch (e) {}
      }).then(function() { return '✅ Transaksi petty cash disimpan di Firebase.'; });
  }

  /** Setelah ubah/hapus transaksi di petty_cash/{tanggal}, bangun ulang entri index bulan ini agar list (fast path) konsisten. */
  function syncPettyCashIndexForDate(outletId, dateStr) {
    if (!init()) return Promise.resolve();
    var d = normalizeDateKeyToYyyyMmDd(dateStr) || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return Promise.resolve();
    var ym = d.slice(0, 7);
    var idxBase = getPettyCashIndexMonthPath(outletId, ym);
    var datePath = getPettyCashDatePath(outletId, d);
    return db.ref(idxBase).once('value').then(function(idxSnap) {
      var idxObj = idxSnap.val() || {};
      var updates = {};
      Object.keys(idxObj).forEach(function(k) {
        if (k.indexOf(d + '_') === 0) updates[idxBase + '/' + k] = null;
      });
      return db.ref(datePath).once('value').then(function(dateSnap) {
        var node = dateSnap.val();
        var arr = [];
        if (node && Array.isArray(node.transactions)) arr = node.transactions.slice();
        else if (node && node.transactions && typeof node.transactions === 'object') arr = Object.values(node.transactions);
        for (var i = 0; i < arr.length; i++) {
          var it = arr[i] || {};
          var refIndexPadded = ('000000' + i).slice(-6);
          var key = d + '_' + refIndexPadded;
          var debit = parseFloat(it.debit || it.keluar || 0) || 0;
          var kredit = parseFloat(it.kredit || it.masuk || 0) || 0;
          updates[idxBase + '/' + key] = {
            tanggal: d,
            nama: (it.nama || '').toString(),
            jumlah: it.jumlah != null ? it.jumlah : '',
            satuan: it.satuan || '',
            harga: it.harga,
            debit: debit,
            kredit: kredit,
            refDate: d,
            refIndex: i
          };
        }
        if (Object.keys(updates).length === 0) return Promise.resolve();
        return db.ref().update(updates).catch(function(e) { console.warn('syncPettyCashIndexForDate', e); });
      });
    }).then(function() {
      try { return buildPettyCashMonthSummary(ym, outletId, 0).catch(function() {}); } catch (e) {}
    });
  }

  function deletePettyCashByDateAndIndex(dateStr, indexInDate, outletId) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var path = getPettyCashDatePath(outletId, dateStr);
    var normDate = normalizeDateKeyToYyyyMmDd(dateStr) || dateStr;
    return db.ref(path).once('value').then(function(snap) {
      var node = snap.val();
      var arr = node && Array.isArray(node.transactions) ? node.transactions.slice() : (node && node.transactions && typeof node.transactions === 'object' ? Object.values(node.transactions) : []);
      if (indexInDate < 0 || indexInDate >= arr.length) {
        return Promise.reject(new Error('Index transaksi tidak valid (data mungkin hanya di index — refresh halaman).'));
      }
      arr.splice(indexInDate, 1);
      if (arr.length === 0) return db.ref(path).remove();
      return db.ref(path).set({
        tanggal: node.tanggal || dateStr,
        transactions: arr,
        createdAt: node.createdAt || firebase.database.ServerValue.TIMESTAMP
      });
    }).then(function() {
      return syncPettyCashIndexForDate(outletId, normDate);
    }).then(function() { return '✅ Transaksi petty cash dihapus.'; });
  }

  function getPettyCashFullList(outletId) {
    if (!init()) return Promise.resolve([]);
    var path = getPettyCashPath(outletId);
    return db.ref(path).once('value').then(function(snap) {
      var root = snap.val();
      if (!root || typeof root !== 'object') return [];
      var list = [];
      Object.keys(root).forEach(function(dateKey) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
        var node = root[dateKey];
        var arr = node && Array.isArray(node.transactions) ? node.transactions : (node && node.transactions && typeof node.transactions === 'object' ? Object.values(node.transactions) : []);
        arr.forEach(function(row) { list.push(row); });
      });
      return list;
    });
  }

  function updatePettyCashTransactionByDateAndIndex(dateStr, indexInDate, data, outletId) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var path = getPettyCashDatePath(outletId, dateStr);
    return db.ref(path).once('value').then(function(snap) {
      var node = snap.val();
      var arr = node && Array.isArray(node.transactions) ? node.transactions.slice() : (node && node.transactions && typeof node.transactions === 'object' ? Object.values(node.transactions) : []);
      if (indexInDate < 0 || indexInDate >= arr.length) {
        return Promise.reject(new Error('Index transaksi tidak valid atau data sumber kosong.'));
      }
      var existing = arr[indexInDate] || {};
      arr[indexInDate] = {
        tanggal: data.tanggal != null ? data.tanggal : (existing.tanggal || dateStr),
        date: data.tanggal != null ? data.tanggal : (existing.date || dateStr),
        nama: data.nama != null ? data.nama : existing.nama,
        jumlah: data.jumlah != null ? data.jumlah : existing.jumlah,
        satuan: data.satuan != null ? data.satuan : (existing.satuan || ''),
        harga: data.harga != null ? parseFloat(data.harga) : (parseFloat(existing.harga) || 0),
        debit: data.debit != null ? parseFloat(data.debit) : (parseFloat(existing.debit) || 0),
        kredit: data.kredit != null ? parseFloat(data.kredit) : (parseFloat(existing.kredit) || 0),
        keluar: data.debit != null ? parseFloat(data.debit) : (parseFloat(existing.keluar) || 0),
        masuk: data.kredit != null ? parseFloat(data.kredit) : (parseFloat(existing.masuk) || 0),
        // Petty Cash tidak pakai foto lagi: selalu kosongkan
        foto: '',
        createdAt: existing.createdAt || firebase.database.ServerValue.TIMESTAMP
      };
      return db.ref(path).set({
        tanggal: node.tanggal || dateStr,
        transactions: arr,
        createdAt: node.createdAt || firebase.database.ServerValue.TIMESTAMP
      });
    }).then(function() {
      var nd = normalizeDateKeyToYyyyMmDd(dateStr) || dateStr;
      return syncPettyCashIndexForDate(outletId, nd);
    }).then(function() { return '✅ Transaksi petty cash diperbarui.'; });
  }

  function savePettyCashPengajuan(data) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var o = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || (window.getRbmOutlet && window.getRbmOutlet()) || '';
    var u = JSON.parse(localStorage.getItem('rbm_user') || '{}');
    var userName = u.nama || u.username || 'User';
    var userRole = u.role || 'staff';
    var details = data.details || [];
    var ref = db.ref('rbm_pro/petty_cash/pengajuan');
    return ref.once('value').then(function(snap) {
      var arr = snap.val();
      if (!Array.isArray(arr)) arr = [];
      details.forEach(function(item) {
        var foto = item.fotoPengajuanUrl || (item.fotoPengajuan && item.fotoPengajuan.data ? 'data:' + (item.fotoPengajuan.mimeType || 'image/png') + ';base64,' + item.fotoPengajuan.data : '') || '';
        arr.push({
          tanggalPengajuan: item.tanggalPengajuan,
          nominal: parseFloat(item.nominal) || 0,
          recapData: item.recapData || null,
          fotoPengajuan: foto,
          bank: item.bank || '',
          rekening: item.rekening || '',
          atasnama: item.atasnama || '',
          outlet: o,
          userName: userName,
          userRole: userRole,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        });
      });
      return ref.set(arr);
    }).then(function() { return '✅ Pengajuan petty cash disimpan di Firebase.'; });
  }

  // ---------- Database barang (pengganti Sheet "Database" - simpanDataOnline) ----------

  function saveDatabaseBarang(dataList) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var updates = {};
    dataList.forEach(function(data) {
      var jenis = (data.jenis || '').toLowerCase().replace(/\s/g, '_');
      var key = 'rbm_pro/database_barang/' + jenis + '/' + (Date.now() + '_' + Math.random().toString(36).slice(2));
      updates[key] = {
        tanggal: data.tanggal,
        nama: data.nama,
        jumlah: data.jumlah,
        barangjadi: data.barangjadi || '',
        keteranganRusak: data.keteranganRusak || '',
        fotoRusak: data.fotoRusakUrl || data.fotoRusak || '',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
    });
    return db.ref().update(updates).then(function() { return '✅ Data barang disimpan di Firebase.'; });
  }

  // ---------- Inventaris (pengganti simpanDataInventaris) ----------
  function getInventarisPath(outletId) {
    var o = outletId || (typeof getRbmOutlet === 'function' && getRbmOutlet()) || (window.getRbmOutlet && window.getRbmOutlet()) || '';
    return 'rbm_pro/inventaris/' + (o || '_default') + '/dates';
  }

  function saveInventaris(dataList, outletId) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    if (!dataList.length) return Promise.resolve('ℹ️ Tidak ada data.');
    var base = getInventarisPath(outletId) + '/';
    var tanggal = dataList[0].tanggal;
    var dateKey = tanggal.replace(/-/g, '_');
    var updates = {};
    dataList.forEach(function(data) {
      updates[base + dateKey + '/' + (data.nama || '').trim()] = parseInt(data.jumlah, 10) || 0;
    });
    return db.ref().update(updates).then(function() { return '✅ Data inventaris disimpan di Firebase.'; });
  }

  function getInventaris(tglAwal, tglAkhir, outletId) {
    if (!init()) return Promise.resolve([]);
    var path = getInventarisPath(outletId);
    var start = tglAwal ? tglAwal.replace(/-/g, '_') : '';
    var end = tglAkhir ? tglAkhir.replace(/-/g, '_') : '';
    var query = db.ref(path).orderByKey();
    if (start) query = query.startAt(start);
    if (end) query = query.endAt(end);
    return query.once('value').then(function(snap) {
      var dates = snap.val();
      if (!dates || typeof dates !== 'object') return [];
      var result = [];
      Object.keys(dates).forEach(function(dateKey) {
        if (tglAwal && dateKey < start) return;
        if (tglAkhir && dateKey > end) return;
        var tanggal = dateKey.replace(/_/g, '-');
        var items = dates[dateKey];
        if (items && typeof items === 'object') {
          Object.keys(items).forEach(function(nama) {
            result.push({ tanggal: tanggal, nama: nama, jumlah: String(items[nama] || 0) });
          });
        }
      });
      return result;
    }).catch(function() { return []; });
  }

  // ---------- Pembukuan (pengganti simpanDataPembukuan - Rekonsiliasi) ----------
  function getPembukuanPath(outletId) {
    var o = outletId || (typeof getRbmOutlet === 'function' && getRbmOutlet()) || (window.getRbmOutlet && window.getRbmOutlet()) || '';
    return 'rbm_pro/pembukuan/' + (o || '_default');
  }

  function savePembukuan(data, outletId) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var o = outletId || '';
    // [FIX PERFORMA/STRUKTUR] selalu simpan per-outlet (hapus jalur flat)
    var key = getPembukuanPath(outletId) + '/' + (data.tanggal || Date.now());

    if (data.isAppend) {
      return db.ref(key).once('value').then(function(snap) {
        var existing = snap.val() || {};
        var kasMasuk = (existing.kasMasuk || []).concat(data.kasMasuk || []);
        var kasKeluar = (existing.kasKeluar || []).concat(data.kasKeluar || []);
        return db.ref(key).set({
          tanggal: data.tanggal,
          kasMasuk: kasMasuk,
          kasKeluar: kasKeluar,
          createdAt: existing.createdAt || firebase.database.ServerValue.TIMESTAMP
        });
      }).then(function() { return '✅ Data pembukuan disimpan di Firebase.'; });
    }

    return db.ref(key).set({
      tanggal: data.tanggal,
      kasMasuk: data.kasMasuk || [],
      kasKeluar: data.kasKeluar || [],
      createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(function() { return '✅ Data pembukuan disimpan di Firebase.'; });
  }

  /** Pola tanggal YYYY-MM-DD untuk deteksi format flat (tanpa subfolder outlet). */
  function isDateKey(key) {
    return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
  }

  function getPembukuan(tglAwal, tglAkhir, outletId) {
    if (!init()) return Promise.resolve([]);
    // [FIX PERFORMA/STRUKTUR] hanya baca format per-outlet (hapus jalur flat)
    var path = getPembukuanPath(outletId);
    var query = db.ref(path);
    if (tglAkhir) {
        query = query.orderByKey().endAt(tglAkhir);
    }
    return query.once('value').then(function(snap) {
      var all = snap.val();
      return parsePembukuanAll(all, null, tglAkhir); // Kirim null agar semua histori terambil untuk kalkulasi saldo awal
    }).catch(function() { return []; });
  }

  function parsePembukuanAll(all, tglAwal, tglAkhir) {
    if (!all || typeof all !== 'object') return [];
    var result = [];
    Object.keys(all).forEach(function(key) {
      var p = all[key];
      if (!p || !p.tanggal) return;
      var t = p.tanggal;
      if (tglAwal && t < tglAwal) return;
      if (tglAkhir && t > tglAkhir) return;
      // [SUPER OPTIMASI] Jangan bawa foto bukti setor (base64/url) saat load list pembukuan.
      // Foto hanya perlu saat user benar-benar membuka detail tertentu.
      var kasMasuk = p.kasMasuk || [];
      var kasKeluar = (p.kasKeluar || []).map(function(kk) {
        if (!kk || typeof kk !== 'object') return kk;
        var o = Object.assign({}, kk);
        if (o.foto) o.foto = '';
        if (o.fotoUrl) o.fotoUrl = '';
        return o;
      });
      result.push({ payload: { tanggal: p.tanggal, kasMasuk: kasMasuk, kasKeluar: kasKeluar } });
    });
    result.sort(function(a, b) { return (a.payload.tanggal || '').localeCompare(b.payload.tanggal || ''); });
    return result;
  }

  function deletePembukuanDay(outletId, tanggal) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var tg = tanggal || '';
    // [FIX PERFORMA/STRUKTUR] selalu hapus per-outlet (hapus jalur flat)
    var path = getPembukuanPath(outletId) + '/' + tg;
    return db.ref(path).remove().then(function() { return '✅ Data pembukuan dihapus.'; });
  }

  // ---------- Pengajuan TF (pengganti simpanDataPengajuanTF) ----------

  function savePengajuanTF(data) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var o = (typeof getRbmOutlet === 'function' && getRbmOutlet()) || (window.getRbmOutlet && window.getRbmOutlet()) || '';
    var u = JSON.parse(localStorage.getItem('rbm_user') || '{}');
    var userName = u.nama || u.username || 'User';
    var userRole = u.role || 'staff';
    var details = data.details || [];
    var ref = db.ref('rbm_pro/pengajuan_tf');
    return ref.once('value').then(function(snap) {
      var arr = snap.val();
      if (!Array.isArray(arr)) arr = [];
      details.forEach(function(item) {
        var fotoNota = item.fotoNotaUrl || (typeof item.fotoNota === 'string' ? item.fotoNota : (item.fotoNota && item.fotoNota.data ? 'data:' + (item.fotoNota.mimeType || 'image/png') + ';base64,' + item.fotoNota.data : ''));
        var fotoTtd = item.fotoTtdUrl || (typeof item.fotoTtd === 'string' ? item.fotoTtd : (item.fotoTtd && item.fotoTtd.data ? 'data:' + (item.fotoTtd.mimeType || 'image/png') + ';base64,' + item.fotoTtd.data : ''));
        arr.push({
          tanggal: item.tanggal,
          suplier: item.suplier,
          tglNota: item.tglNota,
          tglJt: item.tglJt,
          nominal: parseFloat(item.nominal) || 0,
          total: parseFloat(item.total) || 0,
          bankAcc: item.bankAcc,
          atasNama: item.atasNama,
          keterangan: item.keterangan,
          fotoNotaUrl: fotoNota,
          fotoTtdUrl: fotoTtd,
          outlet: o,
          userName: userName,
          userRole: userRole,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        });
      });
      return ref.set(arr);
    }).then(function() { return '✅ Pengajuan TF disimpan di Firebase.'; });
  }

  // ---------- Pengajuan Bukti TF (pengganti simpanDataSudahTF) ----------

  function savePengajuanBuktiTF(data) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var details = data.details || [];
    var ref = db.ref('rbm_pro/pengajuan_bukti_tf');
    return ref.once('value').then(function(snap) {
      var arr = snap.val();
      if (!Array.isArray(arr)) arr = [];
      details.forEach(function(item) {
        var foto = item.fotoBuktiUrl || (typeof item.fotoBukti === 'string' ? item.fotoBukti : (item.fotoBukti && item.fotoBukti.data ? 'data:' + (item.fotoBukti.mimeType || 'image/png') + ';base64,' + item.fotoBukti.data : '')) || '';
        var foto = item.fotoPengajuanUrl || (typeof item.fotoPengajuan === 'string' ? item.fotoPengajuan : (item.fotoPengajuan && item.fotoPengajuan.data ? 'data:' + (item.fotoPengajuan.mimeType || 'image/png') + ';base64,' + item.fotoPengajuan.data : '')) || '';
        arr.push({
          tanggalPengajuan: item.tanggalPengajuan,
          fotoBuktiUrl: foto,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        });
      });
      return ref.set(arr);
    }).then(function() { return '✅ Bukti TF disimpan di Firebase.'; });
  }

  // ---------- Bank (pengganti getDataBankBySuplier) ----------

  function getBankBySuplier(namaSuplier) {
    if (!init()) return Promise.resolve(null);
    return db.ref('rbm_pro/bank').once('value').then(function(snap) {
      var val = snap.val();
      if (!val || typeof val !== 'object') return null;
      var name = (namaSuplier || '').trim().toLowerCase();
      for (var key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key) && key.toLowerCase() === name) {
          var o = val[key];
          return { noRekening: o.noRekening, namaPemilik: o.namaPemilik };
        }
      }
      if (val.nama && val.noRekening && val.namaPemilik) return { noRekening: val.noRekening, namaPemilik: val.namaPemilik };
      return null;
    }).catch(function() { return null; });
  }

  function setBankList(list) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    var obj = {};
    (list || []).forEach(function(item) {
      var nama = (item.nama || item.suplier || '').trim();
      if (nama) obj[nama.toLowerCase()] = { noRekening: item.noRekening || '', namaPemilik: item.namaPemilik || '' };
    });
    return db.ref('rbm_pro/bank').set(obj).then(function() { return '✅ Daftar bank disimpan.'; });
  }

  // ---------- Pending RBM (RBM_PENDING_*) → rbm_pro/pending ----------

  function getPending(type) {
    var path = 'rbm_pro/pending/' + (type || 'PETTY_CASH');
    if (!init()) return Promise.resolve([]);
    return db.ref(path).once('value').then(function(snap) {
      var v = snap.val();
      return Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    }).catch(function() { return []; });
  }

  function setPending(type, value) {
    var key = 'RBM_PENDING_' + (type || 'PETTY_CASH');
    if (!init()) return Promise.resolve();
    return db.ref('rbm_pro/pending/' + (type || 'PETTY_CASH')).set(Array.isArray(value) ? value : []).catch(function(err) { console.warn('setPending failed', err); });
  }

  // ---------- Sync dari Firebase ke localStorage (saat load) ----------
  function syncAppStateFromFirebase() {
    if (!init()) return Promise.resolve();
    var promises = [];
    var isRbmProPage = typeof window !== 'undefined' && window.RBM_PAGE;
    Object.keys(APP_STATE_KEYS).forEach(function(key) {
      // [OPTIMASI KILAT] Jangan buang waktu download konfigurasi kasir saat berada di Dashboard Backoffice RBM
      if (isRbmProPage && (
          key === 'rbm_points_history' || 
          key === 'rbm_vouchers' ||
          key === 'rbm_menu_categories' ||
          key === 'rbm_printer_groups' ||
          key === 'rbm_printer_config' ||
          key === 'rbm_payment_methods' ||
          key === 'rbm_quick_memos'
      )) return; 
      var path = APP_STATE_KEYS[key];
      promises.push(db.ref(path).once('value').then(function(snap) {
        var v = snap.val();
        if (v !== undefined && v !== null) {
          var str = typeof v === 'object' ? JSON.stringify(v) : String(v);
          try { localStorage.setItem(key, str); } catch (e) {}
        }
      }).catch(function() {}));
    });
    return Promise.all(promises);
  }

  // ---------- Patch localStorage: RBM_* HANYA di Firebase (tidak disimpan di localStorage) ----------
  function patchLocalStorageForFirebase() {
    var origSetItem = Storage.prototype.setItem;
    var origRemoveItem = Storage.prototype.removeItem;
    var origGetItem = Storage.prototype.getItem;

    Storage.prototype.setItem = function(key, value) {
      if (key && key.indexOf('RBM_') === 0) {
        if (global.RBMStorage && global.RBMStorage.isUsingFirebase && global.RBMStorage.isUsingFirebase()) {
          try { global.RBMStorage.setItem(key, value); } catch (e) {}
        } else {
          origSetItem.call(this, key, value);
        }
        return;
      }
      origSetItem.call(this, key, value);
      if (!key) return;
      if (key.indexOf('rbm_') === 0 && init()) {
        var path = APP_STATE_KEYS[key];
        if (path) {
          var toSet = value;
          try { if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) toSet = JSON.parse(value); } catch (e) {}
          db.ref(path).set(toSet).catch(function(err) { console.warn('firebase-storage patch setItem failed', key, err); });
        }
      }
    };

    Storage.prototype.getItem = function(key) {
      if (key && key.indexOf('RBM_') === 0 && global.RBMStorage) {
        if (global.RBMStorage.isUsingFirebase && global.RBMStorage.isUsingFirebase()) {
          try {
            var v = global.RBMStorage.getItem(key);
            return v !== null && v !== undefined ? v : null;
          } catch (e) {}
        }
        return origGetItem.call(this, key);
      }
      return origGetItem.call(this, key);
    };

    Storage.prototype.removeItem = function(key) {
      if (key && key.indexOf('RBM_') === 0) {
        if (global.RBMStorage && global.RBMStorage.isUsingFirebase && global.RBMStorage.isUsingFirebase()) {
          try { global.RBMStorage.setItem(key, ''); } catch (e) {}
        } else {
          origRemoveItem.call(this, key);
        }
        return;
      }
      origRemoveItem.call(this, key);
      if (!key) return;
      if (key.indexOf('rbm_') === 0 && init()) {
        var path = APP_STATE_KEYS[key];
        if (path) db.ref(path).remove().catch(function() {});
      }
    };
  }

  /** Jalankan sekali: init, sync dari Firebase, lalu patch localStorage agar semua tulis ke Firebase. */
  function enableFirebaseForAllStorage() {
    init();
    syncAppStateFromFirebase().then(function() { patchLocalStorageForFirebase(); }).catch(function() { patchLocalStorageForFirebase(); });
  }

  // -----------------------------
  // Pengajuan Gaji (ke Owner & Manager)
  // -----------------------------
  function _safeOutletKey(s) {
    return String(s || '').trim().replace(/[.#$[\]]/g, '_') || 'default';
  }

  function _validateMonthKey(ym) {
    return typeof ym === 'string' && /^\d{4}-\d{2}$/.test(ym);
  }

  function getGajiPengajuanSummaryPath(outletId, monthKey) {
    return 'rbm_pro/gaji_pengajuan/' + _safeOutletKey(outletId) + '/' + monthKey;
  }

  function getGajiPengajuanItemsPath(outletId, requestId) {
    return 'rbm_pro/gaji_pengajuan_items/' + _safeOutletKey(outletId) + '/' + requestId;
  }

  function _getUserRole() {
    try {
      var u = JSON.parse(localStorage.getItem('rbm_user') || '{}');
      return u && u.role ? String(u.role).toLowerCase() : '';
    } catch (e) { return ''; }
  }

  async function saveGajiPengajuan(summary, items) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    if (!summary) return Promise.reject(new Error('Ringkasan pengajuan kosong'));

    var outletId = summary.outletId || '';
    var monthKey = summary.monthKey || '';
    if (!_validateMonthKey(monthKey)) return Promise.reject(new Error('monthKey wajib YYYY-MM'));

    var requestId = Date.now() + '_' + Math.random().toString(36).slice(2);
    var createdAt = Date.now();

    var setSummary = {
      periodStart: summary.periodStart || '',
      periodEnd: summary.periodEnd || '',
      requester: summary.requester || '',
      note: summary.note || '',
      totalGrand: summary.totalGrand || 0,
      bank: summary.bank || '',
      rekening: summary.rekening || '',
      atasnama: summary.atasnama || '',
      statusOwner: 'pending',
      statusManager: 'pending',
      approvedOwnerBy: '',
      approvedManagerBy: '',
      approvedOwnerAt: 0,
      approvedManagerAt: 0,
      createdAt: createdAt,
      items: items || []
    };

    var pathSummary = getGajiPengajuanSummaryPath(outletId, monthKey) + '/' + requestId;
    await db.ref(pathSummary).set(setSummary);

    // Simpan item detail terpisah supaya riwayat tidak lambat karena data besar
    var pathItems = getGajiPengajuanItemsPath(outletId, requestId);
    var updatesItems = {};
    if (Array.isArray(items)) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i] || {};
        var empId = it.empId != null ? String(it.empId) : '';
        if (!empId) continue;
        updatesItems[empId] = {
          nama: it.nama || '',
          jabatan: it.jabatan || '',
          grandTotal: it.grandTotal || 0,
          metodeBayar: it.metodeBayar || 'TF'
        };
      }
    }
    if (Object.keys(updatesItems).length) {
      await db.ref(pathItems).set(updatesItems);
    }

    return { requestId: requestId };
  }

  async function getGajiPengajuanPage(outletId, monthKey, limit, cursorKey) {
    if (!init()) return Promise.resolve({ items: [], nextCursorKey: null, hasMore: false });
    if (!_validateMonthKey(monthKey)) return Promise.resolve({ items: [], nextCursorKey: null, hasMore: false });

    limit = parseInt(limit, 10) || 15;

    var pathSummary = getGajiPengajuanSummaryPath(outletId, monthKey);
    var query = db.ref(pathSummary).orderByKey();
    var fetchLimit = limit;

    if (cursorKey) {
      fetchLimit = limit + 1; // untuk deteksi ada data lebih
      query = query.endAt(cursorKey);
    }

    query = query.limitToLast(fetchLimit);

    var snap = await query.once('value');
    var obj = snap.val() || {};
    var entries = Object.keys(obj).map(function(k) { return [k, obj[k]]; });
    entries.sort(function(a, b) { return String(a[0]).localeCompare(String(b[0])); });

    if (cursorKey) entries = entries.filter(function(e) { return e[0] !== cursorKey; });

    var hasMore = entries.length > limit;
    var pageEntries = hasMore ? entries.slice(entries.length - limit) : entries;

    var items = pageEntries.map(function(e) {
      var key = e[0];
      var v = e[1] || {};
      v.requestId = key;
      return v;
    });

    var nextCursorKey = items.length ? items[0].requestId : null;
    return { items: items, nextCursorKey: nextCursorKey, hasMore: hasMore };
  }

  async function setGajiPengajuanApproval(outletId, monthKey, requestId, role) {
    if (!init()) return Promise.reject(new Error('Firebase tidak tersedia'));
    if (!_validateMonthKey(monthKey)) return Promise.reject(new Error('monthKey wajib YYYY-MM'));
    if (!requestId) return Promise.reject(new Error('requestId kosong'));

    role = String(role || '').toLowerCase();
    var currentRole = _getUserRole();
    if (currentRole !== 'owner' && currentRole !== 'manager') {
      return Promise.reject(new Error('Akses ditolak (owner/manager saja)'));
    }
    if ((role === 'owner' && currentRole !== 'owner') || (role === 'manager' && currentRole !== 'manager')) {
      return Promise.reject(new Error('Role tidak cocok untuk approval'));
    }

    var pathSummary = getGajiPengajuanSummaryPath(outletId, monthKey) + '/' + requestId;
    var uName = '';
    try { uName = (JSON.parse(localStorage.getItem('rbm_user') || '{}').username) || ''; } catch(e) {}
    var nowMs = Date.now();

    var updates = {};
    if (role === 'owner') {
      updates.statusOwner = 'approved';
      updates.approvedOwnerBy = uName;
      updates.approvedOwnerAt = nowMs;
    } else if (role === 'manager') {
      updates.statusManager = 'approved';
      updates.approvedManagerBy = uName;
      updates.approvedManagerAt = nowMs;
    } else {
      return Promise.reject(new Error('role approval tidak valid'));
    }

    await db.ref(pathSummary).update(updates);
    return { ok: true };
  }

  // ---------- Export ----------

  var FirebaseStorage = {
    init: init,
    isReady: function() { return useFirebase && db !== null; },
    syncAppStateFromFirebase: syncAppStateFromFirebase,
    patchLocalStorageForFirebase: patchLocalStorageForFirebase,
    enableFirebaseForAllStorage: enableFirebaseForAllStorage,
    saveGajiPengajuan: saveGajiPengajuan,
    getGajiPengajuanPage: getGajiPengajuanPage,
    setGajiPengajuanApproval: setGajiPengajuanApproval,
    getAppState: getAppState,
    setAppState: setAppState,
    removeAppState: removeAppState,
    getActiveSession: getActiveSession,
    setActiveSession: setActiveSession,
    trackPresence: trackPresence,
    saveAbsensiJadwal: saveAbsensiJadwal,
    loadAbsensiJadwal: loadAbsensiJadwal,
    gpsKioskBase: gpsKioskBase,
    loadGpsKioskRoster: loadGpsKioskRoster,
    loadGpsKioskDayCells: loadGpsKioskDayCells,
    loadGpsKioskFace: loadGpsKioskFace,
    writeGpsKioskFace: writeGpsKioskFace,
    deleteGpsKioskFace: deleteGpsKioskFace,
    syncGpsKioskAfterAbsensiSave: syncGpsKioskAfterAbsensiSave,
    loadGpsLogs: loadGpsLogs,
    getPettyCash: getPettyCash,
    getPettyCashPage: getPettyCashPage,
    purgePettyCashPhotos: purgePettyCashPhotos,
    buildPettyCashMonthIndex: buildPettyCashMonthIndex,
    getPettyCashMonthSummary: getPettyCashMonthSummary,
    purgePembukuanPhotos: purgePembukuanPhotos,
    purgeGpsLogPhotos: purgeGpsLogPhotos,
    savePettyCashTransactions: savePettyCashTransactions,
    deletePettyCashByDateAndIndex: deletePettyCashByDateAndIndex,
    getPettyCashFullList: getPettyCashFullList,
    updatePettyCashTransactionByDateAndIndex: updatePettyCashTransactionByDateAndIndex,
    savePettyCashPengajuan: savePettyCashPengajuan,
    saveDatabaseBarang: saveDatabaseBarang,
    saveInventaris: saveInventaris,
    getInventaris: getInventaris,
    savePembukuan: savePembukuan,
    getPembukuan: getPembukuan,
    deletePembukuanDay: deletePembukuanDay,
    savePengajuanTF: savePengajuanTF,
    savePengajuanBuktiTF: savePengajuanBuktiTF,
    getBankBySuplier: getBankBySuplier,
    setBankList: setBankList,
    getPending: getPending,
    setPending: setPending,
    db: function() { return db; },
    APP_STATE_KEYS: APP_STATE_KEYS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FirebaseStorage;
  else global.FirebaseStorage = FirebaseStorage;

  // Otomatis aktifkan: sync dari Firebase + patch localStorage agar semua tulis ke Firebase
  if (global.document && global.addEventListener) {
    function run() { FirebaseStorage.enableFirebaseForAllStorage(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else setTimeout(run, 0);
  }

  // [GLOBAL EVENT] Interceptor untuk memuat Foto GPS Asli yang telah dipisah saat diklik di Tabel (Lazy Loading)
  if (typeof window !== 'undefined' && window.document) {
      document.addEventListener('click', function(e) {
          var target = e.target;
          if (target && target.tagName === 'IMG' && target.src && target.src.indexOf('LAZY_SPLIT_') >= 0) {
              e.preventDefault(); 
              e.stopPropagation();
                    var srcDecoded = target.src;
                    try { srcDecoded = decodeURIComponent(target.src); } catch(err) {}
              var match = srcDecoded.match(/id=['"]LAZY_SPLIT_([^_]+)_([^_]+)_([^'"]+)['"]/);
              if (match) {
                  var outlet = match[1];
                  var ym = match[2];
                  var key = match[3];
                  var modal = document.getElementById('imageModal');
                  var img = document.getElementById('modalImage');
                  if (modal && img) {
                      img.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>Memuat foto...</text></svg>";
                      modal.style.display = 'flex';
                      if (typeof firebase !== 'undefined' && firebase.database) {
                          firebase.database().ref('rbm_pro/gps_logs_photos/' + outlet + '/' + ym + '/' + key).once('value').then(function(snap) {
                              var b64 = snap.val();
                              if (b64) img.src = b64;
                              else img.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='red'>Foto dihapus / tdk ditemukan</text></svg>";
                          }).catch(function(){});
                      }
                  }
              }
          }
      }, true);
  }
})(typeof window !== 'undefined' ? window : this);
