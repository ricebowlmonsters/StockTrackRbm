const CustomUI = {
    init: function() {
        if (document.getElementById('custom-ui-modal')) return;

        const style = document.createElement('style');
        style.innerHTML = `
            .custom-ui-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
                display: none; justify-content: center; align-items: center;
                z-index: 9999; opacity: 0; transition: opacity 0.2s;
            }
            .custom-ui-overlay.show { display: flex; opacity: 1; }
            .custom-ui-modal {
                background: white; padding: 24px; border-radius: 16px;
                width: 90%; max-width: 400px; text-align: center;
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                transform: scale(0.9); transition: transform 0.2s;
                font-family: 'Inter', sans-serif;
            }
            .custom-ui-overlay.show .custom-ui-modal { transform: scale(1); }
            .custom-ui-icon { font-size: 48px; margin-bottom: 16px; display: block; }
            .custom-ui-title { font-size: 20px; font-weight: 700; margin: 0 0 8px 0; color: #1f2937; }
            .custom-ui-message { font-size: 15px; color: #6b7280; margin: 0 0 24px 0; line-height: 1.5; }
            .custom-ui-actions { display: flex; gap: 12px; justify-content: center; }
            .custom-ui-btn {
                flex: 1; padding: 12px; border: none; border-radius: 8px;
                font-weight: 600; cursor: pointer; font-size: 14px;
                transition: background 0.2s;
            }
            .custom-ui-btn-primary { background: #4C2A85; color: white; }
            .custom-ui-btn-primary:hover { background: #3c216b; }
            .custom-ui-btn-secondary { background: #f3f4f6; color: #374151; }
            .custom-ui-btn-secondary:hover { background: #e5e7eb; }
            .custom-ui-btn-danger { background: #ef4444; color: white; }
            .custom-ui-btn-danger:hover { background: #dc2626; }
        `;
        document.head.appendChild(style);

        const div = document.createElement('div');
        div.id = 'custom-ui-modal';
        div.className = 'custom-ui-overlay';
        div.innerHTML = `
            <div class="custom-ui-modal">
                <div id="custom-ui-icon" class="custom-ui-icon"></div>
                <h3 id="custom-ui-title" class="custom-ui-title"></h3>
                <div id="custom-ui-message" class="custom-ui-message"></div>
                <div id="custom-ui-actions" class="custom-ui-actions"></div>
            </div>
        `;
        document.body.appendChild(div);
    },

    show: function(options) {
        this.init();
        return new Promise((resolve) => {
            const overlay = document.getElementById('custom-ui-modal');
            const iconEl = document.getElementById('custom-ui-icon');
            const titleEl = document.getElementById('custom-ui-title');
            const msgEl = document.getElementById('custom-ui-message');
            const actionsEl = document.getElementById('custom-ui-actions');

            iconEl.textContent = options.icon || 'ℹ️';
            titleEl.textContent = options.title || 'Informasi';
            msgEl.innerHTML = (options.message || '').replace(/\n/g, '<br>');

            actionsEl.innerHTML = '';

            if (options.type === 'confirm') {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'custom-ui-btn custom-ui-btn-secondary';
                cancelBtn.textContent = options.cancelText || 'Batal';
                cancelBtn.onclick = () => {
                    overlay.classList.remove('show');
                    setTimeout(() => { overlay.style.display = 'none'; resolve(false); }, 200);
                };
                actionsEl.appendChild(cancelBtn);

                const confirmBtn = document.createElement('button');
                confirmBtn.className = `custom-ui-btn ${options.danger ? 'custom-ui-btn-danger' : 'custom-ui-btn-primary'}`;
                confirmBtn.textContent = options.confirmText || 'Ya';
                confirmBtn.onclick = () => {
                    overlay.classList.remove('show');
                    setTimeout(() => { overlay.style.display = 'none'; resolve(true); }, 200);
                };
                actionsEl.appendChild(confirmBtn);
            } else {
                const okBtn = document.createElement('button');
                okBtn.className = 'custom-ui-btn custom-ui-btn-primary';
                okBtn.textContent = options.okText || 'Oke';
                okBtn.onclick = () => {
                    overlay.classList.remove('show');
                    setTimeout(() => { overlay.style.display = 'none'; resolve(true); }, 200);
                };
                actionsEl.appendChild(okBtn);
            }

            overlay.style.display = 'flex';
            setTimeout(() => overlay.classList.add('show'), 10);
        });
    },

    alert: function(message, title = 'Informasi') { return this.show({ type: 'alert', title, message, icon: 'ℹ️' }); },
    confirm: function(message, title = 'Konfirmasi', danger = false) { return this.show({ type: 'confirm', title, message, icon: '❓', danger }); },
    success: function(message, title = 'Berhasil') { return this.show({ type: 'alert', title, message, icon: '✅' }); },
    error: function(message, title = 'Error') { return this.show({ type: 'alert', title, message, icon: '❌', danger: true }); }
};

// [BARU] Database Adapters & Helpers (Global)

class LocalDB {
    constructor(dbName) { this.key = "rbm_off_" + (dbName || "def"); }
    _g() { try { return JSON.parse(localStorage.getItem(this.key) || "{}"); } catch (e) { return {}; } }
    _s(e) { try { localStorage.setItem(this.key, JSON.stringify(e)); } catch (e) { alert("Penyimpanan Penuh"); } }
    ref(path) {
        const t = this;
        const n = (!path || path === "/") ? "" : path.replace(/^\/|\/$/g, "");
        return {
            once: (eventType) => new Promise(resolve => {
                const d = t._g();
                let v = d;
                if (n) {
                    for (const p of n.split("/")) {
                        if (v && typeof v === "object" && p in v) v = v[p];
                        else { v = null; break; }
                    }
                }
                resolve({ val: () => v, exists: () => v !== null, forEach: (cb) => { if(v && typeof v === 'object') Object.entries(v).forEach(([k,val]) => cb({key:k, val:()=>val})); } });
            }),
            on: function(eventType, cb) { this.once(eventType).then(s => cb(s)); },
            off: () => {},
            set: (data) => new Promise(resolve => {
                const f = t._g();
                if (!n) t._s(data);
                else {
                    const p = n.split("/");
                    let c = f;
                    for (let i = 0; i < p.length - 1; i++) {
                        if (!c[p[i]] || typeof c[p[i]] !== "object") c[p[i]] = {};
                        c = c[p[i]];
                    }
                    c[p[p.length - 1]] = data;
                    t._s(f);
                }
                resolve();
            }),
            update: function(data) { return this.set(data); },
            remove: function() { return this.set(null); },
            push: (data) => new Promise(resolve => {
                const k = "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
                t.ref(n ? n + "/" + k : k).set(data).then(() => resolve({ key: k }));
            }),
            child: (c) => t.ref(n ? n + "/" + c : c),
            orderByChild: function() { return this; },
            startAt: function() { return this; },
            endAt: function() { return this; },
            limitToLast: function() { return this; },
            equalTo: function() { return this; },
            transaction: (updateFn) => this.once().then(s => {
                const curr = s.val();
                const newVal = updateFn(curr);
                if (newVal !== undefined) return this.set(newVal).then(() => ({ committed: true, snapshot: { val: () => newVal } }));
                return { committed: false };
            })
        };
    }
}

class ServerDB {
    constructor(apiUrl) {
        this.url = apiUrl || "http://localhost:3001/db";
        this._etag = null;
        this._cache = {}; // cache per path agar 304 tetap bisa serve data
    }
    _baseUrl() {
        return (this.url || '').toString().replace(/\/db\/?$/, '');
    }
    async _r(method, data = null, urlOverride = null) {
        try {
            const opts = { method, headers: { "Content-Type": "application/json" } };
            if (method === "GET" && this._etag) opts.headers["If-None-Match"] = this._etag;
            if (data) opts.body = JSON.stringify(data);
            const res = await fetch(urlOverride || this.url, opts);
            const etag = res.headers && res.headers.get ? res.headers.get("ETag") : null;
            if (etag) this._etag = etag;
            if (res.status === 304) return "__NOT_MODIFIED__";
            return await res.json();
        } catch (e) { return null; }
    }
    ref(path) {
        const t = this;
        const n = (!path || path === "/") ? "" : path.replace(/^\/|\/$/g, "");
        return {
            once: (eventType) => new Promise(async resolve => {
                // [OPTIMASI] Ambil hanya subtree yang dibutuhkan: /db?path=a/b/c
                if (n) {
                    const url = t.url + "?path=" + encodeURIComponent(n);
                    const v = await t._r("GET", null, url);
                    if (v !== null && v !== "__NOT_MODIFIED__") t._cache[n] = v;
                    const outVal = (v === "__NOT_MODIFIED__") ? (t._cache.hasOwnProperty(n) ? t._cache[n] : null) : v;
                    resolve({
                        val: () => outVal,
                        exists: () => outVal !== null,
                        forEach: (cb) => { if (outVal && typeof outVal === 'object') Object.entries(outVal).forEach(([k,val]) => cb({key:k, val:()=>val})); }
                    });
                    return;
                }
                const f = await t._r("GET");
                if (f !== null && f !== "__NOT_MODIFIED__") t._cache[""] = f;
                const outRoot = (f === "__NOT_MODIFIED__") ? (t._cache.hasOwnProperty("") ? t._cache[""] : null) : (f || {});
                resolve({
                    val: () => outRoot,
                    exists: () => outRoot !== null,
                    forEach: (cb) => { if (outRoot && typeof outRoot === 'object') Object.entries(outRoot).forEach(([k,val]) => cb({key:k, val:()=>val})); }
                });
            }),
            on: function(eventType, cb) { this.once(eventType).then(s => cb(s)); },
            off: () => {},
            set: (data) => new Promise(async resolve => {
                if (!n) {
                    await t._r("POST", data);
                    resolve();
                    return;
                }
                // [OPTIMASI] Set per-path: POST /db/path {path,value}
                const base = t._baseUrl();
                await t._r("POST", { path: n, value: data, mode: "set" }, base + "/db/path");
                resolve();
            }),
            update: function(data) {
                if (!n) return this.set(data);
                const base = t._baseUrl();
                return new Promise(async resolve => {
                    await t._r("POST", { path: n, value: data, mode: "merge" }, base + "/db/path");
                    resolve();
                });
            },
            remove: function() {
                if (!n) return this.set(null);
                const base = t._baseUrl();
                return new Promise(async resolve => {
                    await t._r("DELETE", null, base + "/db/path?path=" + encodeURIComponent(n));
                    resolve();
                });
            },
            push: (data) => new Promise(resolve => {
                const k = "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
                t.ref(n ? n + "/" + k : k).set(data).then(() => resolve({ key: k }));
            }),
            child: (c) => t.ref(n ? n + "/" + c : c),
            orderByChild: function() { return this; },
            startAt: function() { return this; },
            endAt: function() { return this; },
            limitToLast: function() { return this; },
            equalTo: function() { return this; },
            transaction: (updateFn) => this.once().then(s => {
                const curr = s.val();
                const newVal = updateFn(curr);
                if (newVal !== undefined) return this.set(newVal).then(() => ({ committed: true, snapshot: { val: () => newVal } }));
                return { committed: false };
            })
        };
    }
}

function getRbmActiveConfig() {
    try {
        const storedConns = localStorage.getItem('rbm_db_connections');
        const activeIdx = parseInt(localStorage.getItem('rbm_active_connection_index') || '0');
        if (storedConns) {
            const conns = JSON.parse(storedConns);
            if (conns.length > 0) {
                if (activeIdx >= 0 && activeIdx < conns.length) return conns[activeIdx].config;
                return conns[0].config;
            }
        }
    } catch(e) { console.error("Config Load Error", e); }
    return null;
}

function initRbmDB() {
    const config = getRbmActiveConfig();
    if (config && (config.type === 'local' || config.type === 'server')) {
        if (config.type === 'local') return new LocalDB(config.dbName);
        else return new ServerDB(config.apiUrl);
    } else {
        if (typeof firebase !== 'undefined' && !firebase.apps.length && config) {
            firebase.initializeApp(config);
        }
        if (typeof firebase !== 'undefined' && firebase.apps.length) {
            return firebase.database();
        }
    }
    return { ref: () => ({ on:()=>{}, once:()=>Promise.resolve({val:()=>null}) }) };
}

function isRbmOfflineMode() {
    const config = getRbmActiveConfig();
    return config && (config.type === 'local' || config.type === 'server');
}

// --- Default Firebase (Online): supaya login di web mana pun langsung pakai Firebase ---
var RBM_DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDWQG53tP2zKILTwPSJQpiVzFNyvYLxLqw",
    authDomain: "ricebowlmonst.firebaseapp.com",
    databaseURL: "https://ricebowlmonst-default-rtdb.firebaseio.com",
    projectId: "ricebowlmonst",
    storageBucket: "ricebowlmonst.firebasestorage.app",
    messagingSenderId: "723669558962",
    appId: "1:723669558962:web:c17a1a4683a86cc5a88bab",
    type: "firebase"
};

function getRbmConnections() {
    try {
        var stored = localStorage.getItem('rbm_db_connections');
        return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
}

/** Saat online, jika belum ada koneksi database, otomatis pakai Firebase default. Jadi login di device mana pun langsung pakai Firebase. */
function ensureDefaultFirebaseConnection() {
    if (!navigator.onLine) return;
    var conns = getRbmConnections();
    
    // [PERBAIKAN] Auto-fix URL Firebase yang salah di LocalStorage
    let hasChanges = false;
    conns.forEach(function(conn) {
        if (conn && conn.config && conn.config.databaseURL && conn.config.databaseURL.indexOf('asia-southeast1') >= 0) {
            conn.config.databaseURL = 'https://ricebowlmonst-default-rtdb.firebaseio.com';
            hasChanges = true;
        }
    });
    if (hasChanges) {
        try { localStorage.setItem('rbm_db_connections', JSON.stringify(conns)); } catch(e) {}
    }

    if (conns.length > 0) return;
    conns = [{ name: 'Online (Firebase)', config: RBM_DEFAULT_FIREBASE_CONFIG }];
    try {
        localStorage.setItem('rbm_db_connections', JSON.stringify(conns));
        localStorage.setItem('rbm_active_connection_index', '0');
    } catch (e) { console.warn('ensureDefaultFirebaseConnection save failed', e); }
}
ensureDefaultFirebaseConnection();