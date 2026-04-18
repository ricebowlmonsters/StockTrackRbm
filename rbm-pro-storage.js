/**
 * RBM Pro Storage: Firebase (Data & Storage) atau fallback localStorage
 * Data tersimpan di Firebase Realtime Database under /rbm_pro dan tampil di halaman Data & Penyimpanan.
 */
(function() {
  var _origSetItem = Storage.prototype.setItem;
  var _origGetItem = Storage.prototype.getItem;

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

  function getConnections() {
    try {
      var stored = localStorage.getItem('rbm_db_connections');
      return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
  }

  function getActiveConnection() {
    var idx = parseInt(localStorage.getItem('rbm_active_connection_index') || '0', 10);
    var conns = getConnections();
    if (conns.length && conns[idx] && conns[idx].config) return conns[idx].config;
    if (conns.length && conns[0].config) return conns[0].config;
    return DEFAULT_FIREBASE_CONFIG;
  }

  function keyToPath(key) {
    if (key.indexOf('RBM_') !== 0) return key.replace(/^RBM_/, '').toLowerCase().replace(/_/g, '_');
    if (key.indexOf('RBM_GAJI_') === 0) return 'gaji/' + key.slice(9);
    if (key.indexOf('RBM_BONUS_') === 0) return 'bonus/' + key.slice(10);
    if (key.indexOf('RBM_JADWAL_NOTE_') === 0) return 'jadwal_notes/' + key.slice(16);
    // Samakan konversi karakter khusus dengan yang ada di loadFromFirebase
    return key.replace(/^RBM_/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  var RBMStorage = {
    _cache: {},
    _db: null,
    _useFirebase: false,
    _readyPromise: null,
    /** Hindari loadFromFirebase ganda berjalan paralel (bikin hang di HP). */
    _loadInflight: null,

    _outletSuffix: function(outletId) {
      var outlet = '';
      try { outlet = (outletId || '').toString().trim(); } catch (_) { outlet = ''; }
      return outlet ? '_' + outlet.toLowerCase().replace(/[^a-z0-9]/g, '_') : '';
    },

    init: function() {
      var conn = getActiveConnection();
      if (!conn) return;
      if (conn.type === 'local' || conn.type === 'server') return;
      try {
        if (typeof firebase === 'undefined') return;
        if (!firebase.apps.length) firebase.initializeApp(conn);
        this._db = firebase.database();
        this._useFirebase = true;
      } catch (e) {
        console.warn('RBM Storage: Firebase init failed', e);
      }
      this._initDevTools(); // [DEV] Cek apakah mode developer aktif
    },

    loadFromFirebase: function() {
      var self = this;
      if (!this._db) {
        this._readyPromise = Promise.resolve();
        return this._readyPromise;
      }
      
      // [PERBAIKAN] Deteksi Outlet Aktif agar Firebase mendownload data yang tepat (misal: employees_sidoarjo)
      var outlet = '';
      try {
         var params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
         var urlOutlet = params ? params.get('outlet') : null;
         if (urlOutlet) outlet = urlOutlet.trim();
         var el = typeof document !== 'undefined' ? document.getElementById('rbm-outlet-select') : null;
         if (!outlet) outlet = (el && el.value) ? el.value : (localStorage.getItem('rbm_last_selected_outlet') || '');
         if (!outlet) {
             var u = JSON.parse(localStorage.getItem('rbm_user') || '{}');
             if (u && u.outlet) outlet = String(u.outlet);
         }
         if (!outlet) {
             var outlets = JSON.parse(localStorage.getItem('rbm_outlets') || '[]');
             if (outlets.length) outlet = outlets[0];
         }
      } catch(e) {}
      var sfx = outlet ? '_' + outlet.toLowerCase().replace(/[^a-z0-9]/g, '_') : '';
      var exactSfx = outlet ? '_' + outlet : '';

      // [PERFORMA KRUSIAL]
      // Sebelumnya kita selalu meload employees/face_data saat buka halaman apa pun.
      // Akibatnya: Petty Cash / Inventaris / Pembukuan bisa LEMOT walau outlet kosong (karena node ini bisa sangat besar).
      // Sekarang: default minimal, lalu tambah node hanya jika halaman memang butuh.
      var nodesToLoad = ['gps_config' + sfx, 'gps_jam_config' + sfx];
      var backgroundNodes = [];
      var page = typeof window !== 'undefined' ? (window.RBM_PAGE || '') : '';
      
      if (page === 'absensi-gps-view') {
          // [SUPER OPTIMASI FINAL] Halaman GPS Kiosk HANYA memuat config.
          // Jangan download face_data secara global di sini, karena akan bikin HP lag/hang.
          // Wajah, jadwal, & histori HANYA akan didownload 1 per 1 SAAT nama dipilih.
          nodesToLoad = ['gps_config' + sfx, 'gps_jam_config' + sfx, 'employees' + sfx];
          backgroundNodes = [];
      } else if (page === 'pengaturan-jadwal-absensi') {
          nodesToLoad.push('employees' + sfx, 'face_data' + sfx);
      } else if (page.indexOf('absensi') >= 0 || page.indexOf('jadwal') >= 0) {
          // Halaman absensi/jadwal butuh employees + face_data
          // [PERFORMA] Hindari muat global employees/face_data.
          nodesToLoad.push('employees' + sfx);
          // [PERFORMA] Hindari fallback node format lama bersarang per-outlet.
          // [OPTIMASI KILAT] Jadwal notes bisa diload di background, gaji & bonus HANYA diload saat buka tab masing-masing.
          backgroundNodes.push('jadwal_notes');
          // [PERFORMA] Hindari fallback node format lama bersarang per-outlet.
      } else if (page.indexOf('petty-cash') >= 0) {
          // [OPTIMASI KILAT] Jangan load seluruh petty_cash karena data sangat besar dan sudah diload otomatis sesuai tanggal
      } else if (page.indexOf('barang') >= 0 || page.indexOf('stok') >= 0) {
          nodesToLoad.push('stok_items' + sfx);
          nodesToLoad.push('stok_transactions' + sfx);
          if (outlet) nodesToLoad.push(outlet + '/stok_items');
      } else if (page.indexOf('pembukuan') >= 0 || page.indexOf('keuangan') >= 0) {
          nodesToLoad.push('bank');
      } else if (page.indexOf('inventaris') >= 0) {
          // Jangan load inventaris secara global
      } else if (page.indexOf('pengajuan') >= 0) {
          // Jangan load pengajuan secara global
          } else if (page.indexOf('reservasi') >= 0) {
              nodesToLoad.push('reservasi_data' + sfx);
      } else {
          // Fallback minimal: jangan load node berat
      }

      // Hapus duplikat node jika ada
      var uniqueNodes = [];
      nodesToLoad.forEach(function(n) { if (uniqueNodes.indexOf(n) === -1) uniqueNodes.push(n); });

      var inflightSig = (page || '') + '\0' + (outlet || '') + '\0' + uniqueNodes.join('\0');
      if (this._loadInflight && this._loadInflight.sig === inflightSig) {
          return this._loadInflight.promise;
      }

      var promises = uniqueNodes.map(function(node) {
          if (node.indexOf('gps_logs_partitioned') === 0) {
              // [OPTIMASI KILAT] Ambil sebulan ini untuk absen harian, TAPI batasi hanya 250 log terakhir.
              // Ini memastikan HP karyawan tidak mendownload puluhan MB data foto jika belum dipisah (migrasi).
              return self._db.ref('rbm_pro/' + node).orderByKey().limitToLast(250).once('value').then(function(snap) {
                  var data = snap.val();
                  if (data) {
                      Object.keys(data).forEach(function(k) {
                          // Strip photo for memory
                          if (data[k]) data[k].photo = '';
                      });
                  }
                  return { key: node, val: data };
              });
          }
          // Unduhan standar untuk node lainnya
          return self._db.ref('rbm_pro/' + node).once('value').then(function(snap) {
              return { key: node, val: snap.val() };
          });
      });

      // [OPTIMASI KILAT] Muat node yang sangat besar di background, jangan block UI ready.
      if (backgroundNodes && backgroundNodes.length > 0) {
          backgroundNodes.forEach(function(node) {
              self._db.ref('rbm_pro/' + node).once('value').then(function(snap) {
                  var val = snap.val();
                  if (val !== null) {
                      var parts = node.split('/');
                      var curr = self._cache;
                      for(var i=0; i<parts.length-1; i++){ if(!curr[parts[i]]) curr[parts[i]]={}; curr=curr[parts[i]]; }
                      curr[parts[parts.length-1]] = val;

                      // Sinkronkan node penting ke localStorage agar bisa langsung dipakai halaman aktif
                      try {
                          if (node.indexOf('employees') === 0) {
                              localStorage.setItem('RBM_EMPLOYEES' + exactSfx, JSON.stringify(val));
                              if (window._rbmParsedCache) delete window._rbmParsedCache['RBM_EMPLOYEES' + exactSfx];
                          } else if (node.indexOf('face_data') === 0) {
                              localStorage.setItem('RBM_FACE_DATA' + exactSfx, JSON.stringify(val));
                              if (window._rbmParsedCache) delete window._rbmParsedCache['RBM_FACE_DATA' + exactSfx];
                          } else if (node.indexOf('gps_config') === 0) {
                              localStorage.setItem('RBM_GPS_CONFIG' + exactSfx, JSON.stringify(val));
                              if (window._rbmParsedCache) {
                                  delete window._rbmParsedCache['RBM_GPS_CONFIG' + exactSfx];
                              }
                              if (typeof window !== 'undefined' && window.RBM_PAGE === 'absensi-gps-view') {
                                  window._cachedOfficeConfig = null;
                                  setTimeout(function() { try { if (typeof window.loadOfficeConfig === 'function') window.loadOfficeConfig(); } catch (e) {} }, 0);
                              }
                          } else if (node.indexOf('gps_jam_config') === 0) {
                              localStorage.setItem('RBM_GPS_JAM_CONFIG' + exactSfx, JSON.stringify(val));
                              if (window._rbmParsedCache) {
                                  delete window._rbmParsedCache['RBM_GPS_JAM_CONFIG' + exactSfx];
                              }
                              if (typeof window !== 'undefined' && window.RBM_PAGE === 'absensi-gps-view') {
                                  setTimeout(function() { try { if (typeof window.loadJamConfig === 'function') window.loadJamConfig(); } catch (e) {} }, 0);
                              }
                          } else if (node.indexOf('jadwal/') === 0) {
                              // Simpan ke cache path agar fallback RBMStorage.getItem('RBM_JADWAL_DATA_*') bisa membaca cepat.
                              if (window._rbmParsedCache) {
                                  var jadwalKey = 'RBM_JADWAL_DATA' + exactSfx;
                                  window._rbmParsedCache[jadwalKey] = { data: val || {} };
                              }
                              if (typeof window !== 'undefined' && window.RBM_PAGE === 'absensi-gps-view' && typeof window.updateGpsJadwalDisplay === 'function') {
                                  setTimeout(function() { try { window.updateGpsJadwalDisplay(); } catch(_) {} }, 0);
                              }
                          }
                      } catch(e) {}
                  }
              }).catch(function(){});
          });
      }

      var mainPromise = Promise.all(promises).then(function(results) {
        if (!self._cache || typeof self._cache !== 'object') self._cache = {};
        var rootVal = {};
        results.forEach(function(res) {
            if (res.val !== null) {
                var parts = res.key.split('/');
                var currR = rootVal;
                var currC = self._cache;
                for (var i = 0; i < parts.length - 1; i++) {
                    if (!currR[parts[i]]) currR[parts[i]] = {};
                    currR = currR[parts[i]];
                    if (!currC[parts[i]]) currC[parts[i]] = {};
                    currC = currC[parts[i]];
                }
                currR[parts[parts.length - 1]] = res.val;
                currC[parts[parts.length - 1]] = res.val;
            }
        });
        
        try {
          if (rootVal.employees) localStorage.setItem('RBM_EMPLOYEES_ALL', JSON.stringify(rootVal.employees));
          
          if (sfx) {
              var empKey = 'employees' + sfx;
              if (rootVal[empKey]) {
                  localStorage.setItem('RBM_EMPLOYEES' + exactSfx, JSON.stringify(rootVal[empKey]));
                  if (window._rbmParsedCache) {
                      delete window._rbmParsedCache['RBM_EMPLOYEES' + exactSfx];
                  }
              }
              
              var gpsKey = 'gps_config' + sfx;
              if (rootVal[gpsKey]) {
                  localStorage.setItem('RBM_GPS_CONFIG' + exactSfx, JSON.stringify(rootVal[gpsKey]));
                  if (window._rbmParsedCache) {
                      delete window._rbmParsedCache['RBM_GPS_CONFIG' + exactSfx];
                  }
              }
              
              var jamKey = 'gps_jam_config' + sfx;
              if (rootVal[jamKey]) {
                  localStorage.setItem('RBM_GPS_JAM_CONFIG' + exactSfx, JSON.stringify(rootVal[jamKey]));
                  if (window._rbmParsedCache) {
                      delete window._rbmParsedCache['RBM_GPS_JAM_CONFIG' + exactSfx];
                  }
              }

              var faceKey = 'face_data' + sfx;
              if (rootVal[faceKey]) {
                  localStorage.setItem('RBM_FACE_DATA' + exactSfx, JSON.stringify(rootVal[faceKey]));
                  if (window._rbmParsedCache) {
                      delete window._rbmParsedCache['RBM_FACE_DATA' + exactSfx];
                  }
              }
              
              var resKey = 'reservasi_data' + sfx;
              if (rootVal[resKey]) {
                  localStorage.setItem('RBM_RESERVASI_DATA' + exactSfx, JSON.stringify(rootVal[resKey]));
                  if (window._rbmParsedCache) {
                      delete window._rbmParsedCache['RBM_RESERVASI_DATA' + exactSfx];
                  }
              }
          }
          if (rootVal.face_data) {
              localStorage.setItem('RBM_FACE_DATA', JSON.stringify(rootVal.face_data));
              if (window._rbmParsedCache) delete window._rbmParsedCache['RBM_FACE_DATA'];
          }
        } catch(e) {}
      }).catch(function(err) {
        console.warn('RBM Storage: load failed', err);
        self._useFirebase = false;
      });

      this._loadInflight = { sig: inflightSig, promise: mainPromise };
      mainPromise.finally(function() {
        if (self._loadInflight && self._loadInflight.promise === mainPromise) self._loadInflight = null;
      });
      this._readyPromise = this._readyPromise || mainPromise;
      return mainPromise;
    },

    ready: function() {
      var self = this;
      if (this._readyPromise) return this._readyPromise;
      this.init();
      return this.loadFromFirebase();
    },

    getRawData: function(key) {
      if (!key || key.indexOf('RBM_') !== 0) {
        var str = _origGetItem.call(localStorage, key);
        try { return JSON.parse(str); } catch(e) { return str; }
      }
      var path = keyToPath(key);
      if (this._useFirebase) {
        var self = this;
        var getFromCache = function(targetPath) {
            var parts = targetPath.split('/');
            var curr = self._cache;
            for (var i = 0; i < parts.length; i++) {
                if (curr && typeof curr === 'object' && curr.hasOwnProperty(parts[i])) {
                    curr = curr[parts[i]];
                } else {
                    return null;
                }
            }
            var v = curr;
            if (v === undefined || v === null || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)) return null;
            if (typeof v === 'object' && !Array.isArray(v)) {
                if (v._rbm_transformed) return v._rbm_data;
                var ks = Object.keys(v);
                var isArrayLike = ks.length > 0 && ks.every(function(k) { return !isNaN(k); });
                var transformed = null;
                if (isArrayLike) {
                    var arr = [];
                    ks.forEach(function(k) { arr[Number(k)] = v[k]; });
                    transformed = arr.filter(function(x) { return x !== null && x !== undefined; });
                } else if (targetPath.indexOf('employees') >= 0 || targetPath.indexOf('gps_logs') >= 0) {
                    var arr2 = [];
                    ks.forEach(function(k) { 
                        var item = v[k];
                        if (item && typeof item === 'object' && targetPath.indexOf('gps_logs') >= 0) item._firebaseKey = k;
                        arr2.push(item); 
                    });
                    transformed = arr2;
                }
                if (transformed) {
                    var p = self._cache;
                    for (var j = 0; j < parts.length - 1; j++) { p = p[parts[j]]; }
                    p[parts[parts.length - 1]] = { _rbm_transformed: true, _rbm_data: transformed };
                    return transformed;
                }
            }
            return v;
        };
        var val = getFromCache(path);
        if (val !== null) return val;
        var rawOutlet = '';
        try { var el = typeof document !== 'undefined' ? document.getElementById('rbm-outlet-select') : null; rawOutlet = (el && el.value) ? el.value : (localStorage.getItem('rbm_last_selected_outlet') || ''); } catch(e) {}
        if (rawOutlet) {
            if (path.indexOf('employees_') === 0) { var fb = getFromCache(rawOutlet + '/employees'); if (fb) return fb; }
            if (path.indexOf('absensi_data_') === 0) { var fb = getFromCache(rawOutlet + '/absensi_data'); if (fb) return fb; }
            if (path.indexOf('jadwal_data_') === 0) { var fb = getFromCache(rawOutlet + '/jadwal_data'); if (fb) return fb; }
            if (path.indexOf('gps_logs_') === 0) { var fb = getFromCache(rawOutlet + '/gps_logs'); if (fb) return fb; }
        }
        if (path === 'gps_logs' || path.indexOf('gps_logs_') === 0) {
            var o = rawOutlet || 'default';
            var dDate = new Date();
            var currYm = dDate.getFullYear() + '-' + ('0' + (dDate.getMonth() + 1)).slice(-2);
            var fb = getFromCache('gps_logs_partitioned/' + o + '/' + currYm);
            if (fb) return fb;
        }
        if (path === 'jadwal_data' || path.indexOf('jadwal_data_') === 0) {
            var o = rawOutlet || 'default';
            var dDate = new Date();
            var currYm = dDate.getFullYear() + '-' + ('0' + (dDate.getMonth() + 1)).slice(-2);
            var fb = getFromCache('jadwal/' + o + '/' + currYm);
            if (fb) return fb;
        }
        if (path.indexOf('employees_') === 0) { var fb = getFromCache('employees'); if (fb) return fb; }
        if (path.indexOf('stok_items_') === 0) { var fb = getFromCache('stok_items'); if (fb) return fb; }
      }
      var str = _origGetItem.call(localStorage, key);
      try { return JSON.parse(str); } catch(e) { return str; }
    },

    getItem: function(key) {
      if (!key || key.indexOf('RBM_') !== 0) return _origGetItem.call(localStorage, key);
      var path = keyToPath(key);
      if (this._useFirebase) {
        var self = this;
        var getFromCache = function(targetPath) {
            var parts = targetPath.split('/');
            var curr = self._cache;
            for (var i = 0; i < parts.length; i++) {
                if (curr && typeof curr === 'object' && curr.hasOwnProperty(parts[i])) {
                    curr = curr[parts[i]];
                } else {
                    return null;
                }
            }
            var v = curr;
            var isEmpty = v === undefined || v === null ||
              (Array.isArray(v) && v.length === 0) ||
              (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
            if (isEmpty) return null;
            
            if (v && v._rbm_transformed) return JSON.stringify(v._rbm_data);

            // Perbaikan Krusial: Transformasi Object Firebase kembali menjadi Array
            if (typeof v === 'object' && !Array.isArray(v)) {
                var ks = Object.keys(v);
                var isArrayLike = ks.length > 0 && ks.every(function(k) { return !isNaN(k); });
                if (isArrayLike) {
                    var arr = [];
                    ks.forEach(function(k) { arr[Number(k)] = v[k]; });
                    v = arr.filter(function(x) { return x !== null && x !== undefined; });
                } else if (targetPath.indexOf('employees') >= 0 || targetPath.indexOf('gps_logs') >= 0) {
                    // [FIX] Paksa konversi Object berantakan menjadi Array berurutan
                    var arr2 = [];
                    ks.forEach(function(k) { 
                        var item = v[k];
                        if (item && typeof item === 'object' && targetPath.indexOf('gps_logs') >= 0) item._firebaseKey = k;
                        arr2.push(item); 
                    });
                    v = arr2;
                }
            }
            return typeof v === 'string' ? v : JSON.stringify(v);
        };

        var val = getFromCache(path);
        if (val !== null) return val;

        // Auto-Fallback ke data format lama (contoh: rbm_pro/sidoarjo/employees)
        var rawOutlet = '';
        try {
            var el = typeof document !== 'undefined' ? document.getElementById('rbm-outlet-select') : null;
            rawOutlet = (el && el.value) ? el.value : (localStorage.getItem('rbm_last_selected_outlet') || '');
        } catch(e) {}
        if (rawOutlet) {
            if (path.indexOf('employees_') === 0) { var fb = getFromCache(rawOutlet + '/employees'); if (fb) return fb; }
            if (path.indexOf('absensi_data_') === 0) { var fb = getFromCache(rawOutlet + '/absensi_data'); if (fb) return fb; }
            if (path.indexOf('jadwal_data_') === 0) { var fb = getFromCache(rawOutlet + '/jadwal_data'); if (fb) return fb; }
        }
        
        if (path === 'gps_logs' || path.indexOf('gps_logs_') === 0) {
            var o = rawOutlet || 'default';
            var dDate = new Date();
            var currYm = dDate.getFullYear() + '-' + ('0' + (dDate.getMonth() + 1)).slice(-2);
            var fb = getFromCache('gps_logs_partitioned/' + o + '/' + currYm);
            if (fb) return fb;
        }

        if (path === 'jadwal_data' || path.indexOf('jadwal_data_') === 0) {
            var o = rawOutlet || 'default';
            var dDate = new Date();
            var currYm = dDate.getFullYear() + '-' + ('0' + (dDate.getMonth() + 1)).slice(-2);
            var fb = getFromCache('jadwal/' + o + '/' + currYm);
            if (fb) return fb;
        }

        // Auto-Fallback ke Data Master jika cabang baru
        if (path.indexOf('employees_') === 0) { var fb = getFromCache('employees'); if (fb) return fb; }
        if (path.indexOf('stok_items_') === 0) { var fb = getFromCache('stok_items'); if (fb) return fb; }
        if (path.indexOf('gps_config_') === 0) { var fb = getFromCache('gps_config'); if (fb) return fb; }
        if (path.indexOf('gps_jam_config_') === 0) { var fb = getFromCache('gps_jam_config'); if (fb) return fb; }
        if (path.indexOf('face_data_') === 0) { var fb = getFromCache('face_data'); if (fb) return fb; }

        return _origGetItem.call(localStorage, key);
      }
      return _origGetItem.call(localStorage, key);
    },

    isUsingFirebase: function() {
      return !!this._useFirebase;
    },

    setItem: function(key, value) {
      if (!key || key.indexOf('RBM_') !== 0) {
        try { localStorage.setItem(key, value); } catch (e) { console.warn('setItem failed', key, e); }
        return Promise.resolve();
      }
      var path = keyToPath(key);
      if (this._useFirebase && this._db) {
        var toSet = value;
        try { if (typeof value === 'string') toSet = JSON.parse(value); } catch (e) { toSet = value; }
        
        var parts = path.split('/');
        var curr = this._cache;
        for (var i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = toSet;
        
        // [PERBAIKAN] Simpan juga ke localStorage untuk cache offline/startup cepat
        // Khusus untuk data master yang sering dibaca (Karyawan, Config)
        if (key.indexOf('RBM_EMPLOYEES') === 0 || key.indexOf('RBM_GPS_') === 0 || key.indexOf('RBM_FACE_DATA') === 0 || key.indexOf('RBM_GAJI_') === 0 || key.indexOf('RBM_BONUS_') === 0 || key.indexOf('RBM_RESERVASI_') === 0) {
           try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch(e) {}
        }

        var refPath = 'rbm_pro/' + path.replace(/\//g, '/');
        return this._db.ref(refPath).set(toSet);
      }
      try {
        _origSetItem.call(localStorage, key, value);
      } catch (e) {
        if (e && e.name === 'QuotaExceededError') {
          alert('Penyimpanan penuh. Pastikan koneksi Firebase aktif agar data disimpan ke cloud.');
        } else {
          alert('Gagal menyimpan.');
        }
      }
      return Promise.resolve();
    },

    /**
     * Utility: sisipkan/geser karyawan ke urutan tertentu untuk outlet tertentu.
     * Contoh (Console):
     *   RBMStorage.addEmployeeAtIndex('rice bowl monsters   ponti', 1, { name: 'Puji Shohibul Burhan' })
     */
    addEmployeeAtIndex: function(outletId, index, employeePatch) {
      var self = this;
      var sfx = this._outletSuffix(outletId);
      var key = 'RBM_EMPLOYEES' + sfx;
      var idx = parseInt(index, 10);
      if (isNaN(idx) || idx < 0) idx = 0;

      var normalizeArr = function(v) {
        if (!v) return [];
        if (Array.isArray(v)) return v.filter(function(x) { return x !== null && x !== undefined; });
        if (typeof v === 'object') {
          // Firebase kadang balik object keyed → ubah ke array
          var ks = Object.keys(v);
          var arr = [];
          ks.forEach(function(k) { arr.push(v[k]); });
          return arr.filter(function(x) { return x !== null && x !== undefined; });
        }
        return [];
      };

      var safeParseAny = function(raw) {
        if (!raw) return null;
        if (typeof raw === 'string') {
          try { return JSON.parse(raw); } catch (_) { return null; }
        }
        return raw;
      };

      var buildEmployee = function(existing) {
        var patch = (employeePatch && typeof employeePatch === 'object') ? employeePatch : {};
        var name = (patch.name || '').toString().trim();
        if (!name) name = 'Puji Shohibul Burhan';

        var maxId = 0;
        existing.forEach(function(e) {
          if (!e) return;
          var n = parseInt(e.id, 10);
          if (!isNaN(n) && n > maxId) maxId = n;
        });

        // Default minimal agar UI absensi/jadwal tidak error
        return Object.assign({
          id: maxId + 1,
          name: name,
          jabatan: '',
          joinDate: '',
          bank: '',
          noRek: '',
          email: '',
          gajiPokok: 0,
          sisaAL: '0',
          sisaDP: 0,
          sisaPH: '0'
        }, patch, { name: name });
      };

      return this.ready().then(function() {
        var existingRaw = self.getItem(key);
        var existingVal = safeParseAny(existingRaw);
        var employees = normalizeArr(existingVal);

        var targetName = '';
        try { targetName = ((employeePatch && employeePatch.name) ? employeePatch.name : 'Puji Shohibul Burhan').toString().trim().toLowerCase(); } catch (_) { targetName = 'puji shohibul burhan'; }

        // Jika sudah ada (by name), keluarkan dulu agar bisa dipindah ke index yang diminta
        var found = null;
        for (var i = 0; i < employees.length; i++) {
          var e = employees[i];
          if (e && e.name && e.name.toString().trim().toLowerCase() === targetName) {
            found = e;
            employees.splice(i, 1);
            break;
          }
        }

        var emp = found || buildEmployee(employees);
        if (idx > employees.length) idx = employees.length;
        employees.splice(idx, 0, emp);

        // Simpan (ke Firebase jika aktif, juga cache localStorage via RBMStorage.setItem)
        return self.setItem(key, JSON.stringify(employees)).then(function() { return employees; });
      });
    },

    // =========================================================================
    // [FITUR RAHASIA DEVELOPER] - Import Excel Absensi
    // Cara Pakai: Buka Console (F12), ketik: RBMStorage.enableDevMode()
    // =========================================================================
    
    enableDevMode: function() {
      localStorage.setItem('RBM_DEV_MODE', 'true');
      alert('✅ Developer Mode AKTIF. Tombol Import akan muncul di pojok kanan bawah.\nSilakan Refresh halaman.');
    },

    disableDevMode: function() {
      localStorage.removeItem('RBM_DEV_MODE');
      alert('❌ Developer Mode NON-AKTIF.');
      location.reload();
    },

    _initDevTools: function() {
      if (localStorage.getItem('RBM_DEV_MODE') !== 'true') return;

      // [DEV] Inject tombol Import ke header halaman Absensi (Input Absensi Manual)
      // Menggunakan interval karena halaman mungkin SPA (Single Page App) yang berubah kontennya
      var self = this;
      setInterval(function() {
        // Cari header yang mengandung kata "Absensi" atau "Input Absensi"
        // [DEV] Tambahkan selector h3 untuk menangkap header modal/section kecil
        var headers = document.querySelectorAll('.page-header h2, h1.rbm-page-title, h3');
        headers.forEach(function(h) {
          // Cek apakah ini header yang tepat dan belum ada tombolnya
          if ((h.innerText.includes('Absensi') || h.innerText.includes('Jadwal') || h.innerText.includes('Input Absensi')) && !h.querySelector('#rbm-dev-import-btn')) {
            var btn = document.createElement('button');
            btn.id = 'rbm-dev-import-btn';
            btn.innerHTML = '📥 Import (Dev)';
            btn.style.marginLeft = '15px';
            btn.style.background = '#2e7d32'; // Hijau Excel
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.padding = '4px 8px';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '12px';
            btn.style.verticalAlign = 'middle';
            btn.title = 'Fitur Developer: Import Data Absensi dari Excel';
            btn.onclick = function() { self.importAbsensiExcel(); };
            h.appendChild(btn);
          }
        });
      }, 1000);
    },

    importAbsensiExcel: function() {
      // 1. Load Library SheetJS (XLSX) jika belum ada
      if (typeof XLSX === 'undefined') {
        var script = document.createElement('script');
        script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
        script.onload = () => { this.importAbsensiExcel(); };
        document.head.appendChild(script);
        console.log('⏳ Mengunduh library Excel...');
        return;
      }

      // 2. Buat input file hidden
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx, .xls, .csv';
      input.style.display = 'none';
      
      input.onchange = (e) => {
        var file = e.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = (e) => {
          try {
            var data = new Uint8Array(e.target.result);
            var workbook = XLSX.read(data, {type: 'array'});
            var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            // Konversi ke JSON
            var jsonData = XLSX.utils.sheet_to_json(firstSheet);

            if (jsonData.length === 0) {
              alert('File Excel kosong!');
              return;
            }

            console.log('📄 Data Excel Terbaca:', jsonData);
            
            // [DEV] Deteksi Format: GPS Logs vs Rekap Absensi
            var firstRow = jsonData[0];
            var isGpsLog = firstRow && (firstRow.hasOwnProperty('Tipe') || firstRow.hasOwnProperty('Type') || firstRow.hasOwnProperty('Jam') || firstRow.hasOwnProperty('Time'));

            if (isGpsLog) {
              // --- IMPORT GPS LOGS (Untuk Input Absensi Manual) ---
              var outletSelect = document.getElementById('rbm-outlet-select');
              var outletId = outletSelect ? outletSelect.value : '';
              var storageKey = outletId ? 'RBM_GPS_LOGS_' + outletId : 'RBM_GPS_LOGS';

              // Ambil data lama
              var existingRaw = this.getItem(storageKey);
              var existing = [];
              try { existing = existingRaw ? JSON.parse(existingRaw) : []; } catch(e) {}

              var newLogs = jsonData.map(function(row) {
                var rawDate = row['Tanggal'] || row['Date'] || new Date().toISOString().slice(0,10);
                if (rawDate && rawDate.indexOf('/') !== -1) {
                    var p = rawDate.split('/');
                    if(p.length===3) rawDate = p[2] + '-' + ('0'+p[1]).slice(-2) + '-' + ('0'+p[0]).slice(-2);
                }
                var rawTime = row['Jam'] || row['Time'] || '00:00:00';
                if (rawTime.length === 5) rawTime += ':00';

                return {
                  id: Date.now() + Math.random(),
                  date: rawDate,
                  time: rawTime,
                  name: row['Nama'] || row['Name'] || 'Unknown',
                  type: row['Tipe'] || row['Type'] || 'Masuk',
                  lat: row['Lat'] || null,
                  lng: row['Lng'] || null,
                  photo: row['Foto'] || row['Photo'] || '',
                  manualEntry: true
                };
              });

              if (this._useFirebase && this._db) {
                  var promises = [];
                  var o = outletId || 'default';
                  newLogs.forEach((log) => {
                      var ym = log.date.substring(0, 7);
                      if (ym.length === 7) promises.push(this._db.ref('rbm_pro/gps_logs_partitioned/' + o + '/' + ym).push(log));
                  });
                  Promise.all(promises).then(function() {
                      alert('✅ Berhasil Import ' + newLogs.length + ' data GPS Logs ke Firebase');
                      location.reload();
                  });
              } else {
                  var combined = existing.concat(newLogs);
                  this.setItem(storageKey, JSON.stringify(combined)).then(function() {
                    alert('✅ Berhasil Import ' + newLogs.length + ' data GPS Logs ke ' + storageKey);
                    location.reload();
                  });
              }

            } else {
              // --- IMPORT REKAP ABSENSI (Format Lama) ---
              this.setItem('RBM_ABSENSI', JSON.stringify(jsonData)).then(function() {
                alert('✅ Berhasil Import ' + jsonData.length + ' data rekap absensi!\nData tersimpan di key: RBM_ABSENSI');
                location.reload();
              });
            }

          } catch (err) {
            console.error(err);
            alert('Gagal memproses file: ' + err.message);
          }
        };
        reader.readAsArrayBuffer(file);
      };

      input.click();
    }
  };

  window.RBMStorage = RBMStorage;
})();
