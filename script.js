// Application State
// Hapus URL Google Apps Script karena kita akan menggunakan Firebase
// const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwjtnvk5hBj0EWsEI7_Udj2buBxv_Jv6FTnmiTIA78kntpck6-rqu0s_n0o89iY3bdfOQ/exec'; // URL Web App Anda

let items = [];
let activities = [];
let invoices = [];
let suratJalan = [];

// --- Firebase Configuration ---
// Ganti dengan konfigurasi Firebase Anda dari konsol Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC5CJ8_KnAetJEaHyGvw4HQvArvVOkFM1Y",
  authDomain: "monitorbarangapp-fc036.firebaseapp.com",
  projectId: "monitorbarangapp-fc036",
  storageBucket: "monitorbarangapp-fc036.firebasestorage.app",
  messagingSenderId: "922614961903",
  appId: "1:922614961903:web:6026aabaa98015cd30ad1a",
  measurementId: "G-NV8YBZ2EWM"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); // Dapatkan instance Firestore

// Global loading spinner functions
function showLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.add('show');
    }
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.remove('show');
    }
}

// Fungsi untuk menampilkan modal notifikasi
function showAlert(message, title = 'Notifikasi') {
    const modal = document.getElementById('alertModal');
    if (modal) {
        document.getElementById('alertTitle').textContent = title;
        document.getElementById('alertMessage').textContent = message;
        modal.style.display = 'block';
    } else {
        // Fallback jika modal tidak ada
        alert(`${title}: ${message}`);
    }
}

// Fungsi untuk menyembunyikan modal notifikasi
function hideAlertModal() {
    const modal = document.getElementById('alertModal');
    if (modal) modal.style.display = 'none';
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Panggil initializeApp di setiap halaman.
    // Fungsi ini akan menangani pemuatan data dan pemanggilan fungsi spesifik halaman.
    initializeApp().then(() => {
        console.log('Aplikasi berhasil diinisialisasi dengan data dari Firebase (Firestore).');
        // Setup event listener setelah inisialisasi selesai.
        setupEventListeners();
    });
});

async function setupCustomerDropdowns() {
    // Selector untuk dropdown pelanggan di halaman input.html dan invoice.html
    const customerSelects = document.querySelectorAll('#outCustomerName, #invoiceFormSection #customerName');

    if (customerSelects.length === 0) {
        return; // Tidak ada dropdown pelanggan di halaman ini
    }

    try {
        // Ambil data pelanggan dari Firestore.
        // Kita bisa menambahkan cache sederhana di window object untuk menghindari fetch berulang.
        if (!window.customerData) {
            const snapshot = await db.collection('customers').get();
            window.customerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        customerSelects.forEach(select => {
            // Simpan opsi statis yang sudah ada (selain "Pilih Pelanggan")
            const staticOptions = Array.from(select.options).filter(opt => opt.value !== "");

            // Bersihkan semua opsi kecuali yang pertama ("Pilih Pelanggan")
            while (select.options.length > 1) {
                select.remove(1);
            }

            // Tambahkan pelanggan dari data yang sudah diambil
            window.customerData.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.name;
                option.textContent = customer.name;
                option.dataset.address = customer.address || '';
                select.appendChild(option);
            });

            // Tambahkan kembali opsi statis yang tadi disimpan
            staticOptions.forEach(staticOpt => {
                select.appendChild(staticOpt);
            });

            // Tambahkan event listener untuk auto-fill alamat
            select.addEventListener('change', function(e) {
                const selectedOption = e.target.options[e.target.selectedIndex];
                
                // Dapatkan alamat dari dataset opsi yang dipilih
                const selectedAddress = selectedOption.dataset.address || '';

                if (this.id === 'outCustomerName') {
                    const addressField = document.querySelector('#outCustomerAddress');
                    if (addressField) {
                        addressField.value = selectedAddress;
                    }
                } else if (this.id === 'customerName' && this.closest('#invoiceFormSection')) {
                    console.log('customerName change event triggered for invoice');
                    const addressField = document.querySelector('#invoiceFormSection #customerAddress');
                    if (addressField) {
                        addressField.value = selectedAddress; // Set alamat terlebih dahulu
                    }
                    autoFillInvoiceFromDatabase(true); // Kemudian panggil auto-fill
                }
            });
        });
    } catch (error) {
        console.error('Error loading customer data:', error);
        showSyncStatusBanner('Gagal memuat data pelanggan.', 'error');
    }
}

// Initialize application
async function initializeApp() {
    // Pindahkan setupCustomerDropdowns ke sini agar dipanggil setelah data dimuat
    // dan sebelum event listener lain yang mungkin bergantung padanya.
    // Ini memastikan dropdown pelanggan di semua halaman sudah terisi.
    await setupCustomerDropdowns();

    showLoadingSpinner(); // Tampilkan spinner saat memulai inisialisasi
    try {
        // Ambil data dari Firestore
        const [itemsSnapshot, activitiesSnapshot, invoicesSnapshot, suratJalanSnapshot] = await Promise.all([
            db.collection('items').get(),
            db.collection('activities').get(),
            db.collection('invoices').get(),
            db.collection('suratJalan').get()
        ]);
        
        // Konversi tipe data yang diperlukan (misal: string angka jadi number)
        items = itemsSnapshot.docs.map(doc => ({
            id: doc.id, // Ambil ID dokumen dari Firestore
            ...doc.data(),
            price: parseFloat(doc.data().price) || 0,
            quantity: parseInt(doc.data().quantity) || 0,
            isTemplate: doc.data().isTemplate === true || String(doc.data().isTemplate).toUpperCase() === 'TRUE'
        }));

    // Muat data lain dari Firebase (Firestore)
        invoices = invoicesSnapshot.docs.map(doc => ({
            id: doc.id, // Ambil ID dokumen dari Firestore
            ...doc.data(),
            total: parseFloat(doc.data().total) || 0,
            amountPaid: parseFloat(doc.data().amountPaid) || 0,
            // items_json sudah di-parse oleh Apps Script
            items: doc.data().items || [] // Firestore menyimpan array langsung
        }));
        suratJalan = suratJalanSnapshot.docs.map(doc => ({
            id: doc.id, // Ambil ID dokumen dari Firestore
            ...doc.data(),
            items: doc.data().items || [] // Firestore menyimpan array langsung
        }));
        activities = activitiesSnapshot.docs.map(doc => ({
            id: doc.id, // Ambil ID dokumen dari Firestore
            ...doc.data()
        }));

    } catch (error) {
        console.error('Error saat inisialisasi dari Firebase:', error);
        showFetchErrorBanner('Tidak dapat memuat data dari Firebase. Silakan periksa koneksi internet Anda dan muat ulang halaman.');
        console.warn('Gagal mengambil data dari Firebase, menggunakan array kosong.');
            items = [];
            invoices = [];
            suratJalan = [];
            activities = [];
    } finally {
        hideLoadingSpinner(); // Sembunyikan spinner setelah inisialisasi selesai (berhasil atau gagal)
    }

    // Panggil fungsi inisialisasi form spesifik halaman SETELAH data dimuat.
    // Ini memastikan dropdown pelanggan sudah terisi sebelum form di-reset.
    if (document.getElementById('invoiceDate')) {
        // Menggunakan resetInvoiceForm untuk mengatur tanggal dan nomor invoice awal.
        resetInvoiceForm(); 
        const invoiceDateInput = document.getElementById('invoiceDate');
        const invoiceNumberInput = document.getElementById('invoiceNumber');
        invoiceNumberInput.value = generateRBMNumberFromDate(invoiceDateInput.value);
    }
    if (document.getElementById('transactionDate')) {
        // Inisialisasi form input barang.
        initializeInputForm();
    }

    // Initialize charts (only if chart element exists)
    if (document.getElementById('monthlyChart')) {
        initializeChart();
    }

    // Setelah data dimuat dari Firebase, perbarui hanya tampilan yang ada pada halaman
    try {
        // Render ulang dashboard jika elemen dashboard ada
        if (document.getElementById('dashboardTableBody') && typeof updateDashboard === 'function') {
            updateDashboard();
        }

        // Update activity list jika elemen ada
        if (document.getElementById('activityList') && typeof updateActivityList === 'function') {
            updateActivityList();
        }

        // Update chart only when chart element exists and function available
        if (document.getElementById('monthlyChart') && typeof updateChart === 'function') {
            updateChart({ items, activities });
        }

        // Panggil fungsi spesifik halaman SETELAH data dimuat
        // Untuk halaman hutang.html
        if (document.getElementById('hutangTableBody') && typeof loadHutangTable === 'function') {
            loadHutangTable();
        }

        // Untuk halaman monitoring.html
        if (document.getElementById('salesChart7Days') && typeof initializeMonitoringPage === 'function') {
            initializeMonitoringPage();
        }

    } catch (e) {
        console.warn('Gagal merender ulang tampilan setelah inisialisasi:', e);
    }
    
    // Sample data tidak lagi relevan karena data diambil dari Sheets
}

function addSampleData() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    // Add sample items for current month
    const sampleItems = [
        {
            id: 'ITM-001',
            name: 'Laptop Dell',
            category: 'elektronik',
            quantity: 5,
            unit: 'pcs',
            price: 8000000,
            transactionType: 'in',
            description: 'Laptop untuk keperluan kantor',
            date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
        },
        {
            id: 'ITM-002',
            name: 'Meja Kantor',
            category: 'furniture',
            quantity: 3,
            unit: 'pcs',
            price: 1500000,
            transactionType: 'in',
            description: 'Meja kantor kayu jati',
            date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`
        },
        {
            id: 'ITM-003',
            name: 'Laptop Dell',
            category: 'elektronik',
            quantity: 2,
            unit: 'pcs',
            price: 8000000,
            transactionType: 'out',
            description: 'Penjualan laptop',
            date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-05`
        },
        {
            id: 'ITM-004',
            name: 'Printer HP',
            category: 'elektronik',
            quantity: 1,
            unit: 'pcs',
            price: 2500000,
            transactionType: 'damaged',
            description: 'Printer rusak karena overuse',
            date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-10`
        }
    ];
    
    // Tidak perlu add sample data lagi jika menggunakan Firebase, karena data akan diambil dari sana.
    // Jika ingin menambahkan data awal, lakukan secara manual di konsol Firebase atau melalui script migrasi.
}

// Setup event listeners
function setupEventListeners() {
    // Navigation - handle both data-page attributes and href links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            // If it's a data-page attribute, prevent default and handle internally
            if (this.getAttribute('data-page')) {
                e.preventDefault();
                const pageId = this.getAttribute('data-page');
                showPage(pageId);
                
                // Update active nav link
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            }
            // If it's an href link, let it navigate normally
        });
    });

    // Event listeners for edit button on dashboard (delete feature removed)
    const editBtn = document.getElementById('editItemBtn');
    if (editBtn) {
        editBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showEditItemModal();
        });
    }

    // Event listeners for edit modal
    const saveEditBtn = document.getElementById('saveEditItem');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', function(e) {
            e.preventDefault();
            saveEditItemData();
        });
    }
    const cancelEditBtn = document.getElementById('cancelEditItem');
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', hideEditItemModal);
    const closeEditBtn = document.getElementById('closeEditModal');
    if (closeEditBtn) closeEditBtn.addEventListener('click', hideEditItemModal);

    // Delete modal listeners removed (delete functionality disabled)
    // Dashboard filters
    const monthFilter = document.getElementById('monthFilter');
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'addItemBtn') {
            e.preventDefault();
            showAddItemModal();
        }

        // Event listener terpusat untuk tombol simpan dan batal di modal
        if (e.target && (e.target.classList.contains('modal-close') || e.target.id === 'cancelAddItem')) {
            hideAddItemModal();
        }
        
        if (e.target && e.target.id === 'saveNewItem') {
            e.preventDefault();
            // Hanya panggil saveNewItemData dari sini untuk menghindari duplikasi
            saveNewItemData();
        }
        
        // Close modal when clicking outside
        if (e.target && e.target.id === 'addItemModal') {
            hideAddItemModal();
        }
    });

    const clearFormBtn = document.getElementById('clearForm');
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', clearForm);
    }

    // Database tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            showDatabaseTab(tabId);
            
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Form submission handler for input.html
    const itemForm = document.getElementById('itemForm');
    if (itemForm) {
        itemForm.addEventListener('submit', handleTransactionSubmit);
    }

    // Transaction type change handler
    const transactionType = document.getElementById('transactionType');
    if (transactionType) {
        transactionType.addEventListener('change', function() {
            showTransactionLayout(this.value);
        });
    }

    // Item name input handler for OUT transactions (auto-fill functionality)
    const itemNameOut = document.getElementById('itemNameOut');
    if (itemNameOut) {
        itemNameOut.addEventListener('input', function() {
            autoFillItemData(this.value);
        });
    }

    // Invoice and Surat Jalan event bindings
    const addInvoiceItemBtn = document.getElementById('addInvoiceItem');
    if (addInvoiceItemBtn) addInvoiceItemBtn.addEventListener('click', addInvoiceItem);

    const saveInvoiceBtn = document.getElementById('saveInvoice');
    if (saveInvoiceBtn) saveInvoiceBtn.addEventListener('click', saveInvoice);

    const printInvoiceAndSuratJalanBtn = document.getElementById('printInvoiceAndSuratJalan');
    if (printInvoiceAndSuratJalanBtn) printInvoiceAndSuratJalanBtn.addEventListener('click', printInvoiceAndSuratJalan);

    // Surat Jalan bindings
    // The auto-fill button is now hidden, but we can keep the logic for potential future use.
    // const autoFillSuratJalanBtn = document.getElementById('autoFillSuratJalan');
    // if (autoFillSuratJalanBtn) {
    //     autoFillSuratJalanBtn.addEventListener('click', function() {
    //         autoFillSuratJalanFromDatabase();
    //     });
    // }

    const addSuratJalanItemBtn = document.getElementById('addSuratJalanItem');
    if (addSuratJalanItemBtn) addSuratJalanItemBtn.addEventListener('click', addSuratJalanItem);

    const saveSuratJalanBtn = document.getElementById('saveSuratJalan');
    if (saveSuratJalanBtn) saveSuratJalanBtn.addEventListener('click', saveSuratJalan);

    const printSuratJalanBtn = document.getElementById('printSuratJalan');
    if (printSuratJalanBtn) printSuratJalanBtn.addEventListener('click', printSuratJalan);

    const printInvoiceAndSuratJalanFromSuratJalanBtn = document.getElementById('printInvoiceAndSuratJalanFromSuratJalan');
    if (printInvoiceAndSuratJalanFromSuratJalanBtn) printInvoiceAndSuratJalanFromSuratJalanBtn.addEventListener('click', printInvoiceAndSuratJalanFromSuratJalan);

    // Event listeners for view/generate toggles
    const viewHistoryBtn = document.getElementById('viewHistory'); // Corrected ID
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', showDocumentList);
    }

    // Pemicu otomatis untuk auto-fill dan update nomor invoice
    const invoiceDateInput = document.getElementById('invoiceDate');
    if (invoiceDateInput) {
        invoiceDateInput.addEventListener('change', () => {
            document.getElementById('invoiceNumber').value = generateRBMNumberFromDate(invoiceDateInput.value);
            autoFillInvoiceFromDatabase(true);
        });
    }

    // Pemicu untuk auto-fill alamat dan item saat pelanggan diganti
   // Listener ini sudah ditangani di dalam setupCustomerDropdowns, jadi kita hapus duplikasinya.

    const generateInvoiceBtn = document.getElementById('generateInvoice');
    if (generateInvoiceBtn) generateInvoiceBtn.addEventListener('click', showInvoiceForm);

    // Event listener for the new tabs on the invoice page
    const documentListSection = document.getElementById('documentListSection');
    if (documentListSection) {
        documentListSection.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                showDocumentTab(tabId);
            });
        });
    }

    // Event listeners for list search/refresh
    const invoiceSearch = document.getElementById('invoiceSearch');
    if (invoiceSearch) invoiceSearch.addEventListener('input', filterInvoices);

    const refreshInvoicesBtn = document.getElementById('refreshInvoices');
    if (refreshInvoicesBtn) refreshInvoicesBtn.addEventListener('click', loadInvoiceList);

    const suratJalanSearch = document.getElementById('suratJalanSearch');
    if (suratJalanSearch) suratJalanSearch.addEventListener('input', filterSuratJalan);

    const refreshSuratJalanBtn = document.getElementById('refreshSuratJalan');
    if (refreshSuratJalanBtn) refreshSuratJalanBtn.addEventListener('click', loadSuratJalanList);

    // Event listener untuk search di halaman hutang
    const hutangSearchInput = document.getElementById('hutangSearch');
    if (hutangSearchInput) {
        hutangSearchInput.addEventListener('input', (e) => filterHutangTable(e.target.value));
    }


    // Setup customer dropdowns on both pages
    if (document.getElementById('invoiceFormSection') || document.getElementById('outTransactionLayout')) {
        setupCustomerDropdowns();
    }

    // Event listeners for adding item rows in input.html
    const addInItemBtn = document.getElementById('addInItem');
    if (addInItemBtn) addInItemBtn.addEventListener('click', function(e) {
        e.preventDefault();
        addInItemRow();
    });

    const addOutItemBtn = document.getElementById('addOutItem');
    if (addOutItemBtn) addOutItemBtn.addEventListener('click', function(e) {
        e.preventDefault();
        addOutItemRow();
    });

    const addDamagedItemBtn = document.getElementById('addDamagedItem');
    if (addDamagedItemBtn) addDamagedItemBtn.addEventListener('click', function(e) {
        e.preventDefault();
        addDamagedItemRow();
    });

    const addAdjustmentItemBtn = document.getElementById('addAdjustmentItem');
    if (addAdjustmentItemBtn) addAdjustmentItemBtn.addEventListener('click', function(e) {
        e.preventDefault();
        addAdjustmentItemRow();
    });

}

// Navigation functions
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// Dashboard functions
/**
 * --- REFACTORED DASHBOARD LOGIC ---
 * The logic is now broken into smaller, more manageable functions.
 */

function getDashboardDates() {
    const monthFilter = document.getElementById('monthFilter');
    const dateFilter = document.getElementById('dateFilter');
    const selectedMonth = monthFilter ? monthFilter.value : null;
    const selectedDate = dateFilter ? dateFilter.value : null;
    
    let datesToShow = [];
    const viewType = selectedDate ? 'day' : (selectedMonth ? 'month' : 'day');

    if (viewType === 'day') {
        const date = selectedDate || new Date().toISOString().split('T')[0];
        datesToShow.push(date);
    } else if (viewType === 'month') { // month view
        const year = parseInt(selectedMonth.split('-')[0]);
        const monthNum = parseInt(selectedMonth.split('-')[1]);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            datesToShow.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
    }
    // Jika tidak ada filter bulan atau tanggal, default ke hari ini
    if (datesToShow.length === 0) {
        datesToShow.push(new Date().toISOString().split('T')[0]);
    }
    return { dates: datesToShow, viewType, filterValue: selectedDate || selectedMonth };
}

function renderDashboardHeaders(dates, viewType) {
    const dateHeaders = document.getElementById('dateHeaders');
    if (!dateHeaders) return;
    dateHeaders.innerHTML = '';

    dates.forEach(dateStr => {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + 1); // Adjust for timezone issues in display
        const dayOfMonth = date.getDate();
        const dayName = date.toLocaleDateString('id-ID', { weekday: 'short' });

        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${dayOfMonth}</div>
            <div style="font-size: 0.7rem;">${dayName}</div>
            <div class="date-subheader">
                <div class="date-subheader-cell">In</div>
                <div class="date-subheader-cell">Out</div>
                <div class="date-subheader-cell">Rusak</div>
                <div class="date-subheader-cell">Total</div>
            </div>
        `;
        dateHeaders.appendChild(dateHeader);
    });
}

function processDashboardData(dates) {
    const groupedItems = {};

    // 1. Initialize with all template items
    items.forEach(item => {
        if (item.isTemplate) {
            groupedItems[item.name] = {
                ...item,
                total: 0,
                adjustment: 0,
                dailyData: {}
            };
        }
    });

    const firstDateOfPeriod = new Date(dates[0]);

    // 2. Calculate stock for each template item
    Object.keys(groupedItems).forEach(templateName => {
        const templateNameLower = templateName.toLowerCase();
        let runningTotal = 0;

        // Calculate stock BEFORE the current view period
        const transactionsBefore = items.filter(t =>
            !t.isTemplate &&
            (t.name.toLowerCase().includes(templateNameLower) || templateNameLower.includes(t.name.toLowerCase())) &&
            new Date(t.date) < firstDateOfPeriod
        );
        transactionsBefore.forEach(t => {
            if (t.transactionType === 'in') runningTotal += t.quantity;
            else if (t.transactionType === 'out' || t.transactionType === 'damaged') runningTotal -= t.quantity;
        });

        // Process transactions WITHIN the current view period
        dates.forEach(dateStr => {
            const dailyTransactions = items.filter(t =>
                !t.isTemplate &&
                t.date === dateStr &&
                t.customerName !== 'Sistem' && // Exclude adjustments from daily running total
                (t.name.toLowerCase().includes(templateNameLower) || templateNameLower.includes(t.name.toLowerCase()))
            );

            const dailyIn = dailyTransactions.filter(t => t.transactionType === 'in').reduce((sum, t) => sum + t.quantity, 0);
            const dailyOut = dailyTransactions.filter(t => t.transactionType === 'out').reduce((sum, t) => sum + t.quantity, 0);
            const dailyDamaged = dailyTransactions.filter(t => t.transactionType === 'damaged').reduce((sum, t) => sum + t.quantity, 0);

            runningTotal += (dailyIn - dailyOut - dailyDamaged);

            groupedItems[templateName].dailyData[dateStr] = {
                in: dailyIn,
                out: dailyOut,
                damaged: dailyDamaged,
                total: runningTotal
            };
        });

        // Calculate total adjustments for the period separately
        const periodAdjustments = items.filter(t =>
            !t.isTemplate &&
            dates.includes(t.date) &&
            t.customerName === 'Sistem' &&
            (t.name.toLowerCase().includes(templateNameLower) || templateNameLower.includes(t.name.toLowerCase()))
        );
        const totalAdjustment = periodAdjustments.reduce((sum, t) => sum + (t.transactionType === 'in' ? t.quantity : -t.quantity), 0);

        groupedItems[templateName].total = runningTotal + totalAdjustment;
        groupedItems[templateName].adjustment = totalAdjustment;
    });

    return Object.values(groupedItems);
}

function renderDashboardTable(processedData, dates, filterValue) {
    const tableBody = document.getElementById('dashboardTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (processedData.length === 0) {
        tableBody.innerHTML = `
            <div class="dashboard-row">
                <div class="dashboard-cell" style="text-align: center; color: #6c757d; font-style: italic; grid-column: 1 / -1;">
                    Belum ada template barang. Silakan tambah template barang terlebih dahulu.
                </div>
            </div>
        `;
        return;
    }

    processedData.forEach(item => {
        const row = document.createElement('div');
        row.className = 'dashboard-row';

        const adjustmentFilter = filterValue || new Date().toISOString().split('T')[0];
        const lastAdjustmentInPeriod = items
            .filter(t => 
                !t.isTemplate &&
                t.customerName === 'Sistem' &&
                (t.name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(t.name.toLowerCase())) &&
                t.date.startsWith(adjustmentFilter)
            )
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        const physicalStockValue = lastAdjustmentInPeriod ? lastAdjustmentInPeriod.physicalStock : '-';
        const diff = lastAdjustmentInPeriod ? lastAdjustmentInPeriod.difference : (item.adjustment !== 0 ? item.adjustment : '-');
        const diffColor = diff > 0 ? '#28a745' : (diff < 0 ? '#dc3545' : '#6c757d');
        const diffText = diff > 0 ? `+${diff}` : diff;

        const dateDataCells = dates.map(dateStr => {
            const dayData = item.dailyData[dateStr] || { in: 0, out: 0, damaged: 0, total: 0 };
            return `
                <div class="daily-data-group">
                    <div class="date-data-cell in" title="Masuk: ${dayData.in}">${dayData.in}</div>
                    <div class="date-data-cell out" title="Keluar: ${dayData.out}">${dayData.out}</div>
                    <div class="date-data-cell damaged" title="Rusak: ${dayData.damaged}">${dayData.damaged}</div>
                    <div class="date-data-cell total" title="Total: ${dayData.total}">${dayData.total}</div>
                </div>
            `;
        }).join('');

        row.innerHTML = `
            <div class="dashboard-cell">${item.name}</div>
            <div class="dashboard-cell">${item.unit}</div>
            <div class="dashboard-cell">Rp ${item.price.toLocaleString()}</div>
            <div class="dashboard-cell">${item.total}</div>
            ${dateDataCells}
            <div class="dashboard-cell" style="min-width: 160px; padding: 0; display: flex; border-right: none;">
                <div class="date-data-cell" style="min-width: 80px; border-left: none; border-top: none; border-bottom: none; justify-content: center; color: #28a745; font-weight: bold;">${physicalStockValue}</div>
                <div class="date-data-cell" style="min-width: 80px; border-right: none; border-top: none; border-bottom: none; font-weight: bold; color: ${diffColor}; justify-content: center;">${diffText}</div>
            </div>
        `;
        tableBody.appendChild(row);
    });
}

function renderDashboard() {
    const { dates, viewType, filterValue } = getDashboardDates();
    renderDashboardHeaders(dates, viewType);
    const processedData = processDashboardData(dates);
    renderDashboardTable(processedData, dates, filterValue);
}

function updateDashboard() {
    renderDashboard();
}

function updateActivityList() {
    const activityList = document.getElementById('activityList');
    const recentActivities = activities.slice(-10).reverse();
    
    activityList.innerHTML = recentActivities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon" style="background: ${getActivityColor(activity.type)}">
                <i class="fas ${getActivityIcon(activity.type)}"></i>
            </div>
            <div class="activity-content">
                <h4>${activity.title}</h4>
                <p>${activity.description}</p>
            </div>
            <div class="activity-time">${formatDate(activity.date)}</div>
        </div>
    `).join('');
}

function getActivityColor(type) {
    const colors = {
        'in': 'linear-gradient(135deg, #43e97b, #38f9d7)',
        'out': 'linear-gradient(135deg, #4facfe, #00f2fe)',
        'damaged': 'linear-gradient(135deg, #f093fb, #f5576c)',
        'invoice': 'linear-gradient(135deg, #667eea, #764ba2)',
        'surat-jalan': 'linear-gradient(135deg, #f093fb, #f5576c)'
    };
    return colors[type] || 'linear-gradient(135deg, #6c757d, #495057)';
}

function getActivityIcon(type) {
    const icons = {
        'in': 'fa-arrow-up',
        'out': 'fa-arrow-down',
        'damaged': 'fa-exclamation-triangle',
        'invoice': 'fa-file-invoice',
        'surat-jalan': 'fa-truck'
    };
    return icons[type] || 'fa-info-circle';
}

// Chart functions
function initializeChart() {
    const chartElement = document.getElementById('monthlyChart');
    if (!chartElement) {
        console.log('Chart element not found, skipping chart initialization');
        return;
    }
    const ctx = chartElement.getContext('2d');
    window.monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Barang Masuk',
                data: [],
                borderColor: '#43e97b',
                backgroundColor: 'rgba(67, 233, 123, 0.1)',
                tension: 0.4
            }, {
                label: 'Barang Keluar',
                data: [],
                borderColor: '#4facfe',
                backgroundColor: 'rgba(79, 172, 254, 0.1)',
                tension: 0.4
            }, {
                label: 'Barang Rusak',
                data: [],
                borderColor: '#f093fb',
                backgroundColor: 'rgba(240, 147, 251, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Grafik Aktivitas Bulanan'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateChart(data) {
    const selectedMonth = document.getElementById('monthFilter').value;
    if (!selectedMonth) return;
    
    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const labels = [];
    const inData = [];
    const outData = [];
    const damagedData = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
        labels.push(day);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const dayItems = data.items.filter(item => item.date === dateStr);
        inData.push(dayItems.filter(item => item.transactionType === 'in').length);
        outData.push(dayItems.filter(item => item.transactionType === 'out').length);
        damagedData.push(dayItems.filter(item => item.transactionType === 'damaged').length);
    }
    
    window.monthlyChart.data.labels = labels;
    window.monthlyChart.data.datasets[0].data = inData;
    window.monthlyChart.data.datasets[1].data = outData;
    window.monthlyChart.data.datasets[2].data = damagedData;
    window.monthlyChart.update();
}

function updateCategoryFilter() {
    const categories = [...new Set(items.map(item => item.category))];
    const categoryFilter = document.getElementById('categoryFilter');
    
    categoryFilter.innerHTML = '<option value="">Semua Kategori</option>' +
        categories.map(category => `<option value="${category}">${category}</option>`).join('');
}

function getStatusText(type) {
    const statusTexts = {
        'in': 'Masuk',
        'out': 'Keluar',
        'damaged': 'Rusak'
    };
    return statusTexts[type] || type;
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    showLoadingSpinner();

    const form = e.target;
    const formData = new FormData(form);
    const transactionType = formData.get('transactionType');
    const transactionDate = formData.get('transactionDate');
    const description = formData.get('itemDescription') || '';

    if (!transactionType || !transactionDate) {
        showAlert('Pilih jenis transaksi dan tanggal terlebih dahulu!', 'Error');
        hideLoadingSpinner();
        return;
    }

    let itemsToSave = [];
    let hasError = false;

    try {
        const itemRows = document.querySelectorAll(`#${transactionType}ItemsList .form-row`);
        if (itemRows.length === 0) {
            throw new Error('Tidak ada item yang ditambahkan untuk transaksi ini.');
        }

        for (const row of itemRows) {
            const nameInput = row.querySelector('[class*="item-name-"]');
            // Perbaikan: Cari input quantity atau physical stock
            const quantityInput = row.querySelector('[class*="item-quantity-"]') || row.querySelector('.item-stock-physical');

            const unitInput = row.querySelector('[class*="item-unit-"]');

            const name = nameInput ? nameInput.value : null;
            const quantity = quantityInput ? parseInt(quantityInput.value) : 0;

            if (!name || !quantity || quantity <= 0) {
                // Lewati baris yang tidak lengkap, jangan hentikan proses
                continue;
            }

            const unit = unitInput ? unitInput.value : 'pcs';
            const templateItem = findMatchingItem(name);
            const price = templateItem ? templateItem.price : 0;

            const newItem = {
                id: generateId(),
                name: name,
                quantity: quantity,
                unit: unit,
                price: price,
                transactionType: transactionType,
                date: transactionDate,
                description: description,
                isTemplate: false
            };

            // Tambahkan detail spesifik per jenis transaksi
            if (transactionType === 'out') {
                newItem.customerName = formData.get('customerName');
                newItem.customerAddress = formData.get('customerAddress');
                if (!newItem.customerName) {
                    throw new Error('Nama pelanggan wajib diisi untuk barang keluar.');
                }
            } else if (transactionType === 'adjustment') {
                const systemStock = parseInt(row.querySelector('.item-stock-system').value) || 0;
                const physicalStock = parseInt(row.querySelector('.item-stock-physical').value);

                if (isNaN(physicalStock)) continue;

                const difference = physicalStock - systemStock;
                if (difference === 0) continue; // Tidak ada perubahan, lewati

                newItem.transactionType = difference > 0 ? 'in' : 'out';
                newItem.quantity = Math.abs(difference);
                newItem.customerName = 'Sistem';
                newItem.customerAddress = 'Penyesuaian Stok';
                newItem.systemStock = systemStock;
                newItem.physicalStock = physicalStock;
                newItem.difference = difference;
            }

            itemsToSave.push(newItem);
        }

        if (itemsToSave.length === 0) {
            throw new Error('Tidak ada data item yang valid untuk disimpan.');
        }

        // Simpan ke Firebase
        await saveItemChanges(itemsToSave);

        // Update array lokal
        items.push(...itemsToSave);

        // Perbarui tampilan
        updateDashboard();

        // Gunakan banner agar tidak menghentikan eksekusi, lalu bersihkan form
        clearForm();
        showSyncStatusBanner('Data transaksi berhasil disimpan!', 'success');

    } catch (error) {
        console.error('Error saat menyimpan transaksi:', error);
        showAlert(error.message, 'Gagal');
        hasError = true;
    } finally {
        hideLoadingSpinner();
    }
}

// Item form functions
function handleItemSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const transactionType = formData.get('transactionType');
    const transactionDate = formData.get('transactionDate') || new Date().toISOString().split('T')[0];
    const description = formData.get('itemDescription') || '';
    
    // Reset any existing adjustments for the same date
    if (transactionType === 'adjustment') {
        const existingAdjustments = items.filter(item => 
            item.customerName === 'Sistem' &&
            item.customerAddress === 'Penyesuaian Stok' &&
            item.date === transactionDate
        );
        
        if (existingAdjustments.length > 0) {
            items = items.filter(item => !existingAdjustments.includes(item));
        }
    }
    
    let savedItems = [];
    
    // Handle different transaction types
    if (transactionType === 'in') {
        // Handle multiple in items
        const inItems = document.querySelectorAll('.in-item-row');
        inItems.forEach((row, index) => {
            const name = row.querySelector('.item-name-in').value;
            const quantity = parseInt(row.querySelector('.item-quantity-in').value);
            const unit = row.querySelector('.item-unit-in').value || 'pcs';
            
            if (name && quantity) {
                const item = {
                    id: generateId(),
                    transactionType: 'in',
                    name: name,
                    quantity: quantity,
                    unit: unit,
                    description: description,
                    date: transactionDate
                };
                
                savedItems.push(item);
            }
        });
    } else if (transactionType === 'damaged') {
        // Handle multiple damaged items
        const damagedItems = document.querySelectorAll('.damaged-item-row');
        damagedItems.forEach((row, index) => {
            const name = row.querySelector('.item-name-damaged').value;
            const quantity = parseInt(row.querySelector('.item-quantity-damaged').value);
            const unit = row.querySelector('.item-unit-damaged').value || 'pcs';
            const photoFile = row.querySelector('.item-photo-damaged').files[0];
            
            if (name && quantity) {
                const item = {
                    id: generateId(),
                    transactionType: 'damaged',
                    name: name,
                    quantity: quantity,
                    unit: unit,
                    description: description,
                    date: transactionDate,
                    photo: null
                };
                
                if (photoFile) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        item.photo = e.target.result;
                        items.push(item);
                        saveDataToSheet();
                        addActivity('damaged', `Barang rusak ${item.name}`, 
                                    `Jumlah: ${item.quantity}`);                        updateDashboard();
                    };
                    reader.readAsDataURL(photoFile);
                } else {
                    savedItems.push(item);
                }
            }
        });
    } else if (transactionType === 'out') {
        const customerName = formData.get('customerName');
        const customerAddress = formData.get('customerAddress');
        
        // Handle multiple out items
        const outItems = document.querySelectorAll('.out-item-row');
        outItems.forEach((row, index) => {
            const name = row.querySelector('.item-name-out').value;
            const quantity = parseInt(row.querySelector('.item-quantity-out').value);
            
            // --- SOLUSI: Cari harga dari template barang dan simpan ---
            const templateItem = items.find(t => 
                t.isTemplate && 
                (t.name.toLowerCase().includes(name.toLowerCase()) || 
                 name.toLowerCase().includes(t.name.toLowerCase()))
            );
            const price = templateItem ? templateItem.price : 0;
            // ----------------------------------------------------

            if (name && quantity && customerName && customerAddress) {
                const item = {
                    id: generateId(),
                    transactionType: 'out',
                    name: name,
                    quantity: quantity,
                    unit: row.querySelector('.item-unit-out').value || 'pcs',
                    price: price, // <-- HARGA SEKARANG DISIMPAN BERSAMA TRANSAKSI
                    customerName: customerName,
                    customerAddress: customerAddress,
                    description: description,
                    date: transactionDate
                };
                
                savedItems.push(item);
            }
        });
    } else if (transactionType === 'adjustment') {
        const adjustmentItems = document.querySelectorAll('.adjustment-item-row');
        adjustmentItems.forEach(row => {
            const name = row.querySelector('.item-name-adjustment').value;
            const systemStock = parseInt(row.querySelector('.item-stock-system').value) || 0;
            const physicalStock = parseInt(row.querySelector('.item-stock-physical').value);

            if (name && !isNaN(physicalStock)) {
                const difference = physicalStock - systemStock;

                if (difference !== 0) {
                    const item = {
                        id: generateId(),
                        name: name,
                        unit: row.querySelector('.item-unit-adjustment').value || 'pcs',
                        date: transactionDate,
                        price: 0, // Harga tidak relevan untuk penyesuaian
                        description: `Penyesuaian Stok: ${systemStock} → ${physicalStock} (${difference >= 0 ? '+' + difference : difference})`,
                        // Simpan data asli untuk ditampilkan di database
                        systemStock: systemStock,
                        physicalStock: physicalStock,
                        difference: difference,
                        // Data untuk identifikasi
                        customerName: 'Sistem',
                        customerAddress: 'Penyesuaian Stok'
                    };

                    if (difference > 0) {
                        // Stok fisik lebih banyak -> Barang Masuk
                        item.transactionType = 'in';
                        item.quantity = difference;
                    } else {
                        // Stok fisik lebih sedikit -> Barang Keluar
                        item.transactionType = 'out';
                        item.quantity = Math.abs(difference);
                    }
                    savedItems.push(item);
                }
            }
        });


    }
    
    // Save all items
    if (savedItems.length > 0) {
        savedItems.forEach(item => {
            items.push(item);
            addActivity(item.transactionType, `Barang ${item.name} ${getStatusText(item.transactionType)}`, 
                        `Jumlah: ${item.quantity}`);
        });
        
        saveDataToSheet();
        clearForm();
        updateDashboard();
        
        alert(`${savedItems.length} item berhasil disimpan!`);
    } else {
        alert('Mohon isi data dengan lengkap!');
    }
}

function saveItem(item) {
    items.push(item);
    saveDataToSheet();
    
    // Add activity
    addActivity(item.transactionType, `Barang ${item.name} ${getStatusText(item.transactionType)}`, 
                `Jumlah: ${item.quantity}, Kategori: ${item.category}`);
    
    clearForm();
    updateDashboard();
    
    alert('Barang berhasil disimpan!');
}

function clearForm() {
    const form = document.getElementById('itemForm');
    if (form) {
        // Reset form untuk membersihkan input seperti tanggal dan deskripsi
        form.reset(); 
    }
    
    // Hide all transaction layouts
    document.querySelectorAll('.transaction-layout').forEach(layout => {
        layout.style.display = 'none';
    });

    // Kosongkan semua daftar item yang ditambahkan secara dinamis
    const itemLists = [
        'inItemsList', 
        'outItemsList', 
        'damagedItemsList', 
        'adjustmentItemsList'
    ];
    itemLists.forEach(listId => {
        const listElement = document.getElementById(listId);
        if (listElement) {
            listElement.innerHTML = '';
        }
    });

    // Reset dropdown jenis transaksi ke pilihan default
    const transactionType = document.getElementById('transactionType');
    if (transactionType) {
        transactionType.value = '';
    }
    
    // Atur kembali tanggal ke hari ini
    initializeInputForm();
}

function generateId() {
    return 'ITM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
}

function generateRBMNumber() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2); // Ambil 2 digit terakhir tahun
    
    return `RBM-${day}${month}${year}`;
}

function generateSimpleDateNumber(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Tambahkan 1 hari untuk mengatasi masalah zona waktu jika tanggalnya salah
    date.setTime(date.getTime() + (date.getTimezoneOffset() * 60 * 1000));
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}${month}${year}`;
}

function generateRBMNumberFromDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2); // Ambil 2 digit terakhir tahun
    
    return `RBM-${day}${month}${year}`;
}

function addActivity(type, title, description) {
    const activity = {
        id: generateId(),
        type: type,
        title: title,
        description: description,
        date: new Date().toISOString()
    };
    
    activities.push(activity);
    saveDataToSheet(); // Simpan semua data termasuk aktivitas baru
}

// --- IMPLEMENTASI FUNGSI INVOICE YANG HILANG ---
function addInvoiceItem() {
    const itemsList = document.getElementById('invoiceItemsList');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'invoice-item';
    // Gunakan input biasa, bukan readonly, agar bisa diedit
    itemDiv.innerHTML = `
        <input type="text" placeholder="Nama Barang" class="form-control item-name" list="itemSuggestions" oninput="calculateInvoiceTotal()">
        <input type="number" placeholder="Jumlah" class="form-control item-quantity" min="1" oninput="calculateInvoiceTotal()">
        <input type="number" placeholder="Harga" class="form-control item-price" min="0" oninput="calculateInvoiceTotal()">
        <button type="button" class="btn btn-danger btn-sm" onclick="removeInvoiceItem(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    itemsList.appendChild(itemDiv);

    // Populate suggestions for the new item row
    populateItemSuggestions();

    // Auto-fill price when item name is selected
    const nameInput = itemDiv.querySelector('.item-name');
    nameInput.addEventListener('change', function() {
        autoFillInvoicePrice(this);
    });
}

// Invoice functions
function generateNewInvoice() {
    const invoiceNumber = generateRBMNumber();
    const currentDate = new Date().toISOString().split('T')[0];
    resetInvoiceForm(); // Clear the entire form
}

function removeInvoiceItem(button) {
    // Tombol sekarang ada di dalam .invoice-item
    button.closest('.invoice-item').remove();
    calculateInvoiceTotal();
}

function calculateInvoiceTotal() {
    const items = document.querySelectorAll('.invoice-item');
    let total = 0;

    items.forEach(item => {
        const quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
        const price = parseFloat(item.querySelector('.item-price').value) || 0;
        const subtotal = quantity * price;
        total += subtotal;

        // Update subtotal display if it exists
        const subtotalSpan = item.querySelector('.item-subtotal');
        if (subtotalSpan) {
            subtotalSpan.textContent = 'Rp ' + subtotal.toLocaleString();
        }
    });
    
    document.getElementById('invoiceTotal').textContent = 'Rp ' + total.toLocaleString();
}

function saveInvoice() {
    const invoiceData = {
        id: document.getElementById('invoiceNumber').value,
        date: document.getElementById('invoiceDate').value,
        customerName: document.getElementById('customerName').value,
        customerAddress: document.getElementById('customerAddress').value,
        items: [],
        total: 0,
        paymentStatus: 'Belum Lunas', // Status default
        amountPaid: 0 // Jumlah dibayar default
    };
    
    const itemElements = document.querySelectorAll('.invoice-item');
    itemElements.forEach(item => {
        const name = item.querySelector('.item-name').value;
        const quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
        const price = parseFloat(item.querySelector('.item-price').value) || 0;
        
        if (name && quantity && price) {
            invoiceData.items.push({ name, quantity, price, subtotal: quantity * price });
        }
    });
    
    invoiceData.total = invoiceData.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    if (invoiceData.items.length === 0) {
        alert('Tambah minimal satu item!');
        return;
    }
    
    // Save to localStorage
    invoices.push(invoiceData);
    // Simpan dokumen ke Firebase
    saveDocument('invoices', invoiceData);

    // Auto-generate Surat Jalan
    const suratJalanCreated = generateSuratJalanFromInvoice(invoiceData);
    
    // Save all data
    saveDataToSheet(); // Ini akan menyimpan 'items', yang lain masih di localStorage

    addActivity('invoice', `Invoice ${invoiceData.id} dibuat`, 
                `Pelanggan: ${invoiceData.customerName}, Total: Rp ${invoiceData.total.toLocaleString()}`);

    // Download PDFs
    try {
        generateInvoicePDF(invoiceData);
        generateSuratJalanPDF(suratJalanCreated);
        console.log('Invoice dan Surat Jalan berhasil disimpan dan PDF akan diunduh.');
    } catch (e) {
        console.error('Gagal membuat PDF saat menyimpan:', e);
        // alert('Invoice dan Surat Jalan berhasil disimpan, namun gagal mengunduh PDF.'); // Silent on error
    }

    updateDashboard();

    // Reset form for the next invoice
    resetInvoiceForm();
}

// New function to reset the entire invoice form for a new entry
function resetInvoiceForm() {
    const invoiceNumberInput = document.getElementById('invoiceNumber');
    const customerNameInput = document.getElementById('customerName');
    const customerAddressInput = document.getElementById('customerAddress');
    const invoiceDateInput = document.getElementById('invoiceDate');
    const invoiceItemsList = document.getElementById('invoiceItemsList');
    const invoiceTotal = document.getElementById('invoiceTotal');

    if (invoiceNumberInput) invoiceNumberInput.value = generateRBMNumberFromDate(new Date().toISOString().split('T')[0]);
    if (customerNameInput) customerNameInput.value = ''; // Clear customer name
    if (customerAddressInput) customerAddressInput.value = ''; // Clear textarea
    if (invoiceDateInput) invoiceDateInput.value = new Date().toISOString().split('T')[0]; // Reset to today
    if (invoiceItemsList) invoiceItemsList.innerHTML = ''; // Clear item list
    if (invoiceTotal) invoiceTotal.textContent = 'Rp 0'; // Reset total
}

// New function to print both invoice and surat jalan together
function printInvoiceAndSuratJalan(fromSave = false) {
    try {
        // 1. Kumpulkan data dari form (sama seperti di saveInvoice)
        const invoiceData = {
            id: document.getElementById('invoiceNumber').value, // Gunakan id agar konsisten
            date: document.getElementById('invoiceDate').value,
            customerName: document.getElementById('customerName').value,
            customerAddress: document.getElementById('customerAddress').value,
            items: [],
            total: 0,
            paymentStatus: 'Belum Lunas', // Status default saat dibuat
            amountPaid: 0
        };
        
        const itemElements = document.querySelectorAll('.invoice-item');
        itemElements.forEach(item => {
            const name = item.querySelector('.item-name').value;
            const quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
            const price = parseFloat(item.querySelector('.item-price').value) || 0;
            
            if (name && quantity && price) {
                invoiceData.items.push({ name, quantity, price, subtotal: quantity * price });
            }
        });
        
        invoiceData.total = invoiceData.items.reduce((sum, item) => sum + item.subtotal, 0);
        
        if (invoiceData.items.length === 0) {
            if (!fromSave) alert('Tidak ada item untuk dicetak!');
            return;
        }

        // 2. Simpan data ke array lokal dan Firebase (logika dari saveInvoice)
        // Cek apakah invoice dengan ID yang sama sudah ada untuk menghindari duplikat
        const existingInvoiceIndex = invoices.findIndex(inv => inv.id === invoiceData.id);
        if (existingInvoiceIndex > -1) {
            invoices[existingInvoiceIndex] = invoiceData; // Update jika sudah ada
        } else {
            invoices.push(invoiceData); // Tambah baru jika belum ada
        }
        saveDocument('invoices', invoiceData); // Simpan ke Firebase
        addActivity('invoice', `Invoice ${invoiceData.id} dibuat`, 
                    `Pelanggan: ${invoiceData.customerName}, Total: Rp ${invoiceData.total.toLocaleString()}`);
        
        // 3. Buat Surat Jalan secara otomatis
        const suratJalanData = generateSuratJalanFromInvoice(invoiceData);
        
        // 4. Siapkan konten untuk dicetak
        const invoiceContent = createInvoicePrintContent(invoiceData);
        const suratJalanContent = createSuratJalanPrintContent(suratJalanData);
        
        const combinedContent = `
            <div style="page-break-after: always;">
                ${invoiceContent}
            </div>
            <div>
                ${suratJalanContent}
            </div>
        `;
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Pop-up blocked! Please allow pop-ups for this site.');
            return;
        }
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice & Surat Jalan - ${invoiceData.id}</title>
                <style>
                    @page { size: A5 portrait; margin: 10mm; }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                        .page-break { page-break-before: always; }
                    }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                </style>
            </head>
            <body>
                ${combinedContent}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print(); // Print after content is fully rendered
        }, 500);

        // 5. Reset form untuk invoice berikutnya
        resetInvoiceForm();
        
    } catch (error) {
        console.error('Error in printInvoiceAndSuratJalan:', error);
        alert('Terjadi kesalahan saat mencetak: ' + error.message);
    }
}

// Function to auto-generate surat jalan from invoice
function generateSuratJalanFromInvoice(invoiceData) {
    const suratJalanData = {
        id: invoiceData.id, // Use same ID as invoice
        date: invoiceData.date,
        deliveryAddress: invoiceData.customerAddress,
        recipientName: invoiceData.customerName,
        items: invoiceData.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            condition: 'Baik'
        }))
    };
    
    // Save to surat jalan storage
    suratJalan.push(suratJalanData); // Add to global array
    saveDocument('suratJalan', suratJalanData); // Use new granular save function
    
    addActivity('surat-jalan', `Surat Jalan ${suratJalanData.id} dibuat otomatis`, 
                `Penerima: ${suratJalanData.recipientName}, Alamat: ${suratJalanData.deliveryAddress}`);
    return suratJalanData;
}

// Surat Jalan functions
function generateNewSuratJalan() {
    const suratJalanNumber = generateRBMNumber();
    const currentDate = new Date().toISOString().split('T')[0];
    // This function is likely not used anymore as surat jalan is generated from invoice.
    // If it were, it would need to reset the form elements.
}

function addSuratJalanItem() {
    const itemsList = document.getElementById('suratJalanItemsList');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'surat-jalan-item';
    itemDiv.innerHTML = `
        <input type="text" placeholder="Nama Barang" class="form-control item-name" required>
        <input type="number" placeholder="Jumlah" class="form-control item-quantity" min="1" required>
        <input type="text" placeholder="Kondisi" class="form-control item-condition" required>
        <button type="button" class="btn btn-danger" onclick="removeSuratJalanItem(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    itemsList.appendChild(itemDiv);
}

function removeSuratJalanItem(button) {
    button.parentElement.remove();
}

function saveSuratJalan() {
    const suratJalanData = {
        id: document.getElementById('suratJalanNumber').value,
        date: document.getElementById('suratJalanDate').value,
        senderName: document.getElementById('senderName').value,
        deliveryAddress: document.getElementById('deliveryAddress').value,
        recipientName: document.getElementById('recipientName').value,
        items: []
    };
    
    const itemElements = document.querySelectorAll('.surat-jalan-item');
    itemElements.forEach(item => {
        const name = item.querySelector('.item-name').value;
        const quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
        const condition = item.querySelector('.item-condition').value;
        
        if (name && quantity && condition) {
            suratJalanData.items.push({ name, quantity, condition });
        }
    });
    
    if (suratJalanData.items.length === 0) {
        alert('Tambah minimal satu item!');
        return;
    }
    
    // Save to database
    suratJalan.push(suratJalanData); // Add to global array
    saveDocument('suratJalan', suratJalanData); // Use new granular save function
    
    addActivity('surat-jalan', `Surat Jalan ${suratJalanData.id} dibuat`, 
                `Penerima: ${suratJalanData.recipientName}, Alamat: ${suratJalanData.deliveryAddress}`);
    
    // Generate and save PDF
    generateSuratJalanPDF(suratJalanData);
    
    alert('Surat Jalan berhasil disimpan dan PDF telah diunduh!');
    updateDashboard();
}

function printSuratJalan() {
    const suratJalanData = {
        number: document.getElementById('suratJalanNumber').value,
        date: document.getElementById('suratJalanDate').value,
        senderName: document.getElementById('senderName').value,
        deliveryAddress: document.getElementById('deliveryAddress').value,
        recipientName: document.getElementById('recipientName').value,
        items: []
    };
    
    const itemElements = document.querySelectorAll('.surat-jalan-item');
    itemElements.forEach(item => {
        const name = item.querySelector('.item-name').value;
        const quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
        const condition = item.querySelector('.item-condition').value;
        
        if (name && quantity && condition) {
            suratJalanData.items.push({ name, quantity, condition });
        }
    });
    
    if (suratJalanData.items.length === 0) {
        alert('Tidak ada item untuk dicetak!');
        return;
    }
    
    // Direct print
    const printContent = createSuratJalanPrintContent(suratJalanData);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}
// This function is no longer used due to the refactoring of the invoice page.
// Function to print both invoice and surat jalan from surat jalan page
function printInvoiceAndSuratJalanFromSuratJalan() {
    try {
        const suratJalanData = {
            number: document.getElementById('suratJalanNumber').value,
            date: document.getElementById('suratJalanDate').value,
            senderName: document.getElementById('senderName').value,
            deliveryAddress: document.getElementById('deliveryAddress').value,
            recipientName: document.getElementById('recipientName').value,
            items: []
        };
        
        const itemElements = document.querySelectorAll('.surat-jalan-item');
        itemElements.forEach(item => {
            const name = item.querySelector('.item-name').value;
            const quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
            const condition = item.querySelector('.item-condition').value;
            
            if (name && quantity && condition) {
                suratJalanData.items.push({ name, quantity, condition });
            }
        });
        
        if (suratJalanData.items.length === 0) {
            alert('Tidak ada item untuk dicetak!');
            return;
        }
        
        // Create invoice data from surat jalan
        const invoiceData = {
            number: suratJalanData.number,
            date: suratJalanData.date,
            customerName: suratJalanData.recipientName,
            customerAddress: suratJalanData.deliveryAddress,
            items: suratJalanData.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: 0, // Default price, should be filled from database
                subtotal: 0
            })),
            total: 0
        };
        
        // Try to get prices from database
        invoiceData.items.forEach(item => {
            const templateItem = items.find(t => t.isTemplate && 
                (t.name.toLowerCase().includes(item.name.toLowerCase()) || 
                 item.name.toLowerCase().includes(t.name.toLowerCase())));
            
            if (templateItem) {
                item.price = templateItem.price || 0;
                item.subtotal = item.quantity * item.price;
            }
        });
        
        invoiceData.total = invoiceData.items.reduce((sum, item) => sum + item.subtotal, 0);
        
        // Create combined print content
        const invoiceContent = createInvoicePrintContent(invoiceData);
        const suratJalanContent = createSuratJalanPrintContent(suratJalanData);
        
        const combinedContent = `
            <div style="page-break-after: always;">
                ${invoiceContent}
            </div>
            <div>
                ${suratJalanContent}
            </div>
        `;
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Pop-up blocked! Please allow pop-ups for this site.');
            return;
        }
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice & Surat Jalan - ${suratJalanData.number}</title>
                <style>
                    @page { size: A5 portrait; margin: 10mm; }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                        .page-break { page-break-before: always; }
                    }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                </style>
            </head>
            <body>
                ${combinedContent}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print(); // Print after content is fully rendered
        }, 500);
        
    } catch (error) {
        console.error('Error in printInvoiceAndSuratJalanFromSuratJalan:', error);
        alert('Terjadi kesalahan saat mencetak: ' + error.message);
    }
}

// Print functions
function createInvoicePrintContent(data) {
    // compact/print-friendly invoice template tuned for A5.
    const rows = (data.items || []).length;
    // Choose font size based on number of rows (keeps readability while trying to fit on one A5 page)
    let fontSize = 12;
    if (rows <= 5) fontSize = 12;
    else if (rows <= 10) fontSize = 11;
    else if (rows <= 20) fontSize = 10;
    else if (rows <= 30) fontSize = 9;
    else fontSize = 8; // very dense

    const cellPadding = rows > 20 ? 6 : 8;

    const itemsHtml = (data.items || []).map(item => `
        <tr>
            <td style="padding:${cellPadding}px 6px; border-bottom:1px solid #ddd;">${escapeHtml(item.name)}</td>
            <td style="padding:${cellPadding}px 6px; text-align:center; border-bottom:1px solid #ddd;">${item.quantity}</td>
            <td style="padding:${cellPadding}px 6px; text-align:right; border-bottom:1px solid #ddd;">Rp ${Number(item.price || 0).toLocaleString()}</td>
            <td style="padding:${cellPadding}px 6px; text-align:right; border-bottom:1px solid #ddd;">Rp ${Number(item.subtotal || (item.quantity * (item.price || 0))).toLocaleString()}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Invoice ${escapeHtml(data.number)}</title>
            <style>
                @page { size: A5 portrait; margin: 8mm; }
                html,body{height:100%;}
                body { margin: 0; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .kop-surat { display: flex; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                .kop-surat .logo { font-size: 40px; margin-right: 15px; color: #667eea; }
                .kop-surat .company-details { font-size: 10px; }
                .kop-surat .company-details h2 { margin: 0 0 5px; font-size: 16px; color: #2c3e50; }
                .page { box-sizing: border-box; width:100%; padding:6mm; }
                .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
                .brand { font-weight:bold; color:#333; font-size:${fontSize + 2}px; }
                .meta { text-align:right; font-size:${Math.max(9, fontSize - 1)}px; }
                .customer { background:#f5f5f5; padding:6px; border-radius:4px; margin-bottom:6px; font-size:${Math.max(9, fontSize - 1)}px; }
                .notes { margin-top: 10px; padding: 8px; border: 1px solid #f0ad4e; background-color: #fcf8e3; border-radius: 4px; font-size: ${Math.max(9, fontSize - 2)}px; color: #8a6d3b; text-align: center; }
                table { width:100%; border-collapse:collapse; font-size:${fontSize}px; }
                table thead th { background:#f0f0f0; padding:6px; text-align:left; font-weight:bold; }
                table td { vertical-align:middle; }
                .total { margin-top:6px; text-align:right; background:linear-gradient(90deg,#28a745,#20c997); color:white; padding:8px; border-radius:4px; font-weight:bold; font-size:${Math.max(10, fontSize+1)}px; }
                .small { font-size:9px; color:#666; }
                .signatures { display: flex; justify-content: space-around; margin-top: 25px; text-align: center; font-size: 10px; color: #666; }
                .signature-box { flex: 1; }
                .signature-space { height: 60px; }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="kop-surat">
                    <div class="logo"><i class="fas fa-bowl-rice"></i></div>
                    <div class="company-details">
                        <h2>Rice Bowl Monsters</h2>
                        <div>Jl. Raya Sawocangkring No.02, Sawo, Sawocangkring, Kec. Wonoayu, Kabupaten Sidoarjo, Jawa Timur 61261</div>
                    </div>
                </div>

                <div class="header">
                    <div class="brand" style="width: 100%; text-align: center; font-size: ${fontSize + 4}px;">INVOICE</div>
                </div>
                <div class="meta" style="text-align:left; margin-bottom: 10px;">
                    <div class="meta">
                        <div><strong>Nomor:</strong> ${escapeHtml(data.number)}</div>
                        <div><strong>Tanggal:</strong> ${escapeHtml(formatDate(data.date))}</div>
                    </div>
                </div>

                <div class="customer">
                    <div><strong>Kepada:</strong> ${escapeHtml(data.customerName || '-')}</div>
                    <div><strong>Alamat:</strong> ${escapeHtml(data.customerAddress || '-')}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Nama Item</th>
                            <th style="width:50px;text-align:center;">Jumlah</th>
                            <th style="width:90px;text-align:right;">Harga</th>
                            <th style="width:90px;text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div class="total">Total: Rp ${Number(data.total || 0).toLocaleString()}</div>

                <div class="notes">
                    <strong>PERHATIAN:</strong> Barang-barang yang sudah dibeli tidak dapat dikembalikan/ditukar.
                </div>

                <div class="small" style="margin-top:6px;">Terima kasih atas kepercayaan Anda</div>
                <div class="signatures">
                    <div class="signature-box">Pelanggan<div class="signature-space"></div>(___________________)</div>
                    <div class="signature-box">Admin Rice Bowl Monsters<div class="signature-space"></div>(___________________)</div>
                </div>
            </div>
        </body>
        </html>
    `;
}

function createSuratJalanPrintContent(data) {
    // Compact surat jalan template for A5
    const rows = (data.items || []).length;
    let fontSize = 11;
    if (rows <= 5) fontSize = 12; else if (rows <= 15) fontSize = 11; else if (rows <= 30) fontSize = 10; else fontSize = 9;
    const cellPadding = rows > 20 ? 6 : 8;
    
    const itemsHtml = (data.items || []).map(item => `
        <tr>
            <td style="padding:${cellPadding}px 6px; border-bottom:1px solid #ddd;">${escapeHtml(item.name)}</td>
            <td style="padding:${cellPadding}px 6px; text-align:center; border-bottom:1px solid #ddd;">${item.quantity}</td>
            <td style="padding:${cellPadding}px 6px; text-align:center; border-bottom:1px solid #ddd; color:#28a745; font-weight:bold;">${escapeHtml(item.condition)}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>Surat Jalan ${escapeHtml(data.number)}</title>
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
                <style>
                    @page { size: A5 portrait; margin: 8mm; }
                    body { margin:0; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .page{padding:6mm; box-sizing:border-box}
                    .kop-surat { display: flex; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                    .kop-surat .logo { font-size: 40px; margin-right: 15px; color: #667eea; }
                    .kop-surat .company-details { font-size: 10px; }
                    .kop-surat .company-details h2 { margin: 0 0 5px; font-size: 16px; color: #2c3e50; }
                    .header{display:flex; justify-content:space-between; align-items:center; margin-bottom:10px}
                    .title{font-weight:bold; font-size:${fontSize + 4}px; text-align: center; width: 100%;}
                    .meta{font-size:${Math.max(9, fontSize - 1)}px; text-align:left; margin-bottom: 10px;}
                    .info{background:#f5f5f5; padding:8px; border-radius:4px; margin-bottom:10px; font-size:${Math.max(9,fontSize-1)}px}
                    table{width:100%; border-collapse:collapse; font-size:${fontSize}px}
                    table thead th{background:#eef7f9; padding:8px; text-align:left}
                    .notes{background:linear-gradient(135deg,#fff3cd,#ffeaa7); padding:8px; border-radius:4px; font-size:${Math.max(9,fontSize-1)}px; margin-top: 10px;}
                    .signatures { display: flex; justify-content: space-around; margin-top: 25px; text-align: center; font-size: 10px; color: #666; }
                    .signature-box { flex: 1; }
                    .signature-space { height: 60px; }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="kop-surat">
                        <div class="logo"><i class="fas fa-bowl-rice"></i></div>
                        <div class="company-details">
                            <h2>Rice Bowl Monsters</h2>
                            <div>Jl. Raya Sawocangkring No.02, Sawo, Sawocangkring, Kec. Wonoayu, Kabupaten Sidoarjo, Jawa Timur 61261</div>
                        </div>
                    </div>

                    <div class="header">
                        <div class="title">SURAT JALAN</div>
                    </div>
                    <div class="meta">
                        <div><strong>Nomor:</strong> ${escapeHtml(data.number)}</div>
                        <div><strong>Tanggal:</strong> ${escapeHtml(formatDate(data.date))}</div>
                    </div>

                    <div class="info">
                        <div><strong>Dari:</strong> ${escapeHtml(data.senderName || 'Central Rice Bowl Monsters')}</div>
                        <div><strong>Kepada:</strong> ${escapeHtml(data.recipientName || '-')}</div>
                        <div><strong>Alamat:</strong> ${escapeHtml(data.deliveryAddress || '-')}</div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Nama Barang</th>
                                <th style="width:60px;text-align:center;">Jumlah</th>
                                <th style="width:80px;text-align:center;">Kondisi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>

                    <div class="notes">Barang telah dikemas dengan baik dan siap untuk pengiriman. Harap periksa kondisi barang sebelum menerima.</div>

                    <div class="signatures">
                        <div class="signature-box">Yang Mengirim<div class="signature-space"></div>(___________________)</div>
                        <div class="signature-box">Yang Mengeluarkan<div class="signature-space"></div>(___________________)</div>
                        <div class="signature-box">Yang Menerima<div class="signature-space"></div>(___________________)</div>
                    </div>
                </div>
            </body>
        </html>
    `;
}

function printDocument(content, title) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { margin: 0; padding: 20px; }
                    @media print {
                        body { margin: 0; padding: 0; }
                    }
                </style>
            </head>
            <body>
                ${content}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function setCurrentDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceDate').value = today;
    document.getElementById('suratJalanDate').value = today;
}

// Small helper to escape HTML in templates (some older code or third-party snippets
// may call escapeHtml — define it to avoid runtime 'not defined' errors).
function escapeHtml(input) {
    if (input === null || input === undefined) return '';
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- Banner & retry helpers ---
function showFetchErrorBanner(message) {
    // Remove existing banner if any
    const existing = document.getElementById('fetchErrorBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'fetchErrorBanner';
    banner.style.position = 'fixed';
    banner.style.top = '12px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.zIndex = 9999;
    banner.style.background = '#ffc107';
    banner.style.color = '#212529';
    banner.style.padding = '10px 14px';
    banner.style.borderRadius = '6px';
    banner.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    banner.style.fontSize = '14px';
    banner.innerHTML = `
        <span style="margin-right:12px;">${escapeHtml(message)}</span>
        <button id="retryFetchBtn" style="margin-right:8px;padding:6px 10px;border-radius:4px;border:none;background:#007bff;color:white;cursor:pointer;">Muat Ulang</button>
        <button id="dismissFetchBanner" style="padding:6px 10px;border-radius:4px;border:none;background:transparent;color:#212529;cursor:pointer;">Tutup</button>
    `;

    document.body.appendChild(banner);

    document.getElementById('retryFetchBtn').addEventListener('click', function() {
        // Hapus banner lalu coba inisialisasi ulang
        removeFetchErrorBanner();
        // Try to re-run initializeApp (non-blocking)
        initializeApp();
    });

    document.getElementById('dismissFetchBanner').addEventListener('click', removeFetchErrorBanner);
}

function removeFetchErrorBanner() {
    const b = document.getElementById('fetchErrorBanner');
    if (b) b.remove();
}

// Optional automatic retry with backoff (used internally if needed)
async function retryFetchWithBackoff(attempts = 3, delayMs = 1000) {
    for (let i = 0; i < attempts; i++) {
        try {
            const resp = await fetch(GOOGLE_SCRIPT_URL);
            if (!resp.ok) throw new Error('Status ' + resp.status);
            const data = await resp.json();
            return data;
        } catch (e) {
            console.warn(`Retry ${i + 1} failed:`, e);
            await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        }
    }
    throw new Error('All retries failed');
}

function showSyncStatusBanner(message, type = 'info') {
    // small temporary toast
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = 10000;
    toast.style.padding = '8px 12px';
    toast.style.borderRadius = '6px';
    toast.style.color = '#fff';
    toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    toast.style.background = type === 'success' ? '#28a745' : (type === 'error' ? '#dc3545' : '#6c757d');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

/**
 * --- REFACTORED DATA SAVING LOGIC ---
 * The old `saveDataToSheet` function was inefficient and prone to race conditions
 * as it deleted and rewrote entire collections.
 *
 * The new approach uses more granular functions to handle specific changes:
 * - `saveItemChanges`: For creating or updating a list of items.
 * - `deleteItemById`: For deleting a single item.
 * - `saveDocument`: For creating or updating a single document (like an invoice or activity).
 * - `deleteDocument`: For deleting a single document.
 *
 * This is more efficient, safer, and reduces Firestore read/write costs.
 * The old function is kept for reference but is no longer used.
 */

async function saveItemChanges(itemsToSave) {
    if (!Array.isArray(itemsToSave)) {
        itemsToSave = [itemsToSave]; // Allow single object
    }

    const batch = db.batch();
    itemsToSave.forEach(item => {
        const docRef = db.collection('items').doc(item.id);
        batch.set(docRef, item, { merge: true }); // Use merge to be safe
    });

    try {
        await batch.commit();
        console.log(`${itemsToSave.length} item(s) saved to Firestore.`);
        showSyncStatusBanner('Data berhasil disimpan ke database.', 'success');
    } catch (error) {
        // Log error details and rethrow so caller can display the exact message
        console.error('Gagal menyimpan item ke Firestore:', error);
        showSyncStatusBanner('Gagal menyimpan item. Periksa koneksi internet dan izin penulisan Firebase.', 'error');
        throw error;
    }
}

async function deleteItemById(itemId) {
    try {
        await db.collection('items').doc(itemId).delete();
        console.log(`Item ${itemId} deleted from Firestore.`);
        showSyncStatusBanner('Item berhasil dihapus dari database.', 'success');
    } catch (error) {
        console.error(`Gagal menghapus item ${itemId} dari Firestore:`, error);
        showSyncStatusBanner('Gagal menghapus item. Periksa koneksi internet dan izin Firebase.', 'error');
        throw error;
    }
}

async function saveDocument(collectionName, doc) {
    try {
        await db.collection(collectionName).doc(doc.id).set(doc, { merge: true });
        console.log(`Dokumen ${doc.id} disimpan di koleksi ${collectionName}.`);
        showSyncStatusBanner('Dokumen berhasil disimpan.', 'success');
    } catch (error) {
        console.error(`Gagal menyimpan dokumen di ${collectionName}:`, error);
        showSyncStatusBanner('Gagal menyimpan dokumen. Periksa koneksi internet dan izin Firebase.', 'error');
        throw error;
    }
}

async function deleteDocument(collectionName, docId) {
    try {
        await db.collection(collectionName).doc(docId).delete();
        console.log(`Dokumen ${docId} dihapus dari koleksi ${collectionName}.`);
        showSyncStatusBanner('Dokumen berhasil dihapus.', 'success');
    } catch (error) {
        console.error(`Gagal menghapus dokumen ${docId} dari ${collectionName}:`, error);
        showSyncStatusBanner('Gagal menghapus dokumen. Periksa koneksi internet dan izin Firebase.', 'error');
        throw error;
    }
}

// The "delete all data" feature has been removed from the UI for safety.
// If you need to perform a full collection wipe, do it manually from the
// Firebase Console or reintroduce a server-side admin script with proper
// authentication and safeguards. Removing the destructive client function.

// This function is now deprecated and replaced by granular save/delete functions.
// It is kept here for reference or if a full sync is ever needed.
async function saveDataToSheet() {
    console.warn("saveDataToSheet() is deprecated. Using granular save functions instead.");
    // This function is too destructive. It deletes everything and rewrites.
    // This can cause race conditions and data loss if two users are active.
    // The new granular functions (saveItemChanges, deleteItemById, etc.) should be used instead.
    // If you absolutely must run a full sync, you can uncomment the code below,
    // but it is not recommended for regular operations.
    /*
    try {
        const batch = db.batch();
        // ... (old code to delete and rewrite all collections) ...
        await batch.commit();
        showSyncStatusBanner('Sinkronisasi penuh berhasil.', 'success');
    } catch (error) {
        console.error('Gagal melakukan sinkronisasi penuh:', error);
        showSyncStatusBanner('Gagal melakukan sinkronisasi penuh.', 'error');
        initializeApp();
    }
    */
}

// Item management functions
function editItem(itemId) {
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
        alert('Item tidak ditemukan!');
        return;
    }

    const item = items[itemIndex];
    const newQuantity = prompt(`Edit jumlah untuk "${item.name}":`, item.quantity);

    if (newQuantity === null || newQuantity === '') {
        return; // Pengguna membatalkan atau tidak memasukkan apa-apa
    }

    const quantity = parseInt(newQuantity);
    if (isNaN(quantity) || quantity < 0) {
        alert('Jumlah tidak valid!');
        return;
    }

    // Update item di array lokal
    items[itemIndex].quantity = quantity;

    // Simpan perubahan ke Firebase
    saveItemChanges(items[itemIndex])
        .then(() => {
            alert('Jumlah item berhasil diperbarui!');
            // Muat ulang tampilan yang relevan
            if (document.getElementById('dashboardTableBody')) { // Selalu update dashboard
                updateDashboard();
            }
        })
        .catch(error => {
            console.error('Gagal memperbarui item:', error);
            // Kembalikan perubahan jika gagal
            items[itemIndex].quantity = item.quantity;
        });
}

function deleteItem(itemId) {
    if (confirm('Apakah Anda yakin ingin menghapus item ini?')) {
        items = items.filter(item => item.id !== itemId);
        deleteItemById(itemId); // Use new granular delete function
        // Perbarui dashboard setelah item dihapus
        updateDashboard();
    }
}

function showPhotoModal(photoSrc) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('photoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'photoModal';
        modal.className = 'photo-modal';
        modal.innerHTML = `
            <div class="photo-modal-content">
                <span class="photo-modal-close">&times;</span>
                <img id="modalPhoto" src="" alt="Foto barang rusak">
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.photo-modal-close').addEventListener('click', hidePhotoModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) hidePhotoModal();
        });
    }
    
    // Show modal with photo
    document.getElementById('modalPhoto').src = photoSrc;
    modal.style.display = 'block';
}

function hidePhotoModal() {
    const modal = document.getElementById('photoModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Modal functions for adding new items
function showAddItemModal() {
    const modal = document.getElementById('addItemModal');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('show');
        // Clear form
        const form = document.getElementById('addItemForm');
        if (form) {
            form.reset();
        }
    }
}

function hideAddItemModal() {
    const modal = document.getElementById('addItemModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

async function saveNewItemData() {
    const form = document.getElementById('addItemForm');
    if (!form) {
        showAlert('Form tambah barang tidak ditemukan!', 'Error');
        return;
    }
    
    const formData = new FormData(form);
    
    // Validate required fields
    const name = formData.get('newItemName');
    const unit = formData.get('newItemUnit');
    const category = formData.get('newItemCategory');
    
    if (!name || !unit || !category) {
        showAlert('Mohon isi Nama Barang, Satuan, dan Kategori.', 'Validasi Gagal');
        return;
    }
    
    // Check if item already exists
    // PERBAIKAN: Cek semua item (template dan transaksi) untuk duplikasi nama dan satuan.
    const existingItem = items.find(item => 
        item.isTemplate && // Hanya cek duplikat terhadap template lain
        (item.name || '').toLowerCase() === (name || '').toLowerCase() && 
        item.unit === unit
    );
    
    if (existingItem) {
        // Gunakan showAlert agar konsisten dan tidak memblokir UI
        showAlert('Barang dengan nama dan satuan yang sama sudah ada!', 'Gagal Menambahkan');
        console.warn('Attempted to add a duplicate template item:', { name, unit });
        return;
    }
    
    // Create new item template (without transaction data)
    const newItem = {
        id: generateId(),
        name: name,
        unit: unit,
        price: parseFloat(formData.get('newItemPrice')) || 0,
        category: category,
        description: formData.get('newItemDescription') || '',
        isTemplate: true, // Mark as template item
        date: new Date().toISOString().split('T')[0]
    };
    
    try {
        // Simpan ke Firestore dan tunggu selesai
        await saveItemChanges(newItem);

        // Jika berhasil, baru update data lokal dan UI
        items.push(newItem);
        
        // Add activity (sekarang bisa dipastikan berhasil)
        // addActivity('template', `Barang template ${newItem.name} ditambahkan`, 
        //             `Satuan: ${newItem.unit}, Kategori: ${newItem.category}`);
        
        hideAddItemModal();
        updateDashboard();
        
        // Ganti alert dengan notifikasi banner yang tidak mengganggu
        showSyncStatusBanner('Barang berhasil ditambahkan sebagai template!', 'success');

    } catch (error) {
        console.error('Gagal menyimpan item baru:', error);
        showSyncStatusBanner('Gagal menyimpan template. Periksa koneksi dan izin Firebase.', 'error');
    }
}

// New functions for enhanced input form
function showTransactionLayout(transactionType) {
    // Hide all transaction layouts
    document.querySelectorAll('.transaction-layout').forEach(layout => {
        layout.style.display = 'none';
    });
    
    // Show the appropriate layout
    if (transactionType === 'in') {
        document.getElementById('inTransactionLayout').style.display = 'block';
    } else if (transactionType === 'damaged') {
        document.getElementById('damagedTransactionLayout').style.display = 'block';
    } else if (transactionType === 'out') {
        document.getElementById('outTransactionLayout').style.display = 'block';
        populateItemSuggestions();
    } else if (transactionType === 'adjustment') {
        document.getElementById('adjustmentTransactionLayout').style.display = 'block';
        populateItemSuggestions();
    }
}

function populateItemSuggestions() {
    const datalist = document.getElementById('itemSuggestions');
    if (!datalist) return;
    
    // Get unique item names from template items and transaction items using keyword matching
    const templateItems = items.filter(item => item.isTemplate);
    const transactionItems = items.filter(item => !item.isTemplate);
    
    // Combine template names and transaction names, removing duplicates
    const allNames = new Set();
    
    // Add template names
    templateItems.forEach(item => allNames.add(item.name));
    
    // Add transaction names that don't already exist in templates
    transactionItems.forEach(item => {
        const hasMatchingTemplate = templateItems.some(template => 
            template.name.toLowerCase().includes(item.name.toLowerCase()) ||
            item.name.toLowerCase().includes(template.name.toLowerCase())
        );
        if (!hasMatchingTemplate) {
            allNames.add(item.name);
        }
    });
    
    datalist.innerHTML = Array.from(allNames).map(name => 
        `<option value="${name}">${name}</option>`
    ).join('');
}

function autoFillItemData(itemName) {
    if (!itemName) return;
    
    // Find the item in template items using keyword matching
    const templateItem = items.find(item => 
        item.isTemplate && 
        (item.name.toLowerCase().includes(itemName.toLowerCase()) || 
         itemName.toLowerCase().includes(item.name.toLowerCase()))
    );
    
    if (templateItem) {
        // Auto-fill unit
        document.getElementById('itemUnitOut').value = templateItem.unit || 'pcs';
        
        // Calculate total stock from activities using keyword matching
        const totalStock = calculateTotalStock(itemName);
        document.getElementById('totalStock').value = totalStock;
    } else {
        // Clear fields if item not found
        document.getElementById('itemUnitOut').value = '';
        document.getElementById('totalStock').value = '';
    }
}

function calculateTotalStock(itemName) {
    // Calculate total stock by summing all IN transactions and subtracting OUT and DAMAGED
    // Uses keyword matching to find related items
    let totalStock = 0;
    
    items.forEach(item => {
        if (!item.isTemplate) {
            const itemNameLower = itemName.toLowerCase().trim();
            const currentItemNameLower = item.name.toLowerCase().trim();
            
            // Check if names match using keyword logic
            if (currentItemNameLower.includes(itemNameLower) || itemNameLower.includes(currentItemNameLower)) {
                if (item.transactionType === 'in') {
                    totalStock += item.quantity || 0;
                } else if (item.transactionType === 'out' || item.transactionType === 'damaged') {
                    totalStock -= item.quantity || 0;
                }
            }
        }
    });
    
    return Math.max(0, totalStock); // Ensure non-negative stock
}

// Initialize form with current date
function initializeInputForm() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('transactionDate');
    if (dateInput) {
        dateInput.value = today;
    }
}

// Functions for handling multiple items in IN, OUT and DAMAGED transactions
function addInItemRow() {
    const inItemsList = document.getElementById('inItemsList');
    const itemIndex = inItemsList.children.length;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'in-item-row';
    itemDiv.innerHTML = `
        <div class="form-row" style="align-items: flex-end;">
            <div class="form-group" style="flex: 3;">
                <label>Nama Barang:</label>
                <input type="text" name="inItemName_${itemIndex}" class="form-control item-name-in" placeholder="Masukkan nama barang" list="itemSuggestions">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Satuan:</label>
                <input type="text" name="inItemUnit_${itemIndex}" class="form-control item-unit-in" readonly placeholder="Otomatis">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Jumlah:</label>
                <input type="number" name="inItemQuantity_${itemIndex}" class="form-control item-quantity-in" min="1" placeholder="Jumlah">
            </div>
            <button type="button" class="btn btn-danger btn-sm remove-item" onclick="removeInItemRow(this)" style="margin-bottom: 0; height: 38px;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    inItemsList.appendChild(itemDiv);
    
    // Add event listeners for auto-fill functionality
    const nameInput = itemDiv.querySelector('.item-name-in');
    nameInput.addEventListener('input', function() {
        autoFillInItemData(this);
    });
}

function addOutItemRow() {
    const outItemsList = document.getElementById('outItemsList');
    const itemIndex = outItemsList.children.length;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'out-item-row';
    itemDiv.innerHTML = `
        <div class="form-row" style="align-items: flex-end;">
            <div class="form-group" style="flex: 3;">
                <label>Nama Barang:</label>
                <input type="text" name="outItemName_${itemIndex}" class="form-control item-name-out" placeholder="Masukkan nama barang" list="itemSuggestions">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Satuan:</label>
                <input type="text" name="outItemUnit_${itemIndex}" class="form-control item-unit-out" readonly placeholder="Otomatis">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Total Stok:</label>
                <input type="number" name="outItemStock_${itemIndex}" class="form-control item-stock-out" readonly placeholder="Stok Otomatis">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Jumlah Keluar:</label>
                <input type="number" name="outItemQuantity_${itemIndex}" class="form-control item-quantity-out" min="1" placeholder="Jumlah Keluar">
            </div>
            <button type="button" class="btn btn-danger btn-sm remove-item" onclick="removeOutItemRow(this)" style="margin-bottom: 0; height: 38px;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    outItemsList.appendChild(itemDiv);
    
    // Add event listeners for auto-fill functionality
    const nameInput = itemDiv.querySelector('.item-name-out');
    nameInput.addEventListener('input', function() {
        autoFillOutItemData(this);
    });
}

function addDamagedItemRow() {
    const damagedItemsList = document.getElementById('damagedItemsList');
    const itemIndex = damagedItemsList.children.length;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'damaged-item-row';
    itemDiv.innerHTML = `
        <div class="form-row" style="align-items: flex-end;">
            <div class="form-group" style="flex: 3;">
                <label>Nama Barang:</label>
                <input type="text" name="damagedItemName_${itemIndex}" class="form-control item-name-damaged" placeholder="Masukkan nama barang" list="itemSuggestions">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Jumlah:</label>
                <input type="number" name="damagedItemQuantity_${itemIndex}" class="form-control item-quantity-damaged" min="1" placeholder="Jumlah">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Satuan:</label>
                <input type="text" name="damagedItemUnit_${itemIndex}" class="form-control item-unit-damaged" readonly placeholder="Otomatis">
            </div>
            <div class="form-group" style="flex: 2;">
                <label>Foto:</label>
                <input type="file" name="damagedItemPhoto_${itemIndex}" class="form-control item-photo-damaged" accept="image/*">
            </div>
            <button type="button" class="btn btn-danger btn-sm remove-item" onclick="removeDamagedItemRow(this)" style="margin-bottom: 0; height: 38px;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    damagedItemsList.appendChild(itemDiv);

    // Add event listeners for auto-fill functionality
    const nameInput = itemDiv.querySelector('.item-name-damaged');
    nameInput.addEventListener('input', function() {
        autoFillDamagedItemData(this);
    });
}

function addAdjustmentItemRow() {
    const adjustmentItemsList = document.getElementById('adjustmentItemsList');
    const itemIndex = adjustmentItemsList.children.length;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'adjustment-item-row';
    // Menambahkan kolom "Selisih" dan event listener untuk kalkulasi otomatis
    itemDiv.innerHTML = `
        <div class="form-row" style="align-items: flex-end;">
            <div class="form-group" style="flex: 2;">
                <label>Nama Barang:</label>
                <input type="text" name="adjustmentItemName_${itemIndex}" class="form-control item-name-adjustment" placeholder="Pilih nama barang" list="itemSuggestions">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Satuan:</label>
                <input type="text" name="adjustmentItemUnit_${itemIndex}" class="form-control item-unit-adjustment" readonly>
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Stok Sistem:</label>
                <input type="number" name="adjustmentItemStockSystem_${itemIndex}" class="form-control item-stock-system" readonly>
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Stok Fisik:</label>
                <input type="number" name="adjustmentItemStockPhysical_${itemIndex}" class="form-control item-stock-physical" min="0" placeholder="Hitung Fisik" oninput="calculateDifference(this)">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Selisih:</label>
                <input type="number" name="adjustmentItemDifference_${itemIndex}" class="form-control item-stock-difference" readonly>
            </div>
            <button type="button" class="btn btn-danger btn-sm remove-item" onclick="removeAdjustmentItemRow(this)" style="margin-bottom: 0; height: 38px;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    adjustmentItemsList.appendChild(itemDiv);

    const nameInput = itemDiv.querySelector('.item-name-adjustment');
    nameInput.addEventListener('input', () => autoFillAdjustmentItemData(nameInput));
}

function calculateDifference(physicalStockInput) {
    const row = physicalStockInput.closest('.form-row');
    const systemStock = parseInt(row.querySelector('.item-stock-system').value) || 0;
    const physicalStock = parseInt(physicalStockInput.value) || 0;
    const differenceInput = row.querySelector('.item-stock-difference');
    differenceInput.value = physicalStock - systemStock;
}

function removeInItemRow(button) {
    button.closest('.form-row').parentElement.remove();
}

function removeOutItemRow(button) {
    button.closest('.form-row').parentElement.remove();
}

function removeDamagedItemRow(button) {
    button.closest('.form-row').parentElement.remove();
}

function removeAdjustmentItemRow(button) {
    button.closest('.form-row').parentElement.remove();
}

function autoFillInItemData(inputElement) {
    const itemName = inputElement.value;
    if (!itemName) return;
    
    // Find the item in template items using keyword matching
    const templateItem = items.find(item => 
        item.isTemplate && 
        (item.name.toLowerCase().includes(itemName.toLowerCase()) || 
         itemName.toLowerCase().includes(item.name.toLowerCase()))
    );
    
    // Try to use template item unit, otherwise fallback to any matching transaction item that has unit
    const matching = findMatchingItem(itemName);
    const unitInput = inputElement.closest('.in-item-row').querySelector('.item-unit-in');
    if (matching && unitInput) {
        unitInput.value = matching.unit || 'pcs';
    } else if (unitInput) {
        unitInput.value = '';
    }
}

function autoFillOutItemData(inputElement) {
    const itemName = inputElement.value;
    if (!itemName) return;
    
    // Find the item in template items using keyword matching
    const templateItem = items.find(item => 
        item.isTemplate && 
        (item.name.toLowerCase().includes(itemName.toLowerCase()) || 
         itemName.toLowerCase().includes(item.name.toLowerCase()))
    );
    
    // Find matching item (template first, then transactions)
    const matching = findMatchingItem(itemName);
    const unitInput = inputElement.closest('.out-item-row').querySelector('.item-unit-out');
    const stockInput = inputElement.closest('.out-item-row').querySelector('.item-stock-out');

    if (matching && unitInput) {
        unitInput.value = matching.unit || 'pcs';
    } else if (unitInput) {
        unitInput.value = '';
    }

    // Calculate total stock from activities using keyword matching (works even if template is missing)
    const totalStock = calculateTotalStock(itemName);
    if (stockInput) {
        stockInput.value = totalStock;
    }
}

function autoFillDamagedItemData(inputElement) {
    const itemName = inputElement.value;
    if (!itemName) return;

    // Find the item in template items using keyword matching
    // Use template or fallback to transactions for unit
    const matching = findMatchingItem(itemName);
    const unitInput = inputElement.closest('.damaged-item-row').querySelector('.item-unit-damaged');
    if (matching && unitInput) {
        unitInput.value = matching.unit || 'pcs';
    } else if (unitInput) {
        unitInput.value = '';
    }
}

function autoFillAdjustmentItemData(inputElement) {
    const itemName = inputElement.value;
    const row = inputElement.closest('.adjustment-item-row');
    if (!itemName || !row) return;

    const matching = findMatchingItem(itemName);
    const unitInput = row.querySelector('.item-unit-adjustment');
    const systemStockInput = row.querySelector('.item-stock-system');

    if (matching && unitInput) {
        unitInput.value = matching.unit || 'pcs';
    } else if (unitInput) {
        unitInput.value = '';
    }

    const totalStock = calculateTotalStock(itemName);
    systemStockInput.value = totalStock;
}

// Helper: find matching item by name. Prefer template items but fallback to any transaction that contains a unit.
function findMatchingItem(name) {
    if (!name) return null;
    const nameLower = name.toLowerCase().trim();

    // Prefer template
    let found = items.find(item => item.isTemplate && (
        item.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(item.name.toLowerCase())
    ));
    if (found) return found;

    // Fallback: any transaction item that has a unit
    found = items.find(item => !item.isTemplate && item.unit && (
        item.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(item.name.toLowerCase())
    ));
    return found || null;
}

// Auto fill functions for Invoice and Surat Jalan
function autoFillInvoiceFromDatabase(isAutoTrigger = false) {
    const invoiceDate = document.getElementById('invoiceDate').value;
    const customerName = document.getElementById('customerName').value;
    // const customerAddress = document.getElementById('customerAddress').value; // Hapus pengecekan alamat
    
    if (!invoiceDate || !customerName) { // Cukup periksa tanggal dan nama pelanggan
        if (!isAutoTrigger) { 
            alert('Mohon isi tanggal, nama, dan alamat pelanggan terlebih dahulu!');
        }
        return;
    }
    
    // Selalu bersihkan daftar item dan total setiap kali fungsi dipanggil
    const invoiceItemsList = document.getElementById('invoiceItemsList');
    invoiceItemsList.innerHTML = '';
    calculateInvoiceTotal(); // Ini akan mengatur total kembali ke 0

    // Find OUT transactions with matching date, name, and address
    const matchingTransactions = items.filter(item => 
        item.transactionType === 'out' && 
        !item.isTemplate && // Pastikan bukan template
        item.date === invoiceDate && // Cocokkan tanggal
        item.customerName && customerName && 
        item.customerName.toLowerCase().trim() === customerName.toLowerCase().trim() // Cocokkan nama pelanggan
    );
    
    if (matchingTransactions.length === 0) {
        console.log('Tidak ditemukan transaksi yang cocok untuk auto-fill.');
        document.getElementById('invoiceNumber').value = generateRBMNumberFromDate(invoiceDate); // Tetap update nomor invoice
        return;
    }
    
    // Update invoice number based on selected date
    const invoiceNumber = generateRBMNumberFromDate(invoiceDate);
    document.getElementById('invoiceNumber').value = invoiceNumber;
    
    // Add items from transactions
    matchingTransactions.forEach((transaction, index) => {
        // Resolve price and unit: prefer template (dashboard), otherwise fallback to latest transaction price/unit
        const nameLower = transaction.name.toLowerCase();
        let templateItem = items.find(t => t.isTemplate && (
            t.name.toLowerCase().includes(nameLower) ||
            nameLower.includes(t.name.toLowerCase())
        ));

        let harga = 0;
        let unit = transaction.unit || 'pcs';

        if (templateItem) {
            harga = templateItem.price || 0;
            unit = templateItem.unit || unit;
        } else {
            // Fallback: try to find most recent transaction (any type) with a price for this item
            const txWithPrice = items
                .filter(i => !i.isTemplate && i.price && (
                    i.name.toLowerCase().includes(nameLower) ||
                    nameLower.includes(i.name.toLowerCase())
                ))
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            if (txWithPrice.length > 0) {
                harga = txWithPrice[0].price || 0;
                unit = txWithPrice[0].unit || unit;
            }
        }

        const total = transaction.quantity * harga;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'invoice-item';
        // Hapus atribut readonly agar bisa diedit jika perlu
        itemDiv.innerHTML = `
            <input type="text" value="${escapeHtml(transaction.name)}" class="form-control item-name" oninput="calculateInvoiceTotal()">
            <input type="number" value="${transaction.quantity}" class="form-control item-quantity" oninput="calculateInvoiceTotal()">
            <input type="number" value="${harga}" class="form-control item-price" oninput="calculateInvoiceTotal()">
            <span class="item-subtotal">Rp ${total.toLocaleString()}</span>
        `;
        invoiceItemsList.appendChild(itemDiv);
    });
    
    // Calculate total
    calculateInvoiceTotal();
}

function autoFillSuratJalanFromDatabase() {
    const suratJalanDate = document.getElementById('suratJalanDate').value;
    const deliveryAddress = document.getElementById('deliveryAddress').value;
    
    if (!suratJalanDate || !deliveryAddress) {
        alert('Mohon isi tanggal dan alamat pengiriman terlebih dahulu!');
        return;
    }
    
    // Find OUT transactions with matching date and address
    const matchingTransactions = items.filter(item => 
        item.transactionType === 'out' && 
        !item.isTemplate &&
        item.date === suratJalanDate &&
        item.customerAddress && 
        item.customerAddress.toLowerCase().trim() === deliveryAddress.toLowerCase().trim()
    );
    
    if (matchingTransactions.length === 0) {
        alert('Tidak ditemukan transaksi dengan tanggal dan alamat yang sesuai!');
        return;
    }
    
    // Auto fill recipient name from first transaction
    const firstTransaction = matchingTransactions[0];
    document.getElementById('recipientName').value = firstTransaction.customerName || '';
    
    // Update surat jalan number based on selected date
    const suratJalanNumber = generateRBMNumberFromDate(suratJalanDate);
    document.getElementById('suratJalanNumber').value = suratJalanNumber;
    
    // Clear existing items
    const suratJalanItemsList = document.getElementById('suratJalanItemsList');
    suratJalanItemsList.innerHTML = '';
    
    // Add items from transactions
    matchingTransactions.forEach((transaction, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'surat-jalan-item';
        itemDiv.innerHTML = `
            <input type="text" value="${transaction.name}" class="form-control item-name" readonly>
            <input type="number" value="${transaction.quantity}" class="form-control item-quantity" readonly>
            <input type="text" value="Baik" class="form-control item-condition" readonly>
        `;
        
        suratJalanItemsList.appendChild(itemDiv);
    });
    
    alert(`${matchingTransactions.length} item berhasil diisi otomatis dari database!`);
}

function autoFillInvoicePrice(nameInput) {
    const itemName = nameInput.value;
    const itemRow = nameInput.closest('.invoice-item');
    if (!itemName || !itemRow) return;

    const priceInput = itemRow.querySelector('.item-price');
    const templateItem = findMatchingItem(itemName);

    if (templateItem && priceInput) {
        priceInput.value = templateItem.price || 0;
        // Recalculate total after auto-filling price
        calculateInvoiceTotal();
    }
}


// PDF Generation function for Surat Jalan
function generateSuratJalanPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Set font
    doc.setFont('helvetica');
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('SURAT JALAN', 105, 20, { align: 'center' });
    
    // Line separator
    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);
    
    // Document info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nomor: ${data.id}`, 20, 35);
    doc.text(`Tanggal: ${formatDateForDisplay(data.date)}`, 20, 42);
    
    // Recipient info
    doc.setFont('helvetica', 'bold');
    doc.text('Kepada:', 20, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(data.recipientName, 20, 62);
    doc.text(data.deliveryAddress, 20, 69);
    
    // Items table header
    doc.setFont('helvetica', 'bold');
    doc.text('Daftar Barang:', 20, 85);
    
    // Table headers
    doc.setFontSize(10);
    doc.text('No', 20, 95);
    doc.text('Nama Barang', 30, 95);
    doc.text('Jumlah', 120, 95);
    doc.text('Kondisi', 150, 95);
    
    // Table line
    doc.line(20, 97, 190, 97);
    
    // Items
    let yPosition = 105;
    data.items.forEach((item, index) => {
        doc.setFont('helvetica', 'normal');
        doc.text(`${index + 1}`, 20, yPosition);
        doc.text(item.name, 30, yPosition);
        doc.text(item.quantity.toString(), 120, yPosition);
        doc.text(item.condition, 150, yPosition);
        yPosition += 8;
    });
    
    // Footer
    yPosition += 20;
    doc.setFont('helvetica', 'normal');
    doc.text('Catatan:', 20, yPosition);
    doc.text('Barang telah diterima dalam kondisi baik.', 20, yPosition + 7);
    
    // Signature area
    yPosition += 30;
    doc.text('Penerima', 20, yPosition);
    doc.text('Pengirim', 120, yPosition);
    
    // Signature lines
    yPosition += 20;
    doc.line(20, yPosition, 80, yPosition);
    doc.line(120, yPosition, 180, yPosition);
    
    // Save PDF
    const fileName = `SuratJalan_${data.id}.pdf`;
    doc.save(fileName);
}

// PDF Generation function for Invoice (simple layout).
function generateInvoicePDF(data) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'pt', format: 'a5' });

        doc.setFont('helvetica');
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', 40, 40);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Nomor: ${data.number || data.id}`, 40, 70);
        doc.text(`Tanggal: ${formatDateForDisplay(data.date)}`, 300, 70);

        // Customer
        doc.setFont('helvetica', 'bold');
        doc.text('Pelanggan:', 40, 100);
        doc.setFont('helvetica', 'normal');
        doc.text(data.customerName || '-', 40, 115);
        doc.text(data.customerAddress || '-', 40, 130);

        // Table header
        let y = 160;
        doc.setFont('helvetica', 'bold');
        doc.text('No', 40, y);
        doc.text('Nama Item', 70, y);
        doc.text('Jumlah', 320, y);
        doc.text('Harga', 380, y);
        doc.text('Subtotal', 460, y);
        y += 12;
        doc.setLineWidth(0.5);
        doc.line(40, y, 510, y);
        y += 12;

        doc.setFont('helvetica', 'normal');
        (data.items || []).forEach((item, idx) => {
            if (y > 520) {
                doc.addPage();
                y = 40;
            }
            doc.text(String(idx + 1), 40, y);
            doc.text(item.name, 70, y);
            doc.text(String(item.quantity), 320, y);
            doc.text(String(item.price || 0), 380, y);
            doc.text(String(item.subtotal || (item.quantity * (item.price || 0))), 460, y);
            y += 14;
        });

        // Total
        y += 10;
        doc.setFont('helvetica', 'bold');
        doc.text('Total:', 380, y);
        doc.text(String(data.total || 0), 460, y);

        const fileName = `Invoice_${data.number || data.id}.pdf`;
        doc.save(fileName);
    } catch (err) {
        console.error('generateInvoicePDF error:', err);
        throw err;
    }
}

// Helper function to format date
function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Invoice List Management Functions
function showDocumentList() { // Renamed from showHistory
    const documentListSection = document.getElementById('documentListSection');
    const invoiceFormSection = document.getElementById('invoiceFormSection');
    
    if (documentListSection && invoiceFormSection) {
        documentListSection.style.display = 'block';
        invoiceFormSection.style.display = 'none';
        loadInvoiceList();
        loadSuratJalanList();
        showDocumentTab('invoices'); // Show invoice tab by default
    }
}

function showDocumentTab(tabId) {
    const documentListSection = document.getElementById('documentListSection');
    if (!documentListSection) return;

    // Hide all tab contents
    documentListSection.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    // Deactivate all tab buttons
    documentListSection.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show the selected tab content and activate its button
    document.getElementById(tabId + 'Tab').style.display = 'block';
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
}

function showInvoiceForm() {
    const documentListSection = document.getElementById('documentListSection');
    const invoiceFormSection = document.getElementById('invoiceFormSection');

    if (documentListSection && invoiceFormSection) {
        documentListSection.style.display = 'none';
        invoiceFormSection.style.display = 'block';
    }
}

function loadInvoiceList() {
    const invoiceList = document.getElementById('invoiceList');
    if (!invoiceList) return;
    
    const savedInvoices = invoices; // Use the global invoices array
    
    if (savedInvoices.length === 0) {
        invoiceList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6c757d;">
                <i class="fas fa-file-invoice" style="font-size: 3em; margin-bottom: 20px; opacity: 0.5;"></i>
                <h3>Belum ada invoice</h3>
                <p>Klik "Buat Invoice Baru" untuk membuat invoice pertama</p>
            </div>
        `;
        return;
    }
    
    const invoicesHtml = savedInvoices.sort((a, b) => new Date(b.date) - new Date(a.date)).map(invoice => `
        <div class="invoice-card" data-id="${invoice.id}">
            <div class="invoice-card-header">
                <h3>${invoice.number}</h3>
                <span class="invoice-date">${formatDateForDisplay(invoice.date)}</span>
            </div>
            <div class="invoice-card-body">
                <div class="invoice-info">
                    <p><strong>Pelanggan:</strong> ${invoice.customerName}</p>
                    <p><strong>Alamat:</strong> ${invoice.customerAddress}</p>
                    <p><strong>Total:</strong> <span class="invoice-total">Rp ${invoice.total.toLocaleString()}</span></p>
                    <p><strong>Item:</strong> ${invoice.items.length} barang</p>
                </div>
                <div class="invoice-actions">
                    <button class="btn btn-sm btn-primary" onclick="printInvoiceFromList('${invoice.id}')">
                        <i class="fas fa-print"></i> Cetak Invoice
                    </button>
                    <button class="btn btn-sm btn-success" onclick="printSuratJalanFromInvoice('${invoice.id}')">
                        <i class="fas fa-truck"></i> Cetak Surat Jalan
                    </button>
                    <button class="btn btn-sm btn-info combined-print" onclick="printInvoiceAndSuratJalanFromList('${invoice.id}')" title="Cetak Invoice dan Surat Jalan sekaligus">
                        <i class="fas fa-print"></i> Cetak Keduanya
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${invoice.id}')">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    invoiceList.innerHTML = invoicesHtml;
}

function filterInvoices() {
    const searchTerm = document.getElementById('invoiceSearch').value.toLowerCase();
    const invoiceCards = document.querySelectorAll('.invoice-card');
    
    invoiceCards.forEach(card => {
        const invoiceNumber = card.querySelector('h3').textContent.toLowerCase(); // Assuming invoice number is in h3
        const customerName = card.querySelector('.invoice-info p').textContent.toLowerCase();
        const address = card.querySelectorAll('.invoice-info p')[1].textContent.toLowerCase();
        
        const matches = invoiceNumber.includes(searchTerm) || 
                       customerName.includes(searchTerm) || 
                       address.includes(searchTerm);
        
        card.style.display = matches ? 'block' : 'none';
    });
}

function printInvoiceFromList(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    
    if (!invoice) {
        alert('Invoice tidak ditemukan!');
        return;
    }
    
    // Create print content and print
    const printContent = createInvoicePrintContent(invoice);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

function printSuratJalanFromInvoice(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    
    if (!invoice) {
        alert('Invoice tidak ditemukan!');
        return;
    }
    
    // Create surat jalan data from invoice
    const suratJalanData = {
        number: invoice.number,
        date: invoice.date,
        deliveryAddress: invoice.customerAddress,
        recipientName: invoice.customerName,
        items: invoice.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            condition: 'Baik'
        }))
    };
    
    // Create print content and print
    const printContent = createSuratJalanPrintContent(suratJalanData);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
    
    alert('Surat Jalan berhasil dicetak!');
}

function printInvoiceAndSuratJalanFromList(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    
    if (!invoice) {
        alert('Invoice tidak ditemukan!');
        return;
    }
    
    // Create surat jalan data from invoice
    const suratJalanData = {
        number: invoice.number,
        date: invoice.date,
        deliveryAddress: invoice.customerAddress,
        recipientName: invoice.customerName,
        items: invoice.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            condition: 'Baik'
        }))
    };
    
    // Create combined print content
    const invoiceContent = createInvoicePrintContent(invoice);
    const suratJalanContent = createSuratJalanPrintContent(suratJalanData);
    
    const combinedContent = `
        <div style="page-break-after: always;">
            ${invoiceContent}
        </div>
        <div>
            ${suratJalanContent}
        </div>
    `;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice & Surat Jalan - ${invoice.number}</title>
            <style>
                @page { size: A5 portrait; margin: 10mm; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                    .page-break { page-break-before: always; }
                }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            </style>
        </head>
        <body>
            ${combinedContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
    
    alert('Invoice dan Surat Jalan berhasil dicetak!');
}

function deleteInvoice(invoiceId) {
    if (!confirm('Apakah Anda yakin ingin menghapus invoice ini?')) {
        return;
    }
    
    invoices = invoices.filter(inv => inv.id !== invoiceId);
    deleteDocument('invoices', invoiceId); // Use new granular delete function
    loadInvoiceList();
    
    alert('Invoice berhasil dihapus!');
}

// Surat Jalan List Management Functions
function loadSuratJalanList() {
    const suratJalanList = document.getElementById('suratJalanList');
    if (!suratJalanList) return;
    
    // Get saved surat jalan from global variable
    const savedSuratJalan = suratJalan; // Use global variable
    
    if (savedSuratJalan.length === 0) {
        suratJalanList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6c757d;">
                <i class="fas fa-truck" style="font-size: 3em; margin-bottom: 20px; opacity: 0.5;"></i>
                <h3>Belum ada surat jalan</h3>
                <p>Klik "Buat Surat Jalan Baru" untuk membuat surat jalan pertama</p>
            </div>
        `;
        return;
    }
    
    const suratJalanHtml = savedSuratJalan.sort((a, b) => new Date(b.date) - new Date(a.date)).map(suratJalan => `
        <div class="surat-jalan-card" data-id="${suratJalan.id}">
            <div class="surat-jalan-card-header">
                <h3>${suratJalan.id}</h3>
                <span class="surat-jalan-date">${formatDateForDisplay(suratJalan.date)}</span>
            </div>
            <div class="surat-jalan-card-body">
                <div class="surat-jalan-info">
                    <p><strong>Penerima:</strong> ${suratJalan.recipientName}</p>
                    <p><strong>Alamat:</strong> ${suratJalan.deliveryAddress}</p>
                    <p><strong>Item:</strong> ${suratJalan.items.length} barang</p>
                    <p><strong>Status:</strong> <span class="surat-jalan-status">Siap Kirim</span></p>
                </div>
                <div class="surat-jalan-actions">
                    <button class="btn btn-sm btn-primary" onclick="printSuratJalanFromList('${suratJalan.id}')">
                        <i class="fas fa-print"></i> Cetak
                    </button>
                    <button class="btn btn-sm btn-success" onclick="generateSuratJalanPDFFromList('${suratJalan.id}')">
                        <i class="fas fa-download"></i> Download PDF
                    </button>
                    <button class="btn btn-sm btn-info combined-print" onclick="printInvoiceAndSuratJalanFromSuratJalanList('${suratJalan.id}')" title="Cetak Invoice dan Surat Jalan sekaligus">
                        <i class="fas fa-print"></i> Cetak Keduanya
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSuratJalan('${suratJalan.id}')">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    suratJalanList.innerHTML = suratJalanHtml;
}

function filterSuratJalan() {
    const searchTerm = document.getElementById('suratJalanSearch').value.toLowerCase();
    const suratJalanCards = document.querySelectorAll('.surat-jalan-card');
    
    suratJalanCards.forEach(card => {
        const suratJalanNumber = card.querySelector('h3').textContent.toLowerCase(); // Assuming SJ number is in h3
        const recipientName = card.querySelector('.surat-jalan-info p').textContent.toLowerCase();
        const address = card.querySelectorAll('.surat-jalan-info p')[1].textContent.toLowerCase();
        
        const matches = suratJalanNumber.includes(searchTerm) || 
                       recipientName.includes(searchTerm) || 
                       address.includes(searchTerm);
        
        card.style.display = matches ? 'block' : 'none';
    });
}

function printSuratJalanFromList(suratJalanId) {
    const suratJalanItem = suratJalan.find(sj => sj.id === suratJalanId);
    
    if (!suratJalanItem) {
        alert('Surat Jalan tidak ditemukan!');
        return;
    }
    
    // Create print content and print
    const printContent = createSuratJalanPrintContent(suratJalanItem);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

function generateSuratJalanPDFFromList(suratJalanId) {
    const suratJalanItem = suratJalan.find(sj => sj.id === suratJalanId);
    
    if (!suratJalanItem) {
        alert('Surat Jalan tidak ditemukan!');
        return;
    }
    
    // Generate and save PDF
    generateSuratJalanPDF(suratJalanItem);
    alert('PDF Surat Jalan berhasil didownload!');
}

function printInvoiceAndSuratJalanFromSuratJalanList(suratJalanId) {
    const suratJalanItem = suratJalan.find(sj => sj.id === suratJalanId);
    
    if (!suratJalanItem) {
        alert('Surat Jalan tidak ditemukan!');
        return;
    }
    
    // Create invoice data from surat jalan
    const invoiceData = {
        number: suratJalanItem.id,
        date: suratJalanItem.date,
        customerName: suratJalanItem.recipientName,
        customerAddress: suratJalanItem.deliveryAddress,
        items: suratJalanItem.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: 0, // Default price, should be filled from database
            subtotal: 0
        })),
        total: 0
    };
    
    // Try to get prices from database
    invoiceData.items.forEach(item => {
        const templateItem = items.find(t => t.isTemplate && 
            (t.name.toLowerCase().includes(item.name.toLowerCase()) || 
             item.name.toLowerCase().includes(t.name.toLowerCase())));
        
        if (templateItem) {
            item.price = templateItem.price || 0;
            item.subtotal = item.quantity * item.price;
        }
    });
    
    invoiceData.total = invoiceData.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    // Create combined print content
    const invoiceContent = createInvoicePrintContent(invoiceData);
    const suratJalanContent = createSuratJalanPrintContent(suratJalanItem);
    
    const combinedContent = `
        <div style="page-break-after: always;">
            ${invoiceContent}
        </div>
        <div>
            ${suratJalanContent}
        </div>
    `;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
            <title>Invoice & Surat Jalan - ${suratJalanItem.id}</title>
            <style>
                @page { size: A5 portrait; margin: 10mm; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                    .page-break { page-break-before: always; }
                }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            </style>
        </head>
        <body>
            ${combinedContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
    
    alert('Invoice dan Surat Jalan berhasil dicetak!');
}

function deleteSuratJalan(suratJalanId) {
    if (!confirm('Apakah Anda yakin ingin menghapus surat jalan ini?')) {
        return;
    }
    
    suratJalan = suratJalan.filter(sj => sj.id !== suratJalanId);
    deleteDocument('suratJalan', suratJalanId); // Use new granular delete function
    loadSuratJalanList();
    
    alert('Surat Jalan berhasil dihapus!');
}

// --- FUNGSI BUKU HUTANG ---

function loadHutangTable() {
    const tableBody = document.getElementById('hutangTableBody');
    if (!tableBody) return;

    // Urutkan invoice dari yang terbaru
    const sortedInvoices = [...invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    tableBody.innerHTML = sortedInvoices.map(invoice => {
        const status = invoice.paymentStatus || 'Belum Lunas';
        const statusClass = status === 'Lunas' ? 'status-lunas' : 'status-belum-lunas';

        return `
            <tr data-invoice-id="${invoice.id}">
                <td>${invoice.id}</td>
                <td>${formatDate(invoice.date)}</td>
                <td>${invoice.customerName}</td>
                <td>Rp ${(invoice.total || 0).toLocaleString()}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>
                    <input type="checkbox" class="payment-checkbox" onchange="markAsPaid('${invoice.id}')" ${status === 'Lunas' ? 'checked disabled' : ''}>
                </td>
            </tr>
        `;
    }).join('');
}

function markAsPaid(invoiceId) {
    const invoiceIndex = invoices.findIndex(inv => inv.id === invoiceId);
    if (invoiceIndex === -1) {
        alert('Invoice tidak ditemukan!');
        return;
    }
    
    // Update status menjadi Lunas dan simpan ke Firebase
    invoices[invoiceIndex].paymentStatus = 'Lunas';
    // Set amountPaid sama dengan total untuk konsistensi
    invoices[invoiceIndex].amountPaid = invoices[invoiceIndex].total;
    
    saveDocument('invoices', invoices[invoiceIndex]); // Use new granular save function
    loadHutangTable(); // Muat ulang tabel untuk menampilkan data terbaru
}

function filterHutangTable(searchTerm) {
    const rows = document.querySelectorAll('#hutangTableBody tr');
    const term = searchTerm.toLowerCase();
    rows.forEach(row => {
        const textContent = row.textContent.toLowerCase();
        row.style.display = textContent.includes(term) ? '' : 'none';
    });
}

// Edit item functions (for template items on dashboard)
function showEditItemModal() {
    const modal = document.getElementById('editItemModal');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('show');
        showItemSelectionDialog('edit');
    }
}

function hideEditItemModal() {
    const modal = document.getElementById('editItemModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

// Delete item modal functions removed: delete functionality is disabled from UI.
// If you need to re-enable deletes, implement a server-side protected endpoint
// or restore these functions with proper checks and permissions.

function showItemSelectionDialog(action) {
    const allItems = items.filter(item => item.isTemplate);
    
    if (allItems.length === 0) {
        alert('Tidak ada barang template yang bisa di' + (action === 'edit' ? 'edit' : 'hapus') + '!');
        if (action === 'edit') {
            hideEditItemModal();
        }
        return;
    }
    
    let itemList = 'Pilih barang template yang ingin di' + (action === 'edit' ? 'edit' : 'hapus') + ':\n\n';
    allItems.forEach((item, index) => {
        const hasTransactions = items.some(t => !t.isTemplate && 
            (t.name.toLowerCase().includes(item.name.toLowerCase()) || 
             item.name.toLowerCase().includes(t.name.toLowerCase())));
        
        itemList += `${index + 1}. ${item.name} (${item.unit}) - Rp ${item.price.toLocaleString()}`;
        if (hasTransactions) {
            itemList += ' [Memiliki transaksi]';
        }
        itemList += '\n';
    });
    
    const selection = prompt(itemList + '\nMasukkan nomor barang:');
    const selectedIndex = parseInt(selection) - 1;
    
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= allItems.length) {
        alert('Pilihan tidak valid!');
        if (action === 'edit') {
            hideEditItemModal();
        }
        return;
    }
    
    const selectedItem = allItems[selectedIndex];
    
    if (action === 'edit') {
        document.getElementById('editItemName').value = selectedItem.name;
        document.getElementById('editItemUnit').value = selectedItem.unit;
        document.getElementById('editItemPrice').value = selectedItem.price;
        document.getElementById('editItemCategory').value = selectedItem.category;
        document.getElementById('editItemDescription').value = selectedItem.description || '';
    } else {
        // Delete action removed: inform user and close any modal
        alert('Fungsi hapus barang telah dinonaktifkan. Gunakan fitur edit untuk memodifikasi data.');
        // Ensure any accidental delete modal is closed if present
        const delModal = document.getElementById('deleteItemModal');
        if (delModal) {
            delModal.style.display = 'none';
            delModal.classList.remove('show');
        }
        return;
    }
}

function saveEditItemData() {
    const form = document.getElementById('editItemForm');
    const formData = new FormData(form);
    
    const name = formData.get('editItemName');
    const unit = formData.get('editItemUnit');
    const price = parseFloat(formData.get('editItemPrice')) || 0;
    const category = formData.get('editItemCategory');
    const description = formData.get('editItemDescription') || '';
    
    if (!name || !unit || !category) {
        alert('Mohon isi semua field yang wajib diisi!');
        return;
    }
    
    const itemIndex = items.findIndex(item => item.name === name && item.isTemplate);
    if (itemIndex === -1) { alert('Barang tidak ditemukan!'); return; }
    
    // Update properties in the local array
    const updatedItem = { ...items[itemIndex], name, unit, price, category, description };
    items[itemIndex] = updatedItem;
    
    saveItemChanges(updatedItem); // Save the specific updated item
    hideEditItemModal();
    updateDashboard(); // This will call the correct updateDashboardTable
    alert('Barang berhasil diperbarui!');
}

// confirmDeleteItemData removed: delete flow is disabled client-side.

// --- FUNGSI UNTUK MENAMBAHKAN DATA AWAL SECARA OTOMATIS ---
// Fungsi ini bisa Anda panggil sekali dari console browser untuk mengisi data.
async function seedInitialItems() {
    console.log('Memulai proses penambahan data awal...');
    showLoadingSpinner();

    const itemsToSeed = [
        { name: 'Pewarna Gelap', unit: 'Btl', price: 1, category: 'Minuman' },
        { name: 'Pewarna Terang', unit: 'Btl', price: 1, category: 'Minuman' },
        { name: 'Crimer', unit: 'Pck', price: 1, category: 'Minuman' },
        { name: 'SKM', unit: 'Btl', price: 1, category: 'Minuman' },
        { name: 'Bombay', unit: 'kg', price: 1, category: 'Makanan' },
        { name: 'Beras', unit: 'kg', price: 1, category: 'Makanan' },
        { name: 'Mineral Water', unit: 'dus', price: 1, category: 'Minuman' }
    ];

    const newItemsToSave = [];
    const existingItemsMessages = [];

    for (const seed of itemsToSeed) {
        // Cek apakah template dengan nama dan satuan yang sama sudah ada
        const existingItem = items.find(item => 
            item.isTemplate &&
            (item.name || '').toLowerCase() === (seed.name || '').toLowerCase() && 
            item.unit === seed.unit
        );

        if (existingItem) {
            existingItemsMessages.push(`   - Barang "${seed.name}" (${seed.unit}) sudah ada.`);
            continue; // Lewati jika sudah ada
        }

        // Buat objek item baru jika belum ada
        const newItem = {
            id: generateId(),
            name: seed.name,
            unit: seed.unit,
            price: seed.price,
            category: seed.category,
            description: 'Ditambahkan secara otomatis',
            isTemplate: true,
            date: new Date().toISOString().split('T')[0]
        };
        newItemsToSave.push(newItem);
    }

    if (newItemsToSave.length > 0) {
        try {
            await saveItemChanges(newItemsToSave); // Simpan ke Firebase
            items.push(...newItemsToSave); // Update data lokal
            updateDashboard(); // Refresh tampilan
            showAlert(`${newItemsToSave.length} barang baru berhasil ditambahkan!`, 'Sukses');
        } catch (error) {
            showAlert('Gagal menyimpan data ke Firebase. Lihat console untuk detail.', 'Error');
        }
    } else {
        showAlert('Tidak ada barang baru yang ditambahkan. Semua barang mungkin sudah ada.', 'Info');
    }

    if (existingItemsMessages.length > 0) {
        console.warn('Beberapa barang dilewati karena sudah ada:\n' + existingItemsMessages.join('\n'));
    }

    hideLoadingSpinner();
    console.log('Proses selesai.');
}
