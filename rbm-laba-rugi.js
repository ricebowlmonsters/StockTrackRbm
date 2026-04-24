// =================================================================
//            LOGIKA MODUL KEUANGAN & INVENTARIS
// =================================================================
// Mengelola halaman:
// - rbm-laba-rugi-settings.html
// - rbm-laba-rugi-input.html
// - rbm-laba-rugi-report.html
// =================================================================

var rbmDb; // Diubah ke var agar tidak error saat diload berulang

// Fungsi Utama untuk mendeteksi Outlet yang sedang aktif
function getOutletLR() {
    let outlet = '';
    if (typeof getRbmOutlet === 'function') outlet = getRbmOutlet();
    if (!outlet) {
        const el = document.getElementById('rbm-outlet-select');
        if (el) outlet = el.value;
    }
    if (!outlet) outlet = localStorage.getItem('rbm_last_selected_outlet');
    return outlet || 'default';
}

document.addEventListener("DOMContentLoaded", () => {
    // Inisialisasi koneksi database (mendukung Firebase, LocalDB, ServerDB)
    if (typeof initRbmDB === 'function') {
        rbmDb = initRbmDB();
    } else if (typeof firebase !== 'undefined') {
        rbmDb = firebase.database();
    }

    const path = window.location.pathname.split("/").pop();

    if (path === 'rbm-laba-rugi-settings.html') {
        initSettingsPage();
    } else if (path === 'rbm-laba-rugi-input.html') {
        initInputPage();
    } else if (path === 'rbm-laba-rugi-report.html') {
        initReportPage();
    }
});

// =================================================
// Halaman: Pengaturan (Settings)
// =================================================
function initSettingsPage() {
    console.log("Halaman Pengaturan Keuangan Aktif");

    // Otomatis muat ulang data saat ganti outlet di dropdown atas
    const outletSel = document.getElementById('rbm-outlet-select');
    if (outletSel) {
        outletSel.addEventListener('change', () => {
            if (typeof window.loadBankAccounts === 'function') window.loadBankAccounts();
            if (typeof window.loadHppCategories === 'function') window.loadHppCategories();
            if (typeof window.loadHppItems === 'function') window.loadHppItems();
            if (typeof window.loadBiaya === 'function') window.loadBiaya();
            if (typeof window.loadPendapatan === 'function') window.loadPendapatan();
            if (typeof window.loadPpn === 'function') window.loadPpn();
        });
    }

    // --- Logika untuk Tab Kas & Bank ---
    const btnAddAccount = document.getElementById('btn-add-account');
    const accountModal = document.getElementById('account-modal');
    const accountForm = document.getElementById('account-form');
    const accountsTbody = document.getElementById('accounts-tbody');

    if (btnAddAccount) {
        btnAddAccount.addEventListener('click', () => {
            accountForm.reset();
            document.getElementById('account-id').value = '';
            document.getElementById('account-modal-title').textContent = 'Tambah Akun Baru';
            accountModal.style.display = 'flex';
        });
    }

    // Tutup modal saat klik di luar
    if (accountModal) {
        accountModal.addEventListener('click', (e) => {
            if (e.target === accountModal) {
                closeAccountModal();
            }
        });
    }

    // Simpan data akun
    if (accountForm) {
        accountForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('account-id').value;
            const name = document.getElementById('account-name').value.trim();
            const number = document.getElementById('account-number').value.trim();

            if (!name) {
                alert('Nama Akun tidak boleh kosong.');
                return;
            }

            const accountData = { name, number };
            const dbPath = `rbm_pro/laba_rugi_settings/${getOutletLR()}/accounts`;
            
            if (id) {
                // Update
                rbmDb.ref(`${dbPath}/${id}`).update(accountData).then(closeAccountModal);
            } else {
                // Create
                rbmDb.ref(dbPath).push(accountData).then(closeAccountModal);
            }
        });
    }

    // Muat dan tampilkan data akun
    window.refAccountsLR = null;
    window.loadBankAccounts = function() {
        const dbPath = `rbm_pro/laba_rugi_settings/${getOutletLR()}/accounts`;
        if (window.refAccountsLR) window.refAccountsLR.off();
        window.refAccountsLR = rbmDb.ref(dbPath);
        window.refAccountsLR.on('value', (snapshot) => {
            if (!accountsTbody) return;
            accountsTbody.innerHTML = '';
            const data = snapshot.val();

            if (!data) {
                accountsTbody.innerHTML = '<tr><td colspan="3" class="table-empty">Belum ada data. Klik "+ Tambah Akun" untuk memulai.</td></tr>';
                return;
            }

            Object.keys(data).forEach(key => {
                const account = data[key];
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${account.name}</td>
                    <td>${account.number || '-'}</td>
                    <td>
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="editAccount('${key}')">Edit</button>
                        <button class="btn-small-danger" style="margin-left: 5px;" onclick="deleteAccount('${key}')">Hapus</button>
                    </td>
                `;
                accountsTbody.appendChild(tr);
            });
        });
    }

    // Fungsi Edit & Hapus (dibuat global agar bisa dipanggil dari onclick)
    window.editAccount = (id) => {
        const dbPath = `rbm_pro/laba_rugi_settings/${getOutletLR()}/accounts/${id}`;
        rbmDb.ref(dbPath).once('value').then(snapshot => {
            const account = snapshot.val();
            if (account) {
                document.getElementById('account-id').value = id;
                document.getElementById('account-name').value = account.name;
                document.getElementById('account-number').value = account.number || '';
                document.getElementById('account-modal-title').textContent = 'Edit Akun';
                accountModal.style.display = 'flex';
            }
        });
    };

    window.deleteAccount = (id) => {
        if (confirm('Yakin ingin menghapus akun ini?')) {
            rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/accounts/${id}`).remove();
        }
    };

    window.closeAccountModal = () => {
        if (accountModal) accountModal.style.display = 'none';
    };

    // Panggil fungsi untuk memuat data saat halaman dibuka
    window.loadBankAccounts();

    let settingsHppCategories = {};
    let settingsHppItems = {};

    // ==================================================
    // --- Logika untuk Tab Kategori HPP ---
    // ==================================================
    const btnAddKategoriHpp = document.getElementById('btn-add-kategori-hpp');
    const kategoriHppModal = document.getElementById('kategori-hpp-modal');
    const kategoriHppForm = document.getElementById('kategori-hpp-form');
    const kategoriHppTbody = document.getElementById('kategori-hpp-tbody');

    if (btnAddKategoriHpp) btnAddKategoriHpp.addEventListener('click', () => {
        kategoriHppForm.reset(); document.getElementById('kategori-hpp-id').value = '';
        document.getElementById('kategori-hpp-modal-title').textContent = 'Tambah Kategori HPP';
        kategoriHppModal.style.display = 'flex';
    });
    if (kategoriHppModal) kategoriHppModal.addEventListener('click', (e) => { if (e.target === kategoriHppModal) closeKategoriHppModal(); });
    window.closeKategoriHppModal = () => { if (kategoriHppModal) kategoriHppModal.style.display = 'none'; };

    if (kategoriHppForm) kategoriHppForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('kategori-hpp-id').value;
        const name = document.getElementById('kategori-hpp-name').value.trim();
        if (!name) return;
        const dbPath = `rbm_pro/laba_rugi_settings/${getOutletLR()}/hpp_categories`;
        if (id) rbmDb.ref(`${dbPath}/${id}`).update({name}).then(closeKategoriHppModal);
        else rbmDb.ref(dbPath).push({name}).then(closeKategoriHppModal);
    });

    window.refHppCatLR = null;
    window.loadHppCategories = function() {
        if (window.refHppCatLR) window.refHppCatLR.off();
        window.refHppCatLR = rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/hpp_categories`);
        window.refHppCatLR.on('value', (snap) => {
            settingsHppCategories = snap.val() || {};
            if (kategoriHppTbody) {
                kategoriHppTbody.innerHTML = '';
                if (Object.keys(settingsHppCategories).length === 0) {
                    kategoriHppTbody.innerHTML = '<tr><td colspan="2" class="table-empty">Belum ada kategori HPP.</td></tr>';
                } else {
                    Object.keys(settingsHppCategories).forEach(key => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td>${settingsHppCategories[key].name}</td><td><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="editKategoriHpp('${key}')">Edit</button> <button class="btn-small-danger" onclick="deleteKategoriHpp('${key}')">Hapus</button></td>`;
                        kategoriHppTbody.appendChild(tr);
                    });
                }
            }
            const selectCat = document.getElementById('hpp-category');
            if (selectCat) {
                const currentVal = selectCat.value;
                selectCat.innerHTML = '<option value="">-- Pilih Kategori --</option>';
                Object.keys(settingsHppCategories).forEach(key => {
                    selectCat.innerHTML += `<option value="${key}">${settingsHppCategories[key].name}</option>`;
                });
                if (currentVal && settingsHppCategories[currentVal]) selectCat.value = currentVal;
            }
            renderHppItemsTable();
        });
    }

    window.editKategoriHpp = (id) => {
        if (settingsHppCategories[id]) {
            document.getElementById('kategori-hpp-id').value = id; document.getElementById('kategori-hpp-name').value = settingsHppCategories[id].name;
            document.getElementById('kategori-hpp-modal-title').textContent = 'Edit Kategori HPP'; kategoriHppModal.style.display = 'flex';
        }
    };
    window.deleteKategoriHpp = (id) => { if (confirm('Hapus kategori ini? (Barang di dalamnya akan tetap tersimpan tapi tanpa grup kategori)')) rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/hpp_categories/${id}`).remove(); };
    window.loadHppCategories();

    // ==================================================
    // --- Logika untuk Tab Barang HPP ---
    // ==================================================
    const btnAddHpp = document.getElementById('btn-add-hpp');
    const hppModal = document.getElementById('hpp-modal');
    const hppForm = document.getElementById('hpp-form');
    const hppTbody = document.getElementById('hpp-tbody');

    if (btnAddHpp) btnAddHpp.addEventListener('click', () => {
        hppForm.reset(); document.getElementById('hpp-id').value = '';
        document.getElementById('hpp-modal-title').textContent = 'Tambah Barang HPP';
        hppModal.style.display = 'flex';
    });
    if (hppModal) hppModal.addEventListener('click', (e) => { if (e.target === hppModal) closeHppModal(); });
    window.closeHppModal = () => { if (hppModal) hppModal.style.display = 'none'; };

    if (hppForm) hppForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('hpp-id').value;
        const category_id = document.getElementById('hpp-category').value;
        const name = document.getElementById('hpp-name').value.trim();
        const unit = document.getElementById('hpp-unit').value.trim();
        const priceEl = document.getElementById('hpp-price');
        const price = priceEl ? parseFloat(priceEl.value) || 0 : 0;
        
        if (!name || !category_id) { alert("Nama dan Kategori wajib diisi"); return; }
        const dbPath = `rbm_pro/laba_rugi_settings/${getOutletLR()}/hpp_items`;
        if (id) rbmDb.ref(`${dbPath}/${id}`).update({category_id, name, unit, price}).then(closeHppModal);
        else rbmDb.ref(dbPath).push({category_id, name, unit, price}).then(closeHppModal);
    });

    window.refHppItemsLR = null;
    window.loadHppItems = function() {
        if (window.refHppItemsLR) window.refHppItemsLR.off();
        window.refHppItemsLR = rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/hpp_items`);
        window.refHppItemsLR.on('value', snap => {
            settingsHppItems = snap.val() || {};
            renderHppItemsTable();
        });
    }

    function renderHppItemsTable() {
        if (!hppTbody) return;
        hppTbody.innerHTML = '';
        if (Object.keys(settingsHppItems).length === 0) {
            hppTbody.innerHTML = '<tr><td colspan="5" class="table-empty">Belum ada data barang HPP.</td></tr>';
            return;
        }
        Object.keys(settingsHppItems).forEach(key => {
            const item = settingsHppItems[key];
            const catName = item.category_id && settingsHppCategories[item.category_id] ? settingsHppCategories[item.category_id].name : '<i style="color:gray;">Tanpa Kategori</i>';
            const priceFormatted = item.price ? 'Rp ' + Math.round(item.price).toLocaleString('id-ID') : '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${catName}</td>
                <td>${item.name}</td>
                <td>${item.unit}</td>
                <td>${priceFormatted}</td>
                <td>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="editHpp('${key}')">Edit</button>
                    <button class="btn-small-danger" style="margin-left: 5px;" onclick="deleteHpp('${key}')">Hapus</button>
                </td>
            `;
            hppTbody.appendChild(tr);
        });
    }

    window.editHpp = (id) => {
        const item = settingsHppItems[id];
        if (item) {
            document.getElementById('hpp-id').value = id;
            document.getElementById('hpp-category').value = item.category_id || '';
            document.getElementById('hpp-name').value = item.name;
            document.getElementById('hpp-unit').value = item.unit || '';
            const priceEl = document.getElementById('hpp-price');
            if (priceEl) priceEl.value = item.price || '';
            document.getElementById('hpp-modal-title').textContent = 'Edit Barang HPP';
            hppModal.style.display = 'flex';
        }
    };

    window.deleteHpp = (id) => { if (confirm('Hapus barang HPP ini?')) rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/hpp_items/${id}`).remove(); };
    window.loadHppItems();

    // ==================================================
    // --- Logika untuk Tab Biaya Operasional ---
    // ==================================================
    const btnAddBiaya = document.getElementById('btn-add-biaya');
    const biayaModal = document.getElementById('biaya-modal');
    const biayaForm = document.getElementById('biaya-form');
    const biayaTbody = document.getElementById('biaya-tbody');

    if (btnAddBiaya) btnAddBiaya.addEventListener('click', () => {
        biayaForm.reset(); document.getElementById('biaya-id').value = '';
        document.getElementById('biaya-modal-title').textContent = 'Tambah Jenis Biaya';
        biayaModal.style.display = 'flex';
    });
    if (biayaModal) biayaModal.addEventListener('click', (e) => { if (e.target === biayaModal) closeBiayaModal(); });
    window.closeBiayaModal = () => { if (biayaModal) biayaModal.style.display = 'none'; };

    if (biayaForm) biayaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('biaya-id').value;
        const name = document.getElementById('biaya-name').value.trim();
        if (!name) return;
        const dbPath = `rbm_pro/laba_rugi_settings/${getOutletLR()}/expense_categories`;
        if (id) rbmDb.ref(`${dbPath}/${id}`).update({name}).then(closeBiayaModal);
        else rbmDb.ref(dbPath).push({name}).then(closeBiayaModal);
    });

    window.refBiayaLR = null;
    window.loadBiaya = function() {
        if (window.refBiayaLR) window.refBiayaLR.off();
        window.refBiayaLR = rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/expense_categories`);
        window.refBiayaLR.on('value', (snap) => {
            if (!biayaTbody) return;
            biayaTbody.innerHTML = '';
            const data = snap.val();
            if (!data) {
                biayaTbody.innerHTML = '<tr><td colspan="2" class="table-empty">Belum ada data.</td></tr>';
                return;
            }
            Object.keys(data).forEach(key => {
                const item = data[key];
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${item.name}</td><td><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="editBiaya('${key}')">Edit</button> <button class="btn-small-danger" onclick="deleteBiaya('${key}')">Hapus</button></td>`;
                biayaTbody.appendChild(tr);
            });
        });
    }

    window.editBiaya = (id) => {
        rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/expense_categories/${id}`).once('value').then(snap => {
            if (snap.val()) {
                document.getElementById('biaya-id').value = id; document.getElementById('biaya-name').value = snap.val().name;
                document.getElementById('biaya-modal-title').textContent = 'Edit Jenis Biaya'; biayaModal.style.display = 'flex';
            }
        });
    };
    window.deleteBiaya = (id) => { if (confirm('Hapus jenis biaya ini?')) rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/expense_categories/${id}`).remove(); };
    window.loadBiaya();

    // ==================================================
    // --- Logika untuk Tab Pendapatan Lain ---
    // ==================================================
    const btnAddPendapatan = document.getElementById('btn-add-pendapatan');
    const pendapatanModal = document.getElementById('pendapatan-modal');
    const pendapatanForm = document.getElementById('pendapatan-form');
    const pendapatanTbody = document.getElementById('pendapatan-tbody');

    if (btnAddPendapatan) btnAddPendapatan.addEventListener('click', () => {
        pendapatanForm.reset(); document.getElementById('pendapatan-id').value = '';
        document.getElementById('pendapatan-modal-title').textContent = 'Tambah Jenis Pendapatan';
        pendapatanModal.style.display = 'flex';
    });
    if (pendapatanModal) pendapatanModal.addEventListener('click', (e) => { if (e.target === pendapatanModal) closePendapatanModal(); });
    window.closePendapatanModal = () => { if (pendapatanModal) pendapatanModal.style.display = 'none'; };

    if (pendapatanForm) pendapatanForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('pendapatan-id').value;
        const name = document.getElementById('pendapatan-name').value.trim();
        if (!name) return;
        const dbPath = `rbm_pro/laba_rugi_settings/${getOutletLR()}/revenue_types`;
        if (id) rbmDb.ref(`${dbPath}/${id}`).update({name}).then(closePendapatanModal);
        else rbmDb.ref(dbPath).push({name}).then(closePendapatanModal);
    });

    window.refPendapatanLR = null;
    window.loadPendapatan = function() {
        if (window.refPendapatanLR) window.refPendapatanLR.off();
        window.refPendapatanLR = rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/revenue_types`);
        window.refPendapatanLR.on('value', (snap) => {
            if (!pendapatanTbody) return;
            pendapatanTbody.innerHTML = '';
            const data = snap.val();
            if (!data) return pendapatanTbody.innerHTML = '<tr><td colspan="2" class="table-empty">Belum ada data.</td></tr>';
            Object.keys(data).forEach(key => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${data[key].name}</td><td><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="editPendapatan('${key}')">Edit</button> <button class="btn-small-danger" onclick="deletePendapatan('${key}')">Hapus</button></td>`;
                pendapatanTbody.appendChild(tr);
            });
        });
    }
    window.editPendapatan = (id) => { rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/revenue_types/${id}`).once('value').then(snap => { if (snap.val()) { document.getElementById('pendapatan-id').value = id; document.getElementById('pendapatan-name').value = snap.val().name; document.getElementById('pendapatan-modal-title').textContent = 'Edit Jenis Pendapatan'; pendapatanModal.style.display = 'flex'; } }); };
    window.deletePendapatan = (id) => { if (confirm('Hapus jenis pendapatan ini?')) rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/revenue_types/${id}`).remove(); };
    window.loadPendapatan();

    // ==================================================
    // --- Logika untuk Tab PPN ---
    // ==================================================
    const ppnInput = document.getElementById('ppn-input');
    const btnSavePpn = document.getElementById('btn-save-ppn');
    const ppnFeedback = document.getElementById('ppn-feedback');

    window.loadPpn = function() {
        if (ppnInput) rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/ppn_percent`).once('value').then(snap => { ppnInput.value = snap.val() || 0; });
    };
    window.loadPpn();

    if (btnSavePpn && ppnInput) btnSavePpn.addEventListener('click', () => {
        const val = parseFloat(ppnInput.value) || 0;
        rbmDb.ref(`rbm_pro/laba_rugi_settings/${getOutletLR()}/ppn_percent`).set(val).then(() => {
            if (ppnFeedback) { ppnFeedback.textContent = '✅ PPN berhasil disimpan'; ppnFeedback.style.color = '#059669'; setTimeout(() => { ppnFeedback.textContent = ''; }, 3000); }
        });
    });
}

// =================================================
// Halaman: Input Transaksi
// =================================================

let keuanganMasterData = { accounts: {}, revenues: {}, expenses: {}, hpp: {}, hppCategories: {} };

function initInputPage() {
    console.log("Halaman Input Transaksi Keuangan Aktif");
    
    window.refInpAccounts = null;
    window.refInpRev = null;
    window.refInpExp = null;
    window.refInpHpp = null;
    window.refInpHppCat = null;

    window.loadInputMasterData = function() {
        const outlet = getOutletLR();
        if (window.refInpAccounts) window.refInpAccounts.off();
        window.refInpAccounts = rbmDb.ref(`rbm_pro/laba_rugi_settings/${outlet}/accounts`);
        window.refInpAccounts.on('value', snap => { keuanganMasterData.accounts = snap.val() || {}; updateDropdownsAll(); });

        if (window.refInpRev) window.refInpRev.off();
        window.refInpRev = rbmDb.ref(`rbm_pro/laba_rugi_settings/${outlet}/revenue_types`);
        window.refInpRev.on('value', snap => { keuanganMasterData.revenues = snap.val() || {}; updateDropdownsAll(); });

        if (window.refInpExp) window.refInpExp.off();
        window.refInpExp = rbmDb.ref(`rbm_pro/laba_rugi_settings/${outlet}/expense_categories`);
        window.refInpExp.on('value', snap => { keuanganMasterData.expenses = snap.val() || {}; updateDropdownsAll(); });

        if (window.refInpHpp) window.refInpHpp.off();
        window.refInpHpp = rbmDb.ref(`rbm_pro/laba_rugi_settings/${outlet}/hpp_items`);
        window.refInpHpp.on('value', snap => { keuanganMasterData.hpp = snap.val() || {}; updateDropdownsAll(); });

        if (window.refInpHppCat) window.refInpHppCat.off();
        window.refInpHppCat = rbmDb.ref(`rbm_pro/laba_rugi_settings/${outlet}/hpp_categories`);
        window.refInpHppCat.on('value', snap => { keuanganMasterData.hppCategories = snap.val() || {}; updateDropdownsAll(); });
    };
    window.loadInputMasterData();

    const outletSel = document.getElementById('rbm-outlet-select');
    if (outletSel) outletSel.addEventListener('change', () => window.loadInputMasterData());

    // Button listeners
    const btnShowStok = document.getElementById('btn-show-stok');
    const btnShowNonStok = document.getElementById('btn-show-nonstok');
    const btnShowHistory = document.getElementById('btn-show-history');
    const formStokContainer = document.getElementById('form-stok-container');
    const formNonStokContainer = document.getElementById('form-nonstok-container');
    const historyContainer = document.getElementById('history-container');

    function resetTabButtons() {
        if(btnShowStok) { btnShowStok.className = 'btn btn-secondary'; btnShowStok.style.background = ''; btnShowStok.style.color = ''; }
        if(btnShowNonStok) { btnShowNonStok.className = 'btn btn-secondary'; btnShowNonStok.style.background = ''; btnShowNonStok.style.color = ''; }
        if(btnShowHistory) { btnShowHistory.className = 'btn btn-secondary'; btnShowHistory.style.background = ''; btnShowHistory.style.color = ''; }
        if(formStokContainer) formStokContainer.style.display = 'none';
        if(formNonStokContainer) formNonStokContainer.style.display = 'none';
        if(historyContainer) historyContainer.style.display = 'none';
    }

    if (btnShowStok) {
        btnShowStok.addEventListener('click', () => {
            resetTabButtons();
            formStokContainer.style.display = 'block';
            btnShowStok.className = 'btn btn-primary';
            btnShowStok.style.background = '#1e40af';
            btnShowStok.style.color = 'white';
            renderStokForm();
        });
    }
    
    if (btnShowNonStok) {
        btnShowNonStok.addEventListener('click', () => {
            resetTabButtons();
            formNonStokContainer.style.display = 'block';
            btnShowNonStok.className = 'btn btn-primary';
            btnShowNonStok.style.background = '#1e40af';
            btnShowNonStok.style.color = 'white';
            renderNonStokForm();
        });
    }

    if (btnShowHistory) {
        btnShowHistory.addEventListener('click', () => {
            resetTabButtons();
            historyContainer.style.display = 'block';
            btnShowHistory.className = 'btn btn-primary';
            btnShowHistory.style.background = '#1e40af';
            btnShowHistory.style.color = 'white';
            
            const monthFilter = document.getElementById('history-month-filter');
            if (monthFilter && !monthFilter.value) {
                const today = new Date();
                monthFilter.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
                window.loadTransactionHistory();
            }
        });
    }

    // Form submit listeners
    const formStok = document.getElementById('form-transaksi-stok');
    if (formStok) {
        formStok.addEventListener('submit', (e) => handleTransactionSubmit(e, 'stok'));
    }

    const formNonStok = document.getElementById('form-transaksi-nonstok');
    if (formNonStok) {
        formNonStok.addEventListener('submit', (e) => handleTransactionSubmit(e, 'non-stok'));
    }
}

function updateDropdownsAll() {
    const formStokContainer = document.getElementById('form-stok-container');
    const formNonStokContainer = document.getElementById('form-nonstok-container');
    
    if (formStokContainer && formStokContainer.style.display === 'block') {
        updateDropdowns('stok');
    }
    if (formNonStokContainer && formNonStokContainer.style.display === 'block') {
        const type = document.getElementById('nonstok-tx-type') ? document.getElementById('nonstok-tx-type').value : '';
        if (type === 'revenue') updateDropdowns('non-stok-revenue');
        else if (type === 'expense') updateDropdowns('non-stok-expense');
    }
}

function renderStokForm() {
    const container = document.getElementById('form-stok-fields');
    if (!container) return;

    container.innerHTML = `
        <div class="form-section">
            <label for="stok-tx-date">Tanggal Pembelian</label>
            <input type="date" id="stok-tx-date" required class="form-input">
        </div>
        <div class="form-section">
            <label for="stok-tx-account">Sumber Dana (Kredit: Kas/Bank)</label>
            <select id="stok-tx-account" required class="form-input" style="background: white;"></select>
        </div>
        <div class="form-section" style="margin-top: 15px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; color: #1e40af;">Detail Pembelian Stok</h4>
            
            <!-- TABEL RINCIAN ITEM STOK -->
            <div class="form-section">
                <label style="margin-bottom: 8px; display: block;">Rincian Barang</label>
                <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: white;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                        <thead style="background: #e2e8f0; border-bottom: 1px solid #cbd5e1;">
                            <tr>
                                <th style="padding: 8px; font-weight: 600; color: #1e40af;">Kelompok Stok</th>
                                <th style="padding: 8px; font-weight: 600; color: #1e40af;">Barang Stok</th>
                                <th style="padding: 8px; font-weight: 600; width: 70px; color: #1e40af;">Satuan</th>
                                <th style="padding: 8px; font-weight: 600; width: 60px; color: #1e40af;">Qty</th>
                                <th style="padding: 8px; font-weight: 600; width: 110px; color: #1e40af;">Harga Satuan</th>
                                <th style="padding: 8px; font-weight: 600; width: 110px; color: #1e40af;">Total</th>
                                <th style="padding: 8px; width: 40px;"></th>
                            </tr>
                        </thead>
                        <tbody id="stok-items-tbody">
                            <tr>
                                <td style="padding: 4px;"><select class="stok-category form-input" required style="padding: 6px; font-size: 12px; border: 1px solid #94a3b8; width: 100%;" onchange="filterStokRowItems(this)"></select></td>
                                <td style="padding: 4px;"><select class="stok-item form-input" required style="padding: 6px; font-size: 12px; border: 1px solid #94a3b8; width: 100%;" onchange="fillStokUnit(this)"><option value="">-- Pilih Barang --</option></select></td>
                                <td style="padding: 4px;"><input type="text" class="stok-unit form-input" required readonly placeholder="-" style="padding: 6px; font-size: 12px; background: #e2e8f0; border: 1px solid #94a3b8; text-align: center; color: #475569;"></td>
                                <td style="padding: 4px;"><input type="number" class="stok-qty form-input" required min="1" step="0.01" value="1" oninput="calcStokTotal(this)" style="padding: 6px; font-size: 12px; border: 1px solid #94a3b8;"></td>
                                <td style="padding: 4px;"><input type="number" class="stok-price form-input" required min="0" oninput="calcStokTotal(this)" style="padding: 6px; font-size: 12px; border: 1px solid #94a3b8;"></td>
                                <td style="padding: 4px;"><input type="number" class="stok-total form-input" required readonly style="padding: 6px; font-size: 12px; background: #f1f5f9; font-weight: bold; border: 1px solid #94a3b8; color: #1e40af;"></td>
                                <td style="padding: 4px; text-align: center;"><button type="button" class="btn-small-danger" onclick="removeStokRow(this)" style="padding: 4px 8px; background: #ef4444; border: none;">X</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <button type="button" class="btn btn-secondary" onclick="addStokRow()" style="margin-top: 8px; padding: 6px 12px; font-size: 12px; background: white; border: 1px solid #94a3b8; color: #1e40af;">+ Tambah Barang</button>
            </div>

            <div class="form-section">
                <label for="stok-tx-amount">Total Nominal (Rp)</label>
                <input type="number" id="stok-tx-amount" required readonly class="form-input" style="background: #e5e7eb; font-weight: bold; color: #111827; font-size: 16px; border: 1px solid #cbd5e1;">
            </div>
            <div class="form-section" style="margin-bottom: 0;">
                <label for="stok-tx-description">Keterangan / Nama Supplier</label>
                <input type="text" id="stok-tx-description" required placeholder="Contoh: Beli Daging di Pasar X" class="form-input">
            </div>
        </div>
    `;

    const dateInput = document.getElementById('stok-tx-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    updateDropdowns('stok');
}

function renderNonStokForm() {
    const container = document.getElementById('form-nonstok-fields');
    if (!container) return;

    container.innerHTML = `
        <div class="form-section">
            <label for="nonstok-tx-date">Tanggal Transaksi</label>
            <input type="date" id="nonstok-tx-date" required class="form-input">
        </div>
        <div class="form-section">
            <label for="nonstok-tx-type">Jenis Transaksi</label>
            <select id="nonstok-tx-type" required class="form-input" style="background: white;" onchange="renderNonStokSubFields()">
                <option value="">-- Pilih Jenis --</option>
                <option value="revenue">Uang Masuk (Pendapatan Lain)</option>
                <option value="expense">Uang Keluar (Biaya Operasional)</option>
            </select>
        </div>
        <div id="nonstok-sub-fields"></div>
    `;

    const dateInput = document.getElementById('nonstok-tx-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
}

window.renderNonStokSubFields = function() {
    const type = document.getElementById('nonstok-tx-type').value;
    const subContainer = document.getElementById('nonstok-sub-fields');
    if (!subContainer) return;

    if (type === 'revenue') {
        subContainer.innerHTML = `
            <div class="form-section" style="margin-top: 15px; padding: 15px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; color: #166534;">Detail Uang Masuk</h4>
                <div class="form-section">
                    <label for="nonstok-tx-account-in">Masuk ke Akun (Debit: Kas/Bank)</label>
                    <select id="nonstok-tx-account-in" required class="form-input" style="background: white;"></select>
                </div>
                <div class="form-section">
                    <label for="nonstok-tx-category-in">Kategori Pendapatan (Kredit: Pendapatan)</label>
                    <select id="nonstok-tx-category-in" required class="form-input" style="background: white;"></select>
                </div>
                <div class="form-section">
                    <label for="nonstok-tx-amount-in">Nominal (Rp)</label>
                    <input type="number" id="nonstok-tx-amount-in" required min="0" class="form-input">
                </div>
                <div class="form-section" style="margin-bottom: 0;">
                    <label for="nonstok-tx-description-in">Keterangan / Catatan</label>
                    <input type="text" id="nonstok-tx-description-in" required placeholder="Contoh: Bunga bank BCA bulan ini" class="form-input">
                </div>
            </div>
        `;
        updateDropdowns('non-stok-revenue');
    } else if (type === 'expense') {
        subContainer.innerHTML = `
            <div class="form-section" style="margin-top: 15px; padding: 15px; background: #fff1f2; border: 1px solid #fecaca; border-radius: 8px;">
                <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; color: #991b1b;">Detail Biaya Operasional</h4>
                <div class="form-section">
                    <label for="nonstok-tx-account-out">Sumber Dana (Kredit: Kas/Bank)</label>
                    <select id="nonstok-tx-account-out" required class="form-input" style="background: white;"></select>
                </div>
                <div class="form-section">
                    <label for="nonstok-tx-category-out">Kelompok Biaya Non Stok</label>
                    <select id="nonstok-tx-category-out" required class="form-input" style="background: white;"></select>
                </div>
                
                <!-- TABEL RINCIAN ITEM BIAYA -->
                <div class="form-section">
                    <label style="margin-bottom: 8px; display: block;">Rincian Item Biaya</label>
                    <div style="border: 1px solid #fecaca; border-radius: 8px; overflow: hidden; background: white;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                            <thead style="background: #fee2e2; border-bottom: 1px solid #fecaca;">
                                <tr>
                                    <th style="padding: 8px; font-weight: 600; color: #991b1b;">Nama Barang/Biaya</th>
                                    <th style="padding: 8px; font-weight: 600; width: 80px; color: #991b1b;">Satuan</th>
                                    <th style="padding: 8px; font-weight: 600; width: 60px; color: #991b1b;">Qty</th>
                                    <th style="padding: 8px; font-weight: 600; width: 110px; color: #991b1b;">Harga Satuan</th>
                                    <th style="padding: 8px; font-weight: 600; width: 110px; color: #991b1b;">Total</th>
                                    <th style="padding: 8px; width: 40px;"></th>
                                </tr>
                            </thead>
                            <tbody id="expense-items-tbody">
                                <tr>
                                    <td style="padding: 4px;"><input type="text" class="exp-name form-input" required placeholder="Contoh: Kertas HVS" style="padding: 6px; font-size: 12px; border: 1px solid #fca5a5;"></td>
                                    <td style="padding: 4px;"><input type="text" class="exp-unit form-input" placeholder="Mis: Rim" style="padding: 6px; font-size: 12px; border: 1px solid #fca5a5; text-align: center;"></td>
                                    <td style="padding: 4px;"><input type="number" class="exp-qty form-input" required min="1" value="1" oninput="calcExpTotal(this)" style="padding: 6px; font-size: 12px; border: 1px solid #fca5a5;"></td>
                                    <td style="padding: 4px;"><input type="number" class="exp-price form-input" required min="0" oninput="calcExpTotal(this)" style="padding: 6px; font-size: 12px; border: 1px solid #fca5a5;"></td>
                                    <td style="padding: 4px;"><input type="number" class="exp-total form-input" required readonly style="padding: 6px; font-size: 12px; background: #fee2e2; font-weight: bold; border: 1px solid #fca5a5; color: #991b1b;"></td>
                                    <td style="padding: 4px; text-align: center;"><button type="button" class="btn-small-danger" onclick="removeExpRow(this)" style="padding: 4px 8px; background: #ef4444; border: none;">X</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <button type="button" class="btn btn-secondary" onclick="addExpRow()" style="margin-top: 8px; padding: 6px 12px; font-size: 12px; background: white; border: 1px solid #fca5a5; color: #dc2626;">+ Tambah Baris</button>
                </div>

                <div class="form-section">
                    <label for="nonstok-tx-amount-out">Total Keseluruhan (Rp)</label>
                    <input type="number" id="nonstok-tx-amount-out" required readonly class="form-input" style="background: #fee2e2; font-weight: bold; color: #991b1b; font-size: 16px; border: 1px solid #fecaca;">
                </div>
                <div class="form-section" style="margin-bottom: 0;">
                    <label for="nonstok-tx-description-out">Keterangan Tambahan (Opsional)</label>
                    <input type="text" id="nonstok-tx-description-out" placeholder="Catatan tambahan jika ada..." class="form-input" style="border: 1px solid #fca5a5;">
                </div>
            </div>
        `;
        updateDropdowns('non-stok-expense');
    } else {
        subContainer.innerHTML = '';
    }
}

function updateDropdowns(formType) {
    if (formType === 'stok') {
        populateSelect('stok-tx-account', keuanganMasterData.accounts, 'Pilih Akun Kas/Bank');
        
        // Populate all existing category dropdowns in the table
        const catSelects = document.querySelectorAll('.stok-category');
        const catData = keuanganMasterData.hppCategories || {};
        catSelects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
            Object.keys(catData).forEach(key => {
                select.innerHTML += `<option value="${key}">${catData[key].name}</option>`;
            });
            if (currentVal && catData[currentVal]) select.value = currentVal;
            if (typeof window.filterStokRowItems === 'function') window.filterStokRowItems(select);
        });
        
    } else if (formType === 'non-stok-revenue') {
        populateSelect('nonstok-tx-account-in', keuanganMasterData.accounts, 'Pilih Akun Kas/Bank');
        populateSelect('nonstok-tx-category-in', keuanganMasterData.revenues, 'Pilih Kategori Pendapatan');
    } else if (formType === 'non-stok-expense') {
        populateSelect('nonstok-tx-account-out', keuanganMasterData.accounts, 'Pilih Akun Kas/Bank');
        populateSelect('nonstok-tx-category-out', keuanganMasterData.expenses, 'Pilih Kelompok Biaya Non Stok');
    }
}

function populateSelect(elementId, dataObj, placeholder) { // This function is now used by updateDropdowns
    const el = document.getElementById(elementId);
    if (!el) return;
    const currentVal = el.value;
    el.innerHTML = `<option value="">-- ${placeholder} --</option>`;
    Object.keys(dataObj).forEach(key => {
        const name = dataObj[key].name;
        const extra = dataObj[key].number ? ` - ${dataObj[key].number}` : (dataObj[key].unit ? ` (${dataObj[key].unit})` : '');
        el.innerHTML += `<option value="${key}">${name}${extra}</option>`;
    });
    if (currentVal && dataObj[currentVal]) el.value = currentVal;
}

window.filterStokRowItems = function(selectElement) {
    const tr = selectElement.closest('tr');
    const itemSelect = tr.querySelector('.stok-item');
    const catId = selectElement.value;
    const currentVal = itemSelect.value;
    
    itemSelect.innerHTML = '<option value="">-- Pilih Barang --</option>';
    if (!catId) return;
    
    const hppData = keuanganMasterData.hpp || {};
    Object.keys(hppData).forEach(k => {
        if (hppData[k].category_id === catId) {
            const item = hppData[k];
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = item.name;
            opt.setAttribute('data-unit', item.unit || '-');
            opt.setAttribute('data-price', item.price || 0);
            itemSelect.appendChild(opt);
        }
    });
    
    if (currentVal && hppData[currentVal] && hppData[currentVal].category_id === catId) {
        itemSelect.value = currentVal;
    }
    window.fillStokUnit(itemSelect);
};

window.fillStokUnit = function(selectElement) {
    const tr = selectElement.closest('tr');
    const unitInput = tr.querySelector('.stok-unit');
    const priceInput = tr.querySelector('.stok-price');
    
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (selectedOption && selectedOption.value) {
        if (unitInput) unitInput.value = selectedOption.getAttribute('data-unit') || '-';
        if (priceInput && selectedOption.getAttribute('data-price')) {
            const defPrice = parseFloat(selectedOption.getAttribute('data-price')) || 0;
            if (defPrice > 0) {
                priceInput.value = defPrice;
                if (typeof window.calcStokTotal === 'function') window.calcStokTotal(priceInput);
            }
        }
    } else {
        if (unitInput) unitInput.value = '-';
    }
};

window.addStokRow = function() {
    const tbody = document.getElementById('stok-items-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="padding: 4px;"><select class="stok-category form-input" required style="padding: 6px; font-size: 12px; border: 1px solid #94a3b8; width: 100%;" onchange="filterStokRowItems(this)"></select></td>
        <td style="padding: 4px;"><select class="stok-item form-input" required style="padding: 6px; font-size: 12px; border: 1px solid #94a3b8; width: 100%;" onchange="fillStokUnit(this)"><option value="">-- Pilih Barang --</option></select></td>
        <td style="padding: 4px;"><input type="text" class="stok-unit form-input" required readonly placeholder="-" style="padding: 6px; font-size: 12px; background: #e2e8f0; border: 1px solid #94a3b8; text-align: center; color: #475569;"></td>
        <td style="padding: 4px;"><input type="number" class="stok-qty form-input" required min="1" step="0.01" value="1" oninput="calcStokTotal(this)" style="padding: 6px; font-size: 12px; border: 1px solid #94a3b8;"></td>
        <td style="padding: 4px;"><input type="number" class="stok-price form-input" required min="0" oninput="calcStokTotal(this)" style="padding: 6px; font-size: 12px; border: 1px solid #94a3b8;"></td>
        <td style="padding: 4px;"><input type="number" class="stok-total form-input" required readonly style="padding: 6px; font-size: 12px; background: #f1f5f9; font-weight: bold; border: 1px solid #94a3b8; color: #1e40af;"></td>
        <td style="padding: 4px; text-align: center;"><button type="button" class="btn-small-danger" onclick="removeStokRow(this)" style="padding: 4px 8px; background: #ef4444; border: none;">X</button></td>
    `;
    tbody.appendChild(tr);
    
    const catSelect = tr.querySelector('.stok-category');
    catSelect.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
    const catData = keuanganMasterData.hppCategories || {};
    Object.keys(catData).forEach(key => {
        catSelect.innerHTML += `<option value="${key}">${catData[key].name}</option>`;
    });
    
    updateStokGrandTotal();
};

window.removeStokRow = function(btn) {
    const tbody = document.getElementById('stok-items-tbody');
    if (tbody && tbody.children.length > 1) {
        btn.closest('tr').remove();
        updateStokGrandTotal();
    } else {
        alert("Minimal harus ada 1 baris rincian.");
    }
};

window.calcStokTotal = function(input) {
    const tr = input.closest('tr');
    const qty = parseFloat(tr.querySelector('.stok-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.stok-price').value) || 0;
    tr.querySelector('.stok-total').value = qty * price;
    updateStokGrandTotal();
};

window.updateStokGrandTotal = function() {
    const totals = document.querySelectorAll('.stok-total');
    let grand = 0;
    totals.forEach(t => grand += (parseFloat(t.value) || 0));
    const grandInput = document.getElementById('stok-tx-amount');
    if (grandInput) grandInput.value = grand;
};

// Fungsi dinamis untuk Tabel Biaya Operasional (Non-Stok)
window.addExpRow = function() {
    const tbody = document.getElementById('expense-items-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="padding: 4px;"><input type="text" class="exp-name form-input" required placeholder="Nama Barang/Biaya" style="padding: 6px; font-size: 12px; border: 1px solid #fca5a5;"></td>
        <td style="padding: 4px;"><input type="text" class="exp-unit form-input" placeholder="Mis: Rim" style="padding: 6px; font-size: 12px; border: 1px solid #fca5a5; text-align: center;"></td>
        <td style="padding: 4px;"><input type="number" class="exp-qty form-input" required min="1" value="1" oninput="calcExpTotal(this)" style="padding: 6px; font-size: 12px; border: 1px solid #fca5a5;"></td>
        <td style="padding: 4px;"><input type="number" class="exp-price form-input" required min="0" oninput="calcExpTotal(this)" style="padding: 6px; font-size: 12px; border: 1px solid #fca5a5;"></td>
        <td style="padding: 4px;"><input type="number" class="exp-total form-input" required readonly style="padding: 6px; font-size: 12px; background: #fee2e2; font-weight: bold; border: 1px solid #fca5a5; color: #991b1b;"></td>
        <td style="padding: 4px; text-align: center;"><button type="button" class="btn-small-danger" onclick="removeExpRow(this)" style="padding: 4px 8px; background: #ef4444; border: none;">X</button></td>
    `;
    tbody.appendChild(tr);
    updateExpGrandTotal();
};

window.removeExpRow = function(btn) {
    const tbody = document.getElementById('expense-items-tbody');
    if (tbody && tbody.children.length > 1) {
        btn.closest('tr').remove();
        updateExpGrandTotal();
    } else {
        alert("Minimal harus ada 1 baris rincian.");
    }
};

window.calcExpTotal = function(input) {
    const tr = input.closest('tr');
    const qty = parseFloat(tr.querySelector('.exp-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.exp-price').value) || 0;
    tr.querySelector('.exp-total').value = qty * price;
    updateExpGrandTotal();
};

window.updateExpGrandTotal = function() {
    const totals = document.querySelectorAll('.exp-total');
    let grand = 0;
    totals.forEach(t => grand += (parseFloat(t.value) || 0));
    const grandInput = document.getElementById('nonstok-tx-amount-out');
    if (grandInput) grandInput.value = grand;
};

function handleTransactionSubmit(e, formType) {
    e.preventDefault();
    
    let date, type, account, amount, description, name;
    let isHpp = false;
    let item_id = null;
    let qty = 0;
    let unit_price = 0;
    let category;
    let detailItems = [];

    if (formType === 'stok') {
        date = document.getElementById('stok-tx-date').value;
        type = 'expense';
        account = document.getElementById('stok-tx-account').value;
        amount = parseFloat(document.getElementById('stok-tx-amount').value);
        description = document.getElementById('stok-tx-description').value;
        isHpp = true;
        
        let itemsText = [];
        const itemSelects = document.querySelectorAll('.stok-item');
        const qtys = document.querySelectorAll('.stok-qty');
        const prices = document.querySelectorAll('.stok-price');
        const units = document.querySelectorAll('.stok-unit');
        
        itemSelects.forEach((el, idx) => {
            const itemId = el.value;
            if (itemId) {
                const itemQty = parseFloat(qtys[idx].value) || 0;
                const itemPrice = parseFloat(prices[idx].value) || 0;
                const itemUnit = units[idx] ? units[idx].value : '';
                const itemName = el.options[el.selectedIndex].text;
                itemsText.push(`${itemName} x${itemQty} ${itemUnit}`.trim());
                detailItems.push({ id: itemId, name: itemName, qty: itemQty, unit: itemUnit, price: itemPrice });
            }
        });
        name = `Pembelian Stok: ${itemsText.join(', ')}`;
        if (!name || name === 'Pembelian Stok: ') name = "Pembelian Stok";
    } else { // non-stok
        date = document.getElementById('nonstok-tx-date').value;
        type = document.getElementById('nonstok-tx-type').value;
        if (type === 'revenue') {
            account = document.getElementById('nonstok-tx-account-in').value;
            amount = parseFloat(document.getElementById('nonstok-tx-amount-in').value);
            description = document.getElementById('nonstok-tx-description-in').value;
            category = document.getElementById('nonstok-tx-category-in').value;
            const catSelect = document.getElementById('nonstok-tx-category-in');
            name = catSelect.options[catSelect.selectedIndex] ? catSelect.options[catSelect.selectedIndex].text : 'Pendapatan Lain';
        } else { // expense
            account = document.getElementById('nonstok-tx-account-out').value;
            amount = parseFloat(document.getElementById('nonstok-tx-amount-out').value);
            description = document.getElementById('nonstok-tx-description-out').value;
            category = document.getElementById('nonstok-tx-category-out').value;
            
            let itemsText = [];
            const names = document.querySelectorAll('.exp-name');
            const qtys = document.querySelectorAll('.exp-qty');
            const prices = document.querySelectorAll('.exp-price');
            const units = document.querySelectorAll('.exp-unit');
            names.forEach((el, idx) => {
                const itemName = el.value.trim();
                const itemQty = qtys[idx] ? parseFloat(qtys[idx].value) || 0 : 0;
                const itemPrice = prices[idx] ? parseFloat(prices[idx].value) || 0 : 0;
                const itemUnit = units[idx] ? units[idx].value.trim() : '';
                if (itemName) {
                    itemsText.push(`${itemName} x${itemQty} ${itemUnit}`.trim());
                    detailItems.push({ name: itemName, qty: itemQty, unit: itemUnit, price: itemPrice });
                }
            });
            name = itemsText.join(', ');
            if (!name) name = "Pengeluaran Non-Stok";
        }
    }

    const journalPayload = {
        date: date,
        type: type,
        name: name,
        description: description,
        total_amount: amount,
        created_at: new Date().toISOString(),
        journal_lines: {},
        details: detailItems
    };

    if (type === 'revenue') {
        journalPayload.journal_lines['debit'] = { account_type: 'asset', account_id: account, amount: amount };
        journalPayload.journal_lines['credit'] = { account_type: 'revenue', account_id: category, amount: amount };
    } else if (type === 'expense') {
        if (isHpp) {
            const mainItem = detailItems[0] || { id: null, qty: 0, price: 0 };
            journalPayload.journal_lines['debit'] = { account_type: 'inventory', account_id: mainItem.id, amount: amount, qty: mainItem.qty, unit_price: mainItem.price };
            journalPayload.journal_lines['credit'] = { account_type: 'asset', account_id: account, amount: amount };
        } else {
            journalPayload.journal_lines['debit'] = { account_type: 'expense', account_id: category, amount: amount };
            journalPayload.journal_lines['credit'] = { account_type: 'asset', account_id: account, amount: amount };
        }
    }
    journalPayload.is_hpp = isHpp;

    const btn = e.submitter || (e.target && e.target.querySelector ? e.target.querySelector('button[type="submit"], button') : null);
    let origText = 'Menyimpan...';
    if (btn) {
        origText = btn.textContent;
        btn.textContent = 'Menyimpan... ⏳';
        btn.disabled = true;
    }

    const outlet = getOutletLR();
    const txRef = rbmDb.ref(`rbm_pro/transactions/${outlet}`).push();
    txRef.set(journalPayload).then(() => {
        if (isHpp && detailItems.length > 0) {
            const promises = detailItems.map(d => {
                return rbmDb.ref(`rbm_pro/inventory/movements/${outlet}`).push({
                    date: date,
                    item_id: d.id,
                    type: 'purchase',
                    qty: d.qty,
                    unit_price: d.price,
                    total: d.qty * d.price,
                    transaction_id: txRef.key,
                    created_at: new Date().toISOString()
                });
            });
            return Promise.all(promises);
        }
    }).then(() => {
        alert("Transaksi berhasil disimpan!");
        e.target.reset();
        if (formType === 'stok') {
            document.getElementById('stok-tx-date').value = date;
            renderStokForm();
        } else {
            document.getElementById('nonstok-tx-date').value = date;
            renderNonStokForm();
        }
    }).catch((error) => {
        alert("Gagal menyimpan: " + error.message);
    }).finally(() => {
        if (btn) {
            btn.textContent = origText;
            btn.disabled = false;
        }
    });
}

window.loadTransactionHistory = function() {
    const tbody = document.getElementById('history-tbody');
    const monthVal = document.getElementById('history-month-filter') ? document.getElementById('history-month-filter').value : '';
    if (!tbody || !monthVal) return;

    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Memuat data... ⏳</td></tr>';

    const outlet = getOutletLR();
    const startObj = monthVal + '-01';
    const endObj = monthVal + '-31';

    rbmDb.ref(`rbm_pro/transactions/${outlet}`).orderByChild('date').startAt(startObj).endAt(endObj).once('value').then(snap => {
        const data = snap.val() || {};
        tbody.innerHTML = '';
        
        const txList = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        txList.sort((a,b) => b.created_at.localeCompare(a.created_at)); 
        
        if (txList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Tidak ada transaksi di bulan ini.</td></tr>';
            return;
        }

        txList.forEach(tx => {
            let typeLabel = '';
            let color = '';
            if (tx.type === 'revenue') { typeLabel = 'Pendapatan'; color = '#166534'; }
            else if (tx.type === 'expense' && tx.is_hpp) { typeLabel = 'Stok HPP'; color = '#92400e'; }
            else { typeLabel = 'Biaya'; color = '#991b1b'; }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9;">${tx.date}</td>
                <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9;">
                <strong style="color: #1e293b;">${tx.name || '-'}</strong>
                ${tx.description ? `<br><span style="font-size: 11px; color: #64748b;">${tx.description}</span>` : ''}
                </td>
                <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; color: ${color}; font-weight: 500;">${typeLabel}</td>
                <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold; color: #1e293b;">Rp ${Math.round(tx.total_amount || 0).toLocaleString('id-ID')}</td>
                <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; text-align: center; white-space: nowrap;">
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;" onclick="alert('Demi menjaga keseimbangan Akuntansi & Stok, fitur Edit dilakukan dengan cara:\\n1. Hapus transaksi yang salah ini.\\n2. Input ulang transaksi yang benar di tab sebelumnya.')">Edit</button>
                    <button class="btn-small-danger" onclick="deleteTransaction('${tx.id}', ${tx.is_hpp})">Hapus</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }).catch(err => {
        tbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="color:red;">Error: ${err.message}</td></tr>`;
    });
};

window.deleteTransaction = function(txId, isHpp) {
    if (!confirm('Yakin ingin menghapus transaksi ini? (Aksi ini tidak dapat dibatalkan)')) return;
    const outlet = getOutletLR();
    
    if (isHpp) {
        rbmDb.ref(`rbm_pro/inventory/movements/${outlet}`).orderByChild('transaction_id').equalTo(txId).once('value').then(snap => {
            const moves = snap.val();
            if (moves) {
                const updates = {};
                Object.keys(moves).forEach(k => { updates[k] = null; });
                return rbmDb.ref(`rbm_pro/inventory/movements/${outlet}`).update(updates);
            }
        }).then(() => {
            return rbmDb.ref(`rbm_pro/transactions/${outlet}/${txId}`).remove();
        }).then(() => {
            alert('Transaksi dan riwayat stok berhasil dihapus.');
            window.loadTransactionHistory();
        }).catch(err => alert('Gagal menghapus: ' + err.message));
    } else {
        rbmDb.ref(`rbm_pro/transactions/${outlet}/${txId}`).remove().then(() => {
            alert('Transaksi berhasil dihapus.');
            window.loadTransactionHistory();
        }).catch(err => alert('Gagal menghapus: ' + err.message));
    }
};

function initReportPage() {
    console.log("Halaman Laporan Keuangan & Stok Aktif");
    const btnGenerate = document.getElementById('btn-generate-report');
    btnGenerate.addEventListener('click', generateReports);

    // Setel default tanggal dari awal bulan hingga hari ini
    const dateStart = document.getElementById('start-date');
    const dateEnd = document.getElementById('end-date');
    const today = new Date();
    if (dateStart) dateStart.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    if (dateEnd) dateEnd.value = today.toISOString().split('T')[0];
    
    const outletSel = document.getElementById('rbm-outlet-select');
    if (outletSel) {
        outletSel.addEventListener('change', () => {
            const lrCont = document.getElementById('report-laba-rugi-container');
            const kbCont = document.getElementById('report-kas-bank-container');
            if(lrCont) lrCont.innerHTML = '<p style="color:#6b7280; font-size:13px; text-align:center; margin: 0;">Pilih rentang tanggal dan klik "Tampilkan Laporan".</p>';
            if(kbCont) kbCont.innerHTML = '<p style="color:#6b7280; font-size:13px; text-align:center; margin: 0;">Pilih rentang tanggal dan klik "Tampilkan Laporan".</p>';
        });
    }
}

// Fungsi Navigasi Tab Laporan
window.switchReportTab = function(tabId) {
    const tabs = ['lr', 'mutasi', 'stok'];
    tabs.forEach(t => {
        const card = document.getElementById('tab-content-' + t);
        const btn = document.getElementById('tab-btn-' + t);
        if (card) card.style.display = 'none';
        if (btn) btn.classList.remove('active');
    });
    
    const activeCard = document.getElementById('tab-content-' + tabId);
    const activeBtn = document.getElementById('tab-btn-' + tabId);
    if (activeCard) activeCard.style.display = 'block';
    if (activeBtn) activeBtn.classList.add('active');
};

async function generateReports() {
    
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) {
        alert("Pilih rentang tanggal terlebih dahulu.");
        return;
    }

    const btnGenerate = document.getElementById('btn-generate-report');
    const originalText = btnGenerate.textContent;
    btnGenerate.textContent = 'Memuat Laporan... ⏳';
    btnGenerate.disabled = true;

    try {
        const outlet = getOutletLR();

        // A. Panggil ulang Master Data untuk outlet spesifik sebelum memproses laporan
        const accSnap = await rbmDb.ref(`rbm_pro/laba_rugi_settings/${outlet}/accounts`).once('value'); keuanganMasterData.accounts = accSnap.val() || {};
        const revSnap = await rbmDb.ref(`rbm_pro/laba_rugi_settings/${outlet}/revenue_types`).once('value'); keuanganMasterData.revenues = revSnap.val() || {};
        const expSnap = await rbmDb.ref(`rbm_pro/laba_rugi_settings/${outlet}/expense_categories`).once('value'); keuanganMasterData.expenses = expSnap.val() || {};
        const hppSnap = await rbmDb.ref(`rbm_pro/laba_rugi_settings/${outlet}/hpp_items`).once('value'); keuanganMasterData.hpp = hppSnap.val() || {};
        const hppCatSnap = await rbmDb.ref(`rbm_pro/laba_rugi_settings/${outlet}/hpp_categories`).once('value'); keuanganMasterData.hppCategories = hppCatSnap.val() || {};

        // Populate dropdown filter akun mutasi
        const filterAkun = document.getElementById('filter-mutasi-akun');
        if (filterAkun) {
            const currentVal = filterAkun.value;
            filterAkun.innerHTML = '<option value="all">-- Semua Akun Kas/Bank --</option>';
            Object.keys(keuanganMasterData.accounts).forEach(accId => {
                const acc = keuanganMasterData.accounts[accId];
                const name = acc.name;
                const num = acc.number ? ` - ${acc.number}` : '';
                filterAkun.innerHTML += `<option value="${accId}">${name}${num}</option>`;
            });
            if (currentVal && (currentVal === 'all' || keuanganMasterData.accounts[currentVal])) filterAkun.value = currentVal;
            filterAkun.style.display = 'block';
        }

        // ==========================================
        // --- 1. PROSES LAPORAN LABA RUGI ---
        // ==========================================
        
        // A. Ambil Total Pendapatan Kasir (Aplikasi POS)
        let totalPosRevenue = 0;
        
        const startTs = new Date(startDate + 'T00:00:00').getTime();
        const endTs = new Date(endDate + 'T23:59:59').getTime();

        const snap = await rbmDb.ref(`orders/${outlet}`).orderByChild('date').startAt(startTs).endAt(endTs).once('value');
        const orders = snap.val() || {};
        Object.values(orders).forEach(o => {
            if (['Sudah Dibayar', 'Diproses', 'Siap Diambil', 'Selesai'].includes(o.status)) {
                totalPosRevenue += parseFloat(o.payment?.total || 0);
            }
        });

        // B. Ambil Transaksi Keuangan Manual (rbm_pro/transactions)
        let totalOtherRevenue = 0;
        let totalHpp = 0;
        let totalExpense = 0;
        
        const rincianPendapatanLain = {};
        const rincianHpp = {}; // Format struktur baru: { catId: { total: 0, items: { itemId: amount } } }
        const rincianBiaya = {};

        // Mengambil SELURUH transaksi hingga endDate untuk menghitung Saldo Awal Mutasi
        const txAllSnap = await rbmDb.ref(`rbm_pro/transactions/${outlet}`).orderByChild('date').endAt(endDate).once('value');
        const allTransactions = txAllSnap.val() || {};

        // Setup wadah Buku Besar per Akun
        const accountsLedger = {};
        Object.keys(keuanganMasterData.accounts).forEach(accId => {
            accountsLedger[accId] = { name: keuanganMasterData.accounts[accId].name, saldoAwal: 0, mutasi: [], saldoAkhir: 0 };
        });

        Object.values(allTransactions).forEach(tx => {
            const txDate = tx.date;
            const amount = parseFloat(tx.total_amount || 0);
            
            let accId = null;
            let isMasuk = false;

            // Logika Jurnal Berpasangan
            if (tx.type === 'revenue') { accId = tx.journal_lines?.debit?.account_id; isMasuk = true; } 
            else if (tx.type === 'expense') { accId = tx.journal_lines?.credit?.account_id; isMasuk = false; }

            // Pemisahan Transaksi berdasar Rentang Tanggal
            if (txDate < startDate) {
                // 1. Akumulasi untuk Saldo Awal (Sebelum tanggal laporan)
                if (accId && accountsLedger[accId]) {
                    if (isMasuk) accountsLedger[accId].saldoAwal += amount;
                    else accountsLedger[accId].saldoAwal -= amount;
                }
            } else if (txDate >= startDate && txDate <= endDate) {
                // 2. Akumulasi Mutasi Kas/Bank Bulan/Hari Ini
                if (accId && accountsLedger[accId]) {
                    let typeLabel = '';
                    if (tx.type === 'revenue') typeLabel = 'Pendapatan';
                    else if (tx.type === 'expense' && tx.is_hpp) typeLabel = 'Pembelian HPP';
                    else typeLabel = 'Biaya / Pengeluaran';

                    let detailsHtml = '';
                    if (tx.details && tx.details.length > 0) {
                        detailsHtml = tx.details.map(d => {
                            const u = d.unit && d.unit !== '-' ? ` ${d.unit}` : '';
                            const total = (d.qty || 0) * (d.price || 0);
                            return `<div style="font-size:11px; color:#059669; margin-bottom:2px;">📦 ${d.name}: ${d.qty}${u} &times; Rp ${Math.round(d.price).toLocaleString('id-ID')} = <strong>Rp ${Math.round(total).toLocaleString('id-ID')}</strong></div>`;
                        }).join('');
                    } else if (tx.is_hpp && tx.journal_lines && tx.journal_lines.debit && tx.journal_lines.debit.qty) {
                        const q = tx.journal_lines.debit.qty;
                        const p = tx.journal_lines.debit.unit_price;
                        const total = (q || 0) * (p || 0);
                        detailsHtml = `<div style="font-size:11px; color:#059669; margin-bottom:2px;">📦 Qty: ${q} &times; Rp ${Math.round(p).toLocaleString('id-ID')} = <strong>Rp ${Math.round(total).toLocaleString('id-ID')}</strong></div>`;
                    }

                    accountsLedger[accId].mutasi.push({ date: txDate, name: tx.name || '-', description: tx.description || '', masuk: isMasuk ? amount : 0, keluar: !isMasuk ? amount : 0, typeLabel: typeLabel, detailsHtml: detailsHtml });
                }
                
                // 3. Akumulasi untuk Laba Rugi
                if (tx.type === 'revenue') {
                    totalOtherRevenue += amount;
                    const catId = tx.journal_lines?.credit?.account_id || 'Lainnya';
                    rincianPendapatanLain[catId] = (rincianPendapatanLain[catId] || 0) + amount;
                } else if (tx.type === 'expense') {
                    if (tx.is_hpp) {
                        totalHpp += amount;
                        if (tx.details && tx.details.length > 0) {
                            tx.details.forEach(d => {
                                const itemId = d.id || 'Bahan Baku';
                                const itemAmount = d.qty * d.price;
                                let catId = 'uncategorized';
                                if (keuanganMasterData.hpp[itemId] && keuanganMasterData.hpp[itemId].category_id) {
                                    catId = keuanganMasterData.hpp[itemId].category_id;
                                }
                                if (!rincianHpp[catId]) rincianHpp[catId] = { total: 0, items: {} };
                                rincianHpp[catId].total += itemAmount;
                                rincianHpp[catId].items[itemId] = (rincianHpp[catId].items[itemId] || 0) + itemAmount;
                            });
                        } else {
                            const itemId = tx.journal_lines?.debit?.account_id || 'Bahan Baku';
                            let catId = 'uncategorized';
                            if (keuanganMasterData.hpp[itemId] && keuanganMasterData.hpp[itemId].category_id) {
                                catId = keuanganMasterData.hpp[itemId].category_id;
                            }
                            if (!rincianHpp[catId]) rincianHpp[catId] = { total: 0, items: {} };
                            rincianHpp[catId].total += amount;
                            rincianHpp[catId].items[itemId] = (rincianHpp[catId].items[itemId] || 0) + amount;
                        }
                    } else {
                        totalExpense += amount;
                        const catId = tx.journal_lines?.debit?.account_id || 'Biaya Operasional';
                        rincianBiaya[catId] = (rincianBiaya[catId] || 0) + amount;
                    }
                }
            }
            
            // Hitung Saldo Akhir
            if (accId && accountsLedger[accId] && txDate <= endDate) {
                if (isMasuk) accountsLedger[accId].saldoAkhir += amount;
                else accountsLedger[accId].saldoAkhir -= amount;
            }
        });

        // C. Kalkulasi dan Render Laba Rugi
        const totalPendapatanKotor = totalPosRevenue + totalOtherRevenue;
        const labaKotor = totalPendapatanKotor - totalHpp;
        const labaBersih = labaKotor - totalExpense;
        
        const formatRp = (num) => 'Rp ' + Math.round(num).toLocaleString('id-ID');
        const getCatName = (id, type) => {
            if (type === 'rev' && keuanganMasterData.revenues[id]) return keuanganMasterData.revenues[id].name;
            if (type === 'exp' && keuanganMasterData.expenses[id]) return keuanganMasterData.expenses[id].name;
            if (type === 'hpp' && keuanganMasterData.hpp[id]) return keuanganMasterData.hpp[id].name;
            return id;
        };

        let htmlLabaRugi = `
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tbody>
                    <!-- PENDAPATAN -->
                    <tr style="background: #f8fafc;"><td colspan="2" style="padding: 12px 16px; font-weight: bold; color: #1e40af; border-bottom: 1px solid #e2e8f0;">PENDAPATAN</td></tr>
                    <tr>
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0;">Pendapatan Kasir (POS)</td>
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatRp(totalPosRevenue)}</td>
                    </tr>
        `;

        if (deductedPpn > 0) {
            let ppnLabel = ppnPercent > 0 ? `PPN Keluaran (${ppnPercent}%)` : `PPN Keluaran (Sesuai Nota)`;
            htmlLabaRugi += `
                    <tr>
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; padding-left: 30px; color: #dc2626;">Dikurangi: ${ppnLabel}</td>
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #dc2626;">-${formatRp(deductedPpn)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; padding-left: 30px; font-weight: 600;">Pendapatan Kasir (Netto)</td>
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${formatRp(posNetRevenue)}</td>
                    </tr>
            `;
        }

        Object.keys(rincianPendapatanLain).forEach(k => {
            htmlLabaRugi += `
                    <tr>
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; padding-left: 30px;">Pendapatan Lain: ${getCatName(k, 'rev')}</td>
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatRp(rincianPendapatanLain[k])}</td>
                    </tr>
            `;
        });

        htmlLabaRugi += `
                    <tr style="font-weight: bold; background: #f1f5f9;">
                        <td style="padding: 12px 16px; border-bottom: 2px solid #cbd5e1;">TOTAL PENDAPATAN KOTOR</td>
                        <td style="padding: 12px 16px; border-bottom: 2px solid #cbd5e1; text-align: right;">${formatRp(totalPendapatanKotor)}</td>
                    </tr>

                    <!-- HPP -->
                    <tr style="background: #fefce8;"><td colspan="2" style="padding: 12px 16px; font-weight: bold; color: #b45309; border-bottom: 1px solid #e2e8f0;">HARGA POKOK PENJUALAN (HPP)</td></tr>
        `;

        Object.keys(rincianHpp).forEach(catId => {
            const catName = catId === 'uncategorized' ? 'Lainnya' : (keuanganMasterData.hppCategories[catId] ? keuanganMasterData.hppCategories[catId].name : 'Lainnya');
            const catData = rincianHpp[catId];
            
            // Header Kategori HPP (Jenis HPP)
            htmlLabaRugi += `
                    <tr style="background: #fffbeb;">
                        <td style="padding: 8px 16px; border-bottom: 1px solid #e2e8f0; padding-left: 20px; font-weight: 600; color: #92400e;">📁 ${catName}</td>
                        <td style="padding: 8px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #92400e;">${formatRp(catData.total)}</td>
                    </tr>
            `;
            
            // Rincian Item di dalam Kategori
            Object.keys(catData.items).forEach(itemId => {
                htmlLabaRugi += `
                    <tr>
                        <td style="padding: 6px 16px; border-bottom: 1px solid #f1f5f9; padding-left: 40px; font-size: 13px; color: #475569;">- ${getCatName(itemId, 'hpp')}</td>
                        <td style="padding: 6px 16px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 13px; color: #475569;">${formatRp(catData.items[itemId])}</td>
                    </tr>
                `;
            });
        });

        htmlLabaRugi += `
                    <tr style="font-weight: bold; background: #f1f5f9;">
                        <td style="padding: 12px 16px; border-bottom: 2px solid #cbd5e1;">TOTAL HPP</td>
                        <td style="padding: 12px 16px; border-bottom: 2px solid #cbd5e1; text-align: right; color: #b91c1c;">-${formatRp(totalHpp)}</td>
                    </tr>

                    <!-- LABA KOTOR -->
                    <tr style="font-weight: bold; font-size: 15px; background: #e0f2fe;">
                        <td style="padding: 14px 16px; border-bottom: 2px solid #bae6fd;">LABA KOTOR</td>
                        <td style="padding: 14px 16px; border-bottom: 2px solid #bae6fd; text-align: right; color: #0369a1;">${formatRp(labaKotor)}</td>
                    </tr>

                    <!-- BIAYA OPERASIONAL -->
                    <tr style="background: #fef2f2;"><td colspan="2" style="padding: 12px 16px; font-weight: bold; color: #991b1b; border-bottom: 1px solid #e2e8f0;">BIAYA OPERASIONAL</td></tr>
        `;

        Object.keys(rincianBiaya).forEach(k => {
            htmlLabaRugi += `
                    <tr>
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; padding-left: 30px;">${getCatName(k, 'exp')}</td>
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatRp(rincianBiaya[k])}</td>
                    </tr>
            `;
        });

        htmlLabaRugi += `
                    <tr style="font-weight: bold; background: #f1f5f9;">
                        <td style="padding: 12px 16px; border-bottom: 2px solid #cbd5e1;">TOTAL BIAYA OPERASIONAL</td>
                        <td style="padding: 12px 16px; border-bottom: 2px solid #cbd5e1; text-align: right; color: #b91c1c;">-${formatRp(totalExpense)}</td>
                    </tr>

                    <!-- LABA BERSIH -->
                    <tr style="font-weight: 800; font-size: 18px; background: ${labaBersih >= 0 ? '#dcfce7' : '#fee2e2'};">
                        <td style="padding: 18px 16px; border-top: 2px solid ${labaBersih >= 0 ? '#166534' : '#991b1b'};">LABA/RUGI BERSIH</td>
                        <td style="padding: 18px 16px; border-top: 2px solid ${labaBersih >= 0 ? '#166534' : '#991b1b'}; text-align: right; color: ${labaBersih >= 0 ? '#166534' : '#991b1b'};">${formatRp(labaBersih)}</td>
                    </tr>
                </tbody>
            </table>
        `;

        document.getElementById('report-laba-rugi-container').innerHTML = htmlLabaRugi;
        document.getElementById('report-laba-rugi-container').style.padding = '0';

        // ==========================================
        // --- 2. PROSES MUTASI KAS & BANK ---
        // ==========================================
        let htmlLedger = '';
        const filterAkunVal = document.getElementById('filter-mutasi-akun') ? document.getElementById('filter-mutasi-akun').value : 'all';
        
        Object.keys(accountsLedger).forEach(accId => {
            if (filterAkunVal !== 'all' && filterAkunVal !== accId) return; // Skip if filtered
            
            const ledger = accountsLedger[accId];
            if (ledger.saldoAwal === 0 && ledger.mutasi.length === 0 && ledger.saldoAkhir === 0) return;
            
            htmlLedger += `<h4 style="margin: 20px 16px 10px; color: #1e40af; font-size: 15px;">🏦 Akun: ${ledger.name}</h4>`;
            htmlLedger += `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 10px;">
                    <thead>
                        <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                            <th style="padding: 10px 16px; text-align: left;">Tanggal</th>
                            <th style="padding: 10px 16px; text-align: left;">Keterangan</th>
                            <th style="padding: 10px 16px; text-align: right;">Masuk (Debit)</th>
                            <th style="padding: 10px 16px; text-align: right;">Keluar (Kredit)</th>
                            <th style="padding: 10px 16px; text-align: right;">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="4" style="padding: 10px 16px; text-align: right; font-weight: bold; background: #f8fafc;">Saldo Awal</td><td style="padding: 10px 16px; text-align: right; font-weight: bold; background: #f8fafc;">${formatRp(ledger.saldoAwal)}</td></tr>
            `;
            
            let runningSaldo = ledger.saldoAwal;
            ledger.mutasi.sort((a,b) => a.date.localeCompare(b.date)); // Sortir tanggal
            ledger.mutasi.forEach(m => {
                runningSaldo = runningSaldo + m.masuk - m.keluar;
                
                const hasExtra = m.description || m.detailsHtml;
                const descHtml = `
                    <div style="font-weight:700; color: #1e293b; margin-bottom:4px; cursor:${hasExtra ? 'pointer' : 'default'};" ${hasExtra ? `onclick="const d = this.parentElement.querySelector('.mutasi-desc'); if(d) d.style.display = d.style.display === 'none' ? 'block' : 'none'"` : ''} title="${hasExtra ? 'Klik untuk melihat detail' : ''}">
                        ${m.name} ${hasExtra ? '<span style="font-size:12px; margin-left:4px; cursor:pointer;">📝</span>' : ''}
                    </div>
                    <span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; display:inline-block;">💳 ${m.typeLabel}</span>
                    ${hasExtra ? `
                    <div class="mutasi-desc" style="display:none; margin-top:8px; font-size:12px; color:#334155; background:#f8fafc; padding:8px 10px; border-radius:6px; border-left:3px solid #3b82f6;">
                        ${m.detailsHtml ? `<div style="margin-bottom: ${m.description ? '6px' : '0'}; border-bottom: ${m.description ? '1px dashed #cbd5e1' : 'none'}; padding-bottom: ${m.description ? '6px' : '0'};">${m.detailsHtml}</div>` : ''}
                        ${m.description ? `<div><strong>Catatan:</strong><br>${m.description}</div>` : ''}
                    </div>` : ''}
                `;
                htmlLedger += `<tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 14px 16px; vertical-align: top;">${m.date}</td>
                    <td style="padding: 14px 16px; vertical-align: top;">${descHtml}</td>
                    <td style="padding: 14px 16px; text-align: right; color: #059669; vertical-align: top; font-weight: 500;">${m.masuk > 0 ? formatRp(m.masuk) : '-'}</td>
                    <td style="padding: 14px 16px; text-align: right; color: #dc2626; vertical-align: top; font-weight: 500;">${m.keluar > 0 ? formatRp(m.keluar) : '-'}</td>
                    <td style="padding: 14px 16px; text-align: right; font-weight: 700; vertical-align: top; color: #0f172a;">${formatRp(runningSaldo)}</td>
                </tr>`;
            });
            
            htmlLedger += `<tr><td colspan="4" style="padding: 12px 16px; text-align: right; font-weight: bold; background: #e0f2fe; border-top: 2px solid #bae6fd;">Saldo Akhir</td><td style="padding: 12px 16px; text-align: right; font-weight: bold; background: #e0f2fe; border-top: 2px solid #bae6fd; color: #0369a1;">${formatRp(ledger.saldoAkhir)}</td></tr></tbody></table>`;
        });

        if (!htmlLedger) htmlLedger = '<p style="color:#6b7280; font-size:13px; text-align:center;">Tidak ada mutasi Kas/Bank pada periode ini.</p>';
        document.getElementById('report-kas-bank-container').innerHTML = htmlLedger;
        document.getElementById('report-kas-bank-container').style.padding = '0';

        // ==========================================
        // --- 3. PROSES LAPORAN STOK OPNAME ---
        // ==========================================
        // A. Ambil Data Menu dan Resep (Bill of Materials)
        const prodSnap = await rbmDb.ref(`products/${outlet}`).once('value');
        const productsData = prodSnap.val() || {};

        // B. Kalkulasi Total Penjualan Item di Kasir (POS)
        let productSales = {};
        Object.values(orders).forEach(o => {
            if (['Sudah Dibayar', 'Diproses', 'Siap Diambil', 'Selesai'].includes(o.status)) {
                let items = o.items || [];
                if (!Array.isArray(items)) items = Object.values(items);
                items.forEach(item => {
                    let pid = item.id || item.productId;
                    let qty = parseFloat(item.qty || item.quantity) || 1;
                    if (pid) productSales[pid] = (productSales[pid] || 0) + qty;
                });
            }
        });

        // C. Hitung Total Penggunaan Bahan Baku (Keluar)
        let bahanUsages = {};
        Object.keys(productSales).forEach(pid => {
            let qtySold = productSales[pid];
            let prod = productsData[pid] || {};
            let recipe = prod.recipe || {};
            Object.keys(recipe).forEach(bahanId => {
                let qtyBahan = parseFloat(recipe[bahanId]) || 0;
                bahanUsages[bahanId] = (bahanUsages[bahanId] || 0) + (qtyBahan * qtySold);
            });
        });

        // D. Hitung Total Pembelian Bahan Baku (Masuk)
        let bahanPurchases = {};
        Object.values(allTransactions).forEach(tx => {
            if (tx.date >= startDate && tx.date <= endDate && tx.type === 'expense' && tx.is_hpp) {
                if (tx.details && tx.details.length > 0) {
                    tx.details.forEach(d => {
                        let bid = d.id;
                        if (bid) bahanPurchases[bid] = (bahanPurchases[bid] || 0) + (parseFloat(d.qty) || 0);
                    });
                } else if (tx.journal_lines && tx.journal_lines.debit && tx.journal_lines.debit.account_id) {
                     let bid = tx.journal_lines.debit.account_id;
                     bahanPurchases[bid] = (bahanPurchases[bid] || 0) + (parseFloat(tx.journal_lines.debit.qty) || 0);
                }
            }
        });

        // E. Susun Tampilan Laporan
        let htmlStok = `
            <h4 style="margin: 20px 16px 10px; color: #1e40af; font-size: 15px;">📊 Pergerakan Stok Bahan Baku</h4>
            <div style="padding: 0 16px 10px;">
                <span style="font-size: 11px; color: #64748b; background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">Catatan: 'Keluar' dihitung otomatis berdasarkan Resep (BOM) menu yang terjual di aplikasi kasir.</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 10px;">
                <thead>
                    <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                        <th style="padding: 10px 16px; text-align: left;">Kategori</th>
                        <th style="padding: 10px 16px; text-align: left;">Bahan Baku</th>
                        <th style="padding: 10px 16px; text-align: center;">Satuan</th>
                        <th style="padding: 10px 16px; text-align: right;">Masuk (Beli)</th>
                        <th style="padding: 10px 16px; text-align: right;">Keluar (POS)</th>
                        <th style="padding: 10px 16px; text-align: right;">Mutasi (Periode)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let hasStokData = false;
        Object.keys(keuanganMasterData.hpp).forEach(bahanId => {
            let hppItem = keuanganMasterData.hpp[bahanId];
            let masuk = bahanPurchases[bahanId] || 0;
            let keluar = bahanUsages[bahanId] || 0;
            
            // Pembulatan agar tidak ada pecahan mengganggu (misal: 0.33333333)
            masuk = Math.round(masuk * 100) / 100;
            keluar = Math.round(keluar * 100) / 100;

            if (masuk === 0 && keluar === 0) return;

            hasStokData = true;
            let mutasi = Math.round((masuk - keluar) * 100) / 100;
            let catName = hppItem.category_id && keuanganMasterData.hppCategories[hppItem.category_id] ? keuanganMasterData.hppCategories[hppItem.category_id].name : 'Lainnya';
            let colorMutasi = mutasi >= 0 ? '#166534' : '#dc2626';

            htmlStok += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 16px;">${catName}</td>
                    <td style="padding: 10px 16px; font-weight: bold;">${hppItem.name}</td>
                    <td style="padding: 10px 16px; text-align: center; color: #475569;">${hppItem.unit || '-'}</td>
                    <td style="padding: 10px 16px; text-align: right; color: #059669; font-weight: 500;">${masuk > 0 ? masuk : '-'}</td>
                    <td style="padding: 10px 16px; text-align: right; color: #dc2626; font-weight: 500;">${keluar > 0 ? keluar : '-'}</td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: bold; color: ${colorMutasi};">${mutasi > 0 ? '+' : ''}${mutasi}</td>
                </tr>
            `;
        });

        if (!hasStokData) {
            htmlStok += '<tr><td colspan="6" class="table-empty">Tidak ada pergerakan stok (pembelian atau penjualan resep) pada periode ini.</td></tr>';
        }

        htmlStok += '</tbody></table>';

        document.getElementById('report-stok-container').innerHTML = htmlStok;
        document.getElementById('report-stok-container').style.padding = '0';

    } catch (e) {
        console.error(e);
        alert("Gagal membuat laporan: " + e.message);
    } finally {
        btnGenerate.textContent = originalText;
        btnGenerate.disabled = false;
    }
}

/**
 * CATATAN PENTING UNTUK PERFORMA (Firebase):
 * 
 * 1. INDEXING: Pastikan untuk membuat index di Firebase Rules untuk semua field
 *    yang digunakan untuk query (misal: `date` di `transactions` dan `orders`).
 *    Contoh di rules.json:
 *    "transactions": { ".indexOn": ["date"] }
 * 
 * 2. DENORMALISASI: Untuk laporan yang sangat kompleks dan sering diakses, pertimbangkan
 *    menggunakan Firebase Cloud Functions untuk mengagregasi data secara periodik
 *    (misal: setiap jam/hari) ke path laporan khusus. Ini akan membuat loading
 *    laporan menjadi instan karena tidak perlu kalkulasi di sisi klien.
 * 
 * 3. RESEP/BOM: Fitur laporan stok sangat bergantung pada adanya data resep (Bill of Materials)
 *    di setiap produk pada path `products/{outletId}/{productId}/recipe`.
 *    Struktur resep: { "id_bahan_baku_1": jumlah, "id_bahan_baku_2": jumlah }
 */