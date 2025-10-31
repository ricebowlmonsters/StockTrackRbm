// Item row template and management
function createItemRowTemplate() {
    return `
        <div class="form-row item-row">
            <div class="form-group">
                <label>Nama Barang:</label>
                <select class="form-control item-name-select" required>
                    <option value="">Pilih Barang</option>
                </select>
            </div>
            <div class="form-group">
                <label>Jumlah:</label>
                <input type="number" class="form-control item-quantity" required min="1" step="1">
            </div>
            <div class="form-group">
                <label>Satuan:</label>
                <input type="text" class="form-control item-unit" readonly>
            </div>
            <button type="button" class="btn btn-danger btn-sm remove-item">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

// Add new item row
function addItemRow(containerId) {
    const container = document.getElementById(containerId);
    const template = createItemRowTemplate();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = template;
    const newRow = tempDiv.firstElementChild;
    
    // Set up event listeners for the new row
    const select = newRow.querySelector('.item-name-select');
    select.addEventListener('change', async function() {
        const selectedItem = itemTemplates.find(item => item.name === this.value);
        if (selectedItem) {
            const row = this.closest('.form-row');
            const unitInput = row.querySelector('.item-unit');
            unitInput.value = selectedItem.unit;
            
            // If this is an out transaction, check and display stock
            if (containerId === 'outItemsList') {
                const stock = await getCurrentStock(selectedItem.name);
                const quantityInput = row.querySelector('.item-quantity');
                quantityInput.max = stock;
                quantityInput.title = `Stok tersedia: ${stock}`;
            }
        }
    });
    
    // Set up remove button
    const removeBtn = newRow.querySelector('.remove-item');
    removeBtn.addEventListener('click', function() {
        newRow.remove();
    });
    
    container.appendChild(newRow);
    populateItemDropdowns();
}

// Process form data
async function processFormData(form) {
    const formData = new FormData(form);
    const transactionType = formData.get('transactionType');
    const date = formData.get('transactionDate');
    
    if (!transactionType || !date) {
        throw new Error('Pilih jenis transaksi dan tanggal!');
    }
    
    // Get items based on transaction type
    const itemsList = document.getElementById(`${transactionType}ItemsList`);
    const items = [];
    
    const rows = itemsList.querySelectorAll('.item-row');
    for (const row of rows) {
        const nameSelect = row.querySelector('.item-name-select');
        const quantityInput = row.querySelector('.item-quantity');
        const unitInput = row.querySelector('.item-unit');
        
        if (!nameSelect.value || !quantityInput.value || !unitInput.value) {
            throw new Error('Semua field item harus diisi!');
        }
        
        // For outgoing transactions, verify stock
        if (transactionType === 'out') {
            const currentStock = await getCurrentStock(nameSelect.value);
            if (parseInt(quantityInput.value) > currentStock) {
                throw new Error(`Stok ${nameSelect.value} tidak mencukupi! Tersedia: ${currentStock}`);
            }
        }
        
        items.push({
            name: nameSelect.value,
            quantity: parseInt(quantityInput.value),
            unit: unitInput.value,
            transactionType,
            date,
            description: formData.get('itemDescription') || ''
        });
    }
    
    if (items.length === 0) {
        throw new Error('Tambahkan minimal satu item!');
    }
    
    return items;
}

// Save transaction
async function saveTransaction(items) {
    const batch = db.batch();
    
    for (const item of items) {
        // Create transaction document
        const transactionRef = db.collection('transactions').doc();
        batch.set(transactionRef, {
            ...item,
            id: transactionRef.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update stock
        const stockRef = db.collection('stock').doc(item.name);
        const stockChange = item.transactionType === 'in' ? item.quantity : -item.quantity;
        batch.set(stockRef, {
            name: item.name,
            quantity: firebase.firestore.FieldValue.increment(stockChange),
            unit: item.unit,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Add to activity log
        const activityRef = db.collection('activities').doc();
        batch.set(activityRef, {
            id: activityRef.id,
            type: item.transactionType,
            title: `${item.name} ${item.transactionType === 'in' ? 'masuk' : 'keluar'}`,
            description: `${item.quantity} ${item.unit}`,
            date: item.date,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    
    await batch.commit();
}