// Item management utilities
let itemTemplates = [];

// Load item templates from Firestore
async function loadItemTemplates() {
    try {
        const snapshot = await db.collection('items')
            .where('isTemplate', '==', true)
            .get();
        
        itemTemplates = snapshot.docs.map(doc => doc.data());
        populateItemDropdowns();
    } catch (error) {
        console.error('Error loading item templates:', error);
        showAlert('Gagal memuat data barang', 'Error');
    }
}

// Get current stock for an item
async function getCurrentStock(itemName) {
    try {
        const stockDoc = await db.collection('stock').doc(itemName).get();
        if (stockDoc.exists) {
            return stockDoc.data().quantity || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting stock:', error);
        return 0;
    }
}

// Populate all item dropdowns
function populateItemDropdowns() {
    const itemSelects = document.querySelectorAll('.item-name-select');
    itemSelects.forEach(select => {
        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Add items from templates
        itemTemplates.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            option.textContent = item.name;
            option.dataset.unit = item.unit;
            select.appendChild(option);
        });
    });
}

// Handle item selection
async function handleItemSelection(select, rowElement) {
    const selectedOption = select.options[select.selectedIndex];
    const unit = selectedOption.dataset.unit;
    
    // Set unit
    const unitInput = rowElement.querySelector('.item-unit');
    if (unitInput) {
        unitInput.value = unit;
    }
    
    // If this is an outgoing transaction, update stock display
    const stockDisplay = rowElement.querySelector('.current-stock');
    if (stockDisplay) {
        const currentStock = await getCurrentStock(select.value);
        stockDisplay.textContent = `Stok: ${currentStock} ${unit}`;
        
        // Update max quantity
        const quantityInput = rowElement.querySelector('.item-quantity');
        if (quantityInput) {
            quantityInput.max = currentStock;
        }
    }
}

// Create new item row
function createItemRow(type) {
    const row = document.createElement('div');
    row.className = 'form-row item-row';
    
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    nameGroup.innerHTML = `
        <label>Nama Barang:</label>
        <select class="form-control item-name-select" required>
            <option value="">Pilih Barang</option>
        </select>
    `;
    
    const quantityGroup = document.createElement('div');
    quantityGroup.className = 'form-group';
    quantityGroup.innerHTML = `
        <label>Jumlah:</label>
        <input type="number" class="form-control item-quantity" required min="1" step="1">
    `;
    
    const unitGroup = document.createElement('div');
    unitGroup.className = 'form-group';
    unitGroup.innerHTML = `
        <label>Satuan:</label>
        <input type="text" class="form-control item-unit" readonly>
    `;
    
    row.appendChild(nameGroup);
    row.appendChild(quantityGroup);
    row.appendChild(unitGroup);
    
    // Add stock display for outgoing transactions
    if (type === 'out') {
        const stockGroup = document.createElement('div');
        stockGroup.className = 'form-group';
        stockGroup.innerHTML = `
            <label>Stok Tersedia:</label>
            <div class="current-stock">Stok: 0</div>
        `;
        row.appendChild(stockGroup);
    }
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-danger btn-sm remove-item';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = () => row.remove();
    row.appendChild(removeBtn);
    
    // Set up event listeners
    const select = row.querySelector('.item-name-select');
    select.addEventListener('change', () => handleItemSelection(select, row));
    
    // Populate items
    populateItemDropdowns();
    
    return row;
}

// Initialize item management
async function initializeItemManagement() {
    await loadItemTemplates();
    
    // Set up add item buttons
    const addInBtn = document.getElementById('addInItem');
    const addOutBtn = document.getElementById('addOutItem');
    const addDamagedBtn = document.getElementById('addDamagedItem');
    const addAdjustmentBtn = document.getElementById('addAdjustmentItem');
    
    if (addInBtn) addInBtn.onclick = () => {
        const container = document.getElementById('inItemsList');
        container.appendChild(createItemRow('in'));
    };
    
    if (addOutBtn) addOutBtn.onclick = () => {
        const container = document.getElementById('outItemsList');
        container.appendChild(createItemRow('out'));
    };
    
    if (addDamagedBtn) addDamagedBtn.onclick = () => {
        const container = document.getElementById('damagedItemsList');
        container.appendChild(createItemRow('damaged'));
    };
    
    if (addAdjustmentBtn) addAdjustmentBtn.onclick = () => {
        const container = document.getElementById('adjustmentItemsList');
        container.appendChild(createItemRow('adjustment'));
    };
}